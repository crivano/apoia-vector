import getDb from "@/lib/db";
import { extractArray, extractValue, extractContent } from "@/lib/jsonpath";
import { transformData } from "@/lib/transform";
import { generateEmbeddings } from "@/lib/embeddings";
import type { PaginationConfig, SyncResult } from "@/types";

/**
 * Set a value at a nested path in an object
 * Supports JSONPath-like syntax: $.filtro.pagina, filtro.pagina, or just pagina
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  // Remove $. prefix if present
  const cleanPath = path.replace(/^\$\.?/, "");
  const parts = cleanPath.split(".");
  
  let current: Record<string, unknown> = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

interface SourceRecord {
  id: string;
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  headers: string | Record<string, string>;
  body: string | Record<string, unknown>;
  query_params: string | Record<string, string>;
  array_path: string;
  id_path: string;
  content_path: string;
  content_template?: string;
  pagination?: string | PaginationConfig;
  transform_script?: string;
}

interface FetchedItem {
  externalId: string;
  content: string;
  originalData: Record<string, unknown>;
  transformedData?: Record<string, unknown>;
}

/**
 * Sync a data source - fetch items, compare with DB, update as needed
 */
export async function syncDataSource(source: SourceRecord): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let added = 0;
  let updated = 0;
  let deleted = 0;

  try {
    const db = getDb();

    // Fetch all items from the source
    const fetchedItems = await fetchAllItems(source);

    // Get existing items from DB
    const existingItems = await db("vector_items")
      .where("source_id", source.id)
      .select("id", "external_id", "content");

    const existingMap = new Map(
      existingItems.map((item: { external_id: string; id: string; content: string }) => [
        item.external_id,
        { id: item.id, content: item.content },
      ])
    );

    const fetchedIds = new Set(fetchedItems.map((item) => item.externalId));

    // Identify items to add, update, or delete
    const toAdd: FetchedItem[] = [];
    const toUpdate: { item: FetchedItem; existingId: string }[] = [];
    const toDelete: string[] = [];

    for (const item of fetchedItems) {
      const existing = existingMap.get(item.externalId);
      if (!existing) {
        toAdd.push(item);
      } else if (existing.content !== item.content) {
        toUpdate.push({ item, existingId: existing.id });
      }
    }

    for (const [externalId, existing] of existingMap) {
      if (!fetchedIds.has(externalId)) {
        toDelete.push(existing.id);
      }
    }

    // Generate embeddings for new and updated items
    const itemsNeedingEmbeddings = [...toAdd, ...toUpdate.map((u) => u.item)];
    let embeddings: number[][] = [];

    if (itemsNeedingEmbeddings.length > 0) {
      try {
        embeddings = await generateEmbeddings(
          itemsNeedingEmbeddings.map((item) => item.content)
        );
      } catch (error) {
        errors.push(`Error generating embeddings: ${error}`);
        return { sourceId: source.id, added, updated, deleted, errors, duration: Date.now() - startTime };
      }
    }

    // Insert new items
    for (let i = 0; i < toAdd.length; i++) {
      const item = toAdd[i];
      const embedding = embeddings[i];

      try {
        await db.raw(
          `INSERT INTO vector_items (source_id, external_id, content, original_data, transformed_data, embedding)
           VALUES (?, ?, ?, ?, ?, ?::vector)`,
          [
            source.id,
            item.externalId,
            item.content,
            JSON.stringify(item.originalData),
            item.transformedData ? JSON.stringify(item.transformedData) : null,
            `[${embedding.join(",")}]`,
          ]
        );
        added++;
      } catch (error) {
        errors.push(`Error adding item ${item.externalId}: ${error}`);
      }
    }

    // Update changed items
    for (let i = 0; i < toUpdate.length; i++) {
      const { item, existingId } = toUpdate[i];
      const embedding = embeddings[toAdd.length + i];

      try {
        await db.raw(
          `UPDATE vector_items
           SET content = ?, original_data = ?, transformed_data = ?, embedding = ?::vector, updated_at = NOW()
           WHERE id = ?`,
          [
            item.content,
            JSON.stringify(item.originalData),
            item.transformedData ? JSON.stringify(item.transformedData) : null,
            `[${embedding.join(",")}]`,
            existingId,
          ]
        );
        updated++;
      } catch (error) {
        errors.push(`Error updating item ${item.externalId}: ${error}`);
      }
    }

    // Delete removed items
    if (toDelete.length > 0) {
      try {
        await db("vector_items").whereIn("id", toDelete).delete();
        deleted = toDelete.length;
      } catch (error) {
        errors.push(`Error deleting items: ${error}`);
      }
    }

    return {
      sourceId: source.id,
      added,
      updated,
      deleted,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    errors.push(`Sync error: ${error}`);
    return {
      sourceId: source.id,
      added,
      updated,
      deleted,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Fetch all items from a source, handling pagination if configured
 */
async function fetchAllItems(source: SourceRecord): Promise<FetchedItem[]> {
  const headers = typeof source.headers === "string" 
    ? JSON.parse(source.headers) 
    : source.headers;
  
  const queryParams = typeof source.query_params === "string"
    ? JSON.parse(source.query_params)
    : source.query_params;

  const body = typeof source.body === "string" 
    ? JSON.parse(source.body) 
    : source.body;

  const pagination = source.pagination
    ? typeof source.pagination === "string"
      ? JSON.parse(source.pagination)
      : source.pagination
    : null;

  const allItems: FetchedItem[] = [];
  let hasMore = true;
  let pageOrOffset = pagination?.type === "offset" ? 0 : 1;
  let cursor: string | null = null;

  while (hasMore) {
    // Build URL with pagination params
    const url = new URL(source.endpoint);
    
    // Add base query params
    for (const [key, value] of Object.entries(queryParams || {})) {
      url.searchParams.set(key, String(value));
    }

    // Deep clone body for this request (to add pagination params if needed)
    const requestBody = body ? JSON.parse(JSON.stringify(body)) : {};

    // Add pagination params (to query string or body)
    if (pagination) {
      const paginationLocation = pagination.location || "query";
      
      const addPaginationParam = (path: string, value: string | number) => {
        if (paginationLocation === "body") {
          // Support JSONPath-like syntax: $.filtro.pagina or just "pagina"
          setNestedValue(requestBody, path, value);
        } else {
          // For query params, use just the last part of the path as key
          const key = path.replace(/^\$\.?/, "").split(".").pop() || path;
          url.searchParams.set(key, String(value));
        }
      };

      if (pagination.type === "cursor" && cursor) {
        addPaginationParam(pagination.pageParam, cursor);
      } else if (pagination.type === "offset") {
        addPaginationParam(pagination.pageParam, pageOrOffset);
        addPaginationParam(pagination.limitParam, pagination.limit);
      } else if (pagination.type === "page") {
        addPaginationParam(pagination.pageParam, pageOrOffset);
        addPaginationParam(pagination.limitParam, pagination.limit);
      }
    }

    // Make the request
    const requestInit: RequestInit = {
      method: source.method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (source.method === "POST" && Object.keys(requestBody).length > 0) {
      requestInit.body = JSON.stringify(requestBody);
    }

    const response = await fetch(url.toString(), requestInit);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract items array
    const items = extractArray<Record<string, unknown>>(data, source.array_path);

    // Process each item
    for (const item of items) {
      const externalId = String(extractValue(item, source.id_path));
      const content = extractContent(item, source.content_path, source.content_template);
      
      if (!externalId || !content) {
        continue;
      }

      const transformedData = source.transform_script
        ? transformData(item, source.transform_script)
        : undefined;

      allItems.push({
        externalId,
        content,
        originalData: item,
        transformedData,
      });
    }

    // Check if there are more pages
    if (!pagination || items.length === 0) {
      hasMore = false;
    } else if (pagination.type === "cursor") {
      const nextCursor = extractValue<string>(data, pagination.cursorPath || "$.nextCursor");
      cursor = nextCursor ?? null;
      hasMore = !!cursor;
    } else {
      const limit = pagination.limit || 100;
      hasMore = items.length >= limit;
      
      if (pagination.type === "offset") {
        pageOrOffset += limit;
      } else {
        pageOrOffset++;
      }

      // Safety limit to prevent infinite loops
      if (allItems.length > 10000) {
        hasMore = false;
      }
    }
  }

  return allItems;
}

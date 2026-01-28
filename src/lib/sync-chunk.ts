import getDb from "@/lib/db";
import { extractArray, extractValue, extractContent } from "@/lib/jsonpath";
import { transformData } from "@/lib/transform";
import { generateEmbeddings } from "@/lib/embeddings";
import type { PaginationConfig } from "@/types";

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

export interface PageResult {
  items: FetchedItem[];
  hasMore: boolean;
  nextCursor: string | null;
  itemsAdded: number;
  itemsUpdated: number;
}

/**
 * Fetch and process a single page of data from a source
 * Also marks all processed items with the current sync session ID
 */
export async function syncSinglePage(
  source: SourceRecord,
  pageNumber: number,
  pageType: string,
  cursorValue: string | null,
  sessionId: string
): Promise<PageResult> {
  const db = getDb();
  
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

  // Build URL with pagination params
  const url = new URL(source.endpoint);
  
  // Add base query params
  for (const [key, value] of Object.entries(queryParams || {})) {
    url.searchParams.set(key, String(value));
  }

  // Deep clone body for this request
  const requestBody = body ? JSON.parse(JSON.stringify(body)) : {};

  // Add pagination params (to query string or body)
  if (pagination && pageType !== "initial") {
    const paginationLocation = pagination.location || "query";
    
    const addPaginationParam = (path: string, value: string | number) => {
      if (paginationLocation === "body") {
        setNestedValue(requestBody, path, value);
      } else {
        const key = path.replace(/^\$\.?/, "").split(".").pop() || path;
        url.searchParams.set(key, String(value));
      }
    };

    if (pageType === "cursor" && cursorValue) {
      addPaginationParam(pagination.pageParam, cursorValue);
    } else if (pageType === "offset") {
      addPaginationParam(pagination.pageParam, pageNumber);
      addPaginationParam(pagination.limitParam, pagination.limit);
    } else if (pageType === "page") {
      addPaginationParam(pagination.pageParam, pageNumber);
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
  const fetchedItems: FetchedItem[] = [];
  for (const item of items) {
    const externalId = String(extractValue(item, source.id_path));
    const content = extractContent(item, source.content_path, source.content_template);
    
    if (!externalId || !content) {
      continue;
    }

    const transformedData = source.transform_script
      ? transformData(item, source.transform_script)
      : undefined;

    fetchedItems.push({
      externalId,
      content,
      originalData: item,
      transformedData,
    });
  }

  // Compare with existing items and update database
  let itemsAdded = 0;
  let itemsUpdated = 0;

  if (fetchedItems.length > 0) {
    const externalIds = fetchedItems.map((item) => item.externalId);
    
    const existingItems = await db("vector_items")
      .where("source_id", source.id)
      .whereIn("external_id", externalIds)
      .select("id", "external_id", "content");

    const existingMap = new Map(
      existingItems.map((item: { external_id: string; id: string; content: string }) => [
        item.external_id,
        { id: item.id, content: item.content },
      ])
    );

    const toAdd: FetchedItem[] = [];
    const toUpdate: { item: FetchedItem; existingId: string }[] = [];
    const idsToMark: string[] = []; // Track all IDs seen in this page

    for (const item of fetchedItems) {
      const existing = existingMap.get(item.externalId);
      if (!existing) {
        toAdd.push(item);
      } else {
        idsToMark.push(existing.id); // Mark as seen
        if (existing.content !== item.content) {
          toUpdate.push({ item, existingId: existing.id });
        }
      }
    }

    // Generate embeddings for new and updated items
    const itemsNeedingEmbeddings = [...toAdd, ...toUpdate.map((u) => u.item)];
    let embeddings: number[][] = [];

    if (itemsNeedingEmbeddings.length > 0) {
      embeddings = await generateEmbeddings(
        itemsNeedingEmbeddings.map((item) => item.content)
      );
    }

    // Insert new items
    for (let i = 0; i < toAdd.length; i++) {
      const item = toAdd[i];
      const embedding = embeddings[i];

      const result = await db.raw(
        `INSERT INTO vector_items (source_id, external_id, content, original_data, transformed_data, embedding, last_seen_session_id)
         VALUES (?, ?, ?, ?, ?, ?::vector, ?)
         RETURNING id`,
        [
          source.id,
          item.externalId,
          item.content,
          JSON.stringify(item.originalData),
          item.transformedData ? JSON.stringify(item.transformedData) : null,
          `[${embedding.join(",")}]`,
          sessionId,
        ]
      );
      idsToMark.push(result.rows[0].id); // Mark newly added item
      itemsAdded++;
    }

    // Update changed items
    for (let i = 0; i < toUpdate.length; i++) {
      const { item, existingId } = toUpdate[i];
      const embedding = embeddings[toAdd.length + i];

      await db.raw(
        `UPDATE vector_items
         SET content = ?, original_data = ?, transformed_data = ?, embedding = ?::vector, last_seen_session_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          item.content,
          JSON.stringify(item.originalData),
          item.transformedData ? JSON.stringify(item.transformedData) : null,
          `[${embedding.join(",")}]`,
          sessionId,
          existingId,
        ]
      );
      itemsUpdated++;
    }

    // Mark items that exist but haven't changed (content is same)
    if (idsToMark.length > 0) {
      await db("vector_items")
        .whereIn("id", idsToMark)
        .update({ last_seen_session_id: sessionId });
    }
  }

  // Determine if there are more pages
  let hasMore = false;
  let nextCursor: string | null = null;

  if (pagination && items.length > 0) {
    if (pageType === "cursor") {
      nextCursor = extractValue<string>(data, pagination.cursorPath || "$.nextCursor") || null;
      hasMore = !!nextCursor;
    } else {
      const limit = pagination.limit || 100;
      hasMore = items.length >= limit;
    }
  }

  return {
    items: fetchedItems,
    hasMore,
    nextCursor,
    itemsAdded,
    itemsUpdated,
  };
}

import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { generateSlug, isValidSlug } from "@/lib/slug";
import { corsResponse, corsOptionsHandler } from "@/lib/cors";

// OPTIONS handler for preflight requests
export async function OPTIONS() {
  return corsOptionsHandler();
}

// GET /api/sources - List all sources
export async function GET() {
  try {
    const db = getDb();
    const sources = await db("data_sources")
      .select("*")
      .orderBy("created_at", "desc");

    // Transform snake_case to camelCase
    const formattedSources = sources.map(transformSource);

    return corsResponse({ sources: formattedSources });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return corsResponse(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

// POST /api/sources - Create new source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    // Generate or validate slug
    let slug = body.slug || generateSlug(body.name);
    
    // Validate slug format
    if (!isValidSlug(slug)) {
      return corsResponse(
        { error: "Invalid slug format. Use lowercase letters, numbers, and hyphens only." },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingSlug = await db("data_sources").where("slug", slug).first();
    if (existingSlug) {
      // Generate unique slug with numeric suffix
      let counter = 2;
      let uniqueSlug = `${slug}-${counter}`;
      while (await db("data_sources").where("slug", uniqueSlug).first()) {
        counter++;
        uniqueSlug = `${slug}-${counter}`;
      }
      slug = uniqueSlug;
    }

    const newSource = {
      id: uuidv4(),
      slug: slug,
      name: body.name,
      description: body.description || null,
      endpoint: body.endpoint,
      method: body.method || "GET",
      headers: JSON.stringify(body.headers || {}),
      body: JSON.stringify(body.body || {}),
      query_params: JSON.stringify(body.queryParams || {}),
      array_path: body.arrayPath,
      id_path: body.idPath,
      content_path: body.contentPath,
      content_template: body.contentTemplate || null,
      title_template: body.titleTemplate || null,
      display_template: body.displayTemplate || null,
      pagination: body.pagination ? JSON.stringify(body.pagination) : null,
      transform_script: body.transformScript || null,
      sync_interval: body.syncInterval || 60,
      is_active: body.isActive !== false,
    };

    await db("data_sources").insert(newSource);

    const created = await db("data_sources").where("id", newSource.id).first();

    return corsResponse(
      { source: transformSource(created), message: "Source created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating source:", error);
    return corsResponse(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}

// Helper to transform DB record to API format
function transformSource(source: Record<string, unknown>) {
  return {
    id: source.id,
    slug: source.slug,
    name: source.name,
    description: source.description,
    endpoint: source.endpoint,
    method: source.method,
    headers: typeof source.headers === "string" ? JSON.parse(source.headers) : source.headers,
    body: typeof source.body === "string" ? JSON.parse(source.body) : source.body,
    queryParams: typeof source.query_params === "string" ? JSON.parse(source.query_params) : source.query_params,
    arrayPath: source.array_path,
    idPath: source.id_path,
    contentPath: source.content_path,
    contentTemplate: source.content_template,
    titleTemplate: source.title_template,
    displayTemplate: source.display_template,
    pagination: source.pagination ? (typeof source.pagination === "string" ? JSON.parse(source.pagination) : source.pagination) : null,
    transformScript: source.transform_script,
    syncInterval: source.sync_interval,
    isActive: source.is_active,
    lastSync: source.last_sync,
    lastError: source.last_error,
    itemCount: source.item_count,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
  };
}

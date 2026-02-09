import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateSlug, isValidSlug } from "@/lib/slug";
import { corsResponse, corsOptionsHandler } from "@/lib/cors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// OPTIONS handler for preflight requests
export async function OPTIONS() {
  return corsOptionsHandler();
}

// GET /api/sources/[id]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();
    const source = await db("data_sources").where("id", id).first();

    if (!source) {
      return corsResponse({ error: "Source not found" }, { status: 404 });
    }

    return corsResponse({ source: transformSource(source) });
  } catch (error) {
    console.error("Error fetching source:", error);
    return corsResponse(
      { error: "Failed to fetch source" },
      { status: 500 }
    );
  }
}

// PUT /api/sources/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    // Handle slug update
    let slug = body.slug;
    if (slug) {
      // Validate slug format
      if (!isValidSlug(slug)) {
        return corsResponse(
          { error: "Invalid slug format. Use lowercase letters, numbers, and hyphens only." },
          { status: 400 }
        );
      }
      
      // Check if slug is taken by another source
      const existingSlug = await db("data_sources")
        .where("slug", slug)
        .whereNot("id", id)
        .first();
      
      if (existingSlug) {
        return corsResponse(
          { error: "Slug already in use by another source" },
          { status: 409 }
        );
      }
    } else if (body.name) {
      // Generate new slug from updated name
      slug = generateSlug(body.name);
      
      // Ensure uniqueness
      const existingSlug = await db("data_sources")
        .where("slug", slug)
        .whereNot("id", id)
        .first();
      
      if (existingSlug) {
        let counter = 2;
        let uniqueSlug = `${slug}-${counter}`;
        while (await db("data_sources").where("slug", uniqueSlug).whereNot("id", id).first()) {
          counter++;
          uniqueSlug = `${slug}-${counter}`;
        }
        slug = uniqueSlug;
      }
    }

    const updates: Record<string, unknown> = {
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
      updated_at: new Date(),
    };

    // Add slug to updates if it was changed
    if (slug) {
      updates.slug = slug;
    }

    await db("data_sources").where("id", id).update(updates);

    const updated = await db("data_sources").where("id", id).first();

    return corsResponse({
      source: transformSource(updated),
      message: "Source updated successfully",
    });
  } catch (error) {
    console.error("Error updating source:", error);
    return corsResponse(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

// DELETE /api/sources/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    await db("data_sources").where("id", id).delete();

    return corsResponse({ message: "Source deleted successfully" });
  } catch (error) {
    console.error("Error deleting source:", error);
    return corsResponse(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}

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

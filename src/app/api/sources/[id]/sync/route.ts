import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { syncDataSource } from "@/lib/sync";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/sources/[id]/sync - Trigger sync for a source
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    // Get the source
    const source = await db("data_sources").where("id", id).first();

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Run sync
    const result = await syncDataSource(source);

    // Log the sync
    await db("sync_logs").insert({
      source_id: id,
      added: result.added,
      updated: result.updated,
      deleted: result.deleted,
      errors: JSON.stringify(result.errors),
      duration: result.duration,
      status: result.errors.length > 0 ? "partial" : "success",
    });

    // Update source last sync
    await db("data_sources").where("id", id).update({
      last_sync: new Date(),
      last_error: result.errors.length > 0 ? result.errors.join("; ") : null,
      item_count: await db("vector_items").where("source_id", id).count("id as count").first().then(r => r?.count || 0),
    });

    return NextResponse.json({
      message: "Sync completed",
      result,
    });
  } catch (error) {
    console.error("Error syncing source:", error);
    
    // Log failed sync
    const { id } = await params;
    const db = getDb();
    await db("data_sources").where("id", id).update({
      last_error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to sync source" },
      { status: 500 }
    );
  }
}

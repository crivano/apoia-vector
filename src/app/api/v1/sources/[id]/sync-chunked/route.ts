import { NextRequest, NextResponse } from "next/server";
import { createSyncSession } from "@/lib/sync-queue";
import getDb from "@/lib/db";
import { corsResponse, corsOptionsHandler } from "@/lib/cors";
import { triggerSyncChunk, getSyncChunkUrl } from "@/lib/base-url";

// OPTIONS handler for preflight requests
export async function OPTIONS() {
  return corsOptionsHandler();
}

// Start chunked sync for a specific source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if source exists
    const source = await db("data_sources").where("id", id).first();

    if (!source) {
      return corsResponse(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Create new sync session
    const sessionId = await createSyncSession();

    // Add only this source to the queue
    await db("sync_queue").insert({
      source_id: id,
      sync_session_id: sessionId,
      page_number: source.pagination
        ? (typeof source.pagination === "string"
            ? JSON.parse(source.pagination)
            : source.pagination
          ).type === "offset"
          ? 0
          : 1
        : 1,
      page_type: source.pagination
        ? (typeof source.pagination === "string"
            ? JSON.parse(source.pagination)
            : source.pagination
          ).type || "initial"
        : "initial",
      cursor_value: null,
      status: "pending",
    });

    // Update session with total chunks
    await db("sync_sessions").where("id", sessionId).update({ total_chunks: 1 });

    console.log(`[sync-chunked] Starting sync for source: ${source.name} (${id})`);
    console.log(`[sync-chunked] Session ID: ${sessionId}`);

    // Trigger first chunk processing
    const authHeader = request.headers.get("authorization") || `Bearer ${process.env.CRON_SECRET || ""}`;
    const success = await triggerSyncChunk(authHeader);
    
    if (!success) {
      console.error(`[sync-chunked] Failed to trigger sync-chunk for session ${sessionId}`);
      return corsResponse({
        message: "Sync started but failed to trigger first chunk",
        sessionId,
        sourceName: source.name,
        chunkUrl: getSyncChunkUrl(),
        warning: "Check logs for details",
      }, { status: 207 }); // 207 Multi-Status
    }

    console.log(`[sync-chunked] Successfully triggered sync-chunk for session ${sessionId}`);

    return corsResponse({
      message: "Sync started",
      sessionId,
      sourceName: source.name,
      chunkUrl: getSyncChunkUrl(),
    });
  } catch (error) {
    console.error("Error starting source sync:", error);
    return corsResponse(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

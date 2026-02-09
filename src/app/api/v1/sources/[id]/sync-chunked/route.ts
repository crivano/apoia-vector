import { NextRequest, NextResponse } from "next/server";
import { createSyncSession } from "@/lib/sync-queue";
import getDb from "@/lib/db";
import { corsResponse, corsOptionsHandler } from "@/lib/cors";

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

    // Trigger first chunk processing
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const chunkUrl = `${baseUrl}/api/v1/cron/sync-chunk`;

    // Fire and forget - don't wait for response
    fetch(chunkUrl, {
      method: "GET",
      headers: {
        authorization: request.headers.get("authorization") || "",
      },
    }).catch((error) => {
      console.error("Error triggering first chunk:", error);
    });

    return corsResponse({
      message: "Sync started",
      sessionId,
      sourceName: source.name,
      chunkUrl,
    });
  } catch (error) {
    console.error("Error starting source sync:", error);
    return corsResponse(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import {
  getNextQueueItem,
  completeQueueItem,
  failQueueItem,
  enqueueNextPage,
  updateSessionStats,
  updateSessionFailure,
  checkSessionComplete,
  cleanupStaleItems,
} from "@/lib/sync-queue";
import { syncSinglePage } from "@/lib/sync-chunk";

// Process one chunk of the sync queue

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production") {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Get next pending queue item
    const queueItem = await getNextQueueItem();
    
    if (!queueItem) {
      return NextResponse.json({
        message: "No pending chunks to process",
        completed: true,
      });
    }

    const db = getDb();
    
    // Get source details
    const source = await db("data_sources")
      .where("id", queueItem.source_id)
      .first();
    
    if (!source) {
      await failQueueItem(queueItem.id, "Source not found");
      await updateSessionFailure(queueItem.sync_session_id);
      
      // Continue to next chunk
      return triggerNextChunk(request, authHeader);
    }

    try {
      // Process this page
      const result = await syncSinglePage(
        source,
        queueItem.page_number,
        queueItem.page_type,
        queueItem.cursor_value,
        queueItem.sync_session_id
      );

      // Mark this chunk as completed
      await completeQueueItem(queueItem.id, result.items.length);
      
      // Update session stats
      await updateSessionStats(
        queueItem.sync_session_id,
        result.itemsAdded,
        result.itemsUpdated,
        0 // deleted items handled separately
      );

      // If there are more pages, enqueue next page
      if (result.hasMore) {
        await enqueueNextPage(
          queueItem.source_id,
          queueItem.sync_session_id,
          queueItem.page_number,
          queueItem.page_type,
          result.nextCursor
        );
      }

      // Check if session is complete
      const isComplete = await checkSessionComplete(queueItem.sync_session_id);
      
      if (isComplete) {
        // Session complete - cleanup stale items and update source metadata
        const deletedCount = await cleanupStaleItems(queueItem.sync_session_id);
        
        // Update session with deleted count
        await db("sync_sessions")
          .where("id", queueItem.sync_session_id)
          .increment("total_items_deleted", deletedCount);
        
        // Update metadata for ALL sources in this session
        await updateAllSourcesMetadata(queueItem.sync_session_id);
        
        return NextResponse.json({
          message: "Chunk processed - session complete",
          sessionId: queueItem.sync_session_id,
          completed: true,
          itemsProcessed: result.items.length,
          itemsAdded: result.itemsAdded,
          itemsUpdated: result.itemsUpdated,
          itemsDeleted: deletedCount,
        });
      }

      // Trigger next chunk
      return triggerNextChunk(request, authHeader, {
        sessionId: queueItem.sync_session_id,
        itemsProcessed: result.items.length,
        itemsAdded: result.itemsAdded,
        itemsUpdated: result.itemsUpdated,
        hasMore: true,
      });

    } catch (error) {
      // Mark chunk as failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await failQueueItem(queueItem.id, errorMessage);
      await updateSessionFailure(queueItem.sync_session_id);

      // Continue to next chunk despite failure
      return triggerNextChunk(request, authHeader, {
        error: errorMessage,
        hasMore: true,
      });
    }

  } catch (error) {
    console.error("Error processing chunk:", error);
    return NextResponse.json(
      { error: "Failed to process chunk" },
      { status: 500 }
    );
  }
}

/**
 * Trigger the next chunk processing
 */
async function triggerNextChunk(
  request: NextRequest,
  authHeader: string | null,
  data?: Record<string, unknown>
): Promise<NextResponse> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  const chunkUrl = `${baseUrl}/api/cron/sync-chunk`;
  
  // Fire and forget - don't wait for response
  fetch(chunkUrl, {
    method: "GET",
    headers: {
      authorization: authHeader || "",
    },
  }).catch((error) => {
    console.error("Error triggering next chunk:", error);
  });
  
  return NextResponse.json({
    message: "Chunk processed",
    ...data,
    nextUrl: chunkUrl,
  });
}

/**
 * Update source metadata after sync completion
 */
async function updateSourceMetadata(sourceId: string): Promise<void> {
  const db = getDb();
  
  const itemCount = await db("vector_items")
    .where("source_id", sourceId)
    .count("id as count")
    .first()
    .then((r) => r?.count || 0);
  
  await db("data_sources")
    .where("id", sourceId)
    .update({
      last_sync: new Date(),
      last_error: null,
      item_count: itemCount,
    });
}

/**
 * Update metadata for all sources in a sync session
 */
async function updateAllSourcesMetadata(sessionId: string): Promise<void> {
  const db = getDb();
  
  // Get all unique sources from this session
  const sources = await db("sync_queue")
    .where("sync_session_id", sessionId)
    .distinct("source_id")
    .select("source_id");
  
  // Update each source
  for (const { source_id } of sources) {
    await updateSourceMetadata(source_id);
  }
}

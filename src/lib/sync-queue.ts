import getDb from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface SyncQueueItem {
  id: string;
  source_id: string;
  page_number: number;
  page_type: string;
  cursor_value: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  items_processed: number;
  sync_session_id: string;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

export interface SyncSession {
  id: string;
  status: "running" | "completed" | "failed" | "partial";
  total_chunks: number;
  completed_chunks: number;
  failed_chunks: number;
  total_items_added: number;
  total_items_updated: number;
  total_items_deleted: number;
  created_at: Date;
  completed_at: Date | null;
}

/**
 * Create a new sync session
 */
export async function createSyncSession(): Promise<string> {
  const db = getDb();
  const sessionId = uuidv4();
  
  await db("sync_sessions").insert({
    id: sessionId,
    status: "running",
    total_chunks: 0,
    completed_chunks: 0,
    failed_chunks: 0,
  });
  
  return sessionId;
}

/**
 * Initialize sync queue with first page of each active source
 */
export async function initializeSyncQueue(sessionId: string): Promise<number> {
  const db = getDb();
  
  // Get all active sources
  const sources = await db("data_sources")
    .where("is_active", true)
    .select("id", "pagination");
  
  const queueItems = sources.map((source) => {
    const pagination = source.pagination
      ? typeof source.pagination === "string"
        ? JSON.parse(source.pagination)
        : source.pagination
      : null;
    
    const pageType = pagination?.type || "initial";
    
    return {
      source_id: source.id,
      sync_session_id: sessionId,
      page_number: pageType === "offset" ? 0 : 1,
      page_type: pageType,
      cursor_value: null,
      status: "pending",
    };
  });
  
  if (queueItems.length > 0) {
    await db("sync_queue").insert(queueItems);
  }
  
  // Update session with total chunks
  await db("sync_sessions")
    .where("id", sessionId)
    .update({ total_chunks: queueItems.length });
  
  return queueItems.length;
}

/**
 * Get next pending queue item
 */
export async function getNextQueueItem(): Promise<SyncQueueItem | null> {
  const db = getDb();
  
  const item = await db("sync_queue")
    .where("status", "pending")
    .orderBy("created_at", "asc")
    .first();
  
  if (!item) {
    return null;
  }
  
  // Mark as processing
  await db("sync_queue")
    .where("id", item.id)
    .update({
      status: "processing",
      started_at: new Date(),
    });
  
  return item;
}

/**
 * Mark queue item as completed
 */
export async function completeQueueItem(
  itemId: string,
  itemsProcessed: number
): Promise<void> {
  const db = getDb();
  
  await db("sync_queue")
    .where("id", itemId)
    .update({
      status: "completed",
      items_processed: itemsProcessed,
      completed_at: new Date(),
    });
}

/**
 * Mark queue item as failed
 */
export async function failQueueItem(
  itemId: string,
  errorMessage: string
): Promise<void> {
  const db = getDb();
  
  await db("sync_queue")
    .where("id", itemId)
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date(),
    });
}

/**
 * Add next page to queue
 */
export async function enqueueNextPage(
  sourceId: string,
  sessionId: string,
  currentPageNumber: number,
  pageType: string,
  nextCursor: string | null
): Promise<void> {
  const db = getDb();
  
  let nextPageNumber = currentPageNumber;
  
  if (pageType === "offset") {
    const source = await db("data_sources").where("id", sourceId).first();
    const pagination = source.pagination
      ? typeof source.pagination === "string"
        ? JSON.parse(source.pagination)
        : source.pagination
      : null;
    const limit = pagination?.limit || 100;
    nextPageNumber = currentPageNumber + limit;
  } else if (pageType === "page") {
    nextPageNumber = currentPageNumber + 1;
  }
  
  await db("sync_queue").insert({
    source_id: sourceId,
    sync_session_id: sessionId,
    page_number: nextPageNumber,
    page_type: pageType,
    cursor_value: nextCursor,
    status: "pending",
  });
  
  // Increment total chunks in session
  await db("sync_sessions")
    .where("id", sessionId)
    .increment("total_chunks", 1);
}

/**
 * Update session statistics
 */
export async function updateSessionStats(
  sessionId: string,
  added: number,
  updated: number,
  deleted: number
): Promise<void> {
  const db = getDb();
  
  await db("sync_sessions")
    .where("id", sessionId)
    .increment({
      completed_chunks: 1,
      total_items_added: added,
      total_items_updated: updated,
      total_items_deleted: deleted,
    });
}

/**
 * Update session on failure
 */
export async function updateSessionFailure(sessionId: string): Promise<void> {
  const db = getDb();
  
  await db("sync_sessions")
    .where("id", sessionId)
    .increment("failed_chunks", 1);
}

/**
 * Check if session is complete and update status
 */
export async function checkSessionComplete(sessionId: string): Promise<boolean> {
  const db = getDb();
  
  const session = await db("sync_sessions")
    .where("id", sessionId)
    .first();
  
  if (!session) {
    return false;
  }
  
  const pendingCount = await db("sync_queue")
    .where("sync_session_id", sessionId)
    .where("status", "pending")
    .count("id as count")
    .first();
  
  const hasPending = pendingCount && Number(pendingCount.count) > 0;
  
  if (!hasPending) {
    // All chunks processed
    const processingCount = await db("sync_queue")
      .where("sync_session_id", sessionId)
      .where("status", "processing")
      .count("id as count")
      .first();
    
    const hasProcessing = processingCount && Number(processingCount.count) > 0;
    
    if (!hasProcessing) {
      // Determine final status
      const failedCount = session.failed_chunks;
      const completedCount = session.completed_chunks;
      
      let finalStatus: "completed" | "failed" | "partial" = "completed";
      if (failedCount > 0 && completedCount === 0) {
        finalStatus = "failed";
      } else if (failedCount > 0) {
        finalStatus = "partial";
      }
      
      await db("sync_sessions")
        .where("id", sessionId)
        .update({
          status: finalStatus,
          completed_at: new Date(),
        });
      
      return true;
    }
  }
  
  return false;
}

/**
 * Get session progress
 */
export async function getSessionProgress(sessionId: string): Promise<SyncSession | null> {
  const db = getDb();
  
  const session = await db("sync_sessions")
    .where("id", sessionId)
    .first();
  
  return session || null;
}

/**
 * Get latest sync session
 */
export async function getLatestSyncSession(): Promise<SyncSession | null> {
  const db = getDb();
  
  const session = await db("sync_sessions")
    .orderBy("created_at", "desc")
    .first();
  
  return session || null;
}

/**
 * Clean up old completed sessions (keep last 30 days)
 */
export async function cleanupOldSessions(): Promise<void> {
  const db = getDb();
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get old session IDs
  const oldSessions = await db("sync_sessions")
    .where("status", "completed")
    .where("created_at", "<", thirtyDaysAgo)
    .select("id");
  
  const sessionIds = oldSessions.map((s) => s.id);
  
  if (sessionIds.length > 0) {
    // Delete queue items first (FK constraint)
    await db("sync_queue").whereIn("sync_session_id", sessionIds).delete();
    
    // Delete sessions
    await db("sync_sessions").whereIn("id", sessionIds).delete();
  }
}

/**
 * Delete items that were not seen during this sync session for each source
 * This is called after all chunks for a session are complete
 */
export async function cleanupStaleItems(sessionId: string): Promise<number> {
  const db = getDb();
  
  // Get all sources that were synced in this session
  const sources = await db("sync_queue")
    .where("sync_session_id", sessionId)
    .distinct("source_id")
    .select("source_id");
  
  let totalDeleted = 0;
  
  for (const { source_id } of sources) {
    // Delete items from this source that were NOT marked with this session
    const deleted = await db("vector_items")
      .where("source_id", source_id)
      .where(function() {
        this.whereNull("last_seen_session_id")
          .orWhere("last_seen_session_id", "!=", sessionId);
      })
      .delete();
    
    totalDeleted += deleted;
  }
  
  return totalDeleted;
}

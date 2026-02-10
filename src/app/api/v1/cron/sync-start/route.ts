import { NextRequest, NextResponse } from "next/server";
import { createSyncSession, initializeSyncQueue } from "@/lib/sync-queue";
import { triggerSyncChunk, getSyncChunkUrl } from "@/lib/base-url";

// Cron Job endpoint - Start chunked sync
// Designed for OpenShift/Kubernetes CronJobs
// See openshift-cronjob.yaml for deployment configuration

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production") {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Create new sync session
    const sessionId = await createSyncSession();
    
    // Initialize queue with first page of each source
    const totalChunks = await initializeSyncQueue(sessionId);
    
    if (totalChunks === 0) {
      return NextResponse.json({
        message: "No active sources to sync",
        sessionId,
        totalChunks: 0,
      });
    }
    
    console.log("[sync-start] Session created:", sessionId, "with", totalChunks, "chunks");
    console.log("[sync-start] Triggering first chunk:", getSyncChunkUrl());
    
    // Trigger first chunk processing
    const success = await triggerSyncChunk(authHeader);
    
    if (!success) {
      console.error(`[sync-start] Failed to trigger sync-chunk for session ${sessionId}`);
      return NextResponse.json({
        message: "Sync started but failed to trigger first chunk",
        sessionId,
        totalChunks,
        nextUrl: getSyncChunkUrl(),
        warning: "Check logs and verify APP_URL is set correctly",
      }, { status: 207 }); // 207 Multi-Status
    }
    
    console.log(`[sync-start] Successfully triggered sync-chunk for session ${sessionId}`);
    
    return NextResponse.json({
      message: "Sync started successfully",
      sessionId,
      totalChunks,
      nextUrl: getSyncChunkUrl(),
    });
  } catch (error) {
    console.error("Error starting sync:", error);
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

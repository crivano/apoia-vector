import { NextRequest, NextResponse } from "next/server";
import { createSyncSession, initializeSyncQueue } from "@/lib/sync-queue";

// Vercel Cron Job endpoint - Start chunked sync
// Configure in vercel.json:
// { "crons": [{ "path": "/api/v1/cron/sync-start", "schedule": "0 6 * * *" }] }

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
    
    // Trigger first chunk processing
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    const chunkUrl = `${baseUrl}/api/v1/cron/sync-chunk`;
    
    // Fire and forget - don't wait for response
    fetch(chunkUrl, {
      method: "GET",
      headers: {
        authorization: authHeader || "",
      },
    }).catch((error) => {
      console.error("Error triggering first chunk:", error);
    });
    
    return NextResponse.json({
      message: "Sync started",
      sessionId,
      totalChunks,
      nextUrl: chunkUrl,
    });
  } catch (error) {
    console.error("Error starting sync:", error);
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

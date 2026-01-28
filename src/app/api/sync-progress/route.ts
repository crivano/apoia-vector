import { NextResponse } from "next/server";
import { getLatestSyncSession } from "@/lib/sync-queue";

export async function GET() {
  try {
    const session = await getLatestSyncSession();
    
    if (!session) {
      return NextResponse.json({ session: null });
    }
    
    const progress = session.total_chunks > 0
      ? Math.round((session.completed_chunks / session.total_chunks) * 100)
      : 0;
    
    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        progress,
        totalChunks: session.total_chunks,
        completedChunks: session.completed_chunks,
        failedChunks: session.failed_chunks,
        totalItemsAdded: session.total_items_added,
        totalItemsUpdated: session.total_items_updated,
        totalItemsDeleted: session.total_items_deleted,
        createdAt: session.created_at,
        completedAt: session.completed_at,
      },
    });
  } catch (error) {
    console.error("Error fetching sync progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync progress" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { syncDataSource } from "@/lib/sync";

// Cron Job endpoint - Simple sync (legacy)
// For OpenShift/Kubernetes CronJobs
// Note: Consider using sync-start + sync-chunk for better performance with large datasets

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production") {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = getDb();

    // Get all active sources that need syncing
    const sources = await db("data_sources")
      .where("is_active", true)
      .whereRaw(`
        last_sync IS NULL 
        OR last_sync < NOW() - (sync_interval || ' minutes')::interval
      `);

    const results = [];

    for (const source of sources) {
      try {
        const result = await syncDataSource(source);

        // Log the sync
        await db("sync_logs").insert({
          source_id: source.id,
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          errors: JSON.stringify(result.errors),
          duration: result.duration,
          status: result.errors.length > 0 ? "partial" : "success",
        });

        // Update source
        await db("data_sources").where("id", source.id).update({
          last_sync: new Date(),
          last_error: result.errors.length > 0 ? result.errors.join("; ") : null,
          item_count: await db("vector_items")
            .where("source_id", source.id)
            .count("id as count")
            .first()
            .then((r) => r?.count || 0),
        });

        results.push({
          ...result,
          name: source.name,
        });
      } catch (error) {
        await db("data_sources").where("id", source.id).update({
          last_error: error instanceof Error ? error.message : "Unknown error",
        });

        results.push({
          sourceId: source.id,
          name: source.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "Sync completed",
      sourcesProcessed: sources.length,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Failed to run sync" },
      { status: 500 }
    );
  }
}

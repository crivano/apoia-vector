import { NextResponse } from "next/server";
import getDb from "@/lib/db";

// GET /api/stats - Get system statistics
export async function GET() {
  try {
    const db = getDb();

    const [sourcesCount, itemsCount] = await Promise.all([
      db("data_sources").count("id as count").first(),
      db("vector_items").count("id as count").first(),
    ]);

    return NextResponse.json({
      totalSources: Number(sourcesCount?.count) || 0,
      totalItems: Number(itemsCount?.count) || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({
      totalSources: 0,
      totalItems: 0,
    });
  }
}

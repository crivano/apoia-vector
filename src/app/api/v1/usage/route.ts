import { NextResponse } from "next/server";
import { getDailyUsage } from "@/lib/embeddings";

// GET /api/usage - Get current daily embedding usage
export async function GET() {
  try {
    const usage = await getDailyUsage();
    
    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}

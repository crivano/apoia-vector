import { NextResponse } from "next/server";

// CORS headers configuration
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Creates a JSON response with CORS headers
 */
export function corsResponse(
  data: unknown,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

/**
 * Standard OPTIONS handler for CORS preflight requests
 */
export function corsOptionsHandler(): NextResponse {
  return NextResponse.json({}, { headers: corsHeaders });
}

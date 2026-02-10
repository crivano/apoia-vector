/**
 * Utility to get the application's base URL
 * Works in different environments: OpenShift, local dev, etc.
 */

/**
 * Get the base URL of the application
 * Priority order:
 * 1. APP_URL (for OpenShift/K8s deployments)
 * 2. NEXT_PUBLIC_BASE_URL (for custom deployments)
 * 3. Localhost fallback (for development)
 * 
 * Note: VERCEL_URL support was removed as this app is deployed on OpenShift
 */
export function getBaseUrl(): string {
  const baseUrl = 
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  
  return baseUrl;
}

/**
 * Get the full URL for the sync-chunk endpoint
 */
export function getSyncChunkUrl(): string {
  return `${getBaseUrl()}/api/v1/cron/sync-chunk`;
}

/**
 * Trigger the sync-chunk endpoint
 * Returns true if successful, false if failed
 */
export async function triggerSyncChunk(authHeader: string | null): Promise<boolean> {
  const chunkUrl = getSyncChunkUrl();
  
  console.log(`[sync-trigger] Calling sync-chunk: ${chunkUrl}`);
  
  try {
    const response = await fetch(chunkUrl, {
      method: "GET",
      headers: {
        authorization: authHeader || "",
      },
      // Add timeout to avoid hanging
      signal: AbortSignal.timeout(30000), // 30 seconds
    });

    if (!response.ok) {
      console.error(`[sync-trigger] Failed: HTTP ${response.status} - ${response.statusText}`);
      const text = await response.text().catch(() => "Unable to read response");
      console.error(`[sync-trigger] Response body: ${text}`);
      return false;
    }

    const result = await response.json().catch(() => null);
    console.log(`[sync-trigger] Success:`, result);
    return true;
  } catch (error) {
    console.error(`[sync-trigger] Error calling sync-chunk:`, error);
    
    if (error instanceof Error) {
      console.error(`[sync-trigger] Error details: ${error.message}`);
      console.error(`[sync-trigger] Error stack:`, error.stack);
    }
    
    return false;
  }
}

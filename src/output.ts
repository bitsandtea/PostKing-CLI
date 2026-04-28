/**
 * Shared output helpers for command success printing.
 */

/**
 * Print a "View in browser" line if the response includes a webUrl. The
 * agent API returns this field on key endpoints (post create/approve/post-now,
 * blog create, landing-page edit, visuals pick) so users can click through
 * to the dashboard. Silent when no webUrl is present.
 */
export function printWebUrl(data: unknown): void {
  if (!data || typeof data !== "object") return;
  const url = (data as { webUrl?: unknown }).webUrl;
  if (typeof url === "string" && url.length > 0) {
    console.log(`\nView in browser: ${url}`);
  }
}

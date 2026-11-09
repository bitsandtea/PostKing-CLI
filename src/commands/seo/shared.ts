import { createClient } from "../../client";
import { getBrandId } from "../../config";

export function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

export function printError(err: unknown): void {
  const e = err as {
    response?: { data?: { error?: { message?: string; checkoutUrl?: string } } };
    message: string;
  };
  const env = e.response?.data?.error;
  console.error(`ERROR: ${env?.message ?? e.message}`);
  if (env?.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
}

// ─── Operation polling (re-exported from shared lib) ─────────────────────────
export { pollOperation } from "../../lib/operations";
export type { Operation, OperationProgress, OperationError } from "../../lib/operations";

export const VALID_INTENTS = ["informational", "commercial", "navigational", "transactional"];
export const VALID_ROADMAP_ACTIONS = ["ignore", "restore", "start", "complete", "pin", "unpin", "remove"];
export const VALID_ROADMAP_STATUSES = ["suggested", "ignored", "in_progress", "completed"];

// Re-export createClient and getBrandId for use in command modules
export { createClient, getBrandId };

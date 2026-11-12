import { createClient } from "../client";
import { extractApiError } from "../api-error";

interface PendingAction {
  id: string;
  status: string;
  summary: string;
  apiKeyName: string;
  expiresAt: string;
  executedAt: string | null;
  failureMessage: string | null;
}

/** Status of an email-confirmed delete (pending | executed | failed | expired | cancelled). */
export async function pendingStatusCommand(id: string, options: { json?: boolean }): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/pending-actions/${encodeURIComponent(id)}`);
    const a = res.data as PendingAction;
    if (options.json) { console.log(JSON.stringify(a, null, 2)); return; }
    console.log(`${a.summary}`);
    console.log(`  status:  ${a.status}`);
    if (a.status === "pending") console.log(`  waiting for the email link; expires ${a.expiresAt}`);
    if (a.executedAt) console.log(`  done at: ${a.executedAt}`);
    if (a.failureMessage) console.log(`  failed:  ${a.failureMessage}`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError } from "../api-error";

interface UnifiedJob {
  id: string;
  title: string;
  status: string;
  pollUrl: string;
  successRedirectUrl?: string | null;
  createdAt: string;
  source: "job" | "operation";
  webUrl?: string;
}

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first.");
    process.exit(1);
  }
  return brandId;
}

export async function jobsListCommand(options: { status?: string; limit?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.limit) params.set("limit", options.limit);
    const qs = params.toString();
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/jobs${qs ? `?${qs}` : ""}`
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const jobs = (res.data?.jobs ?? []) as UnifiedJob[];
    if (jobs.length === 0) {
      console.log("No jobs found.");
      printWebUrl(res.data);
      return;
    }
    console.log(`Jobs (${jobs.length}):`);
    for (const j of jobs) {
      const created = j.createdAt ? new Date(j.createdAt).toLocaleString() : "";
      const src = (j.source === "operation" ? "op " : "job").padEnd(3);
      console.log(`  [${src}] [${j.status.padEnd(9)}] ${j.id}  ${j.title}  (${created})`);
      if (j.successRedirectUrl) console.log(`    -> ${j.successRedirectUrl}`);
    }
    printWebUrl(res.data);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

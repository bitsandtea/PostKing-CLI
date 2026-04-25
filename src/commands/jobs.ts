import { createClient } from "../client";
import { getBrandId } from "../config";

interface BrandJob {
  id: string;
  title: string;
  status: string;
  pollUrl: string;
  successRedirectUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
}

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first.");
    process.exit(1);
  }
  return brandId;
}

export async function jobsListCommand(options: { status?: string; limit?: string }): Promise<void> {
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
    const jobs = (res.data?.jobs ?? []) as BrandJob[];
    if (jobs.length === 0) {
      console.log("No jobs found.");
      return;
    }
    console.log(`Jobs (${jobs.length}):`);
    for (const j of jobs) {
      const created = j.createdAt ? new Date(j.createdAt).toLocaleString() : "";
      console.log(`  [${j.status.padEnd(9)}] ${j.id}  ${j.title}  (${created})`);
      if (j.successRedirectUrl) console.log(`    -> ${j.successRedirectUrl}`);
    }
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

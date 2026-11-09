import { printWebUrl } from "../../output";
import { createClient, requireBrand, printError } from "./shared";

// ─── seo search-data ─────────────────────────────────────────────────────────

interface ReconcileSummaryView {
  movedUp?: number;
  nowCovered?: number;
  newKeywords?: number;
  newTopics?: number;
  refreshItems?: number;
}

/** "5 moved up, 2 now covered, ..." - the reconcile's one-line summary. */
export function formatReconcileSummary(s: ReconcileSummaryView): string {
  return [
    `${s.movedUp ?? 0} moved up`,
    `${s.nowCovered ?? 0} now covered`,
    `${s.newKeywords ?? 0} new keywords`,
    `${s.newTopics ?? 0} new topics`,
    `${s.refreshItems ?? 0} refresh items`,
  ].join(", ");
}

export async function seoSearchDataCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/search-data`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const d = res.data;
    console.log(`\nSearch data: ${d.connected ? "connected" : "not connected"}${d.hasData ? "" : " (no data synced yet)"}`);
    for (const c of d.connections ?? []) {
      console.log(`  ${c.provider}  ${c.siteUrl}  [${c.status}]  last sync: ${c.lastSyncedAt ?? "never"}`);
    }
    const r = d.reconcile;
    if (!r) {
      console.log("Reconcile: never ran");
    } else {
      console.log(`Reconcile: ${r.status} (${r.trigger})  ${r.finishedAt ?? r.claimedAt}`);
      if (r.summary) console.log(`  ${formatReconcileSummary(r.summary)}`);
      if (r.error) console.log(`  error: ${r.error}`);
    }
    const rm = d.roadmap ?? {};
    console.log(`Roadmap: ${rm.refreshOpen ?? 0} open refresh (${rm.refreshTotal ?? 0} total), ${rm.hidden ?? 0} hidden, ${rm.withSearchData ?? 0} with search data`);
    printWebUrl(d);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoSearchDataReconcileCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/search-data/reconcile`, {});
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log("SUCCESS: Reconcile started. Check progress with: pking seo search-data");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

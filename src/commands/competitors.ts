import { createClient } from "../client";
import { getBrandId } from "../config";
import { pollOperation } from "../lib/operations";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

type ErrorEnvelope = {
  code?: string;
  message?: string;
  details?: { target?: number; balance?: number };
  checkoutUrl?: string;
};

function printError(err: unknown): void {
  const e = err as {
    response?: { data?: { error?: ErrorEnvelope } };
    message: string;
  };
  const env = e.response?.data?.error;
  if (env) {
    console.error(`ERROR: ${env.message ?? "(no message)"}`);
    if (env.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
  } else {
    console.error(`ERROR: ${e.message}`);
  }
}

function handleBillingError(err: unknown): void {
  const e = err as {
    response?: { data?: { error?: ErrorEnvelope } };
    message: string;
  };
  const env = e.response?.data?.error;
  if (env) {
    if (env.code === "INSUFFICIENT_CREDITS") {
      const balancePart = env.details?.balance !== undefined ? ` (balance: ${env.details.balance})` : "";
      console.error(`ERROR: Out of credits${balancePart}.`);
      if (env.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
      process.exit(1);
    }
    if (env.message === "REQUIRES_DELETE_DOWN" || env.details?.target !== undefined) {
      const limit = env.details?.target ?? 1;
      console.error(`ERROR: Your plan allows ${limit} competitor(s). Delete one first: pking competitors delete <id>`);
      process.exit(1);
    }
  }
  printError(err);
  process.exit(1);
}

// ─── competitors list ─────────────────────────────────────────────────────────

interface CompetitorItem {
  id: string;
  domain: string;
  source: string;
  creditsCharged: number;
  analysisState: string;
  lastError?: string;
  addedAt?: string;
  lastCrawledAt?: string;
  cacheSource?: string;
  artifacts?: unknown;
}

export async function competitorsListCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/competitors`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const items: CompetitorItem[] = res.data.items ?? [];
    if (items.length === 0) {
      console.log("No competitors added yet. Use 'pking competitors sample' to see an example.");
    } else {
      console.log(`\nCompetitors (${items.length}):`);
      items.forEach((c) =>
        console.log(`  ${c.domain}  [${c.analysisState}]  ${c.source}  ${c.creditsCharged} credits`)
      );
    }
    console.log(`\ncreditBalance: ${res.data.creditBalance ?? "—"}  requiresDeleteDown: ${res.data.requiresDeleteDown ?? false}  freeCompetitorConsumed: ${res.data.freeCompetitorConsumed ?? false}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── competitors add ──────────────────────────────────────────────────────────

export async function competitorsAddCommand(
  domains: string[],
  options: { brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  domains = [...new Set(domains)];
  if (domains.length > 20) {
    console.error("ERROR: max 20 domains per batch; split into multiple adds.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/competitors`, { domains });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const operationId: string = res.data.operationId;
    const items: CompetitorItem[] = res.data.items ?? [];
    console.log(`OperationId: ${operationId}`);
    console.log(`Added ${items.length} competitor(s):`);
    items.forEach((c) => console.log(`  ${c.domain}  [${c.analysisState}]`));
    if (options.wait !== false) {
      await pollOperation(client, brandId, operationId, { label: "competitor analysis" });
    }
  } catch (err) {
    handleBillingError(err);
  }
}

// ─── competitors import ───────────────────────────────────────────────────────

export async function competitorsImportCommand(
  options: { file: string; brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const fs = await import("fs");
  let raw: string;
  try {
    raw = fs.readFileSync(options.file, "utf8");
  } catch (e) {
    console.error(`ERROR: Could not read file: ${(e as Error).message}`);
    process.exit(1);
  }
  const domains = [...new Set(
    raw
      .split(/[\n,]/)
      .map((d) => d.split("#")[0].trim())
      .filter((d) => d.length > 0)
  )];
  if (domains.length === 0) {
    console.error("ERROR: No domains found in file.");
    process.exit(1);
  }
  if (domains.length > 20) {
    console.error("ERROR: max 20 domains per batch; split into multiple imports");
    process.exit(1);
  }
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/competitors`, { domains });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const operationId: string = res.data.operationId;
    const items: CompetitorItem[] = res.data.items ?? [];
    console.log(`OperationId: ${operationId}`);
    console.log(`Added ${items.length} competitor(s):`);
    items.forEach((c) => console.log(`  ${c.domain}  [${c.analysisState}]`));
    if (options.wait !== false) {
      await pollOperation(client, brandId, operationId, { label: "competitor analysis" });
    }
  } catch (err) {
    handleBillingError(err);
  }
}

// ─── competitors delete ───────────────────────────────────────────────────────

export async function competitorsDeleteCommand(
  id: string,
  options: { brand?: string; destructive?: boolean; json?: boolean }
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    await client.delete(`/api/agent/v1/brands/${brandId}/competitors/${id}`);
    if (options.json) { console.log(JSON.stringify({ ok: true, id }, null, 2)); return; }
    console.log(`SUCCESS: Competitor ${id} removed.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── competitors refresh ──────────────────────────────────────────────────────

export async function competitorsRefreshCommand(options: { brand?: string; wait?: boolean; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/competitors/refresh-all`, {});
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const operationId: string = res.data.operationId;
    console.log(`OperationId: ${operationId}`);
    if (options.wait !== false) {
      await pollOperation(client, brandId, operationId, { label: "competitor refresh" });
    }
  } catch (err) {
    handleBillingError(err);
  }
}

// ─── competitors comparison ───────────────────────────────────────────────────

interface BrandComparison {
  overviewSummary?: { summary?: string };
  topActions?: unknown[];
  generatedAt?: string;
}

export async function competitorsComparisonCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/competitors/comparison`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const comparison: BrandComparison | null = res.data.comparison ?? null;
    if (!comparison) {
      console.log("No comparison yet — add >=2 competitors and let analysis finish.");
      return;
    }
    if (comparison.overviewSummary?.summary) {
      console.log(`\nSummary:\n${comparison.overviewSummary.summary}`);
    }
    if (comparison.topActions && Array.isArray(comparison.topActions) && comparison.topActions.length > 0) {
      console.log(`\nTop Actions:`);
      comparison.topActions.forEach((a, i) => console.log(`  ${i + 1}. ${JSON.stringify(a)}`));
    }
    if (comparison.generatedAt) {
      console.log(`\nGenerated at: ${comparison.generatedAt}`);
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function competitorsComparisonRecomputeCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/competitors/comparison/recompute`, {});
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const comparison: BrandComparison | null = res.data.comparison ?? null;
    if (!comparison) {
      console.log("Recompute complete but no comparison returned yet.");
      return;
    }
    if (comparison.overviewSummary?.summary) {
      console.log(`\nRefreshed Summary:\n${comparison.overviewSummary.summary}`);
    }
    if (comparison.topActions && Array.isArray(comparison.topActions) && comparison.topActions.length > 0) {
      console.log(`\nTop Actions:`);
      comparison.topActions.forEach((a, i) => console.log(`  ${i + 1}. ${JSON.stringify(a)}`));
    }
    if (comparison.generatedAt) {
      console.log(`\nGenerated at: ${comparison.generatedAt}`);
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── competitors sample ───────────────────────────────────────────────────────

export async function competitorsSampleCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/competitors/sample`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const sample = res.data.sample ?? res.data;
    if (!sample) {
      console.log("No sample available.");
      return;
    }
    console.log(`\nSample Competitor:`);
    if (sample.domain) console.log(`  domain:         ${sample.domain}`);
    if (sample.source) console.log(`  source:         ${sample.source}`);
    if (sample.analysisState) console.log(`  analysisState:  ${sample.analysisState}`);
    if (sample.creditsCharged !== undefined) console.log(`  creditsCharged: ${sample.creditsCharged}`);
    if (sample.addedAt) console.log(`  addedAt:        ${sample.addedAt}`);
    if (sample.lastCrawledAt) console.log(`  lastCrawledAt:  ${sample.lastCrawledAt}`);
    if (sample.cacheSource) console.log(`  cacheSource:    ${sample.cacheSource}`);
    if (sample.artifacts) console.log(`  artifacts:      ${JSON.stringify(sample.artifacts).slice(0, 400)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

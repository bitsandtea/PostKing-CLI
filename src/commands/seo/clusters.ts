import { createClient } from "../../client";
import { requireBrand, printError, pollOperation } from "./shared";
import { readFileSync } from "fs";

// ─── Simple CSV parser (no external deps) ────────────────────────────────────
// Handles quoted fields and trims values. Returns array of row objects.
function parseCsv(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  function splitCsvRow(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

// ─── seo clusters generate (with CSV import + cluster options) ───────────────

export async function seoClustersGenerateCommand(options: {
  brand?: string;
  csv?: string;
  targetSize?: string;
  minPerCluster?: string;
  maxPerCluster?: string;
  cannibalCheck?: boolean;
  wait?: boolean;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();

  type KeywordInput = { keyword: string; volume?: number; kd?: number; intent?: string };
  let keywords: KeywordInput[] | undefined;

  if (options.csv) {
    let raw: string;
    try {
      raw = readFileSync(options.csv, "utf-8");
    } catch (err) {
      console.error(`ERROR: Cannot read CSV file: ${(err as Error).message}`);
      process.exit(1);
    }
    const rows = parseCsv(raw);
    if (rows.length === 0 || !Object.prototype.hasOwnProperty.call(rows[0], "keyword")) {
      console.error("ERROR: CSV must have a header row containing a 'keyword' column.");
      process.exit(1);
    }
    keywords = rows
      .filter((r) => r["keyword"] && r["keyword"].trim() !== "")
      .map((r) => {
        const kw: KeywordInput = { keyword: r["keyword"].trim() };
        if (r["volume"] && r["volume"] !== "") { const v = Number(r["volume"]); if (!isNaN(v)) kw.volume = v; }
        if (r["kd"] && r["kd"] !== "") { const v = Number(r["kd"]); if (!isNaN(v)) kw.kd = v; }
        if (r["intent"] && r["intent"] !== "") kw.intent = r["intent"].trim();
        return kw;
      });
    if (keywords.length === 0) {
      console.error("ERROR: CSV parsed zero valid keyword rows.");
      process.exit(1);
    }
  }

  type ClusterOptions = { targetClusterSize?: number; minPerCluster?: number; maxPerCluster?: number; skipCannibalCheck?: boolean };
  const clusterOptions: ClusterOptions = {};
  if (options.targetSize !== undefined) { const v = Number(options.targetSize); if (!isNaN(v)) clusterOptions.targetClusterSize = v; }
  if (options.minPerCluster !== undefined) { const v = Number(options.minPerCluster); if (!isNaN(v)) clusterOptions.minPerCluster = v; }
  if (options.maxPerCluster !== undefined) { const v = Number(options.maxPerCluster); if (!isNaN(v)) clusterOptions.maxPerCluster = v; }
  if (options.cannibalCheck === false) clusterOptions.skipCannibalCheck = true;

  const body: Record<string, unknown> = {};
  if (keywords) body.keywords = keywords;
  if (Object.keys(clusterOptions).length > 0) body.clusterOptions = clusterOptions;

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/generate`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster generation started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        const op = await pollOperation(client, brandId, res.data.operationId, { label: "Generate clusters" });
        if (op.result) {
          const r = op.result as { clustersCreated?: number; clustersMerged?: number; keywordsAssigned?: number };
          if (r.clustersCreated !== undefined || r.clustersMerged !== undefined || r.keywordsAssigned !== undefined) {
            console.log(`Created ${r.clustersCreated ?? 0} clusters, merged ${r.clustersMerged ?? 0}, assigned ${r.keywordsAssigned ?? 0} keywords.`);
          }
        }
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo cluster (generate) ──────────────────────────────────────────────────

export async function seoClusterCommand(options: {
  brand?: string;
  wait?: boolean;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/generate`, {});
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster generation started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        await pollOperation(client, brandId, res.data.operationId, { label: "Generate clusters" });
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters list ───────────────────────────────────────────────────────

export async function seoClustersListCommand(options: {
  brand?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/clusters`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const clusters = res.data.clusters ?? [];
    console.log(`\nClusters (${clusters.length}):`);
    clusters.forEach((c: { id: string; name: string; status?: string; briefCount?: number; briefGenerationStatus?: string }) =>
      console.log(`  ${c.id}  ${c.name}  [${c.status ?? "—"}]  briefs=${c.briefCount ?? 0}  briefStatus=${c.briefGenerationStatus ?? "—"}`)
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters approve ────────────────────────────────────────────────────

export async function seoClustersApproveCommand(
  id: string,
  options: { brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/${id}/approve`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster ${id} approved. Brief generation started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        await pollOperation(client, brandId, res.data.operationId, { label: "Generate briefs" });
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters unapprove ──────────────────────────────────────────────────

export async function seoClustersUnapproveCommand(
  id: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/${id}/unapprove`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster ${id} reverted to pending_review.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters reject ─────────────────────────────────────────────────────

export async function seoClustersRejectCommand(
  id: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/${id}/reject`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster ${id} rejected.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters restore ────────────────────────────────────────────────────

export async function seoClustersRestoreCommand(
  id: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/${id}/restore`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Cluster ${id} restored to pending_review.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters bulk-approve ───────────────────────────────────────────────

export async function seoClustersBulkApproveCommand(
  ids: string[],
  options: { brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/bulk-approve`, {
      clusterIds: ids,
    });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const operationIds: string[] = res.data.operationIds ?? [];
    console.log(`SUCCESS: Bulk-approved ${ids.length} cluster(s). ${operationIds.length} operation(s) started.`);
    operationIds.forEach((opId) => console.log(`  Operation: ${opId}`));
    if (options.wait) {
      for (const opId of operationIds) {
        await pollOperation(client, brandId, opId, { label: `Generate briefs (${opId})` });
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo clusters bulk-reject ────────────────────────────────────────────────

export async function seoClustersBulkRejectCommand(
  ids: string[],
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/clusters/bulk-reject`, {
      clusterIds: ids,
    });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Updated ${res.data.updated ?? ids.length} cluster(s).`);
    const failed: Array<{ id: string; reason: string }> = res.data.failed ?? [];
    if (failed.length > 0) {
      console.warn(`WARNING: ${failed.length} cluster(s) failed:`);
      failed.forEach((f) => console.warn(`  - ${f.id}: ${f.reason}`));
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

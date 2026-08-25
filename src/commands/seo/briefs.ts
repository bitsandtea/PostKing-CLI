import { createClient } from "../../client";
import { printWebUrl } from "../../output";
import { requireBrand, printError, pollOperation } from "./shared";

const VALID_BRIEF_TYPES = ["blog", "comparison", "tool", "landing"] as const;
type BriefType = (typeof VALID_BRIEF_TYPES)[number];

// ─── seo briefs list ─────────────────────────────────────────────────────────

export async function seoBriefsListCommand(options: {
  brand?: string;
  status?: string;
  type?: string;
  cluster?: string;
  limit?: string;
  cursor?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.type) params.set("type", options.type);
    if (options.cluster) params.set("clusterId", options.cluster);
    if (options.limit) params.set("limit", options.limit);
    if (options.cursor) params.set("cursor", options.cursor);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/briefs${qs}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const briefs = res.data.briefs ?? [];
    console.log(`\nBriefs (${res.data.total ?? briefs.length}):`);
    briefs.forEach((b: { id: string; status: string; roadmapItem?: { id: string; title: string } }) =>
      console.log(`  ${b.id}  [${b.status}]  ${b.roadmapItem?.title ?? ""}`)
    );
    if (res.data.nextCursor) console.log(`Next cursor: ${res.data.nextCursor}`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs view ─────────────────────────────────────────────────────────

export async function seoBriefsViewCommand(
  briefId: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/briefs/${briefId}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const brief = res.data.brief ?? res.data;
    console.log(`\n[${brief.id}] ${brief.roadmapItem?.title ?? ""}`);
    console.log(`Status: ${brief.status ?? "—"}`);
    if (brief.roadmapItem?.clusterId) console.log(`Cluster: ${brief.roadmapItem.clusterId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs generate ─────────────────────────────────────────────────────

export async function seoBriefsGenerateCommand(options: {
  brand?: string;
  cluster?: string[];
  wait?: boolean;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = {};
  if (options.cluster && options.cluster.length > 0) body.clusterIds = options.cluster;
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/roadmap/generate`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Brief generation started.`);
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

// ─── seo briefs regenerate ───────────────────────────────────────────────────

export async function seoBriefsRegenerateCommand(
  briefId: string,
  options: { brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/briefs/${briefId}/regenerate`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Brief regeneration started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        await pollOperation(client, brandId, res.data.operationId, { label: "Regenerate brief" });
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs approve ──────────────────────────────────────────────────────

export async function seoBriefsApproveCommand(
  briefId: string,
  options: { brand?: string; heroImage?: boolean; voice?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = { status: "approved" };
  if (options.heroImage) body.generateHeroImage = true;
  if (options.voice) body.voiceProfileId = options.voice;
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/seo/briefs/${briefId}`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Brief ${briefId} approved. Article generation started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        await pollOperation(client, brandId, res.data.operationId, { label: "Write article" });
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs reject ───────────────────────────────────────────────────────

export async function seoBriefsRejectCommand(
  briefId: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/seo/briefs/${briefId}`, { status: "rejected" });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Brief ${briefId} rejected.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs bulk-approve ─────────────────────────────────────────────────

export async function seoBriefsBulkApproveCommand(
  ids: string[],
  options: { brand?: string; heroImage?: boolean; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = { briefIds: ids };
  if (options.heroImage) body.generateHeroImage = true;
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/briefs/bulk-approve`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const operationIds: string[] = res.data.operationIds ?? [];
    console.log(`SUCCESS: Approved ${res.data.approved ?? ids.length} brief(s). ${operationIds.length} operation(s) started.`);
    operationIds.forEach((opId) => console.log(`  Operation: ${opId}`));
    const failed: Array<{ id: string; reason: string }> = res.data.failed ?? [];
    if (failed.length > 0) {
      console.warn(`WARNING: ${failed.length} brief(s) failed:`);
      failed.forEach((f) => console.warn(`  - ${f.id}: ${f.reason}`));
    }
    if (options.wait) {
      for (const opId of operationIds) {
        await pollOperation(client, brandId, opId, { label: `Write article (${opId})` });
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo briefs generate-one ─────────────────────────────────────────────────

export async function seoBriefsGenerateOneCommand(options: {
  brand?: string;
  pillar: string;
  supporting: string;
  type: string;
  intent?: string;
  research?: string;
  tier?: string;
  wait?: boolean;
  json?: boolean;
}): Promise<void> {
  if (!(VALID_BRIEF_TYPES as readonly string[]).includes(options.type)) {
    console.error(`ERROR: --type must be one of: ${VALID_BRIEF_TYPES.join(", ")}`);
    process.exit(1);
  }
  const supportingKeywords = options.supporting
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const grounded = options.research !== "fast";
  const research: { grounded: boolean; tier?: string } = { grounded };
  if (options.tier) research.tier = options.tier;

  const body: Record<string, unknown> = {
    pillarKeyword: options.pillar,
    supportingKeywords,
    type: options.type as BriefType,
    research,
  };
  if (options.intent) body.intent = options.intent;

  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/briefs/generate-one`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Brief generation started.`);
    if (res.data.operationId) {
      if (options.wait !== false) {
        const op = await pollOperation(client, brandId, res.data.operationId, { label: "Generate brief" });
        const result = op.result as { briefId?: string; brief?: { id?: string; type?: string; isUngrounded?: boolean; briefData?: unknown } } | undefined;
        if (result?.brief) {
          const b = result.brief;
          console.log(`\nBrief ID: ${b.id ?? result.briefId ?? "—"}  Type: ${b.type ?? options.type}  Grounded: ${!b.isUngrounded}`);
          if (b.briefData) {
            if (options.json) {
              console.log(JSON.stringify(result, null, 2));
            } else {
              console.log(JSON.stringify(b.briefData, null, 2));
            }
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

import { createClient } from "../../client";
import { printWebUrl } from "../../output";
import { requireBrand, printError, pollOperation, VALID_ROADMAP_ACTIONS, VALID_ROADMAP_STATUSES } from "./shared";

// ─── seo roadmap ─────────────────────────────────────────────────────────────

export async function seoRoadmapCommand(options: {
  brand?: string;
  status?: string;
  type?: string;
  priority?: string;
  cluster?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.type) params.set("type", options.type);
    if (options.priority) params.set("priority", options.priority);
    if (options.cluster) params.set("clusterId", options.cluster);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/roadmap${qs}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const items = res.data.items ?? [];
    const cap = options.limit ? parseInt(options.limit, 10) : 50;
    const stats = res.data.stats ?? {};
    console.log(`\nRoadmap (${items.length}):`);
    items
      .slice(0, cap)
      .forEach(
        (it: { id: string; title: string; status: string; primaryKeyword?: string }) =>
          console.log(`  ${it.id}  [${it.status}]  ${it.title}  (${it.primaryKeyword ?? ""})`)
      );
    console.log(`\nStats: total=${stats.total ?? "—"}  completed=${stats.completed ?? "—"}  in_progress=${stats.inProgress ?? "—"}  suggested=${stats.suggested ?? "—"}  completion=${stats.completionRate ?? "—"}%`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoRoadmapViewCommand(
  id: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/roadmap/${id}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const it = res.data.item ?? res.data;
    console.log(`\n[${it.id}] ${it.title ?? ""}`);
    console.log(`Status:  ${it.status ?? "—"}`);
    if (it.primaryKeyword) console.log(`Keyword: ${it.primaryKeyword}`);
    if (it.clusterId) console.log(`Cluster: ${it.clusterId}`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoRoadmapEditCommand(
  id: string,
  options: { brand?: string; action?: string; status?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  if (options.action !== undefined && !VALID_ROADMAP_ACTIONS.includes(options.action)) {
    console.error(`ERROR: Invalid --action "${options.action}". Must be one of: ${VALID_ROADMAP_ACTIONS.join(", ")}`);
    process.exit(1);
  }
  if (options.status !== undefined && !VALID_ROADMAP_STATUSES.includes(options.status)) {
    console.error(`ERROR: Invalid --status "${options.status}". Must be one of: ${VALID_ROADMAP_STATUSES.join(", ")}`);
    process.exit(1);
  }
  const body: Record<string, unknown> = {};
  if (options.action !== undefined) body.action = options.action;
  if (options.status !== undefined) body.status = options.status;
  if (Object.keys(body).length === 0) {
    console.error("ERROR: Provide at least --action or --status.");
    process.exit(1);
  }
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/seo/roadmap/${id}`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Roadmap item ${id} updated.`);
    const it = res.data.item ?? res.data;
    if (it?.status) console.log(`Status: ${it.status}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoRoadmapDeleteCommand(
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
    const res = await client.delete(`/api/agent/v1/brands/${brandId}/seo/roadmap/${id}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Roadmap item ${id} deleted.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo write ───────────────────────────────────────────────────────────────

export async function seoWriteCommand(
  roadmapId: string,
  options: {
    brand?: string;
    heroImage?: boolean;
    voice?: string;
    wait?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = {};
  if (options.heroImage) body.generateHeroImage = true;
  if (options.voice) body.voiceProfileId = options.voice;
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/roadmap/${roadmapId}/write`,
      body
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Article generation started.`);
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

// ─── seo stats ───────────────────────────────────────────────────────────────

export async function seoStatsCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/roadmap/stats`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

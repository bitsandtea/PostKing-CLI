import { createClient } from "../client";
import { getBrandId } from "../config";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

function printError(err: unknown): void {
  const e = err as {
    response?: { data?: { error?: { message?: string; checkoutUrl?: string } } };
    message: string;
  };
  const env = e.response?.data?.error;
  console.error(`ERROR: ${env?.message ?? e.message}`);
  if (env?.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
}

export async function seoSeedsCommand(
  seeds: string[],
  options: { brand?: string }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/seeds`, {
      seeds,
    });
    console.log(`SUCCESS: Added ${res.data.added ?? seeds.length} seed keyword(s).`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoGenerateCommand(options: {
  brand?: string;
  count?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const count = options.count ? parseInt(options.count, 10) : 100;
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/keywords/generate`,
      { count }
    );
    console.log(`SUCCESS: Generated ${res.data.generated ?? count} keywords.`);
    if (res.data?.operationId) console.log(`Operation: ${res.data.operationId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoKeywordsCommand(options: {
  brand?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const qs = options.limit ? `?limit=${options.limit}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/keywords${qs}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const keywords = res.data.keywords ?? [];
    console.log(`\nKeywords (${keywords.length}):`);
    keywords
      .slice(0, 50)
      .forEach((k: { id: string; keyword: string; volume?: number; category?: string }) =>
        console.log(`  ${k.id}  ${k.keyword}  vol=${k.volume ?? "—"}  [${k.category ?? "—"}]`)
      );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoCategorizeCommand(options: { brand?: string }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/categorize`, {});
    console.log(`SUCCESS: Categorization started. ${res.data.categorized ?? ""}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoClusterCommand(options: { brand?: string }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/cluster`, {});
    console.log(`SUCCESS: Clustering complete. ${res.data.clusters ?? 0} cluster(s).`);
    const clusters = res.data.clustersList ?? res.data.clusters ?? [];
    if (Array.isArray(clusters)) {
      clusters
        .slice(0, 20)
        .forEach((c: { id: string; name: string; keywordCount?: number }) =>
          console.log(`  ${c.id}  ${c.name}  (${c.keywordCount ?? 0} kw)`)
        );
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoRoadmapCommand(options: {
  brand?: string;
  cluster?: string;
  items?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  if (options.cluster || options.items) {
    try {
      const res = await client.post(
        `/api/agent/v1/brands/${brandId}/seo/roadmap/generate`,
        {
          clusterId: options.cluster,
          items: options.items ? parseInt(options.items, 10) : 20,
        }
      );
      if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
      console.log(`SUCCESS: Roadmap generated. ${res.data.items ?? 0} item(s).`);
      return;
    } catch (err) {
      printError(err);
      process.exit(1);
    }
  }
  try {
    const qs = options.limit ? `?limit=${options.limit}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/roadmap${qs}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const items = res.data.items ?? [];
    const cap = options.limit ? parseInt(options.limit, 10) : 50;
    console.log(`\nRoadmap (${items.length}):`);
    items
      .slice(0, cap)
      .forEach(
        (it: { id: string; title: string; status: string; primaryKeyword?: string; priority?: number }) =>
          console.log(
            `  ${it.id}  [${it.status}]  p=${it.priority ?? "—"}  ${it.title}  (${it.primaryKeyword ?? ""})`
          )
      );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoWriteCommand(options: {
  brand?: string;
  roadmapId: string;
  count?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/roadmap/${options.roadmapId}/write`,
      { count: options.count ? parseInt(options.count, 10) : 1 }
    );
    const articles = res.data.articles ?? [res.data.article];
    console.log(`SUCCESS: Wrote ${articles.length} article(s).`);
    articles.forEach((a: { id?: string; postTitle?: string }) => {
      if (a?.id) console.log(`  ${a.id}  ${a.postTitle ?? ""}`);
    });
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoGapCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/gap-analysis`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoCompetitorCommand(options: {
  brand?: string;
  domain: string;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/competitor-diff`,
      { competitorDomain: options.domain }
    );
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoPublishCommand(options: {
  brand?: string;
  articleId: string;
  publication?: string;
  schedule?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/blogs/${options.articleId}/publish`,
      {
        publicationId: options.publication,
        scheduledAt: options.schedule,
      }
    );
    console.log(`SUCCESS: Publish requested. Status: ${res.data.status ?? "ok"}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoStatsCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/seo/roadmap/stats`
    );
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.1 additions ────────────────────────────────────────────────────────────

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
    clusters.forEach((c: { id: string; name: string; keywordCount?: number; status?: string }) =>
      console.log(`  ${c.id}  ${c.name}  (${c.keywordCount ?? 0} kw)  [${c.status ?? "—"}]`)
    );
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
    console.log(`Priority: ${it.priority ?? "—"}`);
    if (it.primaryKeyword) console.log(`Keyword: ${it.primaryKeyword}`);
    if (it.clusterId) console.log(`Cluster: ${it.clusterId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoRoadmapEditCommand(
  id: string,
  options: { brand?: string; title?: string; status?: string; priority?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = {};
  if (options.title !== undefined) body.title = options.title;
  if (options.status !== undefined) body.status = options.status;
  if (options.priority !== undefined) body.priority = parseInt(options.priority, 10);
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

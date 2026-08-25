import { createClient } from "../../client";
import { requireBrand, printError } from "./shared";

// ─── seo gap ─────────────────────────────────────────────────────────────────

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

// ─── seo competitor ──────────────────────────────────────────────────────────

export async function seoCompetitorCommand(options: {
  brand?: string;
  domain: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/competitor-diff`,
      { competitorDomain: options.domain }
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo publish ─────────────────────────────────────────────────────────────

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

// ─── seo link-health ─────────────────────────────────────────────────────────

export async function seoLinkHealthCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/link-health`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

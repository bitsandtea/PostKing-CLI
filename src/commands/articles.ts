import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";
import { validateLanguageFlag } from "../constants";
import { pollOperation } from "../lib/operations";
import { articleToMarkdown, imageFileName } from "../lib/socialArticle";

const PLATFORMS = ["linkedin", "x"];
const STATUSES = ["generating", "draft", "ready", "published", "failed"];

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first.");
    process.exit(1);
  }
  return brandId;
}

function fail(err: unknown): never {
  console.error(`ERROR: ${extractApiError(err)}`);
  process.exit(1);
}

interface ArticleImage { marker: number; url: string | null; alt: string; caption?: string; prompt?: string | null }

export async function articlesGenerateCommand(options: {
  platform: string;
  topic?: string;
  blog?: string;
  brief?: string;
  keyword?: string;
  voice?: string;
  images?: string;
  language?: string;
  wait?: boolean;
  json?: boolean;
}): Promise<void> {
  if (!PLATFORMS.includes(options.platform)) {
    console.error(`ERROR: --platform must be one of: ${PLATFORMS.join(", ")}`);
    process.exit(1);
  }
  if (!options.topic && !options.blog && !options.brief) {
    console.error("ERROR: Provide --topic, --blog <articleId> (research input only) or --brief <briefId>.");
    process.exit(1);
  }
  const imageCount = options.images ? parseInt(options.images, 10) : undefined;
  if (imageCount !== undefined && (isNaN(imageCount) || imageCount < 2 || imageCount > 5)) {
    console.error("ERROR: --images must be a number between 2 and 5.");
    process.exit(1);
  }
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/social-articles`, {
      platform: options.platform,
      topic: options.topic,
      sourceBlogArticleId: options.blog,
      seoBriefId: options.brief,
      targetKeyword: options.keyword,
      voiceProfileId: options.voice,
      imageCount,
      language,
    });
    const articleId = res.data?.article?.id;
    const operationId = res.data?.operationId ?? res.data?.article?.operationId;
    if (options.json && !options.wait) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Article generation started. ID: ${articleId ?? "(unknown)"} (25 credits, text only; images are 30 credits each: pking articles images <id>)`);
    if (options.wait && operationId) {
      await pollOperation(client, brandId, operationId, { label: "Generate article" });
      console.log(`Done. Run: pking articles get ${articleId}`);
    } else if (operationId) {
      console.log(`Operation: ${operationId}  (pking jobs list)`);
      console.log(`Then run: pking articles get ${articleId}`);
    }
  } catch (err) {
    fail(err);
  }
}

export async function articlesListCommand(options: { platform?: string; status?: string; json?: boolean }): Promise<void> {
  if (options.platform && !PLATFORMS.includes(options.platform)) {
    console.error(`ERROR: --platform must be one of: ${PLATFORMS.join(", ")}`);
    process.exit(1);
  }
  if (options.status && !STATUSES.includes(options.status)) {
    console.error(`ERROR: --status must be one of: ${STATUSES.join(", ")}`);
    process.exit(1);
  }
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-articles`, {
      params: { platform: options.platform, status: options.status },
    });
    const articles: Array<Record<string, unknown>> = res.data?.articles ?? [];
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    if (articles.length === 0) { console.log("No articles found."); return; }
    for (const a of articles) {
      console.log(`${a.id}  [${a.platform}]  ${a.status}  ${a.wordCount ?? 0}w  ${a.title}`);
    }
  } catch (err) {
    fail(err);
  }
}

async function saveImages(dir: string, images: Array<{ marker?: number; url: string }>): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const img of images) {
    const file = join(dir, imageFileName(img.marker, img.url));
    const res = await fetch(img.url);
    if (!res.ok) { console.error(`WARN: could not download ${img.url} (${res.status})`); continue; }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`Saved ${file}`);
  }
}

export async function articlesGetCommand(
  articleId: string,
  options: { markdown?: boolean; saveImages?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-articles/${articleId}`);
    const a = res.data?.article ?? res.data;
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); }
    else if (options.markdown) { console.log(articleToMarkdown(a)); }
    else {
      console.log(`${a.title}  [${a.platform}, ${a.status}, ${a.wordCount ?? 0} words]`);
      if (a.subtitle) console.log(`Subtitle: ${a.subtitle}`);
      if (a.error) console.log(`Error: ${a.error}`);
      if (a.publishedUrl) console.log(`Published: ${a.publishedUrl}`);
      if (a.coverImage) console.log(`Cover: ${a.coverImage.url ?? "no image yet"}`);
      for (const i of (a.inlineImages ?? []) as ArticleImage[]) console.log(`[Image ${i.marker}]: ${i.url ?? `no image yet (prompt: ${i.prompt ?? "none"})`}`);
      if (a.teaserPost) console.log(`\nTeaser post:\n${a.teaserPost}`);
      console.log("\nUse --markdown to print the paste-ready body, --save-images <dir> to download images.");
    }
    if (options.saveImages) {
      const images: Array<{ marker?: number; url: string }> = [];
      if (a.coverImage?.url) images.push({ url: a.coverImage.url });
      for (const i of (a.inlineImages ?? []) as ArticleImage[]) if (i.url) images.push({ marker: i.marker, url: i.url });
      await saveImages(options.saveImages, images);
    }
  } catch (err) {
    fail(err);
  }
}

export async function articlesUpdateCommand(
  articleId: string,
  options: { title?: string; subtitle?: string; teaser?: string; keyword?: string; status?: string; publishedUrl?: string; json?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (options.title !== undefined) patch.title = options.title;
  if (options.subtitle !== undefined) patch.subtitle = options.subtitle;
  if (options.teaser !== undefined) patch.teaserPost = options.teaser;
  if (options.keyword !== undefined) patch.targetKeyword = options.keyword;
  if (options.status !== undefined) patch.status = options.status;
  if (options.publishedUrl !== undefined) patch.publishedUrl = options.publishedUrl;
  if (Object.keys(patch).length === 0) {
    console.error("ERROR: Nothing to update. Pass --published-url, --title, --subtitle, --teaser, --keyword or --status.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/social-articles/${articleId}`, patch);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const a = res.data?.article ?? res.data;
    console.log(`SUCCESS: Article ${articleId} updated (status: ${a?.status ?? "?"}).`);
  } catch (err) {
    fail(err);
  }
}

export async function articlesImageCommand(
  articleId: string,
  options: { marker: string; prompt?: string; json?: boolean }
): Promise<void> {
  const marker = parseInt(options.marker, 10);
  if (isNaN(marker) || marker < 0) {
    console.error("ERROR: --marker must be 0 (cover) or an inline image number.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/social-articles/${articleId}/images/${marker}/regenerate`,
      { prompt: options.prompt }
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: ${marker === 0 ? "Cover" : `Image ${marker}`} generated (30 credits). Run: pking articles get ${articleId}`);
  } catch (err) {
    fail(err);
  }
}

export async function articlesImagesCommand(articleId: string, options: { json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/social-articles/${articleId}/images/generate-all`, {});
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Empty image slots generated (30 credits each). Run: pking articles get ${articleId}`);
  } catch (err) {
    fail(err);
  }
}

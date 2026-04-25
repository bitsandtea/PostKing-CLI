/**
 * pking visuals — asset library commands
 *
 * Every subcommand wraps exactly one agent v1 REST call.
 * Output modes:
 *   default — human-readable table, no raw slot keys printed
 *   --json  — raw agent-v1 payload verbatim (preserves _internal.slot)
 *
 * Post-scoped picker, cards, and carousel commands live in visuals-post.ts
 * and are re-exported below.
 */

import fs from "fs";
import path from "path";
import { createClient } from "../client";
import { getBrandId } from "../config";

// ─── helpers ─────────────────────────────────────────────────────────────────

function requireBrand(): string {
  const id = getBrandId();
  if (!id) {
    console.error("ERROR: No active brand set. Run 'pking brand set <brandId>' first.");
    process.exit(1);
  }
  return id;
}

type ErrorEnvelope = {
  message?: string;
  checkoutUrl?: string;
  docsUrl?: string;
  retryable?: boolean;
  details?: { validStyles?: string[] };
};

function printError(err: unknown): void {
  const e = err as {
    response?: {
      status?: number;
      headers?: Record<string, string>;
      data?: { error?: ErrorEnvelope };
    };
    message: string;
  };
  const env = e.response?.data?.error;
  if (env) {
    console.error(`ERROR: ${env.message ?? "(no message)"}`);
    if (env.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
    if (env.docsUrl) console.error(`-> Docs: ${env.docsUrl}`);
    if (env.retryable) {
      const retryAfter = e.response?.headers?.["retry-after"];
      if (retryAfter) console.error(`-> Retry after: ${retryAfter}s`);
    }
  } else {
    console.error(`ERROR: ${e.message}`);
  }
}

function emitJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.substring(0, len) : s + " ".repeat(len - s.length);
}

// ─── library commands ─────────────────────────────────────────────────────────

export interface VisualsListOptions {
  type?: string;
  tags?: string;
  search?: string;
  limit?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/assets
 */
export async function visualsListCommand(options: VisualsListOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const params = new URLSearchParams();
  if (options.type) params.set("type", options.type);
  if (options.tags) params.set("tags", options.tags);
  if (options.search) params.set("search", options.search);
  if (options.limit) params.set("limit", options.limit);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/assets?${params}`);
    if (options.json) { emitJson(res.data); return; }

    const assets: Array<{
      id: string;
      name?: string;
      type?: string;
      tags?: string[];
      url?: string;
    }> = res.data.assets ?? [];

    if (assets.length === 0) {
      console.log("No assets found. Upload one with 'pking visuals upload'.");
      return;
    }

    console.log(`\nAssets (${assets.length}):\n`);
    console.log(`  ${"ID".padEnd(26)}  ${"TYPE".padEnd(10)}  ${"TAGS".padEnd(20)}  NAME`);
    console.log(`  ${"─".repeat(26)}  ${"─".repeat(10)}  ${"─".repeat(20)}  ${"─".repeat(30)}`);
    for (const a of assets) {
      const tagStr = (a.tags ?? []).join(",").substring(0, 20);
      console.log(`  ${pad(a.id, 26)}  ${pad(a.type ?? "—", 10)}  ${pad(tagStr, 20)}  ${a.name ?? "—"}`);
    }
    console.log("");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsViewOptions {
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/assets/{assetId}
 */
export async function visualsViewCommand(assetId: string, options: VisualsViewOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/assets/${assetId}`);
    if (options.json) { emitJson(res.data); return; }

    const a = res.data.asset ?? res.data;
    console.log(`\nAsset: ${a.id}`);
    console.log(`  Name:        ${a.name ?? "—"}`);
    console.log(`  Type:        ${a.type ?? "—"}`);
    console.log(`  Description: ${a.description ?? "—"}`);
    console.log(`  Tags:        ${(a.tags ?? []).join(", ") || "—"}`);
    console.log(`  URL:         ${a.url ?? "—"}`);
    console.log(`  Active:      ${a.isActive ?? true}`);
    console.log("");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsUploadOptions {
  file: string;
  name?: string;
  description?: string;
  tags?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/assets
 *
 * NOTE: Uses base64-encoded body for Node >=16 compatibility.
 * Team B's route must accept { fileBase64, fileName, name?, description?, tags? }.
 * Once B confirms multipart-only, upgrade to native FormData (Node >=18).
 */
export async function visualsUploadCommand(options: VisualsUploadOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const body: Record<string, unknown> = {
    fileBase64: fileBuffer.toString("base64"),
    fileName: path.basename(filePath),
  };
  if (options.name) body.name = options.name;
  if (options.description) body.description = options.description;
  if (options.tags) body.tags = options.tags.split(",").map((t) => t.trim());

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/assets`, body);
    if (options.json) { emitJson(res.data); return; }

    const a = res.data.asset ?? res.data;
    console.log(`SUCCESS: Asset uploaded.`);
    console.log(`  ID:  ${a.id}`);
    console.log(`  URL: ${a.url}`);
    console.log(`\nTip: use 'pking visuals tag ${a.id} --add tag1,tag2' to label this asset.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsImportUrlOptions {
  name?: string;
  tags?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/assets (JSON body with url field)
 */
export async function visualsImportUrlCommand(url: string, options: VisualsImportUrlOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const body: Record<string, unknown> = { url };
  if (options.name) body.name = options.name;
  if (options.tags) body.tags = options.tags.split(",").map((t) => t.trim());

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/assets`, body);
    if (options.json) { emitJson(res.data); return; }

    const a = res.data.asset ?? res.data;
    console.log(`SUCCESS: Asset imported from URL.`);
    console.log(`  ID:  ${a.id}`);
    console.log(`  URL: ${a.url ?? url}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsImportCsvOptions {
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/assets/import-urls
 * Accepts a file with one URL per line OR a JSON array of URLs. Batch limit: 50.
 */
export async function visualsImportCsvCommand(file: string, options: VisualsImportCsvOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8").trim();
  let urls: string[];

  if (raw.startsWith("[")) {
    try {
      urls = JSON.parse(raw) as string[];
    } catch {
      console.error("ERROR: File looks like JSON but could not be parsed. Expected a JSON array of URL strings.");
      process.exit(1);
    }
  } else {
    urls = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  }

  if (urls.length === 0) {
    console.error("ERROR: No URLs found in file.");
    process.exit(1);
  }
  if (urls.length > 50) {
    console.error(`ERROR: Batch limit is 50 URLs; file contains ${urls.length}.`);
    process.exit(1);
  }

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/assets/import-urls`, { urls });
    if (options.json) { emitJson(res.data); return; }

    const imported = res.data.imported ?? res.data.assets?.length ?? urls.length;
    console.log(`SUCCESS: Imported ${imported} asset(s) from ${urls.length} URL(s).`);
    console.log(`\nTip: run 'pking visuals list' to browse the updated library.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsTagOptions {
  add?: string;
  remove?: string;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/brands/{brandId}/assets/{assetId}
 */
export async function visualsTagCommand(assetId: string, options: VisualsTagOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  if (!options.add && !options.remove) {
    console.error("ERROR: Provide at least one of --add or --remove.");
    process.exit(1);
  }

  const body: Record<string, unknown> = {};
  if (options.add) body.addTags = options.add.split(",").map((t) => t.trim());
  if (options.remove) body.removeTags = options.remove.split(",").map((t) => t.trim());

  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/assets/${assetId}`, body);
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Tags updated for asset ${assetId}.`);
    const updated = res.data.asset;
    if (updated?.tags) console.log(`  Current tags: ${updated.tags.join(", ")}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsDeleteOptions {
  json?: boolean;
}

/**
 * Wraps DELETE /api/agent/v1/brands/{brandId}/assets/{assetId} (soft-delete)
 */
export async function visualsDeleteCommand(assetId: string, options: VisualsDeleteOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  try {
    const res = await client.delete(`/api/agent/v1/brands/${brandId}/assets/${assetId}`);
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Asset ${assetId} removed from library (soft-deleted).`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsTagsOptions {
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/assets/tags
 */
export async function visualsTagsCommand(options: VisualsTagsOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/assets/tags`);
    if (options.json) { emitJson(res.data); return; }

    const tags: string[] = res.data.tags ?? [];
    if (tags.length === 0) {
      console.log("No tags found in this library.");
      return;
    }
    console.log(`\nAll tags (${tags.length}):\n`);
    console.log(`  ${tags.join("  ")}`);
    console.log("");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsSuggestOptions {
  context: string;
  limit?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/assets/suggestions?context=&limit=
 */
export async function visualsSuggestCommand(options: VisualsSuggestOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const params = new URLSearchParams({ context: options.context });
  if (options.limit) params.set("limit", options.limit);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/assets/suggestions?${params}`);
    if (options.json) { emitJson(res.data); return; }

    const suggestions: Array<{ id: string; name?: string; url?: string; description?: string }> =
      res.data.suggestions ?? res.data.assets ?? [];

    if (suggestions.length === 0) {
      console.log("No matching assets found for this context.");
      return;
    }

    console.log(`\nSuggested assets for context "${options.context}" (${suggestions.length}):\n`);
    for (const s of suggestions) {
      console.log(`  ${pad(s.id, 26)}  ${s.name ?? "—"}`);
      if (s.description) console.log(`             ${s.description}`);
    }
    console.log(`\nTip: use 'pking visuals pick <postId> --platform <p> --asset <assetId>' to attach one.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export interface VisualsSearchStockOptions {
  platform?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/assets/search-stock
 */
export async function visualsSearchStockCommand(query: string, options: VisualsSearchStockOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();

  const body: Record<string, unknown> = { query };
  if (options.platform) body.medium = options.platform;

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/assets/search-stock`, body);
    if (options.json) { emitJson(res.data); return; }

    const results: Array<{ id?: string; url?: string; description?: string; source?: string }> =
      res.data.results ?? res.data.photos ?? [];

    if (results.length === 0) {
      console.log(`No stock results for "${query}".`);
      return;
    }

    console.log(`\nStock results for "${query}" (${results.length}):\n`);
    for (const r of results) {
      const src = r.source ?? "stock";
      console.log(`  [${src}]  ${r.url ?? r.id ?? "—"}`);
      if (r.description) console.log(`         ${r.description.substring(0, 80)}`);
    }
    console.log(`\nTip: import a URL with 'pking visuals import-url <url>' to add it to your library.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── post-scoped picker + cards + carousel ────────────────────────────────────
// These commands live in visuals-post.ts to keep each file under 800 lines.
// src/index.ts imports everything from this barrel.
export {
  visualsOptionsCommand,
  visualsRegenerateCommand,
  visualsPickCommand,
  visualsClearCommand,
  visualsCardsListCommand,
  visualsCardsEditCommand,
  visualsCardsSetCommand,
  visualsCarouselCommand,
} from "./visuals-post";
export type {
  VisualsOptionsOptions,
  VisualsRegenerateOptions,
  VisualsPickOptions,
  VisualsClearOptions,
  VisualsCardsListOptions,
  VisualsCardsEditOptions,
  VisualsCardsSetOptions,
  VisualsCarouselOptions,
} from "./visuals-post";

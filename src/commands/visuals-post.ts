/**
 * pking visuals — post-scoped picker, cards, and carousel
 *
 * These commands operate on /api/agent/v1/posts/{postId}/visuals* and
 * /api/agent/v1/posts/{postId}/cards* / carousel.
 *
 * Imported by src/commands/visuals.ts which re-exports everything.
 */

import fs from "fs";
import path from "path";
import { createClient } from "../client";
import { getBrandId } from "../config";

// ─── helpers (duplicated deliberately — no shared module to avoid coupling) ──

function requireBrandForPost(): string {
  const id = getBrandId();
  if (!id) {
    console.error("ERROR: No active brand set. Run 'pking brand set <brandId>' first.");
    console.error("Post-scoped visuals commands still require an active brand for authentication context.");
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

// ─── types ────────────────────────────────────────────────────────────────────

type AssetOption = {
  kind?: string;
  style?: string;
  variant?: number;
  description?: string;
  previewUrl?: string;
  assetId?: string;
  url?: string;
  name?: string;
};

type OptionsResponse = {
  postId?: string;
  bestPick?: {
    platform?: string;
    kind?: string;
    style?: string;
    variant?: number;
    reasoning?: string;
  };
  options?: Record<string, {
    smartMatched?: AssetOption[];
    cardTemplates?: AssetOption[];
    quoteTemplates?: AssetOption[];
    stockPhotos?: AssetOption[];
    stockVideos?: AssetOption[];
  }>;
  selected?: Record<string, unknown>;
};

function stripSlotKeys(s: string): string {
  return s
    .replace(/`slot\d+`/gi, "this template")
    .replace(/\bslot\d+\b/gi, "this template");
}

function printOptionsTable(label: string, items: AssetOption[]): void {
  if (!items || items.length === 0) return;
  console.log(`\n${label} (${items.length} options)`);
  console.log(`  ${"style".padEnd(20)}  ${"var".padEnd(4)}  description`);
  console.log(`  ${"─".repeat(20)}  ${"─".repeat(4)}  ${"─".repeat(60)}`);
  for (const item of items) {
    const rawStyle = item.style ?? item.name ?? "—";
    const style = stripSlotKeys(rawStyle);
    const variant = item.variant != null ? String(item.variant) : "—";
    const desc = stripSlotKeys(item.description ?? "").substring(0, 70);
    console.log(`  ${pad(style, 20)}  ${pad(variant, 4)}  ${desc}`);
  }
}

// ─── options ──────────────────────────────────────────────────────────────────

export interface VisualsOptionsOptions {
  platform?: string;
  category?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/posts/{postId}/visuals
 */
export async function visualsOptionsCommand(postId: string, options: VisualsOptionsOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const params = new URLSearchParams();
  if (options.platform) params.set("platform", options.platform);
  if (options.category) params.set("category", options.category);

  try {
    const res = await client.get(`/api/agent/v1/posts/${postId}/visuals?${params}`);
    if (options.json) { emitJson(res.data); return; }

    const data = res.data as OptionsResponse;

    // Best pick banner. Sanitize raw slot keys (e.g. `slot11`) from reasoning
    // so human-mode output never leaks internal identifiers, even if an older
    // cached reasoning string still contains them.
    if (data.bestPick) {
      const bp = data.bestPick;
      const label = [bp.kind, bp.style, bp.variant != null ? `variant ${bp.variant}` : undefined]
        .filter(Boolean)
        .join(" · ");
      console.log(`\n► Best pick: ${label}`);
      if (bp.reasoning) {
        const clean = bp.reasoning
          .replace(/`slot\d+`/gi, "this template")
          .replace(/\bslot\d+\b/gi, "this template");
        console.log(`  "${clean}"`);
      }
    }

    const platforms = options.platform
      ? [options.platform]
      : Object.keys(data.options ?? {});

    for (const plat of platforms) {
      const platOptions = data.options?.[plat];
      if (!platOptions) continue;

      const cat = options.category;
      if (!cat || cat === "smart") {
        if ((platOptions.smartMatched ?? []).length > 0) {
          console.log(`\n[${plat.toUpperCase()}] Library matches`);
          const items = platOptions.smartMatched ?? [];
          console.log(`  ${"ID".padEnd(26)}  name`);
          for (const item of items) {
            const name = stripSlotKeys(item.name ?? "—");
            console.log(`  ${pad(item.assetId ?? "—", 26)}  ${name}`);
            if (item.description) console.log(`    ${stripSlotKeys(item.description).substring(0, 80)}`);
          }
        }
      }
      if (!cat || cat === "card") {
        printOptionsTable(`[${plat.toUpperCase()}] Cards`, platOptions.cardTemplates ?? []);
      }
      if (!cat || cat === "quote") {
        printOptionsTable(`[${plat.toUpperCase()}] Quotes`, platOptions.quoteTemplates ?? []);
      }
      if (!cat || cat === "photo") {
        printOptionsTable(`[${plat.toUpperCase()}] Stock photos`, platOptions.stockPhotos ?? []);
      }
      if (!cat || cat === "video") {
        printOptionsTable(`[${plat.toUpperCase()}] Stock videos`, platOptions.stockVideos ?? []);
      }
    }

    console.log(`\nTip: run 'pking visuals pick ${postId} --platform <p> --style <s> --variant <n>' to select.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── regenerate ───────────────────────────────────────────────────────────────

export interface VisualsRegenerateOptions {
  loadExternal?: boolean;
  platform?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/posts/{postId}/visuals/regenerate
 */
export async function visualsRegenerateCommand(postId: string, options: VisualsRegenerateOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const body: Record<string, unknown> = {};
  if (options.loadExternal) body.loadExternal = true;
  if (options.platform) body.platform = options.platform;

  try {
    const res = await client.post(`/api/agent/v1/posts/${postId}/visuals/regenerate`, body);
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Visual options regenerated for post ${postId}.`);
    console.log(`\nTip: run 'pking visuals options ${postId}' to browse the updated options.`);
    if (res.data?.operationId) console.log(`Operation: ${res.data.operationId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── pick ─────────────────────────────────────────────────────────────────────

export interface VisualsPickOptions {
  platform: string;
  style?: string;
  variant?: string;
  asset?: string;
  slot?: string;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/posts/{postId}/visuals
 * pick body: { style?, variant?, assetId?, slot? }
 */
export async function visualsPickCommand(postId: string, options: VisualsPickOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  if (!options.style && !options.asset && !options.slot) {
    console.error("ERROR: Provide one of --style, --asset, or --slot.");
    process.exit(1);
  }

  const pick: Record<string, unknown> = {};
  if (options.style) pick.style = options.style;
  if (options.variant) pick.variant = parseInt(options.variant, 10);
  if (options.asset) pick.assetId = options.asset;
  if (options.slot) pick.slot = options.slot;

  try {
    const res = await client.patch(`/api/agent/v1/posts/${postId}/visuals`, {
      platform: options.platform,
      pick,
    });
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Visual selection applied to post ${postId} for platform ${options.platform}.`);
    const selected = res.data?.selected?.[options.platform];
    if (selected?.style) console.log(`  style:   ${selected.style}`);
    if (selected?.variant != null) console.log(`  variant: ${selected.variant}`);
    if (selected?.url) console.log(`  preview: ${selected.url}`);
    console.log(`\nTip: run 'pking posts approve ${postId}' to schedule this post with the selected visual.`);
  } catch (err) {
    // Surface valid styles from 400 error details
    const e = err as { response?: { status?: number; data?: { error?: ErrorEnvelope } } };
    if (e.response?.status === 400) {
      const details = e.response.data?.error?.details;
      if (details?.validStyles && details.validStyles.length > 0) {
        console.error(`ERROR: Invalid style/variant combination.`);
        console.error(`Valid styles for this post:`);
        for (const s of details.validStyles) {
          console.error(`  - ${s}`);
        }
        process.exit(1);
      }
    }
    printError(err);
    process.exit(1);
  }
}

// ─── clear ────────────────────────────────────────────────────────────────────

export interface VisualsClearOptions {
  platform: string;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/posts/{postId}/visuals with { clear: true }
 */
export async function visualsClearCommand(postId: string, options: VisualsClearOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  try {
    const res = await client.patch(`/api/agent/v1/posts/${postId}/visuals`, {
      platform: options.platform,
      pick: { clear: true },
    });
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Visual selection cleared for post ${postId} on platform ${options.platform}.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── cards list ───────────────────────────────────────────────────────────────

export interface VisualsCardsListOptions {
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/posts/{postId}/cards
 */
export async function visualsCardsListCommand(postId: string, options: VisualsCardsListOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  try {
    const res = await client.get(`/api/agent/v1/posts/${postId}/cards`);
    if (options.json) { emitJson(res.data); return; }

    const cards: Array<{ number?: string; title?: string; body?: string }> = res.data.cards ?? [];

    if (cards.length === 0) {
      console.log(`No cards found for post ${postId}.`);
      console.log(`\nTip: generate cards by running 'pking visuals carousel ${postId}'.`);
      return;
    }

    console.log(`\nCards for post ${postId} (${cards.length}):\n`);
    cards.forEach((card, i) => {
      const num = card.number ?? String(i + 1);
      console.log(`  Card ${num}`);
      if (card.title) console.log(`    Title: ${card.title}`);
      if (card.body) console.log(`    Body:  ${card.body}`);
      console.log("");
    });

    console.log(`Tip: edit a card with 'pking visuals cards edit ${postId} --card <n> --body "..."'.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── cards edit ───────────────────────────────────────────────────────────────

export interface VisualsCardsEditOptions {
  card: string;
  title?: string;
  body?: string;
  number?: string;
  rerender?: boolean;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/posts/{postId}/cards (single card edit)
 */
export async function visualsCardsEditCommand(postId: string, options: VisualsCardsEditOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const cardIndex = parseInt(options.card, 10);
  if (isNaN(cardIndex) || cardIndex < 1) {
    console.error("ERROR: --card must be a 1-based index (e.g. --card 1).");
    process.exit(1);
  }

  // Fetch existing cards first so we can do a targeted patch
  let existingCards: Array<{ number?: string; title?: string; body?: string }> = [];
  try {
    const getRes = await client.get(`/api/agent/v1/posts/${postId}/cards`);
    existingCards = getRes.data.cards ?? [];
  } catch (err) {
    printError(err);
    process.exit(1);
  }

  if (cardIndex > existingCards.length) {
    console.error(`ERROR: Post ${postId} has ${existingCards.length} card(s); --card ${cardIndex} is out of range.`);
    process.exit(1);
  }

  const updated = existingCards.map((card, i) => {
    if (i === cardIndex - 1) {
      return {
        ...card,
        ...(options.title !== undefined ? { title: options.title } : {}),
        ...(options.body !== undefined ? { body: options.body } : {}),
        ...(options.number !== undefined ? { number: options.number } : {}),
      };
    }
    return card;
  });

  try {
    const res = await client.patch(`/api/agent/v1/posts/${postId}/cards`, {
      cards: updated,
      rerender: options.rerender ?? false,
    });
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: Card ${cardIndex} updated for post ${postId}.`);
    if (options.rerender) console.log(`  Visual assets re-rendered.`);
    console.log(`\nTip: run 'pking visuals carousel ${postId}' to regenerate the carousel PDF.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── cards set ────────────────────────────────────────────────────────────────

export interface VisualsCardsSetOptions {
  file: string;
  rerender?: boolean;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/posts/{postId}/cards (bulk replace from file)
 */
export async function visualsCardsSetCommand(postId: string, options: VisualsCardsSetOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const filePath = path.resolve(options.file);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  let cards: unknown;
  try {
    cards = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.error("ERROR: Could not parse file — must be a valid JSON array of card objects.");
    process.exit(1);
  }

  if (!Array.isArray(cards)) {
    console.error("ERROR: File must contain a JSON array.");
    process.exit(1);
  }

  try {
    const res = await client.patch(`/api/agent/v1/posts/${postId}/cards`, {
      cards,
      rerender: options.rerender ?? false,
    });
    if (options.json) { emitJson(res.data); return; }

    console.log(`SUCCESS: ${(cards as unknown[]).length} card(s) applied to post ${postId}.`);
    if (options.rerender) console.log(`  Visual assets re-rendered.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── carousel ─────────────────────────────────────────────────────────────────

export interface VisualsCarouselOptions {
  style?: string;
  variant?: string;
  title?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/posts/{postId}/carousel
 * Returns a PDF asset.
 */
export async function visualsCarouselCommand(postId: string, options: VisualsCarouselOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const body: Record<string, unknown> = {};
  if (options.style) body.style = options.style;
  if (options.variant) body.variant = parseInt(options.variant, 10);
  if (options.title) body.title = options.title;

  try {
    const res = await client.post(`/api/agent/v1/posts/${postId}/carousel`, body);
    if (options.json) { emitJson(res.data); return; }

    const asset = res.data.asset ?? res.data;
    console.log(`SUCCESS: Carousel PDF generated for post ${postId}.`);
    console.log(`  Asset ID:   ${asset.id ?? "—"}`);
    console.log(`  Download:   ${asset.url ?? "—"}`);
    console.log(`  MIME type:  ${asset.mimeType ?? "application/pdf"}`);
    console.log(`\nTip: run 'pking posts approve ${postId}' to schedule this post with the carousel attached.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

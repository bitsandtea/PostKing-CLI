/**
 * pking visuals — post-scoped picker, cards, and carousel
 *
 * These commands operate on /api/agent/v1/posts/{postId}/visuals* and
 * /api/agent/v1/posts/{postId}/cards* / carousel.
 *
 * Imported by src/commands/visuals.ts which re-exports everything.
 */

import fs from "fs";
import os from "os";
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

// ─── types ────────────────────────────────────────────────────────────────────

type PickArgs = {
  kind?: string;
  style?: string;
  variant?: number;
  assetId?: string;
  slot?: string;
};

type AssetOption = {
  kind?: string;
  style?: string;
  variant?: number;
  description?: string;
  previewUrl?: string;
  assetId?: string;
  url?: string;
  name?: string;
  recommended?: boolean;
  pickArgs?: PickArgs;
  displayLabel?: string;
  cardText?: { title?: string; body?: string };
  _internal?: { slot?: string };
};

type OptionsResponse = {
  postId?: string;
  bestPick?: {
    platform?: string;
    kind?: string;
    style?: string;
    variant?: number;
    reasoning?: string;
    pickArgs?: PickArgs;
    displayLabel?: string;
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

type CachedItem = {
  index: number;
  pickArgs: PickArgs;
  displayLabel: string;
};

type CacheFile = {
  postId: string;
  platform: string;
  writtenAt: string;
  items: CachedItem[];
};

const SECTIONS: Array<{ key: keyof NonNullable<OptionsResponse["options"]>[string]; label: string }> = [
  { key: "smartMatched", label: "Library matches" },
  { key: "cardTemplates", label: "Cards" },
  { key: "quoteTemplates", label: "Quotes" },
  { key: "stockPhotos", label: "Stock photos" },
  { key: "stockVideos", label: "Stock videos" },
];

function cacheDir(): string {
  return path.join(os.homedir(), ".postking", "cache");
}

function cachePath(postId: string, platform: string): string {
  return path.join(cacheDir(), `visuals-${postId}-${platform}.json`);
}

function shouldHyperlink(): boolean {
  if (!process.stdout.isTTY) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === "dumb") return false;
  return true;
}

function osc8(url: string, text: string): string {
  if (!shouldHyperlink()) return url;
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.substring(0, n - 1) + "…";
}

function synthesizePickArgs(opt: AssetOption): PickArgs {
  if (opt.pickArgs) return opt.pickArgs;
  if (opt.kind === "smart" && opt.assetId) return { assetId: opt.assetId };
  if ((opt.kind === "card" || opt.kind === "quote") && opt.style && opt.variant != null) {
    return { kind: opt.kind, style: opt.style, variant: opt.variant };
  }
  if (opt._internal?.slot) return { slot: opt._internal.slot };
  return {};
}

function fallbackLabel(opt: AssetOption): string {
  const parts: string[] = [];
  if (opt.kind) parts.push(opt.kind);
  if (opt.style) parts.push(stripSlotKeys(opt.style));
  if (opt.variant != null) parts.push(`variant ${opt.variant}`);
  const head = parts.join(" · ") || stripSlotKeys(opt.name ?? "option");
  const desc = opt.description ? stripSlotKeys(opt.description) : "";
  const combined = desc ? `${head} — ${desc}` : head;
  return truncate(combined, 120);
}

function pickArgsMatch(a: PickArgs, b: PickArgs): boolean {
  if (a.assetId && b.assetId) return a.assetId === b.assetId;
  if (a.slot && b.slot) return a.slot === b.slot;
  return (
    (a.kind ?? "") === (b.kind ?? "") &&
    (a.style ?? "") === (b.style ?? "") &&
    (a.variant ?? null) === (b.variant ?? null)
  );
}

function stripSlotKeys(s: string): string {
  return s
    .replace(/`slot\d+`/gi, "this template")
    .replace(/\bslot\d+\b/gi, "this template");
}

// ─── options ──────────────────────────────────────────────────────────────────

export interface VisualsOptionsOptions {
  platform?: string;
  category?: string;
  json?: boolean;
}

function renderPlatform(
  postId: string,
  plat: string,
  platOptions: NonNullable<OptionsResponse["options"]>[string],
  bestPick: OptionsResponse["bestPick"] | undefined,
): CachedItem[] {
  // Build a flat ordered list across sections.
  type Entry = {
    sectionLabel: string;
    item: AssetOption;
  };
  const flat: Entry[] = [];
  for (const sec of SECTIONS) {
    const items = (platOptions[sec.key] ?? []) as AssetOption[];
    for (const item of items) {
      flat.push({ sectionLabel: sec.label, item });
    }
  }

  console.log(`\n╭─ ${plat.toUpperCase()} ────────────────────────────────`);

  if (flat.length === 0) {
    console.log(`No visual options yet. Run 'pking visuals regenerate ${postId}' to retry.`);
    return [];
  }

  // Resolve recommended index — match by recommended flag, displayLabel, or pickArgs.
  let recommendedIndex = -1;
  if (bestPick) {
    const bpArgs = bestPick.pickArgs;
    for (let i = 0; i < flat.length; i++) {
      const it = flat[i].item;
      if (it.recommended) { recommendedIndex = i; break; }
    }
    if (recommendedIndex === -1 && bpArgs) {
      for (let i = 0; i < flat.length; i++) {
        const args = synthesizePickArgs(flat[i].item);
        if (pickArgsMatch(args, bpArgs)) { recommendedIndex = i; break; }
      }
    }
    if (recommendedIndex === -1 && bestPick.displayLabel) {
      for (let i = 0; i < flat.length; i++) {
        if ((flat[i].item.displayLabel ?? "") === bestPick.displayLabel) {
          recommendedIndex = i;
          break;
        }
      }
    }
  }

  // Print recommended banner (uses same global index as item below).
  if (recommendedIndex >= 0 && bestPick) {
    const recItem = flat[recommendedIndex].item;
    const label = stripSlotKeys(recItem.displayLabel ?? bestPick.displayLabel ?? fallbackLabel(recItem));
    const idx = recommendedIndex + 1;
    console.log(`► Recommended`);
    console.log(`  [${idx}] ${label}`);
    if (bestPick.reasoning) {
      console.log(`      "${stripSlotKeys(bestPick.reasoning)}"`);
    }
  }

  // Walk sections, printing items with global indices and a star for recommended.
  let cursor = 0;
  const cached: CachedItem[] = [];
  for (const sec of SECTIONS) {
    const items = (platOptions[sec.key] ?? []) as AssetOption[];
    if (items.length === 0) continue;
    console.log(`\n${sec.label}`);
    for (const item of items) {
      const globalIdx = cursor + 1;
      const isRec = cursor === recommendedIndex;
      const rawLabel = item.displayLabel ?? fallbackLabel(item);
      const label = stripSlotKeys(rawLabel);
      const star = isRec ? "★ " : "";
      console.log(`  [${globalIdx}]  ${star}${label}`);

      if (item.previewUrl) {
        const visible = truncate(item.previewUrl, 70);
        console.log(`      preview: ${osc8(item.previewUrl, visible)}`);
      }

      // Card/quote text inline (only if not already in displayLabel body).
      if (item.cardText) {
        const title = item.cardText.title ?? "";
        const body = item.cardText.body ?? "";
        const bodyExcerpt = body ? truncate(body, 40) : "";
        const labelHasBody = bodyExcerpt && label.includes(bodyExcerpt.substring(0, 20));
        if ((title || body) && !labelHasBody) {
          const t = title ? `"${truncate(title, 60)}"` : "";
          const b = body ? `"${truncate(body, 80)}"` : "";
          const sep = t && b ? " / " : "";
          console.log(`      text: ${t}${sep}${b}`);
        }
      }

      cached.push({
        index: globalIdx,
        pickArgs: synthesizePickArgs(item),
        displayLabel: label,
      });
      cursor++;
    }
  }

  return cached;
}

function writeCacheFile(postId: string, platform: string, items: CachedItem[]): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    const payload: CacheFile = {
      postId,
      platform,
      writtenAt: new Date().toISOString(),
      items,
    };
    fs.writeFileSync(cachePath(postId, platform), JSON.stringify(payload, null, 2), "utf-8");
  } catch {
    // Non-fatal: cache write failure should not break the command.
  }
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

    const platforms = options.platform
      ? [options.platform]
      : Object.keys(data.options ?? {});

    for (const plat of platforms) {
      const platOptions = data.options?.[plat];
      if (!platOptions) continue;

      const bp = data.bestPick && (!data.bestPick.platform || data.bestPick.platform === plat)
        ? data.bestPick
        : undefined;

      const cached = renderPlatform(postId, plat, platOptions, bp);
      writeCacheFile(postId, plat, cached);

      console.log(`\nPick one with:  pking visuals pick ${postId} --platform ${plat} --pick <N>`);
    }
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
  pick?: string;
  json?: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache(postId: string, platform: string): CacheFile | null {
  try {
    const p = cachePath(postId, platform);
    if (!fs.existsSync(p)) return null;
    const stat = fs.statSync(p);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

/**
 * Wraps PATCH /api/agent/v1/posts/{postId}/visuals
 * pick body: { style?, variant?, assetId?, slot? }
 */
export async function visualsPickCommand(postId: string, options: VisualsPickOptions): Promise<void> {
  requireBrandForPost();
  const client = createClient();

  const hasExplicit = Boolean(options.style || options.asset || options.slot);
  const pick: Record<string, unknown> = {};

  if (options.pick && !hasExplicit) {
    const cache = readCache(postId, options.platform);
    if (!cache) {
      console.error(`ERROR: No options cached for post ${postId} platform ${options.platform}. Run 'pking visuals options ${postId} --platform ${options.platform}' first.`);
      process.exit(1);
      return;
    }
    const n = parseInt(options.pick, 10);
    const max = cache.items.length;
    if (isNaN(n) || n < 1 || n > max) {
      console.error(`ERROR: --pick ${options.pick} not found in cached options (only 1..${max}).`);
      process.exit(1);
      return;
    }
    const item = cache.items.find((it) => it.index === n);
    if (!item) {
      console.error(`ERROR: --pick ${n} not found in cached options (only 1..${max}).`);
      process.exit(1);
      return;
    }
    if (!options.json) {
      console.log(`Resolved #${n} → ${item.displayLabel}`);
    }
    const args = item.pickArgs;
    if (args.kind) pick.kind = args.kind;
    if (args.style) pick.style = args.style;
    if (args.variant != null) pick.variant = args.variant;
    if (args.assetId) pick.assetId = args.assetId;
    if (args.slot) pick.slot = args.slot;
  } else {
    if (!hasExplicit) {
      console.error("ERROR: Provide --pick <N> (after running 'pking visuals options'), or one of --style, --asset, or --slot.");
      process.exit(1);
    }
    if (options.style) pick.style = options.style;
    if (options.variant) pick.variant = parseInt(options.variant, 10);
    if (options.asset) pick.assetId = options.asset;
    if (options.slot) pick.slot = options.slot;
  }

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

/**
 * pking search-performance — GSC + Bing + GA4 + AI-visibility reporting.
 *
 * Every subcommand thin-wraps exactly one agent-v1 GET route (named in each
 * command's doc comment below). No aggregation happens here — the server
 * already assembled these DTOs; this file only formats them for a terminal.
 */

import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

// ─── helpers ─────────────────────────────────────────────────────────────────

function requireBrand(brandArg?: string): string {
  const id = brandArg ?? getBrandId();
  if (!id) {
    console.error(
      "ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass --brand <id>."
    );
    process.exit(1);
  }
  return id;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + "…";
}

/** Renders a 0..1 fraction as a percentage string, "—" for null/undefined. */
function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtPos(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toFixed(1);
}

/** ASCII share/coverage bar for a 0..1 fraction — same idiom as brand-mix.ts's intent-mix bars. */
function bar(pct: number | null | undefined, width = 24): string {
  const clamped = Math.max(0, Math.min(1, pct ?? 0));
  const filled = Math.round(clamped * width);
  return "█".repeat(filled).padEnd(width, "░");
}

function limitOf(raw: string | undefined, fallback = 10): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ─── search_performance types (types/search-performance.ts:158) ──────────────

interface SpProviderPrevious {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
}

interface SpProviderSummary {
  provider: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
  previous?: SpProviderPrevious | null;
}

interface SpTopPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
}

interface SpTopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
}

interface SearchPerformanceResponse {
  success?: boolean;
  days?: number;
  summary?: SpProviderSummary[];
  topPages?: SpTopPage[];
  topQueries?: SpTopQuery[];
}

// ─── search_ai_visibility types (types/geo-visibility.ts:353) ────────────────

interface GeoCoverageSource {
  provider: string;
  label: string;
  marketKey?: string | null;
  coverage: number | null;
  responsesOk: number;
}

interface GeoBlendedCoverage {
  coverage: number | null;
  sources: GeoCoverageSource[];
  enginesIn: number;
  enginesExpected: number;
  partial: boolean;
}

interface GeoTopicCoverage {
  topicId: string;
  label: string;
  focal: { brand: string; coverage: number; mentionSov: number | null };
  topCompetitor?: { brand: string; coverage: number } | null;
}

interface GeoOutreachTarget {
  topicId: string;
  topicLabel: string;
  url: string;
  domain: string;
  competitorsCited: string[];
  distinctQueries: number;
  citationCount: number;
}

interface GeoRunSummary {
  runId: string;
  provider: string;
  model: string;
  generatedAt: string;
  responsesOk: number;
  focalMentionCoverage: number | null;
  marketKey: string | null;
}

interface GeoVisibilityResponse {
  success?: boolean;
  latestRun?: GeoRunSummary | null;
  blendedCoverage?: GeoBlendedCoverage | null;
  coverageByTopic?: GeoTopicCoverage[];
  outreachTargets?: GeoOutreachTarget[];
}

// ─── search_ai_citations types (types/search-performance.ts:395) ─────────────

interface AiCitedPageRow {
  page: string;
  citations: number;
}

interface AiGroundingQueryRow {
  query: string;
  intent?: string;
  topic?: string;
  citations: number;
  citationSharePct?: number;
}

interface AiVisibilityCitationsResponse {
  success?: boolean;
  latestPageSnapshot?: { exportDate: string; rows: AiCitedPageRow[] } | null;
  latestQuerySnapshot?: { exportDate: string; rows: AiGroundingQueryRow[] } | null;
}

// ─── search_worklist types (types/search-performance-actions.ts:64) ──────────

interface SearchWorklistWhySegment {
  text: string;
  emphasis?: boolean;
}

interface SearchWorklistItem {
  id: string;
  kind: "seo" | "geo";
  title: string;
  why?: SearchWorklistWhySegment[];
  impact?: string;
  effort?: string;
  ctaLabel?: string;
  deepLink?: string;
}

// ─── search_sources types (types/search-performance.ts:57) ───────────────────

interface SearchSourceConnection {
  id: string;
  provider: string;
  siteUrl: string;
  authType?: string;
  status: string;
  lastSyncedAt: string | null;
  lastError?: string | null;
  createdAt: string;
}

interface SearchSourceListResponse {
  success?: boolean;
  connections?: SearchSourceConnection[];
}

// ─── search-performance overview ──────────────────────────────────────────────

export interface SearchPerformanceOverviewOptions {
  brand?: string;
  days?: string;
  provider?: string;
  origin?: string;
  limit?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-performance
 */
export async function searchPerformanceOverviewCommand(
  options: SearchPerformanceOverviewOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);
  if (options.provider) params.set("provider", options.provider);
  if (options.origin) params.set("origin", options.origin);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-performance${qs}`);
    const data = res.data as SearchPerformanceResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const limit = limitOf(options.limit);
    const days = data.days ?? options.days ?? 90;

    console.log(`\nSearch Performance — last ${days} days`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-performance)\n`);

    const summary = data.summary ?? [];
    if (summary.length === 0) {
      console.log(
        "No search-performance data yet — connect Google Search Console or Bing Webmaster in the dashboard.\n"
      );
    } else {
      console.log(
        `  ${"PROVIDER".padEnd(24)}  ${"CLICKS".padStart(8)}  ${"IMPR".padStart(9)}  ${"CTR".padStart(7)}  ${"AVG POS".padStart(8)}  DELTA CLICKS`
      );
      for (const s of summary) {
        const delta = s.previous ? s.clicks - s.previous.clicks : null;
        const deltaStr =
          delta === null ? "—" : delta >= 0 ? `+${fmtCount(delta)}` : `-${fmtCount(Math.abs(delta))}`;
        console.log(
          `  ${s.provider.padEnd(24)}  ${fmtCount(s.clicks).padStart(8)}  ${fmtCount(s.impressions).padStart(9)}  ${fmtPct(s.ctr).padStart(7)}  ${fmtPos(s.avgPosition).padStart(8)}  ${deltaStr}`
        );
      }
      console.log("");
    }

    const topQueries = (data.topQueries ?? []).slice(0, limit);
    console.log(`Top queries (${topQueries.length} of ${data.topQueries?.length ?? 0}):`);
    if (topQueries.length === 0) {
      console.log("  none\n");
    } else {
      console.log(`  ${"QUERY".padEnd(40)}  ${"CLICKS".padStart(8)}  ${"IMPR".padStart(9)}  ${"CTR".padStart(7)}  AVG POS`);
      for (const q of topQueries) {
        console.log(
          `  ${truncate(q.query, 40).padEnd(40)}  ${fmtCount(q.clicks).padStart(8)}  ${fmtCount(q.impressions).padStart(9)}  ${fmtPct(q.ctr).padStart(7)}  ${fmtPos(q.avgPosition)}`
        );
      }
      console.log("");
    }

    const topPages = (data.topPages ?? []).slice(0, limit);
    console.log(`Top pages (${topPages.length} of ${data.topPages?.length ?? 0}):`);
    if (topPages.length === 0) {
      console.log("  none\n");
    } else {
      console.log(`  ${"PAGE".padEnd(50)}  ${"CLICKS".padStart(8)}  ${"IMPR".padStart(9)}  ${"CTR".padStart(7)}  AVG POS`);
      for (const p of topPages) {
        console.log(
          `  ${truncate(p.page, 50).padEnd(50)}  ${fmtCount(p.clicks).padStart(8)}  ${fmtCount(p.impressions).padStart(9)}  ${fmtPct(p.ctr).padStart(7)}  ${fmtPos(p.avgPosition)}`
        );
      }
      console.log("");
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── search-performance ai-visibility ─────────────────────────────────────────

export interface SearchPerformanceAiVisibilityOptions {
  brand?: string;
  days?: string;
  market?: string;
  limit?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-performance/ai-visibility
 */
export async function searchPerformanceAiVisibilityCommand(
  options: SearchPerformanceAiVisibilityOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);
  if (options.market) params.set("market", options.market);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-performance/ai-visibility${qs}`);
    const data = res.data as GeoVisibilityResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const limit = limitOf(options.limit);
    const marketLabel = options.market ? ` (market: ${options.market})` : "";

    console.log(`\nAI Visibility${marketLabel}`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-performance/ai-visibility)\n`);

    const blended = data.blendedCoverage;
    const topics = data.coverageByTopic ?? [];
    if (!blended && topics.length === 0) {
      console.log(
        `No AI-visibility data yet${options.market ? ` for market "${options.market}"` : ""} — run a Deep AI Dive check from the dashboard.\n`
      );
      return;
    }

    if (blended) {
      const inOf = `${blended.enginesIn} of ${blended.enginesExpected} engines${blended.partial ? ", still landing" : ""}`;
      console.log(`  Recommended by AI  ${bar(blended.coverage)}  ${fmtPct(blended.coverage)}  (${inOf})`);
      for (const s of blended.sources) {
        const mk = s.marketKey ? ` [${s.marketKey}]` : "";
        console.log(`    ${s.label.padEnd(20)}${mk.padEnd(10)} ${bar(s.coverage, 18)}  ${fmtPct(s.coverage)}  (n=${s.responsesOk})`);
      }
      console.log("");
    }

    console.log(`Coverage by topic (${Math.min(topics.length, limit)} of ${topics.length}):`);
    if (topics.length === 0) {
      console.log("  none\n");
    } else {
      for (const t of topics.slice(0, limit)) {
        const vs = t.topCompetitor ? `  vs ${t.topCompetitor.brand} ${fmtPct(t.topCompetitor.coverage)}` : "";
        console.log(`  ${truncate(t.label, 32).padEnd(32)}  ${bar(t.focal.coverage, 18)}  ${fmtPct(t.focal.coverage)}${vs}`);
      }
      console.log("");
    }

    const outreach = data.outreachTargets ?? [];
    console.log(`Outreach targets (${Math.min(outreach.length, limit)} of ${outreach.length}):`);
    if (outreach.length === 0) {
      console.log("  none\n");
    } else {
      for (const o of outreach.slice(0, limit)) {
        console.log(`  [${truncate(o.topicLabel, 20)}] ${o.domain} — cited by ${o.competitorsCited.join(", ") || "competitors"}`);
        console.log(`    ${truncate(o.url, 90)}  (${o.citationCount} citations across ${o.distinctQueries} queries)`);
      }
      console.log("");
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── search-performance ai-citations ──────────────────────────────────────────

export interface SearchPerformanceAiCitationsOptions {
  brand?: string;
  limit?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-performance/ai-citations
 * (proxies the Bing Copilot "AI Performance" CSV import readout).
 */
export async function searchPerformanceAiCitationsCommand(
  options: SearchPerformanceAiCitationsOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-performance/ai-citations`);
    const data = res.data as AiVisibilityCitationsResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const limit = limitOf(options.limit);

    console.log(`\nAI Citations (Bing Copilot)`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-performance/ai-citations)\n`);

    if (!data.latestPageSnapshot && !data.latestQuerySnapshot) {
      console.log(
        "No AI-citation data yet — connect Bing Webmaster and import a Copilot 'AI Performance' CSV report in the dashboard.\n"
      );
      return;
    }

    const pages = data.latestPageSnapshot?.rows ?? [];
    console.log(`Cited pages${data.latestPageSnapshot ? ` (as of ${data.latestPageSnapshot.exportDate})` : ""}:`);
    if (pages.length === 0) {
      console.log("  none\n");
    } else {
      console.log(`  ${"PAGE".padEnd(60)}  CITATIONS`);
      for (const p of pages.slice(0, limit)) {
        console.log(`  ${truncate(p.page, 60).padEnd(60)}  ${p.citations}`);
      }
      console.log("");
    }

    const queries = data.latestQuerySnapshot?.rows ?? [];
    console.log(`Cited queries${data.latestQuerySnapshot ? ` (as of ${data.latestQuerySnapshot.exportDate})` : ""}:`);
    if (queries.length === 0) {
      console.log("  none\n");
    } else {
      console.log(`  ${"QUERY".padEnd(40)}  ${"TOPIC".padEnd(16)}  ${"CITATIONS".padStart(9)}  SHARE`);
      for (const q of queries.slice(0, limit)) {
        console.log(
          `  ${truncate(q.query, 40).padEnd(40)}  ${truncate(q.topic ?? "—", 16).padEnd(16)}  ${String(q.citations).padStart(9)}  ${q.citationSharePct !== undefined ? q.citationSharePct.toFixed(1) + "%" : "—"}`
        );
      }
      console.log("");
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── search-performance worklist ──────────────────────────────────────────────

export interface SearchPerformanceWorklistOptions {
  brand?: string;
  days?: string;
  limit?: string;
  json?: boolean;
}

/**
 * The worklist route's response envelope isn't fixed by an existing dashboard
 * route (it's a new thin handler, see docs/98-search-console-mcp/00-plan.md
 * Step 4) — accept either a bare array or an `items`/`worklist` field so this
 * command doesn't break on the exact shape the route ends up returning.
 */
function extractWorklistItems(data: unknown): SearchWorklistItem[] {
  if (Array.isArray(data)) return data as SearchWorklistItem[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as SearchWorklistItem[];
    if (Array.isArray(obj.worklist)) return obj.worklist as SearchWorklistItem[];
  }
  return [];
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-performance/worklist
 */
export async function searchPerformanceWorklistCommand(
  options: SearchPerformanceWorklistOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-performance/worklist${qs}`);

    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }

    const limit = limitOf(options.limit);
    const items = extractWorklistItems(res.data).slice(0, limit);

    console.log(`\nSearch Worklist — "Do this next"`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-performance/worklist)\n`);

    if (items.length === 0) {
      console.log("No worklist items — either everything's healthy or there isn't enough data yet.\n");
      return;
    }

    items.forEach((item, i) => {
      const why = (item.why ?? []).map((seg) => seg.text).join("");
      console.log(`[${i + 1}] (${item.kind.toUpperCase()}) ${item.title}`);
      if (why) console.log(`    ${truncate(why, 160)}`);
      const meta = [item.impact ? `impact: ${item.impact}` : null, item.effort ? `effort: ${item.effort}` : null]
        .filter(Boolean)
        .join("   ");
      if (meta) console.log(`    ${meta}`);
      if (item.ctaLabel) console.log(`    -> ${item.ctaLabel}`);
      console.log("");
    });
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── search-performance sources ───────────────────────────────────────────────

export interface SearchPerformanceSourcesOptions {
  brand?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-sources
 */
export async function searchPerformanceSourcesCommand(
  options: SearchPerformanceSourcesOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-sources`);
    const data = res.data as SearchSourceListResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const connections = data.connections ?? [];

    console.log(`\nSearch Sources`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-sources)\n`);

    if (connections.length === 0) {
      console.log(
        "No search sources connected — connect Google Search Console, Bing Webmaster, or Google Analytics in the dashboard.\n"
      );
      return;
    }

    console.log(
      `  ${"PROVIDER".padEnd(24)}  ${"STATUS".padEnd(18)}  ${"SITE".padEnd(30)}  LAST SYNCED`
    );
    for (const c of connections) {
      console.log(
        `  ${c.provider.padEnd(24)}  ${c.status.padEnd(18)}  ${truncate(c.siteUrl, 30).padEnd(30)}  ${c.lastSyncedAt ?? "never"}`
      );
      if (c.lastError) console.log(`    last error: ${truncate(c.lastError, 100)}`);
    }
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── search-performance page-journey ──────────────────────────────────────────

export interface SearchPerformancePageJourneyOptions {
  brand?: string;
  host?: string;
  path?: string;
  days?: string;
  limit?: string;
  json?: boolean;
}

interface PageJourneyResponse {
  days: number;
  hosted: boolean;
  suggestions: { tone: "bad" | "good" | "info"; text: string }[];
  page: { host: string; path: string } | null;
  summary: {
    visits: number;
    avgSeconds: number;
    readHalfwayPct: number;
    clicksPer100Visits: number;
    timeOnPagePct: Record<string, number>;
  } | null;
  sections: {
    name: string;
    reachedPct: number;
    avgSeconds: number;
    leftHerePct: number;
    goneSoFarPct: number;
    clickedPer100Visits: number;
  }[];
  ctas: { id: string; section: string; sawIt: number; clicks: number; clickRatePct: number }[];
  pages: { host: string; path: string; views: number }[];
  install: { websiteHost: string | null; scriptTag: string; prompt: string } | null;
  note?: string;
}

const TONE_MARK = { bad: "[change]", good: "[working]", info: "[note]" } as const;

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/search-performance/page-journey
 */
export async function searchPerformancePageJourneyCommand(
  options: SearchPerformancePageJourneyOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);
  if (options.host) params.set("host", options.host);
  if (options.path) params.set("path", options.path);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/search-performance/page-journey${qs}`);

    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }

    const data = res.data as PageJourneyResponse;
    const limit = limitOf(options.limit);

    console.log(`\nPage journey — what visitors do after they land (last ${data.days} days)`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/search-performance/page-journey)\n`);

    if (!data.page || !data.summary) {
      console.log(`${data.note ?? "No visits tracked yet."}\n`);
      if (data.install) {
        console.log("Add this tag to every page <head>:\n");
        console.log(`  ${data.install.scriptTag}\n`);
        console.log("Or hand this brief to whoever builds the site (pking search-performance page-journey --json has it):\n");
        console.log(data.install.prompt + "\n");
      }
      return;
    }

    console.log(`${data.page.host}${data.page.path === "/" ? "" : data.page.path}\n`);

    if (data.suggestions.length > 0) {
      console.log("What to change:");
      for (const s of data.suggestions) console.log(`  ${TONE_MARK[s.tone]} ${s.text}`);
      console.log("");
    }

    const m = data.summary;
    console.log(
      `  Visits ${fmtCount(m.visits)}   avg ${m.avgSeconds}s   read halfway ${m.readHalfwayPct}%   clicks per 100 visits ${m.clicksPer100Visits}`
    );
    console.log(
      `  Time on page: ${Object.entries(m.timeOnPagePct).map(([k, v]) => `${k} ${v}%`).join("  ")}\n`
    );

    if (data.sections.length > 0) {
      console.log(
        `  ${"SECTION".padEnd(24)}  ${"REACHED".padStart(8)}  ${"AVG S".padStart(6)}  ${"LEFT HERE".padStart(10)}  ${"GONE SO FAR".padStart(12)}  CLICKS/100`
      );
      for (const s of data.sections.slice(0, limit)) {
        console.log(
          `  ${truncate(s.name, 24).padEnd(24)}  ${(s.reachedPct + "%").padStart(8)}  ${String(s.avgSeconds).padStart(6)}  ${(s.leftHerePct + "%").padStart(10)}  ${(s.goneSoFarPct + "%").padStart(12)}  ${s.clickedPer100Visits}`
        );
      }
      console.log("");
    }

    if (data.ctas.length > 0) {
      console.log(`  ${"BUTTON".padEnd(24)}  ${"SECTION".padEnd(16)}  ${"SAW IT".padStart(7)}  ${"CLICKS".padStart(7)}  RATE`);
      for (const c of data.ctas.slice(0, limit)) {
        console.log(
          `  ${truncate(c.id, 24).padEnd(24)}  ${truncate(c.section || "-", 16).padEnd(16)}  ${String(c.sawIt).padStart(7)}  ${String(c.clicks).padStart(7)}  ${c.clickRatePct}%`
        );
      }
      console.log("");
    }

    if (data.pages.length > 1) {
      console.log("Other pages (use --host and --path):");
      for (const p of data.pages.slice(0, limit)) console.log(`  ${p.host}${p.path}  ${fmtCount(p.views)} visits`);
      console.log("");
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

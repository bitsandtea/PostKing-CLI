/**
 * pking social-performance — social account + post performance (feature 157).
 *
 * Each subcommand thin-wraps one agent-v1 GET route. No aggregation here; the
 * server assembles the DTOs. null = platform does not provide the metric
 * (shown as "—"); 0 = measured zero.
 */

import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

type Num = number | null | undefined;

function requireBrand(brandArg?: string): string {
  const id = brandArg ?? getBrandId();
  if (!id) {
    console.error("ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass --brand <id>.");
    process.exit(1);
  }
  return id;
}

function fmtCount(n: Num): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtPct(n: Num): string {
  return n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`;
}

/** "4.9K (+54)" style delta against the previous period. */
function fmtDelta(cur: Num, prev: Num): string {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return "";
  const d = cur - prev;
  return d === 0 ? " (±0)" : ` (${d > 0 ? "+" : "-"}${fmtCount(Math.abs(d))})`;
}

function truncate(s: string | null | undefined, max: number): string {
  const flat = (s ?? "").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + "…";
}

function limitOf(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface PostRow {
  postId: string;
  platform: string;
  publishedAt: string | null;
  preview: string;
  impressions: Num;
  reactions: Num;
  comments: Num;
  engagementRate: Num;
  deletedOnPlatform?: boolean;
  duplicateOf?: string | null;
  theme?: string | null;
  format?: string | null;
  visualType?: string | null;
  hook?: string | null;
}

interface GroupRow {
  key: string | null;
  posts: number;
  impressions: Num;
  engagementRate: Num;
  medianEngagementRate: Num;
  lowSample: boolean;
}

interface BestTimesResponse {
  timezone?: string;
  platforms?: { platform: string; posts: number; cells: (GroupRow & { day: string; hour: number })[] }[];
}

interface AccountRow {
  accountId: string;
  platform: string;
  handle?: string | null;
  status: string;
  followers: Num;
  followersPrevious: Num;
  posts: number;
  postsPrevious?: Num;
  impressions: Num;
  engagementRate: Num;
  notes?: string[];
}

interface OverviewResponse {
  days?: number;
  previousCoverage?: string;
  summary?: {
    followers: Num; followersPrevious: Num; postsPublished: number; postsPublishedPrevious: Num;
    impressions: Num; impressionsPrevious: Num; engagements: Num; engagementsPrevious: Num;
    engagementRate: Num; pulse: Num; pulsePrevious: Num; pulseDeltaPct: Num;
  };
  accounts?: AccountRow[];
  topPosts?: PostRow[];
  bottomPosts?: PostRow[];
  bestTimes?: BestTimesResponse;
  byTheme?: GroupRow[];
  byFormat?: GroupRow[];
  cadence?: { targetPerWeek: number; publishedThisWeek: number; publishedLastWeek: number; streakWeeks: number };
  notes?: string[];
}

function printPostRows(rows: PostRow[]): void {
  if (rows.length === 0) { console.log("  none\n"); return; }
  console.log(`  ${"DATE".padEnd(10)}  ${"PLATFORM".padEnd(16)}  ${"IMPR".padStart(7)}  ${"REACT".padStart(6)}  ${"CMTS".padStart(5)}  ${"ER".padStart(6)}  POST`);
  for (const p of rows) {
    const flags = `${p.deletedOnPlatform ? " [deleted]" : ""}${p.duplicateOf ? " [duplicate]" : ""}`;
    console.log(
      `  ${(p.publishedAt ?? "—").slice(0, 10).padEnd(10)}  ${p.platform.padEnd(16)}  ${fmtCount(p.impressions).padStart(7)}  ${fmtCount(p.reactions).padStart(6)}  ${fmtCount(p.comments).padStart(5)}  ${fmtPct(p.engagementRate).padStart(6)}  ${truncate(p.preview, 50)}${flags}`
    );
    if (p.format !== undefined || p.theme !== undefined) {
      console.log(`  ${" ".repeat(10)}  theme: ${p.theme ?? "—"} | format: ${p.format ?? "—"} | visual: ${p.visualType ?? "—"}`);
    }
  }
  console.log("");
}

function printGroups(title: string, rows: GroupRow[]): void {
  console.log(`${title}:`);
  if (rows.length === 0) { console.log("  none\n"); return; }
  console.log(`  ${"GROUP".padEnd(28)}  ${"POSTS".padStart(5)}  ${"IMPR".padStart(7)}  ${"ER".padStart(6)}  ${"MEDIAN".padStart(6)}`);
  for (const g of rows) {
    console.log(
      `  ${truncate(g.key ?? "(not stored)", 28).padEnd(28)}  ${String(g.posts).padStart(5)}  ${fmtCount(g.impressions).padStart(7)}  ${fmtPct(g.engagementRate).padStart(6)}  ${fmtPct(g.medianEngagementRate).padStart(6)}${g.lowSample ? "  (thin)" : ""}`
    );
  }
  console.log("");
}

function printBestTimes(bt: BestTimesResponse): void {
  console.log(`Best times (${bt.timezone ?? "UTC"}; "thin" = under 3 posts with a measured rate):`);
  for (const pl of bt.platforms ?? []) {
    console.log(`  ${pl.platform} (${pl.posts} posts)`);
    for (const c of pl.cells.slice(0, 5)) {
      console.log(`    ${c.day} ${String(c.hour).padStart(2, "0")}:00  ${String(c.posts).padStart(3)} posts  ER ${fmtPct(c.engagementRate).padStart(6)}${c.lowSample ? "  (thin)" : ""}`);
    }
  }
  console.log("");
}

export interface SocialPerformanceOverviewOptions {
  brand?: string; days?: string; platform?: string; sections?: string; json?: boolean;
}

/** Wraps GET /api/agent/v1/brands/{brandId}/social-performance */
export async function socialPerformanceOverviewCommand(options: SocialPerformanceOverviewOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);
  if (options.platform) params.set("platform", options.platform);
  if (options.sections) params.set("sections", options.sections);
  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-performance${qs}`);
    const data = res.data as OverviewResponse;
    if (options.json) { console.log(JSON.stringify(data, null, 2)); return; }

    console.log(`\nSocial Performance — last ${data.days ?? options.days ?? 28} days (vs previous period; "—" = not provided by the platform)\n`);
    const s = data.summary;
    if (s) {
      console.log(`  Followers     ${fmtCount(s.followers)}${fmtDelta(s.followers, s.followersPrevious)}`);
      console.log(`  Posts         ${s.postsPublished}${fmtDelta(s.postsPublished, s.postsPublishedPrevious)}`);
      console.log(`  Impressions   ${fmtCount(s.impressions)}${fmtDelta(s.impressions, s.impressionsPrevious)}`);
      console.log(`  Engagements   ${fmtCount(s.engagements)}${fmtDelta(s.engagements, s.engagementsPrevious)}   rate ${fmtPct(s.engagementRate)}`);
      console.log(`  Pulse         ${s.pulse ?? "—"}${s.pulseDeltaPct != null ? ` (${s.pulseDeltaPct > 0 ? "+" : ""}${s.pulseDeltaPct}% week on week)` : ""}`);
      if (data.previousCoverage && data.previousCoverage !== "full") console.log(`  (previous-period coverage: ${data.previousCoverage})`);
      console.log("");
    }
    if (data.accounts) {
      console.log(`Accounts (${data.accounts.length}):`);
      console.log(`  ${"PLATFORM".padEnd(16)}  ${"HANDLE".padEnd(22)}  ${"STATUS".padEnd(14)}  ${"FOLLOWERS".padStart(10)}  ${"POSTS".padStart(5)}  ${"IMPR".padStart(7)}  ER`);
      for (const a of data.accounts) {
        console.log(
          `  ${a.platform.padEnd(16)}  ${truncate(a.handle, 22).padEnd(22)}  ${a.status.padEnd(14)}  ${fmtCount(a.followers).padStart(10)}  ${String(a.posts).padStart(5)}  ${fmtCount(a.impressions).padStart(7)}  ${fmtPct(a.engagementRate)}`
        );
      }
      const bad = data.accounts.filter((a) => a.status !== "connected");
      if (bad.length > 0) console.log(`  ! ${bad.length} account(s) need attention (status not connected) — numbers may be stale.`);
      console.log("");
    }
    if (data.cadence) {
      const c = data.cadence;
      console.log(`Cadence: ${c.publishedThisWeek} posts this week vs ${c.publishedLastWeek} last week (target ${c.targetPerWeek}/week, streak ${c.streakWeeks}w)\n`);
    }
    if (data.topPosts) { console.log("Top posts:"); printPostRows(data.topPosts); }
    if (data.bottomPosts) { console.log("Bottom posts:"); printPostRows(data.bottomPosts); }
    if (data.byTheme) printGroups("By theme", data.byTheme.slice(0, 10));
    if (data.byFormat) printGroups("By format", data.byFormat.slice(0, 10));
    if (data.bestTimes) printBestTimes(data.bestTimes);
    for (const n of data.notes ?? []) console.log(`  note: ${n}`);
    if (data.notes?.length) console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export interface SocialPerformanceHistoryOptions {
  brand?: string; granularity?: string; from?: string; to?: string; metrics?: string; limit?: string; json?: boolean;
}

/** Wraps GET /api/agent/v1/brands/{brandId}/social-performance/accounts/{accountId}/history */
export async function socialPerformanceHistoryCommand(accountId: string, options: SocialPerformanceHistoryOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const params = new URLSearchParams();
  if (options.granularity) params.set("granularity", options.granularity);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.metrics) params.set("metrics", options.metrics);
  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-performance/accounts/${encodeURIComponent(accountId)}/history${qs}`);
    const data = res.data as {
      platform?: string; handle?: string; granularity?: string; dates?: string[];
      followers?: Num[]; impressions?: Num[]; engagements?: Num[]; posts?: Num[]; notes?: string[];
    };
    if (options.json) { console.log(JSON.stringify(data, null, 2)); return; }

    const dates = data.dates ?? [];
    const keep = limitOf(options.limit, 26);
    const start = Math.max(0, dates.length - keep);
    console.log(`\n${data.platform ?? ""} ${data.handle ?? accountId} — ${data.granularity ?? "week"} history (${dates.length - start} of ${dates.length} buckets; "—" = no data)\n`);
    const cols = (["followers", "impressions", "engagements", "posts"] as const).filter((k) => data[k]);
    console.log(`  ${"DATE".padEnd(10)}  ${cols.map((c) => c.toUpperCase().padStart(11)).join("  ")}`);
    for (let i = start; i < dates.length; i++) {
      console.log(`  ${dates[i].padEnd(10)}  ${cols.map((c) => fmtCount(data[c]![i]).padStart(11)).join("  ")}`);
    }
    console.log("");
    for (const n of data.notes ?? []) console.log(`  note: ${n}`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export interface SocialPerformancePostsOptions {
  brand?: string; days?: string; platform?: string; account?: string; sort?: string; limit?: string; offset?: string; json?: boolean;
}

/** Wraps GET /api/agent/v1/brands/{brandId}/social-performance/posts */
export async function socialPerformancePostsCommand(options: SocialPerformancePostsOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const params = new URLSearchParams();
  if (options.days) params.set("days", options.days);
  if (options.platform) params.set("platform", options.platform);
  if (options.account) params.set("accountId", options.account);
  if (options.sort) params.set("sort", options.sort);
  params.set("limit", String(limitOf(options.limit, 10)));
  if (options.offset) params.set("offset", options.offset);
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-performance/posts?${params}`);
    const data = res.data as { posts?: PostRow[]; pagination?: { total: number; limit: number; offset: number; hasMore: boolean }; notes?: string[] };
    if (options.json) { console.log(JSON.stringify(data, null, 2)); return; }

    const p = data.pagination;
    console.log(`\nPost performance${p ? ` — ${p.offset + 1}-${p.offset + (data.posts?.length ?? 0)} of ${p.total}` : ""} ("—" = not provided by the platform)\n`);
    printPostRows(data.posts ?? []);
    if (p?.hasMore) console.log(`  more: --offset ${p.offset + p.limit}\n`);
    for (const n of data.notes ?? []) console.log(`  note: ${n}`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

interface PostDetailResponse {
  postId: string; status: string; platform: string | null; publishedAt: string | null; postLink: string | null; content: string;
  metrics: { impressions: Num; reactions: Num; likes: Num; comments: Num; shares: Num; clicks: Num; engagementRate: Num; measuredAt: string | null; duplicateOf: string | null; note: string | null } | null;
  context: { theme: string | null; themeSource: string | null; intent: string | null; hook: string | null; format: string | null; visualType: string | null; visualSource: string | null; voice: string | null };
  engagementMarks: { mark: string; capturedAt: string; likes: Num; comments: Num; shares: Num; views: Num }[];
  history: { at: string; impressions: Num; reactions: Num; comments: Num }[];
  notes?: string[];
}

export interface SocialPerformancePostOptions { brand?: string; json?: boolean }

/** Wraps GET /api/agent/v1/brands/{brandId}/social-performance/posts/{postId} */
export async function socialPerformancePostCommand(postId: string, options: SocialPerformancePostOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/social-performance/posts/${encodeURIComponent(postId)}`);
    const d = res.data as PostDetailResponse;
    if (options.json) { console.log(JSON.stringify(d, null, 2)); return; }

    console.log(`\n${d.platform ?? "post"} ${d.postId} — ${d.status}${d.publishedAt ? `, published ${d.publishedAt.slice(0, 10)}` : ""} ("—" = not provided)\n`);
    const m = d.metrics;
    if (m) {
      console.log(`  Impressions ${fmtCount(m.impressions)}   Reactions ${fmtCount(m.reactions)}   Comments ${fmtCount(m.comments)}   Shares ${fmtCount(m.shares)}   Clicks ${fmtCount(m.clicks)}   ER ${fmtPct(m.engagementRate)}`);
      if (m.note) console.log(`  note: ${m.note}`);
    } else {
      console.log("  No metrics (not a published social post).");
    }
    const c = d.context;
    console.log(`\nMade with:`);
    console.log(`  Theme    ${c.theme ?? "—"}${c.themeSource ? ` (${c.themeSource})` : ""}`);
    console.log(`  Hook     ${c.hook ?? "—"}`);
    console.log(`  Voice    ${c.voice ?? "—"}`);
    console.log(`  Format   ${c.format ?? "—"}   Visual ${c.visualType ?? "—"}${c.visualSource ? ` (${c.visualSource})` : ""}`);
    if (d.engagementMarks.length) {
      console.log("\nEngagement marks:");
      for (const k of d.engagementMarks) console.log(`  ${k.mark.padEnd(4)} ${k.capturedAt.slice(0, 16)}  likes ${fmtCount(k.likes)}  comments ${fmtCount(k.comments)}  shares ${fmtCount(k.shares)}  views ${fmtCount(k.views)}`);
    }
    if (d.history.length) {
      console.log(`\nSync history (latest ${Math.min(10, d.history.length)} of ${d.history.length}):`);
      for (const h of d.history.slice(-10)) console.log(`  ${h.at.slice(0, 16)}  impr ${fmtCount(h.impressions)}  react ${fmtCount(h.reactions)}  cmts ${fmtCount(h.comments)}`);
    }
    console.log("");
    for (const n of d.notes ?? []) console.log(`  note: ${n}`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

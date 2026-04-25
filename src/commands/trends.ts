import { createClient } from "../client";

interface TrendPost {
  id: string;
  platform: string;
  niche: string;
  url: string;
  text: string;
  author: { handle: string; name: string; followers: number; verified: boolean };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    views: number;
    engagementScore: number;
  };
  postedAt: string;
  crawledAt: string;
  deconstruction: {
    hook: string;
    template: string;
    pattern: string;
    viralityReason: string;
    topic: string;
  } | null;
}

interface TrendsResponse {
  niche: string;
  platform: string;
  days: number;
  sort: string;
  total: number;
  posts: TrendPost[];
}

interface TrendsListOptions {
  niche?: string;
  platform?: string;
  days?: string;
  limit?: string;
  sort?: string;
  json?: boolean;
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

export async function trendsListCommand(options: TrendsListOptions): Promise<void> {
  const client = createClient();

  const params = new URLSearchParams();
  if (options.niche) params.set("niche", options.niche);
  if (options.platform) params.set("platform", options.platform);
  if (options.days) params.set("days", options.days);
  if (options.limit) params.set("limit", options.limit);
  if (options.sort) params.set("sort", options.sort);

  try {
    const res = await client.get(`/api/agent/v1/trends?${params}`);
    const data = res.data as TrendsResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const verifiedBadge = (v: boolean) => (v ? " ✓" : "");

    console.log(
      `\nTop ${data.posts.length} trending ${data.platform.toUpperCase()} posts in "${data.niche}" — last ${data.days} day${data.days === 1 ? "" : "s"} (${data.total} total, sorted by ${data.sort})\n`
    );

    if (data.posts.length === 0) {
      console.log(`No trends found. The crawler may not have run yet for niche="${data.niche}".`);
      return;
    }

    data.posts.forEach((p, i) => {
      const m = p.metrics;
      const stats = [
        `❤ ${fmtCount(m.likes)}`,
        `↻ ${fmtCount(m.retweets)}`,
        `💬 ${fmtCount(m.replies)}`,
        `👁 ${fmtCount(m.views)}`,
      ].join("  ");

      console.log(`[${i + 1}] @${p.author.handle}${verifiedBadge(p.author.verified)} (${fmtCount(p.author.followers)} followers)`);
      console.log(`    ${truncate(p.text, 180)}`);
      console.log(`    ${stats}   score ${m.engagementScore}   ${p.url}`);
      if (p.deconstruction) {
        console.log(`    hook: ${truncate(p.deconstruction.hook, 100)}`);
        console.log(`    why:  ${truncate(p.deconstruction.viralityReason, 100)}`);
      }
      console.log("");
    });

    console.log(`Tip: use --json to feed the full payload (including deconstruction templates) into a generator.`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

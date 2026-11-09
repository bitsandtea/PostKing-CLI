import { printWebUrl } from "../../output";
import { extractApiError } from "../../api-error";
import { createClient, requireBrand } from "./shared";

// ─── seo cannibalization-report ───────────────────────────────────────────────

interface CannibalizationMember {
  articleId: string;
  title: string;
  slug: string;
  url?: string;
  status: string;
  wordCount: number;
  postDate: string;
  updatedAt: string;
  gscClicks?: number;
  gscQueries?: string[];
  isWinner: boolean;
  proposedAction: "keep" | "merge" | "delete_draft" | "manual_review";
  reason: string;
  similarityToWinner?: number;
}

interface CannibalizationGroup {
  groupId: string;
  winnerArticleId: string;
  members: CannibalizationMember[];
  maxSimilarity: number;
  hasGscOverlap: boolean;
  allDrafts: boolean;
}

/** SERP-issue groups (a published loser actually being cannibalized) first,
 *  all-drafts housekeeping groups last. Mirrors the PostKing script's sort
 *  (scripts/seo/cannibalization-audit.ts). */
function groupSortPriority(group: CannibalizationGroup): number {
  if (group.allDrafts) return 2;
  const hasPublishedLoser = group.members.some((m) => !m.isWinner && m.status === "published");
  return hasPublishedLoser ? 0 : 1;
}

export async function seoCannibalizationReportCommand(options: {
  brand?: string;
  language?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const params = new URLSearchParams();
    if (options.language) params.set("language", options.language);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/seo/cannibalization-report${qs}`
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const groups: CannibalizationGroup[] = res.data.groups ?? [];
    console.log(`\nCannibalization report — ${res.data.articleCount ?? "?"} articles scanned, ${groups.length} group(s) found.`);
    if (res.data.signals) {
      console.log(
        `Signals: embedding=${res.data.signals.embedding ? "on" : "off"}  gsc=${res.data.signals.gsc ? "on" : "off"}  gscQueriesIgnored=${res.data.signals.gscQueriesIgnored ?? 0}`
      );
    }
    if (groups.length === 0) {
      console.log("\nNo duplicate/overlapping articles detected.");
      return;
    }
    console.log(
      "\nActions: keep=canonical winner  merge=fold loser into winner  delete_draft=drop unpublished regeneration leftover  manual_review=needs a human look"
    );
    const sortedGroups = [...groups].sort((a, b) => groupSortPriority(a) - groupSortPriority(b));
    sortedGroups.forEach((g) => {
      console.log(
        `\nGroup ${g.groupId}  (maxSimilarity=${g.maxSimilarity}  gscOverlap=${g.hasGscOverlap ? "yes" : "no"})` +
          (g.allDrafts ? "  (all drafts — housekeeping, not a SERP issue)" : "")
      );
      g.members.forEach((m) => {
        const marker = m.isWinner ? "WINNER" : m.proposedAction.toUpperCase();
        console.log(`  [${marker}] ${m.articleId}  ${m.title}  (${m.url ?? m.slug})`);
        console.log(`      status=${m.status}  words=${m.wordCount}  similarity=${m.similarityToWinner ?? "—"}`);
        console.log(`      reason: ${m.reason}`);
      });
    });
    printWebUrl(res.data);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── seo check-cannibalization ────────────────────────────────────────────────

export async function seoCheckCannibalizationCommand(options: {
  brand?: string;
  title: string;
  primaryKeyword: string;
  languageCode?: string;
  briefId?: string;
  exactOnly?: boolean;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/cannibalization-check`,
      {
        title: options.title,
        primaryKeyword: options.primaryKeyword,
        languageCode: options.languageCode,
        briefId: options.briefId,
        exactOnly: options.exactOnly,
      }
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const data = res.data ?? {};
    console.log(`\nDecision: ${data.decision ?? "—"}`);
    console.log(`Reason:   ${data.reason ?? "—"}`);
    if (data.targetArticleId) console.log(`Target article (refresh): ${data.targetArticleId}`);
    if (data.conflictingBriefId) console.log(`Conflicting brief: ${data.conflictingBriefId}`);
    if (data.similarity !== undefined) console.log(`Similarity: ${data.similarity}`);
    const matches: Array<{
      articleId?: string; briefId?: string; title: string; url?: string; slug?: string;
      status?: string; similarity: number; matchedOn: string; updatedAt?: string; wordCount?: number;
    }> = data.matches ?? [];
    if (matches.length > 0) {
      console.log(`\nMatches (${matches.length}):`);
      matches.forEach((m) => {
        const ref = m.articleId ?? m.briefId ?? "(unknown)";
        console.log(`  ${ref}  ${m.title}  (${m.url ?? m.slug ?? ""})`);
        console.log(`      similarity=${m.similarity}  matchedOn=${m.matchedOn}  status=${m.status ?? "—"}`);
      });
    }
    if (data.decision === "refresh" && data.targetArticleId) {
      console.log(`\n-> Run 'pking blog refresh ${data.targetArticleId}' to update the existing article instead of writing a new one.`);
    } else if (data.decision === "blocked") {
      console.log(`\n-> An in-flight brief already covers this keyword — wait for it or edit that brief instead.`);
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

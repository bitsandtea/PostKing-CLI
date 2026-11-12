import axios from "axios";

export class PendingConfirmation extends Error {
  readonly data: { message?: string; pendingActionId?: string; expiresAt?: string };
  constructor(data: { message?: string; pendingActionId?: string; expiresAt?: string }) {
    super(data.message ?? "Confirmation email sent.");
    this.name = "PendingConfirmation";
    this.data = data;
  }
}

/** Print the pending-email-confirmation outcome (exit code stays 0). */
export function printPendingConfirmation(p: PendingConfirmation): void {
  const d = p.data;
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(d, null, 2));
    return;
  }
  console.log(`PENDING: ${d.message ?? "Confirmation email sent."}`);
  console.log("Nothing was deleted yet. Check your email to confirm.");
  if (d.pendingActionId) {
    console.log(`Pending action: ${d.pendingActionId}  (check it with: pking pending ${d.pendingActionId})`);
  }
  if (d.expiresAt) console.log(`Expires: ${d.expiresAt}`);
}


/**
 * A pending-email-confirmation is a success, not a failure. Command catch
 * blocks all funnel through extractApiError before exiting 1, so handle it
 * here (and in index.ts for uncaught): print the outcome and exit 0.
 */
export function exitIfPending(err: unknown): void {
  if (err instanceof PendingConfirmation) {
    printPendingConfirmation(err);
    process.exit(0);
  }
}

export function extractApiError(err: unknown): string {
  exitIfPending(err);
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    const envelope = data?.error;
    if (envelope && typeof envelope === "object") {
      const e = envelope as Record<string, unknown>;
      const msg = typeof e.message === "string" ? e.message : undefined;
      const code = typeof e.code === "string" ? e.code : undefined;
      if (msg) return code ? `${code}: ${msg}` : msg;
    }
    if (typeof envelope === "string" && envelope) return envelope;
    if (typeof data?.message === "string" && data.message) return data.message;
    return err.message;
  }
  return String(err);
}

/**
 * The typed `error` envelope object (`{ code, message, ... }`) from an
 * agent-v1 error response, or `undefined` when the error isn't shaped that
 * way (network failure, non-agent route, etc). Lets a caller branch on
 * `.code` (e.g. `LANGUAGE_NOT_ENABLED`, `LANGUAGE_LIMIT_REACHED`) to print a
 * more actionable message than the generic `extractApiError` string.
 */
export function getApiErrorEnvelope(
  err: unknown
): Record<string, unknown> | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const data = err.response?.data as Record<string, unknown> | undefined;
  const envelope = data?.error;
  return envelope && typeof envelope === "object"
    ? (envelope as Record<string, unknown>)
    : undefined;
}

/**
 * Renders the 403 a publication-create call (`POST .../blogs`) gets back
 * when `--language-code` names a code that isn't enabled on the brand's
 * language roster (`LANGUAGE_NOT_ENABLED`) or that would exceed the plan's
 * language cap (`LANGUAGE_LIMIT_REACHED`). Both collapse to agent error code
 * `FORBIDDEN` at the agent-v1 layer (see `translateInnerError` in the main
 * repo's `lib/agent/wrappers/factory.ts`) — `LANGUAGE_LIMIT_REACHED` is
 * distinguishable by the presence of `details.maxAllowed`. Returns true if
 * it handled (and printed) the error, so the caller can skip its generic
 * `extractApiError` fallback.
 */
interface CannibalizationGuardMatch {
  articleId?: string;
  briefId?: string;
  title: string;
  url?: string;
  slug?: string;
  status?: string;
  similarity: number;
  matchedOn: string;
  updatedAt?: string;
  wordCount?: number;
}

interface CannibalizationGuardOutcome {
  decision: "create" | "refresh" | "blocked";
  reason: string;
  matches: CannibalizationGuardMatch[];
  targetArticleId?: string;
  conflictingBriefId?: string;
  similarity?: number;
}

/**
 * Renders the 409 a "write article" (`seo write`) or "generate blog post"
 * (`blogs generate`) call gets back when the server-side cannibalization
 * guard (docs/124-cannibalization-guard in the main repo) blocks the write —
 * agent error `code: "VALIDATION"`, `reason: "cannibalization_guard"`,
 * `details.cannibalizationGuard` carrying the full outcome. Returns true if
 * it handled (and printed) the error, so the caller can skip its generic
 * `extractApiError` fallback and instead point the user at `blog refresh` or
 * `--force`.
 */
export function printCannibalizationGuardError(err: unknown): boolean {
  const envelope = getApiErrorEnvelope(err);
  if (!envelope) return false;
  const details = envelope.details as { cannibalizationGuard?: CannibalizationGuardOutcome } | undefined;
  const guard = details?.cannibalizationGuard;
  if (!guard && envelope.reason !== "cannibalization_guard") return false;
  if (!guard) {
    console.error(`ERROR: ${(envelope.message as string) ?? "Cannibalization guard blocked this request."}`);
    return true;
  }

  const top = guard.matches?.[0];
  if (guard.decision === "blocked") {
    console.error(
      `ERROR: An in-flight brief already covers this keyword — wait for it or edit that brief instead.`
    );
    if (guard.conflictingBriefId) console.error(`  Conflicting brief: ${guard.conflictingBriefId}`);
  } else if (top) {
    const ref = top.url ?? top.slug ?? top.articleId ?? "(unknown)";
    const suggestion =
      guard.decision === "refresh"
        ? `run \`pking blog refresh ${guard.targetArticleId ?? top.articleId ?? "<blogId>"}\` or pass --force to write anyway`
        : `pass --force to write anyway`;
    console.error(`ERROR: An article on this keyword already exists: "${top.title}" (${ref}) — ${suggestion}.`);
  } else {
    console.error(`ERROR: ${guard.reason ?? envelope.message ?? "Cannibalization guard blocked this request."}`);
  }
  return true;
}

export function printLanguageGateError(err: unknown, languageCode: string | undefined): boolean {
  if (!languageCode) return false;
  const envelope = getApiErrorEnvelope(err);
  if (!envelope || envelope.code !== "FORBIDDEN") return false;
  const details = envelope.details as { maxAllowed?: number; current?: number } | undefined;
  console.error(`ERROR: ${envelope.message ?? "Forbidden."}`);
  if (details?.maxAllowed !== undefined) {
    console.error(`  Plan limit: ${details.current ?? "?"}/${details.maxAllowed} languages enabled.`);
    console.error(`  Run 'pking brand languages' to see what's enabled, or upgrade to raise the limit.`);
  } else {
    console.error(`  Hint: enable this language first — 'pking brand languages --add ${languageCode}'.`);
  }
  return true;
}

/**
 * Renders the agent-v1 `INSUFFICIENT_CREDITS` (HTTP 402) envelope as CLI lines:
 * what the action costs, the current balance, how many items would fit, and how
 * to top up. Returns null when the envelope isn't an insufficient-credits error.
 * Server contract: docs/134-credit-metering (details: { action, needed, balance,
 * affordableCount, topUpUrl }).
 */
export function formatInsufficientCreditsLines(
  envelope: Record<string, unknown> | undefined,
  baseUrl?: string
): string[] | null {
  if (!envelope || envelope.code !== "INSUFFICIENT_CREDITS") return null;
  const details = (envelope.details ?? {}) as {
    action?: unknown;
    needed?: unknown;
    balance?: unknown;
    affordableCount?: unknown;
    topUpUrl?: unknown;
  };
  const lines = [`ERROR: Not enough credits${typeof envelope.message === "string" && envelope.message ? ` - ${envelope.message}` : "."}`];
  if (typeof details.needed === "number") {
    const action = typeof details.action === "string" && details.action ? ` for ${details.action}` : "";
    const balance = typeof details.balance === "number" ? `, balance ${details.balance}` : "";
    lines.push(`  Cost: ${details.needed} credits${action}${balance}.`);
  }
  if (typeof details.affordableCount === "number" && details.affordableCount > 0) {
    lines.push(`  Your balance covers ${details.affordableCount} of the requested items - re-run with fewer.`);
  }
  const topUp =
    typeof details.topUpUrl === "string" && details.topUpUrl.startsWith("/") && baseUrl
      ? `${baseUrl.replace(/\/+$/, "")}${details.topUpUrl}`
      : typeof details.topUpUrl === "string"
        ? details.topUpUrl
        : undefined;
  lines.push("  Top up: `pking billing packs` then `pking billing topup <packSku>`" + (topUp ? `, or open ${topUp}` : "."));
  return lines;
}

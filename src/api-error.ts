import axios from "axios";

export function extractApiError(err: unknown): string {
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

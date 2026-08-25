export const DEFAULT_API_URL = "https://try.postking.app";
export const DEFAULT_AI_DETECTION_URL = "http://127.0.0.1:5001"; // Keep local if it's a separate microservice
export const POLL_INTERVAL_MS = 5000;
export const MAX_POLL_ATTEMPTS = 180; // 15 mins for login/polling
export const REQUEST_TIMEOUT_MS = 120000; // 2 mins

/**
 * Canonical content-language codes accepted by `--language` on generation
 * commands and by `pking brand language --set` (PostKing feature 104 —
 * multilingual). Must match `src/const/languages.ts`
 * (`SUPPORTED_LANGUAGE_CODES`) in the main repo — that module is the single
 * source of truth for this list; keep in sync if it ever changes. BCP-47
 * codes, canonical casing (`pt-BR`, not `pt_br`).
 *
 * This is the ONLY place the vocabulary is written down in this repo.
 * `pking brand language` prefers the `supported` array the server returns
 * over this constant when it has one.
 */
export const SUPPORTED_LANGUAGE_CODES = ["en", "es", "pt-BR", "de", "fr", "cs"] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

/** Reusable `--language` help text so every command words it identically. */
export const LANGUAGE_FLAG_DESCRIPTION =
  `Content language override (${SUPPORTED_LANGUAGE_CODES.join(", ")}). Omit to use the brand's content language.`;

/**
 * Pure form of `validateLanguageFlag` — returns the canonical code, or `null`
 * when the value is not a supported language. `undefined` in means
 * `undefined` out: "caller passed no flag" must stay distinguishable from
 * "caller asked for en", because the server deliberately has no default on
 * its `language` field.
 *
 * Case- and separator-insensitive (accepts `PT_BR`, `pt-br`, …) but it does
 * NOT widen unsupported regional variants the way the server's
 * `coerceLanguage` does — a CLI caller typing `pt-PT` gets told the code is
 * unsupported instead of silently receiving Brazilian Portuguese.
 */
export function parseLanguageFlag(
  raw: string | undefined
): SupportedLanguageCode | null | undefined {
  if (raw === undefined) return undefined;
  const normalized = raw.trim().replace(/_/g, "-").toLowerCase();
  const match = SUPPORTED_LANGUAGE_CODES.find(
    (code) => code.toLowerCase() === normalized
  );
  return match ?? null;
}

/**
 * Validates a `--language` flag value against the canonical list, exiting with
 * a clear message that lists the valid codes rather than letting the server
 * 400 on garbage. Returns the canonical code, or `undefined` when the flag was
 * not passed at all (so the body key stays absent).
 */
export function validateLanguageFlag(
  raw: string | undefined
): SupportedLanguageCode | undefined {
  const parsed = parseLanguageFlag(raw);
  if (parsed === null) {
    console.error(
      `ERROR: --language must be one of: ${SUPPORTED_LANGUAGE_CODES.join(", ")} (got "${raw}")`
    );
    process.exit(1);
  }
  return parsed ?? undefined;
}

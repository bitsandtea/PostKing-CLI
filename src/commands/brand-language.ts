import { createClient } from "../client";
import { getApiUrl, getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError } from "../api-error";
import { SUPPORTED_LANGUAGE_CODES, parseLanguageFlag } from "../constants";

// ─── Content language ────────────────────────────────────────────────────────
// The brand's generation language (PostKing feature 104). Stored at
// brandSettings.contentLanguage and consulted by every generator; a per-call
// `--language` flag on a generation command overrides it for that call only.
// Wraps GET/PUT /api/agent/v1/brands/{brandId}/content-language.
//
// Changing it affects NEW generations only — nothing already generated is
// translated, and SEO markets keep whatever language they were pulled for.

export interface LanguageDescriptor {
  code: string;
  endonym: string;
  english: string;
  direction?: string;
  script?: string;
}

interface ContentLanguageResponse {
  language: string;
  supported: LanguageDescriptor[];
}

interface ContentLanguagePutResponse {
  ok?: boolean;
  language: string;
  changed?: boolean;
}

const ROUTE = (brandId: string) =>
  `/api/agent/v1/brands/${brandId}/content-language`;

async function promptLine(question: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function label(d: LanguageDescriptor): string {
  return d.english && d.english !== d.endonym
    ? `${d.endonym} (${d.english})`
    : d.endonym || d.code;
}

function renderLanguage(res: ContentLanguageResponse, brandId: string): void {
  const supported = res.supported ?? [];
  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`CONTENT LANGUAGE: ${brandId}`);
  console.log(divider);
  const current = supported.find((d) => d.code === res.language);
  console.log(`CURRENT:   ${res.language}${current ? `  — ${label(current)}` : ""}`);
  console.log("\nSUPPORTED:");
  if (supported.length > 0) {
    supported.forEach((d) => {
      const mark = d.code === res.language ? "[x]" : "[ ]";
      console.log(`  ${mark} ${d.code.padEnd(6)} ${label(d)}`);
    });
  } else {
    // Server didn't send descriptors — fall back to the local vocabulary.
    SUPPORTED_LANGUAGE_CODES.forEach((code) => {
      const mark = code === res.language ? "[x]" : "[ ]";
      console.log(`  ${mark} ${code}`);
    });
  }
  console.log("\nApplies to NEW generations only — nothing already generated is translated.");
  console.log("Override a single call with '--language <code>' on a generate command.");
  console.log(divider + "\n");
}

/**
 * Resolves a user-supplied code against the server's `supported` list when we
 * have one (so a newly-added language works before this CLI is republished),
 * falling back to the compiled-in vocabulary. Returns the canonical code or
 * null.
 */
export function resolveCode(raw: string, supported: LanguageDescriptor[]): string | null {
  const normalized = raw.trim().replace(/_/g, "-").toLowerCase();
  const fromServer = supported.find((d) => d.code.toLowerCase() === normalized);
  if (fromServer) return fromServer.code;
  if (supported.length > 0) return null;
  return parseLanguageFlag(raw) ?? null;
}

function codeList(supported: LanguageDescriptor[]): string {
  return supported.length > 0
    ? supported.map((d) => d.code).join(", ")
    : SUPPORTED_LANGUAGE_CODES.join(", ");
}

export async function brandLanguageCommand(
  brandIdArg: string | undefined,
  options: { json?: boolean; set?: string }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error("ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass <brandId>.");
    process.exit(1);
    return;
  }

  // Cheap client-side rejection before any network call, so an obvious typo
  // never becomes a write. The authoritative check is against the `supported`
  // list below.
  if (options.set !== undefined && options.set.trim().length === 0) {
    console.error(`ERROR: --set requires a language code. Allowed: ${SUPPORTED_LANGUAGE_CODES.join(", ")}. Example: --set cs`);
    process.exit(1);
    return;
  }

  // Fetch current (needed in every path — it also carries `supported`).
  let res: ContentLanguageResponse;
  try {
    const r = await client.get(ROUTE(brandId));
    res = r.data as ContentLanguageResponse;
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
    return;
  }
  const supported = res.supported ?? [];

  const applySet = async (raw: string): Promise<void> => {
    const code = resolveCode(raw, supported);
    if (!code) {
      console.error(`ERROR: Unknown language "${raw}". Allowed: ${codeList(supported)}. Example: --set cs`);
      process.exit(1);
      return;
    }
    try {
      const putRes = await client.put(ROUTE(brandId), { language: code });
      const data = putRes.data as ContentLanguagePutResponse;
      if (options.json) {
        console.log(JSON.stringify({ ...data, webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` }, null, 2));
        return;
      }
      console.log(
        data.changed === false
          ? `No changes. Content language is already ${data.language ?? code}.\n`
          : `SUCCESS: Content language set to ${data.language ?? code}.\n`
      );
      const after = await client.get(ROUTE(brandId));
      renderLanguage(after.data as ContentLanguageResponse, brandId);
      printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
  };

  // Non-interactive override: --set cs
  if (options.set !== undefined) {
    await applySet(options.set);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ ...res, webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` }, null, 2));
    return;
  }

  renderLanguage(res, brandId);

  console.log("Enter the language code to generate in.");
  console.log("Press Enter to keep the current one. Examples:");
  console.log("  cs");
  console.log("  pt-BR");
  const answer = (await promptLine("> ")).trim();
  if (!answer) {
    console.log("No changes. Content language unchanged.\n");
    printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
    return;
  }
  await applySet(answer);
}

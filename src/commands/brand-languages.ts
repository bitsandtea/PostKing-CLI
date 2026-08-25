import { createClient } from "../client";
import { getApiUrl, getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError } from "../api-error";
import { SUPPORTED_LANGUAGE_CODES } from "../constants";

// ─── Brand languages (110-multilingual-brand) ─────────────────────────────────
// The SET of languages a brand publishes in — distinct from `brand language`
// (feature 104), which reads/sets only the single DEFAULT language. A brand
// can now enable more than one language, each with its own keyword research,
// blog, and landing pages; the default sits at the domain root with no URL
// prefix, every other enabled language sits under /{languageCode}.
// Wraps GET/POST/DELETE /api/agent/v1/brands/{brandId}/languages.

interface BrandLanguagesResponse {
  defaultLanguage: string;
  languages: string[];
  maxAllowed: number;
}

const ROUTE = (brandId: string) => `/api/agent/v1/brands/${brandId}/languages`;

function webUrlFor(brandId: string): { webUrl: string } {
  return { webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` };
}

function renderLanguages(res: BrandLanguagesResponse, brandId: string): void {
  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`BRAND LANGUAGES: ${brandId}`);
  console.log(divider);
  console.log(`DEFAULT:   ${res.defaultLanguage}  (domain root, no URL prefix)`);
  console.log(`\nENABLED (${res.languages.length}/${res.maxAllowed}):`);
  res.languages.forEach((code) => {
    const isDefault = code === res.defaultLanguage;
    console.log(`  ${isDefault ? "[default]" : "         "} ${code}${isDefault ? "" : `  (/${code.toLowerCase()})`}`);
  });
  if (res.languages.length >= res.maxAllowed) {
    console.log(`\nAt plan limit (${res.maxAllowed}). Upgrade to enable more languages.`);
  }
  console.log("\nUse --add <code> to enable a language, --remove <code> to disable one.");
  console.log("The default language cannot be removed here — see 'pking brand language' to change it.");
  console.log(divider + "\n");
}

function normalizeCode(raw: string): string | null {
  const normalized = raw.trim().replace(/_/g, "-").toLowerCase();
  const match = SUPPORTED_LANGUAGE_CODES.find((c) => c.toLowerCase() === normalized);
  return match ?? null;
}

export async function brandLanguagesCommand(
  brandIdArg: string | undefined,
  options: { json?: boolean; add?: string; remove?: string }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error("ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass <brandId>.");
    process.exit(1);
    return;
  }

  if (options.add && options.remove) {
    console.error("ERROR: Pass --add or --remove, not both.");
    process.exit(1);
    return;
  }

  if (options.add !== undefined) {
    const code = normalizeCode(options.add);
    if (!code) {
      console.error(`ERROR: Unknown language "${options.add}". Allowed: ${SUPPORTED_LANGUAGE_CODES.join(", ")}. Example: --add cs`);
      process.exit(1);
      return;
    }
    try {
      const putRes = await client.post(ROUTE(brandId), { language: code });
      const data = putRes.data as BrandLanguagesResponse;
      if (options.json) {
        console.log(JSON.stringify({ ...data, ...webUrlFor(brandId) }, null, 2));
        return;
      }
      console.log(
        data.languages.includes(code)
          ? `SUCCESS: "${code}" is now enabled for this brand.\n`
          : `"${code}" was not added — see the response below.\n`
      );
      renderLanguages(data, brandId);
      printWebUrl(webUrlFor(brandId));
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
    return;
  }

  if (options.remove !== undefined) {
    const code = normalizeCode(options.remove);
    if (!code) {
      console.error(`ERROR: Unknown language "${options.remove}". Allowed: ${SUPPORTED_LANGUAGE_CODES.join(", ")}. Example: --remove cs`);
      process.exit(1);
      return;
    }
    try {
      const delRes = await client.delete(`${ROUTE(brandId)}?language=${encodeURIComponent(code)}`);
      const data = delRes.data as BrandLanguagesResponse;
      if (options.json) {
        console.log(JSON.stringify({ ...data, ...webUrlFor(brandId) }, null, 2));
        return;
      }
      console.log(
        data.languages.includes(code)
          ? `"${code}" was not removed — it may be the brand's default language.\n`
          : `SUCCESS: "${code}" is now disabled for this brand.\n`
      );
      renderLanguages(data, brandId);
      printWebUrl(webUrlFor(brandId));
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
    return;
  }

  // No flags — read-only.
  try {
    const res = await client.get(ROUTE(brandId));
    const data = res.data as BrandLanguagesResponse;
    if (options.json) {
      console.log(JSON.stringify({ ...data, ...webUrlFor(brandId) }, null, 2));
      return;
    }
    renderLanguages(data, brandId);
    printWebUrl(webUrlFor(brandId));
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

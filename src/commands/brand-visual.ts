/**
 * pking brand visual — visual identity setup for an active brand.
 *
 * Mirrors the web onboarding step in
 * components/dashboard/onboarding/VisualIdentitySetup.tsx:
 *   1. PATCH /api/brands/{brandId}/settings   — set logo + colors
 *   2. POST  /api/brands/{brandId}/assets/import-urls — batch-import images
 *
 * Both PATCHes flow through agent v1 wrappers:
 *   - /api/agent/v1/brands/{brandId}    (PATCH with { brandSettings: {...} })
 *   - /api/agent/v1/brands/{brandId}/assets/import-urls (POST { urls: [...] })
 *
 * Headless: every value is a flag, no prompts.
 */
import fs from "fs";
import path from "path";
import { extractApiError } from "../api-error";
import { createClient } from "../client";
import { getApiUrl, getBrandId } from "../config";
import { printWebUrl } from "../output";

interface BrandVisualSetOptions {
  logo?: string;
  symbolLight?: string;
  symbolDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  primaryFont?: string;
  secondaryFont?: string;
  json?: boolean;
}

interface BrandVisualImportOptions {
  urls?: string;
  fromFile?: string;
  json?: boolean;
}

const HEX_RE = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function requireBrand(brandIdArg: string | undefined): string {
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error(
      "ERROR: No brand id supplied and no active brand set. Pass [brandId] or run 'pking brand set <brandId>'."
    );
    process.exit(1);
  }
  return brandId;
}

function normalizeHex(value: string, label: string): string {
  if (!HEX_RE.test(value)) {
    console.error(
      `ERROR: --${label} must be a 3- or 6-char hex color (e.g. #FF6B35).`
    );
    process.exit(1);
  }
  return value.startsWith("#") ? value : `#${value}`;
}

export async function brandVisualSetCommand(
  brandIdArg: string | undefined,
  options: BrandVisualSetOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(brandIdArg);

  const logo: Record<string, string> = {};
  if (options.logo) logo.fullLogoLight = options.logo;
  if (options.symbolLight) logo.symbolLogoLight = options.symbolLight;
  if (options.symbolDark) logo.symbolLogoDark = options.symbolDark;

  const colors: Record<string, string> = {};
  if (options.primaryColor) colors.primary = normalizeHex(options.primaryColor, "primary-color");
  if (options.secondaryColor) colors.secondary = normalizeHex(options.secondaryColor, "secondary-color");
  if (options.accentColor) colors.accent = normalizeHex(options.accentColor, "accent-color");

  const fonts: Record<string, string> = {};
  if (options.primaryFont) fonts.primary = options.primaryFont;
  if (options.secondaryFont) fonts.secondary = options.secondaryFont;

  const brandSettings: Record<string, unknown> = {};
  if (Object.keys(logo).length > 0) brandSettings.logo = logo;
  if (Object.keys(colors).length > 0) brandSettings.colors = colors;
  if (Object.keys(fonts).length > 0) brandSettings.fonts = fonts;

  if (Object.keys(brandSettings).length === 0) {
    console.error(
      "ERROR: Nothing to update. Pass at least one of --logo, --symbol-light, --symbol-dark, --primary-color, --secondary-color, --accent-color, --primary-font, --secondary-font."
    );
    process.exit(1);
  }

  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}`, {
      brandSettings,
    });
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    console.log("SUCCESS: Visual identity updated.\n");
    if (Object.keys(colors).length > 0) {
      console.log("Colors:");
      if (colors.primary) console.log(`  primary:   ${colors.primary}`);
      if (colors.secondary) console.log(`  secondary: ${colors.secondary}`);
      if (colors.accent) console.log(`  accent:    ${colors.accent}`);
    }
    if (Object.keys(logo).length > 0) {
      console.log("Logo:");
      if (logo.fullLogoLight) console.log(`  fullLogoLight:   ${logo.fullLogoLight}`);
      if (logo.symbolLogoLight) console.log(`  symbolLogoLight: ${logo.symbolLogoLight}`);
      if (logo.symbolLogoDark) console.log(`  symbolLogoDark:  ${logo.symbolLogoDark}`);
    }
    if (Object.keys(fonts).length > 0) {
      console.log("Fonts:");
      if (fonts.primary) console.log(`  primary:   ${fonts.primary}`);
      if (fonts.secondary) console.log(`  secondary: ${fonts.secondary}`);
    }
    console.log("\nNext step:  pking brand visual import-assets --urls <csv>");
    console.log("Then:       pking brand smart-week [brandId] --yes");
    console.log("Finally:    pking brand finalize [brandId]");
    printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}/visual-identity` });
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

function parseUrlsFromString(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseUrlsFromFile(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: File not found: ${resolved}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(resolved, "utf-8").trim();
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) {
        console.error("ERROR: --from-file JSON must be an array of URL strings.");
        process.exit(1);
      }
      return (arr as string[]).map((u) => String(u).trim()).filter(Boolean);
    } catch {
      console.error("ERROR: --from-file looks like JSON but could not be parsed.");
      process.exit(1);
    }
  }
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export async function brandVisualImportAssetsCommand(
  brandIdArg: string | undefined,
  options: BrandVisualImportOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(brandIdArg);

  if (!options.urls && !options.fromFile) {
    console.error(
      "ERROR: Pass --urls <comma-separated> or --from-file <path>."
    );
    process.exit(1);
  }
  if (options.urls && options.fromFile) {
    console.error("ERROR: Pass either --urls or --from-file, not both.");
    process.exit(1);
  }

  const urls = options.urls
    ? parseUrlsFromString(options.urls)
    : parseUrlsFromFile(options.fromFile as string);

  if (urls.length === 0) {
    console.error("ERROR: No URLs provided.");
    process.exit(1);
  }
  if (urls.length > 50) {
    console.error(
      `ERROR: Batch limit is 50 URLs; received ${urls.length}.`
    );
    process.exit(1);
  }

  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/assets/import-urls`,
      { urls }
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const imported: number = res.data.imported ?? 0;
    const total: number = res.data.total ?? urls.length;
    console.log(`SUCCESS: Imported ${imported}/${total} asset(s).`);
    const failures = (res.data.results || []).filter(
      (r: { success?: boolean }) => r.success === false
    );
    if (failures.length > 0) {
      console.log(`\n${failures.length} URL(s) failed:`);
      for (const f of failures) {
        const row = f as { url: string; error?: string };
        console.log(`  - ${row.url}  (${row.error || "unknown error"})`);
      }
    }
    console.log("\nNext step:  pking brand smart-week [brandId] --yes");
    console.log("Then:       pking brand finalize [brandId]");
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

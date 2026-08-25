import { createClient } from "../../client";
import { requireBrand, printError } from "./shared";

/**
 * SEO Market/Language Targeting (feature 96, widened by 104/110).
 *
 * A "market" is a `(location, language)` pair — e.g. Germany + German — and
 * is the prerequisite step ahead of `seo generate --language <code>` /
 * `seo research-cost <code>`: keyword research for a language pulls from
 * whatever markets are configured for it, and a language with zero
 * configured markets can't be researched at all.
 *
 * CRITICAL: `languageCode` here is the DataForSEO vocabulary, NOT PostKing's
 * content-language codes (see src/constants.ts SUPPORTED_LANGUAGE_CODES).
 * There is no "pt-BR" in this vocabulary — Brazil is locationCode 2076 +
 * languageCode "pt". Only a curated set of pairs is accepted by the server;
 * anything else 400s. Mirrors the curated list documented in the main repo's
 * types/seo-markets.ts / src/services/seo/market-settings.ts.
 */
interface SeoMarket {
  locationCode: number;
  countryCode: string;
  label: string;
  languageCode: string;
}

interface ResolvedSeoMarkets {
  isGlobal: boolean;
  markets: SeoMarket[];
}

const CURATED_MARKETS: Record<string, SeoMarket> = {
  US: { locationCode: 2840, countryCode: "US", label: "United States", languageCode: "en" },
  DE: { locationCode: 2276, countryCode: "DE", label: "Germany", languageCode: "de" },
  FR: { locationCode: 2250, countryCode: "FR", label: "France", languageCode: "fr" },
  ES: { locationCode: 2724, countryCode: "ES", label: "Spain", languageCode: "es" },
  BR: { locationCode: 2076, countryCode: "BR", label: "Brazil", languageCode: "pt" },
};

export const CURATED_MARKET_CODES = Object.keys(CURATED_MARKETS);

export const MARKET_HELP = `Curated pairs: ${CURATED_MARKET_CODES.map(
  (code) => `${code}=${CURATED_MARKETS[code].label}/${CURATED_MARKETS[code].languageCode}`
).join(", ")}.`;

function renderResolved(resolved: ResolvedSeoMarkets): void {
  if (resolved.isGlobal) {
    console.log("Global (default — single US/en pull).");
  } else {
    console.log(`Markets (${resolved.markets.length}):`);
  }
  resolved.markets.forEach((m) =>
    console.log(`  ${m.countryCode}  ${m.label}  location=${m.locationCode}  language=${m.languageCode}`)
  );
}

export async function seoMarketCommand(options: { brand?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/market-settings`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const { settings, resolved } = res.data as { settings: unknown; resolved: ResolvedSeoMarkets };
    console.log(`\nSEO markets for brand ${brandId}:`);
    if (!settings) console.log("(never configured for this brand — resolves to Global)");
    renderResolved(resolved);
    console.log(`\nConfigure with: pking seo market set --markets <codes> (or --global to revert)`);
    console.log(MARKET_HELP + "\n");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoMarketSetCommand(
  options: { brand?: string; markets?: string; global?: boolean; json?: boolean }
): Promise<void> {
  const brandId = options.brand ?? requireBrand();

  if (!options.global && !options.markets) {
    console.error("ERROR: Pass --markets <codes> (e.g. --markets DE,FR) or --global to revert to the default.");
    process.exit(1);
  }
  if (options.global && options.markets) {
    console.error("ERROR: Pass either --markets or --global, not both.");
    process.exit(1);
  }

  let body: { markets: "global" | SeoMarket[] };
  if (options.global) {
    body = { markets: "global" };
  } else {
    const codes = options.markets!.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0 || codes.length > 3) {
      console.error(`ERROR: Pass 1-3 market codes (got ${codes.length}).`);
      process.exit(1);
    }
    const markets: SeoMarket[] = [];
    for (const code of codes) {
      const market = CURATED_MARKETS[code];
      if (!market) {
        console.error(`ERROR: Unknown market code "${code}". ${MARKET_HELP}`);
        process.exit(1);
      }
      markets.push(market);
    }
    body = { markets };
  }

  const client = createClient();
  try {
    const res = await client.put(`/api/agent/v1/brands/${brandId}/seo/market-settings`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const { marketsChanged, resolved } = res.data as {
      marketsChanged: boolean;
      resolved: ResolvedSeoMarkets;
    };
    console.log(`\nSUCCESS: SEO markets ${marketsChanged ? "updated" : "unchanged"}.`);
    renderResolved(resolved);
    console.log("");
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

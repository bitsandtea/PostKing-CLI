import axios from "axios";
import { createClient } from "../client";
import { getBrandId, setConfig } from "../config";
import { extractApiError } from "../api-error";

interface Brand {
  id: string;
  name: string;
  description?: string;
  status?: string;
  tone?: string;
  audience?: string;
  audienceData?: string;
  blogContext?: string;
  themes?: Array<{ id: string; title: string; content: string; intent?: string }>;
}

interface DemographicsDetails {
  experience?: string;
  ageRange?: string;
  education?: string;
  industry?: string;
  companySize?: string;
  location?: string;
}

interface Demographics extends DemographicsDetails {
  primaryRoles?: string[];
  details?: DemographicsDetails;
}

interface AwarenessLevel {
  description?: string;
  symptoms?: string[];
  language?: string[];
  behaviors?: string[];
  concerns?: string[];
  needs?: string[];
  messaging?: string;
}

interface AudienceGroup {
  demographics?: Demographics;
  psyche?: { values?: string[]; motivations?: string[]; frustrations?: string[] };
  painPoints?: { primary?: string[]; emotional?: string[]; technical?: string[] };
  awarenessLevels?: Record<string, AwarenessLevel | undefined>;
  trustSources?: string[];
  objections?: string[];
  onlinePresence?: string[];
  events?: string[];
}

interface PositioningGroup {
  keyFeatures?: string[];
  successStories?: string[];
  problemsSolved?: string[];
  technicalAdvantages?: string[];
  founderCredibility?: string[];
  productEvolution?: string[];
  marketPosition?: string[];
  callsToAction?: string[];
}

interface AudienceEndpointResponse {
  brandId: string;
  name: string;
  websiteUrl?: string;
  lastAnalyzed?: string;
  audienceData?: AudienceGroup | null;
  blogContext?: PositioningGroup | null;
  contentModulation?: unknown;
  tone?: string;
  audience?: string;
  description?: string;
}

export async function brandListCommand(): Promise<void> {
  const client = createClient();

  try {
    const res = await client.get("/api/brands");
    const brands: Brand[] = res.data.brands || [];

    if (brands.length === 0) {
      console.log("No brands found.");
      console.log("Create your first brand at postking.app/dashboard");
      return;
    }

    const activeBrandId = getBrandId();
    console.log(`Found ${brands.length} brand(s):\n`);

    brands.forEach((brand) => {
      const isActive = activeBrandId === brand.id ? " [ACTIVE]" : "";
      console.log(`  ID:   ${brand.id}${isActive}`);
      console.log(`  Name: ${brand.name}`);
      if (brand.description) {
        console.log(`  Desc: ${brand.description}`);
      }
      console.log("");
    });

    if (!activeBrandId) {
      console.log("No active brand set. Run 'pking brand set <id>' to select one.");
    }
  } catch (err: unknown) {
    process.exit(1);
  }
}

interface BrandRevealInput {
  id: string;
  name: string;
  description?: string;
  tone?: string;
  audience?: string;
  audienceGroup?: AudienceGroup | null;
  positioning?: PositioningGroup | null;
  themes?: Array<{ id: string; title: string; content: string; intent?: string }>;
}

export function displayBrandProfile(input: BrandRevealInput): void {
  const audience = input.audienceGroup || undefined;
  const positioning = input.positioning || undefined;

  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`BRAND PROFILE: ${input.name.toUpperCase()}`);
  console.log(divider);
  console.log(`\nID:       ${input.id}`);
  if (input.description) console.log(`DESC:     ${input.description}`);

  // ─── Tone & Personality ────────────────────────────────────────────────────
  const psyche = audience?.psyche;
  const hasPsyche = !!(psyche && (psyche.values?.length || psyche.motivations?.length || psyche.frustrations?.length));
  if (input.tone || hasPsyche) {
    console.log("\n[ TONE & PERSONALITY ]");
    if (input.tone) console.log(`TONE:     ${input.tone}`);
    if (psyche?.values?.length) console.log(`VALUES:   ${psyche.values.join(", ")}`);
    if (psyche?.motivations?.length) console.log(`DRIVERS:  ${psyche.motivations.join(", ")}`);
    if (psyche?.frustrations?.length) console.log(`FEARS:    ${psyche.frustrations.join(", ")}`);
  }

  // ─── Audience Deep Dive ────────────────────────────────────────────────────
  const demographics = audience?.demographics;
  const pain = audience?.painPoints;
  const allPain = pain
    ? [...new Set([...(pain.primary || []), ...(pain.technical || []), ...(pain.emotional || [])])]
    : [];
  const hasAudienceBlock = !!(input.audience || demographics || allPain.length);
  if (hasAudienceBlock) {
    console.log("\n[ AUDIENCE DEEP DIVE ]");
    if (input.audience) console.log(`SUMMARY:  ${input.audience}`);
    if (demographics?.primaryRoles?.length) console.log(`ROLES:    ${demographics.primaryRoles.join(", ")}`);
    const dd = demographics?.details || demographics;
    if (dd?.industry) console.log(`INDUSTRY: ${dd.industry}`);
    if (dd?.companySize) console.log(`SIZE:     ${dd.companySize}`);
    if (dd?.experience) console.log(`EXP:      ${dd.experience}`);
    if (dd?.location) console.log(`LOCATION: ${dd.location}`);
    if (allPain.length) {
      console.log("\nPAIN POINTS:");
      allPain.slice(0, 8).forEach((p) => console.log(`  • ${p}`));
    }
  }

  // ─── Awareness Levels ──────────────────────────────────────────────────────
  const levels = audience?.awarenessLevels;
  if (levels && Object.keys(levels).length) {
    const entries = Object.entries(levels).filter(([, v]) => v && v.description);
    if (entries.length) {
      console.log("\n[ AWARENESS LEVELS ]");
      entries.forEach(([key, value]) => {
        const desc = (value as AwarenessLevel).description || "";
        const trimmed = desc.length > 120 ? desc.substring(0, 117) + "..." : desc;
        console.log(`  • ${key.toUpperCase()}: ${trimmed}`);
      });
    }
  }

  // ─── Market Dynamics ───────────────────────────────────────────────────────
  if (audience?.objections?.length || audience?.trustSources?.length) {
    console.log("\n[ MARKET DYNAMICS ]");
    if (audience.objections?.length) {
      console.log("OBJECTIONS:");
      audience.objections.slice(0, 3).forEach((o) => console.log(`  • ${o}`));
    }
    if (audience.trustSources?.length) {
      console.log(`TRUST:    ${audience.trustSources.join(", ")}`);
    }
  }

  // ─── Product Context ───────────────────────────────────────────────────────
  if (positioning && Object.keys(positioning).some((k) => (positioning as any)[k]?.length)) {
    console.log("\n[ PRODUCT CONTEXT ]");
    if (positioning.keyFeatures?.length) console.log(`FEATURES: ${positioning.keyFeatures.join(", ")}`);
    if (positioning.technicalAdvantages?.length) console.log(`EDGES:    ${positioning.technicalAdvantages.join(", ")}`);
    if (positioning.marketPosition?.length) console.log(`POSITION: ${positioning.marketPosition.join(", ")}`);
    if (positioning.problemsSolved?.length) console.log(`SOLVES:   ${positioning.problemsSolved.slice(0, 3).join(", ")}`);
  }

  // ─── Themes ────────────────────────────────────────────────────────────────
  if (input.themes && input.themes.length) {
    console.log("\n[ CONTENT THEMES ]");
    input.themes.forEach((t, i) => {
      const heading = `  ${i + 1}. ${t.title}${t.intent ? ` (${t.intent})` : ""}`;
      if (t.content && t.content.trim()) {
        console.log(heading);
        console.log(`     ${t.content}`);
      } else {
        console.log(heading);
      }
      if (i < input.themes!.length - 1) {
        console.log("");
      }
    });
  }

  console.log(divider + "\n");
}

/**
 * Fetches the agent v1 audience block + themes (from /api/brands?include=themes)
 * and returns the merged reveal input. Returns null with a friendly log if the
 * audience analysis hasn't run yet.
 */
async function fetchBrandReveal(
  client: ReturnType<typeof createClient>,
  brandId: string
): Promise<BrandRevealInput | null> {
  let audienceRes: AudienceEndpointResponse | null = null;
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/audience`);
    audienceRes = res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as Record<string, unknown> | undefined;
      const env = data?.error as Record<string, unknown> | undefined;
      const code = typeof env?.code === "string" ? env.code : undefined;
      if (code === "NOT_FOUND" || err.response?.status === 404) {
        console.log("\nAudience analysis hasn't run yet — try again in a minute, or rerun 'pking onboard'.");
        return null;
      }
    }
    throw err;
  }

  // Themes still live on /api/brands?include=themes
  let themes: BrandRevealInput["themes"] = [];
  let baseBrand: Brand | undefined;
  try {
    const themesRes = await client.get("/api/brands?include=themes");
    const brands: Brand[] = themesRes.data.brands || [];
    baseBrand = brands.find((b) => b.id === brandId);
    themes = baseBrand?.themes || [];
  } catch {
    // Themes are optional for the reveal; soldier on.
  }

  return {
    id: brandId,
    name: audienceRes?.name || baseBrand?.name || "Brand",
    description: audienceRes?.description || baseBrand?.description,
    tone: audienceRes?.tone || baseBrand?.tone,
    audience: audienceRes?.audience || baseBrand?.audience,
    audienceGroup: audienceRes?.audienceData || null,
    positioning: audienceRes?.blogContext || null,
    themes
  };
}

export async function brandInfoCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand list' to see available brands.");
    process.exit(1);
  }

  try {
    const reveal = await fetchBrandReveal(client, brandId);
    if (!reveal) return;
    displayBrandProfile(reveal);

    console.log("[ NEXT STEPS ]");
    console.log("");
    console.log("Posts & content");
    console.log("  pking posts generate --platform <x|linkedin|instagram|threads|facebook> --theme \"<title>\"");
    console.log("  pking posts generate-bulk");
    console.log("  pking posts calendar");
    console.log("  pking posts list");
    console.log("  pking repurpose --source-type url --target-type social --source-url \"<url>\"");
    console.log("");
    console.log("Blogs");
    console.log("  pking blogs generate");
    console.log("  pking blogs list");
    console.log("  pking blogs publish <articleId>");
    console.log("  pking publications list");
    console.log("  pking authors list");
    console.log("");
    console.log("Landing pages");
    console.log("  pking lp generate");
    console.log("  pking lp list");
    console.log("  pking lp vibe <slug>                  (AI-edit a landing page)");
    console.log("  pking lp side generate <slug>         (add side-pages)");
    console.log("  pking lp publish <slug>");
    console.log("  pking domains list");
    console.log("  pking domains add <domain>");
    console.log("");
    console.log("SEO pipeline");
    console.log("  pking seo seeds <seeds...>");
    console.log("  pking seo keywords");
    console.log("  pking seo cluster");
    console.log("  pking seo roadmap");
    console.log("  pking seo write");
    console.log("  pking seo publish");
    console.log("  pking seo stats");
    console.log("");
    console.log("Visuals");
    console.log("  pking visuals list");
    console.log("  pking visuals upload");
    console.log("  pking visuals import-url <url>");
    console.log("  pking visuals search-stock <query>");
    console.log("  pking visuals options <postId>        (pick imagery for a post)");
    console.log("  pking visuals carousel <postId>");
    console.log("");
    console.log("Audience, mix & themes");
    console.log("  pking brand info                       (re-run this reveal)");
    console.log("  pking brand mix                        (review/confirm intent mix — runs after audience-review)");
    console.log("  pking brand themes list");
    console.log("  pking brand themes edit <themeId>");
    console.log("  pking brand generate-themes --count 5");
    console.log("");
    console.log("Socials & schedule");
    console.log("  pking social check");
    console.log("  pking social connect");
    console.log("  pking weekly-schedule get");
    console.log("  pking weekly-schedule set");
    console.log("  pking trends list");
    console.log("");
    console.log("Voice (optional)");
    console.log("  pking voice list");
    console.log(`  Open https://postking.app/dashboard/brands/${reveal.id}/audience-review to set a personal voice profile`);
    console.log("");
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export function brandSetCommand(brandId: string): void {
  setConfig({ brandId });
  console.log(`SUCCESS: Active brand set to: ${brandId}`);
  console.log("All subsequent commands will use this brand workspace.");
}

export async function brandOnboardCommand(
  websiteUrl: string,
  options: { name?: string; description?: string; tone?: string; audience?: string; brandType?: string }
): Promise<void> {
  const client = createClient();
  console.log(`\n🚀 TO_AGENT: Starting brand onboarding for ${websiteUrl}...`);

  try {
    const onboardRes = await client.post("/api/agent/v1/brands/onboard", {
      websiteUrl,
      name: options.name,
      description: options.description,
      tone: options.tone,
      audience: options.audience,
      brandType: options.brandType,
    });

    const { brandId } = onboardRes.data;
    console.log(`✅ Onboarding started! Brand ID: ${brandId}`);
    console.log("PostKing is now crawling and analyzing the website in the background.");

    // Polling for status
    console.log("\nPolling analysis status...");
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 mins

    while (!isReady && attempts < maxAttempts) {
      attempts++;
      const statusRes = await client.get(`/api/agent/v1/brands/${brandId}/status`);
      const { status, phase, themesCount, isReady: ready, name } = statusRes.data;

      process.stdout.write(`\r[Attempt ${attempts}] Status: ${status} | Phase: ${phase} | Themes: ${themesCount}   `);

      if (ready || status === "completed") {
        isReady = true;
        console.log(`\n\n🎉 SUCCESS: Brand '${name}' is fully onboarded!`);

        // Auto-set as active brand
        setConfig({ brandId });
        console.log(`Brand ${brandId} is now set as your active workspace.`);

        // Grand reveal — pulls from agent v1 audience endpoint
        console.log("\n🎉 Here's what we learned about your brand\n");
        const reveal = await fetchBrandReveal(client, brandId);
        if (reveal) {
          displayBrandProfile(reveal);
          console.log(`Next step:  pking brand mediums ${brandId}    (pick channels to grow on)`);
          console.log(`Then:       pking brand mix ${brandId}        (review + confirm your content intent mix)`);
          console.log("Then:       pking brand themes                 (review content themes)");
          console.log("Then:       pking voice brand list             (review voice profiles — optional)");
          console.log("Then:       pking brand visual set --primary-color <hex> --logo <url>");
          console.log("Then:       pking brand smart-week             (generate this week's content — asks first)");
          console.log("Finally:    pking brand finalize               (mark onboarding complete)\n");
        } else {
          console.log("Next: run 'pking brand info' in a minute to see the full audience analysis.\n");
        }
        break;
      }

      if (status === "failed") {
        console.error(`\n\nERROR: Onboarding failed at phase: ${phase}`);
        process.exit(1);
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    if (!isReady) {
      console.log("\n\nOnboarding is still processing. You can check status later with 'pking brand list'");
    }

  } catch (err: any) {
    console.error(`\n\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

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

export async function brandDeleteCommand(
  brandId: string,
  options: { destructive?: boolean; json?: boolean; confirm?: string }
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }

  const client = createClient();

  // Fetch the brand to get its name for the confirmation prompt.
  let brandName: string | null = null;
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}`);
    const data = res.data || {};
    brandName = typeof data.name === "string" ? data.name : (data.brand && typeof data.brand.name === "string" ? data.brand.name : null);
  } catch (err: unknown) {
    console.error(`\nERROR: Could not fetch brand "${brandId}": ${extractApiError(err)}`);
    process.exit(1);
  }

  const expected = brandName && brandName.trim().length > 0 ? brandName : brandId;
  const tokenLabel = brandName && brandName.trim().length > 0 ? "brand name" : "brand ID";

  // Non-interactive path: --json requires --confirm <expected>.
  if (options.json) {
    if (!options.confirm) {
      console.error(`ERROR: --confirm <${tokenLabel}> is required in non-interactive mode (--json).`);
      process.exit(1);
    }
    if (options.confirm !== expected) {
      console.error(`ERROR: --confirm value does not match the ${tokenLabel}.`);
      process.exit(1);
    }
  } else if (options.confirm !== undefined) {
    // Scripted confirmation without --json: still allow skipping the prompt if it matches.
    if (options.confirm !== expected) {
      console.error(`ERROR: --confirm value does not match the ${tokenLabel}.`);
      process.exit(1);
    }
  } else {
    // Interactive confirmation.
    const answer = await promptLine(`To confirm deletion of brand "${expected}", type the ${tokenLabel} exactly:\n> `);
    if (answer !== expected) {
      console.error(`ERROR: Confirmation did not match. Aborting.`);
      process.exit(1);
    }
  }

  try {
    const res = await client.delete(`/api/agent/v1/brands/${brandId}`);
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    console.log(`SUCCESS: Brand "${expected}" deleted.`);
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── Finalize ────────────────────────────────────────────────────────────────
// Mirrors the final PATCH the web onboarding issues at the end of
// VisualIdentitySetup. Sets brandSettings.isOnboarded = true, which the web
// app also uses to gate the "onboarded" notification and dashboard banners.

export async function brandFinalizeCommand(
  brandIdArg: string | undefined,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error(
      "ERROR: No brand id supplied and no active brand set. Pass <brandId> or run 'pking brand set <brandId>'."
    );
    process.exit(1);
  }

  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/finalize`,
      {}
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    console.log(`SUCCESS: Brand ${brandId} marked as fully onboarded.`);
    console.log("");
    console.log("That's the full chain done:");
    console.log("  onboard -> mediums -> mix -> themes -> voice -> visual -> smart-week -> finalize");
    console.log("");
    console.log("If you haven't yet, generate your first week of content:");
    console.log(`  pking brand smart-week ${brandId}`);
    console.log("");
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

function cleanOptional(v?: string): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function brandCreateCommand(
  name: string,
  options: { description?: string; website?: string; tone?: string; audience?: string; brandType?: string; skipFinalize?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  if (!options.json) console.log(`\n🛠  Creating brand '${name}'...`);

  let brandId: string;
  try {
    const res = await client.post("/api/brands", {
      name,
      description: cleanOptional(options.description),
      websiteUrl: cleanOptional(options.website),
      tone: cleanOptional(options.tone),
      audience: cleanOptional(options.audience),
      brandType: cleanOptional(options.brandType),
    });
    const brand = res.data.brand;
    brandId = brand.id;
    setConfig({ brandId });
    if (!options.json) {
      console.log(`✅ SUCCESS: Brand created! ID: ${brandId}`);
      console.log(`Brand ${brandId} is now set as your active workspace.`);
    }
  } catch (err: unknown) {
    console.error(`\n\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }

  // Chain the inner /finalize route — this triggers audience-data generation
  // for manual brands (no websiteUrl) and theme auto-generation. The web
  // flow always chains this; the CLI used to skip it, leaving audience-review
  // empty for manual brands.
  if (options.skipFinalize) {
    if (options.json) {
      console.log(
        JSON.stringify({ brandId, finalized: false, finalizeStatus: "skipped" }, null, 2)
      );
    } else {
      console.log("\nSkipped audience-review kickoff (--skip-finalize). Next:");
      console.log(`  pking brand info`);
    }
    return;
  }

  try {
    const fin = await client.post(`/api/brands/${brandId}/finalize`, {});
    if (options.json) {
      console.log(
        JSON.stringify(
          { brandId, finalized: true, finalizeStatus: "ok", finalize: fin.data },
          null,
          2
        )
      );
      return;
    }
    console.log("\n🚀 Audience analysis + theme generation kicked off in background.");
    if (fin.data?.operationId) console.log(`Operation: ${fin.data.operationId}`);
    console.log("\nNext step: poll progress with 'pking jobs list' or 'pking brand info'.");
    console.log("Once ready:  pking brand mediums -> mix -> visual -> smart-week -> finalize");
  } catch (err: unknown) {
    // Brand row was created successfully — do NOT exit non-zero, or an
    // orchestrator (Hermes/OpenClaw) will retry and create a duplicate brand.
    // Surface a clear warning and the retry path instead.
    const errMsg = extractApiError(err);
    if (options.json) {
      console.log(
        JSON.stringify(
          { brandId, finalized: false, finalizeStatus: "failed", error: errMsg },
          null,
          2
        )
      );
      return;
    }
    console.warn(
      `\nWARNING: Brand ${brandId} was created, but /finalize failed: ${errMsg}`
    );
    console.warn("The brand exists and is set as your active workspace, but");
    console.warn("audience-review + theme generation did NOT kick off. To retry:");
    console.warn(`  pking brand info                   (check current state)`);
    console.warn(`  pking brand crawl-profile ${brandId} ...   (if the website crawl is missing)`);
    console.warn(`  or re-POST /api/brands/${brandId}/finalize from the dashboard.`);
  }
}

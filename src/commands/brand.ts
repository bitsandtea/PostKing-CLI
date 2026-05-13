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
    console.log("Audience & themes");
    console.log("  pking brand info                       (re-run this reveal)");
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

export async function brandThemesCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }

  try {
    const res = await client.get("/api/brands?include=themes");
    const brands: Brand[] = res.data.brands || [];
    const brand = brands.find(b => b.id === brandId);

    if (!brand || !brand.themes) {
      console.log("No themes found for this brand.");
      return;
    }

    console.log(`\n📖 CONTENT THEMES FOR: ${brand.name.toUpperCase()}\n`);
    brand.themes.forEach((t, i) => {
      console.log(`${i + 1}. [${t.id}] ${t.title.toUpperCase()} [${t.intent || "general"}]`);
      console.log(`   ${t.content}\n`);
    });
  } catch (err: unknown) {
    process.exit(1);
  }
}

export async function brandThemesEditCommand(themeId: string, options: { title?: string; content?: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }

  console.log(`\n✍️ Updating theme ${themeId}...`);

  try {
    await client.put(`/api/brands/${brandId}/themes/${themeId}`, options);
    console.log("✅ Theme updated successfully.\n");
  } catch (err: any) {
    console.error(`❌ ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function brandThemesDeleteCommand(themeId: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }

  console.log(`\n🗑 Deleting theme ${themeId}...`);

  try {
    await client.delete(`/api/brands/${brandId}/themes/${themeId}`);
    console.log("✅ Theme deleted successfully.\n");
  } catch (err: any) {
    console.error(`❌ ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function brandThemesGenerateCommand(options: { count?: string; instructions?: string; input?: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }

  let inputData = options.input;
  if (inputData && inputData.startsWith("/")) {
    try {
      const fs = await import("fs");
      inputData = fs.readFileSync(inputData, "utf8");
    } catch (e) {
      console.warn("⚠️ Could not read input file, treating as literal string.");
    }
  }

  let count = parseInt(options.count || "5", 10);
  if (count > 10) {
    console.warn(`⚠️ Maximum 10 themes can be generated at once. Adjusted count from ${count} to 10.`);
    count = 10;
  }
  console.log(`\n🛠  Requesting generation of ${count} new themes...`);

  try {
    // 1. Snapshot existing themes
    const initialRes = await client.get("/api/brands?include=themes");
    const initialBrand = (initialRes.data.brands || []).find((b: Brand) => b.id === brandId);
    const existingThemeIds = new Set(initialBrand?.themes?.map((t: any) => t.id) || []);

    // 2. Start generation
    const genRes = await client.post(`/api/brands/${brandId}/themes/generate/async`, {
      count,
      instructions: options.instructions,
      input: inputData
    });

    const { cost, remainingCredits, operationId: targetOperationId } = genRes.data;
    console.log(`✅ Request accepted! Cost: ${cost} credits | Balance: ${remainingCredits}`);
    console.log("Polling for completion...");

    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 mins

    // Wait a brief moment before first poll to let DB update
    await new Promise(r => setTimeout(r, 2000));

    while (!isReady && attempts < maxAttempts) {
      attempts++;
      
      const statusRes = await client.get(`/api/agent/v1/brands/${brandId}/status`);
      const { status, phase, themesCount, operationId: currentOperationId } = statusRes.data;

      process.stdout.write(`\r[Attempt ${attempts}] Status: ${status} | Phase: ${phase} | Themes: ${themesCount}   `);

      // ONLY proceed if the status is "completed" AND for our target operation
      const isCorrectLegacyOp = !targetOperationId && status === "completed";
      const isTargetOpFinished = targetOperationId && status === "completed" && currentOperationId === targetOperationId;

      if (isTargetOpFinished || isCorrectLegacyOp) {
        isReady = true;
        console.log(`\n\n🎉 SUCCESS: Theme generation complete!`);
        console.log(`Total themes now available: ${themesCount}\n`);
        
        // Fetch full themes list to find new ones
        const finalRes = await client.get("/api/brands?include=themes");
        const finalBrand = (finalRes.data.brands || []).find((b: Brand) => b.id === brandId);
        
        // Find new themes by comparing against original snapshot
        const newThemes = finalBrand?.themes?.filter((t: any) => !existingThemeIds.has(t.id)) || [];
        
        if (newThemes.length > 0) {
          console.log(`🆕 NEWLY GENERATED THEMES (${newThemes.length}):\n`);
          newThemes.forEach((t: any, i: number) => {
            console.log(`${i + 1}. [${t.id}] ${t.title.toUpperCase()} [${t.intent || "general"}]`);
            console.log(`   ${t.content}\n`);
          });
        } else {
          console.log("No new themes were detected in this batch.");
        }
        
        break;
      }

      if (status === "failed" || status === "error") {
        console.error(`\n\nERROR: Generation failed at phase: ${phase}`);
        process.exit(1);
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    if (!isReady) {
      console.log("\n\nStill processing. Check back later with 'pking brand themes'");
    }

  } catch (err: any) {
    console.error(`\n\n❌ ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export function brandSetCommand(brandId: string): void {
  setConfig({ brandId });
  console.log(`SUCCESS: Active brand set to: ${brandId}`);
  console.log("All subsequent commands will use this brand workspace.");
}

export async function brandOnboardCommand(websiteUrl: string, options: { name?: string }): Promise<void> {
  const client = createClient();
  console.log(`\n🚀 TO_AGENT: Starting brand onboarding for ${websiteUrl}...`);

  try {
    const onboardRes = await client.post("/api/agent/v1/brands/onboard", {
      websiteUrl,
      name: options.name
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
          console.log("Next: review the content themes with 'pking brand themes', then connect a social account with 'pking social check'.\n");
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

export async function brandCreateCommand(name: string, options: { description?: string, website?: string, tone?: string, audience?: string }): Promise<void> {
  const client = createClient();
  console.log(`\n🛠  Creating brand '${name}'...`);

  try {
    const res = await client.post("/api/brands", {
      name,
      description: options.description,
      websiteUrl: options.website,
      tone: options.tone,
      audience: options.audience
    });

    const brand = res.data.brand;
    console.log(`✅ SUCCESS: Brand created! ID: ${brand.id}`);
    
    // Auto-set as active brand
    setConfig({ brandId: brand.id });
    console.log(`Brand ${brand.id} is now set as your active workspace.`);
    console.log("\nNext step: Run 'pking brand info' to see the profile or 'pking social check' to connect accounts.");

  } catch (err: any) {
    console.error(`\n\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

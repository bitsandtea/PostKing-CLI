import { createClient } from "../client";
import { getBrandId, setConfig } from "../config";

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

export function displayBrandProfile(brand: Brand): void {
  let parsedAudience: any = {};
  let parsedContext: any = {};

  if (brand.audienceData) {
    try {
      parsedAudience = JSON.parse(brand.audienceData);
    } catch (e) {}
  }
  if (brand.blogContext) {
    try {
      parsedContext = JSON.parse(brand.blogContext);
    } catch (e) {}
  }

  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`BRAND PROFILE: ${brand.name.toUpperCase()}`);
  console.log(divider);
  console.log(`\nID:       ${brand.id}`);
  if (brand.description) console.log(`DESC:     ${brand.description}`);
  
  // ─── Tone ──────────────────────────────────────────────────────────────────
  console.log("\n[ TONE & PERSONALITY ]");
  console.log(`TONE:     ${brand.tone || "Not analyzed yet."}`);
  
  if (parsedAudience.psyche) {
    const p = parsedAudience.psyche;
    if (p.values?.length) console.log(`VALUES:   ${p.values.join(", ")}`);
    if (p.motivations?.length) console.log(`DRIVERS:  ${p.motivations.join(", ")}`);
    if (p.frustrations?.length) console.log(`FEARS:    ${p.frustrations.join(", ")}`);
  }

  // ─── Audience ──────────────────────────────────────────────────────────────
  console.log("\n[ AUDIENCE DEEP DIVE ]");
  console.log(`SUMMARY:  ${brand.audience || "Not analyzed yet."}`);
  
  if (parsedAudience.demographics) {
    const d = parsedAudience.demographics;
    if (d.primaryRoles?.length) console.log(`ROLES:    ${d.primaryRoles.join(", ")}`);
    if (d.details) {
      const details = d.details;
      if (details.industry) console.log(`INDUSTRY: ${details.industry}`);
      if (details.companySize) console.log(`SIZE:     ${details.companySize}`);
      if (details.experience) console.log(`EXP:      ${details.experience}`);
    }
  }

  if (parsedAudience.painPoints) {
    const p = parsedAudience.painPoints;
    const allPain = [...new Set([...(p.primary || []), ...(p.technical || []), ...(p.emotional || [])])];
    if (allPain.length) {
      console.log("\nPAIN POINTS:");
      allPain.forEach(pain => console.log(`  • ${pain}`));
    }
  }

  // ─── Awareness ─────────────────────────────────────────────────────────────
  if (parsedAudience.awarenessLevels) {
    console.log("\n[ AWARENESS LEVELS ]");
    const levels = parsedAudience.awarenessLevels;
    Object.entries(levels).forEach(([key, value]: [string, any]) => {
      if (value?.description) {
        console.log(`  • ${key.toUpperCase()}: ${value.description.substring(0, 100)}...`);
      }
    });
  }

  // ─── Market ────────────────────────────────────────────────────────────────
  if (parsedAudience.objections?.length || parsedAudience.trustSources?.length) {
    console.log("\n[ MARKET DYNAMICS ]");
    if (parsedAudience.objections?.length) {
      console.log("OBJECTIONS:");
      parsedAudience.objections.slice(0, 3).forEach((o: string) => console.log(`  • ${o}`));
    }
    if (parsedAudience.trustSources?.length) {
      console.log(`TRUST:    ${parsedAudience.trustSources.join(", ")}`);
    }
  }

  // ─── Product Context ───────────────────────────────────────────────────────
  if (Object.keys(parsedContext).length) {
    console.log("\n[ PRODUCT CONTEXT ]");
    if (parsedContext.keyFeatures?.length) console.log(`FEATURES: ${parsedContext.keyFeatures.join(", ")}`);
    if (parsedContext.technicalAdvantages?.length) console.log(`EDGES:    ${parsedContext.technicalAdvantages.join(", ")}`);
    if (parsedContext.marketPosition?.length) console.log(`POSITION: ${parsedContext.marketPosition.join(", ")}`);
  }

  // ─── Themes ────────────────────────────────────────────────────────────────
  if (brand.themes && brand.themes.length) {
    console.log("\n[ CONTENT THEMES ]");
    brand.themes.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.title}${t.intent ? ` (${t.intent})` : ""}`);
    });
    console.log("\n👉 Run 'pking brand themes' to see the full descriptions of these themes.");
  }

  console.log("\n[ NEXT STEPS ]");
  console.log("  1. Connect socials:   pking social connect");
  console.log("  2. Generate posts:    pking posts generate --platform x --theme 'Growth'");
  console.log("  3. Repurpose link:    pking repurpose --source-type url --target-type social --source-url '...'");
  console.log(divider + "\n");
}

export async function brandInfoCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand list' to see available brands.");
    process.exit(1);
  }

  try {
    const res = await client.get("/api/brands?include=themes,audienceData,blogContext");
    const brands: Brand[] = res.data.brands || [];
    const brand = brands.find(b => b.id === brandId);

    if (!brand) {
      console.error(`ERROR: Could not find details for brand ID: ${brandId}`);
      process.exit(1);
    }

    displayBrandProfile(brand);

  } catch (err: unknown) {
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
    console.error(`❌ ERROR: ${err.response?.data?.message || err.message}`);
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
    console.error(`❌ ERROR: ${err.response?.data?.message || err.message}`);
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
  console.log(`\n✨ Requesting generation of ${count} new themes...`);

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
    console.error(`\n\n❌ ERROR: ${err.response?.data?.error || err.message}`);
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

        // Fetch full brand details for the grand reveal
        const finalRes = await client.get("/api/brands?include=themes,audienceData,blogContext");
        const brands: Brand[] = finalRes.data.brands || [];
        const brand = brands.find(b => b.id === brandId);
        
        if (brand) {
          displayBrandProfile(brand);
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
    console.error(`\n\nERROR: ${err.response?.data?.error || err.message}`);
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
    console.error(`\n\nERROR: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}

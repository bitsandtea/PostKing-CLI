import { createClient } from "../client";
import { getBrandId } from "../config";
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
    console.log("Next step:  pking voice brand list           (review voice profiles — optional)");
    console.log("Then:       pking brand visual set           (logo + colors)");
    console.log("Then:       pking brand smart-week           (generate this week's content)");
    console.log("Finally:    pking brand finalize             (mark onboarding complete)\n");
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

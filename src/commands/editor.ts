
import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";
import { color } from "../lib/ttyOutput";
import { validateLanguageFlag } from "../constants";

export async function editorRewriteCommand(options: { text: string; voice?: string; platform?: string; language?: string }): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  console.log(`\n✍️  Rewriting content${options.voice ? ` using voice profile: ${options.voice}` : " using core writing rules"}...`);

  try {
    const platform = options.platform?.toLowerCase();
    const isCustomLength = platform?.startsWith("custom:");
    const customLimit = isCustomLength ? parseInt(platform!.split(":")[1], 10) : undefined;

    const res = await client.post(`/api/brands/${brandId}/rewrite`, {
      text: options.text,
      voiceId: options.voice,
      platform: isCustomLength ? "custom" : options.platform,
      customCharLimit: customLimit,
      language,
    });

    console.log("\n✅ REWRITTEN CONTENT:");
    console.log("------------------------------------------");
    console.log(res.data.rewrittenText);
    console.log("------------------------------------------\n");
  } catch (err: any) {
    console.error("❌ ERROR: Rewrite failed.");
    if (err.code === "ECONNABORTED") {
      console.error("Reason: Request timed out. This can happen with deep voice generation.");
    } else {
      console.error(`Reason: ${extractApiError(err)}`);
    }
    process.exit(1);
  }
}

export async function editorHumanizeCommand(options: { text: string; platform?: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  console.log("\n🧠 Smoothing out robotic phrasing...");

  try {
    const platform = options.platform?.toLowerCase();
    const isCustomLength = platform?.startsWith("custom:");
    const customLimit = isCustomLength ? parseInt(platform!.split(":")[1], 10) : undefined;

    const res = await client.post(`/api/brands/${brandId}/humanize`, {
      text: options.text,
      options: {
        platform: isCustomLength ? "custom" : options.platform,
        customCharLimit: customLimit
      }
    });

    console.log("\n🪶 HUMANIZED CONTENT:");
    console.log("------------------------------------------");
    console.log(res.data.processedText);
    console.log("------------------------------------------");

    console.log("");
  } catch (err: any) {
    console.error("❌ ERROR: Humanization failed.");
    if (err.code === "ECONNABORTED") {
      console.error("Reason: Request timed out. This can happen with deep voice generation.");
    } else {
      console.error(`Reason: ${extractApiError(err)}`);
    }
    process.exit(1);
  }
}

export async function editorAICheckCommand(options: { text: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  console.log("\n🔍 Analyzing content for machine-generated signatures...");

  try {
    const res = await client.post(`/api/brands/${brandId}/editor/ai-check`, {
      text: options.text,
    });

    const { detection, burstiness } = res.data;
    
    const isFake = detection.label === "Fake";
    const aiProb = (detection.aiProbability * 100).toFixed(1);
    const humanProb = (detection.humanProbability * 100).toFixed(1);

    console.log("\n📊 DETECTION RESULT:");
    console.log("------------------------------------------");

    if (isFake) {
      console.log(`Verdict: ${color(31, "LIKELY MACHINE-GENERATED")} (${aiProb}% probability)`);
    } else {
      console.log(`Verdict: ${color(32, "LIKELY HUMAN")} (${humanProb}% human probability)`);
    }

    console.log(`\nProbabilities:`);
    console.log(`  - Machine-generated: ${aiProb}%`);
    console.log(`  - Human-written:     ${humanProb}%`);
    
    if (burstiness) {
      console.log(`\nWriting Analysis:`);
      console.log(`  - Variation Score:  ${(burstiness.score * 100).toFixed(1)}%`);
      console.log(`  - Natural Flow:     ${burstiness.isBursty ? "✅ Good" : "⚠️ Robotic Pattern Detected"}`);
    }
    
    console.log("------------------------------------------\n");
  } catch (err: any) {
    console.error("❌ ERROR: Detection check failed.");
    console.error(extractApiError(err));
    process.exit(1);
  }
}

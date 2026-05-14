import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

// ─── Smart-week ──────────────────────────────────────────────────────────────
// Generates a full Mon-Fri week of posts across the brand's selectedMediums.
// In the web flow, this fires automatically at the end of onboarding (from
// /dashboard/brands/[brandId]/voice-profiles). In the CLI/agent flow we
// require explicit user consent — agent v1 onboarding does NOT auto-trigger.

interface MediumsResponse {
  brandId: string;
  name: string;
  lastUpdated?: string;
  selectedMediums: string[] | null;
  defaults: string[];
  supported: string[];
  isCustomized: boolean;
}

interface SmartWeekResponse {
  sessionId: string;
  totalPosts: number;
  pollUrl: string;
  creditsDeducted: number;
  source: string;
  operationId?: string | null;
}

const SMART_WEEK_ROUTE = (brandId: string) =>
  `/api/agent/v1/brands/${brandId}/posts/smart-week`;

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

export async function brandSmartWeekCommand(
  brandIdArg: string | undefined,
  options: { yes?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error("ERROR: No brand id supplied and no active brand set.");
    process.exit(1);
  }

  // Fetch brand name + mediums for the consent prompt.
  let brandName = brandId;
  let mediums: string[] = [];
  try {
    const r = await client.get(`/api/agent/v1/brands/${brandId}/mediums`);
    const data = r.data as MediumsResponse;
    brandName = data.name || brandId;
    mediums = data.selectedMediums ?? data.defaults;
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
    return;
  }

  if (mediums.length === 0) {
    console.error("ERROR: No mediums selected. Run 'pking brand mediums' first.");
    process.exit(1);
    return;
  }

  // Estimated time: roughly 30s/post (conservative); 3 posts/medium + 1 blog
  // if blog is selected. Rough order-of-magnitude — exact number depends on
  // credits + asset orchestration.
  const hasBlog = mediums.includes("blog");
  const socialCount = mediums.filter((m) => m !== "blog").length;
  const estPosts = socialCount * 3 + (hasBlog ? 1 : 0);
  const estMinutes = Math.max(2, Math.round((estPosts * 30) / 60));

  if (!options.yes) {
    console.log("");
    console.log(`This will generate a week of posts for ${brandName} across:`);
    mediums.forEach((m) => console.log(`  • ${m}`));
    console.log(`Estimated: ~${estPosts} posts, ~${estMinutes} min (runs in background).`);
    console.log("Credits will be deducted from this brand's balance.");
    console.log("");
    const answer = (await promptLine("Generate now? [y/N] ")).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted. No content generated.\n");
      return;
    }
  }

  try {
    const res = await client.post(SMART_WEEK_ROUTE(brandId), {
      source: "cli",
    });
    const data = res.data as SmartWeekResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log("");
    console.log(`SUCCESS: Smart-week generation started for ${brandName}.`);
    console.log(`  Session:   ${data.sessionId}`);
    console.log(`  Posts:     ${data.totalPosts}`);
    console.log(`  Credits:   ${data.creditsDeducted}`);
    if (data.operationId) console.log(`  Operation: ${data.operationId}`);
    console.log("");
    console.log("Generation runs in the background. Check progress with:");
    console.log(`  pking posts list --brand ${brandId}`);
    console.log(`  pking jobs list --brand ${brandId}`);
    console.log("");
    console.log("When you're happy with the brand setup, mark it onboarded:");
    console.log(`  pking brand finalize ${brandId}`);
    console.log("");
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

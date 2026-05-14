import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

interface IntentMix {
  educate: number;
  connect: number;
  present: number;
  intrigue: number;
}

interface ContentModulation {
  intentMix?: IntentMix;
  reasoning?: string;
  [key: string]: unknown;
}

interface ContentMixResponse {
  brandId: string;
  name: string;
  lastUpdated?: string;
  contentModulation: ContentModulation | null;
  defaults: { intentMix: IntentMix; reasoning?: string };
  isCustomized: boolean;
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

function resolveMix(res: ContentMixResponse): { mix: IntentMix; source: "custom" | "default" } {
  const live = res.contentModulation?.intentMix;
  if (live) {
    return { mix: live, source: "custom" };
  }
  return { mix: res.defaults.intentMix, source: "default" };
}

function renderMix(res: ContentMixResponse): void {
  const { mix, source } = resolveMix(res);
  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`CONTENT INTENT MIX: ${res.name.toUpperCase()}`);
  console.log(divider);
  console.log(`SOURCE:    ${source === "custom" ? "saved on brand" : "default — never edited"}`);
  if (res.lastUpdated) console.log(`UPDATED:   ${res.lastUpdated}`);
  console.log("");
  const rows: Array<[string, number, string]> = [
    ["Educate ", mix.educate,  "Tips, insights, industry knowledge"],
    ["Connect ", mix.connect,  "Community + relationship-building"],
    ["Present ", mix.present,  "Product, promotional, value props"],
    ["Intrigue", mix.intrigue, "Wildcard / curiosity / hot takes"],
  ];
  for (const [label, pct, desc] of rows) {
    const bar = "█".repeat(Math.round(pct / 2)).padEnd(50);
    console.log(`  ${label} ${String(pct).padStart(3)}%  ${bar}  ${desc}`);
  }
  const sum = mix.educate + mix.connect + mix.present + mix.intrigue;
  console.log("");
  console.log(`  TOTAL    ${String(sum).padStart(3)}%   (must sum to 100)`);
  if (res.contentModulation?.reasoning) {
    console.log("");
    console.log(`REASONING: ${res.contentModulation.reasoning}`);
  }
  console.log(divider + "\n");
}

async function promptAcceptMixChoice(): Promise<"accept" | "edit" | "reject"> {
  const answer = (await promptLine("Accept this mix? [y/edit/n] ")).trim().toLowerCase();
  if (answer === "" || answer === "y" || answer === "yes") return "accept";
  if (answer === "e" || answer === "edit") return "edit";
  return "reject";
}

export async function brandMixCommand(
  brandIdArg: string | undefined,
  options: { json?: boolean; set?: string }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error("ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass <brandId>.");
    process.exit(1);
  }

  // Non-interactive override: --set <json>
  if (options.set !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(options.set);
    } catch (err) {
      console.error(`ERROR: --set value is not valid JSON: ${(err as Error).message}`);
      process.exit(1);
    }
    if (!parsed || typeof parsed !== "object") {
      console.error("ERROR: --set must be a JSON object (e.g. '{\"intentMix\":{\"educate\":30,\"connect\":20,\"present\":35,\"intrigue\":15}}').");
      process.exit(1);
    }
    try {
      const res = await client.patch(`/api/agent/v1/brands/${brandId}/content-mix`, parsed);
      if (options.json) {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.log("SUCCESS: Content mix updated.\n");
        // Re-fetch + display
        const after = await client.get(`/api/agent/v1/brands/${brandId}/content-mix`);
        renderMix(after.data as ContentMixResponse);
        console.log("Next step:  pking brand themes\n");
    console.log("Then:       pking voice brand list              (review voice profiles — optional)");
    console.log("Then:       pking brand visual set              (logo + colors)");
    console.log("Then:       pking brand smart-week              (generate this week's content)");
    console.log("Finally:    pking brand finalize                (mark onboarding complete)\n");
      }
      return;
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
  }

  // Fetch current
  let res: ContentMixResponse;
  try {
    const r = await client.get(`/api/agent/v1/brands/${brandId}/content-mix`);
    res = r.data as ContentMixResponse;
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  renderMix(res);

  const choice = await promptAcceptMixChoice();
  if (choice === "accept") {
    const { source } = resolveMix(res);
    if (source === "default") {
      // Persist the default so the brand has an explicit mix on record.
      try {
        await client.patch(`/api/agent/v1/brands/${brandId}/content-mix`, {
          intentMix: res.defaults.intentMix,
        });
      } catch (err) {
        console.error(`\nERROR: Could not save mix: ${extractApiError(err)}`);
        process.exit(1);
      }
      console.log("SUCCESS: Default mix saved to brand.\n");
    } else {
      console.log("SUCCESS: Mix accepted as-is (no changes saved).\n");
    }
    console.log("Next step:  pking brand themes\n");
    console.log("Then:       pking voice brand list              (review voice profiles — optional)");
    console.log("Then:       pking brand visual set              (logo + colors)");
    console.log("Then:       pking brand smart-week              (generate this week's content)");
    console.log("Finally:    pking brand finalize                (mark onboarding complete)\n");
    return;
  }
  if (choice === "edit") {
    const currentMix = resolveMix(res).mix;
    console.log("\nTo edit the mix, re-run with --set passing a JSON object.");
    console.log("Example (single line):");
    console.log(`  pking brand mix ${brandId} --set '${JSON.stringify({ intentMix: currentMix })}'\n`);
    console.log("Schema:");
    console.log(`  { "intentMix": { "educate": <n>, "connect": <n>, "present": <n>, "intrigue": <n> } }`);
    console.log("  (values are percentages 0–100 and must sum to 100)\n");
    console.log("Current mix as JSON:");
    console.log(JSON.stringify({ intentMix: currentMix }, null, 2));
    console.log("");
    return;
  }
  console.log("Aborted. Mix not changed.\n");
}

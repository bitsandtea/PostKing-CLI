import { createClient } from "../client";
import { getApiUrl, getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError } from "../api-error";
import { printNextStep } from "../lib/onboardChain";

// ─── Mediums ─────────────────────────────────────────────────────────────────
// "Mediums" = the social/content channels the brand wants to grow. Stored at
// brandSettings.selectedMediums; consumed by the smart-week engine and the
// weekly scheduler. Wraps GET/PATCH /api/agent/v1/brands/{brandId}/mediums.

// Client-side allowlist for pre-validation (defense-in-depth; server is authoritative).
const SUPPORTED_MEDIUMS = [
  "instagram",
  "facebook",
  "x/twitter",
  "linkedin",
  "threads",
  "pinterest",
  "youtube",
  "blog",
  "newsletter",
  "reddit",
  "landing-pages",
  "seo",
] as const;

interface MediumsResponse {
  brandId: string;
  name: string;
  lastUpdated?: string;
  selectedMediums: string[] | null;
  defaults: string[];
  supported: string[];
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

function renderMediums(res: MediumsResponse): void {
  const current = res.selectedMediums ?? res.defaults;
  const source = res.selectedMediums ? "saved on brand" : "default — never edited";
  const divider = "=".repeat(64);
  console.log("\n" + divider);
  console.log(`MEDIUMS: ${res.name.toUpperCase()}`);
  console.log(divider);
  console.log(`SOURCE:    ${source}`);
  if (res.lastUpdated) console.log(`UPDATED:   ${res.lastUpdated}`);
  console.log("\nENABLED:");
  current.forEach((m) => console.log(`  • ${m}`));
  console.log("\nALL SUPPORTED MEDIUMS:");
  res.supported.forEach((m) => {
    const enabled = current.includes(m) ? "[x]" : "[ ]";
    console.log(`  ${enabled} ${m}`);
  });
  console.log(divider + "\n");
}

function parseMediumsCsv(csv: string, supported: readonly string[]): string[] {
  const items = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!supported.includes(item)) {
      throw new Error(
        `Unknown medium "${item}". Supported: ${supported.join(", ")}`
      );
    }
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  if (out.length === 0) {
    throw new Error("Pick at least one medium.");
  }
  return out;
}

export async function brandMediumsCommand(
  brandIdArg: string | undefined,
  options: { json?: boolean; set?: string; yes?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error("ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass <brandId>.");
    process.exit(1);
  }

  // Pre-validate --set CSV against known allowlist before any network call.
  if (options.set !== undefined) {
    const items = options.set.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
    for (const item of items) {
      if (!(SUPPORTED_MEDIUMS as readonly string[]).includes(item)) {
        console.error(`ERROR: Unknown medium "${item}". Allowed: ${SUPPORTED_MEDIUMS.join(", ")}. Example: --set "linkedin,instagram"`);
        process.exit(1);
      }
    }
    if (items.length === 0) {
      console.error(`ERROR: --set requires at least one medium. Allowed: ${SUPPORTED_MEDIUMS.join(", ")}. Example: --set "linkedin,instagram"`);
      process.exit(1);
    }
  }

  // Fetch current (needed in every path to validate against `supported`).
  let res: MediumsResponse;
  try {
    const r = await client.get(`/api/agent/v1/brands/${brandId}/mediums`);
    res = r.data as MediumsResponse;
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
    return;
  }

  // Non-interactive override: --set "linkedin,x/twitter,blog"
  if (options.set !== undefined) {
    let selected: string[];
    try {
      selected = parseMediumsCsv(options.set, res.supported);
    } catch (err) {
      console.error(`ERROR: ${(err as Error).message}`);
      process.exit(1);
      return;
    }
    try {
      const patchRes = await client.patch(
        `/api/agent/v1/brands/${brandId}/mediums`,
        { selectedMediums: selected }
      );
      if (options.json) {
        console.log(JSON.stringify({ ...patchRes.data, webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` }, null, 2));
        return;
      }
      console.log("SUCCESS: Mediums updated.\n");
      const after = await client.get(`/api/agent/v1/brands/${brandId}/mediums`);
      renderMediums(after.data as MediumsResponse);
      printNextStep("mediums");
      printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
      return;
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ ...res, webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` }, null, 2));
    return;
  }

  renderMediums(res);

  // --yes: accept the server-suggested defaults without prompting.
  if (options.yes) {
    const suggested = res.selectedMediums ?? res.defaults;
    if (!suggested || suggested.length === 0) {
      console.error("ERROR: --yes requires a suggestion or default from the server, but none was returned. Pass --set <csv> explicitly.");
      process.exit(1);
    }
    try {
      const patchRes = await client.patch(
        `/api/agent/v1/brands/${brandId}/mediums`,
        { selectedMediums: suggested }
      );
      if (options.json) {
        console.log(JSON.stringify({ ...patchRes.data, webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` }, null, 2));
        return;
      }
      console.log("SUCCESS: Mediums accepted (server default).\n");
      const after = await client.get(`/api/agent/v1/brands/${brandId}/mediums`);
      renderMediums(after.data as MediumsResponse);
      printNextStep("mediums");
      printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
    } catch (err) {
      console.error(`\nERROR: ${extractApiError(err)}`);
      process.exit(1);
    }
    return;
  }

  // L3: prompt before the URL block so it is not missed.
  console.log("Enter the comma-separated list of mediums to enable.");
  console.log("Press Enter to keep current selection. Examples:");
  console.log("  linkedin,x/twitter,instagram");
  console.log("  linkedin,blog");
  const answer = (await promptLine("> ")).trim();
  if (!answer) {
    console.log("No changes. Mediums unchanged.\n");
    printNextStep("mediums");
    printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
    return;
  }
  let selected: string[];
  try {
    selected = parseMediumsCsv(answer, res.supported);
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}`);
    process.exit(1);
    return;
  }
  try {
    await client.patch(`/api/agent/v1/brands/${brandId}/mediums`, {
      selectedMediums: selected,
    });
    console.log("SUCCESS: Mediums updated.\n");
    const after = await client.get(`/api/agent/v1/brands/${brandId}/mediums`);
    renderMediums(after.data as MediumsResponse);
    printNextStep("mediums");
    printWebUrl({ webUrl: `${getApiUrl()}/dashboard/brands/${brandId}` });
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

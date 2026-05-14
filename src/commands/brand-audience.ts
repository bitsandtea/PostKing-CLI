/**
 * pking brand audience + pking brand crawl-profile — agent surfaces for the
 * onboarding "best profile" crawl and the audience-review AI-edit flow.
 *
 * - crawl-profile : POST /api/agent/v1/brands/{brandId}/crawl-profile
 *                   Mirrors components/dashboard/onboarding/BestProfileStep.tsx.
 * - audience edit : POST /api/agent/v1/brands/{brandId}/audience-review/ai-edit
 *                   Mirrors app/dashboard/brands/{brandId}/audience-review/page.tsx.
 *                   Async — returns operationId; CLI polls
 *                   /api/agent/v1/brands/{brandId}/operations/{operationId}.
 * - audience preprompt : POST /api/agent/v1/brands/{brandId}/audience-review/ai-edit/preprompt
 *                   Synchronous — analyses a free-text prompt and returns the
 *                   sections/subsections to edit. Used by `audience edit` when
 *                   --sections is not supplied.
 *
 * All commands are headless (every value is a flag, no prompts).
 */
import { extractApiError } from "../api-error";
import { createClient } from "../client";
import { getBrandId } from "../config";

const CRAWL_PLATFORMS = ["x", "linkedin", "threads"] as const;
const PROFILE_TYPES = ["personal", "brand", "mix"] as const;

interface BrandCrawlProfileOptions {
  platform?: string;
  handle?: string;
  profileType?: string;
  toneConsent?: boolean;
  json?: boolean;
}

interface BrandAudienceEditOptions {
  instructions?: string;
  sections?: string;
  subsections?: string;
  wait?: boolean;
  timeout?: string;
  json?: boolean;
}

interface BrandAudiencePrepromptOptions {
  instructions?: string;
  json?: boolean;
}

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

export async function brandCrawlProfileCommand(
  brandIdArg: string | undefined,
  options: BrandCrawlProfileOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(brandIdArg);

  if (!options.platform) {
    console.error(
      `ERROR: --platform is required (one of ${CRAWL_PLATFORMS.join(", ")}).`
    );
    process.exit(1);
  }
  const platform = options.platform.toLowerCase();
  if (!(CRAWL_PLATFORMS as readonly string[]).includes(platform)) {
    console.error(
      `ERROR: --platform must be one of ${CRAWL_PLATFORMS.join(", ")}.`
    );
    process.exit(1);
  }

  if (!options.handle) {
    console.error("ERROR: --handle is required (the public handle or profile URL).");
    process.exit(1);
  }

  const profileType = options.profileType ?? "personal";
  if (!(PROFILE_TYPES as readonly string[]).includes(profileType)) {
    console.error(
      `ERROR: --profile-type must be one of ${PROFILE_TYPES.join(", ")}.`
    );
    process.exit(1);
  }

  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/crawl-profile`,
      {
        platform,
        rawInput: options.handle,
        profileType,
        toneConsent: options.toneConsent === true,
      }
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const { status, handle } = res.data as { status?: string; handle?: string };
    if (status === "queued") {
      console.log(`SUCCESS: Profile crawl queued for ${handle} on ${platform}.`);
      console.log("Crawl runs in the background. Audience-review will use the");
      console.log("results once it kicks off.");
    } else if (status === "deferred") {
      console.log(`OK: Profile capture stored for ${handle} on ${platform}.`);
      console.log("The crawl is deferred until an email is on file for this user");
      console.log("(see §2.3 email pre-req gate).");
    } else {
      console.log(`SUCCESS: ${JSON.stringify(res.data)}`);
    }
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

function parseSubsections(raw: string): Record<string, string[]> {
  // Format: "section:sub1,sub2|section2:sub3"
  const out: Record<string, string[]> = {};
  for (const chunk of raw.split("|").map((s) => s.trim()).filter(Boolean)) {
    const idx = chunk.indexOf(":");
    if (idx === -1) {
      console.error(
        `ERROR: --subsections chunk '${chunk}' must be 'section:sub1,sub2'.`
      );
      process.exit(1);
    }
    const section = chunk.slice(0, idx).trim();
    const subs = chunk
      .slice(idx + 1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!section || subs.length === 0) {
      console.error(`ERROR: --subsections chunk '${chunk}' is empty.`);
      process.exit(1);
    }
    out[section] = subs;
  }
  return out;
}

interface OperationStatusResponse {
  id: string;
  state: "pending" | "running" | "completed" | "failed" | string;
  errors?: Array<{ message: string }>;
  result?: unknown;
  progress?: { current: number; total: number; message?: string } | null;
}

async function pollOperation(
  brandId: string,
  operationId: string,
  timeoutSec: number
): Promise<OperationStatusResponse> {
  const client = createClient();
  const deadline = Date.now() + timeoutSec * 1000;
  let last: OperationStatusResponse | null = null;
  while (Date.now() < deadline) {
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/operations/${operationId}`
    );
    last = res.data as OperationStatusResponse;
    if (last.state === "completed" || last.state === "failed") return last;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!last) throw new Error("No operation status received");
  return last;
}

export async function brandAudienceEditCommand(
  brandIdArg: string | undefined,
  options: BrandAudienceEditOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(brandIdArg);

  if (!options.instructions) {
    console.error(
      "ERROR: --instructions is required (free-text describing the edit)."
    );
    process.exit(1);
  }

  // Resolve sections/subsections — either explicit (--sections / --subsections)
  // or auto-pick via the preprompt endpoint to mirror the web flow.
  let sections: string[];
  let subsections: Record<string, string[]> | undefined;

  if (options.sections) {
    sections = options.sections
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (sections.length === 0) {
      console.error("ERROR: --sections is empty.");
      process.exit(1);
    }
    if (options.subsections) {
      subsections = parseSubsections(options.subsections);
    }
  } else {
    try {
      const pre = await client.post(
        `/api/agent/v1/brands/${brandId}/audience-review/ai-edit/preprompt`,
        { prompt: options.instructions }
      );
      sections = (pre.data?.sections as string[]) ?? [];
      subsections = (pre.data?.subsections as Record<string, string[]>) ?? undefined;
      if (sections.length === 0) {
        console.error(
          "ERROR: Preprompt returned no sections. Pass --sections explicitly."
        );
        process.exit(1);
      }
    } catch (err: unknown) {
      console.error(`\nERROR: preprompt failed: ${extractApiError(err)}`);
      process.exit(1);
    }
  }

  let operationId: string = "";
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/audience-review/ai-edit`,
      {
        prompt: options.instructions,
        sections,
        subsections,
      }
    );
    operationId = res.data?.operationId;
    if (!operationId) {
      console.error("ERROR: No operationId in response.");
      if (options.json) console.log(JSON.stringify(res.data, null, 2));
      process.exit(1);
    }
    if (!options.wait) {
      if (options.json) {
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      console.log(`SUCCESS: Audience edit queued. OperationId: ${operationId}`);
      console.log(`Poll: pking jobs list  (or GET /api/agent/v1/brands/${brandId}/operations/${operationId})`);
      return;
    }
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }

  if (!operationId) {
    console.error("ERROR: No operationId resolved; cannot poll.");
    process.exit(1);
  }

  const timeoutSec = Number(options.timeout ?? "180");
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    console.error("ERROR: --timeout must be a positive number of seconds.");
    process.exit(1);
  }

  try {
    const finalOp = await pollOperation(brandId, operationId, timeoutSec);
    if (options.json) {
      console.log(JSON.stringify(finalOp, null, 2));
      return;
    }
    if (finalOp.state === "completed") {
      console.log(`SUCCESS: Audience edit completed (operationId=${operationId}).`);
    } else if (finalOp.state === "failed") {
      const msg = finalOp.errors?.[0]?.message ?? "audience edit failed";
      console.error(`ERROR: Audience edit failed: ${msg}`);
      process.exit(1);
    } else {
      console.log(
        `OK: Operation still ${finalOp.state} after ${timeoutSec}s. Re-poll via 'pking jobs list'.`
      );
    }
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function brandAudiencePrepromptCommand(
  brandIdArg: string | undefined,
  options: BrandAudiencePrepromptOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(brandIdArg);

  if (!options.instructions) {
    console.error("ERROR: --instructions is required.");
    process.exit(1);
  }

  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/audience-review/ai-edit/preprompt`,
      { prompt: options.instructions }
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    const sections = (res.data?.sections as string[]) ?? [];
    const subsections = (res.data?.subsections as Record<string, string[]>) ?? {};
    console.log("Auto-picked sections:");
    for (const s of sections) {
      const subs = subsections[s];
      if (subs && subs.length > 0) {
        console.log(`  - ${s}: ${subs.join(", ")}`);
      } else {
        console.log(`  - ${s}`);
      }
    }
    console.log(
      "\nUse these with: pking brand audience edit --instructions '<text>' --sections '<csv>' [--subsections 'section:sub1,sub2|section2:sub3']"
    );
  } catch (err: unknown) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

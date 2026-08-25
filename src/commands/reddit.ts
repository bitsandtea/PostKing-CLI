import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";
import { color, tickLine } from "../lib/ttyOutput";

const VALID_LENGTHS = ["short", "medium", "long"];
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

function requireBrand(options: { brand?: string }): string {
  const brandId = options.brand ?? getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first, or pass --brand <id>.");
    process.exit(1);
  }
  return brandId;
}

function stripSubredditPrefix(name: string): string {
  return name.replace(/^\/?r\//i, "").trim();
}

interface RedditRewriteOptions {
  subreddit: string;
  seed?: string;
  blog?: string;
  title?: string;
  angle?: string;
  length?: string;
  voice?: string;
  variations?: string;
  repeat?: string;
  json?: boolean;
  brand?: string;
}

interface RedditPostOutputData {
  redditTitle?: string;
  body?: string;
  notes?: string;
  wordCount?: number;
  angle?: string;
  length?: string;
  subreddit?: string;
  variationIndex?: number;
}

function extractComplianceLine(notes?: string): string | undefined {
  if (!notes) return undefined;
  const line = notes.split("\n").find((l) => l.trim().startsWith("Compliance:"));
  return line?.trim();
}

function printPost(post: { id: string }, outputData: RedditPostOutputData, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(outputData, null, 2));
    return;
  }

  const complianceLine = extractComplianceLine(outputData.notes);

  console.log(`\n--- Post ${post.id} ---`);
  console.log(`Subreddit:  r/${outputData.subreddit ?? "?"}`);
  console.log(`Title:      ${outputData.redditTitle ?? "(none)"}`);
  console.log(`Word count: ${outputData.wordCount ?? "?"}`);
  if (complianceLine) {
    const isClean = /^Compliance:\s*passed\.?$/i.test(complianceLine);
    console.log(color(isClean ? 32 : 33, complianceLine));
  }
  if (outputData.notes) {
    console.log(`\nNotes:\n${outputData.notes}`);
  }
  console.log(`\nBody:\n${outputData.body ?? "(empty)"}`);
}

/** Runs a single rewrite kickoff + poll + result-print cycle. Returns true on success. */
async function runRewriteOnce(
  client: ReturnType<typeof createClient>,
  brandId: string,
  body: Record<string, unknown>,
  options: { json?: boolean }
): Promise<boolean> {
  let jobId: string;
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/reddit/rewrite`, body);
    jobId = res.data.jobId;
    if (res.data.subredditNotice) {
      console.log(`\n${res.data.subredditNotice}`);
    }
    console.log(`Job: ${jobId}. Polling for results...`);
  } catch (err) {
    console.error(`ERROR: Failed to start reddit rewrite.`);
    console.error(`Reason: ${extractApiError(err)}`);
    return false;
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let statusRes;
    try {
      statusRes = await client.get(`/api/posts/${jobId}?accessControl=status-only`);
    } catch (err) {
      console.error(`ERROR: Failed to poll job ${jobId}.`);
      console.error(`Reason: ${extractApiError(err)}`);
      return false;
    }

    const data = statusRes.data;
    const operationStatus: string = data.operationStatus ?? "PENDING";

    if (operationStatus === "COMPLETED") {
      let outputData: { saved?: { postIds: string[] }; variationCount?: number; subredditNotice?: string } = {};
      try {
        outputData = data.outputData ? JSON.parse(data.outputData) : {};
      } catch {
        // non-JSON outputData is treated as empty
      }

      if (outputData.subredditNotice) {
        console.log(`\n${outputData.subredditNotice}`);
      }

      const postIds = outputData.saved?.postIds ?? [];
      if (postIds.length === 0) {
        console.log("\nCompleted, but no posts were saved.");
        return true;
      }

      console.log(`\n✅ COMPLETE — ${postIds.length} variation(s) saved.`);

      let allOk = true;
      for (const postId of postIds) {
        try {
          const postRes = await client.get(`/api/brands/${brandId}/posts/${postId}`);
          const post = postRes.data.post;
          let postOutputData: RedditPostOutputData = {};
          try {
            postOutputData = post.outputData ? JSON.parse(post.outputData) : {};
          } catch {
            // non-JSON outputData is treated as empty
          }
          printPost(post, postOutputData, options.json);
        } catch (err) {
          console.error(`ERROR: Failed to fetch post ${postId}.`);
          console.error(`Reason: ${extractApiError(err)}`);
          allOk = false;
        }
      }
      return allOk;
    }

    if (operationStatus === "FAILED") {
      console.error(`\n❌ FAILED: ${data.errorMessage ?? "Unknown error"}`);
      return false;
    }

    tickLine(`  [${operationStatus}] waiting...`.padEnd(60));
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error(`\nERROR: Timed out waiting for job ${jobId} after ${POLL_TIMEOUT_MS / 1000}s.`);
  return false;
}

export async function redditRewriteCommand(options: RedditRewriteOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options);

  if (!options.subreddit) {
    console.error("ERROR: --subreddit is required.");
    process.exit(1);
  }

  if (!options.seed && !options.blog) {
    console.error("ERROR: Provide exactly one of --seed <text> or --blog <articleId>.");
    process.exit(1);
  }
  if (options.seed && options.blog) {
    console.error("ERROR: --seed and --blog are mutually exclusive — provide exactly one.");
    process.exit(1);
  }

  if (options.length && !VALID_LENGTHS.includes(options.length)) {
    console.error(`ERROR: --length must be one of: ${VALID_LENGTHS.join(", ")}`);
    process.exit(1);
  }

  const variations = options.variations ? parseInt(options.variations, 10) : 1;
  if (isNaN(variations) || variations < 1 || variations > 3) {
    console.error("ERROR: --variations must be a number between 1 and 3.");
    process.exit(1);
  }

  const repeat = options.repeat ? parseInt(options.repeat, 10) : 1;
  if (isNaN(repeat) || repeat < 1) {
    console.error("ERROR: --repeat must be a positive number.");
    process.exit(1);
  }

  const body: Record<string, unknown> = {
    subreddit: stripSubredditPrefix(options.subreddit),
    angle: options.angle ?? "educational",
    variations,
  };
  if (options.seed) body.sourceContent = options.seed;
  if (options.blog) body.sourcePostId = options.blog;
  if (options.title) body.sourceTitle = options.title;
  if (options.voice) body.voiceId = options.voice;
  if (options.length) body.length = options.length;

  let anyFailure = false;
  for (let i = 1; i <= repeat; i++) {
    if (repeat > 1) {
      console.log(`\n=== Run ${i}/${repeat} ===`);
    }
    const ok = await runRewriteOnce(client, brandId, body, { json: options.json });
    if (!ok) anyFailure = true;
  }

  if (anyFailure) process.exit(1);
}

interface RedditPoolOptions {
  json?: boolean;
  brand?: string;
}

export async function redditPoolCommand(options: RedditPoolOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/reddit/pool`);
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }

    const data = res.data;
    const subreddits: any[] = data.subreddits ?? data.pool ?? data.items ?? [];

    if (subreddits.length === 0) {
      console.log("No pooled subreddits found for this brand. Run 'reddit_generate_pool' first.");
      return;
    }

    console.log(`Pooled subreddits (${subreddits.length}):\n`);
    subreddits.forEach((s: any) => {
      const displayName = s.display_name ?? s.displayName ?? s.name ?? "?";
      const postingStyle = s.posting_style ?? s.postingStyle ?? "—";
      const rules = s.rules ?? s.subreddit_rules ?? s.subredditRules;
      const ruleCount = Array.isArray(rules) ? rules.length : (s.rule_count ?? s.ruleCount ?? "?");
      console.log(`  r/${displayName}`);
      console.log(`    style: ${postingStyle}`);
      console.log(`    rules: ${ruleCount}`);
    });
  } catch (err) {
    console.error(`ERROR: Failed to fetch reddit pool.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}

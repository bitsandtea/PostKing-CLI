import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError } from "../api-error";
import { color, tickLine } from "../lib/ttyOutput";
import { validateLanguageFlag } from "../constants";

const VALID_PLATFORMS = ["x", "linkedin", "facebook", "instagram", "threads"];

interface PostsCreateOptions {
  platform: string;
  content: string;
  schedule?: string;
}

interface PostsListOptions {
  status?: string;
  platform?: string;
  limit?: number;
  json?: boolean;
}

interface PostResult {
  id: string;
  platform: string;
  status: string;
  content: string;
  confirmed: boolean;
  scheduledAt?: string;
  postAt?: string;
  operationStatus?: string;
  outputData?: string;
}

export async function postsCreateCommand(options: PostsCreateOptions): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }

  const platform = options.platform.toLowerCase();
  const isCustomLength = platform.startsWith("custom:");
  
  if (!VALID_PLATFORMS.includes(platform) && !isCustomLength) {
    console.error(`ERROR: Invalid platform '${options.platform}'.`);
    console.error(`Valid platforms: ${VALID_PLATFORMS.join(", ")}, or 'custom:<char_count>'`);
    process.exit(1);
  }

  const payload: Record<string, unknown> = {
    content: options.content,
    platforms: [isCustomLength ? "custom" : platform],
    postType: options.schedule ? "scheduled" : "queue",
    customCharLimit: isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined
  };

  if (options.schedule) {
    const scheduled = new Date(options.schedule);
    if (isNaN(scheduled.getTime())) {
      console.error("ERROR: Invalid schedule date. Use ISO 8601 format, e.g. 2025-01-15T10:00:00Z");
      process.exit(1);
    }
    payload.scheduledAt = scheduled.toISOString();
  }

  try {
    const res = await client.post(`/api/brands/${brandId}/posts/manual`, payload);
    const posts: PostResult[] = res.data.posts || [];

    console.log(`SUCCESS: ${posts.length} post(s) created.\n`);
    posts.forEach((post) => {
      console.log(`  Post ID:  ${post.id}`);
      console.log(`  Platform: ${post.platform}`);
      console.log(`  Status:   ${post.status}`);
      if (post.scheduledAt || post.postAt) {
        console.log(`  Scheduled: ${post.scheduledAt || post.postAt}`);
      }
      console.log("");
    });

    console.log("Tip: Use 'pking posts approve <id>' to confirm and schedule this post.");
    process.stderr.write("Tip: attach visuals with 'pking visuals pick <postId> --platform <p>' after creation.\n");
    printWebUrl(res.data);
  } catch (err: unknown) {
    process.exit(1);
  }
}

export async function postsListCommand(options: PostsListOptions): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.platform) params.append("platform", options.platform);
    if (options.limit) params.append("limit", options.limit.toString());

    const res = await client.get(`/api/brands/${brandId}/posts?${params.toString()}`);
    const posts: PostResult[] = res.data.posts || [];

    if (options.json) {
      const nowTs = new Date();
      const enriched = {
        ...res.data,
        posts: posts.map((p) => {
          const schedTime = p.postAt || p.scheduledAt;
          const isDraft = !p.confirmed && (p.status === "DRAFT" || p.status === "CREATED");
          return { ...p, pastDue: isDraft && !!schedTime && new Date(schedTime) < nowTs };
        }),
      };
      console.log(JSON.stringify(enriched, null, 2));
      return;
    }

    if (posts.length === 0) {
      console.log("No posts found for this brand.");
      return;
    }

    console.log(`Latest posts for brand ${brandId}:\n`);
    const now = new Date();
    posts.forEach((post) => {
      const isDraft = !post.confirmed && (post.status === "DRAFT" || post.status === "CREATED");
      const schedTime = post.postAt || post.scheduledAt;
      const isPastDue = isDraft && !!schedTime && new Date(schedTime) < now;
      const statusStr = post.confirmed ? "APPROVED" : "DRAFT";
      const pastTag = isPastDue ? " [PAST]" : "";
      const schedStr = schedTime ? ` @ ${new Date(schedTime).toLocaleString()}` : "";
      console.log(`  [${statusStr}${pastTag}] ${post.id} | ${post.platform.padEnd(10)} | ${post.content.substring(0, 50).replace(/\n/g, " ")}...${schedStr}`);
    });

    console.log("\nUse 'pking posts generate' to draft a new post.");
    printWebUrl(res.data);
  } catch (err) {
    process.exit(1);
  }
}

interface PostsApproveOptions {
  variation?: string;
  schedule?: string;
  timezone?: string;
  yes?: boolean;
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

export async function postsApproveCommand(postId: string, options: PostsApproveOptions): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  if (!options.yes) {
    const answer = (await promptLine(`Approve and schedule post ${postId}? [y/N] `)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.log("Aborted.");
      return;
    }
  }

  const payload: any = {};
  if (options.variation) {
    payload.variationIndex = parseInt(options.variation, 10) - 1; // 1-based index to 0-based
    if (isNaN(payload.variationIndex)) {
      console.error("ERROR: Variation must be a valid number.");
      process.exit(1);
    }
  }

  if (options.schedule) {
    const scheduled = new Date(options.schedule);
    if (isNaN(scheduled.getTime())) {
      console.error("ERROR: Invalid schedule date. Use ISO 8601 format, e.g. 2025-01-15T10:00:00Z");
      process.exit(1);
    }
    payload.scheduledAt = scheduled.toISOString();
  }

  if (options.timezone) {
    payload.userTimezone = options.timezone;
  }

  try {
    const res = await client.patch(`/api/brands/${brandId}/posts/${postId}/confirm`, payload);
    const updatedPost = res.data.post;
    
    console.log(`SUCCESS: Post ${postId} approved and scheduled.`);
    if (updatedPost.postAt) {
      console.log(`  Scheduled for: ${new Date(updatedPost.postAt).toLocaleString()}`);
    } else {
      console.log(`  Added to automated queue.`);
    }
    printWebUrl(res.data);
  } catch (err: any) {
    console.error(`ERROR: Failed to approve post ${postId}.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function postsGenerateCommand(options: {
  platform: string;
  theme?: string;
  variations?: number;
  voice?: string;
  language?: string;
}): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  const count = options.variations || 1;
  console.log(`\n🛠  Generating ${count} variation(s) for ${options.platform}...`);
  if (options.theme) {
    console.log(`   Theme: "${options.theme}"`);
  } else {
    console.log(`   Theme: Random Theme`);
  }
  if (options.voice) console.log(`   Voice: ${options.voice}`);

  try {
    const isCuid = options.theme && options.theme.length > 20 && options.theme.startsWith("c");
    
    const platform = options.platform.toLowerCase();
    const isCustomLength = platform.startsWith("custom:");
    const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;

    const res = await client.post(`/api/brands/${brandId}/generate-content/async`, {
      medium: isCustomLength ? "custom" : options.platform,
      customCharLimit: customLimit,
      themeId: isCuid ? options.theme : undefined,
      customTheme: options.theme && !isCuid ? options.theme : undefined,
      randomTheme: !options.theme ? true : undefined,
      variationCount: count,
      voiceProfileId: options.voice,
      language,
      assignAsset: true
    });

    const { postId } = res.data;
    console.log(`   Task ID: ${postId}`);
    console.log(`   Status:  Queued. Polling for results...\n`);

    // Polling
    let finished = false;
    let attempts = 0;
    while (!finished && attempts < 60) {
      const statusRes = await client.get(`/api/brands/${brandId}/posts/${postId}`);
      const post = statusRes.data.post;
      
      const generationStatus: string = post.generationStatus ?? "pending";

      if (generationStatus === "ready") {
        finished = true;

        let outputData: any = {};
        try {
          if (post.outputData) outputData = JSON.parse(post.outputData);
        } catch {
          // non-JSON outputData is treated as empty
        }

        const variations = outputData.variations || [{ content: post.content }];

        console.log(`\n✅ GENERATION COMPLETE!\n`);
        variations.forEach((v: any, i: number) => {
          console.log(`--- Variation #${i + 1} ---`);
          console.log(v.content);
          console.log("");
        });

        console.log(`Full Post ID: ${postId}`);
        if (variations.length > 1) {
          console.log(`Tip: Use 'pking posts approve ${postId} --variation 1' to select and schedule a variation.`);
        } else {
          console.log(`Tip: Use 'pking posts approve ${postId}' to schedule this post.`);
        }
      } else if (generationStatus === "failed") {
        console.error(`\n❌ FAILED: ${post.errorMessage || "Unknown error"}`);
        process.exit(1);
      } else {
        tickLine(`   [PROCESSING] ${post.progressMessage || "Generating..."}`.padEnd(60));
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
      }
    }

    if (!finished) {
      console.log("\n⚠️ Polling timed out. The generation is still running in the background.");
      console.log(`Check again later with: pking posts list`);
    }

  } catch (err) {
    console.error("\n❌ ERROR: Failed to start generation.");
    process.exit(1);
  }
}

export async function postsCalendarCommand(options: { days?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/brands/${brandId}/posts?status=scheduled&limit=100`);
    const posts: PostResult[] = res.data.posts || [];

    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }

    if (posts.length === 0) {
      console.log(`No scheduled posts found for brand ${brandId}.`);
      return;
    }

    const days = options.days ? parseInt(options.days, 10) : 14;
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const scheduledPosts = posts
      .filter(p => p.postAt && new Date(p.postAt) <= cutoff && new Date(p.postAt) >= now)
      .sort((a, b) => new Date(a.postAt!).getTime() - new Date(b.postAt!).getTime());

    if (scheduledPosts.length === 0) {
      console.log(`No posts scheduled in the next ${days} days.`);
      return;
    }

    console.log(`\n📅 Upcoming Schedule (Next ${days} days)\n`);

    let currentDate = "";
    scheduledPosts.forEach(post => {
      const postDate = new Date(post.postAt!);
      const dateString = postDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeString = postDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      if (dateString !== currentDate) {
        currentDate = dateString;
        console.log(color(1, dateString));
        console.log("-----------------");
      }

      console.log(`  ${timeString} | [${post.platform.padEnd(8)}] ${post.content.substring(0, 50).replace(/\n/g, " ")}...`);
    });
    console.log("");
  } catch (err: any) {
    console.error("ERROR: Could not fetch schedule calendar.");
    process.exit(1);
  }
}

export async function postsViewCommand(postId: string, options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/brands/${brandId}/posts/${postId}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const post: PostResult & { assets?: any[] } = res.data.post;

    if (!post) {
      console.error(`ERROR: Post ${postId} not found.`);
      process.exit(1);
    }

    console.log(`\n📄 POST DETAILS: ${post.id}`);
    console.log(`------------------------------------------`);
    console.log(`Platform:  ${post.platform.toUpperCase()}`);
    console.log(`Status:    ${post.status.toUpperCase()}${post.confirmed ? " (APPROVED)" : " (DRAFT)"}`);
    
    const schedTime = post.postAt || post.scheduledAt;
    if (schedTime) {
      console.log(`Scheduled: ${new Date(schedTime).toLocaleString()}`);
    }

    const genStatus: string | undefined = (post as unknown as { generationStatus?: string }).generationStatus;
    console.log(`\nCONTENT:`);
    console.log(`--------`);
    if (!post.content?.trim()) {
      if (genStatus === "failed") {
        const errMsg: string | undefined = (post as unknown as { errorMessage?: string }).errorMessage;
        console.log(`(generation failed${errMsg ? `: ${errMsg}` : " — no details available"})`);
      } else if (genStatus === "ready") {
        console.log("(content is empty — post may have been cleared or never populated)");
      } else {
        // pending or running
        console.log("(generating — re-run after 'pking jobs list' shows the operation completed)");
      }
    } else {
      console.log(post.content);
    }
    console.log(`--------`);

    if (post.assets && post.assets.length > 0) {
      console.log(`\nASSETS (${post.assets.length}):`);
      post.assets.forEach((asset: any, i: number) => {
        console.log(`  ${i + 1}. ${asset.url}`);
      });
    }

    console.log("");
    printWebUrl(res.data);
  } catch (err: any) {
    console.error(`ERROR: Could not fetch post ${postId}.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}


export async function postsScheduleCommand(postId: string, options: { date: string; variation?: string; timezone?: string }): Promise<void> {
  if (!options.date) {
    console.error("ERROR: --date is required to schedule a post.");
    process.exit(1);
  }
  const scheduled = new Date(options.date);
  if (isNaN(scheduled.getTime())) {
    console.error("ERROR: Invalid date format. Use ISO 8601, e.g. 2026-05-05T14:00:00+02:00");
    process.exit(1);
  }
  return postsApproveCommand(postId, {
    variation: options.variation,
    schedule: scheduled.toISOString(),
    timezone: options.timezone,
  });
}

export async function postsCancelCommand(postId: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    await client.patch(`/api/brands/${brandId}/posts/${postId}`, { action: "cancel" });
    console.log(`SUCCESS: Post ${postId} cancelled/unapproved.`);
  } catch (err: any) {
    console.error(`ERROR: Failed to cancel post ${postId}.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function postsRescheduleCommand(postId: string, options: { date: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  if (!options.date) {
    console.error("ERROR: --date is required for reschedule.");
    process.exit(1);
  }

  const scheduled = new Date(options.date);
  if (isNaN(scheduled.getTime())) {
    console.error("ERROR: Invalid date format. Use ISO 8601, e.g. 2025-01-15T10:00:00Z");
    process.exit(1);
  }

  try {
    const res = await client.patch(`/api/brands/${brandId}/posts/${postId}`, { 
      action: "reschedule",
      scheduledAt: scheduled.toISOString()
    });
    console.log(`SUCCESS: Post ${postId} rescheduled to ${new Date(res.data.post.postAt).toLocaleString()}.`);
    printWebUrl(res.data);
  } catch (err: any) {
    console.error(`ERROR: Failed to reschedule post ${postId}.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function postsDeleteCommand(postId: string, options: { force?: boolean } = {}): Promise<void> {
  const client = createClient();

  if (!getBrandId()) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  const url = options.force
    ? `/api/agent/v1/posts/${postId}?force=true`
    : `/api/agent/v1/posts/${postId}`;

  try {
    await client.delete(url);
    console.log(`SUCCESS: Post ${postId} deleted.`);
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data || {};

    if (status === 409) {
      const opStatus: string = data.operationStatus ?? "RUNNING";
      console.error(`\nCannot delete: post is still being generated (status: ${opStatus}).`);
      console.error(`Wait for generation to complete (pking jobs list), or pass --force to delete and orphan the slot.`);
      process.exit(1);
    }

    console.error(`ERROR: Failed to delete post ${postId}.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function postsGenerateBatchCommand(options: {
  platform: string;
  voice?: string;
  language?: string;
  frequency: string;
  postsPerDay: string;
  times: string;
  days: string;
}): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  const postsPerDay = parseInt(options.postsPerDay, 10) || 1;
  const days = parseInt(options.days, 10) || 7;
  const postTimes = options.times.split(",").map((t: string) => t.trim());

  console.log(`\n🛠  Starting bulk generation for ${options.platform}...`);
  console.log(`   Frequency: ${options.frequency}`);
  console.log(`   Posts Per Day: ${postsPerDay}`);
  console.log(`   Times: ${postTimes.join(", ")}`);
  console.log(`   Duration: ${days} days`);
  if (options.voice) console.log(`   Voice ID: ${options.voice}`);

  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + days);

  const platform = options.platform.toLowerCase();
  const isCustomLength = platform.startsWith("custom:");
  const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;

  try {
    // Routed through agent-v1 (scope + rate limit + audit) instead of the
    // dashboard-inner route — makeProxy forwards the inner handler's response
    // verbatim, so res.data.message keeps working unchanged.
    const res = await client.post(`/api/agent/v1/brands/${brandId}/posts/generate-batch`, {
      medium: isCustomLength ? "custom" : options.platform,
      customCharLimit: customLimit,
      frequency: options.frequency,
      postsPerDay,
      postTimes,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      voiceProfileId: options.voice,
      language,
      assetPercentage: 50,
    });

    console.log(`\n✅ Bulk generation task queued successfully!`);
    console.log(`   Message: ${res.data.message || 'Processing in the background.'}`);
    console.log(`   You can use 'pking posts calendar' later to see scheduled posts.`);
    console.log("");
  } catch (err: any) {
    console.error(`\n❌ ERROR: Bulk generation failed.`);
    console.error(`Reason: ${extractApiError(err)}`);
    process.exit(1);
  }
}




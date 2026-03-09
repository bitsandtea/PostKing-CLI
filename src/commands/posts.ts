import { createClient } from "../client";
import { getBrandId } from "../config";

const VALID_PLATFORMS = ["x", "linkedin", "facebook", "instagram", "threads"];

interface PostsCreateOptions {
  platform: string;
  content: string;
  image?: string;
  schedule?: string;
}

interface PostsListOptions {
  status?: string;
  platform?: string;
  limit?: number;
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

  if (options.image) {
    // Handle image upload logic here if needed
    // For now we might just accept a URL or pass a placeholder
    console.log(`Note: Image attachment (${options.image}) will be processed as a smart asset.`);
    payload.platformAssets = {
       [platform]: {
         manualImageDescription: "Attached from CLI"
       }
    };
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

    if (posts.length === 0) {
      console.log("No posts found for this brand.");
      return;
    }

    console.log(`Latest posts for brand ${brandId}:\n`);
    posts.forEach((post) => {
      const statusStr = post.confirmed ? "APPROVED" : "DRAFT";
      const schedStr = post.postAt ? ` @ ${new Date(post.postAt).toLocaleString()}` : "";
      console.log(`  [${statusStr}] ${post.id.slice(-8)} | ${post.platform.padEnd(10)} | ${post.content.substring(0, 50).replace(/\n/g, " ")}...${schedStr}`);
    });
    
    console.log("\nUse 'pking posts generate' to create new AI content.");
  } catch (err) {
    process.exit(1);
  }
}

interface PostsApproveOptions {
  variation?: string;
  schedule?: string;
  timezone?: string;
}

export async function postsApproveCommand(postId: string, options: PostsApproveOptions): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
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
  } catch (err: any) {
    console.error(`ERROR: Failed to approve post ${postId}.`);
    if (err.response?.data?.message) {
      console.error(`Reason: ${err.response.data.message}`);
    }
    process.exit(1);
  }
}

export async function postsGenerateCommand(options: { 
  platform: string;
  theme?: string;
  variations?: number;
  voice?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  const count = options.variations || 1;
  console.log(`\n✨ Generating ${count} variation(s) for ${options.platform}...`);
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
      
      let opStatus: { status: string; progress?: { message: string }; error?: string } = { status: "pending", progress: { message: "Queuing..." } };
      try {
        if (post.operationStatus) opStatus = JSON.parse(post.operationStatus);
      } catch (e) {}

      if (opStatus.status === "completed") {
        finished = true;
        
        let outputData: any = {};
        try {
          if (post.outputData) outputData = JSON.parse(post.outputData);
        } catch (e) {}

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
      } else if (opStatus.status === "failed") {
        console.error(`\n❌ FAILED: ${opStatus.error || "Unknown error"}`);
        process.exit(1);
      } else {
        process.stdout.write(`\r   [PROCESSING] ${opStatus.progress?.message || "Generating..."}`.padEnd(60));
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

export async function postsCalendarCommand(options: { days?: string }): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/brands/${brandId}/posts?status=scheduled&limit=100`);
    const posts: PostResult[] = res.data.posts || [];

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
        console.log(`\x1b[1m${dateString}\x1b[0m`);
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

export async function postsViewCommand(postId: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/brands/${brandId}/posts/${postId}`);
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

    console.log(`\nCONTENT:`);
    console.log(`--------`);
    console.log(post.content);
    console.log(`--------`);

    if (post.assets && post.assets.length > 0) {
      console.log(`\nASSETS (${post.assets.length}):`);
      post.assets.forEach((asset: any, i: number) => {
        console.log(`  ${i + 1}. ${asset.url}`);
      });
    }

    console.log("");
  } catch (err: any) {
    console.error(`ERROR: Could not fetch post ${postId}.`);
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    }
    process.exit(1);
  }
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
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    }
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
  } catch (err: any) {
    console.error(`ERROR: Failed to reschedule post ${postId}.`);
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    }
    process.exit(1);
  }
}

export async function postsDeleteCommand(postId: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    await client.delete(`/api/brands/${brandId}/posts/${postId}`);
    console.log(`SUCCESS: Post ${postId} deleted.`);
  } catch (err: any) {
    console.error(`ERROR: Failed to delete post ${postId}.`);
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    }
    process.exit(1);
  }
}

export async function postsGenerateBatchCommand(options: {
  platform: string;
  voice?: string;
  frequency: string;
  postsPerDay: string;
  times: string;
  days: string;
}): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  const postsPerDay = parseInt(options.postsPerDay, 10) || 1;
  const days = parseInt(options.days, 10) || 7;
  const postTimes = options.times.split(",").map((t: string) => t.trim());

  console.log(`\n✨ Starting Bulk Generation for ${options.platform}...`);
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
    const res = await client.post(`/api/brands/${brandId}/generate-batch`, {
      medium: isCustomLength ? "custom" : options.platform,
      customCharLimit: customLimit,
      frequency: options.frequency,
      postsPerDay,
      postTimes,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      voiceProfileId: options.voice,
      assetPercentage: 50,
    });

    console.log(`\n✅ Bulk generation task queued successfully!`);
    console.log(`   Message: ${res.data.message || 'Processing in the background.'}`);
    console.log(`   You can use 'pking posts calendar' later to see scheduled posts.`);
    console.log("");
  } catch (err: any) {
    console.error(`\n❌ ERROR: Bulk generation failed.`);
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}




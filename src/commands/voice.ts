import { createClient } from "../client";
import { getBrandId } from "../config";

interface VoiceProfile {
  id: string;
  name?: string;
  authorName?: string;
  modalAdapterId?: string;
}

interface VoiceRewriteOptions {
  profileId: string;
  text: string;
  platform?: string;
}

export async function voiceListCommand(): Promise<void> {
  const client = createClient();

  try {
    // Fetch public profiles (no auth required) and brand-specific profiles
    const res = await client.get("/api/voice-profiles/public");
    const profiles: VoiceProfile[] = res.data.profiles || [];

    if (profiles.length === 0) {
      console.log("No public voice profiles available.");
      return;
    }

    console.log(`Available voice profiles (${profiles.length}):\n`);
    profiles.forEach((p) => {
      const label = p.name || p.authorName || "Unnamed";
      const deepLabel = p.modalAdapterId ? " [DEEP VOICE]" : "";
      console.log(`  ID:     ${p.id}`);
      console.log(`  Name:   ${label}${deepLabel}`);
      console.log("");
    });
  } catch (err: unknown) {
    process.exit(1);
  }
}

export async function voiceRewriteCommand(options: VoiceRewriteOptions): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }

  const platform = options.platform?.toLowerCase() || "x";
  const isCustomLength = platform.startsWith("custom:");
  const customLimit = isCustomLength ? parseInt(platform.split(":")[1], 10) : undefined;

  try {
    const res = await client.post(`/api/brands/${brandId}/repurpose`, {
      sourceType: "text",
      sourceContent: options.text,
      targetType: isCustomLength ? "text" : "social",
      targetPlatforms: isCustomLength ? undefined : [platform],
      textLength: isCustomLength ? "custom" : undefined,
      textCustomWordCount: customLimit,
      variationCount: 1,
      voiceProfileIds: {
        [platform]: options.profileId,
        text: options.profileId,
      },
    });

    const data = res.data;
    const posts: Array<{ content?: string; text?: string }> = data.posts || data.results || [];

    if (posts.length > 0) {
      console.log("REWRITTEN TEXT:\n");
      posts.forEach((p, i) => {
        if (posts.length > 1) console.log(`--- Variation ${i + 1} ---`);
        console.log(p.content || p.text || JSON.stringify(p));
        console.log("");
      });
    } else {
      // Fallback: print raw response
      console.log("RESULT:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err: unknown) {
    process.exit(1);
  }
}

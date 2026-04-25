import { createClient } from "../client";
import { getBrandId } from "../config";

interface PublicVoice {
  id: string;
  name?: string;
  authorName?: string;
  isDeepVoice?: boolean;
  optimizedMedium?: string[];
  description?: string | null;
}

interface VoiceListOptions {
  platform?: string;
  filter?: string;
}

interface VoiceRewriteOptions {
  profileId: string;
  text: string;
  platform?: string;
}

export async function voiceListCommand(options: VoiceListOptions = {}): Promise<void> {
  const client = createClient();

  const params: Record<string, string> = {};
  if (options.platform) params.medium = options.platform.toLowerCase();
  if (options.filter) params.filter = options.filter.toLowerCase();

  try {
    const res = await client.get("/api/agent/v1/voices/public", { params });
    const voices: PublicVoice[] = res.data.voices || [];

    if (voices.length === 0) {
      const scope = options.platform ? ` for platform '${options.platform}'` : "";
      console.log(`No public voice profiles available${scope}.`);
      return;
    }

    const scope = options.platform ? ` for ${options.platform}` : "";
    console.log(`Available public voice profiles${scope} (${voices.length}):\n`);

    voices.forEach((v) => {
      const name = v.name || v.authorName || "Anonymous";
      const platforms = (v.optimizedMedium || []).join(", ");

      console.log(`  ID:          ${v.id}`);
      console.log(`  Name:        ${name}`);
      if (platforms) console.log(`  Platforms:   ${platforms}`);
      if (v.description) console.log(`  Description: ${v.description}`);
      console.log("");
    });
  } catch {
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
      console.log("RESULT:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch {
    process.exit(1);
  }
}

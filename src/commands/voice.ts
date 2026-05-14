import { extractApiError } from "../api-error";
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

interface BrandVoiceProfile {
  id: string;
  name?: string;
  authorName?: string;
  brandId?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
  voiceProfile?: string;
  modalAdapterId?: string | null;
  optimizedMedium?: string[];
  description?: string | null;
}

interface VoiceListOptions {
  platform?: string;
  filter?: string;
  json?: boolean;
}

interface VoiceRewriteOptions {
  profileId: string;
  text: string;
  platform?: string;
}

interface BrandVoiceListOptions {
  json?: boolean;
  includePublic?: boolean;
}

interface BrandVoiceUpdateOptions {
  name?: string;
  active?: boolean;
  inactive?: boolean;
  adapter?: string;
  json?: boolean;
}

interface BrandVoiceDeleteOptions {
  destructive?: boolean;
  json?: boolean;
}

function requireBrandFlagOrConfig(brandIdArg: string | undefined): string {
  const brandId = brandIdArg || getBrandId();
  if (!brandId) {
    console.error(
      "ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass <brandId>."
    );
    process.exit(1);
  }
  return brandId;
}

export async function voiceListCommand(options: VoiceListOptions = {}): Promise<void> {
  const client = createClient();

  const params: Record<string, string> = {};
  if (options.platform) params.medium = options.platform.toLowerCase();
  if (options.filter) params.filter = options.filter.toLowerCase();

  try {
    const res = await client.get("/api/agent/v1/voices/public", { params });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
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

// ─── Brand-scoped voice profiles ─────────────────────────────────────────────
// Wraps /api/agent/v1/brands/{brandId}/voice-profiles[/{voiceProfileId}].
// The brand-scoped list returns BOTH profiles attached to the brand and the
// public catalog (web parity). Use --no-public to filter to brand-only.

const BRAND_VOICE_BASE = (brandId: string) =>
  `/api/agent/v1/brands/${brandId}/voice-profiles`;

function renderBrandVoiceList(
  profiles: BrandVoiceProfile[],
  brandId: string,
  includePublic: boolean
): void {
  if (profiles.length === 0) {
    console.log(`No voice profiles available for brand ${brandId}.`);
    return;
  }
  const filtered = includePublic
    ? profiles
    : profiles.filter((p) => p.brandId === brandId);
  if (filtered.length === 0) {
    console.log(
      `No brand-owned voice profiles for ${brandId}. Pass --include-public to also list public profiles available to this brand.`
    );
    return;
  }
  console.log(`Voice profiles for brand ${brandId} (${filtered.length}):\n`);
  for (const p of filtered) {
    const name = p.name || p.authorName || "Anonymous";
    const scope = p.brandId === brandId ? "brand" : "public";
    const state = p.isActive === false ? "inactive" : "active";
    const platforms = (p.optimizedMedium || []).join(", ");
    console.log(`  ID:        ${p.id}`);
    console.log(`  Name:      ${name}`);
    console.log(`  Scope:     ${scope}`);
    console.log(`  State:     ${state}`);
    if (platforms) console.log(`  Platforms: ${platforms}`);
    if (p.modalAdapterId) console.log(`  Adapter:   ${p.modalAdapterId}`);
    if (p.description) console.log(`  Desc:      ${p.description}`);
    console.log("");
  }
}

export async function voiceBrandListCommand(
  brandIdArg: string | undefined,
  options: BrandVoiceListOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrandFlagOrConfig(brandIdArg);

  try {
    const res = await client.get(BRAND_VOICE_BASE(brandId));
    const profiles: BrandVoiceProfile[] = res.data.voiceProfiles || [];
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    renderBrandVoiceList(profiles, brandId, options.includePublic === true);
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function voiceBrandUpdateCommand(
  voiceProfileId: string,
  brandIdArg: string | undefined,
  options: BrandVoiceUpdateOptions
): Promise<void> {
  const client = createClient();
  const brandId = requireBrandFlagOrConfig(brandIdArg);

  const body: Record<string, unknown> = {};
  if (options.name !== undefined) body.name = options.name;
  if (options.active) body.isActive = true;
  if (options.inactive) body.isActive = false;
  if (options.adapter !== undefined) body.modalAdapterId = options.adapter;

  if (Object.keys(body).length === 0) {
    console.error(
      "ERROR: Pass at least one of --name, --active, --inactive, --adapter."
    );
    process.exit(1);
  }
  if (options.active && options.inactive) {
    console.error("ERROR: --active and --inactive are mutually exclusive.");
    process.exit(1);
  }

  try {
    const res = await client.patch(
      `${BRAND_VOICE_BASE(brandId)}/${voiceProfileId}`,
      body
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    console.log(`SUCCESS: Voice profile ${voiceProfileId} updated.`);
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function voiceBrandDeleteCommand(
  voiceProfileId: string,
  brandIdArg: string | undefined,
  options: BrandVoiceDeleteOptions
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = requireBrandFlagOrConfig(brandIdArg);

  try {
    const res = await client.delete(
      `${BRAND_VOICE_BASE(brandId)}/${voiceProfileId}`
    );
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    console.log(`SUCCESS: Voice profile ${voiceProfileId} deleted.`);
  } catch (err) {
    console.error(`\nERROR: ${extractApiError(err)}`);
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

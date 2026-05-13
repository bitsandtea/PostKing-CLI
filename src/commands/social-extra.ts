import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

const SUPPORTED = ["linkedin", "x", "instagram", "threads", "facebook"];

export async function socialConnectPlatformCommand(options: {
  platform: string;
}): Promise<void> {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first.");
    process.exit(1);
  }
  const platform = options.platform.toLowerCase();
  if (!SUPPORTED.includes(platform)) {
    console.error(
      `ERROR: Unsupported platform '${platform}'. Use one of: ${SUPPORTED.join(", ")}`
    );
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/social-accounts/connect-link`,
      { platform }
    );
    const { url } = res.data;
    console.log(`\nCONNECT ${platform.toUpperCase()}:`);
    console.log(`  ${url}`);
    console.log(
      "\nOpen in browser. You'll be taken directly to the platform's OAuth flow."
    );
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

import { createClient } from "../client";
import { getBrandId } from "../config";

interface SocialAccount {
  id: string;
  platform: string;
  status: string;
  accountName?: string;
  accountHandle?: string;
  accountAvatar?: string;
}

export async function socialCheckCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/brands/${brandId}/social-accounts`);
    const accounts: SocialAccount[] = res.data.accounts || res.data || [];

    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.log("No social media accounts found for this brand.");
      console.log("");
      console.log("HUMAN_ACTION_REQUIRED: Connect social accounts at postking.app/dashboard");
      console.log("The agent cannot connect social accounts — this requires OAuth in a browser.");
      return;
    }

    const connected = accounts.filter((a) => a.status === "CONNECTED");
    const disconnected = accounts.filter((a) => a.status !== "CONNECTED");

    console.log(`Social accounts for brand ${brandId}:\n`);

    if (connected.length > 0) {
      console.log(`Connected (${connected.length}):`);
      connected.forEach((a) => {
        const nameStr = a.accountName || "—";
        const handleStr = a.accountHandle ? ` (@${a.accountHandle})` : "";
        console.log(`  [CONNECTED]    ${a.platform.padEnd(12)} ${nameStr}${handleStr}`);
      });
    }

    if (disconnected.length > 0) {
      console.log(`\nDisconnected (${disconnected.length}):`);
      disconnected.forEach((a) => {
        console.log(`  [DISCONNECTED] ${a.platform}`);
      });
      console.log("");
      console.log("HUMAN_ACTION_REQUIRED: Reconnect disconnected accounts at postking.app/dashboard");
    }

    if (connected.length === 0) {
      console.log("");
      console.log("No connected platforms. Cannot schedule posts until at least one is connected.");
    }
  } catch (err: unknown) {
    console.error("ERROR: Failed to fetch social accounts.");
    process.exit(1);
  }
}

export async function socialConnectCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }

  try {
    const res = await client.post(`/api/brands/${brandId}/social-accounts/connect-link`);
    const { url } = res.data;

    console.log("\n🔗 SOCIAL MEDIA CONNECTION");
    console.log("--------------------------");
    console.log("To connect your social media accounts, please visit the following link in your browser:");
    console.log(`\n\x1b[36m${url}\x1b[0m\n`);
    console.log("This link will log you in automatically and take you directly to the connection page.");
    console.log("Note: This link is single-use and valid for 1 hour.\n");
  } catch (err: any) {
    console.error("\n❌ ERROR: Could not generate connection link.");
    if (err.response?.data?.error) {
      console.error(`Reason: ${err.response.data.error}`);
    } else {
      console.error(`Status: ${err.response?.status || "Unknown"}`);
    }
    process.exit(1);
  }
}

export async function socialDisconnectCommand(platformOrId: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    process.exit(1);
  }

  try {
    // 1. Fetch accounts to find the ID if a platform name was provided
    const res = await client.get(`/api/brands/${brandId}/social-accounts`);
    const accounts: SocialAccount[] = res.data.accounts || [];
    
    let targetAccountId = "";
    let platformName = "";

    // Check if input is a direct ID match
    const accountById = accounts.find(a => a.id === platformOrId);
    if (accountById) {
      targetAccountId = accountById.id;
      platformName = accountById.platform;
    } else {
      // Try platform name match (case-insensitive)
      const normalizedInput = platformOrId.toLowerCase();
      const matchingAccounts = accounts.filter(a => 
        a.platform.toLowerCase() === normalizedInput || 
        (a.platform === "x/twitter" && (normalizedInput === "x" || normalizedInput === "twitter"))
      );

      if (matchingAccounts.length === 0) {
        console.error(`ERROR: No account found for platform or ID: '${platformOrId}'`);
        process.exit(1);
      }

      if (matchingAccounts.length > 1) {
        console.error(`ERROR: Multiple accounts found for platform '${platformOrId}'. Please use the full ID:`);
        matchingAccounts.forEach(a => console.log(`  - ${a.id} (${a.accountName || a.accountHandle})`));
        process.exit(1);
      }

      targetAccountId = matchingAccounts[0].id;
      platformName = matchingAccounts[0].platform;
    }

    console.log(`Disconnecting ${platformName} account...`);
    await client.delete(`/api/brands/${brandId}/social-accounts/${targetAccountId}`);
    console.log(`SUCCESS: ${platformName} account disconnected.`);
  } catch (err: any) {
    console.error(`ERROR: Failed to disconnect account.`);
    if (err.response?.data?.message) {
      console.error(`Reason: ${err.response.data.message}`);
    }
    process.exit(1);
  }
}

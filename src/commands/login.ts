import axios from "axios";
import { getApiUrl, setConfig } from "../config";
import { POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS as MAX_ATTEMPTS } from "../constants";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginCommand(): Promise<void> {
  const apiUrl = getApiUrl();

  console.log("Initiating PostKing agent authentication...");

  let deviceCode: string;
  let userCode: string;
  let verificationUri: string;

  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  const authClient = axios.create({
    httpsAgent: isLocal ? new (require('https')).Agent({ rejectUnauthorized: false }) : undefined
  });

  try {
    const res = await authClient.post(`${apiUrl}/api/agent/auth/device/code`);
    deviceCode = res.data.device_code;
    userCode = res.data.user_code;
    verificationUri = res.data.verification_uri;
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message || err.response?.data?.error || err.message
      : String(err);
    console.error(`\n❌ ERROR: Failed to initiate authentication — ${message}`);
    if (isLocal) {
       console.error(`  Target: ${apiUrl}`);
       console.error(`  Is your 'pn dev:https' server actually running?`);
    } else {
       console.error("  Are you sure your internet connection is stable?");
    }
    process.exit(1);
  }

  console.log("");
  console.log("================================================================");
  console.log("WAITING_FOR_HUMAN: Please complete the following steps:");
  console.log(`  1. Navigate to: ${verificationUri}`);
  console.log(`  2. Enter the code: ${userCode}`);
  console.log("================================================================");
  console.log("");
  console.log("DO NOT TIMEOUT. Polling the PostKing server every 5 seconds.");
  console.log("Waiting for the human to authorize this device...");
  console.log("");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const res = await authClient.post(`${apiUrl}/api/agent/auth/device/token`, {
        device_code: deviceCode,
      });

      const { access_token } = res.data;
      setConfig({ apiKey: access_token, apiUrl });

      console.log("================================================================");
      console.log("SUCCESS: Authenticated successfully!");
      if (isLocal) {
        console.log(`📡 Linked to LOCAL server: ${apiUrl}`);
      }
      console.log("Your API key and session configuration have been saved.");
      console.log("================================================================");
      return;
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        console.error("Unexpected error during polling:", String(err));
        process.exit(1);
      }

      const errorCode = err.response?.data?.error;

      if (errorCode === "authorization_pending") {
        // Normal — still waiting for human. Keep polling silently.
        continue;
      } else if (errorCode === "expired_token") {
        console.error("ERROR: The activation code has expired (15 minute limit).");
        console.error("Run 'pking login' again to generate a new code.");
        process.exit(1);
      } else if (errorCode === "access_denied") {
        console.error("ERROR: The human denied the authorization request.");
        process.exit(1);
      } else {
        console.error("ERROR: Unexpected polling error:", err.response?.data?.error || err.message);
        process.exit(1);
      }
    }
  }

  console.error("ERROR: Timed out waiting for authorization (15 minutes elapsed).");
  console.error("Run 'pking login' again to restart.");
  process.exit(1);
}

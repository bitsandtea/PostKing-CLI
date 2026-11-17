import axios from "axios";
import { getApiUrl, setConfig } from "../config";
import { POLL_INTERVAL_MS, MAX_POLL_ATTEMPTS as MAX_ATTEMPTS } from "../constants";
import { USER_AGENT } from "../client";
import { extractApiError } from "../api-error";
import { createPendingLogin, resumePendingLogin } from "./auth-device";
import { clearPendingLogin, type ReusablePendingLogin } from "../lib/pendingLogin";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginCommand(): Promise<void> {
  const apiUrl = getApiUrl();

  console.log("Initiating PostKing agent authentication...");

  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  const authClient = axios.create({
    headers: { "User-Agent": USER_AGENT },
    httpsAgent: isLocal ? new (require('https')).Agent({ rejectUnauthorized: false }) : undefined
  });

  // One login attempt = one device request: a re-run picks up the request
  // from the previous run (still waiting, or already approved) instead of
  // creating another.
  let pending: ReusablePendingLogin;
  try {
    const resumed = await resumePendingLogin(authClient, apiUrl);
    if (resumed === "logged_in") {
      console.log("SUCCESS: Authenticated successfully! (approved earlier — credentials saved)");
      return;
    }
    pending = resumed ?? (await createPendingLogin(authClient, apiUrl));
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`\n❌ ERROR: Failed to initiate authentication — ${message}`);
    if (isLocal) {
       console.error(`  Target: ${apiUrl}`);
       console.error(`  Is your 'pn dev:https' server actually running?`);
    } else {
       console.error("  Are you sure your internet connection is stable?");
    }
    process.exit(1);
  }
  const deviceCode = pending.device_code;

  console.log("");
  console.log("================================================================");
  console.log("WAITING_FOR_HUMAN: Please complete the following steps:");
  console.log(`  1. Navigate to: ${pending.verification_uri}`);
  console.log(`  2. Press Approve (code ${pending.user_code}). No account yet? The same page lets you create one.`);
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
      clearPendingLogin();

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
        clearPendingLogin();
        console.error("ERROR: The activation code has expired.");
        console.error("Run 'pking login' again to generate a new code.");
        process.exit(1);
      } else if (errorCode === "access_denied") {
        clearPendingLogin();
        console.error("ERROR: The human denied the authorization request.");
        process.exit(1);
      } else {
        console.error(`ERROR: Unexpected polling error: ${extractApiError(err)}`);
        process.exit(1);
      }
    }
  }

  console.error("ERROR: Timed out waiting for authorization (15 minutes elapsed).");
  console.error(`The link is still valid: ${pending.verification_uri}`);
  console.error("Run 'pking login' again to keep waiting on the same link.");
  process.exit(1);
}

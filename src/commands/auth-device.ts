import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { getApiUrl, setConfig } from "../config";

const PENDING_FILE = path.join(os.homedir(), ".pking", "pending-login.json");

interface PendingLogin {
  device_code: string;
  apiUrl: string;
  startedAt: number;
}

function makeAuthClient(apiUrl: string) {
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  return axios.create({
    httpsAgent: isLocal
      ? new (require("https").Agent)({ rejectUnauthorized: false })
      : undefined,
  });
}

function writePending(state: PendingLogin): void {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(state, null, 2));
}

function readPending(): PendingLogin | null {
  if (!fs.existsSync(PENDING_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function clearPending(): void {
  if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
}

export async function loginStartCommand(): Promise<void> {
  const apiUrl = getApiUrl();
  const client = makeAuthClient(apiUrl);

  let deviceCode: string;
  let userCode: string;
  let verificationUri: string;

  try {
    const res = await client.post(`${apiUrl}/api/agent/auth/device/code`);
    deviceCode = res.data.device_code;
    userCode = res.data.user_code;
    verificationUri = res.data.verification_uri;
  } catch (err: unknown) {
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message || err.response?.data?.error || err.message
      : String(err);
    console.error(`ERROR: Failed to initiate authentication — ${message}`);
    process.exit(1);
  }

  writePending({ device_code: deviceCode, apiUrl, startedAt: Date.now() });

  console.log("PostKing authentication started.");
  console.log("");
  console.log(`  Visit:      ${verificationUri}`);
  console.log(`  User code:  ${userCode}`);
  console.log("");
  console.log("After authorizing in your browser, run:  pking login-finish");
  console.log("The activation code is valid for 15 minutes.");
}

export async function loginFinishCommand(): Promise<void> {
  const pending = readPending();
  if (!pending) {
    console.error(
      "ERROR: No pending login. Run 'pking login-start' first."
    );
    process.exit(1);
  }

  const ageMs = Date.now() - pending.startedAt;
  if (ageMs > 15 * 60 * 1000) {
    clearPending();
    console.error(
      "ERROR: Pending activation expired (15 minute limit). Run 'pking login-start' again."
    );
    process.exit(1);
  }

  const client = makeAuthClient(pending.apiUrl);

  try {
    const res = await client.post(
      `${pending.apiUrl}/api/agent/auth/device/token`,
      { device_code: pending.device_code }
    );
    const { access_token } = res.data;
    setConfig({ apiKey: access_token, apiUrl: pending.apiUrl });
    clearPending();
    console.log("SUCCESS: Authenticated. Credentials saved.");
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) {
      console.error("ERROR: Unexpected polling error:", String(err));
      process.exit(1);
    }
    const errorCode = err.response?.data?.error;
    if (errorCode === "authorization_pending") {
      console.error(
        "PENDING: The user has not finished authorizing yet. Wait, then run 'pking login-finish' again."
      );
      process.exit(2);
    }
    if (errorCode === "expired_token") {
      clearPending();
      console.error(
        "ERROR: The activation code has expired. Run 'pking login-start' again."
      );
      process.exit(1);
    }
    if (errorCode === "access_denied") {
      clearPending();
      console.error("ERROR: Authorization was denied by the user.");
      process.exit(1);
    }
    console.error(
      "ERROR: Unexpected error:",
      err.response?.data?.error || err.message
    );
    process.exit(1);
  }
}

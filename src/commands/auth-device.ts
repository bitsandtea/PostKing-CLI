import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { getApiUrl, setConfig } from "../config";
import { USER_AGENT } from "../client";
import { extractApiError } from "../api-error";

const PENDING_FILE = path.join(os.homedir(), ".pking", "pending-login.json");
const PENDING_REGISTER_FILE = path.join(os.homedir(), ".pking", "pending-register.json");
const PENDING_RESET_FILE = path.join(os.homedir(), ".pking", "pending-reset.json");

interface PendingLogin {
  device_code: string;
  apiUrl: string;
  startedAt: number;
}

interface PendingRegister {
  device_code: string;
  email: string;
  apiUrl: string;
  startedAt: number;
}

interface PendingReset {
  device_code: string;
  email: string;
  apiUrl: string;
  startedAt: number;
}

function makeAuthClient(apiUrl: string) {
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  return axios.create({
    headers: { "User-Agent": USER_AGENT },
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

function writePendingRegister(state: PendingRegister): void {
  fs.mkdirSync(path.dirname(PENDING_REGISTER_FILE), { recursive: true });
  fs.writeFileSync(PENDING_REGISTER_FILE, JSON.stringify(state, null, 2));
}

function readPendingRegister(): PendingRegister | null {
  if (!fs.existsSync(PENDING_REGISTER_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PENDING_REGISTER_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function clearPendingRegister(): void {
  if (fs.existsSync(PENDING_REGISTER_FILE)) fs.unlinkSync(PENDING_REGISTER_FILE);
}

function writePendingReset(state: PendingReset): void {
  fs.mkdirSync(path.dirname(PENDING_RESET_FILE), { recursive: true });
  fs.writeFileSync(PENDING_RESET_FILE, JSON.stringify(state, null, 2));
}

function readPendingReset(): PendingReset | null {
  if (!fs.existsSync(PENDING_RESET_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PENDING_RESET_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function clearPendingReset(): void {
  if (fs.existsSync(PENDING_RESET_FILE)) fs.unlinkSync(PENDING_RESET_FILE);
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
    const message = extractApiError(err);
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
  console.log("The activation code is valid for 60 minutes.");
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
  if (ageMs > 60 * 60 * 1000) {
    clearPending();
    console.error(
      "ERROR: Pending activation expired (60 minute limit). Run 'pking login-start' again."
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
    console.error(`ERROR: Unexpected error: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── register-start / register-finish ────────────────────────────────────────

export async function registerStartCommand(options: {
  email: string;
  clientName?: string;
}): Promise<void> {
  const apiUrl = getApiUrl();
  const client = makeAuthClient(apiUrl);

  let deviceCode: string;

  try {
    const codeRes = await client.post(`${apiUrl}/api/agent/auth/device/code`, {
      client_name: options.clientName || "pking-cli",
    });
    deviceCode = codeRes.data.device_code;
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`ERROR: Failed to initiate device flow — ${message}`);
    process.exit(1);
  }

  try {
    await client.post(`${apiUrl}/api/agent/v1/auth/register`, {
      email: options.email,
      device_code: deviceCode,
      client_name: options.clientName || "pking-cli",
    });
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`ERROR: Failed to start registration — ${message}`);
    process.exit(1);
  }

  writePendingRegister({
    device_code: deviceCode,
    email: options.email,
    apiUrl,
    startedAt: Date.now(),
  });

  console.log(`PostKing registration started for ${options.email}.`);
  console.log("");
  console.log("We've sent a magic link to your email address.");
  console.log("Open your inbox, click the link, and finish setup in your browser");
  console.log("(you'll set a password there).");
  console.log("");
  console.log("When you've completed the browser flow, run:  pking register-finish");
  console.log("The activation link is valid for 15 minutes.");
  console.log("Did the email not arrive? Run 'pking resend'.");
}

export async function registerFinishCommand(): Promise<void> {
  const pending = readPendingRegister();
  if (!pending) {
    console.error(
      "ERROR: No pending registration. Run `pking register-start --email <you@example.com>` first."
    );
    process.exit(1);
  }

  const ageMs = Date.now() - pending.startedAt;
  if (ageMs > 15 * 60 * 1000) {
    clearPendingRegister();
    console.error(
      "ERROR: Pending registration expired (15 minute limit). Run 'pking register-start' again."
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
    clearPendingRegister();
    console.log("SUCCESS: Registered and authenticated. Credentials saved.");
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) {
      console.error("ERROR: Unexpected polling error:", String(err));
      process.exit(1);
    }
    const errorCode = err.response?.data?.error;
    if (errorCode === "authorization_pending") {
      console.error(
        "PENDING: Authorization still pending. Click the magic link in your email, then re-run this command."
      );
      process.exit(2);
    }
    if (errorCode === "expired_token") {
      clearPendingRegister();
      console.error(
        "ERROR: The activation link has expired. Run 'pking register-start' again."
      );
      process.exit(1);
    }
    if (errorCode === "access_denied") {
      clearPendingRegister();
      console.error("ERROR: Authorization was denied.");
      process.exit(1);
    }
    console.error(`ERROR: Unexpected error: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function resendCommand(): Promise<void> {
  const pendingRegister = readPendingRegister();
  const pendingReset = pendingRegister ? null : readPendingReset();

  if (!pendingRegister && !pendingReset) {
    const pendingLogin = readPending();
    if (pendingLogin) {
      console.error(
        "ERROR: Pending login state found but has no email address. Use 'pking login-start' to restart."
      );
    } else {
      console.error(
        "ERROR: No pending registration or login. Run 'pking register-start' or 'pking login' first."
      );
    }
    process.exit(1);
  }

  const pending = (pendingRegister ?? pendingReset)!;
  const isReset = pendingReset !== null;

  const ageMs = Date.now() - pending.startedAt;
  if (ageMs > 15 * 60 * 1000) {
    if (isReset) {
      clearPendingReset();
      console.error(
        "ERROR: Pending reset expired (15 minute limit). Run 'pking reset-password' again."
      );
    } else {
      clearPendingRegister();
      console.error(
        "ERROR: Pending registration expired (15 minute limit). Run 'pking register-start' again."
      );
    }
    process.exit(1);
  }

  const { email, device_code: deviceCode, apiUrl } = pending;
  const client = makeAuthClient(apiUrl);

  try {
    await client.post(`${apiUrl}/api/agent/v1/auth/resend`, {
      email,
      device_code: deviceCode,
      client_name: "pking-cli",
      ...(isReset ? { flow: "reset" } : {}),
    });
    if (isReset) {
      console.log(`Resent reset link to ${email}. Open your inbox and choose a new password. Link valid for 1 hour.`);
      console.log("When done, run:  pking reset-password-finish");
    } else {
      console.log(`Resent magic link to ${email}. Open your inbox and finish setup. Link valid for 1 hour.`);
      console.log("When done, run:  pking register-finish");
    }
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`ERROR: Failed to resend — ${message}`);
    process.exit(1);
  }
}

// ─── reset-password / reset-password-finish ───────────────────────────────────

export async function resetPasswordCommand(options: {
  email: string;
  clientName?: string;
}): Promise<void> {
  const apiUrl = getApiUrl();
  const client = makeAuthClient(apiUrl);

  let deviceCode: string;

  try {
    const codeRes = await client.post(`${apiUrl}/api/agent/auth/device/code`, {
      client_name: options.clientName || "pking-cli",
    });
    deviceCode = codeRes.data.device_code;
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`ERROR: Failed to initiate device flow — ${message}`);
    process.exit(1);
  }

  try {
    await client.post(`${apiUrl}/api/agent/v1/auth/reset-password`, {
      email: options.email,
      device_code: deviceCode,
      client_name: options.clientName || "pking-cli",
    });
  } catch (err: unknown) {
    const message = extractApiError(err);
    console.error(`ERROR: Failed to start password reset — ${message}`);
    process.exit(1);
  }

  writePendingReset({
    device_code: deviceCode,
    email: options.email,
    apiUrl,
    startedAt: Date.now(),
  });

  console.log(`PostKing password reset started for ${options.email}.`);
  console.log("");
  console.log("We've sent a reset link to your email address.");
  console.log("Open your inbox, click the link, and choose a new password.");
  console.log("");
  console.log("When you've completed the browser flow, run:  pking reset-password-finish");
  console.log("The reset link is valid for 1 hour.");
  console.log("Did the email not arrive? Run 'pking resend'.");
}

export async function resetPasswordFinishCommand(): Promise<void> {
  const pending = readPendingReset();
  if (!pending) {
    console.error(
      "ERROR: No pending reset. Run `pking reset-password --email <you@example.com>` first."
    );
    process.exit(1);
  }

  const ageMs = Date.now() - pending.startedAt;
  if (ageMs > 60 * 60 * 1000) {
    clearPendingReset();
    console.error(
      "ERROR: Pending reset expired (60 minute limit). Run 'pking reset-password' again."
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
    clearPendingReset();
    console.log("SUCCESS: Password reset and authenticated. Credentials saved.");
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) {
      console.error("ERROR: Unexpected polling error:", String(err));
      process.exit(1);
    }
    const errorCode = err.response?.data?.error;
    if (errorCode === "authorization_pending") {
      console.error(
        "PENDING: Authorization still pending. Click the reset link in your email, then re-run this command."
      );
      process.exit(2);
    }
    if (errorCode === "expired_token") {
      clearPendingReset();
      console.error(
        "ERROR: The reset link has expired. Run 'pking reset-password' again."
      );
      process.exit(1);
    }
    if (errorCode === "access_denied") {
      clearPendingReset();
      console.error("ERROR: Authorization was denied.");
      process.exit(1);
    }
    console.error(`ERROR: Unexpected error: ${extractApiError(err)}`);
    process.exit(1);
  }
}

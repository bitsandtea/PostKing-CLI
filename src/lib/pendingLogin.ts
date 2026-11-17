/**
 * One login attempt = one device-authorization request.
 *
 * `pking login` / `pking login-start` used to create a fresh request on the
 * server on every run — after a timeout, a retry, or a re-run by an agent —
 * leaving a trail of never-approved requests and stranding links the user had
 * already approved. The in-flight request is kept in
 * `~/.pking/pending-login.json` and reused until it expires or is redeemed.
 */
import fs from "fs";
import os from "os";
import path from "path";

/** Name recorded on every device request this CLI creates. */
export const DEVICE_CLIENT_NAME = "pking-cli";

const PENDING_FILE = path.join(os.homedir(), ".pking", "pending-login.json");

/** Lifetime the server gives a request when it does not say (`expires_in`). */
export const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60;

/** A request with less time left than this is not worth showing again. */
export const MIN_REMAINING_MS = 2 * 60 * 1000;

export interface PendingLogin {
  device_code: string;
  apiUrl: string;
  startedAt: number;
  /** Absent in files written by releases before request reuse. */
  user_code?: string;
  verification_uri?: string;
  /** Epoch ms. */
  expiresAt?: number;
}

/** A pending login that carries everything needed to show its link again. */
export type ReusablePendingLogin = PendingLogin &
  Required<Pick<PendingLogin, "user_code" | "verification_uri" | "expiresAt">>;

/** True when `pending` can still be approved and redeemed against `apiUrl`. */
export function isReusablePendingLogin(
  pending: PendingLogin | null,
  apiUrl: string,
  now: number = Date.now(),
  minRemainingMs: number = MIN_REMAINING_MS
): pending is ReusablePendingLogin {
  if (!pending) return false;
  if (pending.apiUrl !== apiUrl) return false;
  if (!pending.device_code || !pending.user_code || !pending.verification_uri) return false;
  if (typeof pending.expiresAt !== "number" || !Number.isFinite(pending.expiresAt)) return false;
  return pending.expiresAt - now > minRemainingMs;
}

export type ReuseDecision = "logged_in" | "show_again" | "start_new";

/**
 * What a login command does with an existing request, given the token
 * endpoint's answer for it: redeem it (the user already approved), show the
 * same link again (still waiting), or drop it and create a new one.
 */
export function decideReuse(
  tokenResponse: { access_token?: unknown; error?: unknown } | null
): ReuseDecision {
  if (!tokenResponse) return "start_new";
  if (typeof tokenResponse.access_token === "string" && tokenResponse.access_token) return "logged_in";
  if (tokenResponse.error === "authorization_pending" || tokenResponse.error === "slow_down") return "show_again";
  return "start_new";
}

/** Builds the record to save from a `/device/code` response. */
export function pendingLoginFromResponse(
  data: { device_code: string; user_code: string; verification_uri: string; expires_in?: number },
  apiUrl: string,
  now: number = Date.now()
): ReusablePendingLogin {
  const expiresIn =
    typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : DEFAULT_EXPIRES_IN_SECONDS;
  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    apiUrl,
    startedAt: now,
    expiresAt: now + expiresIn * 1000,
  };
}

export function writePendingLogin(state: PendingLogin): void {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function readPendingLogin(): PendingLogin | null {
  if (!fs.existsSync(PENDING_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8")) as PendingLogin;
    return parsed && typeof parsed.device_code === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingLogin(): void {
  if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
}

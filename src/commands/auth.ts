import axios from "axios";
import { getApiUrl, setConfig } from "../config";
import { MAX_POLL_ATTEMPTS, POLL_INTERVAL_MS } from "../constants";

interface AuthOptions {
  email: string;
  password: string;
  clientName?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deviceFlow(
  apiUrl: string,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<string> {
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  const authClient = axios.create({
    httpsAgent: isLocal
      ? new (require("https")).Agent({ rejectUnauthorized: false })
      : undefined,
  });

  // 1. Kick off device code + register/login
  const codeRes = await authClient.post(`${apiUrl}/api/agent/auth/device/code`, {
    client_name: payload.client_name,
  });
  const { device_code, user_code, verification_uri } = codeRes.data;

  // 2. Trigger register or login — server sends magic link with device_code
  await authClient.post(`${apiUrl}${endpoint}`, {
    ...payload,
    device_code,
  });

  console.log("");
  console.log("================================================================");
  console.log("WAITING_FOR_HUMAN: Please complete the following steps:");
  console.log(`  1. Check your email for a PostKing magic link.`);
  console.log(`  2. Or visit: ${verification_uri}  and enter code: ${user_code}`);
  console.log("================================================================");
  console.log("Polling every 5s...");

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await authClient.post(
        `${apiUrl}/api/agent/auth/device/token`,
        { device_code }
      );
      return res.data.access_token;
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) throw err;
      const code = err.response?.data?.error;
      if (code === "authorization_pending") continue;
      if (code === "expired_token") {
        throw new Error("Activation code expired.");
      }
      if (code === "access_denied") {
        throw new Error("Authorization denied.");
      }
      throw new Error(code || err.message);
    }
  }
  console.error("");
  console.error("================================================================");
  console.error("ERROR: Timed out waiting for authorization.");
  console.error(`  Verification URL: ${verification_uri}`);
  console.error(`  User code:        ${user_code}`);
  console.error("  Run 'pking login' again to generate a fresh code.");
  console.error("================================================================");
  throw new Error("Timed out waiting for authorization.");
}

export async function registerCommand(options: AuthOptions): Promise<void> {
  const apiUrl = getApiUrl();
  console.log(`Registering ${options.email} with PostKing...`);
  try {
    const token = await deviceFlow(apiUrl, "/api/agent/v1/auth/register", {
      email: options.email,
      password: options.password,
      client_name: options.clientName || "pking-cli",
    });
    setConfig({ apiKey: token, apiUrl });
    console.log("SUCCESS: Account registered and authenticated.");
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}`);
    process.exit(1);
  }
}

export async function loginWithPasswordCommand(options: AuthOptions): Promise<void> {
  const apiUrl = getApiUrl();
  console.log(`Logging in ${options.email}...`);
  try {
    const token = await deviceFlow(apiUrl, "/api/agent/v1/auth/login", {
      email: options.email,
      password: options.password,
      client_name: options.clientName || "pking-cli",
    });
    setConfig({ apiKey: token, apiUrl });
    console.log("SUCCESS: Logged in.");
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}`);
    process.exit(1);
  }
}

export async function meCommand(): Promise<void> {
  const { createClient } = await import("../client");
  const client = createClient();
  try {
    const res = await client.get("/api/agent/v1/me");
    const { user, brands, activeBrandId, credits, freeTierRemaining, scope, keyName } = res.data;
    console.log("\n=== PostKing Account ===");
    console.log(`User:            ${user?.email ?? "—"}`);
    console.log(`Key:             ${keyName ?? "—"} (${scope ?? "write"})`);
    console.log(`Credits:         ${credits ?? 0}`);
    console.log(`Free remaining:  ${freeTierRemaining ?? "—"}`);
    console.log(`Active brand:    ${activeBrandId ?? "none"}`);
    console.log(`Brands:          ${(brands ?? []).length}`);
    (brands ?? []).forEach((b: { brandId: string; name: string }) => {
      console.log(`  - ${b.brandId}  ${b.name}`);
    });
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

import { createClient } from "../client";

interface ApiKey {
  id: string;
  clientName?: string | null;
  prefix?: string;
  scope?: string;
  createdAt?: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export async function keysListCommand(): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get("/api/agent/v1/keys");
    const keys: ApiKey[] = res.data.keys || res.data || [];
    if (keys.length === 0) {
      console.log("No API keys found.");
      return;
    }
    console.log(`\nAPI Keys (${keys.length}):\n`);
    keys.forEach((k) => {
      const label = k.clientName || "(unnamed)";
      const status = k.revokedAt ? "REVOKED" : "active";
      console.log(`  ${k.id}  ${label}  [${k.scope ?? "write"}]  ${status}`);
      if (k.prefix) console.log(`    prefix: ${k.prefix}...`);
    });
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function keysCreateCommand(options: {
  name?: string;
  scope?: string;
}): Promise<void> {
  const client = createClient();
  const name = options.name ?? "pking-cli";
  try {
    const res = await client.post("/api/agent/v1/keys", {
      name,
      clientName: options.name,
      scope: options.scope ?? "write",
    });
    const { key, token } = res.data;
    console.log("\nSUCCESS: API key created.");
    console.log(`Name:  ${key?.name ?? name}`);
    console.log(`ID:    ${key?.id ?? "—"}`);
    console.log(`Token: ${token}`);
    console.log("\nWARNING: This is the ONLY time the raw token will be shown. Store it now.");
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function keysRevokeCommand(keyId: string): Promise<void> {
  const client = createClient();
  try {
    await client.delete(`/api/agent/v1/keys/${keyId}`);
    console.log(`SUCCESS: API key ${keyId} revoked.`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

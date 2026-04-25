import { createClient } from "../client";
import { getBrandId } from "../config";

export async function domainsAddCommand(domain: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  try {
    const res = await client.post(`/api/agent/v1/domains`, { domain, brandId });
    console.log(`SUCCESS: Domain ${domain} added. ID: ${res.data.id}`);
    if (res.data?.verificationToken) {
      console.log("HUMAN_ACTION_REQUIRED: Add this DNS TXT record:");
      console.log(`  TXT  @  ${res.data.verificationToken}`);
    }
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function domainsDeleteCommand(id: string): Promise<void> {
  const client = createClient();
  try {
    await client.delete(`/api/agent/v1/domains/${id}`);
    console.log(`SUCCESS: Domain ${id} removed.`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function domainsConnectCommand(
  id: string,
  options: { target: string }
): Promise<void> {
  const client = createClient();
  try {
    await client.post(`/api/agent/v1/domains/${id}/connect`, { target: options.target });
    console.log(`SUCCESS: Domain ${id} connected to ${options.target}.`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

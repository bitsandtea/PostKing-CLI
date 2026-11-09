import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";
import { lpConnectDomainCommand } from "./lp";

export async function domainsAddCommand(
  domain: string,
  options: { hostingMode?: "postking" | "self_hosted" } = {}
): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  try {
    const res = await client.post(`/api/agent/v1/domains`, {
      domain,
      brandId,
      hostingMode: options.hostingMode,
    });
    console.log(`SUCCESS: Domain ${domain} added. ID: ${res.data.id}`);
    if (options.hostingMode === "self_hosted") {
      console.log(
        "Hosting mode: self_hosted — your own infra serves this domain. Verification checks the TXT ownership record only (no A record)."
      );
    }
    if (res.data?.verificationToken) {
      console.log("HUMAN_ACTION_REQUIRED: Add this DNS TXT record:");
      console.log(`  TXT  @  ${res.data.verificationToken}`);
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function domainsDeleteCommand(id: string): Promise<void> {
  const client = createClient();
  try {
    await client.delete(`/api/agent/v1/domains/${id}`);
    console.log(`SUCCESS: Domain ${id} removed.`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function domainsConnectCommand(
  id: string,
  options: { target: string; routingType?: "path" | "root" | "subdomain"; pathPrefix?: string }
): Promise<void> {
  // There is no generic `/domains/{id}/connect` endpoint — route by target
  // kind to the endpoint that actually does the connecting.
  const sep = options.target.indexOf(":");
  const kind = sep > 0 ? options.target.slice(0, sep) : "";
  const ref = sep > 0 ? options.target.slice(sep + 1) : "";
  if (!ref || (kind !== "lp" && kind !== "publication")) {
    console.error("ERROR: --target must be 'lp:<slug>' or 'publication:<id>'.");
    process.exit(1);
  }

  if (kind === "lp") {
    await lpConnectDomainCommand(ref, { domainId: id });
    return;
  }

  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  const client = createClient();
  try {
    await client.patch(`/api/agent/v1/brands/${brandId}/publications/${ref}`, {
      domainId: id,
      routingType: options.routingType,
      pathPrefix: options.pathPrefix,
    });
    console.log(`SUCCESS: Domain ${id} connected to publication ${ref}.`);
    if (options.routingType === "subdomain") {
      console.log(
        "HUMAN_ACTION_REQUIRED: subdomain routing created a separate 'blog.<domain>' domain — add and verify its DNS before it resolves."
      );
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    console.error(`ERROR: ${extractApiError(err)}`);
    if (status === 409) {
      console.error(
        "-> Hint: run 'pking publications set-hosting " +
          ref +
          " <postking|self_hosted>' to match the domain's hostingMode, or add a domain with the matching --hosting-mode, then retry."
      );
    }
    process.exit(1);
  }
}

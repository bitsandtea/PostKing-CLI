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

interface HostingSwitchResponse {
  dryRun?: boolean;
  domain?: string;
  hostingMode?: string;
  alreadyInTargetMode?: boolean;
  changes?: {
    domain?: { from: string; to: string } | null;
    landingPages?: { slug: string; from: string; to: string }[];
    blogs?: { id: string; from: string; to: string; routingDefault?: { routingType: string; pathPrefix: string } }[];
  };
  indexNow?: string;
}

/** Human-readable lines for a hosting-mode switch (or its dry run). Pure — unit tested. */
export function formatHostingSwitch(res: HostingSwitchResponse, requestedMode: string): string[] {
  const lines: string[] = [];
  const name = res.domain ?? "domain";
  if (res.alreadyInTargetMode) {
    lines.push(`${name} is already in ${res.hostingMode ?? requestedMode} mode — nothing to change.`);
    return lines;
  }
  lines.push(res.dryRun ? `DRY RUN: switching ${name} to ${res.hostingMode ?? requestedMode} would change:` : `Switched ${name} to ${res.hostingMode ?? requestedMode}:`);
  const c = res.changes ?? {};
  if (c.domain) lines.push(`  domain        ${name}: ${c.domain.from} -> ${c.domain.to}`);
  for (const p of c.landingPages ?? []) lines.push(`  landing page  ${p.slug}: ${p.from} -> ${p.to}`);
  for (const b of c.blogs ?? []) {
    const routing = b.routingDefault ? ` (routing defaults to ${b.routingDefault.routingType} ${b.routingDefault.pathPrefix})` : "";
    lines.push(`  blog          ${b.id}: ${b.from} -> ${b.to}${routing}`);
  }
  if (!res.dryRun && res.indexNow) lines.push(`IndexNow key file: ${res.indexNow}`);
  return lines;
}

export async function domainsSwitchHostingCommand(
  id: string,
  options: { mode: string; dryRun?: boolean; json?: boolean }
): Promise<void> {
  if (options.mode !== "postking" && options.mode !== "self_hosted") {
    console.error("ERROR: --mode must be 'postking' or 'self_hosted'.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/domains/${id}/hosting-mode`, {
      hostingMode: options.mode,
      dryRun: options.dryRun === true ? true : undefined,
    });
    if (options.json) {
      console.log(JSON.stringify(res.data, null, 2));
      return;
    }
    for (const line of formatHostingSwitch(res.data, options.mode)) console.log(line);
    if (res.data?.dryRun) console.log("Nothing was written. Re-run without --dry-run to apply.");
    else if (!res.data?.alreadyInTargetMode) console.log("SUCCESS: nothing was disconnected; canonicals, routing and URLs are untouched.");
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    console.error(`ERROR: ${extractApiError(err)}`);
    if (status === 409) {
      console.error(
        "-> Hint: 'domain_not_verified' — run 'pking domains verify <domain>' first. 'external_attachments' — an external-mode landing page or blog is attached; change or detach it, then retry."
      );
    }
    process.exit(1);
  }
}

export async function domainsSetRevalidateSecretCommand(
  id: string,
  options: { secret?: string; clear?: boolean }
): Promise<void> {
  if ((options.secret === undefined) === (options.clear !== true)) {
    console.error("ERROR: Pass exactly one of --secret <value> (min 16 characters) or --clear.");
    process.exit(1);
  }
  if (options.secret !== undefined && options.secret.length < 16) {
    console.error("ERROR: --secret must be at least 16 characters.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.put(`/api/agent/v1/domains/${id}`, {
      revalidateSecret: options.clear === true ? null : options.secret,
    });
    const d = res.data?.domain ?? res.data;
    console.log(
      d?.hasRevalidateSecret
        ? `SUCCESS: Revalidate secret set for domain ${id}. It is write-only and will not be shown again.`
        : `SUCCESS: Revalidate secret cleared for domain ${id}.`
    );
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

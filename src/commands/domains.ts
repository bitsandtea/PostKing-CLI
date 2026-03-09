import { createClient } from "../client";
import { getBrandId } from "../config";

interface Domain {
  id: string;
  domain: string;
  isPrimary: boolean;
  sslStatus?: string;
  verificationStatus?: string;
  verificationToken?: string;
}

export async function domainsListCommand(): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'pking brand set <brand_id>' first.");
    process.exit(1);
  }

  try {
    const res = await client.get(`/api/domains?brandId=${brandId}`);
    const domains: Domain[] = res.data.domains || [];

    if (domains.length === 0) {
      console.log("No domains configured for this brand.");
      console.log("Add a domain at postking.app/dashboard");
      return;
    }

    console.log(`Domains for brand ${brandId} (${domains.length}):\n`);
    domains.forEach((d) => {
      const status = d.verificationStatus || d.sslStatus || "unknown";
      const primary = d.isPrimary ? " [PRIMARY]" : "";
      console.log(`  Domain:  ${d.domain}${primary}`);
      console.log(`  ID:      ${d.id}`);
      console.log(`  Status:  ${status}`);
      if (d.verificationToken) {
        console.log(`  Token:   ${d.verificationToken}`);
      }
      console.log("");
    });
  } catch (err: unknown) {
    process.exit(1);
  }
}

export async function domainsVerifyCommand(domain: string): Promise<void> {
  const client = createClient();
  const brandId = getBrandId();

  if (!brandId) {
    console.error("ERROR: No active brand selected.");
    console.error("Run 'postking brand set <brand_id>' first.");
    process.exit(1);
  }

  // Normalize: strip protocol and www
  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  try {
    // Resolve domain ID first
    const listRes = await client.get(`/api/domains?brandId=${brandId}`);
    const domains: Domain[] = listRes.data.domains || [];

    const record = domains.find(
      (d) => d.domain === cleanDomain || d.domain === domain
    );

    if (!record) {
      console.error(`ERROR: Domain '${cleanDomain}' is not configured for this brand.`);
      console.error("Run 'pking domains list' to see all configured domains.");
      process.exit(1);
    }

    const res = await client.post(`/api/domains/${record.id}/verify`);
    const result = res.data;

    if (result.verified || result.success || result.domain?.verificationStatus === "verified") {
      console.log(`SUCCESS: Domain ${cleanDomain} is verified and active.`);
      if (result.domain?.sslStatus) {
        console.log(`SSL Status: ${result.domain.sslStatus}`);
      }
    } else {
      console.log(`PENDING: Domain ${cleanDomain} is not yet verified.\n`);

      const token = result.verificationToken || record.verificationToken;
      if (token) {
        console.log("HUMAN_ACTION_REQUIRED: Add this DNS TXT record at your domain registrar:\n");
        console.log(`  Type:  TXT`);
        console.log(`  Name:  @  (or your root domain)`);
        console.log(`  Value: ${token}\n`);
        console.log("After adding the DNS record (may take up to 48h to propagate),");
        console.log("run 'pking domains verify " + cleanDomain + "' again to check status.");
      }
    }
  } catch (err: unknown) {
    process.exit(1);
  }
}

import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError, printLanguageGateError } from "../api-error";
import { validateLanguageFlag } from "../constants";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

export async function publicationsListCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/blogs`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const publications = res.data.publications ?? [];
    console.log(`\nPublications (${publications.length}):`);
    publications.forEach((p: { id: string; title: string; description?: string; languageCode?: string | null; hostingMode?: string | null }) => {
      console.log(`  ${p.id}  [${p.languageCode ?? "unset"}]  [${p.hostingMode ?? "postking"}]  ${p.title}`);
      if (p.description) console.log(`    ${p.description}`);
    });
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function publicationsCreateCommand(options: {
  title: string;
  description?: string;
  languageCode?: string;
}): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const languageCode = validateLanguageFlag(options.languageCode);
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/blogs`, {
      title: options.title,
      description: options.description,
      languageCode,
    });
    const blog = res.data.blog ?? res.data;
    console.log(`SUCCESS: Publication created. ID: ${blog?.id ?? res.data.id}`);
    if (blog?.languageCode) console.log(`Language: ${blog.languageCode}`);
  } catch (err) {
    if (printLanguageGateError(err, languageCode)) process.exit(1);
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

/**
 * Set whether a blog publication is served by PostKing ('postking', default)
 * or by the customer's own app ('self_hosted' — they render the blog against
 * the public /api/blog-posts?blogId=<publicationId> API; an optional example
 * is https://github.com/bitsandtea/postking-selfhost). The connected domain's
 * hostingMode must match, else the server 409s with hosting_mode_mismatch.
 */
export async function publicationsSetHostingCommand(
  publicationId: string,
  hostingMode: "postking" | "self_hosted",
  options: { json?: boolean } = {}
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/publications/${publicationId}`, { hostingMode });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const pub = res.data?.publication ?? res.data;
    console.log(`SUCCESS: Publication ${publicationId} hostingMode set to ${pub?.hostingMode ?? hostingMode}.`);
    if (hostingMode === "self_hosted") {
      console.log(
        "Render the blog against GET /api/blog-posts?blogId=" + publicationId + ". For a production host: " +
          "'pking domains add <domain> --hosting-mode self_hosted', verify it, then " +
          "'pking domains connect <id> --target publication:" + publicationId + "'."
      );
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    console.error(`ERROR: ${extractApiError(err)}`);
    if (status === 409) {
      console.error(
        "-> Hint: disconnect the publication's domain, or add a domain whose --hosting-mode matches, then retry."
      );
    }
    process.exit(1);
  }
}

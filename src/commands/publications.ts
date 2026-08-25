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
    publications.forEach((p: { id: string; title: string; description?: string; languageCode?: string | null }) => {
      console.log(`  ${p.id}  [${p.languageCode ?? "unset"}]  ${p.title}`);
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

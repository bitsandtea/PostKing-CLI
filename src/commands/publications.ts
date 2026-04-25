import { createClient } from "../client";
import { getBrandId } from "../config";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

export async function publicationsListCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/blogs`);
    const publications = res.data.publications ?? [];
    console.log(`\nPublications (${publications.length}):`);
    publications.forEach((p: { id: string; title: string; description?: string }) => {
      console.log(`  ${p.id}  ${p.title}`);
      if (p.description) console.log(`    ${p.description}`);
    });
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function publicationsCreateCommand(options: {
  title: string;
  description?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/blogs`, {
      title: options.title,
      description: options.description,
    });
    console.log(`SUCCESS: Publication created. ID: ${res.data.id}`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

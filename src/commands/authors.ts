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

export async function authorsListCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/authors`);
    const authors = res.data.authors ?? res.data ?? [];
    console.log(`\nAuthors (${authors.length}):`);
    authors.forEach(
      (a: { id: string; authorFirstName?: string; authorLastName?: string; authorEmail?: string }) => {
        const name = `${a.authorFirstName ?? ""} ${a.authorLastName ?? ""}`.trim();
        console.log(`  ${a.id}  ${name}  ${a.authorEmail ?? ""}`);
      }
    );
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function authorsCreateCommand(options: {
  firstName: string;
  lastName: string;
  email?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/authors`, {
      authorFirstName: options.firstName,
      authorLastName: options.lastName,
      authorEmail: options.email,
    });
    console.log(`SUCCESS: Author created. ID: ${res.data.id ?? res.data.author?.id}`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function categoriesListCommand(options: { publication: string }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/blogs/${options.publication}/categories`
    );
    const categories = res.data.categories ?? res.data ?? [];
    console.log(`\nCategories (${categories.length}):`);
    categories.forEach((c: { id: string; name: string; slug: string }) =>
      console.log(`  ${c.id}  ${c.name}  (/${c.slug})`)
    );
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function categoriesCreateCommand(options: {
  publication: string;
  name: string;
  slug: string;
  description?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/blogs/${options.publication}/categories`,
      {
        name: options.name,
        slug: options.slug,
        description: options.description,
      }
    );
    console.log(`SUCCESS: Category created. ID: ${res.data.id ?? res.data.category?.id}`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

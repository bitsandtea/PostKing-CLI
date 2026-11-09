import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

export async function authorsListCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/authors`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const authors = res.data.authors ?? res.data ?? [];
    console.log(`\nAuthors (${authors.length}):`);
    authors.forEach(
      (a: { id: string; authorFirstName?: string; authorLastName?: string; authorEmail?: string; isBrandDefault?: boolean }) => {
        const name = `${a.authorFirstName ?? ""} ${a.authorLastName ?? ""}`.trim();
        console.log(`  ${a.id}  ${name}  ${a.authorEmail ?? ""}${a.isBrandDefault ? "  (brand default)" : ""}`);
      }
    );
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
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
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function authorsUpdateCommand(options: {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  url?: string;
  about?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
  avatar?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    await client.patch(`/api/agent/v1/brands/${brandId}/authors/${options.id}`, {
      authorFirstName: options.firstName,
      authorLastName: options.lastName,
      authorEmail: options.email,
      authorUrl: options.url,
      authorAbout: options.about,
      authorLinkedin: options.linkedin,
      authorTwitter: options.twitter,
      authorYoutube: options.youtube,
      authorWebsite: options.website,
      authorAvatar: options.avatar,
    });
    console.log(`SUCCESS: Author ${options.id} updated.`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function authorsGenerateCommand(options: { language?: string; preview?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/authors/generate`, {
      language: options.language,
      save: options.preview ? false : undefined,
    });
    if (options.preview) { console.log(JSON.stringify(res.data.preview, null, 2)); return; }
    console.log(`SUCCESS: Author generated. ID: ${res.data.author?.id}`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function categoriesListCommand(options: { publication: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/blogs/${options.publication}/categories`
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const categories = res.data.categories ?? res.data ?? [];
    console.log(`\nCategories (${categories.length}):`);
    categories.forEach((c: { id: string; name: string; slug: string }) =>
      console.log(`  ${c.id}  ${c.name}  (/${c.slug})`)
    );
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
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
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

export async function authorsSetDefaultCommand(
  authorId: string | undefined,
  options: { publication?: string; clear?: boolean }
): Promise<void> {
  if (!authorId && !options.clear) {
    console.error("ERROR: Pass an author ID, or --clear to unset the default.");
    process.exit(1);
  }
  if (authorId && options.clear) {
    console.error("ERROR: Pass either an author ID or --clear, not both.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = requireBrand();
  try {
    await client.put(`/api/agent/v1/brands/${brandId}/authors/default`, {
      authorId: options.clear ? null : authorId,
      ...(options.publication ? { publicationId: options.publication } : {}),
    });
    const scope = options.publication ? `publication ${options.publication}` : "brand";
    console.log(options.clear ? `SUCCESS: Default author cleared for ${scope}.` : `SUCCESS: Default author for ${scope} set to ${authorId}.`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

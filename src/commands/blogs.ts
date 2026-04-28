import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set. Run 'pking brand set <id>' first.");
    process.exit(1);
  }
  return brandId;
}

export async function blogsListCommand(options: { status?: string }): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/blogs`);
    const publications = res.data.publications ?? [];
    const articles = (res.data.blogs ?? res.data.articles ?? []).filter((a: { status: string }) =>
      options.status ? a.status === options.status : true
    );
    console.log(`\nPublications (${publications.length}):`);
    publications.forEach((p: { id: string; title: string }) =>
      console.log(`  ${p.id}  ${p.title}`)
    );
    console.log(`\nArticles (${articles.length}):`);
    articles.forEach((a: { id: string; postTitle?: string; title?: string; status: string }) =>
      console.log(`  ${a.id}  [${a.status}]  ${a.postTitle ?? a.title ?? ""}`)
    );
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function blogsCreateCommand(options: {
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

export async function blogsGenerateCommand(options: {
  publication: string;
  topic: string;
  voice?: string;
  length?: string;
  keywords?: string;
  wait?: boolean;
  timeout?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/blogs/${options.publication}/generate`,
      {
        topic: options.topic,
        voiceProfileId: options.voice,
        targetLength: options.length ?? "medium",
        primaryKeywords: options.keywords ? options.keywords.split(",").map((s) => s.trim()) : undefined,
      }
    );
    const data = res.data ?? {};
    const article = data.article ?? data;
    const id = article?.id ?? data.blogId;
    const title = article?.postTitle ?? article?.title;
    console.log(`SUCCESS: Article generation started. ID: ${id ?? "(unknown)"}`);
    if (title) console.log(`Title: ${title}`);
    const statusUrl = id ? `/api/agent/v1/brands/${brandId}/blogs/${id}/status` : null;
    if (statusUrl) console.log(`Poll:  ${statusUrl}`);
    printWebUrl(res.data);

    if (options.wait && id) {
      const timeoutMs = Math.max(10, Number(options.timeout ?? "600")) * 1000;
      console.log(`\nWaiting for completion (timeout ${timeoutMs / 1000}s)…`);
      const result = await pollBlogStatus(client, brandId, id, timeoutMs);
      if (result.completed) {
        console.log(`DONE:  ${result.message ?? "Article ready."}`);
        console.log(`View:  pking blogs view ${id}`);
      } else {
        console.error(`TIMEOUT: still ${result.lastStatus ?? "running"} after ${timeoutMs / 1000}s. Check 'pking blogs status ${id}'.`);
        process.exit(1);
      }
    }
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

interface OperationStatus {
  status?: string;
  progress?: { current?: number; total?: number; message?: string };
  error?: string;
}

async function fetchBlogStatus(
  client: ReturnType<typeof createClient>,
  brandId: string,
  blogId: string
): Promise<OperationStatus | null> {
  const res = await client.get(`/api/agent/v1/brands/${brandId}/blogs/${blogId}/status`);
  return (res.data?.operationStatus ?? null) as OperationStatus | null;
}

async function pollBlogStatus(
  client: ReturnType<typeof createClient>,
  brandId: string,
  blogId: string,
  timeoutMs: number
): Promise<{ completed: boolean; message?: string; lastStatus?: string }> {
  const start = Date.now();
  let lastPrinted = "";
  let lastStatus: string | undefined;
  while (Date.now() - start < timeoutMs) {
    try {
      const op = await fetchBlogStatus(client, brandId, blogId);
      lastStatus = op?.status;
      const line = op?.progress?.message
        ? `  [${op.progress.current ?? "?"}/${op.progress.total ?? "?"}] ${op.progress.message}`
        : op?.status
        ? `  status: ${op.status}`
        : "  (no status yet)";
      if (line !== lastPrinted) {
        console.log(line);
        lastPrinted = line;
      }
      if (op?.status === "completed" || op?.status === "success") {
        return { completed: true, message: op?.progress?.message, lastStatus };
      }
      if (op?.status === "failed" || op?.status === "error") {
        console.error(`FAILED: ${op?.error ?? op?.progress?.message ?? "unknown error"}`);
        process.exit(1);
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { completed: false, lastStatus };
}

export async function blogsStatusCommand(blogId: string): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const op = await fetchBlogStatus(client, brandId, blogId);
    if (!op) {
      console.log(`No status recorded for ${blogId}.`);
      return;
    }
    console.log(`Status:   ${op.status ?? "(unknown)"}`);
    if (op.progress) {
      console.log(`Progress: ${op.progress.current ?? "?"}/${op.progress.total ?? "?"} ${op.progress.message ?? ""}`);
    }
    if (op.error) console.log(`Error:    ${op.error}`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function blogsPublishCommand(
  articleId: string,
  options: { connections?: string }
): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/blogs/${articleId}/publish`,
      {
        connectionIds: options.connections
          ? options.connections.split(",").map((s) => s.trim())
          : undefined,
      }
    );
    console.log(`SUCCESS: Publish requested for article ${articleId}.`);
    printWebUrl(res.data);
    if (res.data?.checkoutUrl) {
      console.log(`-> Upgrade: ${res.data.checkoutUrl}`);
    }
  } catch (err) {
    const e = err as {
      response?: { data?: { error?: { message?: string; checkoutUrl?: string } } };
      message: string;
    };
    const env = e.response?.data?.error;
    console.error(`ERROR: ${env?.message ?? e.message}`);
    if (env?.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
    process.exit(1);
  }
}

export async function blogsViewCommand(articleId: string): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/blogs/${articleId}`);
    const a = res.data.article ?? res.data;
    console.log(`\n[${a.id}] ${a.postTitle ?? a.title}`);
    console.log(`Status:  ${a.status}`);
    console.log(`Slug:    ${a.postSlug ?? a.slug}`);
    console.log(`Excerpt: ${a.postExcerpt ?? ""}`);
    console.log(`\n${(a.postText ?? "").slice(0, 3000)}`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

export async function blogsDeleteCommand(articleId: string): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    await client.delete(`/api/agent/v1/brands/${brandId}/blogs/${articleId}`);
    console.log(`SUCCESS: Article ${articleId} deleted.`);
  } catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } }; message: string };
    console.error(`ERROR: ${e.response?.data?.error?.message ?? e.message}`);
    process.exit(1);
  }
}

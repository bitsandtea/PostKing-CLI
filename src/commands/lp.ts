import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";

function requireBrand(): string {
  const brandId = getBrandId();
  if (!brandId) {
    console.error("ERROR: No active brand set.");
    process.exit(1);
  }
  return brandId;
}

type ErrorEnvelope = {
  message?: string;
  checkoutUrl?: string;
  docsUrl?: string;
  retryable?: boolean;
};

function printError(err: unknown): void {
  const e = err as {
    response?: {
      status?: number;
      headers?: Record<string, string>;
      data?: { error?: ErrorEnvelope };
    };
    message: string;
  };
  const env = e.response?.data?.error;
  if (env) {
    console.error(`ERROR: ${env.message ?? "(no message)"}`);
    if (env.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
    if (env.docsUrl) console.error(`-> Docs: ${env.docsUrl}`);
  } else {
    console.error(`ERROR: ${e.message}`);
  }
}

function emitJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

interface LandingPage {
  id: string;
  slug: string;
  title?: string;
  status?: string;
}

export async function lpListCommand(): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/landing-pages`);
    const pages: LandingPage[] = res.data.landingPages ?? res.data.pages ?? res.data ?? [];
    console.log(`\nLanding Pages (${pages.length}):`);
    pages.forEach((p) =>
      console.log(`  ${p.slug}  [${p.status ?? "draft"}]  ${p.title ?? ""}`)
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpGenerateCommand(options: {
  topic: string;
  slug?: string;
  voice?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/landing-pages`, {
      topic: options.topic,
      slug: options.slug,
      voiceProfileId: options.voice,
    });
    const slug = res.data.slug ?? res.data.landingPage?.slug;
    console.log(`SUCCESS: Landing page generation started. Slug: ${slug}`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpEditCommand(
  slug: string,
  options: { title?: string; instructions?: string }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.patch(`/api/agent/v1/landing-pages/${slug}`, {
      title: options.title,
      instructions: options.instructions,
    });
    console.log(`SUCCESS: Landing page ${slug} updated.`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpPublishCommand(slug: string): Promise<void> {
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/publish`);
    console.log(`SUCCESS: Landing page ${slug} published.`);
    if (res.data?.url) console.log(`URL: ${res.data.url}`);
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpViewCommand(slug: string): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}`);
    const p = res.data.landingPage ?? res.data;
    console.log(`\n[${p.slug}] ${p.title ?? ""}`);
    console.log(`Status: ${p.status}`);
    console.log(`Content: ${(p.content ?? "").slice(0, 2000)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideListCommand(slug: string, options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/side-pages`);
    if (options.json) { emitJson(res.data); return; }
    const pages = res.data.sidePages ?? res.data ?? [];
    console.log(`\nSide Pages for ${slug} (${pages.length}):`);
    pages.forEach((p: { sidePageKey?: string; slug?: string; title?: string }) =>
      console.log(`  ${p.sidePageKey ?? p.slug}  ${p.title ?? ""}`)
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideGenerateCommand(
  slug: string,
  options: { type: string; count?: string }
): Promise<void> {
  const client = createClient();
  try {
    await client.post(`/api/agent/v1/landing-pages/${slug}/side-pages`, {
      type: options.type,
      count: options.count ? parseInt(options.count, 10) : 1,
    });
    console.log(`SUCCESS: Side-page generation started for ${slug}.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideEditCommand(
  slug: string,
  sideKey: string,
  options: { instructions?: string }
): Promise<void> {
  const client = createClient();
  try {
    await client.patch(`/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}`, {
      instructions: options.instructions,
    });
    console.log(`SUCCESS: Side page ${sideKey} updated.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.1 additions ────────────────────────────────────────────────────────────

export async function lpDeleteCommand(
  slug: string,
  options: { destructive?: boolean; json?: boolean }
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.delete(`/api/agent/v1/landing-pages/${slug}`);
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Landing page "${slug}" deleted.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideDeleteCommand(
  slug: string,
  sideKey: string,
  options: { destructive?: boolean; json?: boolean }
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.delete(`/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}`);
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Side page "${sideKey}" deleted from "${slug}".`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideViewCommand(
  slug: string,
  sideKey: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}`);
    if (options.json) { emitJson(res.data); return; }
    const p = res.data.sidePage ?? res.data;
    console.log(`\n[${slug}/${sideKey}] ${p.title ?? ""}`);
    if (p.status !== undefined) console.log(`Status: ${p.status}`);
    if (p.published !== undefined) console.log(`Published: ${p.published}`);
    const sections = p.sections ?? [];
    if (sections.length > 0) {
      console.log(`Sections (${sections.length}):`);
      sections.forEach((s: { id?: string; type?: string }) =>
        console.log(`  ${s.id ?? "—"}  [${s.type ?? "—"}]`)
      );
    }
    if (p.content) console.log(`\nContent:\n${String(p.content).slice(0, 2000)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.2 — Landing-page regeneration ──────────────────────────────────────────

export async function lpRegenerateCommand(
  slug: string,
  options: { voice?: string; instructions?: string; section?: string[]; json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const body: Record<string, unknown> = {};
    if (options.voice) body.voiceProfileId = options.voice;
    if (options.instructions) body.instructions = options.instructions;
    if (options.section && options.section.length > 0) body.sections = options.section;
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/generate`, body);
    if (options.json) { emitJson(res.data); return; }
    const opId = res.data.operationId ?? res.data.operation_id;
    if (opId) {
      console.log(`SUCCESS: Regeneration started.`);
      console.log(`OperationId: ${opId}`);
    } else {
      console.log(`SUCCESS: Landing page "${slug}" regenerated.`);
      if (res.data.slug) console.log(`Slug: ${res.data.slug}`);
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.3 — Vibe edit ──────────────────────────────────────────────────────────

const VIBE_POLL_INTERVAL_MS = 2_000;
const VIBE_POLL_MAX_MS = 120_000;
const VIBE_TERMINAL = new Set(["completed", "failed"]);

export async function lpVibeCommand(
  slug: string,
  options: {
    instructions: string;
    scope?: string;
    sectionId?: string;
    wait?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const client = createClient();
  try {
    const body: Record<string, unknown> = { instructions: options.instructions };
    if (options.scope) body.scope = options.scope;
    if (options.sectionId) body.sectionId = options.sectionId;
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/ai-edit`, body);
    const { operationId, sessionId } = res.data as { operationId: string; sessionId?: string };

    if (!options.wait) {
      if (options.json) { emitJson(res.data); return; }
      console.log(`SUCCESS: Vibe edit started.`);
      console.log(`OperationId: ${operationId}`);
      if (sessionId) console.log(`SessionId: ${sessionId}`);
      return;
    }

    // --wait: poll until terminal
    const deadline = Date.now() + VIBE_POLL_MAX_MS;
    let lastStatus = "";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, VIBE_POLL_INTERVAL_MS));
      const poll = await client.get(
        `/api/agent/v1/landing-pages/${slug}/ai-edit/status/${operationId}`
      );
      const status: string = poll.data.status ?? "pending";
      if (status !== lastStatus) {
        process.stdout.write(`\r[PROCESSING] ${status}                    \n`);
        lastStatus = status;
      } else {
        process.stdout.write(`\r[PROCESSING] ${status}...`);
      }
      if (VIBE_TERMINAL.has(status)) {
        if (options.json) { emitJson(poll.data); return; }
        if (status === "completed") {
          console.log(`\nSUCCESS: Vibe edit completed.`);
          if (poll.data.result) console.log(`Result: ${JSON.stringify(poll.data.result).slice(0, 400)}`);
        } else {
          console.error(`\nERROR: Vibe edit failed.`);
          process.exit(1);
        }
        return;
      }
    }
    console.error(`\nERROR: Timed out waiting for vibe edit (${VIBE_POLL_MAX_MS / 1000}s).`);
    process.exit(1);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpVibeStatusCommand(
  slug: string,
  operationId: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(
      `/api/agent/v1/landing-pages/${slug}/ai-edit/status/${operationId}`
    );
    if (options.json) { emitJson(res.data); return; }
    const status: string = res.data.status ?? "unknown";
    console.log(`Status: ${status}`);
    if (res.data.progress !== undefined) console.log(`Progress: ${res.data.progress}`);
    if (res.data.result) console.log(`Result: ${JSON.stringify(res.data.result).slice(0, 400)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.4 — Manual content edit ────────────────────────────────────────────────

const LP_SET_STDIN_MAX = 2 * 1024 * 1024; // 2 MB

async function readFileOrStdin(filePath: string): Promise<string> {
  if (filePath === "-") {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      process.stdin.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > LP_SET_STDIN_MAX) {
          reject(new Error("stdin exceeds 2 MB limit"));
          process.stdin.destroy();
          return;
        }
        chunks.push(chunk);
      });
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      process.stdin.on("error", reject);
    });
  }
  const { readFileSync } = await import("node:fs");
  return readFileSync(filePath, "utf8");
}

export async function lpSetCommand(
  slug: string,
  options: {
    title?: string;
    file?: string;
    metadataFile?: string;
    json?: boolean;
  }
): Promise<void> {
  if (!options.title && !options.file && !options.metadataFile) {
    console.error("ERROR: Provide at least one of --title, --file, or --metadata-file.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const body: Record<string, unknown> = {};
    if (options.title) body.title = options.title;
    if (options.file) body.content = await readFileOrStdin(options.file);
    if (options.metadataFile) {
      const raw = await readFileOrStdin(options.metadataFile);
      body.metadata = JSON.parse(raw) as Record<string, unknown>;
    }
    const res = await client.put(`/api/agent/v1/landing-pages/${slug}/content`, body);
    if (options.json) { emitJson(res.data); return; }
    const versionId = res.data.versionId ?? res.data.version_id;
    console.log(`SUCCESS: Landing page "${slug}" updated.`);
    if (versionId !== undefined) console.log(`VersionId: ${versionId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.5 — Side-page section + state ──────────────────────────────────────────

export async function lpSideSectionCommand(
  slug: string,
  sideKey: string,
  options: {
    id: string;
    content?: string;
    file?: string;
    instructions?: string;
    json?: boolean;
  }
): Promise<void> {
  const client = createClient();
  try {
    const body: Record<string, unknown> = { sectionId: options.id };
    if (options.file) {
      body.content = await readFileOrStdin(options.file);
    } else if (options.content) {
      body.content = options.content;
    }
    if (options.instructions) body.instructions = options.instructions;
    const res = await client.patch(
      `/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}/section`,
      body
    );
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Section "${options.id}" updated on side page "${sideKey}".`);
    const sec = res.data.section ?? res.data;
    if (sec?.content) console.log(`Content: ${String(sec.content).slice(0, 400)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideStateCommand(
  slug: string,
  sideKey: string,
  options: { publish?: boolean; unpublish?: boolean; json?: boolean }
): Promise<void> {
  if (!options.publish && !options.unpublish) {
    console.error("ERROR: Pass --publish or --unpublish.");
    process.exit(1);
  }
  const published = !!options.publish;
  const client = createClient();
  try {
    const res = await client.post(
      `/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}/state`,
      { published }
    );
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Side page "${sideKey}" is now ${published ? "published" : "unpublished"}.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.6 — Side-page generate with --wait + side status ───────────────────────

const SIDE_POLL_INTERVAL_MS = 3_000;
const SIDE_POLL_MAX_MS = 5 * 60_000;

export async function lpSideStatusCommand(
  slug: string,
  operationId: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(
      `/api/agent/v1/landing-pages/${slug}/side-pages/generate/status/${operationId}`
    );
    if (options.json) { emitJson(res.data); return; }
    const opStatus = res.data.operationStatus ?? res.data;
    const status: string = opStatus?.status ?? res.data.status ?? "unknown";
    console.log(`Status: ${status}`);
    if (opStatus?.progress !== undefined) console.log(`Progress: ${opStatus.progress}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideGenerateWithWaitCommand(
  slug: string,
  options: { type: string; count?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/side-pages`, {
      type: options.type,
      count: options.count ? parseInt(options.count, 10) : 1,
    });

    if (!options.wait) {
      if (options.json) { emitJson(res.data); return; }
      console.log(`SUCCESS: Side-page generation started for ${slug}.`);
      const opId = res.data.operationId ?? res.data.operation_id;
      if (opId) console.log(`OperationId: ${opId}`);
      return;
    }

    const opId: string | undefined = res.data.operationId ?? res.data.operation_id;
    if (!opId) {
      if (options.json) { emitJson(res.data); return; }
      console.log(`SUCCESS: Side-page generation started for ${slug} (no operationId to poll).`);
      return;
    }

    const deadline = Date.now() + SIDE_POLL_MAX_MS;
    let lastStatus = "";
    // Per spec B.6: server clears operationStatus 5s after first completed read — stop on first terminal.
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, SIDE_POLL_INTERVAL_MS));
      const poll = await client.get(
        `/api/agent/v1/landing-pages/${slug}/side-pages/generate/status/${opId}`
      );
      const opStatus = poll.data.operationStatus ?? poll.data;
      const status: string = opStatus?.status ?? poll.data.status ?? "pending";
      if (status !== lastStatus) {
        process.stdout.write(`\r[PROCESSING] ${status}                    \n`);
        lastStatus = status;
      } else {
        process.stdout.write(`\r[PROCESSING] ${status}...`);
      }
      if (status === "completed") {
        if (options.json) { emitJson(poll.data); return; }
        console.log(`\nSUCCESS: Side-page generation completed for ${slug}.`);
        return;
      }
      if (status === "failed") {
        if (options.json) { emitJson(poll.data); return; }
        console.error(`\nERROR: Side-page generation failed.`);
        process.exit(1);
      }
    }
    console.error(`\nERROR: Timed out waiting for side-page generation (${SIDE_POLL_MAX_MS / 1000}s).`);
    process.exit(1);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── B.7 — Versions + draft ───────────────────────────────────────────────────

export async function lpVersionsListCommand(
  slug: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/versions`);
    if (options.json) { emitJson(res.data); return; }
    const versions: Array<{ id: number; name?: string; createdAt?: string }> =
      res.data.versions ?? [];
    console.log(`\nVersions for "${slug}" (${versions.length}):`);
    versions.forEach((v) =>
      console.log(`  ${v.id}  ${v.name ?? ""}  ${v.createdAt ?? ""}`)
    );
    if (res.data.currentVersionId !== undefined)
      console.log(`Current: ${res.data.currentVersionId}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpVersionsViewCommand(
  slug: string,
  versionId: string,
  options: { json?: boolean }
): Promise<void> {
  const numId = parseInt(versionId, 10);
  if (isNaN(numId) || String(numId) !== versionId) {
    console.error(`ERROR: versionId must be a numeric integer (got "${versionId}").`);
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/versions/${numId}`);
    if (options.json) { emitJson(res.data); return; }
    const v = res.data;
    console.log(`\n[Version ${v.id}] ${v.name ?? ""}`);
    if (v.data?.title) console.log(`Title: ${v.data.title}`);
    if (v.data?.content) console.log(`Content: ${String(v.data.content).slice(0, 2000)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpDraftViewCommand(
  slug: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/draft`);
    if (options.json) { emitJson(res.data); return; }
    const p = res.data;
    console.log(`\n[Draft: ${slug}] ${p.title ?? ""}`);
    if (p.status) console.log(`Status: ${p.status}`);
    if (p._meta) console.log(`Meta: ${JSON.stringify(p._meta)}`);
    if (p.content) console.log(`Content: ${String(p.content).slice(0, 2000)}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

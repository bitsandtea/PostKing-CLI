import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";
import { tickLine } from "../lib/ttyOutput";
import { validateLanguageFlag } from "../constants";

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
  languageCode?: string | null;
}

export async function lpListCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/landing-pages`);
    if (options.json) { emitJson(res.data); return; }
    const pages: LandingPage[] = res.data.landingPages ?? res.data.pages ?? res.data ?? [];
    console.log(`\nLanding Pages (${pages.length}):`);
    pages.forEach((p) =>
      console.log(`  ${p.slug}  [${p.status ?? "draft"}]  [${p.languageCode ?? "unset"}]  ${p.title ?? ""}`)
    );
    printWebUrl(res.data);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpGenerateCommand(options: {
  topic: string;
  slug?: string;
  voice?: string;
  language?: string;
}): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  const brandId = requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/landing-pages`, {
      topic: options.topic,
      slug: options.slug,
      voiceProfileId: options.voice,
      language,
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

/**
 * Set whether a landing page is served by PostKing ('hosted', the default)
 * or by the customer's own infra ('self_hosted' — they run their own
 * renderer against the public /api/landing-pages/{slug} API; an optional
 * reference implementation is https://github.com/bitsandtea/postking-selfhost).
 * If a Domain is already connected whose hostingMode disagrees with the new
 * value, the server 409s — disconnect that domain first (see the mode-match
 * rule on 'pking lp connect-domain').
 */
export async function lpSetDistributionCommand(
  slug: string,
  distribution: "hosted" | "self_hosted",
  options: { json?: boolean } = {}
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.patch(`/api/agent/v1/landing-pages/${slug}/distribution`, { distribution });
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Landing page "${slug}" distribution set to ${res.data?.distribution ?? distribution}.`);
    if (distribution === "self_hosted") {
      console.log(
        "Localhost testing works immediately against the public API. For a production host: " +
          "'pking domains add <domain> --hosting-mode self_hosted', verify it, then 'pking lp connect-domain'."
      );
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

/**
 * Attach an already-verified Domain to a landing page (page must be
 * published; requires paid access). The Domain's hostingMode must match
 * the page's distribution ('postking' <-> 'hosted', 'self_hosted' <->
 * 'self_hosted') — a mismatch 409s; the server's message names which side
 * to change, surfaced verbatim below plus an actionable hint.
 */
export async function lpConnectDomainCommand(
  slug: string,
  options: { domainId?: string; domain?: string; json?: boolean } = {}
): Promise<void> {
  if (!options.domainId && !options.domain) {
    console.error("ERROR: Provide --domain-id (preferred) or --domain.");
    process.exit(1);
  }
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/domain/connect`, {
      domainId: options.domainId,
      domain: options.domain,
    });
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Domain connected to landing page "${slug}".`);
    printWebUrl(res.data);
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 409) {
      printError(err);
      console.error(
        "-> Hint: run 'pking lp set-distribution " +
          slug +
          " <hosted|self_hosted>' to match the domain's hostingMode, or add a domain with the matching --hosting-mode, then retry."
      );
    } else {
      printError(err);
    }
    process.exit(1);
  }
}

export async function lpViewCommand(slug: string, options: { json?: boolean } = {}): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}`);
    if (options.json) { emitJson(res.data); return; }
    const p = res.data.landingPage ?? res.data;
    console.log(`\n[${p.slug}] ${p.title ?? ""}`);
    console.log(`Status: ${p.status}`);
    console.log(`Content: ${(p.content ?? "").slice(0, 2000)}`);
    printWebUrl(res.data);
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
    language?: string;
    wait?: boolean;
    json?: boolean;
  }
): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  try {
    const body: Record<string, unknown> = { instructions: options.instructions };
    if (options.scope) body.scope = options.scope;
    if (options.sectionId) body.sectionId = options.sectionId;
    if (language) body.language = language;
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
        tickLine(`[PROCESSING] ${status}                    \n`);
        lastStatus = status;
      } else {
        tickLine(`[PROCESSING] ${status}...`);
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
    fields?: string;
    file?: string;
    field?: string;
    value?: string;
    instructions?: string;
    language?: string;
    json?: boolean;
  }
): Promise<void> {
  // Validate the flag before anything else — a bad code should fail with the
  // list of valid ones, not an auth error or a server 400. Only consulted by
  // the server when --instructions triggers an AI-edit pass; silently ignored
  // for a plain --fields / --field write.
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  try {
    const body: Record<string, unknown> = { sectionId: options.id };
    // Structured section fields: from a JSON string or a JSON file/stdin.
    const rawFields = options.file
      ? await readFileOrStdin(options.file)
      : options.fields;
    if (rawFields) {
      try {
        body.fields = JSON.parse(rawFields);
      } catch {
        printError(new Error("--fields / --file must be valid JSON for a structured section object."));
        process.exit(1);
      }
    }
    if (options.field) {
      body.field = options.field;
      // Parse --value as JSON, falling back to the raw string when it isn't JSON.
      if (options.value !== undefined) {
        try {
          body.value = JSON.parse(options.value);
        } catch {
          body.value = options.value;
        }
      }
    }
    if (options.instructions) body.instructions = options.instructions;
    if (language) body.language = language;
    const res = await client.patch(
      `/api/agent/v1/landing-pages/${slug}/side-pages/${sideKey}/section`,
      body
    );
    if (options.json) { emitJson(res.data); return; }
    console.log(`SUCCESS: Section "${options.id}" updated on side page "${sideKey}".`);
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
        tickLine(`[PROCESSING] ${status}                    \n`);
        lastStatus = status;
      } else {
        tickLine(`[PROCESSING] ${status}...`);
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

// ─── Translations (110-multilingual-brand) ─────────────────────────────────
// The translation group a landing page belongs to — the set of language
// variants of the same page, linked by a shared group id. `lp translate`
// only creates an empty DRAFT variant row (correct slug suffix + URL path
// prefix); it does not translate content — see the response's
// `pullFromSourceUrl` for the next step (an ai-edit call with
// `pullFromSource: true`).

export async function lpTranslationsCommand(
  slug: string,
  options: { json?: boolean }
): Promise<void> {
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/translations`);
    if (options.json) { emitJson(res.data); return; }
    const t = res.data;
    console.log(`\n[Translations: ${slug}]`);
    console.log(`Language: ${t.languageCode}  Path prefix: ${t.pathPrefix ?? "(default, domain root)"}`);
    if (!t.translationGroupId) {
      console.log("No translation group yet — this page has no language variants. Use 'lp translate' to create one.");
      return;
    }
    console.log(`Source page: ${t.isTranslationSource ? "yes (this page)" : "no"}`);
    console.log(`Variants (${t.variants?.length ?? 0}):`);
    (t.variants ?? []).forEach((v: { slug: string; languageCode: string; pathPrefix?: string | null; status?: string }) =>
      console.log(`  ${v.slug}  [${v.languageCode}]  ${v.pathPrefix ?? "(default)"}  status=${v.status ?? "?"}`)
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpTranslateCommand(
  slug: string,
  options: { language?: string; json?: boolean }
): Promise<void> {
  if (!options.language) {
    console.error("ERROR: --language is required, e.g. --language cs");
    process.exit(1);
    return;
  }
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/translations`, { language });
    if (options.json) { emitJson(res.data); return; }
    const d = res.data;
    console.log(`\nSUCCESS: Created "${d.languageCode}" variant of "${slug}" -> "${d.slug}" (${d.pathPrefix ?? "(default)"}).`);
    console.log("No content yet — this is an empty draft. Next step, translate the source page's content:");
    console.log(`  ${d.pullFromSourceUrl ?? `/api/agent/v1/landing-pages/${d.slug}/ai-edit`}  (call with pullFromSource: true)`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

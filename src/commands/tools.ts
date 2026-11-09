/**
 * pking tools — Brand Tools (form pages at {brand domain}/tools/{slug} that
 * collect visitor input, optionally forward it to the client's own backend,
 * render a templated HTML result, and hand the visitor off to the client's
 * site).
 *
 * Every subcommand thin-wraps exactly one agent-v1 route (named in each
 * command's doc comment below). No business logic here — this file only
 * builds request bodies and formats responses for a terminal.
 */

import fs from "fs";
import { createClient } from "../client";
import { getBrandId } from "../config";
import { extractApiError } from "../api-error";
import { printWebUrl } from "../output";

// ─── helpers ─────────────────────────────────────────────────────────────────

function requireBrand(brandArg?: string): string {
  const id = brandArg ?? getBrandId();
  if (!id) {
    console.error(
      "ERROR: No brand id supplied and no active brand set. Run 'pking brand list' or pass --brand <id>."
    );
    process.exit(1);
  }
  return id;
}

function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + "…";
}

/** Reads a file and JSON.parses it, exiting with a clear message on either failure. */
function readJsonFile(filePath: string): unknown {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error(`ERROR: Could not read file: ${(e as Error).message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${filePath} is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }
}

/** JSON.parses an inline CLI argument, exiting with a clear message on failure. */
function parseJsonArg(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`ERROR: ${label} is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }
}

// ─── tool row + response types (lib/agent/schemas/brand-tools.ts in the main repo) ──

type ToolInputFieldType = "text" | "number" | "email" | "url" | "select" | "textarea";

interface ToolInputField {
  key: string;
  label: string;
  type: ToolInputFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

type ToolLayout = "split" | "video" | "product";

/** One figure in the split layout's sample-report band. */
interface ToolLayoutMetric {
  label: string;
  value: string;
}

/** One column of the product layout's three-step hairline grid. */
interface ToolLayoutStep {
  label: string;
  title: string;
  copy: string;
}

/**
 * Layout-specific page content. Every key is optional — a layout renders
 * only the keys it supports (see the `--help` text on `tools create`/
 * `tools update` and `postking-landing-pages`'s SKILL.md for the per-layout
 * field list); unsupported keys for the current layout are simply ignored
 * by the renderer.
 */
interface ToolLayoutConfig {
  eyebrow?: string;
  submitLabel?: string;
  formCaption?: string;
  chips?: string[];
  deliverables?: string[];
  deliverablesTitle?: string;
  showDeliverables?: boolean;
  formHeadline?: string;
  sampleHeadline?: string;
  sampleCopy?: string;
  sampleImageUrl?: string;
  sampleImageKind?: "image" | "video";
  sampleImageAssetId?: string;
  sampleMetrics?: ToolLayoutMetric[];
  videoUrl?: string;
  videoAssetId?: string;
  videoPosterUrl?: string;
  videoPosterAssetId?: string;
  videoDurationLabel?: string;
  formSubcopy?: string;
  videoControls?: boolean;
  steps?: ToolLayoutStep[];
  logoUrls?: string[];
}

interface ToolResponse {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string | null;
  endpointUrl: string | null;
  endpointMethod: "GET" | "POST";
  apiKeyLast4: string | null;
  isAsync: boolean;
  resultType: "json" | "text" | "url";
  inputSchema: ToolInputField[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  conversionCopy: string | null;
  ctaHeadline: string | null;
  benefitBullets: string[];
  usageLabel: string | null;
  showUsageCount: boolean;
  sampleOutput: string | null;
  usageLimitPerDay: number | null;
  showTestimonials: boolean;
  resultTemplate: string | null;
  handoffMode: "result" | "redirect";
  handoffUrl: string | null;
  layout: ToolLayout;
  layoutConfig: ToolLayoutConfig;
  failureMessage: string | null;
  usageCountStart: number;
  webUrl?: string;
}

interface ToolGenerateResponse {
  operationId: string;
  status: string;
}

interface ToolPreviewResponse {
  html: string;
  handoffUrl: string | null;
  missingKeys: string[];
}

interface ToolRunRecord {
  id: string;
  status: string;
  result: unknown;
  error: string | null;
}

interface ToolRunRow {
  id: string;
  ip: string | null;
  cookieId: string | null;
  createdAt: string;
  metadata: unknown;
  result: unknown;
  run: ToolRunRecord | null;
}

interface ToolRunsResponse {
  runs: ToolRunRow[];
  total: number;
  page: number;
  limit: number;
}

interface ToolLeadRow {
  id: string;
  brandId: string;
  email: string;
  source: string;
  toolId: string | null;
  metadata: unknown;
  createdAt: string;
  lastToolRunId: string | null;
  lastToolInputs: unknown;
  lastToolResult: unknown;
}

interface ToolLeadsResponse {
  leads: ToolLeadRow[];
  nextCursor: string | null;
}

// ─── tools list ────────────────────────────────────────────────────────────

export interface ToolsListOptions {
  brand?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/tools
 */
export async function toolsListCommand(options: ToolsListOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/tools`);
    const tools = res.data as ToolResponse[];

    if (options.json) {
      console.log(JSON.stringify(tools, null, 2));
      return;
    }

    console.log(`\nTools (${tools.length})`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/tools)\n`);

    if (tools.length === 0) {
      console.log("No tools yet — create one with 'pking tools create --file <path>'.\n");
      return;
    }

    console.log(`  ${"SLUG".padEnd(24)}  ${"NAME".padEnd(28)}  ${"PUB".padEnd(3)}  ${"KIND".padEnd(6)}  USAGE`);
    for (const t of tools) {
      const kind = t.endpointUrl ? "proxy" : "none";
      console.log(
        `  ${truncate(t.slug, 24).padEnd(24)}  ${truncate(t.name, 28).padEnd(28)}  ${(t.isPublished ? "y" : "n").padEnd(3)}  ${kind.padEnd(6)}  ${t.usageCount}`
      );
    }
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools get ─────────────────────────────────────────────────────────────

export interface ToolsGetOptions {
  brand?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/tools/{toolId}
 */
export async function toolsGetCommand(toolId: string, options: ToolsGetOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  try {
    const res = await client.get(`/api/agent/v1/brands/${brandId}/tools/${toolId}`);
    const tool = res.data as ToolResponse;

    if (options.json) {
      console.log(JSON.stringify(tool, null, 2));
      return;
    }

    console.log(`\n${tool.name}  (${tool.id})`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/tools/${toolId})\n`);
    console.log(`  Slug:            ${tool.slug}`);
    console.log(`  Description:     ${tool.description ?? "—"}`);
    console.log(
      `  Endpoint:        ${tool.endpointUrl ?? "— (lead capture only)"}${tool.endpointUrl ? ` [${tool.endpointMethod}]` : ""}`
    );
    console.log(`  Kind:            ${tool.endpointUrl ? "proxy" : "none"}`);
    console.log(`  Async:           ${tool.isAsync ? "yes" : "no"}`);
    console.log(`  Result type:     ${tool.resultType}`);
    console.log(`  Result template: ${tool.resultTemplate ? "set" : "— (none)"}`);
    console.log(`  Handoff mode:    ${tool.handoffMode}`);
    console.log(`  Handoff URL:     ${tool.handoffUrl ?? "—"}`);
    console.log(`  Layout:          ${tool.layout}`);
    console.log(`  Published:       ${tool.isPublished ? "yes" : "no"}`);
    console.log(`  Usage count:     ${tool.usageCount}`);
    console.log(`  API key:         ${tool.apiKeyLast4 ? `••••${tool.apiKeyLast4}` : "— (none set)"}`);
    printWebUrl(tool);
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools create ──────────────────────────────────────────────────────────

export interface ToolsCreateOptions {
  file: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/tools
 */
export async function toolsCreateCommand(options: ToolsCreateOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const body = readJsonFile(options.file);

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/tools`, body);
    const tool = res.data as ToolResponse;

    if (options.json) {
      console.log(JSON.stringify(tool, null, 2));
      return;
    }

    console.log(`\nSUCCESS: Tool created.`);
    console.log(`  Id:   ${tool.id}`);
    console.log(`  Slug: ${tool.slug}`);
    printWebUrl(tool);
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools generate ────────────────────────────────────────────────────────

export interface ToolsGenerateOptions {
  description: string;
  endpointUrl: string;
  inputsOutputs: string;
  endpointMethod?: string;
  apiKey?: string;
  sampleOutputFile?: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/tools/generate
 *
 * Async — returns { operationId, status }. This CLI has no per-id job-get
 * command, only 'jobs list' (which reads the *active* brand and takes no
 * --brand flag) — so the poll hint always points at that, regardless of
 * which --brand this command targeted.
 *
 * NOTE: --sample-output-file is sent as `pastedSampleOutput`, a field the
 * inner (non-agent) route accepts but that is NOT declared in the agent-v1
 * zod schema (ToolGenerateBody) — the agent-v1 proxy's body validation may
 * silently strip it before it reaches the inner route. Sent best-effort.
 */
export async function toolsGenerateCommand(options: ToolsGenerateOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const body: Record<string, unknown> = {
    description: options.description,
    endpointUrl: options.endpointUrl,
    inputsOutputs: options.inputsOutputs,
  };
  if (options.endpointMethod) body.endpointMethod = options.endpointMethod;
  if (options.apiKey) body.apiKey = options.apiKey;
  if (options.sampleOutputFile) {
    let raw: string;
    try {
      raw = fs.readFileSync(options.sampleOutputFile, "utf8");
    } catch (e) {
      console.error(`ERROR: Could not read file: ${(e as Error).message}`);
      process.exit(1);
    }
    body.pastedSampleOutput = raw;
  }

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/tools/generate`, body);
    const data = res.data as ToolGenerateResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\nSUCCESS: Tool draft generation started.`);
    console.log(`  OperationId: ${data.operationId}`);
    console.log(`  Status:      ${data.status}`);
    console.log(`\nPoll with: pking jobs list`);
    console.log(`  ('jobs list' reads your active brand — run 'pking brand set ${brandId}' first if it isn't.)`);
    console.log(`  An agent with MCP access can instead poll via the 'get_job' tool.\n`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools update ──────────────────────────────────────────────────────────

export interface ToolsUpdateOptions {
  file: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps PATCH /api/agent/v1/brands/{brandId}/tools/{toolId}
 */
export async function toolsUpdateCommand(toolId: string, options: ToolsUpdateOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const body = readJsonFile(options.file);

  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/tools/${toolId}`, body);
    const tool = res.data as ToolResponse;

    if (options.json) {
      console.log(JSON.stringify(tool, null, 2));
      return;
    }

    console.log(`\nSUCCESS: Tool updated.`);
    console.log(`  Id:        ${tool.id}`);
    console.log(`  Slug:      ${tool.slug}`);
    console.log(`  Published: ${tool.isPublished ? "yes" : "no"}`);
    printWebUrl(tool);
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools publish ─────────────────────────────────────────────────────────

export interface ToolsPublishOptions {
  unpublish?: boolean;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/tools/{toolId}/publish
 */
export async function toolsPublishCommand(toolId: string, options: ToolsPublishOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);
  const isPublished = !options.unpublish;

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/tools/${toolId}/publish`, { isPublished });
    const tool = res.data as ToolResponse;

    if (options.json) {
      console.log(JSON.stringify(tool, null, 2));
      return;
    }

    console.log(`\nSUCCESS: Tool ${tool.isPublished ? "published" : "unpublished"}.`);
    printWebUrl(tool);
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools delete ──────────────────────────────────────────────────────────

export interface ToolsDeleteOptions {
  brand?: string;
  json?: boolean;
}

/**
 * Wraps DELETE /api/agent/v1/brands/{brandId}/tools/{toolId}
 */
export async function toolsDeleteCommand(toolId: string, options: ToolsDeleteOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  try {
    const res = await client.delete(`/api/agent/v1/brands/${brandId}/tools/${toolId}`);

    if (options.json) {
      console.log(JSON.stringify(res.data ?? { success: true }, null, 2));
      return;
    }

    console.log(`SUCCESS: Tool ${toolId} deleted.`);
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools preview ─────────────────────────────────────────────────────────

export interface ToolsPreviewOptions {
  file?: string;
  sample?: string;
  sampleInputs?: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps POST /api/agent/v1/brands/{brandId}/tools/{toolId}/preview
 */
export async function toolsPreviewCommand(toolId: string, options: ToolsPreviewOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const body: Record<string, unknown> = {};
  if (options.file) {
    body.sampleResponse = readJsonFile(options.file);
  } else if (options.sample) {
    body.sampleResponse = parseJsonArg(options.sample, "--sample");
  }
  if (options.sampleInputs) {
    body.sampleInputs = parseJsonArg(options.sampleInputs, "--sample-inputs");
  }

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/tools/${toolId}/preview`, body);
    const data = res.data as ToolPreviewResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\nTool Preview`);
    console.log(`(POST /api/agent/v1/brands/${brandId}/tools/${toolId}/preview)\n`);

    const missingKeys = data.missingKeys ?? [];
    if (missingKeys.length > 0) {
      console.log(`WARNING: Missing template keys (${missingKeys.length}):`);
      for (const k of missingKeys) console.log(`  - ${k}`);
    } else {
      console.log("No missing keys — ready to publish.");
    }
    console.log("");

    console.log(`Handoff URL: ${data.handoffUrl ?? "—"}\n`);

    const maxHtml = 2000;
    const html = data.html ?? "";
    console.log("Rendered HTML:");
    if (html.length > maxHtml) {
      console.log(html.slice(0, maxHtml));
      console.log(`\n  ... truncated (${html.length - maxHtml} more characters — use --json for the full payload)`);
    } else {
      console.log(html);
    }
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools runs ────────────────────────────────────────────────────────────

export interface ToolsRunsOptions {
  page?: string;
  limit?: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/tools/{toolId}/runs
 */
export async function toolsRunsCommand(toolId: string, options: ToolsRunsOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.page) params.set("page", options.page);
  if (options.limit) params.set("limit", options.limit);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/tools/${toolId}/runs${qs}`);
    const data = res.data as ToolRunsResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\nTool Runs — page ${data.page}, ${data.total} total`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/tools/${toolId}/runs)\n`);

    if (data.runs.length === 0) {
      console.log("No runs yet.\n");
      return;
    }

    console.log(`  ${"ID".padEnd(28)}  ${"CREATED".padEnd(20)}  ${"COOKIE/IP".padEnd(22)}  RESULT`);
    for (const r of data.runs) {
      const who = r.cookieId ?? r.ip ?? "—";
      const resultSummary = r.run
        ? `[${r.run.status}]${r.run.error ? ` ${truncate(r.run.error, 40)}` : ""}`
        : r.result !== null && r.result !== undefined
          ? truncate(JSON.stringify(r.result), 40)
          : "—";
      console.log(
        `  ${truncate(r.id, 28).padEnd(28)}  ${truncate(r.createdAt, 20).padEnd(20)}  ${truncate(who, 22).padEnd(22)}  ${resultSummary}`
      );
    }
    console.log("");
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

// ─── tools leads ───────────────────────────────────────────────────────────

export interface ToolsLeadsOptions {
  limit?: string;
  cursor?: string;
  brand?: string;
  json?: boolean;
}

/**
 * Wraps GET /api/agent/v1/brands/{brandId}/tools/{toolId}/leads
 */
export async function toolsLeadsCommand(toolId: string, options: ToolsLeadsOptions): Promise<void> {
  const client = createClient();
  const brandId = requireBrand(options.brand);

  const params = new URLSearchParams();
  if (options.limit) params.set("limit", options.limit);
  if (options.cursor) params.set("cursor", options.cursor);

  try {
    const qs = params.toString() ? `?${params}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/tools/${toolId}/leads${qs}`);
    const data = res.data as ToolLeadsResponse;

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log(`\nTool Leads (${data.leads.length})`);
    console.log(`(GET /api/agent/v1/brands/${brandId}/tools/${toolId}/leads)\n`);

    if (data.leads.length === 0) {
      console.log("No leads yet.\n");
      return;
    }

    console.log(`  ${"ID".padEnd(28)}  ${"EMAIL".padEnd(32)}  ${"CREATED".padEnd(20)}  LAST RUN`);
    for (const l of data.leads) {
      console.log(
        `  ${truncate(l.id, 28).padEnd(28)}  ${truncate(l.email, 32).padEnd(32)}  ${truncate(l.createdAt, 20).padEnd(20)}  ${l.lastToolRunId ?? "—"}`
      );
    }
    console.log("");

    if (data.nextCursor) {
      console.log(`More results: pking tools leads ${toolId} --cursor ${data.nextCursor}\n`);
    }
  } catch (err) {
    console.error(`ERROR: ${extractApiError(err)}`);
    process.exit(1);
  }
}

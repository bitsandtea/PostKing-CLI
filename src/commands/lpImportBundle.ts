/**
 * `pking lp import-bundle <folder>` — PostKing feature 126 (bundle import),
 * Phase 3 (CLI/MCP surface). The CLI runs locally with real filesystem
 * access, so it walks the folder directly and POSTs one multipart request to
 * `POST /api/agent/v1/landing-pages/import-html-bundle` — no zip step, no
 * MCP-style chunking (see docs/126-bundle-import/00-reqs.md §8).
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "../client";
import { getBrandId } from "../config";
import { printWebUrl } from "../output";
import { extractApiError, getApiErrorEnvelope } from "../api-error";
import {
  walkBundleDirectory,
  checkBundleCaps,
  extToMime,
  BundleRejectedError,
  BundleFileEntry,
} from "../lib/bundleWalk";
import { detectEntryPath, EntryDetectionError } from "../lib/bundleEntry";

export interface LpImportBundleOptions {
  name?: string;
  entry?: string;
  convertSlug?: string;
  sidePages?: boolean;
  json?: boolean;
}

function emitJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

interface BundleReportSummary {
  filesUploaded?: number;
  totalBytes?: number;
  entryPath?: string;
  orphaned?: string[];
  skipped?: { path: string; reason: string }[];
  sanitizedSvgs?: string[];
  malwareScan?: "clean" | "skipped";
  sidePagesCreated?: number;
  [k: string]: unknown;
}

interface RawHtmlImportReport {
  externalHosts?: string[];
  relativeAssetPaths?: string[];
  placeholders?: string[];
  internalLinks?: { href?: string; slug?: string; existingSidePage?: boolean }[];
  themeExtracted?: boolean;
  truncated?: boolean;
  extractability?: { verdict?: "ok" | "warn" | "blocked"; reasons?: string[] };
  bundle?: BundleReportSummary;
  [k: string]: unknown;
}

interface RawHtmlImportResult {
  landingPage?: { id?: string; slug?: string; [k: string]: unknown };
  report?: RawHtmlImportReport;
  webUrl?: string;
  [k: string]: unknown;
}

interface BundleImportErrorDetails {
  offendingPath?: string;
  reason?: string;
  candidates?: string[];
}

/**
 * Prints bundle-import-specific error detail ONLY. The axios response
 * interceptor (`src/client.ts`) already prints `ERROR <status> <code>: <msg>`
 * plus any `checkoutUrl`/`docsUrl` for every agent-envelope error — this only
 * adds what that interceptor doesn't show: `offendingPath`, `reason`,
 * `candidates`, and an `--entry` hint. Don't repeat the status/code/message/
 * docs-link here, or it prints twice.
 */
function printBundleImportError(err: unknown, json?: boolean): void {
  const envelope = getApiErrorEnvelope(err);
  const details = envelope?.details as BundleImportErrorDetails | undefined;

  if (json) {
    emitJson({
      error: envelope
        ? {
            code: envelope.code,
            message: envelope.message,
            offendingPath: details?.offendingPath,
            reason: details?.reason,
            candidates: details?.candidates,
          }
        : { message: extractApiError(err) },
    });
    return;
  }

  if (!envelope) {
    // No agent error envelope (network failure, non-agent route, etc) — the
    // interceptor prints nothing for this shape, so fall back here.
    console.error(`ERROR: ${extractApiError(err)}`);
    return;
  }

  if (details?.offendingPath) {
    console.error(`  Offending path: ${details.offendingPath}`);
  }
  if (details?.reason) {
    console.error(`  Reason: ${details.reason}`);
  }
  if (details?.candidates && details.candidates.length > 0) {
    console.error(`  Candidates:`);
    details.candidates.forEach((c) => console.error(`    ${c}`));
    console.error(`  Re-run with --entry <path> to choose one.`);
  } else if (details?.offendingPath || details?.reason) {
    console.error(`  Hint: if this is an entry-detection issue, re-run with --entry <path>.`);
  }
}

function printReport(report: RawHtmlImportReport | undefined): void {
  if (!report) return;
  if (report.externalHosts && report.externalHosts.length > 0) {
    console.log(`External hosts referenced: ${report.externalHosts.join(", ")}`);
  }
  if (report.relativeAssetPaths && report.relativeAssetPaths.length > 0) {
    console.log(`WARNING: ${report.relativeAssetPaths.length} relative asset path(s) did not resolve:`);
    report.relativeAssetPaths.forEach((p) => console.log(`  ${p}`));
  }
  if (report.placeholders && report.placeholders.length > 0) {
    console.log(`Unresolved placeholders: ${report.placeholders.join(", ")}`);
  }
  if (report.themeExtracted) {
    console.log(`Theme extracted from the imported HTML.`);
  }
  if (report.extractability?.verdict === "warn") {
    console.log(`WARNING: extractability=${report.extractability.verdict} — ${(report.extractability.reasons ?? []).join("; ")}`);
  }

  const b = report.bundle;
  if (b) {
    console.log(`\nBundle summary:`);
    if (b.filesUploaded !== undefined) console.log(`  Files uploaded: ${b.filesUploaded}`);
    if (b.totalBytes !== undefined) console.log(`  Total size: ${(b.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    if (b.entryPath !== undefined) console.log(`  Entry: ${b.entryPath}`);
    if (b.orphaned && b.orphaned.length > 0) {
      console.log(`  Orphaned (uploaded, never referenced, not rehosted): ${b.orphaned.length}`);
      b.orphaned.slice(0, 10).forEach((p) => console.log(`    ${p}`));
      if (b.orphaned.length > 10) console.log(`    ...and ${b.orphaned.length - 10} more`);
    }
    if (b.skipped && b.skipped.length > 0) {
      console.log(`  Skipped server-side: ${b.skipped.length}`);
      b.skipped.slice(0, 10).forEach((s) => console.log(`    ${s.path} — ${s.reason}`));
      if (b.skipped.length > 10) console.log(`    ...and ${b.skipped.length - 10} more`);
    }
    if (b.sanitizedSvgs && b.sanitizedSvgs.length > 0) {
      console.log(`  SVGs sanitized (active content stripped): ${b.sanitizedSvgs.length}`);
      b.sanitizedSvgs.forEach((p) => console.log(`    ${p}`));
    }
    if (b.malwareScan !== undefined) console.log(`  Malware scan: ${b.malwareScan}`);
    if (b.sidePagesCreated !== undefined) console.log(`  Side pages created: ${b.sidePagesCreated}`);
  }
}

export async function lpImportBundleCommand(
  folder: string,
  options: LpImportBundleOptions
): Promise<void> {
  const absRoot = path.resolve(folder);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absRoot);
  } catch {
    console.error(`ERROR: "${folder}" does not exist.`);
    process.exit(1);
    return;
  }
  if (!stat.isDirectory()) {
    console.error(`ERROR: "${folder}" is not a directory. Drop the unzipped folder, not a single file — if this is a zip, unzip it first.`);
    process.exit(1);
    return;
  }

  let walk;
  try {
    walk = await walkBundleDirectory(absRoot);
  } catch (err) {
    if (err instanceof BundleRejectedError) {
      console.error(`ERROR: Refusing to import — "${err.offendingPath}": ${err.message}`);
      process.exit(1);
      return;
    }
    throw err;
  }

  if (walk.files.length === 0) {
    console.error("ERROR: No importable files found in the bundle (after filtering). See the allowed file-type list in the docs.");
    process.exit(1);
    return;
  }

  let entry;
  try {
    entry = detectEntryPath(walk.files.map((f) => f.relPath), options.entry);
  } catch (err) {
    if (err instanceof EntryDetectionError) {
      console.error(`ERROR: ${err.message}`);
      if (err.candidates.length > 0) {
        console.error("Candidates:");
        err.candidates.forEach((c) => console.error(`  ${c}`));
      }
      process.exit(1);
      return;
    }
    throw err;
  }
  if (entry.note) console.log(`NOTE: ${entry.note}`);

  const capError = checkBundleCaps(walk.files);
  if (capError) {
    console.error(`ERROR: ${capError}`);
    process.exit(1);
    return;
  }

  if (walk.skipped.length > 0) {
    console.log(`Skipping ${walk.skipped.length} file(s) before upload:`);
    walk.skipped.slice(0, 20).forEach((s) => console.log(`  ${s.path} — ${s.reason}`));
    if (walk.skipped.length > 20) console.log(`  ...and ${walk.skipped.length - 20} more`);
  }

  const brandId = getBrandId();
  const form = new FormData();
  if (brandId) form.append("brandId", brandId);
  if (options.name) form.append("name", options.name);
  if (options.convertSlug) form.append("convertExistingSlug", options.convertSlug);
  if (options.sidePages !== undefined) form.append("createMissingSidePages", String(!!options.sidePages));
  form.append("entryPath", entry.entryPath);

  for (const f of walk.files as BundleFileEntry[]) {
    const buf = fs.readFileSync(f.absPath);
    const blob = new Blob([buf], { type: extToMime(f.relPath) });
    form.append("files", blob, f.relPath);
  }

  console.log(
    `Uploading ${walk.files.length} file(s), ${(walk.totalBytes / (1024 * 1024)).toFixed(2)} MB...`
  );

  const client = createClient();
  const showProgress = !options.json;
  let lastPct = -1;
  let progressShown = false;
  try {
    const res = await client.post<RawHtmlImportResult>(
      "/api/agent/v1/landing-pages/import-html-bundle",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        // Bundle import keeps processing server-side (asset rehosting,
        // sanitization, etc.) well past the CLI's default ~2min timeout —
        // give this one request more room so the client doesn't abort and
        // the user doesn't retry into a duplicate landing page server-side.
        timeout: 330_000,
        onUploadProgress: showProgress
          ? (progressEvent) => {
              progressShown = true;
              if (progressEvent.total) {
                const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                if (pct !== lastPct) {
                  lastPct = pct;
                  process.stderr.write(`\rUploading... ${pct}%`);
                }
              } else {
                process.stderr.write(`\rUploading... ${(progressEvent.loaded / (1024 * 1024)).toFixed(1)} MB`);
              }
            }
          : undefined,
      }
    );
    if (progressShown) process.stderr.write("\n");
    if (options.json) {
      emitJson(res.data);
      return;
    }
    const lp = res.data.landingPage;
    console.log(`\nSUCCESS: Landing page imported. Slug: ${lp?.slug ?? "(unknown)"}`);
    printReport(res.data.report);
    printWebUrl(res.data);
  } catch (err) {
    if (progressShown) process.stderr.write("\n");
    printBundleImportError(err, options.json);
    process.exit(1);
  }
}

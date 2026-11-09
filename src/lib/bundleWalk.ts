/**
 * Directory walker + client-side allowlist/refusal pre-filter for
 * `pking lp import-bundle <folder>` (PostKing feature 126 — bundle import).
 *
 * Mirrors the server-side allowlist described in
 * `PostKing/docs/126-bundle-import/00-reqs.md` §7 — this is a fast "no"
 * before spending an upload; the server re-enforces everything authoritatively
 * (§7.7), so this filter does not need to be perfect, only close enough to
 * save the user a slow round trip on an obviously-bad folder.
 *
 * Symlinks are never followed (§7.6): `fs.readdir(..., {withFileTypes:true})`
 * reports each entry's type from the raw directory listing (lstat semantics)
 * without following it, so `Dirent.isSymbolicLink()` is enough to detect and
 * skip a symlink without ever stat-ing (and therefore resolving) its target.
 */
import * as fs from "fs";
import * as path from "path";

// ─── caps (§6) ──────────────────────────────────────────────────────────────

export const MAX_TOTAL_BYTES = 150 * 1024 * 1024; // 150 MB
export const MAX_IMAGE_FONT_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_CSS_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_FILE_COUNT = 500;
const MAX_PATH_LENGTH = 260; // historical Windows ceiling (§7.6)

// ─── allowlist (§7.1) ───────────────────────────────────────────────────────

const EXT_TO_MIME: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const IMAGE_FONT_VIDEO_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
  ".mp4", ".webm", ".mov",
]);
const CSS_EXTS = new Set([".css"]);

/** Real content-type for an allowed bundle file, by extension. Falls back to a generic binary type — should only happen for a file whose extension we already excluded from the allowlist. */
export function extToMime(relPath: string): string {
  const ext = path.posix.extname(relPath).toLowerCase();
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

// ─── refusal (§7.2) ─────────────────────────────────────────────────────────

const HARD_REJECT_EXTENSIONS = new Set([
  // executables & native libs
  ".exe", ".dll", ".so", ".dylib", ".msi", ".dmg", ".pkg", ".app", ".bin", ".com", ".scr",
  // shell / interpreted scripts
  ".sh", ".bash", ".zsh", ".bat", ".cmd", ".ps1", ".py", ".rb", ".pl", ".php", ".asp", ".aspx", ".jsp", ".cgi",
  // archives
  ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar", ".jar", ".war", ".apk",
  // WebAssembly
  ".wasm",
  // secrets (extension form)
  ".pem", ".key",
]);

const HARD_REJECT_BASENAMES = new Set([
  // server-config files
  ".htaccess", ".htpasswd", "web.config", "_headers", "_redirects", "nginx.conf",
  // secrets & VCS metadata
  ".npmrc", ".netrc", "id_rsa",
]);

// Path segments that make every file beneath them a hard reject (secrets/VCS
// directories) rather than just the one file.
const HARD_REJECT_DIR_SEGMENTS = new Set([".git", ".ssh"]);

const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

function isEnvFile(basename: string): boolean {
  return basename === ".env" || basename.startsWith(".env.") || basename.startsWith(".env-");
}

// Silently-skipped noise (§7.2, §5.5) — never fails the import.
const SILENT_SKIP_BASENAMES = new Set([".DS_Store", "Thumbs.db"]);
const SILENT_SKIP_DIR_SEGMENTS = new Set(["__MACOSX", ".idea", ".vscode"]);
// node_modules isn't in §7.2's table but the task brief calls it out
// separately — skip it (it's never a legitimate static-export asset dir) with
// its own warning-flavored reason string.
const NODE_MODULES_SEGMENT = "node_modules";

export interface BundleFileEntry {
  /** Path relative to the bundle root, forward-slash, no leading slash. */
  relPath: string;
  /** Absolute path on disk, for reading the file's bytes at upload time. */
  absPath: string;
  size: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface BundleWalkResult {
  files: BundleFileEntry[];
  skipped: SkippedFile[];
  totalBytes: number;
}

/** Thrown when a file's presence should abort the whole import (§7.2's "hard reject, name the path" posture). */
export class BundleRejectedError extends Error {
  constructor(public readonly offendingPath: string, message: string) {
    super(message);
    this.name = "BundleRejectedError";
  }
}

function toRelPath(root: string, absPath: string): string {
  return path.relative(root, absPath).split(path.sep).join("/");
}

function pathSegments(relPath: string): string[] {
  return relPath.split("/");
}

function checkPathSafety(relPath: string): string | null {
  if (relPath.length > MAX_PATH_LENGTH) return `path exceeds ${MAX_PATH_LENGTH} characters`;
  if (relPath.includes("\0")) return "path contains a null byte";
  if (relPath.startsWith("/") || /^[A-Za-z]:/.test(relPath)) return "absolute path";
  if (pathSegments(relPath).includes("..")) return "path traversal (..)";
  for (const seg of pathSegments(relPath)) {
    const base = seg.split(".")[0].toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(base)) return `"${seg}" is a reserved Windows device name`;
  }
  return null;
}

function checkHardReject(relPath: string): string | null {
  const segments = pathSegments(relPath);
  for (const seg of segments) {
    if (HARD_REJECT_DIR_SEGMENTS.has(seg)) return `inside a ${seg}/ directory — secrets/VCS metadata are refused`;
  }
  const basename = path.posix.basename(relPath);
  if (isEnvFile(basename)) return "env file — secrets are refused";
  if (HARD_REJECT_BASENAMES.has(basename)) return "refused file (secret or server-config file)";
  const ext = path.posix.extname(basename).toLowerCase();
  if (HARD_REJECT_EXTENSIONS.has(ext)) return `refused file type (${ext})`;
  return null;
}

// Directory entries only ever get checked against the directory-specific
// rules below — NEVER against `checkHardReject`/`checkSilentSkip`, which also
// match on file basename/extension (e.g. `.com` in HARD_REJECT_EXTENSIONS).
// A directory literally named `fonts.gstatic.com/` is a legitimate asset
// folder, not a `.com` file, and must not be hard-rejected by that rule.

function checkDirHardReject(relPath: string): string | null {
  for (const seg of pathSegments(relPath)) {
    if (HARD_REJECT_DIR_SEGMENTS.has(seg)) return `inside a ${seg}/ directory — secrets/VCS metadata are refused`;
  }
  return null;
}

function checkDirSilentSkip(relPath: string): string | null {
  const segments = pathSegments(relPath);
  if (segments.includes(NODE_MODULES_SEGMENT)) return "inside a node_modules/ directory";
  for (const seg of segments) {
    if (SILENT_SKIP_DIR_SEGMENTS.has(seg)) return `inside a ${seg}/ directory`;
  }
  return null;
}

function checkSilentSkip(relPath: string): string | null {
  const segments = pathSegments(relPath);
  if (segments.includes(NODE_MODULES_SEGMENT)) return "inside a node_modules/ directory";
  for (const seg of segments) {
    if (SILENT_SKIP_DIR_SEGMENTS.has(seg)) return `inside a ${seg}/ directory`;
  }
  const basename = path.posix.basename(relPath);
  if (SILENT_SKIP_BASENAMES.has(basename)) return "OS/editor cruft";
  if (basename.endsWith("~")) return "editor backup file";
  const ext = path.posix.extname(basename).toLowerCase();
  if (ext === ".map") return "sourcemap (not needed to host the page)";
  return null;
}

async function walkDir(root: string, dir: string, out: { relPath: string; absPath: string }[], skipped: SkippedFile[]): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read directory "${dir}": ${(err as Error).message}`);
  }

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = toRelPath(root, absPath);

    // Never follow symlinks (§7.6) — Dirent's type comes from the raw
    // directory listing (lstat semantics), so this never resolves the target.
    if (entry.isSymbolicLink()) {
      skipped.push({ path: relPath, reason: "symlink (not followed)" });
      continue;
    }

    const safetyReason = checkPathSafety(relPath);
    if (safetyReason) {
      throw new BundleRejectedError(relPath, safetyReason);
    }

    if (entry.isDirectory()) {
      // A directory itself can still be a hard-reject trigger (e.g. `.git/`,
      // `.ssh/`) or a silent-skip trigger (e.g. `node_modules/`) — check
      // before recursing so we never even list what's inside. Directories use
      // the dir-only checks above, never `checkHardReject`/`checkSilentSkip`
      // (those also match on file extension/basename, e.g. `.com`, which
      // would wrongly hard-reject a directory like `fonts.gstatic.com/`).
      const hardReject = checkDirHardReject(relPath);
      if (hardReject) throw new BundleRejectedError(relPath, hardReject);
      const silentSkip = checkDirSilentSkip(relPath);
      if (silentSkip) {
        skipped.push({ path: relPath + "/", reason: silentSkip });
        continue;
      }
      await walkDir(root, absPath, out, skipped);
      continue;
    }

    if (!entry.isFile()) {
      // Device files, sockets, FIFOs, etc. — not a legitimate bundle asset.
      skipped.push({ path: relPath, reason: "not a regular file" });
      continue;
    }

    const hardReject = checkHardReject(relPath);
    if (hardReject) throw new BundleRejectedError(relPath, hardReject);

    const silentSkip = checkSilentSkip(relPath);
    if (silentSkip) {
      skipped.push({ path: relPath, reason: silentSkip });
      continue;
    }

    const ext = path.posix.extname(relPath).toLowerCase();
    if (!(ext in EXT_TO_MIME)) {
      skipped.push({ path: relPath, reason: "not in the allowed file-type list" });
      continue;
    }

    out.push({ relPath, absPath });
  }
}

/**
 * Walks `root` recursively, applying the client-side prefilter (§7.7) and
 * building the bundle file list with forward-slash, root-relative paths.
 * Throws `BundleRejectedError` (naming the offending path) on a hard-reject
 * hit; silently-skippable files/dirs are collected in the result instead.
 */
export async function walkBundleDirectory(root: string): Promise<BundleWalkResult> {
  const collected: { relPath: string; absPath: string }[] = [];
  const skipped: SkippedFile[] = [];
  await walkDir(root, root, collected, skipped);

  const files: BundleFileEntry[] = [];
  let totalBytes = 0;
  for (const c of collected) {
    const stat = await fs.promises.lstat(c.absPath);
    files.push({ relPath: c.relPath, absPath: c.absPath, size: stat.size });
    totalBytes += stat.size;
  }

  return { files, skipped, totalBytes };
}

/**
 * Validates the walked file set against the byte/count caps (§6). Returns a
 * human-readable error message naming the offending file/total when a cap is
 * exceeded, or `null` when everything fits — check this BEFORE uploading
 * (fail before spending an upload, not mid-upload).
 */
export function checkBundleCaps(files: BundleFileEntry[]): string | null {
  if (files.length > MAX_FILE_COUNT) {
    return `Bundle has ${files.length} files, exceeding the ${MAX_FILE_COUNT}-file cap. If this is a build directory (e.g. ".next/"), point at the static export output instead (e.g. "out/").`;
  }
  let totalBytes = 0;
  for (const f of files) {
    totalBytes += f.size;
    const ext = path.posix.extname(f.relPath).toLowerCase();
    if (IMAGE_FONT_VIDEO_EXTS.has(ext) && f.size > MAX_IMAGE_FONT_VIDEO_BYTES) {
      return `"${f.relPath}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB, exceeding the ${MAX_IMAGE_FONT_VIDEO_BYTES / (1024 * 1024)} MB per-file cap for images/fonts/video.`;
    }
    if (CSS_EXTS.has(ext) && f.size > MAX_CSS_BYTES) {
      return `"${f.relPath}" is ${(f.size / (1024 * 1024)).toFixed(2)} MB, exceeding the ${MAX_CSS_BYTES / (1024 * 1024)} MB per-file cap for CSS.`;
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return `Bundle totals ${(totalBytes / (1024 * 1024)).toFixed(1)} MB, exceeding the ${MAX_TOTAL_BYTES / (1024 * 1024)} MB total cap.`;
  }
  return null;
}

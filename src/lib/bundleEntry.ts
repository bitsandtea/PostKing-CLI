/**
 * Entry-HTML detection for `pking lp import-bundle` — mirrors the server-side
 * rule in `PostKing/docs/126-bundle-import/00-reqs.md` §5.1 so the CLI can
 * fail fast (and tell the user which `.html` files it found) before
 * spending an upload on an ambiguous bundle.
 */

export interface EntryDetectionResult {
  entryPath: string;
  /** Set when the entry was picked from a non-root `.html` file — surfaced to the user as a heads-up. */
  note?: string;
}

export class EntryDetectionError extends Error {
  constructor(message: string, public readonly candidates: string[]) {
    super(message);
    this.name = "EntryDetectionError";
  }
}

function normalizeExplicitPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * §5.1's detection order:
 *  1. Explicit `--entry` wins if it names a file that's actually in the bundle.
 *  2. Exactly one `.html`/`.htm` at bundle root -> that one.
 *  3. Multiple `.html`/`.htm` files at bundle root, one of them named
 *     `index.html` (case-insensitive) -> that one, with a note.
 *  4. Exactly one `.html`/`.htm` anywhere -> that one, with a note.
 *  5. 0 or 2+ ambiguous candidates -> throws with the full candidate list.
 */
export function detectEntryPath(relPaths: string[], explicit?: string): EntryDetectionResult {
  if (explicit) {
    const normalized = normalizeExplicitPath(explicit);
    if (!relPaths.includes(normalized)) {
      throw new EntryDetectionError(
        `--entry "${explicit}" was not found among the uploaded files.`,
        relPaths.filter((p) => /\.html?$/i.test(p))
      );
    }
    return { entryPath: normalized };
  }

  const htmlFiles = relPaths.filter((p) => /\.html?$/i.test(p));
  const rootHtml = htmlFiles.filter((p) => !p.includes("/"));

  if (rootHtml.length === 1) {
    return { entryPath: rootHtml[0] };
  }

  if (rootHtml.length > 1) {
    const indexHtml = rootHtml.find((p) => /^index\.html$/i.test(p));
    if (indexHtml) {
      return {
        entryPath: indexHtml,
        note: `Multiple .html files found at the bundle root — using "${indexHtml}" as the entry. Pass --entry <path> to pick a different one.`,
      };
    }
  }

  if (htmlFiles.length === 1) {
    return {
      entryPath: htmlFiles[0],
      note: `Using "${htmlFiles[0]}" as the entry — everything else in the bundle becomes a side page or is ignored.`,
    };
  }

  if (htmlFiles.length === 0) {
    throw new EntryDetectionError("No .html/.htm file found in the bundle.", []);
  }

  throw new EntryDetectionError(
    `Found ${htmlFiles.length} .html files and none is uniquely at the bundle root — pass --entry <path> to pick one.`,
    htmlFiles
  );
}

/**
 * Unit tests for entry-HTML detection (feature 126, Phase 3, §5.1).
 *
 * Run with:  pnpm test
 * (node:test via tsx — no test framework dependency in this repo.)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectEntryPath, EntryDetectionError } from "./bundleEntry";

describe("detectEntryPath", () => {
  it("picks the single root-level .html as the common case", () => {
    const result = detectEntryPath(["index.html", "img/home-v2/a.webp", "favicon.svg"]);
    assert.equal(result.entryPath, "index.html");
    assert.equal(result.note, undefined);
  });

  it("prefers the root .html over a non-root one when both exist", () => {
    const result = detectEntryPath(["index.html", "about/index.html"]);
    assert.equal(result.entryPath, "index.html");
  });

  it("falls back to a single non-root .html with a note", () => {
    const result = detectEntryPath(["subdir/page.html", "subdir/style.css"]);
    assert.equal(result.entryPath, "subdir/page.html");
    assert.ok(result.note && result.note.includes("subdir/page.html"));
  });

  it("throws with an empty candidate list when there's no .html at all", () => {
    assert.throws(
      () => detectEntryPath(["style.css", "img/a.png"]),
      (err: unknown) => {
        assert.ok(err instanceof EntryDetectionError);
        assert.deepEqual((err as EntryDetectionError).candidates, []);
        return true;
      }
    );
  });

  it("throws with the full candidate list when 2+ .html files exist and none is uniquely at the root", () => {
    assert.throws(
      () => detectEntryPath(["privacy/index.html", "terms/index.html"]),
      (err: unknown) => {
        assert.ok(err instanceof EntryDetectionError);
        assert.deepEqual(
          (err as EntryDetectionError).candidates.sort(),
          ["privacy/index.html", "terms/index.html"].sort()
        );
        return true;
      }
    );
  });

  it("throws on ambiguity even when a non-root candidate also exists alongside 2 root .html files", () => {
    // Neither root .html is named index.html, so the index.html-preference
    // rule below doesn't kick in and this stays ambiguous.
    assert.throws(
      () => detectEntryPath(["about.html", "contact.html", "privacy/index.html"]),
      (err: unknown) => {
        assert.ok(err instanceof EntryDetectionError);
        assert.equal((err as EntryDetectionError).candidates.length, 3);
        return true;
      }
    );
  });

  it("prefers root index.html when multiple root .html files exist", () => {
    const result = detectEntryPath(["index.html", "about.html", "contact.html"]);
    assert.equal(result.entryPath, "index.html");
    assert.ok(result.note && result.note.includes("index.html"));
  });

  it("prefers root index.html case-insensitively (Index.html)", () => {
    const result = detectEntryPath(["Index.html", "about.html"]);
    assert.equal(result.entryPath, "Index.html");
  });

  it("prefers root index.html case-insensitively (INDEX.HTML)", () => {
    const result = detectEntryPath(["INDEX.HTML", "about.html", "contact.html"]);
    assert.equal(result.entryPath, "INDEX.HTML");
  });

  it("still throws ambiguous when 2+ root .html files exist and none is index.html", () => {
    assert.throws(
      () => detectEntryPath(["about.html", "contact.html"]),
      (err: unknown) => {
        assert.ok(err instanceof EntryDetectionError);
        assert.deepEqual((err as EntryDetectionError).candidates.sort(), ["about.html", "contact.html"].sort());
        return true;
      }
    );
  });

  it("honors an explicit --entry path when it exists in the bundle", () => {
    const result = detectEntryPath(["about.html", "index.html"], "about.html");
    assert.equal(result.entryPath, "about.html");
  });

  it("normalizes a leading slash / backslashes on an explicit --entry path", () => {
    const result = detectEntryPath(["sub/page.html"], "/sub/page.html");
    assert.equal(result.entryPath, "sub/page.html");
  });

  it("throws when an explicit --entry path isn't in the bundle", () => {
    assert.throws(
      () => detectEntryPath(["index.html"], "missing.html"),
      (err: unknown) => {
        assert.ok(err instanceof EntryDetectionError);
        assert.match((err as EntryDetectionError).message, /missing\.html/);
        return true;
      }
    );
  });
});

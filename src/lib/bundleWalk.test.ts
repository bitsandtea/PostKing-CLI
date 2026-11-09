/**
 * Unit tests for the bundle-import directory walker (feature 126, Phase 3).
 *
 * Run with:  pnpm test
 * (node:test via tsx — no test framework dependency in this repo.)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  walkBundleDirectory,
  checkBundleCaps,
  extToMime,
  BundleRejectedError,
  MAX_FILE_COUNT,
  MAX_IMAGE_FONT_VIDEO_BYTES,
  MAX_CSS_BYTES,
} from "./bundleWalk";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pking-bundle-test-"));
}

function write(root: string, relPath: string, content: string | Buffer): void {
  const abs = path.join(root, ...relPath.split("/"));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

describe("walkBundleDirectory", () => {
  it("collects allowed files with forward-slash relative paths", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, "img/home-v2/a.webp", Buffer.from([1, 2, 3]));
    write(root, "css/main.css", "body{}");

    const result = await walkBundleDirectory(root);
    const relPaths = result.files.map((f) => f.relPath).sort();
    assert.deepEqual(relPaths, ["css/main.css", "img/home-v2/a.webp", "index.html"]);
    assert.equal(result.skipped.length, 0);
  });

  it("silently skips .map, .DS_Store, Thumbs.db, __MACOSX/, .idea/, .vscode/, node_modules/, and non-allowlisted extensions", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, "app.js.map", "{}");
    write(root, ".DS_Store", "junk");
    write(root, "Thumbs.db", "junk");
    write(root, "__MACOSX/._index.html", "junk");
    write(root, ".idea/workspace.xml", "junk");
    write(root, ".vscode/settings.json", "{}");
    write(root, "node_modules/pkg/index.js", "module.exports={}");
    write(root, "notes.txt", "plain text, not on the allowlist");

    const result = await walkBundleDirectory(root);
    assert.deepEqual(result.files.map((f) => f.relPath), ["index.html"]);
    const skippedPaths = result.skipped.map((s) => s.path);
    assert.ok(skippedPaths.some((p) => p.includes("app.js.map")));
    assert.ok(skippedPaths.some((p) => p.includes(".DS_Store")));
    assert.ok(skippedPaths.some((p) => p.includes("Thumbs.db")));
    assert.ok(skippedPaths.some((p) => p.startsWith("__MACOSX/")));
    assert.ok(skippedPaths.some((p) => p.startsWith(".idea/")));
    assert.ok(skippedPaths.some((p) => p.startsWith(".vscode/")));
    assert.ok(skippedPaths.some((p) => p.startsWith("node_modules/")));
    assert.ok(skippedPaths.some((p) => p.includes("notes.txt")));
  });

  it("hard-rejects a .env file and names the offending path", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, ".env", "SECRET=1");

    await assert.rejects(
      () => walkBundleDirectory(root),
      (err: unknown) => {
        assert.ok(err instanceof BundleRejectedError);
        assert.equal((err as BundleRejectedError).offendingPath, ".env");
        return true;
      }
    );
  });

  it("hard-rejects anything inside a .git/ directory", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, ".git/config", "[core]");

    await assert.rejects(
      () => walkBundleDirectory(root),
      (err: unknown) => {
        assert.ok(err instanceof BundleRejectedError);
        assert.equal((err as BundleRejectedError).offendingPath, ".git");
        return true;
      }
    );
  });

  it("accepts a directory whose name looks like a hard-rejected file extension (fonts.gstatic.com/)", async () => {
    // Regression for a bug where directory entries were run through the same
    // checkHardReject() used for files — `fonts.gstatic.com` was flagged as a
    // ".com" (executable-suffix) hard reject even though it's a directory,
    // not a file with that extension.
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, "fonts.gstatic.com/s/inter.woff2", Buffer.from([1, 2, 3]));

    const result = await walkBundleDirectory(root);
    const relPaths = result.files.map((f) => f.relPath).sort();
    assert.deepEqual(relPaths, ["fonts.gstatic.com/s/inter.woff2", "index.html"]);
  });

  it("hard-rejects executables, shell scripts, archives, and .wasm", async () => {
    for (const bad of ["run.sh", "app.exe", "bundle.zip", "module.wasm", "id_rsa", "cert.pem"]) {
      const root = mkTmpDir();
      write(root, "index.html", "<html></html>");
      write(root, bad, "x");
      await assert.rejects(
        () => walkBundleDirectory(root),
        (err: unknown) => err instanceof BundleRejectedError,
        `expected ${bad} to be hard-rejected`
      );
    }
  });

  it("hard-rejects server-config files by basename", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    write(root, ".htaccess", "Options -Indexes");

    await assert.rejects(() => walkBundleDirectory(root), BundleRejectedError);
  });

  it("never follows symlinks — reports as skipped, not an error", async () => {
    const root = mkTmpDir();
    write(root, "index.html", "<html></html>");
    const outside = mkTmpDir();
    write(outside, "secret.png", Buffer.from([1]));
    fs.symlinkSync(path.join(outside, "secret.png"), path.join(root, "linked.png"));

    const result = await walkBundleDirectory(root);
    assert.deepEqual(result.files.map((f) => f.relPath), ["index.html"]);
    assert.ok(result.skipped.some((s) => s.path === "linked.png" && /symlink/.test(s.reason)));
  });

  it("case-insensitively derives the right mime type per extension", () => {
    assert.equal(extToMime("index.html"), "text/html");
    assert.equal(extToMime("img/a.WEBP"), "image/webp");
    assert.equal(extToMime("fonts/f.woff2"), "font/woff2");
  });
});

describe("checkBundleCaps", () => {
  it("passes a well-formed small bundle", () => {
    const files = [
      { relPath: "index.html", absPath: "/x/index.html", size: 1024 },
      { relPath: "img/a.png", absPath: "/x/img/a.png", size: 1024 * 1024 },
    ];
    assert.equal(checkBundleCaps(files), null);
  });

  it("rejects more than MAX_FILE_COUNT files", () => {
    const files = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, i) => ({
      relPath: `img/${i}.png`,
      absPath: `/x/img/${i}.png`,
      size: 10,
    }));
    const err = checkBundleCaps(files);
    assert.ok(err && /500-file cap|exceeding the 500/.test(err));
  });

  it("rejects an image over the per-file image/font/video cap", () => {
    const files = [{ relPath: "img/huge.png", absPath: "/x/img/huge.png", size: MAX_IMAGE_FONT_VIDEO_BYTES + 1 }];
    const err = checkBundleCaps(files);
    assert.ok(err && err.includes("huge.png"));
  });

  it("rejects a CSS file over the per-file CSS cap", () => {
    const files = [{ relPath: "css/huge.css", absPath: "/x/css/huge.css", size: MAX_CSS_BYTES + 1 }];
    const err = checkBundleCaps(files);
    assert.ok(err && err.includes("huge.css"));
  });

  it("rejects a bundle whose total bytes exceed the 150MB cap", () => {
    const files = [
      { relPath: "video/a.mp4", absPath: "/x/a.mp4", size: 20 * 1024 * 1024 },
      { relPath: "video/b.mp4", absPath: "/x/b.mp4", size: 20 * 1024 * 1024 },
    ];
    // 8 files at 20MB each = 160MB > 150MB cap, each individually under the per-file cap.
    const many = Array.from({ length: 8 }, (_, i) => ({ ...files[0], relPath: `video/${i}.mp4` }));
    const err = checkBundleCaps(many);
    assert.ok(err && /150 MB total cap/.test(err));
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDirectUpload, oversizeBase64Message, uploadDirect } from "./assetUpload";

function setup(putStatus = 200, putBody = "") {
  const posts: { url: string; body: any }[] = [];
  const puts: { url: string; init: any }[] = [];
  const client = {
    post: async (url: string, body?: unknown) => {
      posts.push({ url, body });
      if (url.endsWith("/upload-url")) {
        return { data: { uploadUrl: "https://r2.example/obj?sig=1", key: "k", uploadToken: "tok", headers: { "Content-Type": "video/mp4", "Cache-Control": "public, max-age=31536000" } } };
      }
      return { data: { asset: { id: "a1", url: "https://cdn/x.mp4" } } };
    },
  };
  const fetchFn = (async (url: string, init: any) => {
    puts.push({ url, init });
    return new Response(putBody, { status: putStatus });
  }) as unknown as typeof fetch;
  return { posts, puts, client, fetchFn };
}

test("classify: video/doc go direct, images do not", () => {
  assert.deepEqual(classifyDirectUpload("a.MOV"), { type: "VIDEO", mimeType: "video/quicktime" });
  assert.equal(classifyDirectUpload("a.pdf")?.type, "DOCUMENT");
  assert.equal(classifyDirectUpload("a.png"), null);
  assert.equal(classifyDirectUpload("a.json"), null);
});

test("video: upload-url, PUT with exact headers and no auth, complete", async () => {
  const s = setup();
  const bytes = new Uint8Array([1, 2, 3]);
  const res = await uploadDirect({ client: s.client, fetchFn: s.fetchFn, brandId: "b1", bytes, fileName: "v.mp4", description: "d", type: "VIDEO", mimeType: "video/mp4" });
  assert.equal(s.posts[0].url, "/api/agent/v1/brands/b1/assets/upload-url");
  assert.deepEqual(s.posts[0].body, { name: "v.mp4", fileName: "v.mp4", type: "VIDEO", mimeType: "video/mp4", fileSize: 3 });
  assert.equal(s.puts[0].init.method, "PUT");
  assert.deepEqual(s.puts[0].init.headers, { "Content-Type": "video/mp4", "Cache-Control": "public, max-age=31536000" });
  assert.equal(s.puts[0].init.body, bytes);
  assert.equal(s.posts[1].url, "/api/agent/v1/brands/b1/assets/complete");
  assert.deepEqual(s.posts[1].body, { uploadToken: "tok", name: "v.mp4", description: "d" });
  assert.equal(res.asset.id, "a1");
});

test("PUT failure gives status + body and skips complete", async () => {
  const s = setup(403, "SignatureDoesNotMatch");
  await assert.rejects(
    uploadDirect({ client: s.client, fetchFn: s.fetchFn, brandId: "b1", bytes: new Uint8Array(1), fileName: "v.mp4", type: "VIDEO", mimeType: "video/mp4" }),
    /HTTP 403 SignatureDoesNotMatch/
  );
  assert.equal(s.posts.length, 1);
});

test("oversize non-direct file fails locally", () => {
  assert.equal(oversizeBase64Message(10 * 1024 * 1024), null);
  assert.match(oversizeBase64Message(11 * 1024 * 1024)!, /10MB/);
});

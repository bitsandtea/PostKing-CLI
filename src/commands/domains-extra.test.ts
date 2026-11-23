import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHostingSwitch } from "./domains-extra";

test("dry run lists every change and says nothing is written", () => {
  const lines = formatHostingSwitch(
    {
      dryRun: true,
      domain: "acme.com",
      hostingMode: "self_hosted",
      changes: {
        domain: { from: "postking", to: "self_hosted" },
        landingPages: [{ slug: "home", from: "hosted", to: "self_hosted" }],
        blogs: [{ id: "b1", from: "postking", to: "self_hosted", routingDefault: { routingType: "path", pathPrefix: "/blog" } }],
      },
    },
    "self_hosted"
  );
  assert.match(lines[0], /^DRY RUN/);
  assert.ok(lines.some((l) => l.includes("home: hosted -> self_hosted")));
  assert.ok(lines.some((l) => l.includes("b1") && l.includes("/blog")));
});

test("already in target mode short-circuits", () => {
  const lines = formatHostingSwitch({ domain: "acme.com", hostingMode: "postking", alreadyInTargetMode: true }, "postking");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /already in postking/);
});

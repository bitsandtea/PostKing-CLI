import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReconcileSummary } from "./search-data";
import { formatRoadmapRow } from "./roadmap";
import { VALID_ROADMAP_ACTIONS } from "./shared";

describe("148 roadmap search-data CLI", () => {
  it("accepts the override actions", () => {
    for (const a of ["restore", "pin", "unpin", "remove", "start"]) assert.ok(VALID_ROADMAP_ACTIONS.includes(a));
  });

  it("formats the reconcile summary line", () => {
    assert.equal(
      formatReconcileSummary({ movedUp: 5, nowCovered: 2, newKeywords: 14, newTopics: 1, refreshItems: 3 }),
      "5 moved up, 2 now covered, 14 new keywords, 1 new topics, 3 refresh items"
    );
  });

  it("shows refresh page, evidence, hidden reason and overrides on a roadmap row", () => {
    const line = formatRoadmapRow({
      id: "r1", title: "Refresh: X", status: "ignored", itemType: "refresh", primaryKeywords: ["x"],
      metadata: { hiddenReason: "ranks_top3", searchEvidence: { impressions: 900, position: 2.14 }, refresh: { pageUrl: "/blog/x" }, userOverride: { pinned: true } },
    });
    assert.match(line, /refresh, hidden: ranks_top3, 900 impr @ pos 2\.1, pinned/);
    assert.match(line, /page=\/blog\/x/);
  });

  it("plain rows stay unchanged", () => {
    assert.equal(formatRoadmapRow({ id: "r2", title: "T", status: "suggested", primaryKeyword: "k" }), "  r2  [suggested]  T  (k)");
  });
});

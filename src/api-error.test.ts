import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatInsufficientCreditsLines } from "./api-error";

describe("formatInsufficientCreditsLines", () => {
  it("renders cost, balance, affordable count and a top-up hint", () => {
    const lines = formatInsufficientCreditsLines(
      {
        code: "INSUFFICIENT_CREDITS",
        message: "Not enough credits: seo.article needs 600, balance is 420 (enough for 7 items). Top up credits to continue.",
        details: { action: "seo.article", needed: 600, balance: 420, affordableCount: 7, topUpUrl: "/dashboard/settings/usage" },
      },
      "https://try.postking.app/"
    );
    assert.ok(lines);
    const text = lines.join("\n");
    assert.match(text, /Cost: 600 credits for seo\.article, balance 420/);
    assert.match(text, /covers 7 of the requested items/);
    assert.match(text, /pking billing topup/);
    assert.match(text, /https:\/\/try\.postking\.app\/dashboard\/settings\/usage/);
  });

  it("returns null for other error codes (so auth/other errors are untouched)", () => {
    assert.equal(formatInsufficientCreditsLines({ code: "UNAUTHORIZED" }), null);
    assert.equal(formatInsufficientCreditsLines(undefined), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articleToMarkdown, bodyHtmlToMarkdown, imageFileName } from "./socialArticle";

describe("bodyHtmlToMarkdown", () => {
  it("converts structure and keeps image markers", () => {
    const md = bodyHtmlToMarkdown(
      '<h2>Why</h2><p>A <strong>b</strong> <a href="https://x.co">c</a></p><p data-image-marker="1"></p><ul><li>one</li><li>two</li></ul>'
    );
    assert.match(md, /## Why/);
    assert.match(md, /A \*\*b\*\* \[c\]\(https:\/\/x\.co\)/);
    assert.match(md, /\[Image 1\]/);
    assert.match(md, /- one\n- two/);
    assert.doesNotMatch(md, /<[a-z]/);
  });
});

describe("articleToMarkdown", () => {
  it("prefixes title and subtitle", () => {
    assert.equal(articleToMarkdown({ title: "T", subtitle: "S", bodyHtml: "<p>hi</p>" }), "# T\n\n*S*\n\nhi");
  });
});

describe("imageFileName", () => {
  it("names cover and inline files with the url extension", () => {
    assert.equal(imageFileName(undefined, "https://c/x.jpg?v=1"), "cover.jpg");
    assert.equal(imageFileName(2, "https://c/x"), "image-2.png");
  });
});

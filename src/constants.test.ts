/**
 * Unit tests for the `--language` flag vocabulary (feature 104).
 *
 * Run with:  pnpm test
 * (node:test via tsx — no test framework dependency in this repo.)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LANGUAGE_FLAG_DESCRIPTION,
  SUPPORTED_LANGUAGE_CODES,
  parseLanguageFlag,
} from "./constants";
import { resolveCode } from "./commands/brand-language";

describe("SUPPORTED_LANGUAGE_CODES", () => {
  it("matches the main repo's canonical vocabulary, in order", () => {
    assert.deepEqual(
      [...SUPPORTED_LANGUAGE_CODES],
      ["en", "es", "pt-BR", "de", "fr", "cs"]
    );
  });

  it("uses canonical BCP-47 casing for Brazilian Portuguese", () => {
    assert.ok(SUPPORTED_LANGUAGE_CODES.includes("pt-BR"));
    assert.ok(!(SUPPORTED_LANGUAGE_CODES as readonly string[]).includes("pt"));
  });

  it("lists every code in the shared help text", () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      assert.ok(
        LANGUAGE_FLAG_DESCRIPTION.includes(code),
        `help text is missing ${code}`
      );
    }
  });
});

describe("parseLanguageFlag", () => {
  it("returns undefined when the flag was not passed", () => {
    // Distinct from null: the server has no default on `language`, so an
    // omitted flag must leave the body key absent rather than sending "en".
    assert.equal(parseLanguageFlag(undefined), undefined);
  });

  it("accepts every supported code as-is", () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      assert.equal(parseLanguageFlag(code), code);
    }
  });

  it("canonicalizes casing, separators and surrounding whitespace", () => {
    assert.equal(parseLanguageFlag("pt-br"), "pt-BR");
    assert.equal(parseLanguageFlag("PT_BR"), "pt-BR");
    assert.equal(parseLanguageFlag("  pt_br  "), "pt-BR");
    assert.equal(parseLanguageFlag("CS"), "cs");
  });

  it("rejects an unsupported regional variant instead of widening it", () => {
    // The server's coerceLanguage would silently return pt-BR here; the CLI
    // tells the caller their code is unsupported instead.
    assert.equal(parseLanguageFlag("pt-PT"), null);
    assert.equal(parseLanguageFlag("en-GB"), null);
  });

  it("rejects unknown, empty and junk values", () => {
    assert.equal(parseLanguageFlag("cz"), null); // common Czech mistake — it's `cs`
    assert.equal(parseLanguageFlag("klingon"), null);
    assert.equal(parseLanguageFlag(""), null);
    assert.equal(parseLanguageFlag("   "), null);
  });
});

describe("resolveCode (pking brand language)", () => {
  const supported = [
    { code: "en", endonym: "English", english: "English" },
    { code: "pt-BR", endonym: "Português (Brasil)", english: "Portuguese (Brazil)" },
    { code: "cs", endonym: "Čeština", english: "Czech" },
  ];

  it("prefers the server's supported list over the compiled-in vocabulary", () => {
    // A language the server knows about but this CLI build does not.
    assert.equal(resolveCode("it", [...supported, { code: "it", endonym: "Italiano", english: "Italian" }]), "it");
    // …and a language this CLI knows about but the server did not return.
    assert.equal(resolveCode("de", supported), null);
  });

  it("canonicalizes against the server list", () => {
    assert.equal(resolveCode("PT_br", supported), "pt-BR");
    assert.equal(resolveCode(" cs ", supported), "cs");
  });

  it("falls back to the local vocabulary when the server sent none", () => {
    assert.equal(resolveCode("cs", []), "cs");
    assert.equal(resolveCode("cz", []), null);
  });
});

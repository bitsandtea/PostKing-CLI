import { createClient } from "../../client";
import { requireBrand, printError, pollOperation, VALID_INTENTS } from "./shared";

// ─── seo seeds ───────────────────────────────────────────────────────────────

export async function seoSeedsCommand(
  seeds: string[],
  options: { brand?: string; wait?: boolean; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/seeds`, { seeds });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Added ${res.data.added ?? seeds.length} seed(s), skipped ${res.data.skipped ?? 0}.`);
    if (res.data.operationId && options.wait !== false) {
      await pollOperation(client, brandId, res.data.operationId, { label: "Auto-score" });
    } else if (res.data.operationId) {
      console.log(`Operation: ${res.data.operationId}`);
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo generate ────────────────────────────────────────────────────────────

export async function seoGenerateCommand(options: {
  brand?: string;
  score?: boolean;
  wait?: boolean;
  json?: boolean;
  language?: string;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  // --no-score sets options.score = false; default is true
  const autoScore = options.score !== false;
  try {
    const res = await client.post(
      `/api/agent/v1/brands/${brandId}/seo/keywords/generate`,
      { autoScore, ...(options.language ? { language: options.language } : {}) }
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(
      options.language
        ? `SUCCESS: Keyword generation started, scoped to "${options.language}".`
        : `SUCCESS: Keyword generation started.`
    );
    if (res.data.operationId) {
      if (options.wait !== false) {
        await pollOperation(client, brandId, res.data.operationId, { label: "Generate keywords" });
      } else {
        console.log(`Operation: ${res.data.operationId}`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo research-cost (110-multilingual-brand) ───────────────────────────────
// Read-only cost estimate for scoping `seo generate --language <code>` to one
// of the brand's languages. No spend, no operation — decision 7: keyword
// research per language is never automatic, so this is the "check the price
// first" step.

export async function seoResearchEstimateCommand(
  language: string,
  options: { brand?: string; json?: boolean }
): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.get(
      `/api/agent/v1/brands/${brandId}/seo/keywords/research-estimate?language=${encodeURIComponent(language)}`
    );
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const { pairCount, estimatedCostUsd, note } = res.data;
    console.log(`\nResearch cost estimate for "${language}":`);
    console.log(`  Markets sharing this language: ${pairCount}`);
    console.log(`  Estimated cost: $${estimatedCostUsd}`);
    if (note) console.log(`  ${note}`);
    console.log(`\nRun with: pking seo generate --language ${language}\n`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo keywords / seo keywords list ────────────────────────────────────────

async function _seoKeywordsFetch(options: { brand?: string; limit?: string; json?: boolean }): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const qs = options.limit ? `?limit=${options.limit}` : "";
    const res = await client.get(`/api/agent/v1/brands/${brandId}/seo/keywords${qs}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const keywords = res.data.keywords ?? [];
    console.log(`\nKeywords (${res.data.total ?? keywords.length}):`);
    keywords
      .forEach((k: { id: string; keyword: string; volume?: number; category?: string }) =>
        console.log(`  ${k.id}  ${k.keyword}  vol=${k.volume ?? "—"}  [${k.category ?? "—"}]`)
      );
    if (res.data.nextCursor) console.log(`Next cursor: ${res.data.nextCursor}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function seoKeywordsCommand(options: {
  brand?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  return _seoKeywordsFetch(options);
}

export async function seoKeywordsListCommand(options: {
  brand?: string;
  limit?: string;
  json?: boolean;
}): Promise<void> {
  return _seoKeywordsFetch(options);
}

// ─── seo keywords edit ───────────────────────────────────────────────────────

export async function seoKeywordsEditCommand(
  id: string,
  options: { brand?: string; tags?: string; intent?: string; priority?: string; excludeClustering?: boolean; includeClustering?: boolean; json?: boolean }
): Promise<void> {
  if (options.intent !== undefined && !VALID_INTENTS.includes(options.intent)) {
    console.error(`ERROR: Invalid --intent "${options.intent}". Must be one of: ${VALID_INTENTS.join(", ")}`);
    process.exit(1);
  }
  let priorityNum: number | undefined;
  if (options.priority !== undefined) {
    priorityNum = Number(options.priority);
    if (isNaN(priorityNum) || priorityNum < 0 || priorityNum > 1) {
      console.error(`ERROR: --priority must be a number between 0 and 1 inclusive.`);
      process.exit(1);
    }
  }
  const hasExclude = options.excludeClustering === true;
  const hasInclude = options.includeClustering === true;
  if (hasExclude && hasInclude) {
    console.error("ERROR: --exclude-clustering and --include-clustering are mutually exclusive.");
    process.exit(1);
  }
  if (options.tags === undefined && options.intent === undefined && priorityNum === undefined && !hasExclude && !hasInclude) {
    console.error("ERROR: provide at least one of --tags, --intent, --priority, --exclude-clustering, --include-clustering");
    process.exit(1);
  }
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  const body: Record<string, unknown> = {};
  if (options.tags !== undefined) {
    const parsedTags = options.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    if (parsedTags.length === 0) {
      console.error("ERROR: --tags produced no values after parsing. Did you mean to omit the flag?");
      process.exit(1);
    }
    body.userTags = parsedTags;
  }
  if (options.intent !== undefined) body.intent = options.intent;
  if (priorityNum !== undefined) body.priority = priorityNum;
  if (hasExclude) body.excludedFromClustering = true;
  if (hasInclude) body.excludedFromClustering = false;
  try {
    const res = await client.patch(`/api/agent/v1/brands/${brandId}/seo/keywords/${id}`, body);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const kw = res.data.keyword ?? res.data;
    console.log(`SUCCESS: Keyword ${id} updated.`);
    if (kw?.keyword) console.log(`Keyword: ${kw.keyword}`);
    if (kw?.intent) console.log(`Intent:  ${kw.intent}`);
    if (kw?.priority !== undefined) console.log(`Priority: ${kw.priority}`);
    if (kw?.userTags?.length) console.log(`Tags:    ${(kw.userTags as string[]).join(", ")}`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo keywords delete ─────────────────────────────────────────────────────

export async function seoKeywordsDeleteCommand(
  id: string,
  options: { brand?: string; destructive?: boolean; json?: boolean }
): Promise<void> {
  if (!options.destructive) {
    console.error("ERROR: Pass --destructive to confirm deletion.");
    process.exit(1);
  }
  const client = createClient();
  const brandId = options.brand ?? requireBrand();
  try {
    const res = await client.delete(`/api/agent/v1/brands/${brandId}/seo/keywords/${id}`);
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Keyword ${id} deleted.`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

// ─── seo categorize ──────────────────────────────────────────────────────────

export async function seoCategorizeCommand(options: {
  brand?: string;
  file?: string;
  keyword?: string;
  intent?: string;
  tags?: string;
  json?: boolean;
}): Promise<void> {
  const client = createClient();
  const brandId = options.brand ?? requireBrand();

  type UpdateItem = { keywordId: string; intent?: string; userTags?: string[] };
  let updates: UpdateItem[];

  if (options.file) {
    const fs = await import("fs");
    try {
      const raw = fs.readFileSync(options.file, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.error("ERROR: --file must contain a JSON array of update objects");
        process.exit(1);
      }
      updates = parsed as UpdateItem[];
    } catch (err) {
      console.error(`ERROR: Could not read file: ${(err as Error).message}`);
      process.exit(1);
    }
    for (const item of updates) {
      if (item.intent !== undefined && !VALID_INTENTS.includes(item.intent)) {
        console.error(`ERROR: Invalid intent "${item.intent}". Must be one of: ${VALID_INTENTS.join(", ")}`);
        process.exit(1);
      }
    }
  } else if (options.keyword) {
    if (options.intent && !VALID_INTENTS.includes(options.intent)) {
      console.error(`ERROR: --intent must be one of: ${VALID_INTENTS.join(", ")}`);
      process.exit(1);
    }
    const item: UpdateItem = { keywordId: options.keyword };
    if (options.intent) item.intent = options.intent;
    if (options.tags) item.userTags = options.tags.split(",").map((t) => t.trim());
    updates = [item];
  } else {
    console.error("ERROR: Provide --file <path> or --keyword <id> (with optional --intent / --tags).");
    process.exit(1);
  }

  try {
    const res = await client.post(`/api/agent/v1/brands/${brandId}/seo/categorize`, { updates });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    console.log(`SUCCESS: Updated ${res.data.updated ?? updates.length} keyword(s).`);
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

import { createClient } from "../client";
import { getBrandId } from "../config";
import { validateLanguageFlag } from "../constants";
import { pollOperation } from "../lib/operations";

// Side-page translation for a landing page's language variant. Translated
// side pages keep the SAME slug and live under the variant (e.g. /cs/pricing).

function printError(err: unknown): void {
  const e = err as {
    response?: { data?: { error?: { message?: string; checkoutUrl?: string; docsUrl?: string } } };
    message: string;
  };
  const env = e.response?.data?.error;
  if (env) {
    console.error(`ERROR: ${env.message ?? "(no message)"}`);
    if (env.checkoutUrl) console.error(`-> Upgrade: ${env.checkoutUrl}`);
    if (env.docsUrl) console.error(`-> Docs: ${env.docsUrl}`);
  } else {
    console.error(`ERROR: ${e.message}`);
  }
}

export async function lpSideTranslateCommand(
  slug: string,
  options: {
    language?: string;
    slugs?: string;
    all?: boolean;
    overwrite?: boolean;
    publish?: boolean;
    wait?: boolean;
    json?: boolean;
  }
): Promise<void> {
  if (!options.language) {
    console.error("ERROR: --language is required, e.g. --language cs");
    process.exit(1);
    return;
  }
  const slugs = options.slugs?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if ((slugs.length > 0) === Boolean(options.all)) {
    console.error("ERROR: pass exactly one of --slugs a,b or --all");
    process.exit(1);
    return;
  }
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  try {
    const res = await client.post(`/api/agent/v1/landing-pages/${slug}/side-pages/translations`, {
      language,
      ...(options.all ? { all: true } : { sidePageSlugs: slugs }),
      ...(options.overwrite ? { overwrite: true } : {}),
      ...(options.publish ? { publish: true } : {}),
    });
    const d = res.data as {
      operationId: string | null;
      variantSlug: string;
      language: string;
      queued: string[];
      skipped: { slug: string; reason: string }[];
    };
    if (options.json) { console.log(JSON.stringify(d, null, 2)); return; }
    console.log(`\nSide-page translation to "${d.language}" under variant "${d.variantSlug}".`);
    console.log(`Queued (${d.queued.length}): ${d.queued.join(", ") || "(none)"}`);
    if (d.skipped.length) {
      console.log(`Skipped (${d.skipped.length}):`);
      d.skipped.forEach((s) => console.log(`  ${s.slug} — ${s.reason}`));
    }
    if (d.operationId) {
      const brandId = getBrandId();
      if (options.wait && brandId) {
        await pollOperation(client, brandId, d.operationId, { label: "Side-page translation" });
      } else {
        console.log(`Operation: ${d.operationId} (re-run with --wait, or check 'pking jobs')`);
      }
    }
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

export async function lpSideTranslationsCommand(
  slug: string,
  options: { language?: string; json?: boolean }
): Promise<void> {
  if (!options.language) {
    console.error("ERROR: --language is required, e.g. --language cs");
    process.exit(1);
    return;
  }
  const language = validateLanguageFlag(options.language);
  const client = createClient();
  try {
    const res = await client.get(`/api/agent/v1/landing-pages/${slug}/side-pages/translations`, {
      params: { language },
    });
    if (options.json) { console.log(JSON.stringify(res.data, null, 2)); return; }
    const d = res.data as {
      variantSlug: string | null;
      items: { slug: string; name: string; type: string; sourcePublished: boolean; translated: boolean; translatedPublished: boolean }[];
    };
    console.log(`\n[Side-page translations: ${slug} -> ${language}]`);
    if (!d.variantSlug) {
      console.log(`No "${language}" variant yet — run 'pking lp translate ${slug} --language ${language}' first.`);
      return;
    }
    console.log(`Variant: ${d.variantSlug}`);
    d.items.forEach((i) =>
      console.log(
        `  ${i.slug}  (${i.type})  source=${i.sourcePublished ? "published" : "draft"}  translated=${
          i.translated ? (i.translatedPublished ? "published" : "draft") : "no"
        }`
      )
    );
  } catch (err) {
    printError(err);
    process.exit(1);
  }
}

/** Converts a social article's constrained HTML to markdown, keeping `[Image N]` markers. */
export function bodyHtmlToMarkdown(html: string): string {
  let out = html ?? "";
  out = out.replace(/<p[^>]*data-image-marker="(\d+)"[^>]*>\s*<\/p>/gi, (_m, n) => `\n\n[Image ${n}]\n\n`);
  out = out.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\n\n## ${t}\n\n`);
  out = out.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t) => `\n\n### ${t}\n\n`);
  out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, t) =>
    "\n\n" + String(t).replace(/<\/?p[^>]*>/gi, "").trim().split("\n").map((l: string) => `> ${l}`).join("\n") + "\n\n"
  );
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
    let i = 0;
    return "\n\n" + String(inner).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x, t) => `${++i}. ${String(t).trim()}\n`) + "\n";
  });
  out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) =>
    "\n\n" + String(inner).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x, t) => `- ${String(t).trim()}\n`) + "\n"
  );
  out = out.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, t) => `[${t}](${href})`);
  out = out.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");
  out = out.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*");
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "");
  out = out.replace(/<[^>]+>/g, "");
  out = out.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Full paste-ready markdown: `# title`, subtitle, body. */
export function articleToMarkdown(a: { title?: string; subtitle?: string | null; bodyHtml?: string }): string {
  const parts: string[] = [];
  if (a.title) parts.push(`# ${a.title}`);
  if (a.subtitle) parts.push(`*${a.subtitle}*`);
  parts.push(bodyHtmlToMarkdown(a.bodyHtml ?? ""));
  return parts.join("\n\n");
}

/** Local filename for a downloaded image: `cover.<ext>` or `image-N.<ext>`. */
export function imageFileName(marker: number | undefined, url: string): string {
  const m = /\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.exec(url);
  const ext = m ? m[1].toLowerCase() : "png";
  return marker ? `image-${marker}.${ext}` : `cover.${ext}`;
}

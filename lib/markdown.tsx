import type { ReactNode } from "react";

/**
 * A small, safe markdown subset for blog posts. It never inserts raw HTML,
 * so a post can only produce headings, paragraphs, lists, quotes, images,
 * links, bold, italic, and code.
 *
 * Blocks:  # / ## / ### headings, > quotes, - or * lists, 1. lists,
 *          ![alt](url) images on their own line, --- rules, paragraphs.
 * Inline:  **bold**, *italic*, `code`, [text](url).
 */

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

function safeHref(url: string): string | null {
  const u = url.trim();
  return SAFE_URL.test(u) ? u : null;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-cream-dim px-1.5 py-0.5 text-[0.9em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) {
        const external = /^https?:\/\//i.test(href);
        out.push(
          <a
            key={key}
            href={href}
            className="font-semibold text-forest underline decoration-forest/40 underline-offset-2 hover:decoration-forest"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {link[1]}
          </a>
        );
      } else {
        out.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "img"; alt: string; src: string }
  | { type: "hr" };

function parse(md: string): Block[] {
  const lines = String(md).replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(t);
    if (h) {
      flush();
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }
    if (/^---+$/.test(t)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(t);
    if (img) {
      flush();
      const src = safeHref(img[2]);
      if (src) blocks.push({ type: "img", alt: img[1], src });
      continue;
    }
    if (t.startsWith(">")) {
      flush();
      const parts = [t.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith(">")) {
        parts.push(lines[++i].trim().replace(/^>\s?/, ""));
      }
      blocks.push({ type: "quote", text: parts.join(" ") });
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      flush();
      const items = [t.replace(/^[-*]\s+/, "")];
      while (i + 1 < lines.length && /^[-*]\s+/.test(lines[i + 1].trim())) {
        items.push(lines[++i].trim().replace(/^[-*]\s+/, ""));
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      flush();
      const items = [t.replace(/^\d+[.)]\s+/, "")];
      while (i + 1 < lines.length && /^\d+[.)]\s+/.test(lines[i + 1].trim())) {
        items.push(lines[++i].trim().replace(/^\d+[.)]\s+/, ""));
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    para.push(t);
  }
  flush();
  return blocks;
}

/** Renders the markdown subset as styled React elements. */
export function Markdown({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-forest-ink/85">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "h":
            if (b.level === 1) {
              return (
                <h2 key={key} className="pt-4 text-3xl font-bold text-forest-ink">
                  {inline(b.text, key)}
                </h2>
              );
            }
            if (b.level === 2) {
              return (
                <h2 key={key} className="pt-4 text-2xl font-bold text-forest-ink">
                  {inline(b.text, key)}
                </h2>
              );
            }
            return (
              <h3 key={key} className="pt-2 text-xl font-bold text-forest-ink">
                {inline(b.text, key)}
              </h3>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-4 border-forest/40 bg-cream-dim/60 px-5 py-3 text-forest-ink/75"
              >
                {inline(b.text, key)}
              </blockquote>
            );
          case "ul":
            return (
              <ul key={key} className="list-disc space-y-1.5 pl-6 marker:text-forest">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-forest">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case "img":
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={key}
                src={b.src}
                alt={b.alt}
                loading="lazy"
                className="w-full rounded-2xl border border-sand"
              />
            );
          case "hr":
            return <hr key={key} className="border-sand" />;
          default:
            return <p key={key}>{inline(b.text, key)}</p>;
        }
      })}
    </div>
  );
}

/** Plain text of the first paragraph, for descriptions when no excerpt is set. */
export function firstParagraph(md: string): string {
  const p = parse(md).find((b) => b.type === "p");
  return p && p.type === "p" ? p.text.replace(/[*`[\]()]/g, "") : "";
}

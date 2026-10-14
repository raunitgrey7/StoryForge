"use client";

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { Doc, Work } from "./types";

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const e = node as HTMLElement;
    const inner = Array.from(e.childNodes).map(walk).join("");
    switch (e.tagName) {
      case "H1": return `# ${inner}\n\n`;
      case "H2": return `## ${inner}\n\n`;
      case "H3": return `### ${inner}\n\n`;
      case "P": return `${inner}\n\n`;
      case "BR": return "  \n";
      case "STRONG": case "B": return `**${inner}**`;
      case "EM": case "I": return `*${inner}*`;
      case "S": return `~~${inner}~~`;
      case "CODE": return `\`${inner}\``;
      case "BLOCKQUOTE": return inner.split("\n").filter(Boolean).map((l) => `> ${l}`).join("\n") + "\n\n";
      case "UL": return Array.from(e.children).map((li) => `- ${Array.from(li.childNodes).map(walk).join("").trim()}`).join("\n") + "\n\n";
      case "OL": return Array.from(e.children).map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(walk).join("").trim()}`).join("\n") + "\n\n";
      case "HR": return "---\n\n";
      default: return inner;
    }
  };
  return walk(el).replace(/\n{3,}/g, "\n\n").trim();
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safe = (s: string) => s.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "storyforge";

export function exportMarkdown(work: Work, docs: Doc[]) {
  const body = docs.map((d) => `## ${d.title}\n\n${htmlToMarkdown(d.html)}`).join("\n\n---\n\n");
  const md = `# ${work.title}\n\n${work.logline ? `_${work.logline}_\n\n` : ""}${body}\n`;
  download(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${safe(work.title)}.md`);
}

export function exportText(work: Work, docs: Doc[]) {
  const txt = `${work.title}\n${"=".repeat(work.title.length)}\n\n${docs.map((d) => `${d.title}\n\n${d.text}`).join("\n\n\n")}\n`;
  download(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${safe(work.title)}.txt`);
}

export function exportHtml(work: Work, docs: Doc[]) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(work.title)}</title>
<style>body{max-width:44em;margin:4em auto;padding:0 1.5em;font-family:Georgia,serif;line-height:1.7;color:#1b1740}h1{font-size:2.4em;margin-bottom:.2em}h2{margin-top:3em}blockquote{border-left:3px solid #c9971c;padding-left:1em;color:#4b4570}</style></head>
<body><h1>${escapeHtml(work.title)}</h1>${work.logline ? `<p><em>${escapeHtml(work.logline)}</em></p>` : ""}
${docs.map((d) => `<section><h2>${escapeHtml(d.title)}</h2>${d.html}</section>`).join("\n")}
</body></html>`;
  download(new Blob([html], { type: "text/html;charset=utf-8" }), `${safe(work.title)}.html`);
}

export async function exportDocx(work: Work, docs: Doc[]) {
  const children: Paragraph[] = [
    new Paragraph({ text: work.title, heading: HeadingLevel.TITLE }),
  ];
  if (work.logline) children.push(new Paragraph({ children: [new TextRun({ text: work.logline, italics: true })] }));
  for (const d of docs) {
    children.push(new Paragraph({ text: d.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    const el = document.createElement("div");
    el.innerHTML = d.html;
    for (const block of Array.from(el.children)) {
      const tag = block.tagName;
      const runs: TextRun[] = [];
      const collect = (n: Node, style: { bold?: boolean; italics?: boolean }) => {
        if (n.nodeType === Node.TEXT_NODE) {
          if (n.textContent) runs.push(new TextRun({ text: n.textContent, ...style }));
          return;
        }
        if (n.nodeType !== Node.ELEMENT_NODE) return;
        const t = (n as HTMLElement).tagName;
        const next = { bold: style.bold || t === "STRONG" || t === "B", italics: style.italics || t === "EM" || t === "I" };
        if (t === "BR") runs.push(new TextRun({ break: 1 }));
        n.childNodes.forEach((c) => collect(c, next));
      };
      block.childNodes.forEach((c) => collect(c, {}));
      if (tag === "H1" || tag === "H2") children.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_2 }));
      else if (tag === "H3") children.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_3 }));
      else if (tag === "UL" || tag === "OL") {
        Array.from(block.children).forEach((li) => children.push(new Paragraph({ text: li.textContent ?? "", bullet: { level: 0 } })));
      } else children.push(new Paragraph({ children: runs, spacing: { after: 200 } }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  download(blob, `${safe(work.title)}.docx`);
}

export function downloadJson(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

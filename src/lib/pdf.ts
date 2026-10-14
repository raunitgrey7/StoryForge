"use client";

import type { Doc, Illustration, Work } from "./types";
import { htmlToText } from "./analysis";

/**
 * Real PDF files, typeset in the browser with embedded open-licence fonts.
 * Each page style sets the face, measure, margins, ornaments and running
 * heads, so the same book can be a classic hardback, a clean modern
 * paperback, a typewritten manuscript, or a gothic edition.
 */

export type PageStyleId = "classic" | "modern" | "manuscript" | "gothic" | "reader";

interface Face {
  family: string;
  regular: string;
  italic?: string;
}

export interface PageStyle {
  id: PageStyleId;
  label: string;
  blurb: string;
  face: Face;
  titleFace?: Face;
  size: number; // body pt
  leading: number; // line height multiplier
  margins: { top: number; bottom: number; inner: number; outer: number }; // mm
  page: "a5" | "a4" | "letter" | [number, number];
  dropCap: boolean;
  ornament: string; // between scenes / under chapter titles
  /** Draw the ornament as a small lozenge instead of a glyph (for faces that lack it). */
  drawnOrnament?: boolean;
  runningHead: boolean;
  chapterOnNewPage: boolean;
  justify: boolean;
  ink: [number, number, number];
  paper?: [number, number, number];
}

const EB: Face = { family: "EBGaramond", regular: "/fonts/EBGaramond.ttf", italic: "/fonts/EBGaramond-Italic.ttf" };
const LITERATA: Face = { family: "Literata", regular: "/fonts/Literata.ttf", italic: "/fonts/Literata-Italic.ttf" };
const INSTRUMENT: Face = { family: "InstrumentSans", regular: "/fonts/InstrumentSans.ttf" };
const COURIER: Face = { family: "CourierPrime", regular: "/fonts/CourierPrime.ttf", italic: "/fonts/CourierPrime-Italic.ttf" };
const CORMORANT: Face = { family: "CormorantGaramond", regular: "/fonts/CormorantGaramond.ttf", italic: "/fonts/CormorantGaramond-Italic.ttf" };

export const PAGE_STYLES: PageStyle[] = [
  {
    id: "classic",
    label: "Classic hardback",
    blurb: "Garamond on A5, generous margins, drop caps, a fleuron between scenes.",
    face: EB,
    size: 11,
    leading: 1.45,
    margins: { top: 22, bottom: 22, inner: 20, outer: 16 },
    page: "a5",
    dropCap: true,
    ornament: "❦",
    runningHead: true,
    chapterOnNewPage: true,
    justify: true,
    ink: [30, 26, 40],
  },
  {
    id: "modern",
    label: "Modern paperback",
    blurb: "Literata text with a sans title, tight and readable.",
    face: LITERATA,
    titleFace: INSTRUMENT,
    size: 10.5,
    leading: 1.5,
    margins: { top: 18, bottom: 20, inner: 17, outer: 15 },
    page: "a5",
    dropCap: false,
    ornament: "•",
    drawnOrnament: true,
    runningHead: true,
    chapterOnNewPage: true,
    justify: false,
    ink: [20, 20, 24],
  },
  {
    id: "manuscript",
    label: "Manuscript",
    blurb: "Courier, double-spaced, letter size. What you would send an editor.",
    face: COURIER,
    size: 12,
    leading: 2,
    margins: { top: 25, bottom: 25, inner: 25, outer: 25 },
    page: "letter",
    dropCap: false,
    ornament: "#",
    runningHead: true,
    chapterOnNewPage: true,
    justify: false,
    ink: [0, 0, 0],
  },
  {
    id: "gothic",
    label: "Gothic edition",
    blurb: "Cormorant on cream paper, tall margins, ornamented chapter heads.",
    face: CORMORANT,
    size: 12,
    leading: 1.4,
    margins: { top: 26, bottom: 24, inner: 20, outer: 18 },
    page: "a5",
    dropCap: true,
    ornament: "✦",
    drawnOrnament: true,
    runningHead: true,
    chapterOnNewPage: true,
    justify: true,
    ink: [40, 22, 30],
    paper: [250, 244, 230],
  },
  {
    id: "reader",
    label: "Phone reader",
    blurb: "Narrow page, large type, one column. For reading on a screen.",
    face: LITERATA,
    size: 13,
    leading: 1.5,
    margins: { top: 12, bottom: 14, inner: 10, outer: 10 },
    page: [100, 178],
    dropCap: false,
    ornament: "•",
    runningHead: false,
    chapterOnNewPage: true,
    justify: false,
    ink: [24, 22, 32],
  },
];

const fontCache = new Map<string, string>();

async function loadFont(url: string): Promise<string> {
  const cached = fontCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load font ${url}`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  const b64 = btoa(bin);
  fontCache.set(url, b64);
  return b64;
}

export type PaperId = "aged" | "cream" | "white";

export const PAPERS: { id: PaperId; label: string; blurb: string }[] = [
  { id: "aged", label: "Aged", blurb: "Old-book cream with darkened edges and a little foxing." },
  { id: "cream", label: "Cream", blurb: "Warm, even, unmarked." },
  { id: "white", label: "White", blurb: "Plain printer white." },
];

export interface PdfOptions {
  style: PageStyleId;
  paper?: PaperId;
  author?: string;
  includeTitlePage?: boolean;
  illustrations?: Map<string, Illustration>;
  onProgress?: (msg: string) => void;
}

/** Small seeded PRNG so foxing is the same every time the same book is built. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the PDF and hand it back as a Blob. The caller decides whether to download or preview. */
export async function buildPdf(work: Work, docs: Doc[], opts: PdfOptions): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const style = PAGE_STYLES.find((s) => s.id === opts.style) ?? PAGE_STYLES[0];
  opts.onProgress?.("Loading fonts");

  const pdf = new jsPDF({ unit: "mm", format: style.page, compress: true });
  const faces: { name: string; face: Face }[] = [{ name: "body", face: style.face }];
  if (style.titleFace) faces.push({ name: "title", face: style.titleFace });
  const registered = new Map<string, { regular: string; italic: string }>();
  for (const { name, face } of faces) {
    const reg = await loadFont(face.regular);
    pdf.addFileToVFS(`${face.family}-Regular.ttf`, reg);
    pdf.addFont(`${face.family}-Regular.ttf`, face.family, "normal");
    let italicStyle = "normal";
    if (face.italic) {
      const it = await loadFont(face.italic);
      pdf.addFileToVFS(`${face.family}-Italic.ttf`, it);
      pdf.addFont(`${face.family}-Italic.ttf`, face.family, "italic");
      italicStyle = "italic";
    }
    registered.set(name, { regular: face.family, italic: italicStyle });
  }
  const body = registered.get("body")!;
  const title = registered.get("title") ?? body;

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const m = style.margins;
  const lineH = (style.size * style.leading) / 2.835; // pt -> mm
  const [r, g, b] = style.ink;
  let pageNo = 0;
  let y = 0;
  const paperId: PaperId = opts.paper ?? "aged";
  const rand = rng(work.title.length * 7919 + docs.length);

  /** The page itself: aged cream with a vignette and foxing, plain cream, or white. */
  const paper = () => {
    if (paperId === "white") {
      if (style.paper) {
        pdf.setFillColor(...style.paper);
        pdf.rect(0, 0, W, H, "F");
      }
      return;
    }
    const base: [number, number, number] = paperId === "aged" ? [241, 224, 186] : [248, 241, 222];
    pdf.setFillColor(...base);
    pdf.rect(0, 0, W, H, "F");
    if (paperId !== "aged") return;
    // Vignette: darker rings toward the edges, drawn as translucent frames.
    const GState = (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
    const setOpacity = (o: number) => (pdf as unknown as { setGState: (g: unknown) => void }).setGState(new GState({ opacity: o }));
    pdf.setFillColor(160, 118, 66);
    const rings = 14;
    for (let i = 0; i < rings; i++) {
      const inset = (i / rings) * Math.min(W, H) * 0.22;
      setOpacity(0.012 + (1 - i / rings) * 0.03);
      pdf.rect(0, 0, W, H, "F");
      pdf.setFillColor(...base);
      setOpacity(1);
      pdf.rect(inset, inset, W - inset * 2, H - inset * 2, "F");
      pdf.setFillColor(160, 118, 66);
    }
    // Foxing: faint freckles, denser near the edges.
    for (let i = 0; i < 140; i++) {
      const edgeBias = rand() < 0.6;
      const x = edgeBias ? (rand() < 0.5 ? rand() * W * 0.18 : W - rand() * W * 0.18) : rand() * W;
      const yy = edgeBias && rand() < 0.5 ? (rand() < 0.5 ? rand() * H * 0.14 : H - rand() * H * 0.14) : rand() * H;
      const rad = 0.15 + rand() * 0.9;
      setOpacity(0.05 + rand() * 0.12);
      pdf.setFillColor(150, 105, 55);
      pdf.circle(x, yy, rad, "F");
    }
    // A faint warm glow in the middle so text sits on the lightest paper.
    setOpacity(0.18);
    pdf.setFillColor(252, 244, 220);
    pdf.rect(W * 0.12, H * 0.1, W * 0.76, H * 0.8, "F");
    setOpacity(1);
  };

  /** A scene ornament: the style's glyph, or a drawn lozenge on a hairline for faces without the glyph. */
  const ornament = (cx: number, cy: number) => {
    if (!style.drawnOrnament) {
      pdf.setFont(body.regular, "normal");
      pdf.setFontSize(style.size);
      pdf.text(style.ornament, cx, cy, { align: "center" });
      return;
    }
    pdf.setDrawColor(r, g, b);
    pdf.setFillColor(r, g, b);
    pdf.setLineWidth(0.2);
    pdf.line(cx - 14, cy - 1.2, cx - 3, cy - 1.2);
    pdf.line(cx + 3, cy - 1.2, cx + 14, cy - 1.2);
    pdf.triangle(cx, cy - 2.7, cx + 1.5, cy - 1.2, cx, cy + 0.3, "F");
    pdf.triangle(cx, cy - 2.7, cx - 1.5, cy - 1.2, cx, cy + 0.3, "F");
  };

  const leftMargin = () => (pageNo % 2 === 1 ? m.inner : m.outer);
  const measure = () => W - m.inner - m.outer;

  const newPage = (first = false) => {
    if (!first) pdf.addPage();
    pageNo++;
    paper();
    y = m.top;
  };

  const runningHead = (text: string) => {
    if (!style.runningHead) return;
    pdf.setFont(body.regular, body.italic);
    pdf.setFontSize(style.size * 0.75);
    pdf.setTextColor(r, g, b);
    pdf.text(text, W / 2, m.top - 8, { align: "center" });
  };

  const folio = () => {
    pdf.setFont(body.regular, "normal");
    pdf.setFontSize(style.size * 0.8);
    pdf.setTextColor(r, g, b);
    pdf.text(String(pageNo), W / 2, H - m.bottom + 9, { align: "center" });
  };

  const ensure = (needed: number, head: string) => {
    if (y + needed > H - m.bottom) {
      folio();
      newPage();
      runningHead(head);
    }
  };

  const paragraph = (text: string, head: string, italic = false, first = false) => {
    pdf.setFont(body.regular, italic ? body.italic : "normal");
    pdf.setFontSize(style.size);
    pdf.setTextColor(r, g, b);
    const x = leftMargin();
    const width = measure();
    let lines: string[] = pdf.splitTextToSize(text, width);
    if (first && style.dropCap && text.length > 2 && /^[A-Za-z“"]/.test(text)) {
      // Drop cap: draw the first letter large, wrap the first three lines around it.
      const cap = text[0];
      const rest = text.slice(1);
      pdf.setFontSize(style.size * 3.2);
      const capW = pdf.getTextWidth(cap) + 1.2;
      pdf.text(cap, x, y + lineH * 2.05);
      pdf.setFontSize(style.size);
      const narrow: string[] = pdf.splitTextToSize(rest, width - capW);
      const firstThree = narrow.slice(0, 3);
      const remainder = narrow.slice(3).join(" ");
      const wide: string[] = remainder ? pdf.splitTextToSize(remainder, width) : [];
      lines = [...firstThree.map((l) => `\u0001${l}`), ...wide];
      for (const line of lines) {
        ensure(lineH, head);
        const indented = line.startsWith("\u0001");
        const t = indented ? line.slice(1) : line;
        pdf.text(t, x + (indented ? capW : 0), y, { align: style.justify && !indented ? "justify" : "left", maxWidth: width - (indented ? capW : 0) });
        y += lineH;
      }
    } else {
      const indent = !first && !italic ? lineH * 0.9 : 0;
      for (const [i, line] of lines.entries()) {
        ensure(lineH, head);
        const isLast = i === lines.length - 1;
        pdf.text(line, x + (i === 0 ? indent : 0), y, {
          align: style.justify && !isLast ? "justify" : "left",
          maxWidth: width - (i === 0 ? indent : 0),
        });
        y += lineH;
      }
    }
    y += lineH * 0.35;
  };

  const heading = (text: string, sub?: string) => {
    pdf.setFont(title.regular, "normal");
    pdf.setFontSize(style.size * 2.1);
    pdf.setTextColor(r, g, b);
    y += lineH * 3;
    const lines: string[] = pdf.splitTextToSize(text, measure());
    for (const line of lines) {
      pdf.text(line, W / 2, y, { align: "center" });
      y += lineH * 1.7;
    }
    if (sub) {
      pdf.setFont(body.regular, body.italic);
      pdf.setFontSize(style.size * 0.9);
      pdf.text(sub, W / 2, y, { align: "center" });
      y += lineH;
    }
    ornament(W / 2, y + lineH * 0.6);
    y += lineH * 2.4;
  };

  // ---- title page ----
  newPage(true);
  if (opts.includeTitlePage !== false) {
    pdf.setFont(title.regular, "normal");
    pdf.setFontSize(style.size * 2.8);
    pdf.setTextColor(r, g, b);
    const tl: string[] = pdf.splitTextToSize(work.title, measure());
    let ty = H * 0.36;
    for (const line of tl) {
      pdf.text(line, W / 2, ty, { align: "center" });
      ty += lineH * 2.4;
    }
    if (work.logline) {
      pdf.setFont(body.regular, body.italic);
      pdf.setFontSize(style.size);
      const ll: string[] = pdf.splitTextToSize(work.logline, measure() * 0.8);
      ty += lineH;
      for (const line of ll) {
        pdf.text(line, W / 2, ty, { align: "center" });
        ty += lineH;
      }
    }
    if (opts.author) {
      pdf.setFont(body.regular, "normal");
      pdf.setFontSize(style.size * 1.1);
      pdf.text(opts.author, W / 2, H * 0.72, { align: "center" });
    }
    ornament(W / 2, H * 0.8);
    newPage();
  }

  // ---- chapters ----
  const chapters = docs.filter((d) => !d.parentId).sort((a, b) => a.order - b.order);
  for (const [i, d] of chapters.entries()) {
    opts.onProgress?.(`Typesetting ${d.title}`);
    if (i > 0 && style.chapterOnNewPage) {
      folio();
      newPage();
    }
    heading(d.title, chapters.length > 1 ? `${i + 1}` : undefined);
    const ill = opts.illustrations?.get(d.id);
    if (ill) {
      try {
        const props = pdf.getImageProperties(ill.dataUrl);
        const maxW = measure();
        const maxH = (H - m.top - m.bottom) * 0.42;
        let iw = maxW;
        let ih = (props.height / props.width) * iw;
        if (ih > maxH) {
          ih = maxH;
          iw = (props.width / props.height) * ih;
        }
        ensure(ih + lineH * 2, work.title);
        const ix = leftMargin() + (maxW - iw) / 2;
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(0.25);
        pdf.rect(ix - 0.8, y - 0.8, iw + 1.6, ih + 1.6, "S");
        pdf.addImage(ill.dataUrl, ill.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG", ix, y, iw, ih, undefined, "MEDIUM");
        y += ih + lineH * 1.6;
      } catch {
        // an unreadable image never blocks the book
      }
    }
    const paras = htmlToText(d.html).split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
    const verse = work.craft === "poetry" || work.craft === "lyrics";
    let first = true;
    for (const p of paras) {
      if (/^(\*\s*\*\s*\*|---|~~~|#)$/.test(p)) {
        ensure(lineH * 2, work.title);
        ornament(W / 2, y + lineH * 0.5);
        y += lineH * 2;
        first = true;
        continue;
      }
      if (verse) {
        ensure(lineH, work.title);
        pdf.setFont(body.regular, "normal");
        pdf.setFontSize(style.size);
        pdf.text(p, leftMargin() + measure() * 0.1, y);
        y += lineH;
        continue;
      }
      paragraph(p, work.title, false, first && !verse);
      first = false;
    }
    if (verse) y += lineH;
  }
  folio();

  pdf.setProperties({ title: work.title, subject: work.logline, author: opts.author ?? "", creator: "StoryForge" });
  return pdf.output("blob");
}

export async function downloadPdf(work: Work, docs: Doc[], opts: PdfOptions) {
  const blob = await buildPdf(work, docs, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${work.title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "storyforge"}-${opts.style}-${opts.paper ?? "aged"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ManuscriptItem } from "@/mockData";
import { FrontBackMatterData } from "@/lib/storage";

export interface EpubOptions {
  title: string;
  subtitle?: string;
  author: string;
  language?: string;
  coverImageUrl?: string;
  genre?: string;
  includeTitlePage?: boolean;
  includeCopyright?: boolean;
  includeTocPage?: boolean;
  includeAboutAuthor?: boolean;
  includeAcknowledgments?: boolean;
  includeReviewRequest?: boolean;
  authorBio?: string;
  manuscript: ManuscriptItem[];
  stripInternalMentions?: boolean;
  matter?: FrontBackMatterData;
}

export interface ChapterHeadingInfo {
  numberText: string; // e.g. "CHAPTER 1"
  titleText: string;  // e.g. "The Arrival"
  fullTitle: string;  // e.g. "Chapter 1: The Arrival" for TOC & navigation
}

// Inline formatting that survives export (italics carry thoughts and emphasis in fiction)
export interface TextRunData {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

// A paragraph, or a scene break (the editor's "Scene break" button inserts <hr>)
export interface ContentBlock {
  type: "p" | "break";
  runs: TextRunData[];
}

interface ParsedScene {
  title?: string;
  blocks: ContentBlock[];
}

export interface ParsedChapter {
  id: string;
  index: number;
  title: string;
  numberText: string;
  titleText: string;
  fullTitle: string;
  filename: string;
  scenes: ParsedScene[];
}

export interface ParsedPart {
  id: string;
  index: number;
  title: string;
  filename: string;
  chapters: ParsedChapter[];
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface ManuscriptAuditResult {
  sourceChapterCount: number;
  compiledChapterCount: number;
  sourceParagraphCount: number;
  compiledParagraphCount: number;
  sourceWordCount: number;
  compiledWordCount: number;
  emptyChapters: string[];
  isLossless: boolean;
  warnings: string[];
}

// Book order: part dividers and chapters exactly as they sit in the manuscript
export type BookSection =
  | { kind: "part"; part: ParsedPart }
  | { kind: "chapter"; chapter: ParsedChapter; inPart: boolean };

export interface BookStructure {
  parts: ParsedPart[];
  flatChapters: ParsedChapter[];
  order: BookSection[];
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function padZero(num: number, size: number = 3): string {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

/**
 * Standard RFC 4122 v4 UUID generator for book identifier
 */
export function generateEpubUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return `urn:uuid:${crypto.randomUUID()}`;
    } catch {
      // Fallback below
    }
  }
  return "urn:uuid:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strips internal software markers like @mentions and internal metadata tags
 */
export function cleanInternalMentionsAndTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/(^|[\s\(\[\{"'“‘—–\.,;:!?-])@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g, "$1$2")
    .replace(/^@/, "")
    .replace(/\s*data-[a-z0-9\-_]+="[^"]*"/gi, "")
    .trim();
}

const MENTION_AT = /(^|[\s\(\[\{"'“‘—–\.,;:!?-])@([A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g;

export function safeFilename(title: string, ext: string): string {
  const base = (title || "Untitled").trim().replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "Untitled"}.${ext}`;
}

export function blockText(block: ContentBlock): string {
  return block.runs.map((r) => r.text).join("");
}

export function countBlockWords(blocks: ContentBlock[]): number {
  return blocks.reduce((n, b) => n + (b.type === "p" ? blockText(b).split(/\s+/).filter(Boolean).length : 0), 0);
}

/**
 * Normalizes strings strictly for exact title comparison
 */
export function normalizeForExactTitleMatch(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^["'“‘#\s]+|["'”’:\s]+$/g, "")
    .trim();
}

/**
 * Checks cover image resolution against Amazon KDP requirements
 */
export async function checkCoverResolution(
  urlOrData?: string
): Promise<{ width: number; height: number; isAdequate: boolean; message: string }> {
  if (!urlOrData) {
    return {
      width: 0,
      height: 0,
      isAdequate: false,
      message: "No cover image attached.",
    };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const isAdequate = w >= 625 && h >= 1000;
      let message = `Cover resolution: ${w} x ${h}px.`;
      if (!isAdequate) {
        message = `Cover resolution is low (${w} x ${h}px). Amazon KDP recommends at least 1,600 x 2,560px (minimum 625 x 1,000px).`;
      } else if (w >= 1600 && h >= 2500) {
        message = `High resolution Kindle-ready cover: ${w} x ${h}px.`;
      }
      resolve({ width: w, height: h, isAdequate, message });
    };
    img.onerror = () => {
      resolve({
        width: 0,
        height: 0,
        isAdequate: false,
        message: "Unable to inspect cover image file.",
      });
    };
    img.src = urlOrData;
  });
}

/**
 * Parses chapter title into a clean two-level heading:
 * Level 1: "CHAPTER 1"
 * Level 2: "The Arrival"
 */
export function parseChapterHeading(
  rawTitle: string,
  index: number,
  language: string = "en"
): ChapterHeadingInfo {
  const clean = cleanInternalMentionsAndTags(rawTitle);
  const defaultPrefix = "CHAPTER";
  const defaultFullPrefix = "Chapter";

  if (/^(prologue|epilogue|interlude|afterword|preface|introduction)/i.test(clean)) {
    return {
      numberText: "",
      titleText: clean.toUpperCase(),
      fullTitle: clean,
    };
  }

  // 1. "Chapter 1: The Arrival" or "Chapter 1 - The Arrival"
  const matchWithSub = clean.match(/^(chapter|chap|ch\.?)\s*([0-9ivxlcdm]+)\s*[:\-\u2013\u2014]\s*(.+)$/i);
  if (matchWithSub) {
    const prefix = matchWithSub[1].toUpperCase();
    const num = matchWithSub[2].trim();
    const sub = matchWithSub[3].trim();
    return {
      numberText: `${prefix} ${num}`,
      titleText: sub,
      fullTitle: `${matchWithSub[1]} ${num}: ${sub}`,
    };
  }

  // 2. "Chapter 1" without subtitle
  const matchOnlyNum = clean.match(/^(chapter|chap|ch\.?)\s*([0-9ivxlcdm]+)$/i);
  if (matchOnlyNum) {
    const prefix = matchOnlyNum[1].toUpperCase();
    const num = matchOnlyNum[2].trim();
    return {
      numberText: `${prefix} ${num}`,
      titleText: "",
      fullTitle: `${matchOnlyNum[1]} ${num}`,
    };
  }

  // 3. "1. The Arrival"
  const matchNumberedSub = clean.match(/^([0-9]+)\s*[:\.\-\u2013\u2014]\s*(.+)$/);
  if (matchNumberedSub) {
    const num = matchNumberedSub[1].trim();
    const sub = matchNumberedSub[2].trim();
    return {
      numberText: `${defaultPrefix} ${num}`,
      titleText: sub,
      fullTitle: `${defaultFullPrefix} ${num}: ${sub}`,
    };
  }

  // 4. Default: Name like "The Arrival"
  return {
    numberText: `${defaultPrefix} ${index}`,
    titleText: clean,
    fullTitle: `${defaultFullPrefix} ${index}: ${clean}`,
  };
}

/**
 * Converts editor HTML into paragraphs with bold/italic runs and scene breaks.
 * STRICT CONTENT PROTECTION: only a heading, or the very first paragraph, that
 * EXACTLY matches the chapter/scene title is dropped (to avoid a doubled title).
 */
export function htmlToBlocks(
  html: string,
  stripMentions: boolean = true,
  exactTitlesToStrip: string[] = []
): ContentBlock[] {
  if (!html) return [];

  const container = document.createElement("div");
  container.innerHTML = html;

  if (stripMentions) {
    container.querySelectorAll('span[data-type="mention"], span.mention, [data-mention="true"]').forEach((el) => {
      const text = el.textContent || "";
      el.textContent = text.startsWith("@") ? text.substring(1) : text;
    });
  }

  const exactTargets = exactTitlesToStrip.map(normalizeForExactTitleMatch).filter((t) => t.length > 0);
  container.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
    const clean = normalizeForExactTitleMatch(heading.textContent || "");
    if (clean && exactTargets.includes(clean)) heading.remove();
  });

  const blocks: ContentBlock[] = [];
  let current: TextRunData[] = [];
  const flush = () => {
    if (current.length) blocks.push({ type: "p", runs: current });
    current = [];
  };
  const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "UL", "OL", "PRE", "SECTION", "ARTICLE"]);

  const walk = (node: Node, bold: boolean, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = (node.textContent || "").replace(/\s+/g, " ");
      if (stripMentions) text = text.replace(MENTION_AT, "$1$2");
      if (text) current.push({ text, bold: bold || undefined, italic: italic || undefined });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === "BR") { flush(); return; }
    if (tag === "HR") { flush(); blocks.push({ type: "break", runs: [] }); return; }
    if (tag === "SCRIPT" || tag === "STYLE") return;
    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) flush();
    const b = bold || tag === "STRONG" || tag === "B" || /^H[1-6]$/.test(tag);
    const i = italic || tag === "EM" || tag === "I";
    el.childNodes.forEach((child) => walk(child, b, i));
    if (isBlock) flush();
  };
  container.childNodes.forEach((child) => walk(child, false, false));
  flush();

  // Tidy runs: merge neighbours with the same style, trim paragraph edges, drop empties
  const tidy: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "break") {
      if (tidy.length && tidy[tidy.length - 1].type !== "break") tidy.push(block);
      continue;
    }
    const merged: TextRunData[] = [];
    for (const run of block.runs) {
      const last = merged[merged.length - 1];
      if (last && !!last.bold === !!run.bold && !!last.italic === !!run.italic) last.text += run.text;
      else merged.push({ ...run });
    }
    if (merged.length) {
      merged[0].text = merged[0].text.replace(/^\s+/, "");
      merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, "");
    }
    const runs = merged.filter((r) => r.text.length > 0);
    if (runs.length) tidy.push({ type: "p", runs });
  }
  while (tidy.length && tidy[tidy.length - 1].type === "break") tidy.pop();

  const firstP = tidy.findIndex((b) => b.type === "p");
  if (firstP === 0 && exactTargets.length && exactTargets.includes(normalizeForExactTitleMatch(blockText(tidy[0])))) {
    tidy.shift();
  }
  while (tidy.length && tidy[0].type === "break") tidy.shift();
  return tidy;
}

/** Plain-text paragraphs (kept for callers that do not need formatting) */
export function cleanContentToParagraphs(
  html: string,
  stripMentions: boolean = true,
  exactTitlesToStrip: string[] = []
): string[] {
  return htmlToBlocks(html, stripMentions, exactTitlesToStrip)
    .filter((b) => b.type === "p")
    .map(blockText);
}

/**
 * Safely loads cover binary data from DataURL or HTTP URL
 */
async function loadCoverBinary(urlOrData?: string): Promise<Uint8Array | null> {
  if (!urlOrData || typeof urlOrData !== "string") return null;
  try {
    if (urlOrData.startsWith("data:")) {
      const base64Index = urlOrData.indexOf(",");
      if (base64Index === -1) return null;
      const base64 = urlOrData.substring(base64Index + 1);
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      const resp = await fetch(urlOrData);
      if (!resp.ok) return null;
      const buffer = await resp.arrayBuffer();
      return new Uint8Array(buffer);
    }
  } catch (err) {
    console.warn("Cover image could not be loaded into EPUB:", err);
    return null;
  }
}

/**
 * Parses the manuscript into parts and chapters in reading order.
 * Chapters that sit outside a part are kept in place (they used to be dropped
 * from the EPUB whenever the book also had parts).
 */
export function parseManuscriptStructure(
  items: ManuscriptItem[],
  stripMentions: boolean,
  language: string = "en"
): BookStructure {
  const parts: ParsedPart[] = [];
  const flatChapters: ParsedChapter[] = [];
  const order: BookSection[] = [];
  let fileIndex = 0;
  let chapterNumber = 0; // printed number; prologues/epilogues do not consume one
  let partCount = 0;

  const makeChapter = (item: ManuscriptItem, inPart: boolean): ParsedChapter => {
    fileIndex++;
    const rawTitle = stripMentions ? cleanInternalMentionsAndTags(item.title) : item.title;
    const headingInfo = parseChapterHeading(rawTitle, chapterNumber + 1, language);
    if (headingInfo.numberText) {
      const explicit = headingInfo.numberText.match(/(\d+)$/);
      chapterNumber = explicit ? Number(explicit[1]) : chapterNumber + 1;
    }
    const targets = [item.title, rawTitle, headingInfo.numberText, headingInfo.titleText, headingInfo.fullTitle].filter(Boolean);

    const scenes: ParsedScene[] = [];
    if (item.content && item.content.trim()) {
      scenes.push({ title: item.title, blocks: htmlToBlocks(item.content, stripMentions, targets) });
    }
    for (const child of item.children || []) {
      if (child.type === "scene" && child.content) {
        const blocks = htmlToBlocks(child.content, stripMentions, [...targets, child.title]);
        if (blocks.length) scenes.push({ title: child.title, blocks });
      }
    }

    const chap: ParsedChapter = {
      id: `chap_${padZero(fileIndex)}`,
      index: fileIndex,
      title: rawTitle,
      numberText: headingInfo.numberText,
      titleText: headingInfo.titleText,
      fullTitle: headingInfo.fullTitle,
      filename: `chapter_${padZero(fileIndex)}.xhtml`,
      scenes: scenes.filter((sc) => sc.blocks.length > 0),
    };
    flatChapters.push(chap);
    return chap;
  };

  for (const item of items) {
    if (item.type === "part") {
      partCount++;
      const part: ParsedPart = {
        id: `part_${padZero(partCount)}`,
        index: partCount,
        title: stripMentions ? cleanInternalMentionsAndTags(item.title) : item.title,
        filename: `part_${padZero(partCount)}.xhtml`,
        chapters: [],
      };
      parts.push(part);
      order.push({ kind: "part", part });
      for (const child of item.children || []) {
        if (child.type === "chapter" || (child.type === "scene" && child.content && child.content.trim())) {
          const chap = makeChapter(child, true);
          part.chapters.push(chap);
          order.push({ kind: "chapter", chapter: chap, inPart: true });
        }
      }
    } else if (item.type === "chapter" || (item.type === "scene" && item.content && item.content.trim())) {
      order.push({ kind: "chapter", chapter: makeChapter(item, false), inPart: false });
    }
  }

  return { parts, flatChapters, order };
}

/**
 * Counts what goes into the book so the dialog can show an honest summary
 */
export function auditManuscriptContent(
  items: ManuscriptItem[],
  stripMentions: boolean,
  language: string = "en"
): ManuscriptAuditResult {
  let sourceChapters = 0;
  let sourceParagraphs = 0;
  let sourceWords = 0;

  const countItems = (arr: ManuscriptItem[]) => {
    for (const item of arr) {
      if (item.type === "chapter" || (item.type === "scene" && item.content)) sourceChapters++;
      if (item.content && item.content.trim()) {
        const blocks = htmlToBlocks(item.content, stripMentions, []);
        sourceParagraphs += blocks.filter((b) => b.type === "p").length;
        sourceWords += countBlockWords(blocks);
      }
      if (item.children) countItems(item.children);
    }
  };
  countItems(items);

  const { flatChapters } = parseManuscriptStructure(items, stripMentions, language);
  let compiledParagraphs = 0;
  let compiledWords = 0;
  const emptyChapters: string[] = [];
  flatChapters.forEach((ch) => {
    let chapterWords = 0;
    ch.scenes.forEach((sc) => {
      compiledParagraphs += sc.blocks.filter((b) => b.type === "p").length;
      chapterWords += countBlockWords(sc.blocks);
    });
    compiledWords += chapterWords;
    if (chapterWords === 0) emptyChapters.push(ch.fullTitle);
  });

  const warnings: string[] = [];
  if (flatChapters.length === 0 && sourceChapters > 0) {
    warnings.push(`Manuscript contains ${sourceChapters} items but no chapters could be compiled.`);
  }

  return {
    sourceChapterCount: sourceChapters,
    compiledChapterCount: flatChapters.length,
    sourceParagraphCount: sourceParagraphs,
    compiledParagraphCount: compiledParagraphs,
    sourceWordCount: sourceWords,
    compiledWordCount: compiledWords,
    emptyChapters,
    // Only exact duplicate titles may be dropped, so words can differ by a title at most
    isLossless: flatChapters.length > 0 && compiledWords > 0 && sourceWords - compiledWords <= flatChapters.length * 12,
    warnings,
  };
}

/** Multi-line user text (dedication, bio…) as separate paragraphs */
function textToParagraphsHtml(text: string, attrs = ""): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p${attrs}>${escapeXml(line)}</p>`)
    .join("\n    ");
}

function runsToXhtml(runs: TextRunData[]): string {
  return runs
    .map((r) => {
      let out = escapeXml(r.text);
      if (r.italic) out = `<em>${out}</em>`;
      if (r.bold) out = `<strong>${out}</strong>`;
      return out;
    })
    .join("");
}

function detectImageType(bytes: Uint8Array): { ext: string; mediaType: string } {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", mediaType: "image/png" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return { ext: "gif", mediaType: "image/gif" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return { ext: "webp", mediaType: "image/webp" };
  return { ext: "jpg", mediaType: "image/jpeg" };
}

/**
 * Validates the generated EPUB before allowing download:
 * Checks XML/XHTML parsing, manifest & spine references, and ZIP integrity.
 */
export async function validateEpubArchive(
  zip: JSZip,
  manifestItems: ManifestItem[],
  spineItemRefs: { idref: string }[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const parser = new DOMParser();

  // 1. Verify mimetype
  const mime = zip.file("mimetype");
  if (!mime) {
    errors.push("Missing 'mimetype' file at EPUB root.");
  }

  // 2. Verify container.xml
  const container = zip.file("META-INF/container.xml");
  if (!container) {
    errors.push("Missing 'META-INF/container.xml' rootfile entry.");
  }

  // 3. Verify manifest files exist in zip
  for (const item of manifestItems) {
    const file = zip.file(`EPUB/${item.href}`);
    if (!file) {
      errors.push(`Manifest references missing file: EPUB/${item.href}`);
    }
  }

  // 4. Verify spine items exist in manifest
  const manifestIdSet = new Set(manifestItems.map((m) => m.id));
  for (const ref of spineItemRefs) {
    if (!manifestIdSet.has(ref.idref)) {
      errors.push(`Spine itemref '${ref.idref}' not found in manifest.`);
    }
  }

  // 5. XML / XHTML Well-formedness check for all text, nav, opf, ncx
  const checkFiles = [
    "EPUB/package.opf",
    "EPUB/nav.xhtml",
    "EPUB/toc.ncx",
    ...manifestItems
      .filter((m) => m.href.endsWith(".xhtml") || m.href.endsWith(".xml"))
      .map((m) => `EPUB/${m.href}`),
  ];

  for (const filePath of checkFiles) {
    const file = zip.file(filePath);
    if (file) {
      try {
        const text = await file.async("text");
        const doc = parser.parseFromString(text, "application/xml");
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
          errors.push(`XML/XHTML syntax error in ${filePath}: ${parserError.textContent?.slice(0, 100)}`);
        }
      } catch (err: any) {
        errors.push(`Failed to read/parse ${filePath}: ${err.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Main Standard EPUB 3 Export Function
 */
export async function exportToEpub({
  title,
  subtitle,
  author,
  language = "en",
  coverImageUrl,
  genre,
  includeTitlePage = true,
  includeCopyright = true,
  includeTocPage = true,
  includeAboutAuthor = true,
  includeAcknowledgments = false,
  includeReviewRequest = true,
  authorBio,
  manuscript,
  stripInternalMentions = true,
  matter,
}: EpubOptions): Promise<void> {
  // Pre-export Content Audit
  const audit = auditManuscriptContent(manuscript, stripInternalMentions, language);
  if (audit.compiledChapterCount === 0) {
    throw new Error("Cannot export empty book: Manuscript contains 0 chapters or scenes.");
  }

  const zip = new JSZip();

  // Author & Metadata Synchronization - Single authoritative source
  const resolvedAuthor = cleanInternalMentionsAndTags(matter?.authorPenName || author || "Author");
  const resolvedCopyrightOwner = cleanInternalMentionsAndTags(matter?.copyrightOwner || resolvedAuthor);
  const resolvedTitle = cleanInternalMentionsAndTags(title);
  const resolvedSubtitle = cleanInternalMentionsAndTags(matter?.subtitle || subtitle || "");
  
  // Publisher: User input only. Never hard-coded. Omitted if empty!
  const resolvedPublisher = cleanInternalMentionsAndTags(matter?.publisher || "");
  
  const resolvedYear = matter?.copyrightYear || new Date().getFullYear().toString();
  const resolvedEdition = matter?.edition || `First Digital Edition: ${resolvedYear}`;
  const resolvedDisclaimer =
    matter?.disclaimerText ||
    "This is a work of fiction. Names, characters, places, and incidents either are the product of the author's imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events, or locales is entirely coincidental.";

  // Acknowledgments: Strictly optional, only if explicitly enabled AND user has provided text
  const hasAcknowledgments = Boolean(
    includeAcknowledgments &&
    matter?.acknowledgmentsText &&
    matter.acknowledgmentsText.trim().length > 0
  );

  // 1. mimetype (Must be first, completely uncompressed)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml pointing to EPUB/package.opf
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. EPUB/css/book.css - Commercial EPUB 3 Typography
  const bookCss = `@namespace "http://www.w3.org/1999/xhtml";

@page {
  margin: 5%;
}

body {
  margin: 0;
  padding: 0;
  font-family: Georgia, "Palatino Linotype", "Book Antiqua", Palatino, serif;
  line-height: 1.6;
  color: #1a1a1a;
}

/* Front & Back Matter */
.frontmatter, .backmatter {
  page-break-before: always;
  break-before: page;
  text-align: center;
  padding-top: 15vh;
  padding-bottom: 5vh;
}

.book-title {
  font-size: 2.2em;
  font-weight: bold;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.2em;
  line-height: 1.2;
}

.book-subtitle {
  font-size: 1.2em;
  font-style: italic;
  color: #555555;
  margin-top: 0;
  margin-bottom: 2em;
}

.author-by {
  font-size: 0.95em;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #666666;
  margin-bottom: 0.5em;
}

.author-name {
  font-size: 1.5em;
  font-weight: normal;
  letter-spacing: 0.05em;
  margin-top: 0;
  margin-bottom: 3em;
}

.ornament {
  font-size: 1.4em;
  color: #8C503C;
  margin: 1.5em auto;
  text-align: center;
}

.publisher-mark {
  margin-top: 15vh;
  font-size: 0.85em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #777777;
}

/* Copyright Page */
.copyright-section {
  page-break-before: always;
  break-before: page;
  font-size: 0.85em;
  line-height: 1.6;
  color: #444444;
  padding-top: 25vh;
  padding-left: 5%;
  padding-right: 5%;
}

.copyright-section p {
  text-indent: 0 !important;
  margin-bottom: 1em;
}

.copyright-section .disclaimer {
  font-style: italic;
  font-size: 0.9em;
}

.copyright-meta {
  font-family: monospace;
  font-size: 0.95em;
  color: #666666;
}

/* Dedication */
.dedication-section {
  page-break-before: always;
  break-before: page;
  text-align: center;
  padding-top: 35vh;
  max-width: 80%;
  margin: auto;
}

.dedication-text {
  font-style: italic;
  font-size: 1.2em;
  line-height: 1.8;
  text-indent: 0 !important;
}

/* Table of Contents */
.toc-page {
  page-break-before: always;
  break-before: page;
  padding-top: 5vh;
}

.toc-heading {
  text-align: center;
  font-size: 1.8em;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.5em;
}

ul.inbook-toc {
  list-style-type: none;
  padding-left: 0;
  margin: 2em auto;
  max-width: 90%;
}

ul.inbook-toc li {
  margin-bottom: 0.9em;
  border-bottom: 1px dotted #DCD5C9;
  padding-bottom: 0.3em;
}

ul.inbook-toc li a {
  text-decoration: none;
  color: #2A1B14;
  font-size: 1em;
  display: block;
}

ul.inbook-toc li.toc-part {
  font-weight: bold;
  font-size: 1.1em;
  margin-top: 1.5em;
  border-bottom: 2px solid #8C503C;
  color: #8C503C;
}

/* Part Divider */
.part-divider {
  page-break-before: always;
  break-before: page;
  text-align: center;
  padding-top: 35vh;
  padding-bottom: 35vh;
}

.part-title {
  font-size: 2em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: bold;
  color: #2A1B14;
}

/* Chapter & Body Styles - Single Title Layout */
.chapter-section {
  page-break-before: always;
  break-before: page;
  padding-top: 8vh;
}

.chapter-header {
  text-align: center;
  margin-top: 1.5em;
  margin-bottom: 3.5em;
}

.chapter-number {
  font-size: 0.95em;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8C503C;
  margin-top: 0;
  margin-bottom: 0.4em;
  font-weight: bold;
  text-indent: 0 !important;
}

.chapter-title {
  text-align: center;
  font-size: 1.85em;
  font-weight: normal;
  letter-spacing: 0.04em;
  margin-top: 0.2em;
  margin-bottom: 0.6em;
  line-height: 1.25;
}

.chapter-ornament {
  font-size: 1.1em;
  color: #8C503C;
  letter-spacing: 0.3em;
  margin-top: 0.8em;
  text-align: center;
}

p {
  margin: 0;
  text-indent: 1.5em;
  text-align: justify;
  text-justify: inter-word;
}

p.first-p {
  text-indent: 0 !important;
}

.scene-break {
  text-align: center;
  margin: 2em auto;
  color: #8C503C;
  letter-spacing: 0.5em;
  font-size: 1.1em;
}

/* Cover */
.cover-wrapper {
  text-align: center;
  padding: 0;
  margin: 0;
}

img.cover-img {
  max-width: 100%;
  max-height: 100vh;
  height: auto;
  width: auto;
  margin: auto;
  display: block;
}

/* Back matter review box */
.review-box {
  margin-top: 3em;
  padding: 1.5em;
  border: 1px solid #DCD5C9;
  background-color: #FAF8F5;
  border-radius: 6px;
  text-align: left;
}

.review-box h3 {
  margin-top: 0;
  font-size: 1.1em;
  color: #8C503C;
  text-align: center;
}

.review-box p {
  text-indent: 0 !important;
  margin-bottom: 0.8em;
  font-size: 0.95em;
}

.author-newsletter {
  margin-top: 1.5em;
  padding: 1em;
  background-color: #F4EFEB;
  border-left: 3px solid #8C503C;
  text-align: left;
}
.author-newsletter p {
  text-indent: 0 !important;
  margin: 0;
  font-size: 0.95em;
}
.author-newsletter a {
  color: #8C503C;
  font-weight: bold;
  text-decoration: underline;
}
`;
  zip.file("EPUB/css/book.css", bookCss);

  // 4. Cover Image
  const coverBytes = await loadCoverBinary(coverImageUrl);
  const hasCoverImage = coverBytes !== null;
  const coverType = coverBytes ? detectImageType(coverBytes) : { ext: "jpg", mediaType: "image/jpeg" };

  if (hasCoverImage) {
    zip.file(`EPUB/images/cover.${coverType.ext}`, coverBytes);
  }

  // 5. Parse Manuscript Hierarchy
  const { flatChapters, order } = parseManuscriptStructure(
    manuscript,
    stripInternalMentions,
    language
  );

  // Review note: inside About the Author, or on its own page when that page is off
  const reviewHeadingText = cleanInternalMentionsAndTags(matter?.reviewCtaHeading || "A Sincere Note to the Reader");
  const reviewBodyText = cleanInternalMentionsAndTags(matter?.reviewCtaText || "");
  const wantsReview = includeReviewRequest !== false && (matter?.includeReviewRequest ?? true) && reviewBodyText.length > 0;
  const hasStandaloneReview = wantsReview && !includeAboutAuthor;

  const manifestItems: ManifestItem[] = [
    { id: "style", href: "css/book.css", mediaType: "text/css" },
    { id: "nav", href: "nav.xhtml", mediaType: "application/xhtml+xml", properties: "nav" },
    { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml" },
  ];

  if (hasCoverImage) {
    manifestItems.push({
      id: "cover-image",
      href: `images/cover.${coverType.ext}`,
      mediaType: coverType.mediaType,
      properties: "cover-image",
    });
  }

  const spineItemRefs: { idref: string; linear?: string }[] = [];

  // 6. Cover Page (text/cover.xhtml)
  const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
  <style type="text/css">
    @page { margin: 0; }
    body { margin: 0; padding: 0; text-align: center; background-color: #1a1a1a; }
  </style>
</head>
<body epub:type="cover">
  <div class="cover-wrapper">
    ${
      hasCoverImage
        ? `<img class="cover-img" src="../images/cover.${coverType.ext}" alt="Cover" />`
        : `<div style="padding-top: 30vh; color: #FAF8F5;">
             <h1 style="font-size: 2.5em; text-transform: uppercase;">${escapeXml(resolvedTitle)}</h1>
             <p style="font-size: 1.4em; font-style: italic;">By ${escapeXml(resolvedAuthor)}</p>
           </div>`
    }
  </div>
</body>
</html>`;
  zip.file("EPUB/text/cover.xhtml", coverXhtml);
  manifestItems.push({
    id: "cover-xhtml",
    href: "text/cover.xhtml",
    mediaType: "application/xhtml+xml",
  });
  spineItemRefs.push({ idref: "cover-xhtml" });

  // 7. Title Page (text/titlepage.xhtml)
  if (includeTitlePage) {
    const publisherBlock = resolvedPublisher
      ? `<div class="publisher-mark"><p>${escapeXml(resolvedPublisher)}</p></div>`
      : "";

    const titlePageXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${escapeXml(resolvedTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body class="frontmatter" epub:type="frontmatter titlepage">
  <section>
    <h1 class="book-title">${escapeXml(resolvedTitle)}</h1>
    ${resolvedSubtitle ? `<p class="book-subtitle">${escapeXml(resolvedSubtitle)}</p>` : ""}
    <div class="ornament">❖</div>
    <p class="author-by">A Novel by</p>
    <p class="author-name">${escapeXml(resolvedAuthor)}</p>
    ${publisherBlock}
  </section>
</body>
</html>`;
    zip.file("EPUB/text/titlepage.xhtml", titlePageXhtml);
    manifestItems.push({
      id: "titlepage",
      href: "text/titlepage.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "titlepage" });
  }

  // 8. Copyright Page (text/copyright.xhtml)
  if (includeCopyright) {
    const isbnRow = matter?.isbn ? `<p class="copyright-meta">ISBN: ${escapeXml(matter.isbn)}</p>` : "";
    const asinRow = matter?.asin ? `<p class="copyright-meta">ASIN: ${escapeXml(matter.asin)}</p>` : "";
    const publishedByRow = resolvedPublisher
      ? `<p>Published by ${escapeXml(resolvedPublisher)}</p>`
      : "";

    const copyrightXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Copyright</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body epub:type="frontmatter copyright-page">
  <section class="copyright-section">
    <p style="font-weight: bold; font-size: 1.1em;">${escapeXml(resolvedTitle)}</p>
    <p>Copyright © ${escapeXml(resolvedYear)} by ${escapeXml(resolvedCopyrightOwner)}</p>
    <p>All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the author, except in the case of brief quotations embodied in critical reviews.</p>
    <p class="disclaimer">${escapeXml(resolvedDisclaimer)}</p>
    ${isbnRow}
    ${asinRow}
    <p>${escapeXml(resolvedEdition)}</p>
    ${publishedByRow}
  </section>
</body>
</html>`;
    zip.file("EPUB/text/copyright.xhtml", copyrightXhtml);
    manifestItems.push({
      id: "copyright",
      href: "text/copyright.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "copyright" });
  }

  // 9. Optional Dedication Page (text/dedication.xhtml)
  if (matter?.dedication && matter.dedication.trim()) {
    const dedicationXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Dedication</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body class="frontmatter" epub:type="frontmatter dedication">
  <section class="dedication-section">
    ${textToParagraphsHtml(cleanInternalMentionsAndTags(matter.dedication), ' class="dedication-text"')}
    <div class="ornament">❖</div>
  </section>
</body>
</html>`;
    zip.file("EPUB/text/dedication.xhtml", dedicationXhtml);
    manifestItems.push({
      id: "dedication",
      href: "text/dedication.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "dedication" });
  }

  // 10. In-book HTML Table of Contents (text/toc.xhtml)
  // Shows only Part/Chapter and selected Back Matter. Scenes are strictly excluded!
  if (includeTocPage) {
    let tocListItemsHtml = "";
    for (const sec of order) {
      if (sec.kind === "part") {
        tocListItemsHtml += `<li class="toc-part"><a href="${sec.part.filename}">${escapeXml(sec.part.title)}</a></li>\n`;
      } else {
        tocListItemsHtml += `<li><a href="${sec.chapter.filename}">${escapeXml(sec.chapter.fullTitle)}</a></li>\n`;
      }
    }

    if (hasAcknowledgments) {
      tocListItemsHtml += `<li><a href="acknowledgments.xhtml">Acknowledgments</a></li>\n`;
    }

    if (includeAboutAuthor) {
      tocListItemsHtml += `<li><a href="about_author.xhtml">About the Author</a></li>\n`;
    }
    if (hasStandaloneReview) {
      tocListItemsHtml += `<li><a href="note_to_reader.xhtml">${escapeXml(reviewHeadingText)}</a></li>\n`;
    }

    const tocPageXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body epub:type="frontmatter toc">
  <section class="toc-page">
    <h1 class="toc-heading">Table of Contents</h1>
    <div class="ornament">❖</div>
    <ul class="inbook-toc">
      ${tocListItemsHtml}
    </ul>
  </section>
</body>
</html>`;
    zip.file("EPUB/text/toc.xhtml", tocPageXhtml);
    manifestItems.push({
      id: "toc-page",
      href: "text/toc.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "toc-page" });
  }

  // 11. Body Matter: parts and chapters in manuscript order
  for (const sec of order) {
    if (sec.kind === "part") {
      const part = sec.part;
      const partXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${escapeXml(part.title)}</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body epub:type="part">
  <section class="part-divider">
    <h1 class="part-title">${escapeXml(part.title)}</h1>
    <div class="ornament">❖</div>
  </section>
</body>
</html>`;
      zip.file(`EPUB/text/${part.filename}`, partXhtml);
      manifestItems.push({ id: part.id, href: `text/${part.filename}`, mediaType: "application/xhtml+xml" });
      spineItemRefs.push({ idref: part.id });
    } else {
      const chap = sec.chapter;
      writeChapterFile(zip, chap, language);
      manifestItems.push({ id: chap.id, href: `text/${chap.filename}`, mediaType: "application/xhtml+xml" });
      spineItemRefs.push({ idref: chap.id });
    }
  }

  // 12. Acknowledgments (text/acknowledgments.xhtml - Strictly Optional)
  if (hasAcknowledgments) {
    const ackBody = cleanInternalMentionsAndTags(matter?.acknowledgmentsText || "");

    const ackXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Acknowledgments</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body class="backmatter" epub:type="backmatter acknowledgments">
  <section>
    <h1 class="toc-heading">Acknowledgments</h1>
    <div class="ornament">❖</div>
    <div style="max-width: 80%; margin: auto; line-height: 1.8; text-align: left;">
    ${textToParagraphsHtml(ackBody, ' style="text-indent: 0; margin-bottom: 0.8em;"')}
    </div>
  </section>
</body>
</html>`;
    zip.file("EPUB/text/acknowledgments.xhtml", ackXhtml);
    manifestItems.push({
      id: "acknowledgments",
      href: "text/acknowledgments.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "acknowledgments" });
  }

  // 13. About the Author & Review Request (text/about_author.xhtml - Back Matter)
  // Bio only from user input. Never auto-generate fake bio!
  if (includeAboutAuthor) {
    const bioText = cleanInternalMentionsAndTags(matter?.authorBioText || authorBio || "");


    const newsletterHtml = matter?.authorWebsiteOrNewsletter
      ? `<div class="author-newsletter">
           <p><strong>Connect with the Author:</strong></p>
           <p><a href="${escapeXml(matter.authorWebsiteOrNewsletter)}">${escapeXml(matter.authorWebsiteOrNewsletter)}</a></p>
         </div>`
      : "";

    const reviewBoxHtml = wantsReview
      ? `<div class="review-box">
           <h3>${escapeXml(reviewHeadingText)}</h3>
           ${textToParagraphsHtml(reviewBodyText)}
         </div>`
      : "";

    const aboutXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>About the Author</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body class="backmatter" epub:type="backmatter biographical-note">
  <section style="max-width: 85%; margin: auto;">
    <h1 class="toc-heading">About the Author</h1>
    <div class="ornament">❖</div>
    <p style="font-size: 1.3em; font-weight: bold; margin-bottom: 1em; text-indent: 0;">
      ${escapeXml(resolvedAuthor)}
    </p>
    ${bioText ? textToParagraphsHtml(bioText, ' style="text-indent: 0; line-height: 1.8; margin-bottom: 1em;"') : ""}

    ${newsletterHtml}
    ${reviewBoxHtml}
  </section>
</body>
</html>`;
    zip.file("EPUB/text/about_author.xhtml", aboutXhtml);
    manifestItems.push({
      id: "about-author",
      href: "text/about_author.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "about-author" });
  }

  if (hasStandaloneReview) {
    const noteXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${escapeXml(reviewHeadingText)}</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body class="backmatter" epub:type="backmatter">
  <section style="max-width: 85%; margin: auto;">
    <div class="review-box">
      <h3>${escapeXml(reviewHeadingText)}</h3>
      ${textToParagraphsHtml(reviewBodyText)}
    </div>
  </section>
</body>
</html>`;
    zip.file("EPUB/text/note_to_reader.xhtml", noteXhtml);
    manifestItems.push({ id: "note-to-reader", href: "text/note_to_reader.xhtml", mediaType: "application/xhtml+xml" });
    spineItemRefs.push({ idref: "note-to-reader" });
  }

  // 14. EPUB 3 Navigation Document (EPUB/nav.xhtml)
  const firstChapterFilename =
    flatChapters.length > 0 ? `text/${flatChapters[0].filename}` : "text/cover.xhtml";

  let navOlHtml = "";
  for (const sec of order) {
    if (sec.kind === "part") {
      const chapters = sec.part.chapters;
      navOlHtml += `    <li><a href="text/${sec.part.filename}">${escapeXml(sec.part.title)}</a>`;
      if (chapters.length) {
        navOlHtml += `\n      <ol>\n`;
        for (const chap of chapters) {
          navOlHtml += `        <li><a href="text/${chap.filename}">${escapeXml(chap.fullTitle)}</a></li>\n`;
        }
        navOlHtml += `      </ol>\n    `;
      }
      navOlHtml += `</li>\n`;
    } else if (!sec.inPart) {
      navOlHtml += `    <li><a href="text/${sec.chapter.filename}">${escapeXml(sec.chapter.fullTitle)}</a></li>\n`;
    }
  }

  if (hasAcknowledgments) {
    navOlHtml += `    <li><a href="text/acknowledgments.xhtml">Acknowledgments</a></li>\n`;
  }

  if (includeAboutAuthor) {
    navOlHtml += `    <li><a href="text/about_author.xhtml">About the Author</a></li>\n`;
  }
  if (hasStandaloneReview) {
    navOlHtml += `    <li><a href="text/note_to_reader.xhtml">${escapeXml(reviewHeadingText)}</a></li>\n`;
  }

  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Navigation</title>
  <link rel="stylesheet" type="text/css" href="css/book.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navOlHtml}
    </ol>
  </nav>

  <nav epub:type="landmarks" id="landmarks" hidden="">
    <h2>Guide</h2>
    <ol>
      <li><a epub:type="cover" href="text/cover.xhtml">Cover</a></li>
${includeTitlePage ? '      <li><a epub:type="titlepage" href="text/titlepage.xhtml">Title Page</a></li>\n' : ""}${includeTocPage ? '      <li><a epub:type="toc" href="text/toc.xhtml">Table of Contents</a></li>' : ""}
      <li><a epub:type="bodymatter" href="${firstChapterFilename}">Begin Reading</a></li>
    </ol>
  </nav>
</body>
</html>`;
  zip.file("EPUB/nav.xhtml", navXhtml);

  // 15. Standard NCX Table of Contents (EPUB/toc.ncx)
  let ncxPlayOrder = 1;
  let navPointsHtml = "";

  for (const sec of order) {
    if (sec.kind === "part") {
      const part = sec.part;
      navPointsHtml += `
    <navPoint id="np_${part.id}" playOrder="${ncxPlayOrder++}">
      <navLabel><text>${escapeXml(part.title)}</text></navLabel>
      <content src="text/${part.filename}"/>`;
      for (const chap of part.chapters) {
        navPointsHtml += `
      <navPoint id="np_${chap.id}" playOrder="${ncxPlayOrder++}">
        <navLabel><text>${escapeXml(chap.fullTitle)}</text></navLabel>
        <content src="text/${chap.filename}"/>
      </navPoint>`;
      }
      navPointsHtml += `
    </navPoint>`;
    } else if (!sec.inPart) {
      const chap = sec.chapter;
      navPointsHtml += `
    <navPoint id="np_${chap.id}" playOrder="${ncxPlayOrder++}">
      <navLabel><text>${escapeXml(chap.fullTitle)}</text></navLabel>
      <content src="text/${chap.filename}"/>
    </navPoint>`;
    }
  }

  if (hasAcknowledgments) {
    navPointsHtml += `
    <navPoint id="np_ack" playOrder="${ncxPlayOrder++}">
      <navLabel><text>Acknowledgments</text></navLabel>
      <content src="text/acknowledgments.xhtml"/>
    </navPoint>`;
  }

  if (hasStandaloneReview) {
    navPointsHtml += `
    <navPoint id="np_note" playOrder="${ncxPlayOrder++}">
      <navLabel><text>${escapeXml(reviewHeadingText)}</text></navLabel>
      <content src="text/note_to_reader.xhtml"/>
    </navPoint>`;
  }
  if (includeAboutAuthor) {
    navPointsHtml += `
    <navPoint id="np_about" playOrder="${ncxPlayOrder++}">
      <navLabel><text>About the Author</text></navLabel>
      <content src="text/about_author.xhtml"/>
    </navPoint>`;
  }

  // Standard RFC 4122 UUID
  const bookUuid = matter?.isbn?.trim()
    ? `urn:isbn:${matter.isbn.trim().replace(/[^0-9X-]/gi, "")}`
    : generateEpubUuid();

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookUuid}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(resolvedTitle)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeXml(resolvedAuthor)}</text>
  </docAuthor>
  <navMap>
${navPointsHtml}
  </navMap>
</ncx>`;
  zip.file("EPUB/toc.ncx", tocNcx);

  // 16. Master Package Document (EPUB/package.opf)
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const manifestXml = manifestItems
    .map(
      (item) =>
        `    <item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"${
          item.properties ? ` properties="${item.properties}"` : ""
        }/>`
    )
    .join("\n");

  const spineXml = spineItemRefs
    .map((item) => `    <itemref idref="${item.idref}"${item.linear ? ` linear="${item.linear}"` : ""}/>`)
    .join("\n");

  const publisherTag = resolvedPublisher
    ? `    <dc:publisher>${escapeXml(resolvedPublisher)}</dc:publisher>`
    : "";

  const packageOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">${bookUuid}</dc:identifier>
    <dc:title>${escapeXml(resolvedTitle)}</dc:title>
    <dc:creator id="creator">${escapeXml(resolvedAuthor)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <dc:language>${escapeXml(language)}</dc:language>
${publisherTag}
    ${genre ? `<dc:subject>${escapeXml(genre)}</dc:subject>` : ""}
    <meta property="dcterms:modified">${nowIso}</meta>
    ${hasCoverImage ? '<meta name="cover" content="cover-image"/>' : ""}
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine toc="ncx">
${spineXml}
  </spine>
</package>`;
  zip.file("EPUB/package.opf", packageOpf);

  // 17. PRE-FLIGHT VALIDATION: Verify XHTML syntax, Manifest & Spine integrity before creating zip
  const validation = await validateEpubArchive(zip, manifestItems, spineItemRefs);
  if (!validation.valid) {
    console.error("EPUB validation failed with errors:", validation.errors);
    throw new Error(
      `EPUB 3 Pre-flight Validation Failed (${validation.errors.length} errors):\n${validation.errors.slice(0, 3).join("\n")}`
    );
  }

  // 18. Generate Final Binary EPUB Blob & Trigger Browser Download
  const epubBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  saveAs(epubBlob, safeFilename(resolvedTitle, "epub"));
}

/**
 * Generates and writes clean chapter XHTML file
 * Formats exactly ONE chapter header
 */
function writeChapterFile(zip: JSZip, chap: ParsedChapter, language: string) {
  let contentHtml = "";

  if (chap.scenes && chap.scenes.length > 0) {
    let afterBreak = true;
    chap.scenes.forEach((scene, sIdx) => {
      if (sIdx > 0) {
        contentHtml += `\n    <div class="scene-break">❖ ❖ ❖</div>\n`;
        afterBreak = true;
      }
      scene.blocks.forEach((block) => {
        if (block.type === "break") {
          contentHtml += `\n    <div class="scene-break">❖ ❖ ❖</div>\n`;
          afterBreak = true;
          return;
        }
        contentHtml += `    <p${afterBreak ? ' class="first-p"' : ""}>${runsToXhtml(block.runs)}</p>\n`;
        afterBreak = false;
      });
    });
  }

  const numberHtml = chap.numberText
    ? `<p class="chapter-number">${escapeXml(chap.numberText)}</p>`
    : "";
  const titleHtml = chap.titleText
    ? `<h2 class="chapter-title">${escapeXml(chap.titleText)}</h2>`
    : !chap.numberText
    ? `<h2 class="chapter-title">${escapeXml(chap.title)}</h2>`
    : "";

  const chapterXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${escapeXml(chap.fullTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../css/book.css"/>
</head>
<body>
  <section class="chapter-section" epub:type="chapter">
    <header class="chapter-header">
      ${numberHtml}
      ${titleHtml}
      <div class="chapter-ornament">❖</div>
    </header>
${contentHtml}
  </section>
</body>
</html>`;

  zip.file(`EPUB/text/${chap.filename}`, chapterXhtml);
}

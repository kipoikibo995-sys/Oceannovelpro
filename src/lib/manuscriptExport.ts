import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } from "docx";
import { saveAs } from "file-saver";
import { ManuscriptItem } from "@/mockData";
import { FrontBackMatterData } from "@/lib/storage";
import {
  parseManuscriptStructure,
  cleanInternalMentionsAndTags,
  blockText,
  safeFilename,
  ParsedChapter,
} from "@/lib/epubExport";

// Word and plain-text export share the EPUB's book structure, so all three
// formats contain the same parts, chapters, scene breaks and back matter.

export interface ManuscriptExportOptions {
  title: string;
  author: string;
  manuscript: ManuscriptItem[];
  matter: FrontBackMatterData;
  stripInternalMentions: boolean;
  includeTitlePage: boolean;
  includeCopyright: boolean;
  includeAboutAuthor: boolean;
  includeAcknowledgments: boolean;
  includeReviewRequest: boolean;
}

const SCENE_BREAK = "* * *";

function resolveMatter(o: ManuscriptExportOptions) {
  const m = o.matter;
  const year = m.copyrightYear || new Date().getFullYear().toString();
  const clean = (t?: string) => cleanInternalMentionsAndTags(t || "");
  return {
    title: clean(o.title) || "Untitled Manuscript",
    subtitle: clean(m.subtitle),
    author: clean(m.authorPenName || o.author) || "Author",
    owner: clean(m.copyrightOwner || m.authorPenName || o.author) || "Author",
    publisher: clean(m.publisher),
    year,
    edition: m.edition || `First Digital Edition: ${year}`,
    disclaimer: m.disclaimerText || "",
    isbn: (m.isbn || "").trim(),
    asin: (m.asin || "").trim(),
    dedication: clean(m.dedication),
    acknowledgments: o.includeAcknowledgments ? clean(m.acknowledgmentsText) : "",
    bio: clean(m.authorBioText),
    website: (m.authorWebsiteOrNewsletter || "").trim(),
    review:
      o.includeReviewRequest && (m.includeReviewRequest ?? true) && clean(m.reviewCtaText)
        ? { heading: clean(m.reviewCtaHeading) || "A Sincere Note to the Reader", body: clean(m.reviewCtaText) }
        : null,
  };
}

const lines = (text: string) => text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

export function exportToTxt(o: ManuscriptExportOptions) {
  const m = resolveMatter(o);
  const { order } = parseManuscriptStructure(o.manuscript, o.stripInternalMentions);
  const out: string[] = [];
  const rule = "=========================================";

  if (o.includeTitlePage) {
    out.push(m.title.toUpperCase());
    if (m.subtitle) out.push(m.subtitle);
    out.push("", `By ${m.author}`);
    if (m.publisher) out.push("", m.publisher);
    out.push("", rule, "");
  }

  if (o.includeCopyright) {
    out.push(`Copyright © ${m.year} by ${m.owner}`, "All rights reserved.");
    if (m.disclaimer) out.push("", m.disclaimer);
    if (m.isbn) out.push("", `ISBN: ${m.isbn}`);
    if (m.asin) out.push(`ASIN: ${m.asin}`);
    out.push("", m.edition);
    if (m.publisher) out.push(`Published by ${m.publisher}`);
    out.push("", rule, "");
  }

  if (m.dedication) out.push(...lines(m.dedication), "", rule, "");

  const writeChapter = (chap: ParsedChapter) => {
    out.push("", chap.fullTitle.toUpperCase(), "");
    chap.scenes.forEach((scene, sIdx) => {
      if (sIdx > 0) out.push(SCENE_BREAK, "");
      scene.blocks.forEach((b) => out.push(b.type === "break" ? SCENE_BREAK : blockText(b), ""));
    });
  };
  for (const sec of order) {
    if (sec.kind === "part") out.push("", rule, sec.part.title.toUpperCase(), rule, "");
    else writeChapter(sec.chapter);
  }

  if (m.acknowledgments) out.push("", rule, "", "ACKNOWLEDGMENTS", "", ...lines(m.acknowledgments).flatMap((l) => [l, ""]));

  if (o.includeAboutAuthor) {
    out.push("", rule, "", "ABOUT THE AUTHOR", "", m.author, "");
    if (m.bio) out.push(...lines(m.bio).flatMap((l) => [l, ""]));
    if (m.website) out.push(m.website, "");
  }
  if (m.review) out.push("", m.review.heading, "", ...lines(m.review.body).flatMap((l) => [l, ""]));

  const content = out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
  saveAs(new Blob([content], { type: "text/plain;charset=utf-8" }), safeFilename(m.title, "txt"));
}

/* ------------------------------------------------------------------ */
/* Word                                                                */
/* ------------------------------------------------------------------ */

export async function exportToDocx(o: ManuscriptExportOptions) {
  const m = resolveMatter(o);
  const { order } = parseManuscriptStructure(o.manuscript, o.stripInternalMentions);
  const children: Paragraph[] = [];

  // Each new page starts with pageBreakBefore instead of empty break paragraphs
  let startNewPage = false;
  const page = () => {
    const v = startNewPage;
    startNewPage = true;
    return v;
  };
  const centered = (text: string, opts: { size?: number; bold?: boolean; italics?: boolean; before?: number; after?: number; color?: string; newPage?: boolean } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: opts.newPage,
      spacing: { before: opts.before, after: opts.after ?? 200 },
      children: [new TextRun({ text, size: opts.size, bold: opts.bold, italics: opts.italics, color: opts.color })],
    });
  const plain = (text: string, opts: { italics?: boolean; size?: number; after?: number } = {}) =>
    new Paragraph({ spacing: { after: opts.after ?? 160 }, children: [new TextRun({ text, italics: opts.italics, size: opts.size })] });

  if (o.includeTitlePage) {
    children.push(centered(m.title.toUpperCase(), { size: 48, bold: true, before: 3600, after: m.subtitle ? 200 : 600, newPage: page() }));
    if (m.subtitle) children.push(centered(m.subtitle, { size: 28, italics: true, after: 600 }));
    children.push(centered(`By ${m.author}`, { size: 28 }));
    if (m.publisher) children.push(centered(m.publisher, { size: 20, color: "666666", before: 1200 }));
  }

  if (o.includeCopyright) {
    children.push(
      new Paragraph({ pageBreakBefore: page(), spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: m.title, bold: true })] })
    );
    children.push(plain(`Copyright © ${m.year} by ${m.owner}`));
    children.push(plain("All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form without the prior written permission of the author, except for brief quotations in reviews.", { size: 20 }));
    if (m.disclaimer) children.push(plain(m.disclaimer, { italics: true, size: 20 }));
    if (m.isbn) children.push(plain(`ISBN: ${m.isbn}`, { size: 20, after: 60 }));
    if (m.asin) children.push(plain(`ASIN: ${m.asin}`, { size: 20, after: 60 }));
    children.push(plain(m.edition, { size: 20 }));
    if (m.publisher) children.push(plain(`Published by ${m.publisher}`, { size: 20 }));
  }

  if (m.dedication) {
    lines(m.dedication).forEach((l, i) =>
      children.push(centered(l, { italics: true, size: 26, before: i === 0 ? 3600 : 0, newPage: i === 0 ? page() : undefined }))
    );
  }

  const writeChapter = (chap: ParsedChapter) => {
    const newPage = page();
    if (chap.numberText && chap.titleText) {
      children.push(centered(chap.numberText, { size: 22, bold: true, color: "666666", before: 1600, after: 120, newPage }));
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: chap.titleText })] }));
    } else {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          pageBreakBefore: newPage,
          spacing: { before: 1600, after: 600 },
          children: [new TextRun({ text: chap.numberText || chap.titleText || chap.fullTitle })],
        })
      );
    }
    let afterBreak = true;
    const sceneBreak = () => {
      children.push(centered(SCENE_BREAK, { before: 240, after: 240 }));
      afterBreak = true;
    };
    chap.scenes.forEach((scene, sIdx) => {
      if (sIdx > 0) sceneBreak();
      scene.blocks.forEach((b) => {
        if (b.type === "break") return sceneBreak();
        children.push(
          new Paragraph({
            indent: afterBreak ? undefined : { firstLine: 360 },
            spacing: { after: 120 },
            children: b.runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic })),
          })
        );
        afterBreak = false;
      });
    });
  };

  for (const sec of order) {
    if (sec.kind === "part") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          pageBreakBefore: page(),
          spacing: { before: 4000 },
          children: [new TextRun({ text: sec.part.title })],
        })
      );
    } else {
      writeChapter(sec.chapter);
    }
  }

  if (m.acknowledgments) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, pageBreakBefore: page(), spacing: { before: 1600, after: 400 }, children: [new TextRun({ text: "Acknowledgments" })] }));
    lines(m.acknowledgments).forEach((l) => children.push(plain(l)));
  }

  if (o.includeAboutAuthor) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, pageBreakBefore: page(), spacing: { before: 1600, after: 400 }, children: [new TextRun({ text: "About the Author" })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: m.author, bold: true, size: 28 })] }));
    lines(m.bio).forEach((l) => children.push(plain(l)));
    if (m.website) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 200 },
          children: [new ExternalHyperlink({ link: /^https?:\/\//i.test(m.website) ? m.website : `https://${m.website}`, children: [new TextRun({ text: m.website, style: "Hyperlink" })] })],
        })
      );
    }
  }

  if (m.review) {
    children.push(new Paragraph({ pageBreakBefore: o.includeAboutAuthor ? undefined : page(), spacing: { before: 400, after: 160 }, children: [new TextRun({ text: m.review.heading, bold: true })] }));
    lines(m.review.body).forEach((l) => children.push(plain(l, { italics: true })));
  }

  const doc = new Document({
    creator: m.author,
    title: m.title,
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 24 }, paragraph: { spacing: { line: 360 } } },
        heading1: { run: { font: "Georgia", size: 36, bold: true, color: "1A1A1A" } },
        title: { run: { font: "Georgia", size: 44, bold: true, color: "1A1A1A" } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, safeFilename(m.title, "docx"));
}

/**
 * Firestore caps a document at 1 MiB, which a long book outgrows on text alone. A book over the
 * cap is saved as its JSON text cut into parts, each its own document under
 * users/{uid}/projectData/{id}/parts, and the book document keeps only a pointer to them.
 */
export const MAX_PART_BYTES = 900_000;

export interface BookPartsRef {
  /** Names the set of parts written together (the save time), so a reader never mixes two saves */
  set: number;
  count: number;
}

export const partDocId = (set: number, index: number) => `${set}_${index}`;

/** Cuts text into pieces of at most maxBytes each (as UTF-8), never through the middle of a character. */
export function splitText(text: string, maxBytes = MAX_PART_BYTES): string[] {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let n = Math.min(text.length - pos, maxBytes);
    for (;;) {
      // A piece must not end on the first half of a surrogate pair
      const last = text.charCodeAt(pos + n - 1);
      if (n > 1 && last >= 0xd800 && last <= 0xdbff) n--;
      const bytes = encoder.encode(text.slice(pos, pos + n)).length;
      if (bytes <= maxBytes || n <= 1) break;
      n = Math.max(1, Math.floor((n * maxBytes * 0.98) / bytes));
    }
    parts.push(text.slice(pos, pos + n));
    pos += n;
  }
  return parts;
}

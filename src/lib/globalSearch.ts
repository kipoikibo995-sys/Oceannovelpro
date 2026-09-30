import { ManuscriptItem } from "@/mockData";
import { ProjectData, storage } from "./storage";

export interface SearchResultItem {
  id: string;
  sourceType: 'manuscript' | 'character' | 'location' | 'note' | 'bible';
  sourceTitle: string;
  sourceSubtitle?: string;
  targetId: string; // sceneId, characterId, locationId, or field name
  field: string;
  sectionLabel?: string;
  paragraphNumber?: number;
  lineNumber?: number;
  snippetBefore: string;
  matchText: string;
  snippetAfter: string;
  fullSnippet: string;
  originalText: string;
  matchIndex: number;
  /** 0-based order of this match within its field — used to replace only the selected occurrences */
  occurrence: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  sourceTypes?: Array<'manuscript' | 'character' | 'location' | 'note' | 'bible'>;
}

export interface ReplaceItemRequest {
  result: SearchResultItem;
  replacement: string;
}

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the search pattern. "Whole word" uses Unicode letter boundaries so accented
// words (e.g. "Lê", "Đông") work — plain \b only understands ASCII letters.
function buildPattern(query: string, options: SearchOptions): { source: string; flags: string } {
  const escaped = escapeRegExp(query.trim());
  const source = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  return { source, flags: options.caseSensitive ? "gu" : "giu" };
}

// Strip HTML tags safely to get plain text while retaining spacing
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches across all data in a project:
 * - Manuscript scenes (both content and title)
 * - Characters (name, role, description, motivation, traits)
 * - Locations (name, type, description)
 * - Scene Notes
 * - Story Bible
 */
export function searchProject(
  projectData: ProjectData,
  query: string,
  options: SearchOptions = {}
): SearchResultItem[] {
  if (!query || !query.trim()) return [];

  const results: SearchResultItem[] = [];
  const { source: regexPattern, flags } = buildPattern(query, options);
  try {
    new RegExp(regexPattern, flags);
  } catch (e) {
    return [];
  }

  const enabledSources = new Set(
    options.sourceTypes || ['manuscript', 'character', 'location', 'note', 'bible']
  );

  const findMatchesInText = (
    text: string,
    sourceType: SearchResultItem['sourceType'],
    sourceTitle: string,
    sourceSubtitle: string | undefined,
    targetId: string,
    field: string
  ) => {
    if (!text) return;
    const plainText = stripHtml(text);
    let match: RegExpExecArray | null;
    const localRegex = new RegExp(regexPattern, flags);
    let occurrence = 0;

    while ((match = localRegex.exec(plainText)) !== null) {
      const matchIndex = match.index;
      const matchLength = match[0].length;
      
      const start = Math.max(0, matchIndex - 45);
      const end = Math.min(plainText.length, matchIndex + matchLength + 45);

      const before = plainText.substring(start, matchIndex);
      const matched = plainText.substring(matchIndex, matchIndex + matchLength);
      const after = plainText.substring(matchIndex + matchLength, end);

      const prefix = start > 0 ? "…" : "";
      const suffix = end < plainText.length ? "…" : "";

      // Determine human-readable section label and approximate line/paragraph
      let sectionLabel = "Content";
      if (sourceType === 'manuscript') {
        sectionLabel = field === 'title' ? "Chapter Title" : "Manuscript Body";
      } else if (sourceType === 'note') {
        sectionLabel = "Scene Notes";
      } else if (sourceType === 'character') {
        sectionLabel = `Character Profile • ${field}`;
      } else if (sourceType === 'location') {
        sectionLabel = `World Location • ${field}`;
      } else if (sourceType === 'bible') {
        sectionLabel = `Story Bible • ${field}`;
      }

      // Calculate approximate paragraph & line number
      let paragraphNumber: number | undefined;
      let lineNumber: number | undefined;

      if (field === 'content' || field === 'notes' || text.includes('<p>') || text.includes('\n')) {
        const plainBefore = plainText.substring(0, matchIndex);
        const lines = plainBefore.split(/\n+/);
        lineNumber = Math.max(1, lines.length > 1 ? lines.length : Math.ceil(plainBefore.length / 75));

        if (text.includes('<p>') || text.includes('</p>')) {
          const parts = text.split(/<\/p>/i);
          let accumulatedLen = 0;
          let pIdx = 1;
          for (let i = 0; i < parts.length; i++) {
            const strippedPart = stripHtml(parts[i]);
            if (accumulatedLen + strippedPart.length >= matchIndex) {
              pIdx = i + 1;
              break;
            }
            accumulatedLen += strippedPart.length + 1;
          }
          paragraphNumber = pIdx;
        } else {
          paragraphNumber = lines.length;
        }
      } else if (field === 'title') {
        paragraphNumber = 1;
        lineNumber = 1;
      }

      results.push({
        id: `${sourceType}-${targetId}-${field}-${matchIndex}`,
        sourceType,
        sourceTitle,
        sourceSubtitle,
        targetId,
        field,
        sectionLabel,
        paragraphNumber,
        lineNumber,
        snippetBefore: prefix + before,
        matchText: matched,
        snippetAfter: after + suffix,
        fullSnippet: `${prefix}${before}${matched}${after}${suffix}`,
        originalText: plainText,
        matchIndex,
        occurrence: occurrence++,
      });

      // Avoid infinite loop if zero-width match
      if (match.index === localRegex.lastIndex) {
        localRegex.lastIndex++;
      }
    }
  };

  // 1. Search Manuscript
  if (enabledSources.has('manuscript') && projectData.manuscript) {
    const traverseManuscript = (items: ManuscriptItem[], path: string[] = []) => {
      for (const item of items) {
        const currentPath = [...path, item.title];
        if (item.type === 'scene') {
          const parentPath = path.join(" › ");
          if (item.title) {
            findMatchesInText(
              item.title,
              'manuscript',
              item.title,
              parentPath || 'Scene Title',
              item.id,
              'title'
            );
          }
          if (item.content) {
            findMatchesInText(
              item.content,
              'manuscript',
              item.title,
              parentPath || 'Scene Content',
              item.id,
              'content'
            );
          }
        }
        if (item.children && item.children.length > 0) {
          traverseManuscript(item.children, currentPath);
        }
      }
    };
    traverseManuscript(projectData.manuscript);
  }

  // 2. Search Characters
  if (enabledSources.has('character') && projectData.characters) {
    for (const char of projectData.characters) {
      if (char.name) {
        findMatchesInText(char.name, 'character', char.name, 'Name & Identity', String(char.id), 'name');
      }
      if (char.role) {
        findMatchesInText(char.role, 'character', char.name, 'Role', String(char.id), 'role');
      }
      if (char.description) {
        findMatchesInText(char.description, 'character', char.name, 'Description', String(char.id), 'description');
      }
      if (char.motivation) {
        findMatchesInText(char.motivation, 'character', char.name, 'Motivation', String(char.id), 'motivation');
      }
      if (char.backstory) {
        findMatchesInText(char.backstory, 'character', char.name, 'Backstory', String(char.id), 'backstory');
      }
      if (Array.isArray(char.traits)) {
        findMatchesInText(char.traits.join(", "), 'character', char.name, 'Traits', String(char.id), 'traits');
      }
    }
  }

  // 3. Search Locations
  if (enabledSources.has('location') && projectData.locations) {
    for (const loc of projectData.locations) {
      if (loc.name) {
        findMatchesInText(loc.name, 'location', loc.name, 'Location Name', String(loc.id), 'name');
      }
      if (loc.type) {
        findMatchesInText(loc.type, 'location', loc.name, 'Location Type', String(loc.id), 'type');
      }
      if (loc.description) {
        findMatchesInText(loc.description, 'location', loc.name, 'Description', String(loc.id), 'description');
      }
      if (loc.history) {
        findMatchesInText(loc.history, 'location', loc.name, 'History & Lore', String(loc.id), 'history');
      }
    }
  }

  // 4. Search Notes
  if (enabledSources.has('note') && projectData.notes) {
    for (const [sceneId, noteContent] of Object.entries(projectData.notes)) {
      if (noteContent) {
        // Look up scene title if possible
        let sceneTitle = `Scene #${sceneId}`;
        const findScene = (items: ManuscriptItem[]): string | null => {
          for (const it of items) {
            if (it.id === sceneId) return it.title;
            if (it.children) {
              const res = findScene(it.children);
              if (res) return res;
            }
          }
          return null;
        };
        if (projectData.manuscript) {
          const foundTitle = findScene(projectData.manuscript);
          if (foundTitle) sceneTitle = foundTitle;
        }

        findMatchesInText(noteContent, 'note', `Notes: ${sceneTitle}`, 'Scene Notes', sceneId, 'note');
      }
    }
  }

  // 5. Search Story Bible
  if (enabledSources.has('bible') && projectData.storyBible) {
    const bible = projectData.storyBible;
    const bibleFields: Array<{ key: keyof typeof bible; label: string }> = [
      { key: 'premise', label: 'Story Premise' },
      { key: 'worldDescription', label: 'World Description' },
      { key: 'importantRules', label: 'World Rules & Magic' },
      { key: 'mainConflict', label: 'Core Conflict' },
      { key: 'themes', label: 'Themes' },
      { key: 'primarySetting', label: 'Primary Setting' },
      { key: 'narrativeStyle', label: 'Narrative Style' },
      { key: 'dialogueStyle', label: 'Dialogue Style' },
      { key: 'tone', label: 'Tone' },
    ];

    for (const item of bibleFields) {
      const val = bible[item.key];
      if (typeof val === 'string' && val.trim()) {
        findMatchesInText(val, 'bible', `Story Bible: ${item.label}`, item.label, item.key, item.key);
      }
    }
  }

  return results;
}

/**
 * Replaces exactly the selected occurrences across the project.
 * Each field is scanned in the same order as searchProject, so a match is
 * replaced only if its occurrence number was selected. Mentions keep their
 * data-label in sync with the visible name.
 * Returns the previous data so the caller can offer an undo.
 */
export function executeBatchReplace(
  projectId: string,
  searchQuery: string,
  replacementText: string,
  selectedResults: SearchResultItem[],
  options: SearchOptions = {}
): { updatedCount: number; projectData: ProjectData; previousData: ProjectData } {
  const currentData = storage.getProjectData(projectId);
  if (!currentData) {
    throw new Error("Project data not found");
  }

  const { source, flags } = buildPattern(searchQuery, options);
  let updatedCount = 0;

  // "sourceType|targetId|field" -> set of selected occurrence numbers
  const selected = new Map<string, Set<number>>();
  for (const r of selectedResults) {
    const key = `${r.sourceType}|${r.targetId}|${r.field}`;
    if (!selected.has(key)) selected.set(key, new Set());
    selected.get(key)!.add(r.occurrence);
  }
  const pick = (sourceType: string, targetId: string, field: string) => selected.get(`${sourceType}|${targetId}|${field}`);

  const previousData: ProjectData = JSON.parse(JSON.stringify(currentData));
  const data: ProjectData = JSON.parse(JSON.stringify(currentData));

  // Plain text: replace only chosen occurrences
  const replacePlain = (text: string, chosen: Set<number>): string => {
    let k = 0;
    return text.replace(new RegExp(source, flags), (m) => {
      const hit = chosen.has(k++);
      if (hit) updatedCount++;
      return hit ? replacementText : m;
    });
  };

  // HTML: walk text nodes in document order (the order search sees them),
  // never touching markup; keep mention labels in sync with their text.
  const replaceHtml = (html: string, chosen: Set<number>): string => {
    let k = 0;
    const parts = html.split(/(<[^>]*>)/g);
    let mentionOpenIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("<")) {
        if (/data-type="mention"/i.test(part)) mentionOpenIdx = i;
        else if (/^<\/span/i.test(part)) mentionOpenIdx = -1;
        continue;
      }
      if (!part) continue;
      const replaced = part.replace(new RegExp(source, flags), (m) => {
        const hit = chosen.has(k++);
        if (hit) updatedCount++;
        return hit ? replacementText : m;
      });
      if (replaced !== part) {
        parts[i] = replaced;
        if (mentionOpenIdx >= 0) {
          const label = replaced.replace(/^@/, "").replace(/"/g, "&quot;");
          parts[mentionOpenIdx] = parts[mentionOpenIdx].replace(/data-label="[^"]*"/i, `data-label="${label}"`);
        }
      }
    }
    return parts.join("");
  };

  // 1. Manuscript
  if (data.manuscript) {
    const walk = (items: ManuscriptItem[]) => {
      for (const item of items) {
        if (item.type === "scene") {
          const t1 = pick("manuscript", item.id, "title");
          if (t1 && item.title) item.title = replacePlain(item.title, t1);
          const c1 = pick("manuscript", item.id, "content");
          if (c1 && item.content) item.content = replaceHtml(item.content, c1);
        }
        if (item.children) walk(item.children);
      }
    };
    walk(data.manuscript);
  }

  // 2. Characters (traits are searched as one comma-joined string)
  if (data.characters) {
    for (const char of data.characters as any[]) {
      const cid = String(char.id);
      for (const field of ["name", "role", "description", "motivation", "backstory"]) {
        const s = pick("character", cid, field);
        if (s && typeof char[field] === "string") char[field] = replacePlain(char[field], s);
      }
      const ts = pick("character", cid, "traits");
      if (ts && Array.isArray(char.traits)) {
        char.traits = replacePlain(char.traits.join(", "), ts).split(", ");
      }
    }
  }

  // 3. Locations
  if (data.locations) {
    for (const loc of data.locations as any[]) {
      const lid = String(loc.id);
      for (const field of ["name", "type", "description", "history"]) {
        const s = pick("location", lid, field);
        if (s && typeof loc[field] === "string") loc[field] = replacePlain(loc[field], s);
      }
    }
  }

  // 4. Notes
  if (data.notes) {
    for (const [sceneId, noteContent] of Object.entries(data.notes)) {
      const s = pick("note", sceneId, "note");
      if (s && noteContent) data.notes[sceneId] = replacePlain(noteContent, s);
    }
  }

  // 5. Story Bible
  if (data.storyBible) {
    const bible = data.storyBible as any;
    for (const key of Object.keys(bible)) {
      const s = pick("bible", key, key);
      if (s && typeof bible[key] === "string") bible[key] = replacePlain(bible[key], s);
    }
  }

  storage.saveProjectData(projectId, data);
  return { updatedCount, projectData: data, previousData };
}

import { ManuscriptItem } from "@/mockData";
import { ProjectData } from "./storage";
import { stripHtml } from "./globalSearch";

export interface ContinuityIssue {
  id: string;
  type: 'location_conflict' | 'unregistered_entity' | 'name_typo' | 'mortality_status' | 'empty_scene';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sceneId?: string;
  sceneTitle?: string;
  entityName?: string;
  suggestedFix?: string;
  fixAction?: 'add_character' | 'add_location' | 'replace_text';
  replacementData?: {
    findText: string;
    replaceText: string;
    sceneId: string;
  };
}

export interface OverusedWordStat {
  word: string;
  count: number;
  frequency: number; // percentage of total words
  sampleContext: string;
}

export interface WordEcho {
  id: string;
  word: string;
  count: number;
  sceneId: string;
  sceneTitle: string;
  paragraphIndex: number;
  snippet: string;
}

export interface SentenceRhythmStat {
  totalSentences: number;
  avgSentenceLength: number;
  shortSentencesCount: number; // < 10 words
  mediumSentencesCount: number; // 10-25 words
  longSentencesCount: number; // > 25 words
  monotonyAlerts: string[];
}

export interface ConsistencyAnalysisResult {
  overallHealthScore: number; // 0 - 100
  totalWordCount: number;
  issues: ContinuityIssue[];
  overusedWords: OverusedWordStat[];
  echoes: WordEcho[];
  sentenceRhythm: SentenceRhythmStat;
}

// English stop words list
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into",
  "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
  "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
  "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
  "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
  "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "said", "asked", "back", "went", "looked", "like", "just", "came", "one", "two", "know", "see",
  "thought", "felt", "could", "would", "even", "still", "well", "way", "away", "seemed", "around"
]);

// Calculate Levenshtein distance between two strings
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = new Array<number[]>(bn + 1);
  for (let i = 0; i <= bn; ++i) {
    let row = (matrix[i] = new Array<number>(an + 1));
    row[0] = i;
  }
  const firstRow = matrix[0];
  for (let j = 1; j <= an; ++j) {
    firstRow[j] = j;
  }
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-name matcher that works for accented names and names containing symbols
function nameRegex(name: string, flags = 'iu'): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(name.trim())}(?![\\p{L}\\p{N}_])`, flags);
}

// Split scene HTML into plain-text paragraphs (stripHtml collapses line breaks)
function htmlParagraphs(html: string): string[] {
  if (!html) return [];
  return html
    .split(/<\/(?:p|h[1-6]|li|blockquote|div)>|<br\s*\/?>|\n{2,}/i)
    .map((p) => stripHtml(p))
    .filter((p) => p.trim().length > 0);
}

/**
 * Extracts all plain text scenes from manuscript tree
 */
export function getAllScenes(items: ManuscriptItem[]): Array<{ id: string; title: string; html: string; text: string; paragraphs: string[] }> {
  const scenes: Array<{ id: string; title: string; html: string; text: string; paragraphs: string[] }> = [];
  const traverse = (list: ManuscriptItem[]) => {
    for (const item of list) {
      if (item.type === 'scene') {
        const html = item.content || '';
        const text = stripHtml(html);
        scenes.push({
          id: item.id,
          title: item.title,
          html,
          text,
          paragraphs: htmlParagraphs(html),
        });
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  };
  traverse(items);
  return scenes;
}

/**
 * Main Analyzer function: Performs full consistency, continuity, and repetition checks
 */
export function analyzeProjectConsistency(
  projectData: ProjectData,
  filterSceneId?: string
): ConsistencyAnalysisResult {
  const allScenes = getAllScenes(projectData.manuscript || []);
  const scenesToAnalyze = filterSceneId 
    ? allScenes.filter(s => s.id === filterSceneId)
    : allScenes;

  const characters = projectData.characters || [];
  const locations = projectData.locations || [];
  const issues: ContinuityIssue[] = [];

  // Map known character names and locations (lowercased for easy lookup)
  const charNamesLower = new Map<string, any>();
  characters.forEach(c => {
    if (c.name) {
      charNamesLower.set(c.name.trim().toLowerCase(), c);
    }
  });

  const locNamesLower = new Map<string, any>();
  locations.forEach(l => {
    if (l.name) {
      locNamesLower.set(l.name.trim().toLowerCase(), l);
    }
  });

  // Every word that belongs to a known name or alias ("Sarah" of "Sarah Cole", "Lighthouse" of
  // "Old Lighthouse") — these must never be reported as unregistered names or typos.
  const knownNameParts = new Set<string>();
  [...characters, ...locations].forEach((e: any) => {
    [e.name, ...(Array.isArray(e.aliases) ? e.aliases : [])].forEach((n: string) => {
      if (typeof n === 'string') n.split(/\s+/).forEach(p => p && knownNameParts.add(p.toLowerCase()));
    });
  });

  // Words that appear in lowercase somewhere in the manuscript are ordinary words ("cold"),
  // not misspelled names ("Cole") — used to avoid destructive typo "fixes".
  const lowercaseWords = new Set<string>();
  allScenes.forEach(s => {
    (s.text.match(/\p{Ll}[\p{L}'’]*/gu) || []).forEach(w => lowercaseWords.add(w.toLowerCase()));
  });

  const isDeceased = (char: any): boolean => {
    const status = String(char.status || '').toUpperCase();
    if (status) return status === 'DECEASED' || status === 'DEAD';
    // Legacy profiles without a status field: only trust an explicit marker in the role
    return /\b(deceased|dead)\b/i.test(String(char.role || ''));
  };

  let totalWords = 0;
  const wordFrequencyMap = new Map<string, { count: number; sample: string }>();
  const echoes: WordEcho[] = [];

  const allSentences: string[] = [];
  let shortCount = 0;
  let medCount = 0;
  let longCount = 0;
  const monotonyAlerts: string[] = [];

  // ==========================================
  // 1. AUDIT SCENES FOR CONTINUITY & LOGIC
  // ==========================================
  for (const scene of scenesToAnalyze) {
    const plainText = scene.text;
    const wordTokens = plainText.trim().split(/\s+/).filter(w => w.length > 0);
    const sceneWordCount = wordTokens.length;
    totalWords += sceneWordCount;

    // Issue check: Empty or very short scene
    if (sceneWordCount < 30) {
      issues.push({
        id: `empty-scene-${scene.id}`,
        type: 'empty_scene',
        severity: 'low',
        title: `Empty or minimal content in scene: "${scene.title}"`,
        description: `This scene currently has only ${sceneWordCount} words. Consider adding plot developments or checking draft contents.`,
        sceneId: scene.id,
        sceneTitle: scene.title,
      });
    }

    // Check which characters are mentioned in this scene
    // (a character counts as present if their full name, first name or an alias appears)
    const mentionedChars: any[] = [];
    characters.forEach((char: any) => {
      if (!char.name) return;
      const first = char.name.trim().split(/\s+/)[0];
      const names = [char.name, ...(first && first.length >= 3 ? [first] : []), ...(Array.isArray(char.aliases) ? char.aliases : [])];
      if (names.some((n: string) => typeof n === 'string' && n.trim() && nameRegex(n).test(plainText))) {
        mentionedChars.push(char);
      }
    });

    // Check which locations are mentioned in this scene
    const mentionedLocs: any[] = [];
    locations.forEach((loc: any) => {
      if (loc.name && nameRegex(loc.name).test(plainText)) {
        mentionedLocs.push(loc);
      }
    });

    // 1A. Location Conflict: Check if scene has a primary location or title that conflicts with character home/status
    if (mentionedLocs.length > 0) {
      const primaryLoc = mentionedLocs[0];
      mentionedChars.forEach(char => {
        // If character has a designated assigned location, check if it mismatches and note it
        if (char.locationId) {
          const homeLoc = locations.find(l => String(l.id) === String(char.locationId));
          if (homeLoc && String(homeLoc.id) !== String(primaryLoc.id)) {
            // If character notes imply confinement, imprisonment, or seclusion
            const notes = `${char.description || ''} ${char.motivation || ''}`.toLowerCase();
            if (notes.includes('imprison') || notes.includes('bedridden') || notes.includes('captive') || notes.includes('exile') || notes.includes('hiding')) {
              issues.push({
                id: `loc-conflict-${scene.id}-${char.id}`,
                type: 'location_conflict',
                severity: 'medium',
                title: `Character location conflict: ${char.name}`,
                description: `Character "${char.name}" is recorded as residing at "${homeLoc.name}", but appears in scene "${scene.title}" set at "${primaryLoc.name}". Please verify travel continuity.`,
                sceneId: scene.id,
                sceneTitle: scene.title,
                entityName: char.name,
              });
            }
          }
        }
      });
    }

    // 1B. Deceased / Mortality Conflict
    // Uses the profile's status field — backstory words like "killed" describe other people.
    mentionedChars.forEach(char => {
      if (isDeceased(char)) {
        // Check if scene explicitly mentions memory/flashback
        const isFlashback = scene.title.toLowerCase().includes('flashback') || 
                            scene.title.toLowerCase().includes('memory') ||
                            scene.title.toLowerCase().includes('reminiscence') ||
                            plainText.toLowerCase().includes('remembered') ||
                            plainText.toLowerCase().includes('recalled');
        if (!isFlashback) {
          issues.push({
            id: `mortality-${scene.id}-${char.id}`,
            type: 'mortality_status',
            severity: 'high',
            title: `Deceased character appears: ${char.name}`,
            description: `Character "${char.name}" is marked as deceased, but appears in scene "${scene.title}". If this is a flashback or memory, consider noting it clearly in the scene title or prose.`,
            sceneId: scene.id,
            sceneTitle: scene.title,
            entityName: char.name,
          });
        }
      }
    });

    // 1C. Potential Typo in Character or Location Names
    // Look for words with 1 or 2 edit distance to registered character names
    const wordsInScene = plainText.match(/[\p{L}'’]+/gu) || [];
    const checkedVariants = new Set<string>();
    // A capitalised word is only a typo suspect if it is not a known name part and
    // never appears in lowercase in the manuscript (e.g. "Cold" vs character "Cole").
    const isTypoSuspect = (w: string) =>
      !knownNameParts.has(w.toLowerCase()) && !lowercaseWords.has(w.toLowerCase()) && !STOP_WORDS.has(w.toLowerCase());

    characters.forEach(char => {
      if (!char.name) return;
      const nameParts = char.name.split(/\s+/);
      const mainName = nameParts[0]; // e.g. "Sarah" or "Daniel"
      const fullName = char.name;

      // Scan 2-word sequences for full name typos
      for (let i = 0; i < wordsInScene.length - 1; i++) {
        const bigram = `${wordsInScene[i]} ${wordsInScene[i + 1]}`;
        if (bigram.toLowerCase() !== fullName.toLowerCase() && nameParts.length > 1) {
          const dist = levenshtein(bigram.toLowerCase(), fullName.toLowerCase());
          const suspectPart = [wordsInScene[i], wordsInScene[i + 1]].some(isTypoSuspect);
          if (dist === 1 && suspectPart && !checkedVariants.has(bigram.toLowerCase())) {
            checkedVariants.add(bigram.toLowerCase());
            issues.push({
              id: `typo-${scene.id}-${bigram}`,
              type: 'name_typo',
              severity: 'medium',
              title: `Potential name typo: "${bigram}"`,
              description: `The phrase "${bigram}" in scene "${scene.title}" may be a typo for character "${fullName}".`,
              sceneId: scene.id,
              sceneTitle: scene.title,
              entityName: fullName,
              suggestedFix: `Change to "${fullName}"`,
              fixAction: 'replace_text',
              replacementData: {
                findText: bigram,
                replaceText: fullName,
                sceneId: scene.id,
              }
            });
          }
        }
      }

      // Check 1-word typos if main name is at least 4 letters
      if (mainName.length >= 4) {
        for (const w of wordsInScene) {
          if (w.length >= 4 && w[0] !== w[0].toLowerCase() && w.toLowerCase() !== mainName.toLowerCase()) {
            const dist = levenshtein(w.toLowerCase(), mainName.toLowerCase());
            if (dist === 1 && !checkedVariants.has(w.toLowerCase()) && isTypoSuspect(w)) {
              checkedVariants.add(w.toLowerCase());
              issues.push({
                id: `typo-single-${scene.id}-${w}`,
                type: 'name_typo',
                severity: 'medium',
                title: `Possible misspelling of name: "${w}"`,
                description: `The word "${w}" in scene "${scene.title}" is only 1 character different from character "${mainName}".`,
                sceneId: scene.id,
                sceneTitle: scene.title,
                entityName: char.name,
                suggestedFix: `Fix to "${mainName}"`,
                fixAction: 'replace_text',
                replacementData: {
                  findText: w,
                  replaceText: mainName,
                  sceneId: scene.id,
                }
              });
            }
          }
        }
      }
    });

    // 1D. Unregistered Names Detector: Names like "Detective Marcus", "Dr. Vance" or repeated Capitalized names
    // Only mid-sentence capitalised words count: sentence-initial words ("Every", "Nothing") are
    // capitalised by grammar, not because they are names.
    const capitalizedNameMatches: string[] = [];
    const capRe = /(?<![\p{L}\p{N}_])(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)?)(?![\p{L}\p{N}_])/gu;
    let capM: RegExpExecArray | null;
    while ((capM = capRe.exec(plainText)) !== null) {
      const before = plainText.slice(0, capM.index).trimEnd();
      const sentenceStart = before.length === 0 || /[.!?…:"“”'‘’—–-]$/.test(before);
      if (!sentenceStart) capitalizedNameMatches.push(capM[1]);
    }
    const candidateNameCount = new Map<string, number>();
    for (const cand of capitalizedNameMatches) {
      const candLower = cand.trim().toLowerCase();
      const allPartsKnown = candLower.split(/\s+/).every(p => knownNameParts.has(p) || STOP_WORDS.has(p));
      if (cand.length > 3 && !STOP_WORDS.has(candLower) && !charNamesLower.has(candLower) && !locNamesLower.has(candLower) && !allPartsKnown) {
        // Exclude common initial sentence capitalized words
        if (!['Chapter', 'Scene', 'Part', 'The', 'After', 'Before', 'When', 'Suddenly', 'Then', 'However', 'Meanwhile'].includes(cand)) {
          candidateNameCount.set(cand, (candidateNameCount.get(cand) || 0) + 1);
        }
      }
    }

    // Flag candidate names that appear 2+ times as unregistered characters
    for (const [candName, count] of candidateNameCount.entries()) {
      if (count >= 2 && !checkedVariants.has(candName.toLowerCase())) {
        checkedVariants.add(candName.toLowerCase());
        issues.push({
          id: `unregistered-${scene.id}-${candName}`,
          type: 'unregistered_entity',
          severity: 'low',
          title: `Unregistered entity or character: "${candName}"`,
          description: `The name "${candName}" appears ${count} times in scene "${scene.title}" but is not listed in Characters or Locations.`,
          sceneId: scene.id,
          sceneTitle: scene.title,
          entityName: candName,
          suggestedFix: `Quick create profile for "${candName}"`,
          fixAction: 'add_character',
        });
      }
    }

    // ==========================================
    // 2. REPETITIVE WORDS & ECHOES ANALYSIS
    // ==========================================
    // Split into paragraphs for echo detection
    const paragraphs = scene.paragraphs.length > 0 ? scene.paragraphs : [plainText];

    paragraphs.forEach((para, pIdx) => {
      const paraWords = para.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];
      const paraWordCounts = new Map<string, number>();

      for (const w of paraWords) {
        // names of characters/places naturally repeat — they are not stylistic echoes
        if (w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w) && !knownNameParts.has(w)) {
          paraWordCounts.set(w, (paraWordCounts.get(w) || 0) + 1);
        }
      }

      // Check for echoes within this paragraph (repeats >= 2)
      for (const [w, count] of paraWordCounts.entries()) {
        if (count >= 2) {
          // Find context snippet around the first occurrence
          const firstIdx = para.toLowerCase().indexOf(w);
          const start = Math.max(0, firstIdx - 30);
          const end = Math.min(para.length, firstIdx + 120);
          const snippet = (start > 0 ? "…" : "") + para.substring(start, end).trim() + (end < para.length ? "…" : "");

          echoes.push({
            id: `echo-${scene.id}-${pIdx}-${w}`,
            word: w,
            count,
            sceneId: scene.id,
            sceneTitle: scene.title,
            paragraphIndex: pIdx + 1,
            snippet,
          });
        }
      }
    });

    // Count overall word frequencies across the scope
    for (const w of wordsInScene) {
      const lower = w.toLowerCase();
      if (lower.length >= 3 && !STOP_WORDS.has(lower) && !/^\d+$/.test(lower) && !knownNameParts.has(lower)) {
        const existing = wordFrequencyMap.get(lower);
        if (existing) {
          existing.count++;
        } else {
          // Extract sample sentence
          const idx = plainText.toLowerCase().indexOf(lower);
          const sample = plainText.substring(Math.max(0, idx - 25), Math.min(plainText.length, idx + 65));
          wordFrequencyMap.set(lower, { count: 1, sample: `…${sample.trim()}…` });
        }
      }
    }

    // Sentence rhythm calculation
    const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
    for (const sent of sentences) {
      const sWords = sent.trim().split(/\s+/).filter(w => w.length > 0);
      const len = sWords.length;
      if (len > 0) {
        allSentences.push(sent);
        if (len < 10) shortCount++;
        else if (len <= 25) medCount++;
        else longCount++;
      }
    }
  }

  // Compile Top Overused Words
  const overusedWords: OverusedWordStat[] = [];
  const sortedWords = Array.from(wordFrequencyMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);

  for (const [word, data] of sortedWords) {
    if (data.count >= 2) {
      overusedWords.push({
        word,
        count: data.count,
        frequency: totalWords > 0 ? Number(((data.count / totalWords) * 100).toFixed(2)) : 0,
        sampleContext: data.sample,
      });
    }
  }

  // Sentence rhythm statistics
  const totalSentences = allSentences.length || 1;
  let totalSentenceWords = 0;
  allSentences.forEach(s => {
    totalSentenceWords += s.trim().split(/\s+/).filter(w => w.length > 0).length;
  });
  const avgSentenceLength = Number((totalSentenceWords / totalSentences).toFixed(1));

  if (shortCount / totalSentences > 0.6) {
    monotonyAlerts.push("High proportion of short sentences (> 60%) may make prose feel abrupt or fragmented.");
  }
  if (longCount / totalSentences > 0.45) {
    monotonyAlerts.push("Multiple consecutive long sentences (> 25 words) may fatigue readers or obscure key details.");
  }

  // Compute Overall Health Score (0 - 100)
  let penalty = 0;
  issues.forEach(i => {
    if (i.severity === 'high') penalty += 15;
    else if (i.severity === 'medium') penalty += 8;
    else penalty += 3;
  });
  if (echoes.length > 10) penalty += 10;
  else if (echoes.length > 5) penalty += 5;

  const overallHealthScore = Math.max(20, Math.min(100, 100 - penalty));

  return {
    overallHealthScore,
    totalWordCount: totalWords,
    issues,
    overusedWords,
    echoes: echoes.slice(0, 35),
    sentenceRhythm: {
      totalSentences,
      avgSentenceLength,
      shortSentencesCount: shortCount,
      mediumSentencesCount: medCount,
      longSentencesCount: longCount,
      monotonyAlerts,
    }
  };
}

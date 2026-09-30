import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Check, ExternalLink, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectMeta, StoryBibleData, storage } from '@/lib/storage';
import { htmlToBlocks, blockText } from '@/lib/epubExport';

interface AIPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectMeta: ProjectMeta | null;
  activeSceneTitle: string;
  activeSceneNotes: string;
  activeSceneContent: string;
  characters: any[];
  locations: any[];
}

type Tab = 'scene' | 'system' | 'polish';

// Profile fields can be long; keep prompts focused
const clip = (text: string, max = 600) => {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Is this character/location named in the scene (mention tag, full name, first name or alias)?
function appearsIn(html: string, plain: string, entity: any): boolean {
  if (!entity?.name) return false;
  const id = String(entity.id ?? '').replace(/^(char-|loc-)/, '');
  if (id && new RegExp(`data-id=["'](?:char-|loc-)?${escapeRegExp(id)}["']`).test(html)) return true;
  const names = new Set<string>([entity.name.trim()]);
  const first = entity.name.trim().split(/\s+/)[0];
  if (first && first.length >= 3) names.add(first);
  const aliases = Array.isArray(entity.aliases) ? entity.aliases : typeof entity.aliases === 'string' ? entity.aliases.split(',') : [];
  aliases.forEach((a: string) => a && a.trim().length >= 2 && names.add(a.trim()));
  return [...names].some((n) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(n)}(?![\\p{L}\\p{N}_])`, 'iu').test(plain));
}

const VIETNAMESE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

export default function AIPromptModal({
  isOpen,
  onClose,
  projectMeta,
  activeSceneTitle,
  activeSceneNotes,
  activeSceneContent,
  characters,
  locations
}: AIPromptModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('scene');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedLocId, setSelectedLocId] = useState<string>('');
  const [customConflict, setCustomConflict] = useState<string>('');
  const [targetWordCount, setTargetWordCount] = useState<string>('900 - 1300');
  const authorDefaults = storage.getUserProfile();
  const [sceneTone, setSceneTone] = useState<string>(() => authorDefaults.defaultTone?.trim() || 'Atmospheric, high tension, sensory-rich');
  const [includeBible, setIncludeBible] = useState(true);

  // The scene as clean paragraphs — never send editor HTML or mention markup to the AI
  const sceneParagraphs = useMemo(
    () => htmlToBlocks(activeSceneContent || '', true).map((b) => (b.type === 'break' ? '* * *' : blockText(b))),
    [activeSceneContent]
  );
  const scenePlain = sceneParagraphs.join('\n\n');
  const sceneWords = scenePlain.split(/\s+/).filter(Boolean).length;
  const writesVietnamese = VIETNAMESE.test(`${scenePlain} ${activeSceneNotes || ''}`);

  // Each time the hub opens, preselect who and where the current scene is about
  useEffect(() => {
    if (!isOpen) return;
    const html = activeSceneContent || '';
    const inScene = characters.filter((c) => appearsIn(html, scenePlain, c)).map((c) => String(c.id));
    setSelectedCharIds(inScene.length ? inScene : characters.slice(0, 2).map((c) => String(c.id)));
    const loc = locations.find((l) => appearsIn(html, scenePlain, l));
    setSelectedLocId(loc ? String(loc.id) : '');
    setCopiedKey(null);
    setCopyFailed(false);
  }, [isOpen, activeSceneTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Clipboard API needs a secure context; fall back to a hidden textarea
  const handleCopy = async (text: string, key: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch {
        ok = false;
      }
    }
    setCopyFailed(!ok);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const selectedCharacters = useMemo(() => characters.filter(c => selectedCharIds.includes(String(c.id))), [characters, selectedCharIds]);
  const selectedLocation = useMemo(() => locations.find(l => String(l.id) === selectedLocId), [locations, selectedLocId]);

  // Story Bible canon for this book — injected into every prompt so the AI writes within the book's rules
  const bible = useMemo<StoryBibleData | undefined>(() => {
    if (!projectMeta?.id) return undefined;
    return storage.getProjectData(projectMeta.id)?.storyBible;
  }, [projectMeta?.id, isOpen]);

  const hasBible = !!bible && Object.values(bible).some((v) => typeof v === 'string' && v.trim());

  const bibleLines = (fields: Array<[string, string | undefined]>) =>
    fields
      .filter(([, v]) => v && v.trim())
      .map(([label, v]) => `- ${label}: ${v!.trim()}`)
      .join('\n');

  const sceneCanonBlock = useMemo(() => {
    if (!includeBible || !hasBible || !bible) return '';
    const lines = bibleLines([
      ['Narrative POV', bible.pov],
      ['Book tone', bible.tone],
      ['Premise', bible.premise],
      ['Main conflict', bible.mainConflict],
      ['Setting', [bible.timePeriod, bible.primarySetting].filter(Boolean).join(' · ')],
      ['World rules (never break these)', bible.importantRules],
      ['Narrative style', bible.narrativeStyle],
      ['Dialogue', bible.dialogueStyle],
      ['Author rules', bible.aiInstructions],
    ]);
    return lines ? `\n[STORY BIBLE CANON]\n${lines}\n` : '';
  }, [includeBible, hasBible, bible]);

  const fullBibleBlock = useMemo(() => {
    if (!includeBible || !hasBible || !bible) return '';
    const sections = [
      ['Book', bibleLines([
        ['Genre', [bible.genre, bible.subgenre].filter(Boolean).join(' / ')],
        ['Target audience', bible.targetAudience],
        ['Narrative POV', bible.pov],
        ['Tone & mood', bible.tone],
      ])],
      ['Story core', bibleLines([
        ['Premise', bible.premise],
        ['Main conflict', bible.mainConflict],
        ['Story goal', bible.storyGoal],
        ['Key themes', bible.themes],
      ])],
      ['World & rules', bibleLines([
        ['Time period', bible.timePeriod],
        ['Primary setting', bible.primarySetting],
        ['World description', bible.worldDescription],
        ['Rules that must never be broken', bible.importantRules],
      ])],
      ['Writing style', bibleLines([
        ['Narrative style', bible.narrativeStyle],
        ['Dialogue conventions', bible.dialogueStyle],
        ['Pacing', bible.pacing],
        ['Author rules', bible.aiInstructions],
      ])],
    ].filter(([, body]) => body);
    return sections.map(([title, body]) => `${title}:\n${body}`).join('\n\n');
  }, [includeBible, hasBible, bible]);

  const castAndAtlas = useMemo(() => {
    if (!includeBible) return '';
    const cast = characters
      .filter((c) => c?.name)
      .slice(0, 15)
      .map((c) => `- @[${c.name}] — ${c.role || 'Character'}${c.archetype ? `, ${c.archetype}` : ''}`)
      .join('\n');
    const atlas = locations
      .filter((l) => l?.name)
      .slice(0, 15)
      .map((l) => `- @[${l.name}] — ${l.type || 'Location'}${l.region ? ` (${l.region})` : ''}`)
      .join('\n');
    return [cast && `Main characters:\n${cast}`, atlas && `Key locations:\n${atlas}`].filter(Boolean).join('\n\n');
  }, [includeBible, characters, locations]);

  const languageRule = writesVietnamese
    ? '\n4. Language: Write in Vietnamese, matching the manuscript. Keep character and place names exactly as given.'
    : '';

  const characterDossier = (c: any, i: number) => {
    let traits = '';
    if (Array.isArray(c.traits) && c.traits.length > 0) traits = c.traits.filter(Boolean).join(', ');
    else if (typeof c.traits === 'string') traits = c.traits.trim();
    const backstory = clip(c.backstory || c.description || c.shortBio || '');
    const extras: string[] = [];
    if (c.mbti) extras.push(`MBTI: ${c.mbti}`);
    if (c.archetype) extras.push(`Archetype: ${c.archetype}`);
    if (c.motivation || c.goal) extras.push(`Wants: ${clip(c.motivation || c.goal, 200)}`);
    if (c.conflict) extras.push(`Conflict: ${clip(c.conflict, 200)}`);
    if (c.trauma) extras.push(`Wound: ${clip(c.trauma, 200)}`);
    return [
      `${i + 1}. @[${c.name}]`,
      `   - Role: ${c.role || 'Key Character'}`,
      traits && `   - Traits: ${traits}`,
      backstory && `   - Background: ${backstory}`,
      extras.length > 0 && `   - Psychology & Motivation: ${extras.join(' | ')}`,
    ].filter(Boolean).join('\n');
  };

  // 1. Scene prompt — continues the scene when it already has text
  const generatedScenePrompt = useMemo(() => {
    const charsBlock = selectedCharacters.length > 0
      ? selectedCharacters.map(characterDossier).join('\n\n')
      : '1. @[Main Character]: Protagonist confronting immediate obstacles';

    const locBlock = selectedLocation
      ? `@[${selectedLocation.name}]:\n  * Type & Region: ${selectedLocation.type || 'Setting'}${selectedLocation.region ? ` (${selectedLocation.region})` : ''}\n  * Atmosphere: ${clip(selectedLocation.description || 'Vivid physical environment', 500)}`
      : '@[Scene Setting]: Immediate physical room or landscape with distinct sensory texture';

    const notesSummary = activeSceneNotes?.trim() ? `\n[SCENE NOTES & AUTHOR SCRATCHPAD]\n${activeSceneNotes.trim()}\n` : '';

    // Last ~250 words so the AI picks up the voice and the exact moment
    let leftOff = '';
    if (sceneWords > 0) {
      const tail: string[] = [];
      let count = 0;
      for (let i = sceneParagraphs.length - 1; i >= 0 && count < 250; i--) {
        tail.unshift(sceneParagraphs[i]);
        count += sceneParagraphs[i].split(/\s+/).filter(Boolean).length;
      }
      leftOff = `\n[WHERE THE SCENE LEAVES OFF — continue directly from the last line, do not repeat it]\n${tail.join('\n\n')}\n`;
    }

    const opening = sceneWords > 0
      ? `Continue the scene "${activeSceneTitle || 'Untitled Scene'}" of my novel, picking up exactly where the text below stops.`
      : `Write the scene "${activeSceneTitle || 'Untitled Scene'}" of my novel based on the following parameters.`;

    return `${opening}

[SCENE METADATA]
- Project: ${projectMeta?.title || 'Untitled Novel'}
- Genre: ${projectMeta?.genre || 'Fiction'}
- Scene: ${activeSceneTitle || 'Untitled Scene'}${sceneWords > 0 ? ` (already ${sceneWords.toLocaleString()} words)` : ''}
- Length to write: ~${targetWordCount} words
- Tone & Mood: ${sceneTone}${!bible?.pov?.trim() && authorDefaults.defaultPov?.trim() ? `\n- Point of View: ${authorDefaults.defaultPov.trim()}` : ''}
${sceneCanonBlock}
[LOCATION & SETTING]
${locBlock}

[ACTIVE CHARACTERS]
${charsBlock}
${notesSummary}${leftOff}
[CORE CONFLICT & SCENE BEAT]
${customConflict.trim() || '- Establish immediate tension between the characters regarding an urgent revelation or ticking clock.\n- Introduce a subtle discovery or shift in interpersonal power dynamics.\n- Conclude with an open, breathless hook that propels into the next scene.'}

[WRITING RULES]
1. Show, Don't Tell: Avoid summarizing feelings with dry adjectives; ground emotional stakes in micro-gestures, physical reactions, and environmental details.
2. Clean Prose: The @[Name] tags above are for reference only. NEVER use tags or brackets in the story text — write natural, publication-ready prose with plain names.
3. Cadence: Keep dialogue sharp and purposeful. Vary sentence length and avoid repeating words close together.${languageRule}
Reply with the scene text only — no headings, notes or commentary.`;
  }, [projectMeta, activeSceneTitle, targetWordCount, sceneTone, selectedLocation, selectedCharacters, activeSceneNotes, customConflict, sceneCanonBlock, sceneParagraphs, sceneWords, languageRule, bible]);

  // 2. System / setup prompt
  const generatedSystemPrompt = useMemo(() => {
    return `You are a seasoned co-author and narrative architect helping me write a novel.

I plan the book with a Story Bible, character and location profiles, and a manuscript editor. Follow these standards in every reply:

1. Literary Craft Standards:
   - Rigorous "Show, Don't Tell": Never state character emotions directly through static adjectives (e.g., avoid "he was furious"). Convey psychological tension through sensory cues, micro-expressions, pacing, breathing, and physical interaction with the environment.
   - Varied Sentence Cadence: Blend short, staccato sentences in high-tension moments with flowing clauses in reflective beats.
   - No Echoes: Do not reuse prominent descriptive words, verbs, or sensory adjectives within any three-sentence window.

2. Entity Tags & Clean Manuscript Rule:
   - Entity tags (@[Name]) appear only in my notes and outlines, as references.
   - NEVER use entity tags or bracketed labels in story prose or dialogue. Story text must be clean, natural, publication-ready prose.

3. Project Overview:
   - Title: ${projectMeta?.title || 'Untitled Novel'}
   - Genre: ${projectMeta?.genre || 'Fiction'}
   - Target length: ${projectMeta?.wordGoal ? Number(projectMeta.wordGoal).toLocaleString() : '80,000'} words${writesVietnamese ? '\n   - Language: Vietnamese — write all story text in Vietnamese.' : ''}
${fullBibleBlock ? `
4. Story Bible (canon — treat as ground truth; never contradict it):

${fullBibleBlock}
` : ''}${castAndAtlas ? `
${fullBibleBlock ? '5' : '4'}. Cast & World Atlas:

${castAndAtlas}
` : ''}
${fullBibleBlock || castAndAtlas
  ? 'Acknowledge that you understand these standards and this canon in two sentences, then wait for my first scene request.'
  : 'Acknowledge that you understand these standards, then ask me about the characters, setting and plot so we can begin.'}`;
  }, [projectMeta, fullBibleBlock, castAndAtlas, writesVietnamese]);

  // 3. Review prompt — clean text plus the profiles the review is checked against
  const generatedPolishPrompt = useMemo(() => {
    const excerpt = scenePlain.trim() || '[PASTE YOUR DRAFT SCENE TEXT HERE]';
    const profiles = selectedCharacters.length > 0
      ? `\n[CHARACTER PROFILES TO CHECK AGAINST]\n${selectedCharacters.map(characterDossier).join('\n\n')}\n`
      : '';

    return `Act as a senior fiction editor. Analyze and critique the manuscript excerpt below across these axes, quoting the exact line for every issue and suggesting a revision:

1. Character Voice & Behavioral Consistency:
   - Does any action, decision, or line of dialogue feel unnatural or contradict the character profiles?
   - Are power dynamics and subtext preserved throughout the interaction?

2. Physical & Spatial Logic:
   - Flag continuity slips in positioning, movement, held objects, lighting, or timing within the space.

3. Repetitive Echoes & Word Overuse:
   - Highlight redundant verbs, sensory words, or ideas repeated in proximity, with tighter alternatives.

4. Stylistic Tightening:
   - Pinpoint filter words (e.g., "she saw," "he felt"), weak adverbs, and passive constructions that can become active, immersive prose.
${sceneCanonBlock ? `
5. Canon Compliance:
   - Flag any line that breaks the POV, tone, world rules or style defined in the Story Bible canon below, and suggest a fix.
${sceneCanonBlock}` : ''}${profiles}${writesVietnamese ? '\nWrite your review in Vietnamese.\n' : ''}
[MANUSCRIPT EXCERPT — "${activeSceneTitle || 'Untitled Scene'}"]
${excerpt}`;
  }, [scenePlain, sceneCanonBlock, selectedCharacters, activeSceneTitle, writesVietnamese]);

  const prompts: Record<Tab, { text: string; label: string; help: string }> = {
    scene: {
      text: generatedScenePrompt,
      label: 'Scene prompt',
      help: sceneWords > 0
        ? 'Asks the AI to continue this scene from its last lines, in your voice.'
        : 'Asks the AI to draft this scene from your cast, place and beat.',
    },
    system: {
      text: generatedSystemPrompt,
      label: 'Setup prompt',
      help: 'Send once at the start of a new chat. It sets your style rules and the book’s canon.',
    },
    polish: {
      text: generatedPolishPrompt,
      label: 'Review prompt',
      help: sceneWords > 0
        ? `Packs this scene (${sceneWords.toLocaleString()} words) for an editorial review.`
        : 'This scene is empty — paste the text you want reviewed into the prompt.',
    },
  };
  const current = prompts[activeTab];
  const approxTokens = Math.round(current.text.length / 4);

  const fieldLabel = 'block text-[12px] font-semibold text-[#0E1D26]/60 mb-1.5';
  const fieldInput = 'w-full h-10 px-3.5 rounded-xl bg-white border border-[#E9E2D4] text-[13px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0E1D26]/45 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="relative w-full max-w-5xl max-h-[92vh] lg:h-[88vh] bg-[#FBF9F4] rounded-[28px] border border-[#E9E2D4] shadow-2xl flex flex-col overflow-hidden text-[#0E1D26]"
          >
            {/* Header */}
            <div className="px-6 sm:px-7 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">AI Prompt Hub</p>
                <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.01em] leading-tight truncate">{activeSceneTitle || 'Current scene'}</h2>
                <p className="mt-1 text-[13px] text-[#0E1D26]/55">Copy a prompt, paste it into your AI chat, then bring the text back into the Studio.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {[['ChatGPT', 'https://chatgpt.com'], ['Gemini', 'https://gemini.google.com'], ['Claude', 'https://claude.ai']].map(([name, href]) => (
                  <a key={name} href={href} target="_blank" rel="noreferrer" className="hidden md:flex h-8 px-3 rounded-full border border-[#E9E2D4] hover:bg-[#EFE9DE] text-[12px] font-semibold text-[#0E1D26]/70 items-center gap-1.5">
                    {name} <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
                <button onClick={onClose} className="ml-1 w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer" title="Close (Esc)">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs + canon switch */}
            <div className="px-6 sm:px-7 pb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
                {([['scene', 'Write scene'], ['system', 'Chat setup'], ['polish', 'Review']] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`h-8 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${activeTab === tab ? 'bg-white text-[#0E1D26] shadow-sm' : 'text-[#0E1D26]/55 hover:text-[#0E1D26]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label
                className={`flex items-center gap-2.5 select-none ${hasBible ? 'cursor-pointer' : 'opacity-50'}`}
                title={hasBible ? 'Adds your Story Bible (POV, tone, premise, world rules, style) and cast' : 'Fill in the Story Bible to add its canon'}
              >
                <span className="text-[13px] font-semibold text-[#0E1D26]/70">{hasBible ? 'Include Story Bible' : 'Story Bible is empty'}</span>
                <input type="checkbox" className="sr-only peer" checked={includeBible && hasBible} disabled={!hasBible} onChange={(e) => setIncludeBible(e.target.checked)} />
                <span aria-hidden className={`w-10 h-6 rounded-full p-0.5 transition-colors ${includeBible && hasBible ? 'bg-[#0E1D26]' : 'bg-[#E4DAC8]'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${includeBible && hasBible ? 'translate-x-4' : ''}`} />
                </span>
              </label>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden px-6 sm:px-7 pb-6 custom-scrollbar">
              <div className={`h-full grid gap-5 ${activeTab === 'scene' ? 'lg:grid-cols-[320px_1fr]' : 'grid-cols-1'}`}>
                {activeTab === 'scene' && (
                  <div className="lg:overflow-y-auto custom-scrollbar space-y-4 lg:pr-1">
                    <div>
                      <p className={fieldLabel}>
                        Characters <span className="font-normal text-[#0E1D26]/40">· {selectedCharIds.length} selected</span>
                      </p>
                      {characters.length === 0 ? (
                        <p className="text-[13px] text-[#0E1D26]/45">No characters yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {characters.map((char) => {
                            const on = selectedCharIds.includes(String(char.id));
                            return (
                              <button
                                key={`pm-char-${char.id}`}
                                type="button"
                                onClick={() => setSelectedCharIds((prev) => (on ? prev.filter((id) => id !== String(char.id)) : [...prev, String(char.id)]))}
                                className={`h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer ${on ? 'bg-[#0E1D26] border-[#0E1D26] text-[#F6F1E7]' : 'bg-white border-[#E9E2D4] text-[#0E1D26]/70 hover:border-[#D9CFBC]'}`}
                                title={char.role || 'Character'}
                              >
                                {char.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={fieldLabel}>Place</label>
                      <select value={selectedLocId} onChange={(e) => setSelectedLocId(e.target.value)} className={fieldInput}>
                        <option value="">No specific place</option>
                        {locations.map((loc) => (
                          <option key={`pm-loc-${loc.id}`} value={String(loc.id)}>{loc.name}{loc.type ? ` — ${loc.type}` : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={fieldLabel}>Length (words)</label>
                        <input type="text" value={targetWordCount} onChange={(e) => setTargetWordCount(e.target.value)} placeholder="900 - 1300" className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Tone</label>
                        <input type="text" value={sceneTone} onChange={(e) => setSceneTone(e.target.value)} placeholder="Tense, quiet…" className={fieldInput} />
                      </div>
                    </div>

                    <div>
                      <label className={fieldLabel}>What happens <span className="font-normal text-[#0E1D26]/40">· optional</span></label>
                      <textarea
                        value={customConflict}
                        onChange={(e) => setCustomConflict(e.target.value)}
                        placeholder="e.g. She finds the letter; he tries to hide that he sent it."
                        rows={4}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E9E2D4] text-[13px] leading-relaxed text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 resize-none"
                      />
                    </div>

                    {activeSceneNotes?.trim() && (
                      <p className="text-[12px] text-[#0E1D26]/50">Your scene notes are included.</p>
                    )}
                  </div>
                )}

                {/* Prompt preview */}
                <div className="min-h-0 flex flex-col rounded-2xl bg-white border border-[#E9E2D4] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F1ECE2] flex items-center justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{current.label}</p>
                      <p className="text-[12px] text-[#0E1D26]/50 truncate">{current.help}</p>
                    </div>
                    <button
                      onClick={() => handleCopy(current.text, activeTab)}
                      className={`shrink-0 h-10 pl-4 pr-1.5 rounded-full text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer ${copiedKey === activeTab ? 'bg-[#2F7A4F]' : 'bg-[#E8561F] hover:bg-[#D44B17]'}`}
                    >
                      {copiedKey === activeTab ? 'Copied' : 'Copy prompt'}
                      <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        {copiedKey === activeTab ? <Check className="w-4 h-4" /> : <Copy className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  </div>
                  {copyFailed && (
                    <p className="px-4 py-2 text-[12px] text-[#8C1D18] bg-[#B3261E]/5 border-b border-[#B3261E]/15">Couldn’t reach the clipboard — select the text below and copy it manually.</p>
                  )}
                  <pre className="flex-1 min-h-[280px] lg:min-h-0 overflow-y-auto custom-scrollbar p-4 font-mono text-[12px] leading-relaxed text-[#1D2A31] whitespace-pre-wrap select-text">
                    {current.text}
                  </pre>
                  <p className="px-4 py-2 border-t border-[#F1ECE2] text-[11px] text-[#0E1D26]/40 tabular-nums shrink-0">
                    ~{approxTokens.toLocaleString()} tokens · {current.text.length.toLocaleString()} characters
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

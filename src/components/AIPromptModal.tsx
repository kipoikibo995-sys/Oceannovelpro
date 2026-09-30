import React, { useState, useMemo } from 'react';
import { Copy, Check, ExternalLink, X, BookOpen, Layers, Compass, Feather, Info, ArrowRight } from 'lucide-react';
import { ProjectMeta, StoryBibleData, storage } from '@/lib/storage';

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
  const [activeTab, setActiveTab] = useState<'scene' | 'system' | 'polish'>('scene');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Scene drafting state
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(() => {
    return characters.slice(0, 2).map(c => String(c.id));
  });
  const [selectedLocId, setSelectedLocId] = useState<string>(() => {
    return locations[0] ? String(locations[0].id) : '';
  });
  const [customConflict, setCustomConflict] = useState<string>('');
  const [targetWordCount, setTargetWordCount] = useState<string>('900 - 1300');
  const [sceneTone, setSceneTone] = useState<string>('Atmospheric, high tension, sensory-rich');
  const [includeBible, setIncludeBible] = useState(true);

  // Copy helper with visual feedback
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const selectedCharacters = useMemo(() => {
    return characters.filter(c => selectedCharIds.includes(String(c.id)));
  }, [characters, selectedCharIds]);

  const selectedLocation = useMemo(() => {
    return locations.find(l => String(l.id) === selectedLocId);
  }, [locations, selectedLocId]);

  // Story Bible canon for this book — injected into every prompt so the AI writes within the book's rules
  const bible = useMemo<StoryBibleData | undefined>(() => {
    if (!projectMeta?.id) return undefined;
    return storage.getProjectData(projectMeta.id)?.storyBible;
  }, [projectMeta?.id, isOpen]);

  const hasBible = !!bible && Object.values(bible).some((v) => typeof v === 'string' && v.trim());

  // Renders "- Label: value" lines for the fields that are filled in
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

  // Short cast & atlas list for the system prompt (full dossiers go in scene prompts)
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

  // 1. Scene Prompt Generation
  const generatedScenePrompt = useMemo(() => {
    const charsBlock = selectedCharacters.length > 0 
      ? selectedCharacters.map((c, i) => {
          let traits = 'None listed';
          if (Array.isArray(c.traits) && c.traits.length > 0) {
            traits = c.traits.filter(Boolean).join(', ');
          } else if (typeof c.traits === 'string' && c.traits.trim()) {
            traits = c.traits.trim();
          }

          const backstory = c.backstory || c.description || c.shortBio || c.goal || 'Not specified';
          
          const extras: string[] = [];
          if (c.mbti) extras.push(`MBTI: ${c.mbti}`);
          if (c.archetype) extras.push(`Archetype: ${c.archetype}`);
          if (c.goal) extras.push(`Goal: ${c.goal}`);
          if (c.conflict) extras.push(`Conflict: ${c.conflict}`);
          if (c.trauma) extras.push(`Trauma: ${c.trauma}`);
          const extrasLine = extras.length > 0 ? `\n   - Psychology & Motivation: ${extras.join(' | ')}` : '';

          return `${i + 1}. @[${c.name}]:\n   - Role: ${c.role || 'Key Character'}\n   - Traits: ${traits}\n   - Backstory: ${backstory}${extrasLine}`;
        }).join('\n\n')
      : '1. @[Main Character]: Protagonist confronting immediate obstacles';

    const locBlock = selectedLocation
      ? `@[${selectedLocation.name}]:\n  * Type & Region: ${selectedLocation.type || 'Setting'} (${selectedLocation.region || 'Unknown Realm'})\n  * Atmosphere: ${selectedLocation.description || 'Vivid physical environment'}`
      : '@[Scene Setting]: Immediate physical room or landscape with distinct sensory texture';

    const notesSummary = activeSceneNotes?.trim() 
      ? `\n[SCENE NOTES & AUTHOR SCRATCHPAD]\n${activeSceneNotes.trim()}\n`
      : '';

    return `Write the next scene for my Ocean Novel project based on the following structural parameters:

[SCENE METADATA]
- Project: ${projectMeta?.title || 'Ocean Novel Project'}
- Genre & Setting: ${projectMeta?.genre || 'Fiction'}
- Scene Title: ${activeSceneTitle || 'Untitled Scene'}
- Target Length: ~${targetWordCount} words
- Tone & Mood: ${sceneTone}
${sceneCanonBlock}
[LOCATION & SETTING]
${locBlock}

[ACTIVE CHARACTERS]
${charsBlock}
${notesSummary}
[CORE CONFLICT & SCENE BEAT]
${customConflict.trim() || '- Establish immediate tension between the characters regarding an urgent revelation or ticking clock.\n- Introduce a subtle discovery or shift in interpersonal power dynamics.\n- Conclude with an open, breathless hook that propels into the next scene.'}

[OCEAN NOVEL SPECIFICATIONS]
1. Show, Don't Tell: Avoid summarizing feelings with dry adjectives; ground emotional stakes in micro-gestures, physical reactions, and environmental details.
2. Clean Manuscript Prose & Entity Tag Rule: Use entity tags (@[Name]) ONLY in metadata, outlines, summaries, or hidden system context. NEVER use entity tags or brackets (@[Name]) in the reader-facing manuscript prose, dialogue, or story text. Write natural, publication-ready prose using clean names.
3. Cadence & Prose: Keep dialogue sharp and purposeful. Avoid monotonous sentence structures and nearby repeating words (echoes).`;
  }, [projectMeta, activeSceneTitle, targetWordCount, sceneTone, selectedLocation, selectedCharacters, activeSceneNotes, customConflict, sceneCanonBlock]);

  // 2. System / Worldbuilding Prompt
  const generatedSystemPrompt = useMemo(() => {
    return `You are a seasoned Co-Author and Master Narrative Architect for "Ocean Novel", an advanced storytelling and worldbuilding studio.

I am drafting a novel using Ocean Novel's Story Bible, Relationship Graphs, and Manuscript Editor. You will collaborate with me following these core standards:

1. Literary Craft Standards:
   - Rigorous "Show, Don't Tell": Never state character emotions directly through static adjectives (e.g., avoid "he was furious"). Instead, convey psychological tension through sensory cues, micro-expressions, pacing, breathing, and physical interactions with the environment.
   - Varied Sentence Cadence: Blend short, staccato sentences during high-tension moments with flowing, rhythmic clauses during reflective beats. Avoid monotonous sentence lengths.
   - No Echoes or Prose Monotony: Do not reuse prominent descriptive words, verbs, or sensory adjectives within any three-sentence window.

2. Entity Tagging & Clean Manuscript Rule:
   - Use entity tags (@[Name]) ONLY in metadata, system summaries, scene outlines, or hidden system context.
   - NEVER use entity tags (@[Name] or any bracketed labels) in reader-facing manuscript prose, dialogue, or narrative body.
   - All written story text and manuscript excerpts must be clean, natural, and publication-ready prose.

3. Project Overview:
   - Title: ${projectMeta?.title || 'Ocean Novel'}
   - Genre: ${projectMeta?.genre || 'Fiction'}
   - Target Manuscript Word Count: ${projectMeta?.wordGoal ? Number(projectMeta.wordGoal).toLocaleString() : '80,000'} words
${fullBibleBlock ? `
4. Story Bible (canon — treat as ground truth; never contradict it):

${fullBibleBlock}
` : ''}${castAndAtlas ? `
${fullBibleBlock ? '5' : '4'}. Cast & World Atlas:

${castAndAtlas}
` : ''}
${fullBibleBlock || castAndAtlas
  ? 'Acknowledge that you understand these standards and this canon in two sentences, then wait for my first scene request.'
  : 'Acknowledge that you understand these standards, and ask me for the Story Bible parameters (Characters, Locations, and Plot Event) to begin.'}`;
  }, [projectMeta, fullBibleBlock, castAndAtlas]);

  // 3. Polish & Consistency Prompt
  const generatedPolishPrompt = useMemo(() => {
    const textSnippet = activeSceneContent && activeSceneContent.trim().length > 0 
      ? activeSceneContent.trim()
      : '[PASTE YOUR DRAFT SCENE TEXT HERE]';

    return `Act as the Senior Editorial Engine for Ocean Novel. Analyze and critique the following manuscript excerpt across four rigorous axes:

1. Character Voice & Behavioral Consistency:
   - Does any action, decision, or line of dialogue feel unnatural or contradictory to the established traits and motivations?
   - Are power dynamics and subtext preserved throughout the interaction?

2. Physical & Spatial Logic:
   - Flag any continuity discrepancies regarding character positioning, movement, held objects, lighting, or chronological pacing within the space.

3. Repetitive Echoes & Word Overuse:
   - Highlight any redundant verbs, sensory words, or conceptual "echoes" repeated in proximity. Provide tighter, more vivid alternatives.

4. Stylistic Tightening:
   - Pinpoint filter words (e.g., "she saw," "he felt," "she heard"), weak adverbs, and passive constructions that can be revised into active, immersive prose.
${sceneCanonBlock ? `
5. Canon Compliance:
   - Flag any line that breaks the POV, tone, world rules or style defined in the Story Bible canon below, and suggest a fix.
${sceneCanonBlock}` : ''}
[MANUSCRIPT EXCERPT]
${textSnippet}`;
  }, [activeSceneContent, sceneCanonBlock]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#FCFAF5] border border-[#D49A89]/50 rounded-sm shadow-[0_20px_50px_rgba(25,10,5,0.35)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#F6F0E7] border-b border-[#E5E0D5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#8C503C]/10 flex items-center justify-center text-[#8C503C]">
              <Feather className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold text-[#4A3225]">
                  Ocean Novel AI Prompt Hub
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#8C503C] text-white">
                  Premium Edition
                </span>
              </div>
              <p className="text-xs text-stone-500 font-serif mt-0.5">
                Generate prompt ➔ Copy to ChatGPT/Gemini/Claude ➔ Paste back into Writing Studio to check consistency.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-[#E5E0D5] rounded-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Banner */}
        <div className="px-6 py-2.5 bg-[#FAF7F0] border-b border-[#E5E0D5] flex items-center justify-between text-xs text-stone-600 font-serif">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold text-[#8C503C]">
              <span className="w-4 h-4 rounded-full bg-[#8C503C] text-white flex items-center justify-center text-[10px]">1</span>
              Configure & Copy
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
            <span className="flex items-center gap-1.5 font-medium text-stone-600">
              <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px]">2</span>
              Generate in ChatGPT / Gemini
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
            <span className="flex items-center gap-1.5 font-medium text-stone-600">
              <span className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px]">3</span>
              Paste in Writing Studio
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="https://chatgpt.com" 
              target="_blank" 
              rel="noreferrer"
              className="text-[11px] text-[#8C503C] hover:underline flex items-center gap-1 font-sans font-bold"
            >
              Open ChatGPT <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-stone-300">|</span>
            <a 
              href="https://gemini.google.com" 
              target="_blank" 
              rel="noreferrer"
              className="text-[11px] text-[#8C503C] hover:underline flex items-center gap-1 font-sans font-bold"
            >
              Open Gemini <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Prompt Category Tabs */}
        <div className="px-6 pt-3 bg-[#FCFAF5] border-b border-[#E5E0D5] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('scene')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'scene'
                ? 'border-[#8C503C] text-[#8C503C]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Feather className="w-3.5 h-3.5" />
            <span>Scene Drafting Prompt</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'system'
                ? 'border-[#8C503C] text-[#8C503C]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Master System Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('polish')}
            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'polish'
                ? 'border-[#8C503C] text-[#8C503C]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Editorial & Polish Review</span>
          </button>

          {/* Story Bible context toggle */}
          <label
            className="ml-auto mb-2 flex items-center gap-2 cursor-pointer select-none"
            title={hasBible ? 'Adds your Story Bible (POV, tone, premise, world rules, style) and cast to the prompts' : 'Fill in the Story Bible to add its canon to these prompts'}
          >
            <input
              type="checkbox"
              checked={includeBible && hasBible}
              disabled={!hasBible}
              onChange={(e) => setIncludeBible(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#8C503C] cursor-pointer disabled:cursor-not-allowed"
            />
            <span className={`text-[11px] font-semibold ${hasBible ? 'text-stone-700' : 'text-stone-400'}`}>
              {hasBible ? 'Include Story Bible' : 'Story Bible empty'}
            </span>
          </label>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#FCFAF5]">
          {activeTab === 'scene' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Scene Parameters */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-[#E5E0D5] rounded-sm p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#8C503C]">
                      Target Scene
                    </label>
                    <span className="text-[11px] text-stone-400 font-serif italic">From Manuscript</span>
                  </div>
                  <div className="p-2 bg-[#FAF7F0] border border-[#E5E0D5] rounded-sm text-xs font-bold text-[#4A3225]">
                    {activeSceneTitle || 'Active Manuscript Scene'}
                  </div>

                  {/* Character Selector */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1.5">
                      Characters In This Scene ({selectedCharIds.length})
                    </label>
                    <div className="max-h-32 overflow-y-auto p-2 border border-[#E5E0D5] rounded-sm bg-[#FCFAF5] space-y-1.5 custom-scrollbar">
                      {characters.map(char => {
                        const isChecked = selectedCharIds.includes(String(char.id));
                        return (
                          <label key={`pm-char-${char.id}`} className="flex items-center gap-2 text-xs font-serif text-stone-700 cursor-pointer select-none hover:text-[#8C503C]">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedCharIds(prev => prev.filter(id => id !== String(char.id)));
                                } else {
                                  setSelectedCharIds(prev => [...prev, String(char.id)]);
                                }
                              }}
                              className="rounded-xs border-stone-300 text-[#8C503C] focus:ring-[#8C503C]"
                            />
                            <span className="font-bold">@{char.name}</span>
                            <span className="text-[10px] text-stone-400">({char.role || 'Character'})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location Selector */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1.5">
                      Location Setting
                    </label>
                    <select
                      value={selectedLocId}
                      onChange={(e) => setSelectedLocId(e.target.value)}
                      className="w-full bg-[#FCFAF5] border border-[#E5E0D5] rounded-sm p-2 text-xs text-[#4A3225] font-serif focus:outline-none focus:border-[#8C503C]"
                    >
                      <option value="">-- No specific location --</option>
                      {locations.map(loc => (
                        <option key={`pm-loc-${loc.id}`} value={String(loc.id)}>
                          @{loc.name} ({loc.type || 'Location'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tone & Word Count */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                        Length (Words)
                      </label>
                      <input
                        type="text"
                        value={targetWordCount}
                        onChange={(e) => setTargetWordCount(e.target.value)}
                        placeholder="900 - 1300"
                        className="w-full bg-[#FCFAF5] border border-[#E5E0D5] rounded-sm p-1.5 text-xs text-[#4A3225] font-serif focus:outline-none focus:border-[#8C503C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                        Tone / Atmosphere
                      </label>
                      <input
                        type="text"
                        value={sceneTone}
                        onChange={(e) => setSceneTone(e.target.value)}
                        placeholder="Atmospheric, tense..."
                        className="w-full bg-[#FCFAF5] border border-[#E5E0D5] rounded-sm p-1.5 text-xs text-[#4A3225] font-serif focus:outline-none focus:border-[#8C503C]"
                      />
                    </div>
                  </div>

                  {/* Custom Conflict & Beat */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                      Scene Conflict or Key Revelation (Optional)
                    </label>
                    <textarea
                      value={customConflict}
                      onChange={(e) => setCustomConflict(e.target.value)}
                      placeholder="e.g., Character A discovers the secret missive; Character B attempts to hide their betrayal..."
                      rows={3}
                      className="w-full bg-[#FCFAF5] border border-[#E5E0D5] rounded-sm p-2 text-xs text-[#4A3225] font-serif placeholder:text-stone-400 focus:outline-none focus:border-[#8C503C] resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Generated Prompt Preview & Copy */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#4A3225]">
                    Generated Prompt Output
                  </span>
                  <button
                    onClick={() => handleCopy(generatedScenePrompt, 'scene-prompt')}
                    className="px-4 py-2 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold rounded-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    {copiedKey === 'scene-prompt' ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-300" /> Copied to Clipboard!</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy Prompt for AI</>
                    )}
                  </button>
                </div>

                <div className="relative flex-1 bg-white border border-[#E5E0D5] rounded-sm shadow-inner p-4 font-mono text-[11px] text-[#2C1D14] leading-relaxed overflow-y-auto max-h-[460px] custom-scrollbar select-text whitespace-pre-wrap">
                  {generatedScenePrompt}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-sm p-3 flex items-start gap-2.5 text-xs text-amber-900 font-serif">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  Send this prompt at the very beginning of a new conversation with ChatGPT, Claude, or Gemini. It sets up literary prose standards and instructs the AI to reserve entity tags (<code className="font-mono bg-amber-100 px-1 rounded-xs">@[Name]</code>) exclusively for metadata/context, keeping manuscript prose completely natural and clean.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#4A3225]">
                  Master System Prompt
                </span>
                <button
                  onClick={() => handleCopy(generatedSystemPrompt, 'system-prompt')}
                  className="px-4 py-2 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold rounded-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  {copiedKey === 'system-prompt' ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy Master System Prompt</>
                  )}
                </button>
              </div>

              <div className="bg-white border border-[#E5E0D5] rounded-sm shadow-inner p-4 font-mono text-xs text-[#2C1D14] leading-relaxed overflow-y-auto max-h-[440px] custom-scrollbar select-text whitespace-pre-wrap">
                {generatedSystemPrompt}
              </div>
            </div>
          )}

          {activeTab === 'polish' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-sm p-3 flex items-start gap-2.5 text-xs text-blue-900 font-serif">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p>
                  This prompt automatically packages your current active scene text and commands the AI to perform a multi-axis editorial audit (Character voice, spatial logic, repetitive echoes, and styling).
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#4A3225]">
                  Editorial Audit & Consistency Prompt
                </span>
                <button
                  onClick={() => handleCopy(generatedPolishPrompt, 'polish-prompt')}
                  className="px-4 py-2 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold rounded-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  {copiedKey === 'polish-prompt' ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-300" /> Copied Review Prompt!</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy Review Prompt</>
                  )}
                </button>
              </div>

              <div className="bg-white border border-[#E5E0D5] rounded-sm shadow-inner p-4 font-mono text-xs text-[#2C1D14] leading-relaxed overflow-y-auto max-h-[440px] custom-scrollbar select-text whitespace-pre-wrap">
                {generatedPolishPrompt}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#F6F0E7] border-t border-[#E5E0D5] flex items-center justify-between shrink-0">
          <div className="text-[11px] font-serif text-stone-500 italic">
            Tip: Paste generated text back into Writing Studio to view live character mentions and run the Consistency Checker.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-[#4A3225] hover:bg-[#E5E0D5] rounded-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/license";
import UpgradeModal from "@/components/UpgradeModal";
import {
  BookCover,
  BookMockup,
  COVER_ARTWORKS,
  COVER_PALETTES,
  IconArrow,
  IconBookWave,
  IconClose,
  IconQuill,
  IconTick,
  Tag,
  coverTheme,
} from "@/components/brand/ocean-ui";

interface GenreTheme {
  name: string;
  tagline: string;
  // Default cover (index into COVER_PALETTES / COVER_ARTWORKS) until the author picks one
  palette: number;
  artwork: number;
}

const GENRE_THEMES: Record<string, GenreTheme> = {
  "High & Epic Fantasy": {
    name: "High & Epic Fantasy",
    tagline: "Ancient dynastic oaths, world-shattering magic & forgotten empires",
    palette: 0,
    artwork: 0,
  },
  "Dark Fantasy & Grimdark": {
    name: "Dark Fantasy & Grimdark",
    tagline: "Forbidden blood sorcery, cursed relics & unforgiving realms",
    palette: 2,
    artwork: 2,
  },
  "Gothic & Coastal Fantasy": {
    name: "Gothic & Coastal Fantasy",
    tagline: "Salt-stained codices, drowned archives & mist-bound archipelagoes",
    palette: 0,
    artwork: 1,
  },
  "Mythic & Folklore Fantasy": {
    name: "Mythic & Folklore Fantasy",
    tagline: "Primeval pantheons, world trees & ancestral folklore",
    palette: 4,
    artwork: 0,
  },
  "Arcane & Gaslamp Fantasy": {
    name: "Arcane & Gaslamp Fantasy",
    tagline: "Alchemical colleges, secret mage guilds & clockwork mysteries",
    palette: 3,
    artwork: 1,
  },
  "Sword & Sorcery": {
    name: "Sword & Sorcery",
    tagline: "Heroic wanderers, forbidden catacombs & daring escapades",
    palette: 2,
    artwork: 0,
  },
};

const GENRES = Object.keys(GENRE_THEMES);
const AUDIENCES = ["Middle Grade", "Young Adult (YA)", "New Adult", "Adult"];

const NEW_MANUSCRIPT_ARCHITECT_PROMPT = `I want you to help me prepare the information needed to create a new novel project.

First, ask me to provide my NOVEL IDEA. You may also ask me for an Author / Pen Name if I have one. If I do not provide one, leave that field blank.

After I provide my novel idea, analyze it and generate ONLY the following information:

1. Manuscript Title
Create a suitable and memorable novel title based on my story idea.

2. Author / Pen Name
Keep exactly the Author / Pen Name I provide. If I do not provide one, leave it blank. Do not invent an author name.

3. Word Count Target
Recommend a reasonable total word count based on the story concept, genre, and target audience.

4. Logline / Central Premise
Write a concise 35–70 word premise describing the main story hook, central conflict, and stakes.

5. Primary Fantasy Sub-genre
Choose exactly ONE:
- High & Epic Fantasy
- Dark Fantasy & Grimdark
- Gothic & Coastal Fantasy
- Mythic & Folklore Fantasy
- Arcane & Gaslamp Fantasy
- Sword & Sorcery

6. Target Audience
Choose exactly ONE:
- Middle Grade
- Young Adult (YA)
- New Adult
- Adult

7. Cover Colour
Choose exactly ONE:
- Ivory
- Midnight
- Ember
- Sandstone
- Saffron

Do not generate characters, locations, worldbuilding, chapter outlines, scenes, or additional story content.

After I provide my novel idea, return the result in this format:

Manuscript Title: ...
Author / Pen Name: ...
Word Count Target: ...
Logline / Central Premise: ...
Primary Genre: ...
Target Audience: ...
Cover Colour: ...`;

export default function CreateProject() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [audience, setAudience] = useState(AUDIENCES[1]);
  const [wordCount, setWordCount] = useState<number | string>(80000);
  const [palette, setPalette] = useState(GENRE_THEMES[GENRES[0]].palette);
  const [artwork, setArtwork] = useState(GENRE_THEMES[GENRES[0]].artwork);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // License check
  const profile = storage.getUserProfile();
  const existingProjects = storage.getProjects();
  const maxProjects = PLAN_LIMITS[profile?.plan || "free"].maxProjects;

  const handleCopyArchitectPrompt = async () => {
    try {
      await navigator.clipboard.writeText(NEW_MANUSCRIPT_ARCHITECT_PROMPT);
      setIsPromptCopied(true);
      setTimeout(() => setIsPromptCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = NEW_MANUSCRIPT_ARCHITECT_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setIsPromptCopied(true);
      setTimeout(() => setIsPromptCopied(false), 2500);
    }
  };

  const currentTheme = GENRE_THEMES[genre] || GENRE_THEMES[GENRES[0]];
  const theme = coverTheme(palette, artwork);

  // Genre suggests a cover until the author chooses one themselves
  const userChangedCoverRef = useRef(false);

  const handleGenreChange = (newGenre: string) => {
    setGenre(newGenre);
    if (!userChangedCoverRef.current) {
      const t = GENRE_THEMES[newGenre];
      if (t) {
        setPalette(t.palette);
        setArtwork(t.artwork);
      }
    }
  };

  const handleCreate = () => {
    if (existingProjects.length >= maxProjects) {
      setShowUpgradeModal(true);
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const newId = Date.now().toString();

      // Save project meta
      storage.saveProject({
        id: newId,
        title: title || "Whispers of the Astral Spire",
        author: author || "Unknown Chronicler",
        genre,
        audience,
        logline,
        wordGoal: wordCount ? Number(wordCount) : 50000,
        currentWords: 0,
        lastModified: Date.now(),
        themeColor: theme,
      });

      // Save initial project data with rich prologue structure
      storage.saveProjectData(newId, {
        manuscript: [
          {
            id: "part-1",
            type: "part",
            title: "Part I: The Inscription",
            children: [
              {
                id: "chap-1",
                type: "chapter",
                title: "Chapter 1: The First Omen",
                children: [
                  {
                    id: "scene-1",
                    type: "scene",
                    title: "Scene 1",
                    content: `<h1>Chapter 1: The First Omen</h1><p>The night air carried the chill of ancient stone and the metallic scent of pending lightning. Before ${title || "the spire"}, the chronicler paused...</p>`,
                  },
                ],
              },
            ],
          },
        ],
        characters: [],
        locations: [],
        storyBible: {
          title: title || "Whispers of the Astral Spire",
          genre,
          subgenre: genre === "Fantasy" ? "High Fantasy / Epic" : genre,
          targetAudience: audience,
          pov: "Third Person Limited",
          tone: genre === "Fantasy" ? "Mysterious, Epic & Poetic" : "Atmospheric, Immersive",
          premise: logline || "An epic journey unfolds into the unknown.",
          mainConflict: "A forgotten power awakens at the heart of the realm.",
          storyGoal: "Restore balance before the celestial alignments collapse.",
          themes: "Honor, sacrifice, destiny, forbidden knowledge.",
          timePeriod: "Age of Stars",
          primarySetting: "The Spire Observatory",
          worldDescription: "A world carved between luminous constellations and shifting tides.",
          importantRules: "Celestial oaths cannot be broken without heavy spiritual toll.",
          narrativeStyle: "Evocative, atmospheric prose with rich sensory imagery.",
          dialogueStyle: "Subtle, nuanced with resonant emotional subtext.",
          pacing: "Measured build-up leading to breathtaking climaxes.",
          aiInstructions: "Embody the chosen genre aesthetic faithfully. Enrich dialogue with psychological depth.",
        },
      });

      navigate(`/project/${newId}/workspace/studio`);
    }, 400);
  };

  const labelCls = "block pl-1 mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1D26]/55";
  const inputCls =
    "w-full h-[46px] px-5 bg-white border border-[#E4DAC8] rounded-full text-[15px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 outline-none transition focus:border-[#E8561F] focus:ring-4 focus:ring-[#E8561F]/12";
  const pill = (active: boolean) =>
    cn(
      "px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer",
      active ? "bg-[#0E1D26] border-[#0E1D26] text-[#F6F1E7]" : "bg-white border-[#E4DAC8] text-[#0E1D26]/70 hover:border-[#0E1D26]/40"
    );
  const atQuota = existingProjects.length >= maxProjects;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 min-h-0 h-full w-full overflow-y-auto custom-scrollbar bg-[#F6F1E7] font-['Outfit'] text-[#0E1D26] selection:bg-[#E8561F] selection:text-white"
    >
      <div className="min-h-full flex flex-col lg:flex-row">
        {/* ================= LEFT: LIVE COVER PREVIEW ================= */}
        <aside className="relative overflow-hidden bg-[#0E1D26] text-[#F6F1E7] lg:w-[44%] lg:sticky lg:top-0 lg:h-screen flex flex-col">
          <div className="absolute -left-20 -bottom-28 w-[300px] h-[380px] rounded-t-full bg-[#F0B54B] rotate-[18deg]" aria-hidden="true" />
          <div className="absolute right-10 top-24 w-[120px] h-[120px] rounded-full border-[18px] border-[#E8561F]/85 hidden sm:block" aria-hidden="true" />

          <div className="relative z-10 px-6 sm:px-10 pt-6 flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard")}
              className="group h-10 pl-1 pr-4 rounded-full border border-[#F6F1E7]/25 hover:border-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-[#F6F1E7]/10 flex items-center justify-center">
                <IconArrow className="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
              </span>
              Dashboard
            </button>
            <div className="flex items-center gap-2">
              <IconBookWave className="w-6 h-6 text-[#F0B54B]" />
              <span className="text-[15px] font-bold tracking-tight">Ocean Novel</span>
            </div>
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0">
            <BookMockup
              title={title || "Whispers of the Astral Spire"}
              subtitle={author || "Author Pen Name"}
              genre={genre}
              seed="new-book"
              theme={theme}
              className="w-[200px] h-[264px] sm:w-[230px] sm:h-[304px]"
              titleClassName={(title || "Whispers of the Astral Spire").length > 24 ? "text-[22px]" : "text-[28px]"}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={genre}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mt-12 text-center max-w-[340px]"
              >
                <Tag tone="light">{genre}</Tag>
                <p className="mt-3 text-[15px] leading-relaxed text-[#F6F1E7]/70">{currentTheme.tagline}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>

        {/* ================= RIGHT: FORM ================= */}
        <main className="flex-1 px-6 sm:px-10 lg:px-14 py-8 lg:py-4 flex justify-center lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[600px]"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <Tag>New Book</Tag>
                <h1 className="mt-3 text-[34px] sm:text-[40px] font-extrabold leading-none tracking-[-0.02em]">
                  Start a new <span className="text-[#E8561F]">Story.</span>
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="shrink-0 h-10 px-4 rounded-full bg-white border border-[#E4DAC8] hover:border-[#E8561F] text-[12px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                title="Manuscript Setup Guide & AI Prompt"
              >
                <IconQuill className="w-4 h-4 text-[#E8561F]" />
                <span className="hidden sm:inline">Guide & AI prompt</span>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelCls}>Manuscript title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Whispers of the Astral Spire"
                  className={cn(inputCls, "h-[50px] text-[17px] font-semibold")}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Author / pen name</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your writer name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Word count target</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={wordCount}
                      onChange={(e) => setWordCount(e.target.value ? Number(e.target.value) : "")}
                      step={5000}
                      className={cn(inputCls, "pr-20 font-semibold tabular-nums")}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[12px] text-[#0E1D26]/45">words</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Logline / central premise</label>
                <textarea
                  value={logline}
                  onChange={(e) => setLogline(e.target.value)}
                  placeholder="In one or two sentences — the core conflict and the mystery of your story."
                  rows={2}
                  className="w-full px-5 py-3 bg-white border border-[#E4DAC8] rounded-[26px] text-[14px] leading-relaxed placeholder:text-[#0E1D26]/35 outline-none resize-none transition focus:border-[#E8561F] focus:ring-4 focus:ring-[#E8561F]/12"
                />
              </div>

              <div>
                <label className={labelCls}>Primary genre</label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button key={g} type="button" onClick={() => handleGenreChange(g)} className={pill(genre === g)}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Target audience</label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <button key={a} type="button" onClick={() => setAudience(a)} className={pill(audience === a)}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Cover colour · <span className="text-[#E8561F]">{COVER_PALETTES[palette].name}</span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    {COVER_PALETTES.map((p, i) => (
                      <button
                        key={p.name}
                        type="button"
                        title={p.name}
                        onClick={() => {
                          userChangedCoverRef.current = true;
                          setPalette(i);
                        }}
                        className={cn(
                          "relative w-9 h-9 rounded-full overflow-hidden transition-transform cursor-pointer",
                          palette === i ? "ring-2 ring-[#E8561F] ring-offset-2 ring-offset-[#F6F1E7] scale-110" : "hover:scale-105 ring-1 ring-[#0E1D26]/15"
                        )}
                        style={{ background: p.bg }}
                      >
                        <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full" style={{ background: p.a }} />
                        <span className="absolute left-1.5 top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: p.b }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    Cover art · <span className="text-[#E8561F]">{COVER_ARTWORKS[artwork]}</span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    {COVER_ARTWORKS.map((name, i) => (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        onClick={() => {
                          userChangedCoverRef.current = true;
                          setArtwork(i);
                        }}
                        className={cn(
                          "rounded-[5px] transition-transform cursor-pointer",
                          artwork === i ? "ring-2 ring-[#E8561F] ring-offset-2 ring-offset-[#F6F1E7] scale-105" : "hover:scale-105 opacity-80 hover:opacity-100"
                        )}
                      >
                        <BookCover title="" seed="thumb" theme={coverTheme(palette, i)} className="w-9 h-12" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSubmitting || !title.trim()}
                  className="group w-full h-[54px] pl-7 pr-2 bg-[#E8561F] hover:bg-[#D44B17] text-white rounded-full text-[16px] font-bold flex items-center justify-between shadow-[0_14px_30px_-14px_rgba(232,86,31,0.9)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? "Creating your book…" : "Create & Start Writing"}</span>
                  <span className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <IconArrow className="w-5 h-5" />
                  </span>
                </button>
                <p className="mt-2 text-center text-[12px] text-[#0E1D26]/50">
                  {!title.trim()
                    ? "Add a title to create your book."
                    : atQuota
                      ? `Your plan allows ${maxProjects} books — upgrade to add more.`
                      : "Opens the Writing Studio with Chapter 1 ready."}
                </p>
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      {/* ================= GUIDE & AI PROMPT MODAL ================= */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-['Outfit']">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpOpen(false)}
              className="fixed inset-0 bg-[#0E1D26]/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-[#F6F1E7] rounded-[28px] shadow-2xl overflow-hidden flex flex-col text-[#0E1D26]"
            >
              <div className="relative overflow-hidden bg-[#0E1D26] text-[#F6F1E7] px-7 py-6">
                <div className="absolute -right-10 -top-16 w-40 h-40 rounded-full bg-[#E8561F]" aria-hidden="true" />
                <div className="relative">
                  <Tag tone="light">Setup Guide</Tag>
                  <h2 className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.02em]">
                    Set up your <span className="text-[#E8561F]">book.</span>
                  </h2>
                  <p className="mt-2 text-[13px] text-[#F6F1E7]/60">What each field means, plus a prompt to fill them in with AI.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="absolute right-5 top-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="p-7 overflow-y-auto custom-scrollbar space-y-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ["Manuscript title", "A memorable working title (2–7 words), shown on your cover, spine and studio."],
                    ["Author / pen name", "The byline on your cover and title page — your real name or a pen name."],
                    ["Genre & audience", "The primary sub-genre and reading age (Middle Grade, YA, New Adult, Adult)."],
                    ["Logline & word target", "A 1–2 sentence premise hook (35–70 words) and your total word-count goal."],
                  ].map(([h, d], i) => (
                    <div key={h} className="p-4 rounded-2xl bg-white border border-[#E4DAC8]">
                      <p className="text-[14px] font-bold">
                        <span className="text-[#E8561F]">{i + 1}.</span> {h}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#0E1D26]/60">{d}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-bold">Not sure what to write?</p>
                      <p className="mt-0.5 text-[13px] text-[#0E1D26]/60">
                        Send this prompt to ChatGPT, Claude or Gemini with your raw idea.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyArchitectPrompt}
                      className={cn(
                        "h-10 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer",
                        isPromptCopied ? "bg-[#0E1D26] text-[#F0B54B]" : "bg-[#E8561F] hover:bg-[#D44B17] text-white"
                      )}
                    >
                      {isPromptCopied ? <IconTick className="w-4 h-4" /> : <IconQuill className="w-4 h-4" />}
                      {isPromptCopied ? "Prompt copied" : "Copy prompt"}
                    </button>
                  </div>
                  <pre className="mt-4 p-5 rounded-2xl bg-[#0E1D26] text-[#F6F1E7]/85 text-[12px] font-mono leading-relaxed max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap select-all">
                    {NEW_MANUSCRIPT_ARCHITECT_PROMPT}
                  </pre>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#0E1D26]/60">
                    <strong className="text-[#0E1D26]">Tip:</strong> paste the AI's title, logline, genre and word target into the form, then press{" "}
                    <em>Create & Start Writing</em>.
                  </p>
                </div>
              </div>

              <div className="px-7 py-4 border-t border-[#E4DAC8] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="h-10 px-5 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-bold cursor-pointer"
                >
                  Back to the form
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="projects"
        currentCount={existingProjects.length}
        maxLimit={maxProjects}
      />
    </motion.div>
  );
}

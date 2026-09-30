import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { storage, StoryBibleData } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { IconTick } from "@/components/brand/ocean-ui";

type Field = { key: keyof StoryBibleData; label: string; multiline?: boolean; rows?: number; hint?: string };

const TABS: Array<{ id: string; label: string; fields: Field[]; grid?: boolean }> = [
  {
    id: "details",
    label: "Book Details",
    grid: true,
    fields: [
      { key: "title", label: "Book title" },
      { key: "genre", label: "Genre" },
      { key: "subgenre", label: "Subgenre" },
      { key: "targetAudience", label: "Target audience" },
      { key: "pov", label: "Narrative POV" },
      { key: "tone", label: "Tone & mood" },
    ],
  },
  {
    id: "core",
    label: "Story Core",
    fields: [
      { key: "premise", label: "Premise / logline", multiline: true, rows: 3 },
      { key: "mainConflict", label: "Main conflict", multiline: true, rows: 3 },
      { key: "storyGoal", label: "Story goal" },
      { key: "themes", label: "Key themes" },
    ],
  },
  {
    id: "world",
    label: "World & Rules",
    fields: [
      { key: "timePeriod", label: "Time period" },
      { key: "primarySetting", label: "Primary setting" },
      { key: "worldDescription", label: "World description", multiline: true, rows: 4 },
      { key: "importantRules", label: "Important lore & rules", multiline: true, rows: 3 },
    ],
  },
  {
    id: "style",
    label: "Writing Style",
    fields: [
      { key: "narrativeStyle", label: "Narrative style", multiline: true, rows: 3 },
      { key: "dialogueStyle", label: "Dialogue conventions", multiline: true, rows: 3 },
      { key: "pacing", label: "Pacing direction" },
      { key: "aiInstructions", label: "Writing tone & rules", multiline: true, rows: 4 },
    ],
  },
];

export default function StoryBible() {
  const { id = "1" } = useParams();
  const [activeTab, setActiveTab] = useState("details");
  const [justSaved, setJustSaved] = useState(false);

  const getInitialBible = (projId: string): StoryBibleData => {
    const project = storage.getProjects().find((p) => p.id === projId);
    const data = storage.getProjectData(projId);
    const bible = data?.storyBible;

    return {
      title: bible?.title ?? (project?.title || "Untitled Project"),
      genre: bible?.genre ?? (project?.genre || "Fantasy"),
      subgenre: bible?.subgenre ?? "High Fantasy / Epic",
      targetAudience: bible?.targetAudience ?? (project?.audience || "Adult"),
      pov: bible?.pov ?? "Third Person Limited",
      tone: bible?.tone ?? "Epic, Immersive",
      premise: bible?.premise ?? (project?.logline || "An epic journey unfolds."),
      mainConflict: bible?.mainConflict ?? (project?.logline || "The realm faces a looming catastrophe that threatens the fragile peace."),
      storyGoal: bible?.storyGoal ?? "Protect the realm and restore balance.",
      themes: bible?.themes ?? "Honor, sacrifice, destiny, legacy.",
      timePeriod: bible?.timePeriod ?? "Age of Wonders",
      primarySetting: bible?.primarySetting ?? "The Realm Capital",
      worldDescription: bible?.worldDescription ?? "A sweeping world of ancient sanctuaries, towering peaks, and hidden kingdoms.",
      importantRules: bible?.importantRules ?? "Ancient oaths bind the realm; forbidden magics exact a heavy toll on their wielders.",
      narrativeStyle: bible?.narrativeStyle ?? "Atmospheric, evocative narrative pacing with rich sensory imagery.",
      dialogueStyle: bible?.dialogueStyle ?? "Nuanced, character-driven with subtle subtext.",
      pacing: bible?.pacing ?? "Measured build-up leading to high-stakes climaxes.",
      aiInstructions: bible?.aiInstructions ?? "Maintain consistent world lore, character motivations, and thematic resonance.",
    };
  };

  // Initialize data from storage or default
  const [form, setForm] = useState<StoryBibleData>(() => getInitialBible(id));
  // Last saved snapshot, to show which fields/tabs have unsaved edits
  const [saved, setSaved] = useState<StoryBibleData>(() => getInitialBible(id));

  // Keep form in sync when project ID in URL changes
  useEffect(() => {
    const initial = getInitialBible(id);
    setForm(initial);
    setSaved(initial);
  }, [id]);

  const handleChange = (field: keyof StoryBibleData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isDirtyField = (key: keyof StoryBibleData) => (form[key] ?? "") !== (saved[key] ?? "");
  const isDirty = TABS.some((t) => t.fields.some((f) => isDirtyField(f.key)));

  const handleSave = () => {
    // Save to ProjectData
    storage.saveProjectData(id, {
      storyBible: form,
    });

    // Also update title & genre in ProjectMeta if changed
    const projects = storage.getProjects();
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      if (form.title && form.title !== proj.title) {
        proj.title = form.title;
      }
      if (form.genre && form.genre !== proj.genre) {
        proj.genre = form.genre;
      }
      if (form.premise && form.premise !== proj.logline) {
        proj.logline = form.premise;
      }
      storage.saveProject(proj);
    }

    setSaved(form);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  // ⌘S / Ctrl+S saves without leaving the keyboard
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
  const fieldCls =
    "w-full bg-white border border-[#E9E2D4] rounded-2xl px-4 text-[15px] leading-relaxed text-[#0E1D26] placeholder:text-[#0E1D26]/30 outline-none transition focus:border-[#0E1D26]/35 focus:ring-4 focus:ring-[#0E1D26]/[0.04]";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F8F5EE] text-[#0E1D26] font-['Outfit']">
      <div className="max-w-[760px] mx-auto px-6 lg:px-10 py-8 lg:py-12">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">World canon</p>
            <h1 className="mt-2 text-[34px] lg:text-[40px] font-extrabold leading-none tracking-[-0.02em]">Story Bible</h1>
            <p className="mt-2 text-[14px] text-[#0E1D26]/55">The foundation, atmosphere and rules of your book.</p>
          </div>

          <button
            onClick={handleSave}
            disabled={!isDirty && !justSaved}
            title="Save (Ctrl/⌘ + S)"
            className={cn(
              "shrink-0 h-11 px-5 rounded-full text-[13px] font-bold flex items-center gap-2 transition-colors",
              isDirty
                ? "bg-[#E8561F] hover:bg-[#D44B17] text-white cursor-pointer"
                : "bg-white border border-[#E9E2D4] text-[#0E1D26]/45 cursor-default"
            )}
          >
            {isDirty ? (
              "Save changes"
            ) : (
              <>
                <IconTick className="w-4 h-4" />
                {justSaved ? "Saved" : "All saved"}
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 p-1 rounded-full bg-[#EFE9DE] w-fit max-w-full overflow-x-auto">
          {TABS.map((t) => {
            const dirty = t.fields.some((f) => isDirtyField(f.key));
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "relative px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  activeTab === t.id ? "bg-white text-[#0E1D26] shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
                )}
              >
                {t.label}
                {dirty && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#E8561F]" title="Unsaved changes" />}
              </button>
            );
          })}
        </div>

        {/* Fields */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className={cn("mt-6 gap-x-5 gap-y-5", tab.grid ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col")}
          >
            {tab.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="flex items-center gap-2 pl-1 mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/50">
                  {f.label}
                  {isDirtyField(f.key) && <span className="w-1.5 h-1.5 rounded-full bg-[#E8561F]" />}
                </span>
                {f.multiline ? (
                  <textarea
                    rows={f.rows || 3}
                    value={form[f.key] || ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className={cn(fieldCls, "py-3 resize-y min-h-[88px]")}
                  />
                ) : (
                  <input
                    type="text"
                    value={form[f.key] || ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className={cn(fieldCls, "h-12")}
                  />
                )}
              </label>
            ))}
          </motion.div>
        </AnimatePresence>

        <p className="mt-8 text-[12px] text-[#0E1D26]/40">
          Title, genre and premise also update the book's cover and overview when you save.
        </p>
      </div>
    </div>
  );
}

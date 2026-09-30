import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

import { storage, type StudioTask } from "@/lib/storage";
import { ExportModal } from "@/components/ExportModal";
import { fileToOptimizedDataUrl } from "@/lib/imageUtils";
import {
  BookCover,
  IconArrow,
  IconClose,
  IconDownload,
  IconImage,
  IconSpinner,
  IconTick,
  IconTrash,
} from "@/components/brand/ocean-ui";

// Placeholder the app used before generated covers existed — treat it as "no custom cover"
const LEGACY_DEFAULT_COVER =
  "https://res.cloudinary.com/mekoxs1q/image/upload/v1788788313/7e1e3f9e-023d-4556-a04c-e0d633ba4cea_rcjcwh.png";

export default function ProjectOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedProject = id ? storage.getProjects().find((p) => p.id === id) : null;
  const projectData = id ? storage.getProjectData(id) : null;

  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [coverUrl, setCoverUrl] = useState(savedProject?.coverUrl || "");

  useEffect(() => {
    if (savedProject?.coverUrl) {
      setCoverUrl(savedProject.coverUrl);
    }
  }, [savedProject?.coverUrl]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && id) {
      try {
        // Optimize cover image to max 480x720, 75% JPEG quality to save localStorage quota
        const optimizedUrl = await fileToOptimizedDataUrl(file, 480, 720, 0.75);
        setCoverUrl(optimizedUrl);
        storage.updateProject(id, { coverUrl: optimizedUrl });
      } catch (err) {
        console.error("Failed to process cover image:", err);
      }
    }
  };

  // Real chapter and live word count calculation
  const countChapters = (items: any[] = []): number => {
    let count = 0;
    for (const item of items) {
      if (item.type === "chapter") count++;
      if (item.children) count += countChapters(item.children);
    }
    return count;
  };

  const countScenes = (items: any[] = []): number => {
    let count = 0;
    for (const item of items) {
      if (item.type === "scene") count++;
      if (item.children) count += countScenes(item.children);
    }
    return count;
  };

  const countWords = (items: any[] = []): number => {
    let words = 0;
    for (const item of items) {
      if (item.type === "scene" && item.content) {
        const text = item.content.replace(/<[^>]*>/g, " ").trim();
        if (text) {
          words += text.split(/\s+/).filter(Boolean).length;
        }
      }
      if (item.children) words += countWords(item.children);
    }
    return words;
  };

  const actualChaptersCount = countChapters(projectData?.manuscript || []);
  const scenesCount = countScenes(projectData?.manuscript || []);
  const liveWords = projectData?.manuscript ? countWords(projectData.manuscript) : savedProject?.currentWords || 0;
  const totalWords = Math.max(liveWords, savedProject?.currentWords || 0);
  const targetWords = savedProject?.wordGoal || 50000;
  const wordPct = Math.min(100, Math.round((totalWords / targetWords) * 100));

  const displayTitle = savedProject?.title || "Untitled";
  const displayGenre = savedProject?.genre || "Fiction";
  const hasCustomCover = !!coverUrl && coverUrl !== LEGACY_DEFAULT_COVER;

  // Plot events count
  const plotEvents = projectData?.plotEvents || [];
  const plannedEventsCount = plotEvents.length;
  const completedEventsCount = plotEvents.filter((e: any) => e.completed || e.status === "completed").length;
  const plotProgressPct =
    plannedEventsCount > 0 ? Math.min(100, Math.round((completedEventsCount / plannedEventsCount) * 100)) : wordPct;

  // Same velocity the Dashboard stats use (~900 words per hour), so both pages agree
  const draftingTime = `${Math.floor(totalWords / 900)}h ${Math.round((totalWords % 900) / 15)}m`;

  const openStudio = (sceneId?: string) =>
    navigate(`/project/${id || "1"}/workspace/studio${sceneId ? `?scene=${sceneId}` : ""}`);

  // Chapters in manuscript order, with their words and first scene to jump into
  const sceneWords = (html?: string) => {
    const text = (html || "").replace(/<[^>]*>/g, " ").trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  };
  const chapters: Array<{ id: string; title: string; words: number; scenes: number; firstSceneId?: string }> = [];
  const collectChapters = (items: any[] = []) => {
    for (const item of items) {
      if (item.type === "chapter") {
        const scenes: any[] = [];
        const gather = (xs: any[] = []) =>
          xs.forEach((x) => {
            if (x.type === "scene") scenes.push(x);
            if (x.children) gather(x.children);
          });
        gather(item.children);
        chapters.push({
          id: item.id,
          title: item.title || "Untitled chapter",
          words: scenes.reduce((sum, s) => sum + sceneWords(s.content), 0),
          scenes: scenes.length,
          firstSceneId: scenes[0]?.id,
        });
      } else if (item.children) {
        collectChapters(item.children);
      }
    }
  };
  collectChapters(projectData?.manuscript || []);
  const maxChapterWords = Math.max(1, ...chapters.map((c) => c.words));

  // Open tasks for this book (plus untagged ones), most urgent first
  const [tasks, setTasks] = useState<StudioTask[]>(() => storage.getTasks(id));
  const urgencyRank = { high: 0, medium: 1, low: 2 } as const;
  const nextTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.createdAt - a.createdAt)
    .slice(0, 3);
  const completeTask = (task: StudioTask) => {
    storage.saveTask({ ...task, completed: true });
    setTasks(storage.getTasks(id));
  };

  const glance = [
    { label: "Characters", value: projectData?.characters?.length ?? 0, href: `/project/${id}/characters` },
    { label: "Locations", value: projectData?.locations?.length ?? 0, href: `/project/${id}/workspace/locations` },
    { label: "Plot events", value: plannedEventsCount, href: `/project/${id}/workspace/plot` },
    { label: "Scenes", value: scenesCount, href: `/project/${id}/workspace/studio` },
  ];

  return (
    <div className="flex-1 h-full w-full overflow-y-auto custom-scrollbar bg-[#F8F5EE] text-[#0E1D26] font-['Outfit'] selection:bg-[#E8561F] selection:text-white">
      <div className="max-w-[1080px] mx-auto px-6 lg:px-12 py-8 lg:py-12">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 text-[13px]">
          <nav className="flex items-center gap-2 min-w-0 text-[#0E1D26]/45">
            <button onClick={() => navigate("/dashboard")} className="hover:text-[#0E1D26] transition-colors cursor-pointer">
              All books
            </button>
            <span>/</span>
            <span className="text-[#0E1D26]/80 font-medium truncate">{displayTitle}</span>
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowExportModal(true)}
              className="h-9 px-3.5 rounded-full text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.05] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <IconDownload className="w-4 h-4" />
              Export
            </button>
            {savedProject && (
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Delete this book"
                className="w-9 h-9 rounded-full text-[#0E1D26]/40 hover:text-[#C2410C] hover:bg-[#C2410C]/[0.06] flex items-center justify-center transition-colors cursor-pointer"
              >
                <IconTrash className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Book header */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-8 lg:gap-12 items-start"
        >
          {/* Cover */}
          <div className="group relative shrink-0 w-[170px] lg:w-[200px] aspect-[3/4] rounded-r-md rounded-l-sm overflow-hidden shadow-[0_18px_36px_-18px_rgba(14,29,38,0.55)]">
            {hasCustomCover ? (
              <img src={coverUrl} alt={`${displayTitle} cover`} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <BookCover
                title={displayTitle}
                genre={displayGenre}
                seed={savedProject?.id || id || "book"}
                subtitle={savedProject?.author || displayGenre}
                theme={savedProject?.themeColor}
                className="absolute inset-0"
                titleClassName={displayTitle.length > 20 ? "text-[18px]" : "text-[22px]"}
              />
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-x-2 bottom-2 h-9 rounded-full bg-white/90 backdrop-blur text-[12px] font-semibold flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <IconImage className="w-4 h-4" />
              {hasCustomCover ? "Change cover" : "Upload cover"}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          {/* Title, premise, progress */}
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">
              {displayGenre}
              {savedProject?.audience ? ` · ${savedProject.audience}` : ""}
            </p>
            <h1 className="mt-2 text-[36px] lg:text-[44px] font-extrabold leading-[1.02] tracking-[-0.02em] break-words">
              {displayTitle}
            </h1>
            {savedProject?.author && <p className="mt-2 text-[14px] text-[#0E1D26]/55">by {savedProject.author}</p>}
            {savedProject?.logline && (
              <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#0E1D26]/70">{savedProject.logline}</p>
            )}

            <div className="mt-7 max-w-[480px]">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-[#0E1D26]/60">
                  <strong className="text-[#0E1D26] text-[16px]">{totalWords.toLocaleString()}</strong> of{" "}
                  {targetWords.toLocaleString()} words
                </span>
                <span className="font-semibold text-[#0E1D26]/70">{wordPct}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#E6DFD2] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#E8561F]"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, wordPct)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="mt-2 text-[12px] text-[#0E1D26]/45">
                {actualChaptersCount} {actualChaptersCount === 1 ? "chapter" : "chapters"} · about {draftingTime} of writing
              </p>
            </div>

            <button
              onClick={() => openStudio(projectData?.lastActiveSceneId)}
              className="group mt-7 h-12 pl-6 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[14px] font-bold inline-flex items-center gap-3 transition-colors cursor-pointer"
            >
              Continue Writing
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                <IconArrow className="w-4 h-4" />
              </span>
            </button>
            {projectData?.lastActiveSceneTitle && (
              <p className="mt-3 text-[12px] text-[#0E1D26]/45">Last scene: {projectData.lastActiveSceneTitle}</p>
            )}
          </div>
        </motion.section>

        {/* At a glance — one quiet line of links */}
        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#0E1D26]/55">
          {glance.map((g) => (
            <button key={g.label} onClick={() => navigate(g.href)} className="hover:text-[#0E1D26] transition-colors cursor-pointer">
              <strong className="text-[#0E1D26] font-bold">{g.value}</strong> {g.label.toLowerCase()}
            </button>
          ))}
        </div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          {/* Chapters */}
          <div className="lg:col-span-3 rounded-3xl bg-white border border-[#E9E2D4] p-6 flex flex-col">
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Chapters</p>
              <span className="text-[12px] text-[#0E1D26]/40">{chapters.length}</span>
            </div>

            {chapters.length === 0 ? (
              <p className="mt-4 text-[14px] text-[#0E1D26]/55">No chapters yet — start one in the Writing Studio.</p>
            ) : (
              <ol className="mt-3 -mx-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                {chapters.map((c, i) => (
                  <li key={c.id}>
                    <button
                      onClick={() => openStudio(c.firstSceneId)}
                      className="group w-full flex items-center gap-4 px-2 py-2.5 rounded-2xl hover:bg-[#F8F5EE] text-left transition-colors cursor-pointer"
                    >
                      <span className="w-6 text-[12px] font-semibold text-[#0E1D26]/35 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold truncate">{c.title}</span>
                        <span className="mt-1.5 block h-1 rounded-full bg-[#F1ECE2] overflow-hidden">
                          <span
                            className={cn("block h-full rounded-full", c.words > 0 ? "bg-[#0E1D26]/70" : "bg-transparent")}
                            style={{ width: `${Math.round((c.words / maxChapterWords) * 100)}%` }}
                          />
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[13px] font-semibold tabular-nums">{c.words.toLocaleString()}</span>
                        <span className="block text-[11px] text-[#0E1D26]/40">
                          {c.scenes} {c.scenes === 1 ? "scene" : "scenes"}
                        </span>
                      </span>
                      <IconArrow className="w-4 h-4 shrink-0 text-[#0E1D26]/25 group-hover:text-[#E8561F] transition-colors" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Next up */}
            <div className="rounded-3xl bg-white border border-[#E9E2D4] p-6">
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Next up</p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-[12px] text-[#0E1D26]/45 hover:text-[#0E1D26] transition-colors cursor-pointer"
                >
                  All tasks
                </button>
              </div>

              {nextTasks.length === 0 ? (
                <p className="mt-4 text-[14px] text-[#0E1D26]/55">Nothing pending for this book.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {nextTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-1.5">
                      <button
                        onClick={() => completeTask(t)}
                        title="Mark as done"
                        className="group w-5 h-5 rounded-full border-2 border-[#0E1D26]/20 hover:border-[#E8561F] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                      >
                        <IconTick className="w-3 h-3 text-[#E8561F] opacity-0 group-hover:opacity-100" />
                      </button>
                      <span className="flex-1 min-w-0 text-[14px] truncate">{t.title}</span>
                      {t.urgency === "high" && <span className="w-1.5 h-1.5 rounded-full bg-[#E8561F] shrink-0" title="High priority" />}
                      <span className="shrink-0 text-[11px] text-[#0E1D26]/40">{t.type === "worldbuilding" ? "world" : t.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Plot coverage */}
            <div className="rounded-3xl bg-white border border-[#E9E2D4] p-6 flex items-center gap-5">
              <div className="relative w-[64px] h-[64px] shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#EFE9DE" strokeWidth="9" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#0E1D26"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={263.9}
                    strokeDashoffset={263.9 * (1 - plotProgressPct / 100)}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[14px] font-extrabold">{plotProgressPct}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Plot coverage</p>
                <p className="mt-1.5 text-[13px] leading-snug text-[#0E1D26]/65">
                  {plannedEventsCount > 0
                    ? `${completedEventsCount} of ${plannedEventsCount} planned events reached.`
                    : "No plot events yet — plan them in Plot & Timeline."}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} projectId={id || "1"} />

      {/* Delete book */}
      <AnimatePresence>
        {showDeleteModal && savedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setShowDeleteModal(false)}
              className="absolute inset-0 bg-[#0E1D26]/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-md bg-[#F8F5EE] rounded-[28px] shadow-2xl p-7 text-[#0E1D26]"
            >
              <button
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
                className="absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:bg-[#E6DFD2]/70 cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
              <h3 className="text-[24px] font-extrabold tracking-[-0.02em]">Delete this book?</h3>
              <p className="mt-1 text-[14px] text-[#0E1D26]/55">
                {displayTitle} · {totalWords.toLocaleString()} words
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-[#0E1D26]/65">
                Every chapter, character, location, note and story bible entry will be permanently erased from your account and cloud sync.{" "}
                <strong className="text-[#C2410C]">This cannot be undone.</strong>
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="h-11 px-5 rounded-full border border-[#E6DFD2] bg-white text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Keep Book
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!id) return;
                    setIsDeleting(true);
                    try {
                      storage.deleteProject(id);
                      navigate("/dashboard");
                    } catch (err) {
                      console.error("Failed to delete project:", err);
                      setIsDeleting(false);
                    }
                  }}
                  className={cn(
                    "h-11 px-5 rounded-full bg-[#C2410C] hover:bg-[#9A3412] text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  )}
                >
                  {isDeleting ? <IconSpinner className="w-4 h-4" /> : <IconTrash className="w-4 h-4" />}
                  {isDeleting ? "Deleting…" : "Delete Permanently"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

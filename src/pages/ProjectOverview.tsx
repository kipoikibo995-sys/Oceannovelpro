import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

import { storage } from "@/lib/storage";
import { ExportModal } from "@/components/ExportModal";
import { fileToOptimizedDataUrl } from "@/lib/imageUtils";
import {
  BookCover,
  IconArrow,
  IconClose,
  IconDownload,
  IconImage,
  IconSpinner,
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

  const openStudio = () => navigate(`/project/${id || "1"}/workspace/studio`);

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
                {actualChaptersCount} {actualChaptersCount === 1 ? "chapter" : "chapters"} · about{" "}
                {totalWords > 0 ? Math.max(1, Math.round(totalWords / 250)) : 0}h of drafting
              </p>
            </div>

            <button
              onClick={openStudio}
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

        {/* Quiet details */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          <div className="lg:col-span-3 rounded-3xl bg-white border border-[#E9E2D4] p-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">At a glance</p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {glance.map((g) => (
                <button
                  key={g.label}
                  onClick={() => navigate(g.href)}
                  className="text-left p-3 rounded-2xl hover:bg-[#F8F5EE] transition-colors cursor-pointer"
                >
                  <p className="text-[26px] font-extrabold leading-none">{g.value}</p>
                  <p className="mt-1.5 text-[12px] text-[#0E1D26]/55">{g.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E9E2D4] p-6 flex items-center gap-5">
            <div className="relative w-[72px] h-[72px] shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#EFE9DE" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#0E1D26"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={263.9}
                  strokeDashoffset={263.9 * (1 - plotProgressPct / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[16px] font-extrabold">{plotProgressPct}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Plot coverage</p>
              <p className="mt-1.5 text-[14px] leading-snug text-[#0E1D26]/70">
                {plannedEventsCount > 0
                  ? `${completedEventsCount} of ${plannedEventsCount} planned events reached.`
                  : "No plot events yet — plan them in Plot & Timeline."}
              </p>
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

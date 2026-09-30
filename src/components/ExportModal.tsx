import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { X, FileText, BookOpen, RotateCcw, AlertTriangle, Lock, Check, Download, AlignLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { storage, FrontBackMatterData } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/license";
import UpgradeModal from "@/components/UpgradeModal";
import { exportToEpub, auditManuscriptContent, checkCoverResolution } from "@/lib/epubExport";
import { exportToDocx, exportToTxt } from "@/lib/manuscriptExport";
import { ManuscriptItem } from "@/mockData";

type ExportFormat = "epub" | "docx" | "txt";
type ActiveTab = "format" | "matter";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["vi", "Tiếng Việt"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["it", "Italiano"],
  ["id", "Bahasa Indonesia"],
];

// Guess the book language from its text so the EPUB is tagged correctly for stores
function detectLanguage(items: ManuscriptItem[]): string {
  let sample = "";
  const walk = (arr: ManuscriptItem[]) => {
    for (const it of arr) {
      if (sample.length > 4000) return;
      if (it.content) sample += " " + it.content.replace(/<[^>]*>/g, " ");
      if (it.children) walk(it.children);
    }
  };
  walk(items);
  return /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(sample) ? "vi" : "en";
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 py-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-[#0E1D26]">{label}</span>
        {hint && <span className="block mt-0.5 text-[12px] leading-snug text-[#0E1D26]/50">{hint}</span>}
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`mt-0.5 shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#E8561F]/40 ${checked ? "bg-[#0E1D26]" : "bg-[#E4DAC8]"}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </label>
  );
}

const fieldLabel = "block text-[12px] font-semibold text-[#0E1D26]/60 mb-1.5";
const fieldInput =
  "w-full h-11 px-4 rounded-2xl bg-white border border-[#E9E2D4] text-[14px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 transition-colors";
const fieldArea =
  "w-full px-4 py-3 rounded-2xl bg-white border border-[#E9E2D4] text-[14px] leading-relaxed text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 transition-colors resize-none";

export function ExportModal({ isOpen, onClose, projectId }: ExportModalProps) {
  const [includeCopyright, setIncludeCopyright] = useState(true);
  const [includeTocPage, setIncludeTocPage] = useState(true);
  const [includeAboutAuthor, setIncludeAboutAuthor] = useState(true);
  const [includeReviewRequest, setIncludeReviewRequest] = useState(true);
  const [includeAcknowledgments, setIncludeAcknowledgments] = useState(false);
  const [stripInternalMentions, setStripInternalMentions] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [coverValidation, setCoverValidation] = useState<{ width: number; height: number; isAdequate: boolean; message: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("format");

  const project = storage.getProjects().find((p) => p.id === projectId);
  const projectData = storage.getProjectData(projectId);
  const profile = storage.getUserProfile();
  const authorFallback = profile.penName || profile.name || "Author";
  const hasEpub3Export = PLAN_LIMITS[profile?.plan || "free"]?.hasEpub3Export ?? false;
  const manuscript = projectData?.manuscript || [];

  const [format, setFormat] = useState<ExportFormat>(() => (hasEpub3Export ? "epub" : "docx"));
  const [language, setLanguage] = useState(() => detectLanguage(manuscript));
  const defaultYear = new Date().getFullYear().toString();

  const buildDefaultMatter = (): FrontBackMatterData => ({
    subtitle: "",
    publisher: "",
    edition: `First Digital Edition: ${defaultYear}`,
    copyrightYear: defaultYear,
    copyrightOwner: authorFallback,
    isbn: "",
    asin: "",
    disclaimerText:
      "This is a work of fiction. Names, characters, places, and incidents either are the product of the author's imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events, or locales is entirely coincidental.",
    dedication: "",
    acknowledgmentsText: "",
    authorPenName: authorFallback,
    authorBioText: profile.bio || "",
    authorWebsiteOrNewsletter: "",
    includeReviewRequest: true,
    reviewCtaHeading: "A Sincere Note to the Reader",
    reviewCtaText: `Thank you for reading ${project?.title || "this book"}! If you enjoyed this journey, please consider leaving an honest review on Amazon or Goodreads. Reviews are the lifeblood of independent authors and help fellow book lovers discover great new stories.`,
  });

  const [matter, setMatter] = useState<FrontBackMatterData>(() => ({ ...buildDefaultMatter(), ...(projectData?.frontBackMatter || {}) }));

  // Reload saved pages whenever the dialog opens (the modal stays mounted on the Overview page)
  useEffect(() => {
    if (!isOpen) return;
    const saved = storage.getProjectData(projectId)?.frontBackMatter;
    setMatter({ ...buildDefaultMatter(), ...(saved || {}) });
    setIncludeReviewRequest(saved?.includeReviewRequest ?? true);
    setIncludeAcknowledgments(Boolean(saved?.acknowledgmentsText?.trim()));
    setLanguage(detectLanguage(storage.getProjectData(projectId)?.manuscript || []));
    setExportError(null);
    setExportComplete(false);
    setActiveTab("format");
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen || !project?.coverUrl) {
      setCoverValidation(null);
      return;
    }
    checkCoverResolution(project.coverUrl).then(setCoverValidation);
  }, [isOpen, project?.coverUrl]);

  // Save typing once it pauses (this used to write to Firestore on every keystroke)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistMatter = (next: FrontBackMatterData, immediate = false) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const write = () => {
      storage.saveProjectData(projectId, { frontBackMatter: next });
      setSavedNotice(true);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setSavedNotice(false), 1800);
    };
    if (immediate) write();
    else saveTimer.current = setTimeout(write, 700);
  };
  const latestMatter = useRef(matter);
  latestMatter.current = matter;
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      storage.saveProjectData(projectId, { frontBackMatter: latestMatter.current });
    }
  }, [projectId]);

  const updateMatterField = (key: keyof FrontBackMatterData, value: any) => {
    const updated = { ...matter, [key]: value };
    // Keep the copyright owner in step with the pen name unless it was changed on purpose
    if (key === "authorPenName" && (!matter.copyrightOwner || matter.copyrightOwner === matter.authorPenName)) {
      updated.copyrightOwner = value;
    }
    setMatter(updated);
    persistMatter(updated, typeof value === "boolean");
  };

  const handleResetToStandard = () => {
    if (window.confirm("Reset all book pages to the standard defaults?")) {
      const d = buildDefaultMatter();
      setMatter(d);
      setIncludeReviewRequest(true);
      setIncludeAcknowledgments(false);
      persistMatter(d, true);
    }
  };

  const audit = useMemo(
    () => (isOpen ? auditManuscriptContent(manuscript, stripInternalMentions, language) : null),
    [isOpen, manuscript, stripInternalMentions, language]
  );
  const hasAckText = Boolean(matter.acknowledgmentsText?.trim());

  const flushPendingSave = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      storage.saveProjectData(projectId, { frontBackMatter: matter });
    }
  };

  const handleExport = async () => {
    if (format === "epub" && !hasEpub3Export) {
      setShowUpgradeModal(true);
      return;
    }
    if (!audit || audit.compiledChapterCount === 0) {
      setExportError("There is nothing to export yet. Write at least one chapter or scene first.");
      return;
    }
    flushPendingSave();
    setIsExporting(true);
    setExportComplete(false);
    setExportError(null);

    try {
      const title = project?.title || "Untitled Manuscript";
      const author = (matter.authorPenName || authorFallback).trim();
      const shared = {
        title,
        author,
        manuscript,
        matter,
        stripInternalMentions,
        includeTitlePage,
        includeCopyright,
        includeAboutAuthor,
        includeAcknowledgments: includeAcknowledgments && hasAckText,
        includeReviewRequest,
      };

      if (format === "epub") {
        await exportToEpub({
          ...shared,
          subtitle: matter.subtitle,
          language,
          coverImageUrl: project?.coverUrl,
          genre: project?.genre,
          includeTocPage,
          authorBio: matter.authorBioText,
        });
      } else if (format === "docx") {
        await exportToDocx(shared);
      } else {
        exportToTxt(shared);
      }

      setExportComplete(true);
      setTimeout(() => {
        onClose();
        setTimeout(() => setExportComplete(false), 300);
      }, 1600);
    } catch (error: any) {
      console.error("Export failed", error);
      setExportError(error?.message || "Something went wrong while building the file.");
    } finally {
      setIsExporting(false);
    }
  };

  const formats: { id: ExportFormat; name: string; hint: string; icon: ReactNode; locked?: boolean }[] = [
    { id: "epub", name: "EPUB", hint: "Kindle & e-book stores", icon: <BookOpen className="w-5 h-5" />, locked: !hasEpub3Export },
    { id: "docx", name: "Word", hint: "Editors, Kindle Create", icon: <FileText className="w-5 h-5" /> },
    { id: "txt", name: "Plain text", hint: "Any app, backups", icon: <AlignLeft className="w-5 h-5" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0E1D26]/45 backdrop-blur-sm"
            onClick={isExporting ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="relative w-full max-w-2xl bg-[#FBF9F4] rounded-[28px] border border-[#E9E2D4] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#0E1D26]"
          >
            {/* Header */}
            <div className="px-6 sm:px-7 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Export</p>
                <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.01em] leading-tight truncate">{project?.title || "Untitled"}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savedNotice && (
                  <span className="h-7 px-3 rounded-full bg-white border border-[#E9E2D4] text-[12px] text-[#0E1D26]/60 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#2F7A4F]" /> Saved
                  </span>
                )}
                <button
                  onClick={onClose}
                  disabled={isExporting}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#EFE9DE] transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 sm:px-7 pb-4 shrink-0">
              <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
                {([["format", "Format"], ["matter", "Book pages"]] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`h-8 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${activeTab === tab ? "bg-white text-[#0E1D26] shadow-sm" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 sm:px-7 pb-6 custom-scrollbar">
              {activeTab === "format" && (
                <div className="space-y-5">
                  {/* Formats */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {formats.map((f) => {
                      const active = format === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => (f.locked ? setShowUpgradeModal(true) : setFormat(f.id))}
                          className={`relative text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                            active ? "bg-white border-[#0E1D26] ring-1 ring-[#0E1D26]" : "bg-white/60 border-[#E9E2D4] hover:border-[#D9CFBC] hover:bg-white"
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? "bg-[#0E1D26] text-[#F6F1E7]" : "bg-[#EFE9DE] text-[#0E1D26]/60"}`}>{f.icon}</span>
                          <span className="mt-3 flex items-center gap-1.5 text-[15px] font-bold">
                            {f.name}
                            {f.locked && <Lock className="w-3.5 h-3.5 text-[#0E1D26]/40" />}
                          </span>
                          <span className="block mt-0.5 text-[12px] leading-snug text-[#0E1D26]/50">{f.locked ? "Pro plan" : f.hint}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* What goes into the file */}
                  {audit && (
                    <div className="rounded-2xl bg-white border border-[#E9E2D4] p-4">
                      {audit.compiledChapterCount === 0 ? (
                        <p className="text-[13px] text-[#0E1D26]/60">Nothing to export yet — write a chapter or scene first.</p>
                      ) : (
                        <p className="text-[14px]">
                          <strong className="font-bold">{audit.compiledChapterCount}</strong> {audit.compiledChapterCount === 1 ? "chapter" : "chapters"}
                          <span className="text-[#0E1D26]/30"> · </span>
                          <strong className="font-bold">{audit.compiledWordCount.toLocaleString()}</strong> words
                          <span className="text-[#0E1D26]/50"> will be exported, with bold, italics and scene breaks kept.</span>
                        </p>
                      )}
                      {audit.emptyChapters.length > 0 && (
                        <p className="mt-2 text-[12px] leading-snug text-[#8A5A12] flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                          <span>
                            {audit.emptyChapters.length === 1 ? "1 chapter has" : `${audit.emptyChapters.length} chapters have`} no text yet and will be a title only:{" "}
                            {audit.emptyChapters.slice(0, 3).join(", ")}
                            {audit.emptyChapters.length > 3 ? "…" : ""}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Options */}
                  <div className="rounded-2xl bg-white border border-[#E9E2D4] px-4 divide-y divide-[#F1ECE2]">
                    <Toggle checked={stripInternalMentions} onChange={setStripInternalMentions} label="Clean up @mentions" hint="“@Sarah Cole” becomes “Sarah Cole”. Email addresses are left alone." />
                    <Toggle checked={includeTitlePage} onChange={setIncludeTitlePage} label="Title page" hint="Title, subtitle, pen name and imprint." />
                    <Toggle checked={includeCopyright} onChange={setIncludeCopyright} label="Copyright page" hint={`© ${matter.copyrightYear || defaultYear}, edition, ISBN/ASIN and fiction disclaimer.`} />
                    {format === "epub" && <Toggle checked={includeTocPage} onChange={setIncludeTocPage} label="Table of contents page" hint="A clickable chapter list at the front. E-readers also get their own menu." />}
                    <Toggle checked={includeAboutAuthor} onChange={setIncludeAboutAuthor} label="About the author" hint="Your bio and newsletter link." />
                    <Toggle
                      checked={includeReviewRequest}
                      onChange={(v) => {
                        setIncludeReviewRequest(v);
                        updateMatterField("includeReviewRequest", v);
                      }}
                      label="Review request"
                      hint="A short note asking readers for an honest review."
                    />
                    <Toggle
                      checked={includeAcknowledgments && hasAckText}
                      onChange={setIncludeAcknowledgments}
                      disabled={!hasAckText}
                      label="Acknowledgments"
                      hint={hasAckText ? "Your thank-you page." : "Write it under Book pages first."}
                    />
                  </div>

                  {format === "epub" && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabel}>Book language</label>
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={fieldInput}>
                          {LANGUAGES.map(([code, name]) => (
                            <option key={code} value={code}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-2xl border border-[#E9E2D4] px-4 py-3 text-[12px] leading-snug text-[#0E1D26]/55 flex items-center">
                        {coverValidation
                          ? coverValidation.isAdequate
                            ? `Cover included (${coverValidation.width} × ${coverValidation.height}px).`
                            : coverValidation.message
                          : "No cover image uploaded — the EPUB opens with a simple title cover. Upload your real cover to KDP separately."}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "matter" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-[#0E1D26]/55">Saved to this book as you type.</p>
                    <button
                      onClick={handleResetToStandard}
                      className="h-8 px-3 rounded-full text-[12px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#EFE9DE] flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>

                  <section className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Title page</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabel}>Subtitle</label>
                        <input type="text" value={matter.subtitle || ""} onChange={(e) => updateMatterField("subtitle", e.target.value)} placeholder="Optional" className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Publisher / imprint</label>
                        <input type="text" value={matter.publisher || ""} onChange={(e) => updateMatterField("publisher", e.target.value)} placeholder="Leave blank to omit" className={fieldInput} />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabel}>Dedication</label>
                      <textarea rows={2} value={matter.dedication || ""} onChange={(e) => updateMatterField("dedication", e.target.value)} placeholder="Optional — e.g. For those who watch the fog roll in." className={fieldArea} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Copyright</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabel}>Year</label>
                        <input type="text" value={matter.copyrightYear || ""} onChange={(e) => updateMatterField("copyrightYear", e.target.value)} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Owner</label>
                        <input type="text" value={matter.copyrightOwner || ""} onChange={(e) => updateMatterField("copyrightOwner", e.target.value)} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>ISBN</label>
                        <input type="text" value={matter.isbn || ""} onChange={(e) => updateMatterField("isbn", e.target.value)} placeholder="Optional" className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>ASIN</label>
                        <input type="text" value={matter.asin || ""} onChange={(e) => updateMatterField("asin", e.target.value)} placeholder="Optional" className={fieldInput} />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabel}>Edition</label>
                      <input type="text" value={matter.edition || ""} onChange={(e) => updateMatterField("edition", e.target.value)} className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Fiction disclaimer</label>
                      <textarea rows={3} value={matter.disclaimerText || ""} onChange={(e) => updateMatterField("disclaimerText", e.target.value)} className={fieldArea} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">About the author</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabel}>Pen name</label>
                        <input type="text" value={matter.authorPenName || ""} onChange={(e) => updateMatterField("authorPenName", e.target.value)} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Website or newsletter</label>
                        <input type="url" value={matter.authorWebsiteOrNewsletter || ""} onChange={(e) => updateMatterField("authorWebsiteOrNewsletter", e.target.value)} placeholder="https://" className={fieldInput} />
                      </div>
                    </div>
                    <div>
                      <label className={fieldLabel}>Bio</label>
                      <textarea rows={3} value={matter.authorBioText || ""} onChange={(e) => updateMatterField("authorBioText", e.target.value)} placeholder="A few lines about you, in your own words." className={fieldArea} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Review request</p>
                    <div>
                      <label className={fieldLabel}>Heading</label>
                      <input type="text" value={matter.reviewCtaHeading || ""} onChange={(e) => updateMatterField("reviewCtaHeading", e.target.value)} placeholder="A Sincere Note to the Reader" className={fieldInput} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Message</label>
                      <textarea rows={3} value={matter.reviewCtaText || ""} onChange={(e) => updateMatterField("reviewCtaText", e.target.value)} className={fieldArea} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Acknowledgments</p>
                    <textarea
                      rows={3}
                      value={matter.acknowledgmentsText || ""}
                      onChange={(e) => {
                        updateMatterField("acknowledgmentsText", e.target.value);
                        if (e.target.value.trim() && !hasAckText) setIncludeAcknowledgments(true);
                      }}
                      placeholder="Optional — thank your editor, beta readers, family…"
                      className={fieldArea}
                    />
                  </section>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-7 py-4 border-t border-[#E9E2D4] shrink-0">
              {exportError && (
                <p className="mb-3 p-3 rounded-2xl bg-[#B3261E]/5 border border-[#B3261E]/20 text-[13px] text-[#8C1D18] whitespace-pre-line">{exportError}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  disabled={isExporting}
                  className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || exportComplete}
                  className={`h-10 pl-4 pr-1.5 rounded-full text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-default ${exportComplete ? "bg-[#2F7A4F]" : "bg-[#E8561F] hover:bg-[#D44B17]"}`}
                >
                  {exportComplete ? "Downloaded" : isExporting ? "Building…" : `Export ${format === "txt" ? "TXT" : format === "docx" ? "Word" : "EPUB"}`}
                  <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                    {exportComplete ? <Check className="w-4 h-4" /> : isExporting ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Download className="w-4 h-4" />}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="epub"
        title="Amazon KDP EPUB 3 Export Locked"
        description="Gold Standard EPUB 3.3 Amazon KDP export package (dual NCX/EPUB 3 navigation, Landmarked start-reading offsets, and Kindle typography) is unlocked in Pro Edition ($47)."
      />
    </AnimatePresence>
  );
}

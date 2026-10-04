import { useState } from "react";
import { storage } from "@/lib/storage";
import { failedCloudSaves, useCloudSaveTick } from "@/lib/saveStatus";
import { exportToDocx } from "@/lib/manuscriptExport";
import { IconAlert, IconClose, IconDownload, IconRefresh } from "@/components/brand/ocean-ui";

/**
 * Shown anywhere in the app when a book couldn't be saved to the cloud.
 * The writing is still on this device; this makes sure the author knows, and can retry or
 * take a Word copy before closing the tab.
 */
export default function CloudSaveNotice() {
  useCloudSaveTick();
  const [hiddenFor, setHiddenFor] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const failed = failedCloudSaves();
  const key = failed.map((f) => f.projectId + (f.info.message || "")).join("|");
  if (!failed.length || hiddenFor === key) return null;

  const { projectId, info } = failed[0];
  const project = storage.getProjects().find((p) => p.id === projectId);
  const title = project?.title || "your book";

  const downloadCopy = async () => {
    const data = storage.getProjectData(projectId);
    if (!data) return;
    setBusy(true);
    try {
      await exportToDocx({
        title,
        author: storage.getUserProfile()?.penName || storage.getUserProfile()?.name || "",
        manuscript: data.manuscript || [],
        matter: data.frontBackMatter || {},
        stripInternalMentions: true,
        includeTitlePage: true,
        includeCopyright: false,
        includeAboutAuthor: false,
        includeAcknowledgments: false,
        includeReviewRequest: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] sm:w-[400px] rounded-2xl border border-[#E8561F]/30 bg-white shadow-xl p-4 font-['Outfit'] text-[#0E1D26]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8561F]/10 text-[#E8561F]">
          <IconAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug">Not saved to the cloud</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#0E1D26]/65">
            {info.message} Your writing in “{title}” is still on this device — don't clear your browser data. Try again, or download a Word copy to be safe.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => storage.retryCloudSave(projectId)}
              className="h-9 px-4 rounded-full bg-[#0E1D26] text-white text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#1c3442]"
            >
              <IconRefresh className="h-3.5 w-3.5" /> Try again
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={downloadCopy}
              className="h-9 px-4 rounded-full border border-[#E4DAC8] text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#F6F1E7] disabled:opacity-50"
            >
              <IconDownload className="h-3.5 w-3.5" /> {busy ? "Preparing…" : "Download Word copy"}
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Hide"
          onClick={() => setHiddenFor(key)}
          className="shrink-0 rounded-full p-1 text-[#0E1D26]/40 hover:text-[#0E1D26] cursor-pointer"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

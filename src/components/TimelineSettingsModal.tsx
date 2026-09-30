import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { IconClock, IconClose, IconFlame, IconQuill, IconRefresh, IconTick, Tag } from "@/components/brand/ocean-ui";
import { storage, ProjectMeta, AuthorTimelineSettings } from "@/lib/storage";

interface TimelineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: ProjectMeta[];
  totalWords: number;
  onUpdated: () => void;
}

export function TimelineSettingsModal({
  isOpen,
  onClose,
  savedProjects,
  totalWords,
  onUpdated,
}: TimelineSettingsModalProps) {
  const [settings, setSettings] = useState<AuthorTimelineSettings>(storage.getTimelineSettings());

  const autoStreak = storage.calculateTimelineStreak(savedProjects);
  // Realistic writing velocity: ~900 words per hour
  const autoHours = Math.floor(totalWords / 900);
  const autoMinutes = Math.round((totalWords % 900) / 15);

  const [streakMode, setStreakMode] = useState<'auto' | 'custom'>(settings.streakMode || 'auto');
  const [customStreakDays, setCustomStreakDays] = useState<number>(settings.customStreakDays || autoStreak);

  const [timeMode, setTimeMode] = useState<'auto' | 'custom'>(settings.timeMode || 'auto');
  const [customHours, setCustomHours] = useState<number>(settings.customHours || autoHours);
  const [customMinutes, setCustomMinutes] = useState<number>(settings.customMinutes || autoMinutes);

  useEffect(() => {
    if (isOpen) {
      const current = storage.getTimelineSettings();
      setSettings(current);
      setStreakMode(current.streakMode);
      setCustomStreakDays(current.customStreakDays || autoStreak);
      setTimeMode(current.timeMode);
      setCustomHours(current.customHours ?? autoHours);
      setCustomMinutes(current.customMinutes ?? autoMinutes);
    }
  }, [isOpen, autoStreak, autoHours, autoMinutes]);

  const handleSave = () => {
    storage.saveTimelineSettings({
      streakMode,
      customStreakDays: Math.max(1, Number(customStreakDays) || 1),
      timeMode,
      customHours: Math.max(0, Number(customHours) || 0),
      customMinutes: Math.min(59, Math.max(0, Number(customMinutes) || 0)),
    });
    onUpdated();
    onClose();
  };

  const handleResetToAuto = () => {
    setStreakMode('auto');
    setTimeMode('auto');
    setCustomStreakDays(autoStreak);
    setCustomHours(autoHours);
    setCustomMinutes(autoMinutes);
    storage.saveTimelineSettings({
      streakMode: 'auto',
      customStreakDays: autoStreak,
      timeMode: 'auto',
      customHours: autoHours,
      customMinutes: autoMinutes,
    });
    onUpdated();
    onClose();
  };

  if (!isOpen) return null;

  const plural = (n: number) => (n === 1 ? "Day" : "Days");
  const previewStreak = streakMode === "custom" ? customStreakDays : autoStreak;
  const previewTime = timeMode === "custom" ? `${customHours}h ${customMinutes}m` : `${autoHours}h ${autoMinutes}m`;

  const segBtn = (active: boolean) =>
    cn(
      "px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer",
      active ? "bg-[#0E1D26] text-[#F6F1E7]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
    );
  const numInput =
    "h-11 px-4 bg-white border border-[#E4DAC8] rounded-full text-[15px] font-bold tabular-nums text-[#0E1D26] outline-none transition focus:border-[#E8561F] focus:ring-4 focus:ring-[#E8561F]/12";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit'] text-[#0E1D26]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0E1D26]/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[520px] max-h-[92vh] bg-[#F6F1E7] rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-[#0E1D26] text-[#F6F1E7] px-7 pt-6 pb-7 shrink-0">
            <div className="absolute -right-12 -top-16 w-44 h-44 rounded-full bg-[#E8561F]" aria-hidden="true" />
            <div className="absolute right-24 -bottom-10 w-20 h-20 rounded-t-full bg-[#F0B54B]" aria-hidden="true" />
            <div className="relative">
              <Tag tone="light">Writing Stats</Tag>
              <h3 className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.02em]">
                Configure <span className="text-[#E8561F]">stats.</span>
              </h3>
              <p className="mt-2 text-[13px] text-[#F6F1E7]/60">Choose how your streak and writing time are counted.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-5 top-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <IconClose className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-7 py-6 flex flex-col gap-6">
            {/* Live preview */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: <IconFlame className="w-4 h-4" />, tone: "bg-[#E8561F] text-white", v: `${previewStreak} ${plural(Number(previewStreak))}`, l: "Streak" },
                { icon: <IconQuill className="w-4 h-4" />, tone: "bg-[#0E1D26] text-[#F0B54B]", v: totalWords.toLocaleString(), l: "Words" },
                { icon: <IconClock className="w-4 h-4" />, tone: "bg-[#F0B54B] text-[#0E1D26]", v: previewTime, l: "Time" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white border border-[#E4DAC8] p-3.5">
                  <span className={cn("w-8 h-8 rounded-full flex items-center justify-center", s.tone)}>{s.icon}</span>
                  <p className="mt-2.5 text-[17px] font-extrabold leading-none truncate">{s.v}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Streak */}
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-bold">Writing streak</p>
                <div className="flex items-center p-1 rounded-full bg-white border border-[#E4DAC8]">
                  <button type="button" onClick={() => setStreakMode("auto")} className={segBtn(streakMode === "auto")}>
                    Auto
                  </button>
                  <button type="button" onClick={() => setStreakMode("custom")} className={segBtn(streakMode === "custom")}>
                    Custom
                  </button>
                </div>
              </div>

              {streakMode === "auto" ? (
                <p className="mt-3 px-4 py-3 rounded-2xl bg-white/70 text-[13px] text-[#0E1D26]/65">
                  Counted from your writing history: <strong className="text-[#0E1D26]">{autoStreak} consecutive {plural(autoStreak).toLowerCase()}</strong>.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customStreakDays}
                      onChange={(e) => setCustomStreakDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className={cn(numInput, "w-28")}
                    />
                    <span className="text-[13px] text-[#0E1D26]/60">consecutive days</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 3, 5, 7, 14, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCustomStreakDays(d)}
                        className={cn(
                          "h-8 px-3 rounded-full border text-[12px] font-semibold transition-colors cursor-pointer",
                          customStreakDays === d
                            ? "bg-[#E8561F] border-[#E8561F] text-white"
                            : "bg-white border-[#E4DAC8] text-[#0E1D26]/65 hover:border-[#0E1D26]/40"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Writing time */}
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-bold">Writing time</p>
                <div className="flex items-center p-1 rounded-full bg-white border border-[#E4DAC8]">
                  <button type="button" onClick={() => setTimeMode("auto")} className={segBtn(timeMode === "auto")}>
                    Auto
                  </button>
                  <button type="button" onClick={() => setTimeMode("custom")} className={segBtn(timeMode === "custom")}>
                    Custom
                  </button>
                </div>
              </div>

              {timeMode === "auto" ? (
                <p className="mt-3 px-4 py-3 rounded-2xl bg-white/70 text-[13px] text-[#0E1D26]/65">
                  Estimated at ~900 words per hour: <strong className="text-[#0E1D26]">{autoHours}h {autoMinutes}m</strong>.
                </p>
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={customHours}
                    onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className={cn(numInput, "w-24")}
                  />
                  <span className="text-[13px] text-[#0E1D26]/60">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className={cn(numInput, "w-24")}
                  />
                  <span className="text-[13px] text-[#0E1D26]/60">min</span>
                </div>
              )}
            </section>

            {/* Books */}
            {savedProjects.length > 0 && (
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1D26]/45">
                  Your books · {savedProjects.length}
                </p>
                <div className="mt-2 max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                  {savedProjects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 rounded-full bg-white border border-[#E4DAC8] text-[13px]">
                      <span className="font-semibold truncate">{p.title}</span>
                      <span className="shrink-0 text-[#E8561F] font-bold tabular-nums">{(p.currentWords || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-7 py-4 border-t border-[#E4DAC8] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResetToAuto}
              className="h-10 px-3 rounded-full text-[13px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <IconRefresh className="w-4 h-4" />
              Reset to auto
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-5 rounded-full border border-[#E4DAC8] bg-white text-[13px] font-semibold hover:border-[#0E1D26]/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-10 px-5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-1.5 shadow-[0_10px_24px_-12px_rgba(232,86,31,0.9)] transition-colors cursor-pointer"
              >
                <IconTick className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

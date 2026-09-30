import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  BookOpen,
  Users,
  Heart,
  Eye,
  Check,
  Plus,
  Copy,
  Compass,
  Flame,
  Crown,
  Layers
} from "lucide-react";
import {
  CharacterPreset,
  CHARACTER_PRESETS,
  CHARACTER_CATEGORIES,
  CHARACTER_ROLES
} from "@/data/characterPresets";

// Paper grain for the desk surface
const GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")';

interface CharacterPresetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: CharacterPreset, directSave?: boolean) => void;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}

export default function CharacterPresetPickerModal({
  isOpen,
  onClose,
  onSelectPreset,
  title = "50 Premade Character Archetypes",
  subtitle = "Choose from 50 fully realized fantasy archetypes complete with backstory, personality, traits, and portraits.",
  actionLabel = "Use Character"
}: CharacterPresetPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedRole, setSelectedRole] = useState<string>("All");
  const [inspectingPreset, setInspectingPreset] = useState<CharacterPreset | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Filtered list
  const filteredPresets = useMemo(() => {
    return CHARACTER_PRESETS.filter((preset) => {
      // Category filter
      if (selectedCategory !== "All" && preset.category !== selectedCategory) {
        return false;
      }
      // Role filter
      if (selectedRole !== "All" && preset.role.toUpperCase() !== selectedRole.toUpperCase()) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = preset.name.toLowerCase().includes(q);
        const matchesTitle = preset.title.toLowerCase().includes(q);
        const matchesArchetype = preset.archetype.toLowerCase().includes(q);
        const matchesRace = preset.race.toLowerCase().includes(q);
        const matchesMbti = preset.mbti.toLowerCase().includes(q);
        const matchesTraits = preset.traits.some((t) => t.toLowerCase().includes(q));
        const matchesTags = preset.tags.some((tag) => tag.toLowerCase().includes(q));
        const matchesLore = preset.backstory.toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesTitle &&
          !matchesArchetype &&
          !matchesRace &&
          !matchesMbti &&
          !matchesTraits &&
          !matchesTags &&
          !matchesLore
        ) {
          return false;
        }
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedRole]);

  if (!isOpen) return null;

  const handleCopySheet = async (preset: CharacterPreset) => {
    const text = `# Character Dossier: ${preset.name} (${preset.title})
- Role: ${preset.role}
- Category: ${preset.category}
- Archetype: ${preset.archetype}
- MBTI: ${preset.mbti}
- Species / Race: ${preset.race}
- Age: ${preset.age} | Gender: ${preset.gender}
- Group: ${preset.group} | Status: ${preset.status}

## Personality Traits
${preset.traits.join(", ")}

## Core Goal & Motivation
${preset.goal}

## Internal & External Conflict
${preset.conflict}

## Formative Trauma
${preset.trauma}

## Backstory
${preset.backstory}

## Physical Appearance
${preset.physicalAppearance}

## Signature Ability & Gear
- Ability: ${preset.signatureAbility}
- Gear: ${preset.gear}
`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification("Character dossier copied to clipboard!");
      setTimeout(() => setCopiedNotification(null), 2500);
    } catch {
      // fallback
    }
  };

  const roleTone = (role: string) => {
    switch (role.toUpperCase()) {
      case "PROTAGONIST":
        return "bg-[#F0B54B] text-[#0E1D26]";
      case "ANTAGONIST":
        return "bg-[#E8561F] text-white";
      case "RIVAL":
        return "bg-[#0E1D26] text-[#F6F1E7]";
      default:
        return "bg-[#FDFBF6] text-[#0E1D26]";
    }
  };
  const tilt = (id: string) => ((id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 7) - 3) * 0.5;
  const pinColor = (id: string) => ["#E8561F", "#0E1D26", "#F0B54B"][id.length % 3];

  const chip = (active: boolean) =>
    `h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
      active ? "bg-[#0E1D26] text-[#F6F1E7]" : "bg-[#FDFBF6]/80 text-[#0E1D26]/65 hover:text-[#0E1D26]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0E1D26]/60 backdrop-blur-sm font-['Outfit'] text-[#0E1D26] animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl max-h-[92vh] flex flex-col rounded-[28px] shadow-2xl overflow-hidden" style={{ backgroundColor: "#ECE5D8" }}>
        <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-30" style={{ backgroundImage: GRAIN }} />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Archetype library · {CHARACTER_PRESETS.length} ready characters</p>
            <h2 className="mt-2 text-[28px] sm:text-[34px] font-extrabold leading-none tracking-[-0.02em]">{title}</h2>
            <p className="mt-2 text-[14px] text-[#0E1D26]/60 max-w-2xl">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 shrink-0 rounded-full bg-[#FDFBF6] hover:bg-white text-[#0E1D26]/60 hover:text-[#0E1D26] flex items-center justify-center shadow-sm cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & filters */}
        <div className="relative px-6 sm:px-8 pb-4 space-y-3 border-b border-[#0E1D26]/10">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#0E1D26]/35 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, race, trait or keyword — elf, assassin, mentor…"
                className="w-full h-11 pl-11 pr-10 bg-[#FDFBF6] border border-[#DDD3C2] rounded-full text-[14px] placeholder:text-[#0E1D26]/35 outline-none focus:border-[#0E1D26]/35"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0E1D26]/40 hover:text-[#0E1D26] cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[13px] text-[#0E1D26]/55 shrink-0">
              Showing <strong className="text-[#0E1D26]">{filteredPresets.length}</strong> of {CHARACTER_PRESETS.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40 mr-1 shrink-0">Class</span>
            {CHARACTER_CATEGORIES.map((cat) => {
              const count = cat === "All" ? CHARACTER_PRESETS.length : CHARACTER_PRESETS.filter((p) => p.category === cat).length;
              return (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={chip(selectedCategory === cat)}>
                  {cat} <span className="opacity-50">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40 mr-1 shrink-0">Role</span>
            {CHARACTER_ROLES.map((role) => {
              const count = role === "All" ? CHARACTER_PRESETS.length : CHARACTER_PRESETS.filter((p) => p.role.toUpperCase() === role.toUpperCase()).length;
              return (
                <button key={role} onClick={() => setSelectedRole(role)} className={chip(selectedRole === role)}>
                  <span className="capitalize">{role.toLowerCase()}</span> <span className="opacity-50">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pinned polaroids */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 py-8">
          {filteredPresets.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="relative bg-[#F7E3A6] px-7 py-6 -rotate-2 shadow-[0_14px_24px_-16px_rgba(14,29,38,0.6)] text-center">
                <p className="font-['Caveat'] text-[26px] font-bold leading-tight">No archetypes match.</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                    setSelectedRole("All");
                  }}
                  className="mt-3 h-9 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[12px] font-bold cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  style={{ transform: `rotate(${tilt(preset.id)}deg)` }}
                  className="group relative bg-[#FDFBF6] p-2.5 pb-3 shadow-[0_16px_26px_-18px_rgba(14,29,38,0.6),0_1px_2px_rgba(14,29,38,0.15)] transition-transform duration-300 hover:!rotate-0 hover:-translate-y-1"
                >
                  {/* push pin */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-3.5 h-3.5 rounded-full shadow-[1px_2px_3px_rgba(0,0,0,0.35)]" style={{ background: pinColor(preset.id) }} />

                  <button onClick={() => setInspectingPreset(preset)} className="relative block w-full aspect-[3/4] overflow-hidden bg-[#EFE9DE] cursor-pointer" title="Open dossier">
                    <img src={preset.imageUrl} alt={preset.name} loading="lazy" className="w-full h-full object-cover" />
                    <span className={`absolute left-2 bottom-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] shadow-sm ${roleTone(preset.role)}`}>
                      {preset.role.toLowerCase()}
                    </span>
                  </button>

                  <p className="mt-2 font-['Caveat'] text-[22px] font-bold leading-none text-center line-clamp-1" title={preset.name}>
                    {preset.name}
                  </p>
                  <p className="mt-1 text-[11px] text-[#0E1D26]/50 text-center line-clamp-1">
                    {preset.race} · {preset.age}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setInspectingPreset(preset)}
                      className="flex-1 h-8 rounded-full border border-[#E4DAC8] text-[11px] font-semibold hover:border-[#0E1D26]/35 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Dossier
                    </button>
                    <button
                      onClick={() => {
                        onSelectPreset(preset, false);
                        onClose();
                      }}
                      className="flex-1 h-8 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      title="Load into editor"
                    >
                      <Plus className="w-3.5 h-3.5" /> Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dossier — a paper file */}
      {inspectingPreset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-[#0E1D26]/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#FDFBF6] rounded-[4px] shadow-2xl overflow-hidden">
            {copiedNotification && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0E1D26] text-[#F6F1E7] px-4 py-2 rounded-full text-[12px] font-semibold shadow-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-[#F0B54B]" /> {copiedNotification}
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFE6D6]">
              <span className="px-2.5 py-1 border border-[#0E1D26]/40 text-[10px] font-bold uppercase tracking-[0.18em]">
                Dossier #{inspectingPreset.id.replace("char-preset-", "")} · {inspectingPreset.category}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopySheet(inspectingPreset)}
                  className="h-9 px-4 rounded-full border border-[#E4DAC8] hover:border-[#0E1D26]/35 text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                  title="Copy full dossier as Markdown"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy dossier
                </button>
                <button onClick={() => setInspectingPreset(null)} aria-label="Close" className="w-9 h-9 rounded-full text-[#0E1D26]/50 hover:text-[#0E1D26] hover:bg-[#F1ECE2] flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-7">
              <div className="flex flex-col sm:flex-row gap-7 items-start">
                <div className="relative w-44 shrink-0 bg-white p-2 pb-8 shadow-[0_14px_24px_-14px_rgba(14,29,38,0.6)] -rotate-2">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 bg-[#F0B54B]/55 rotate-3" />
                  <img src={inspectingPreset.imageUrl} alt={inspectingPreset.name} className="w-full aspect-[3/4] object-cover" />
                  <p className="absolute bottom-1.5 inset-x-0 text-center font-['Caveat'] text-[20px] font-bold truncate px-2">{inspectingPreset.name.split(" ")[0]}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${roleTone(inspectingPreset.role)} border border-[#0E1D26]/10`}>
                      {inspectingPreset.role}
                    </span>
                    <span className="px-2 py-0.5 bg-[#F1ECE2] text-[10px] font-bold uppercase tracking-[0.12em]">MBTI {inspectingPreset.mbti}</span>
                    <span className="px-2 py-0.5 bg-[#F1ECE2] text-[10px] font-bold uppercase tracking-[0.12em]">{inspectingPreset.status}</span>
                  </div>
                  <h1 className="mt-3 text-[32px] sm:text-[38px] font-extrabold leading-none tracking-[-0.02em]">{inspectingPreset.name}</h1>
                  <p className="mt-2 text-[16px] font-semibold text-[#E8561F]">{inspectingPreset.title}</p>
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#EFE6D6] text-[13px]">
                    {[
                      ["Race", inspectingPreset.race],
                      ["Age", inspectingPreset.age],
                      ["Gender", inspectingPreset.gender],
                      ["Group", inspectingPreset.group],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">{k}</p>
                        <p className="mt-0.5 font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">Archetype · {inspectingPreset.archetype}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inspectingPreset.traits.map((trait, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-[#F1ECE2] text-[10px] font-bold uppercase tracking-[0.08em]" style={{ transform: `rotate(${idx % 2 ? 1 : -1}deg)` }}>
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ["Core goal", inspectingPreset.goal, "#F7E3A6"],
                  ["Conflict", inspectingPreset.conflict, "#F4DCCB"],
                  ["Inciting trauma", inspectingPreset.trauma, "#E3E6DC"],
                ].map(([k, v, bg], i) => (
                  <div key={k} className="relative p-4 shadow-[0_10px_18px_-14px_rgba(14,29,38,0.6)]" style={{ background: bg, transform: `rotate(${[-1, 0.5, -0.5][i]}deg)` }}>
                    <p className="font-['Caveat'] text-[22px] font-bold leading-none">{k}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#0E1D26]/75">{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">Backstory & origins</p>
                <p
                  className="mt-2 text-[14px] leading-[26px] text-[#0E1D26]/80"
                  style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 25px, rgba(14,29,38,0.08) 25px 26px)" }}
                >
                  {inspectingPreset.backstory}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">Appearance</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#0E1D26]/70">{inspectingPreset.physicalAppearance}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ["Signature ability", inspectingPreset.signatureAbility],
                  ["Gear & relics", inspectingPreset.gear],
                ].map(([k, v]) => (
                  <div key={k} className="p-4 rounded-2xl bg-[#F6F1E7]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">{k}</p>
                    <p className="mt-1 text-[13px] font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#EFE6D6] flex items-center justify-between">
              <button onClick={() => setInspectingPreset(null)} className="h-10 px-5 rounded-full text-[13px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#F1ECE2] cursor-pointer">
                Back to list
              </button>
              <button
                onClick={() => {
                  const preset = inspectingPreset;
                  setInspectingPreset(null);
                  onSelectPreset(preset, false);
                  onClose();
                }}
                className="h-11 pl-5 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2.5 cursor-pointer"
              >
                {actionLabel}
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

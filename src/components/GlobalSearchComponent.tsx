import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Replace, Check, X, ArrowRight, BookOpen, Users, MapPin, 
  StickyNote, Filter, ChevronRight, AlertCircle, RefreshCw,
  SlidersHorizontal, CheckSquare, Square
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { storage, ProjectData } from "@/lib/storage";
import { 
  searchProject, executeBatchReplace, SearchResultItem, SearchOptions 
} from "@/lib/globalSearch";

interface GlobalSearchProps {
  projectId: string;
  initialQuery?: string;
  isModal?: boolean;
  onClose?: () => void;
  onNavigateToScene?: (sceneId: string, highlightWord?: string) => void;
}

export default function GlobalSearchComponent({
  projectId,
  initialQuery = "",
  isModal = false,
  onClose,
  onNavigateToScene
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  
  // Search state
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeSourceFilter, setActiveSourceFilter] = useState<'all' | 'manuscript' | 'character' | 'location' | 'note' | 'bible'>('all');
  
  // Mode: 'search' or 'replace'
  const [mode, setMode] = useState<'search' | 'replace'>('search');
  
  // Selected matches for replacement
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceSuccessMsg, setReplaceSuccessMsg] = useState<string | null>(null);
  const [replaceErrorMsg, setReplaceErrorMsg] = useState<string | null>(null);

  // Load project data
  const loadData = () => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      setProjectData(data);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Execute search
  const allResults = useMemo(() => {
    if (!projectData || !query.trim()) return [];
    const options: SearchOptions = {
      caseSensitive,
      wholeWord,
    };
    return searchProject(projectData, query, options);
  }, [projectData, query, caseSensitive, wholeWord]);

  // Filter results by source tab
  const filteredResults = useMemo(() => {
    if (activeSourceFilter === 'all') return allResults;
    return allResults.filter(r => r.sourceType === activeSourceFilter);
  }, [allResults, activeSourceFilter]);

  // Auto-select all results when results change in replace mode
  useEffect(() => {
    if (allResults.length > 0) {
      setSelectedIds(new Set(allResults.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [allResults]);

  // Handle item selection toggle
  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredResults.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Perform replacement
  const [undoSnapshot, setUndoSnapshot] = useState<any | null>(null);

  const handleExecuteReplace = () => {
    if (!query.trim() || selectedIds.size === 0) return;
    // Only matches that are both selected and currently in the results are replaced
    const chosen = allResults.filter(r => selectedIds.has(r.id));
    if (chosen.length === 0) return;
    if (!window.confirm(`Replace ${chosen.length} selected ${chosen.length === 1 ? "match" : "matches"} of "${query}" with "${replacement}"?`)) return;

    setIsReplacing(true);
    try {
      const res = executeBatchReplace(
        projectId,
        query,
        replacement,
        chosen,
        { caseSensitive, wholeWord }
      );

      setUndoSnapshot(res.previousData);
      setReplaceSuccessMsg(`Replaced ${res.updatedCount} ${res.updatedCount === 1 ? "occurrence" : "occurrences"}.`);
      setReplaceErrorMsg(null);
      setProjectData(res.projectData);
      window.dispatchEvent(new CustomEvent('novelist-storage-updated'));

      setTimeout(() => {
        setReplaceSuccessMsg(null);
      }, 12000);
    } catch (err: any) {
      setReplaceErrorMsg("An error occurred during replacement: " + (err?.message || "Unknown error"));
      setTimeout(() => setReplaceErrorMsg(null), 5000);
    } finally {
      setIsReplacing(false);
    }
  };

  // Result navigation
  const handleResultClick = (res: SearchResultItem) => {
    const highlightWord = res.matchText || query;
    if (res.sourceType === 'manuscript') {
      if (onNavigateToScene) {
        onNavigateToScene(res.targetId, highlightWord);
        if (onClose) onClose();
      } else {
        navigate(`/project/${projectId}/workspace/studio?scene=${res.targetId}&highlight=${encodeURIComponent(highlightWord)}`);
        if (onClose) onClose();
      }
    } else if (res.sourceType === 'character') {
      navigate(`/project/${projectId}/characters`);
      if (onClose) onClose();
    } else if (res.sourceType === 'location') {
      navigate(`/project/${projectId}/workspace/locations`);
      if (onClose) onClose();
    } else if (res.sourceType === 'note') {
      navigate(`/project/${projectId}/workspace/studio?scene=${res.targetId}&tab=notes&highlight=${encodeURIComponent(highlightWord)}`);
      if (onClose) onClose();
    } else if (res.sourceType === 'bible') {
      navigate(`/project/${projectId}/workspace/bible`);
      if (onClose) onClose();
    }
  };

  // Icon mapping
  const getSourceIcon = (type: SearchResultItem['sourceType']) => {
    switch (type) {
      case 'manuscript': return <BookOpen className="w-3.5 h-3.5 text-[#8C503C]" />;
      case 'character': return <Users className="w-3.5 h-3.5 text-[#5A9672]" />;
      case 'location': return <MapPin className="w-3.5 h-3.5 text-[#4A7BB0]" />;
      case 'note': return <StickyNote className="w-3.5 h-3.5 text-[#D49A89]" />;
      case 'bible': return <BookOpen className="w-3.5 h-3.5 text-[#965A5A]" />;
    }
  };

  const getSourceBadgeLabel = (type: SearchResultItem['sourceType']) => {
    switch (type) {
      case 'manuscript': return 'Manuscript';
      case 'character': return 'Character';
      case 'location': return 'Location';
      case 'note': return 'Notes';
      case 'bible': return 'Story Bible';
    }
  };

  // Counts by source
  const sourceCounts = useMemo(() => {
    const counts = { all: allResults.length, manuscript: 0, character: 0, location: 0, note: 0, bible: 0 };
    for (const r of allResults) {
      counts[r.sourceType] = (counts[r.sourceType] || 0) + 1;
    }
    return counts;
  }, [allResults]);

  return (
    <div className={`flex flex-col h-full bg-[#F4F1EA] text-[#332218] ${isModal ? 'p-0' : 'p-6 lg:p-8'}`}>
      {/* Top Header */}
      <div className={`flex items-center justify-between border-b border-[#E5E0D5] bg-[#FCFAF5] ${isModal ? 'p-4' : 'p-6 rounded-t-xl shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#8C503C]/10 border border-[#8C503C]/20 flex items-center justify-center text-[#8C503C]">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-serif font-bold text-[#332218] flex items-center gap-2">
              Global Search & Replace
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider bg-[#EDE8DC] text-[#7A5848] px-2 py-0.5 rounded-full">
                Global Search
              </span>
            </h1>
            <p className="text-xs text-stone-500 font-sans">
              Search and batch rename across manuscript, character profiles, locations, and notes
            </p>
          </div>
        </div>

        {/* Search / Replace Tab switch */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#EDE8DC] p-0.5 rounded-lg">
            <button
              onClick={() => setMode('search')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'search'
                  ? 'bg-white text-[#8C503C] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              onClick={() => setMode('replace')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                mode === 'replace'
                  ? 'bg-white text-[#8C503C] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Replace className="w-3.5 h-3.5" />
              Rename / Replace
            </button>
          </div>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-[#E5E0D5] rounded-lg transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Search Inputs Area */}
      <div className="bg-[#FCFAF5] border-b border-[#E5E0D5] p-4 lg:p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Query input */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Search Query
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search character names, locations, dialogue, or keywords (e.g. Aiden, Greyhaven)..."
                className="w-full bg-white border border-[#E5E0D5] rounded-lg pl-9 pr-8 py-2 text-sm text-[#332218] font-serif placeholder:text-stone-400 focus:outline-none focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C]/20 shadow-xs"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Replacement input (if in replace mode) */}
          {mode === 'replace' ? (
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Replace With
              </label>
              <div className="relative">
                <Replace className="w-4 h-4 text-[#8C503C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  placeholder="New name or replacement text (e.g. Kaelen)..."
                  className="w-full bg-white border border-[#E5E0D5] rounded-lg pl-9 pr-8 py-2 text-sm text-[#332218] font-serif placeholder:text-stone-400 focus:outline-none focus:border-[#8C503C] focus:ring-1 focus:ring-[#8C503C]/20 shadow-xs"
                />
                {replacement && (
                  <button
                    onClick={() => setReplacement("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3 pb-1 text-xs text-stone-500">
              <p>Tip: Quickly search dialogue passages, plot points, or entities across your novel.</p>
            </div>
          )}
        </div>

        {/* Options & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs border-t border-[#EDE8DC]">
          {/* Match Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-600 hover:text-stone-900 select-none">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded border-[#E5E0D5] text-[#8C503C] focus:ring-[#8C503C]"
              />
              <span>Match Case</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-600 hover:text-stone-900 select-none">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="rounded border-[#E5E0D5] text-[#8C503C] focus:ring-[#8C503C]"
              />
              <span>Whole Word</span>
            </label>
          </div>

          {/* Source Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {(['all', 'manuscript', 'character', 'location', 'note', 'bible'] as const).map((source) => {
              const count = sourceCounts[source] || 0;
              const labels: Record<string, string> = {
                all: 'All',
                manuscript: 'Manuscript',
                character: 'Characters',
                location: 'Locations',
                note: 'Notes',
                bible: 'Story Bible',
              };
              return (
                <button
                  key={source}
                  onClick={() => setActiveSourceFilter(source)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all flex items-center gap-1.5 ${
                    activeSourceFilter === source
                      ? 'bg-[#8C503C] text-white shadow-xs'
                      : 'bg-stone-200/70 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  <span>{labels[source]}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeSourceFilter === source ? 'bg-white/20 text-white' : 'bg-white text-stone-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {replaceSuccessMsg && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{replaceSuccessMsg}</span>
            {undoSnapshot && (
              <button
                onClick={() => {
                  storage.saveProjectData(projectId, undoSnapshot);
                  setProjectData(undoSnapshot);
                  setUndoSnapshot(null);
                  setReplaceSuccessMsg("Replacement undone.");
                  window.dispatchEvent(new CustomEvent('novelist-storage-updated'));
                }}
                className="ml-2 px-2.5 py-0.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold"
              >
                Undo
              </button>
            )}
          </div>
          <button onClick={() => setReplaceSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {replaceErrorMsg && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{replaceErrorMsg}</span>
          </div>
          <button onClick={() => setReplaceErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batch Replace Action Bar (visible in Replace mode) */}
      {mode === 'replace' && allResults.length > 0 && (
        <div className="bg-[#EDE8DC]/80 border-b border-[#E5E0D5] px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={selectedIds.size === filteredResults.length ? deselectAll : selectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#8C503C] hover:underline"
            >
              {selectedIds.size === filteredResults.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedIds.size === filteredResults.length ? "Deselect all" : "Select all results"}
            </button>
            <span className="text-xs text-stone-500">
              Selected <b>{selectedIds.size}</b> / {filteredResults.length} occurrences
            </span>
          </div>

          <button
            onClick={handleExecuteReplace}
            disabled={isReplacing || selectedIds.size === 0 || !query.trim()}
            className="px-4 py-1.5 bg-[#8C503C] hover:bg-[#723E2E] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            {isReplacing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Replacing...
              </>
            ) : (
              <>
                <Replace className="w-3.5 h-3.5" />
                Replace {selectedIds.size} selected items
              </>
            )}
          </button>
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3 custom-scrollbar">
        {!query.trim() ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-stone-400">
            <Search className="w-10 h-10 mb-2 opacity-30 stroke-[1.5]" />
            <p className="font-serif text-sm text-stone-500">Type a keyword above to search across your entire project</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm">
              Searches manuscript scenes, character profiles, locations, notes, and Story Bible simultaneously.
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-stone-400">
            <AlertCircle className="w-8 h-8 mb-2 opacity-40 text-stone-400" />
            <p className="font-serif text-sm text-stone-600">No matching results found for "{query}"</p>
            <p className="text-xs text-stone-400 mt-1">
              Try toggling "Match Case" off or checking for typos.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span>Found <b>{filteredResults.length}</b> results for "<b>{query}</b>"</span>
              <span className="text-[11px] italic">Click a result card to jump directly to it</span>
            </div>

            {filteredResults.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={`search-res-${item.id}-${index}`}
                  onClick={() => handleResultClick(item)}
                  className={`group p-3.5 bg-white border rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md ${
                    mode === 'replace' && isSelected
                      ? 'border-[#8C503C]/60 ring-1 ring-[#8C503C]/20'
                      : 'border-[#E5E0D5] hover:border-[#8C503C]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox for replace mode */}
                    {mode === 'replace' && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(item.id);
                        }}
                        className="pt-0.5 text-stone-400 hover:text-[#8C503C]"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#8C503C]" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-300" />
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-stone-800">
                          {getSourceIcon(item.sourceType)}
                          {item.sourceTitle}
                        </span>
                        {item.sourceSubtitle && (
                          <span className="text-[10px] text-stone-400 truncate">
                            • {item.sourceSubtitle}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/90 rounded-xs flex items-center gap-1">
                          <span className="font-bold">{item.sectionLabel || getSourceBadgeLabel(item.sourceType)}</span>
                          {item.paragraphNumber ? <span>• Para {item.paragraphNumber}</span> : null}
                          {item.lineNumber ? <span className="opacity-80">(Line ~{item.lineNumber})</span> : null}
                        </span>
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#F4F1EA] text-stone-600 rounded">
                          {getSourceBadgeLabel(item.sourceType)}
                        </span>
                      </div>

                      {/* Text Snippet with Highlight */}
                      <p className="text-xs text-stone-700 font-serif leading-relaxed line-clamp-2 mt-1">
                        {item.snippetBefore}
                        <mark className="bg-amber-200 text-amber-950 font-semibold px-1 py-0.2 rounded-xs border border-amber-300">
                          {item.matchText}
                        </mark>
                        {item.snippetAfter}
                      </p>

                      {/* Replace Preview (if replace mode and replacement has text) */}
                      {mode === 'replace' && replacement && (
                        <div className="mt-2 pt-2 border-t border-dashed border-stone-200 flex items-center gap-2 text-xs text-stone-500 font-serif">
                          <span className="text-[10px] font-sans uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Will change to:
                          </span>
                          <span className="line-through text-stone-400">{item.matchText}</span>
                          <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                            {replacement}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 group-hover:text-[#8C503C] shrink-0 pt-1">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

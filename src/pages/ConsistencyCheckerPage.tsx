import React, { useState, useEffect, useMemo } from "react";
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Info, Check, Search, 
  ArrowRight, RefreshCw, BookOpen, Users, MapPin, Filter, 
  ChevronRight, BarChart3, Repeat, Clock, HelpCircle, PlusCircle, 
  CheckCircle2, ExternalLink
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { storage, ProjectData } from "@/lib/storage";
import { 
  analyzeProjectConsistency, ConsistencyAnalysisResult, ContinuityIssue,
  OverusedWordStat, WordEcho, getAllScenes
} from "@/lib/consistencyChecker";
import { executeBatchReplace, searchProject } from "@/lib/globalSearch";
import GlobalSearchModal from "@/components/GlobalSearchModal";
import UpgradeModal from "@/components/UpgradeModal";
import { PLAN_LIMITS } from "@/lib/license";
import { Lock } from "lucide-react";

export default function ConsistencyCheckerPage() {
  const { id = "1" } = useParams();
  const navigate = useNavigate();

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedSceneFilter, setSelectedSceneFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<'continuity' | 'repetitive'>('continuity');
  const [issueFilter, setIssueFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Global Search Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");

  // License check for OTO2 Continuity Engine
  const userProfile = storage.getUserProfile();
  const currentPlan = userProfile?.plan || 'free';
  const hasContinuityEngine = PLAN_LIMITS[currentPlan]?.hasContinuityEngine ?? false;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Load project data
  const loadData = () => {
    if (id) {
      const data = storage.getProjectData(id);
      setProjectData(data);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // All scenes list for the dropdown filter
  const allScenes = useMemo(() => {
    if (!projectData?.manuscript) return [];
    return getAllScenes(projectData.manuscript);
  }, [projectData]);

  // Run analysis
  const analysisResult = useMemo<ConsistencyAnalysisResult | null>(() => {
    if (!projectData) return null;
    return analyzeProjectConsistency(
      projectData, 
      selectedSceneFilter === "all" ? undefined : selectedSceneFilter
    );
  }, [projectData, selectedSceneFilter]);

  // Filter issues by severity
  const filteredIssues = useMemo(() => {
    if (!analysisResult) return [];
    if (issueFilter === 'all') return analysisResult.issues;
    return analysisResult.issues.filter(i => i.severity === issueFilter);
  }, [analysisResult, issueFilter]);

  // Quick Action: Fix Name Typo
  const handleFixTypo = (issue: ContinuityIssue) => {
    if (!issue.replacementData || !id) return;
    const { findText, replaceText, sceneId } = issue.replacementData;

    try {
      // Fix every occurrence of the typo in that scene's text
      const data = storage.getProjectData(id);
      const matches = data
        ? searchProject(data, findText, { wholeWord: true, sourceTypes: ['manuscript'] }).filter(
            (r) => r.targetId === sceneId && r.field === 'content'
          )
        : [];
      executeBatchReplace(id, findText, replaceText, matches, { wholeWord: true });
      
      setActionSuccessMsg(`Successfully fixed "${findText}" to "${replaceText}".`);
      setActionErrorMsg(null);
      loadData();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (e: any) {
      setActionErrorMsg("Unable to automatically correct typo: " + (e?.message || "Unknown error"));
      setTimeout(() => setActionErrorMsg(null), 5000);
    }
  };

  // Quick Action: Add Unregistered Character
  const handleAddCharacter = (issue: ContinuityIssue) => {
    if (!issue.entityName || !id || !projectData) return;
    const charName = issue.entityName.trim();

    const newChar = {
      id: String(Date.now()),
      name: charName,
      role: "Supporting Character",
      description: `Discovered in scene "${issue.sceneTitle || 'Manuscript'}".`,
      age: "Unknown",
      motivation: "To be explored",
      locationId: "",
      traits: ["Mysterious"],
    };

    const updatedChars = [...(projectData.characters || []), newChar];
    storage.saveProjectData(id, { characters: updatedChars });
    
    setActionSuccessMsg(`Created character profile for "${charName}".`);
    loadData();
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Open Global Search for a repetitive word
  const handleInspectWordInSearch = (word: string) => {
    setSearchInitialQuery(word);
    setSearchModalOpen(true);
  };

  // Health score color
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col bg-[#F4F1EA] text-[#332218]">
      {/* Top Banner Header */}
      <div className="bg-[#FCFAF5] border-b border-[#E5E0D5] p-6 shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#8C503C]/10 border border-[#8C503C]/20 flex items-center justify-center text-[#8C503C] shadow-xs">
              <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif font-bold text-[#332218]">
                  Consistency & Continuity Checker
                </h1>
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider bg-[#EDE8DC] text-[#7A5848] px-2.5 py-0.5 rounded-full">
                  Continuity & Quality
                </span>
              </div>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                Automatically checks location conflicts, unregistered entities, name typos, and repetitive word echoes
              </p>
            </div>
          </div>

          {/* Scope selector & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white border border-[#E5E0D5] rounded-lg px-2.5 py-1.5 shadow-xs">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-xs text-stone-500 font-medium">Scope:</span>
              <select
                value={selectedSceneFilter}
                onChange={(e) => setSelectedSceneFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-[#332218] focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="all">Entire Manuscript ({allScenes.length} scenes)</option>
                {allScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setIsAnalyzing(true);
                loadData();
                setTimeout(() => setIsAnalyzing(false), 500);
              }}
              className="p-2 bg-white hover:bg-stone-50 border border-[#E5E0D5] text-stone-600 rounded-lg shadow-xs transition-colors"
              title="Re-run analysis"
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin text-[#8C503C]' : ''}`} />
            </button>

            <button
              onClick={() => {
                setSearchInitialQuery("");
                setSearchModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search & Replace</span>
            </button>
          </div>
        </div>

        {/* Health Score and Quick Stats Bar */}
        {analysisResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#EDE8DC]">
            {/* Score Card */}
            <div className={`p-3 rounded-xl border flex items-center gap-3 ${getScoreColor(analysisResult.overallHealthScore)}`}>
              <div className="text-2xl font-serif font-bold">
                {analysisResult.overallHealthScore}%
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Consistency Score
                </div>
                <div className="text-xs font-semibold">
                  {analysisResult.overallHealthScore >= 85 ? 'Excellent' : analysisResult.overallHealthScore >= 70 ? 'Needs Polish' : 'Conflicts Found'}
                </div>
              </div>
            </div>

            {/* Total Issues */}
            <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-base">
                {analysisResult.issues.length}
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Logic Issues
                </div>
                <div className="text-xs font-semibold text-stone-700">
                  {analysisResult.issues.filter(i => i.severity === 'high').length} high severity
                </div>
              </div>
            </div>

            {/* Echoes Detected */}
            <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold text-base">
                {analysisResult.echoes.length}
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Word Echoes
                </div>
                <div className="text-xs font-semibold text-stone-700">
                  Within same paragraph
                </div>
              </div>
            </div>

            {/* Words & Rhythm */}
            <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F4F1EA] text-[#8C503C] flex items-center justify-center font-bold text-base">
                {analysisResult.sentenceRhythm.avgSentenceLength}
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Avg Sentence Length
                </div>
                <div className="text-xs font-semibold text-stone-700">
                  {analysisResult.totalWordCount.toLocaleString()} words scanned
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success alert message */}
      {actionSuccessMsg && (
        <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            &times;
          </button>
        </div>
      )}

      {/* Error alert message */}
      {actionErrorMsg && (
        <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-rose-600 hover:text-rose-900">
            &times;
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="px-6 pt-3 bg-[#F4F1EA] border-b border-[#E5E0D5] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('continuity')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'continuity'
                ? 'bg-[#FCFAF5] text-[#8C503C] border-[#E5E0D5] -mb-px'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Logic & Continuity Conflicts</span>
            {!hasContinuityEngine && (
              <span className="text-[9px] bg-[#8C503C] text-white px-1.5 py-0.2 rounded-xs font-mono font-bold flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Premium
              </span>
            )}
            {analysisResult && hasContinuityEngine && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans ${
                analysisResult.issues.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {analysisResult.issues.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('repetitive')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
              activeTab === 'repetitive'
                ? 'bg-[#FCFAF5] text-[#8C503C] border-[#E5E0D5] -mb-px'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>Repetition & Prose Cadence</span>
            {!hasContinuityEngine && (
              <span className="text-[9px] bg-[#8C503C] text-white px-1.5 py-0.2 rounded-xs font-mono font-bold flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Premium
              </span>
            )}
            {analysisResult && hasContinuityEngine && (
              <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full font-sans">
                {analysisResult.echoes.length + analysisResult.overusedWords.length}
              </span>
            )}
          </button>
        </div>

        {/* Issue Filter Chips (if in continuity tab) */}
        {activeTab === 'continuity' && (
          <div className="flex items-center gap-1 pb-2">
            {(['all', 'high', 'medium', 'low'] as const).map((lvl) => {
              const labels = { all: 'All', high: 'High', medium: 'Medium', low: 'Low' };
              return (
                <button
                  key={lvl}
                  onClick={() => setIssueFilter(lvl)}
                  className={`px-2.5 py-1 text-[11px] rounded-full font-medium transition-all ${
                    issueFilter === lvl
                      ? 'bg-[#8C503C] text-white shadow-xs'
                      : 'bg-stone-200/60 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {labels[lvl]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#FCFAF5] custom-scrollbar">
        {!hasContinuityEngine ? (
          <div className="max-w-xl mx-auto my-12 p-8 bg-[#FAF8F5] border-2 border-[#8C503C]/30 rounded-2xl shadow-sm text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#8C503C]/10 border border-[#8C503C]/20 flex items-center justify-center text-[#8C503C]">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#8C503C] text-white">
                Premium Edition
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#4A3225]">
                Consistency Checker
              </h2>
              <p className="text-xs font-serif text-stone-600 leading-relaxed max-w-md mx-auto">
                Checking your manuscript against your Story Bible, plus word echo and sentence rhythm scanning, is part of <strong>Premium Edition ($97)</strong>.
              </p>
            </div>

            <div className="bg-white border border-[#E5E0D5] p-4 rounded-xl text-left space-y-2 text-xs font-serif text-stone-700">
              <div className="font-bold text-[#8C503C] text-[11px] uppercase tracking-wider mb-1">
                Included in Premium Edition:
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#5A9672] shrink-0" />
                <span>Misspelled names, unregistered names and characters who reappear after their death</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#5A9672] shrink-0" />
                <span>Repetitive word echo detection within tight paragraph windows</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#5A9672] shrink-0" />
                <span>Repetitive sentence rhythm detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#5A9672] shrink-0" />
                <span>AI Prompt Hub: ready-made prompts for ChatGPT, Claude & Gemini</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-6 py-2.5 bg-[#8C503C] hover:bg-[#723F2F] text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Upgrade to Premium Edition ($97)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* TAB 1: CONTINUITY & LOGIC CONFLICTS                     */}
            {/* ======================================================== */}
            {activeTab === 'continuity' && (
          <div className="space-y-3 max-w-5xl mx-auto">
            {filteredIssues.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                  <Check className="w-7 h-7 stroke-[2.5]" />
                </div>
                <h3 className="font-serif font-bold text-base text-stone-800">
                  No logic conflicts detected!
                </h3>
                <p className="text-xs text-stone-500 max-w-md mt-1 font-sans">
                  All characters, locations, and narrative continuity in the selected scope are consistent.
                </p>
              </div>
            ) : (
              filteredIssues.map((issue, idx) => {
                const getSeverityStyle = (s: ContinuityIssue['severity']) => {
                  switch (s) {
                    case 'high':
                      return {
                        border: 'border-rose-300 bg-rose-50/40',
                        badge: 'bg-rose-100 text-rose-800 border-rose-200',
                        label: 'High',
                        icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      };
                    case 'medium':
                      return {
                        border: 'border-amber-300 bg-amber-50/40',
                        badge: 'bg-amber-100 text-amber-800 border-amber-200',
                        label: 'Warning',
                        icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      };
                    default:
                      return {
                        border: 'border-blue-200 bg-blue-50/30',
                        badge: 'bg-blue-100 text-blue-800 border-blue-200',
                        label: 'Notice',
                        icon: <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      };
                  }
                };
                const style = getSeverityStyle(issue.severity);

                return (
                  <div
                    key={`issue-${issue.id}-${idx}`}
                    className={`p-4 rounded-xl border ${style.border} bg-white shadow-xs transition-all hover:shadow-md space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {style.icon}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.badge}`}>
                              {style.label}
                            </span>
                            <h4 className="text-sm font-bold text-[#332218] font-serif">
                              {issue.title}
                            </h4>
                          </div>
                          {issue.sceneTitle && (
                            <button
                              onClick={() => navigate(`/project/${id}/workspace/studio?scene=${issue.sceneId}`)}
                              className="text-[11px] text-[#8C503C] hover:underline font-medium flex items-center gap-1 mt-1"
                            >
                              <BookOpen className="w-3 h-3" />
                              Scene: {issue.sceneTitle}
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {issue.fixAction === 'replace_text' && issue.suggestedFix && (
                          <button
                            onClick={() => handleFixTypo(issue)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {issue.suggestedFix}
                          </button>
                        )}
                        {issue.fixAction === 'add_character' && (
                          <button
                            onClick={() => handleAddCharacter(issue)}
                            className="px-3 py-1 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Create Character Profile
                          </button>
                        )}
                        {issue.sceneId && (
                          <button
                            onClick={() => navigate(`/project/${id}/workspace/studio?scene=${issue.sceneId}`)}
                            className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-[#E5E0D5] text-stone-700 text-xs font-medium rounded-lg transition-colors"
                          >
                            Open Scene
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 font-sans leading-relaxed pl-6.5">
                      {issue.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: REPETITIVE WORDS & ECHOES                         */}
        {/* ======================================================== */}
        {activeTab === 'repetitive' && analysisResult && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Top Overview: Echoes warning */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed font-sans">
                <b>Understanding Word Echoes:</b> When a prominent descriptive word, noun, or verb appears two or more times in close proximity within a single paragraph, it can sound repetitive to readers. Consider substituting one of the occurrences with a synonym or reframing the sentence structure.
              </div>
            </div>

            {/* Echoes List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-sm text-[#332218] flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-[#8C503C]" />
                  Paragraphs with Close-Proximity Word Echoes ({analysisResult.echoes.length})
                </h3>
                <span className="text-[11px] text-stone-500">
                  Filters words repeated within the same paragraph
                </span>
              </div>

              {analysisResult.echoes.length === 0 ? (
                <div className="p-6 bg-white border border-[#E5E0D5] rounded-xl text-center text-xs text-stone-500">
                  No significant close-proximity word echoes detected in this scope!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {analysisResult.echoes.map((echo, eIdx) => (
                    <div
                      key={`echo-${echo.id}-${eIdx}`}
                      className="p-3.5 bg-white border border-[#E5E0D5] hover:border-[#8C503C]/40 rounded-xl shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-xs rounded border border-rose-200">
                            "{echo.word}" (repeated {echo.count} times)
                          </span>
                          <span className="text-[11px] text-stone-500 font-medium">
                            {echo.sceneTitle} • Paragraph #{echo.paragraphIndex}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 font-serif leading-relaxed line-clamp-2">
                          {echo.snippet}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleInspectWordInSearch(echo.word)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                          title="Search and replace this word across project"
                        >
                          <Search className="w-3 h-3 text-[#8C503C]" />
                          Replace Word
                        </button>
                        <button
                          onClick={() => navigate(`/project/${id}/workspace/studio?scene=${echo.sceneId}`)}
                          className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-[#E5E0D5] text-[#8C503C] text-xs font-semibold rounded-lg transition-colors"
                        >
                          Go to Scene
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overused Words Ranking */}
            <div className="pt-4 border-t border-[#EDE8DC]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-sm text-[#332218] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#8C503C]" />
                  Top Most Frequent Content Words (Stop words excluded)
                </h3>
                <span className="text-[11px] text-stone-500">
                  Showing frequency and usage context
                </span>
              </div>

              {analysisResult.overusedWords.length === 0 ? (
                <div className="p-6 bg-white border border-[#E5E0D5] rounded-xl text-center text-xs text-stone-500">
                  Not enough text data to compute word frequency statistics.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisResult.overusedWords.map((item, idx) => (
                    <div
                      key={item.word}
                      className="p-3 bg-white border border-[#E5E0D5] rounded-xl shadow-xs flex items-center justify-between gap-3 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#F4F1EA] text-[#8C503C] flex items-center justify-center font-bold text-xs shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm font-serif text-[#332218]">
                              {item.word}
                            </span>
                            <span className="text-[10px] text-stone-400 font-sans">
                              ({item.count} times • {item.frequency}%)
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 italic truncate font-serif mt-0.5">
                            {item.sampleContext}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInspectWordInSearch(item.word)}
                        className="p-1.5 text-stone-400 hover:text-[#8C503C] hover:bg-stone-100 rounded-lg transition-colors shrink-0"
                        title="Search in entire project"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sentence Rhythm Stats */}
            <div className="pt-4 border-t border-[#EDE8DC]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-sm text-[#332218] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#8C503C]" />
                  Sentence Rhythm Analysis
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl">
                  <div className="text-xl font-serif font-bold text-[#8C503C]">
                    {analysisResult.sentenceRhythm.shortSentencesCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-stone-500 mt-0.5">
                    Short (&lt; 10 words)
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl">
                  <div className="text-xl font-serif font-bold text-emerald-700">
                    {analysisResult.sentenceRhythm.mediumSentencesCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-stone-500 mt-0.5">
                    Medium (10 - 25 words)
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#E5E0D5] rounded-xl">
                  <div className="text-xl font-serif font-bold text-stone-700">
                    {analysisResult.sentenceRhythm.longSentencesCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-stone-500 mt-0.5">
                    Long (&gt; 25 words)
                  </div>
                </div>
              </div>

              {analysisResult.sentenceRhythm.monotonyAlerts.map((alertText, i) => (
                <div key={i} className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{alertText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Global Search Modal for Instant Word Investigation */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        projectId={id}
        initialQuery={searchInitialQuery}
      />

      {/* OTO2 Continuity Engine Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="continuity"
      />
    </div>
  );
}

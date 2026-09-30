import { Fragment, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BookCover,
  BookMockup,
  coverPaletteFor,
  hashSeed,
  IconArrow,
  IconArrowUpRight,
  IconBookWave,
  IconClock,
  IconClose,
  IconExpand,
  IconFlame,
  IconGear,
  IconPerson,
  IconPin,
  IconPlus,
  IconQuill,
  IconRefresh,
  IconScenes,
  IconSearch,
  IconShield,
  IconSpinner,
  IconTick,
  IconTrash,
  Tag,
} from "@/components/brand/ocean-ui";
import { ManuscriptItem } from "@/mockData";
import { cn } from "@/lib/utils";
import { storage, ProjectMeta, StudioTask, UserProfile } from "@/lib/storage";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { TimelineSettingsModal } from "@/components/TimelineSettingsModal";
import UpgradeModal from "@/components/UpgradeModal";
import { PLAN_LIMITS } from "@/lib/license";

import { isUserAdmin } from "@/lib/adminService";

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const navigate = useNavigate();

  const [savedProjects, setSavedProjects] = useState<ProjectMeta[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectMeta | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Check quota & license edition for projects
  const [userProfile, setUserProfile] = useState<UserProfile>(() => storage.getUserProfile());
  const currentPlan = userProfile?.plan || 'free';
  const maxAllowedProjects = PLAN_LIMITS[currentPlan].maxProjects;

  const versionBadge = useMemo(() => {
    switch (currentPlan) {
      case 'master':
        return {
          label: 'PREMIUM',
          style: 'bg-[#241711] text-[#E5BF7C] border-[#5A3C28] ring-1 ring-[#D4A359]/40 shadow-xs hover:bg-[#1A100B]',
          tooltip: 'Premium Edition — Full Unrestricted Access',
        };
      case 'pro':
        return {
          label: 'PRO',
          style: 'bg-[#8C503C] text-[#FFF9F2] border-[#723F2F] shadow-xs hover:bg-[#773E2E]',
          tooltip: 'Pro Edition — Unlimited Manuscripts & 50+ Art Library',
        };
      case 'free':
      default:
        return {
          label: 'REGULAR',
          style: 'bg-[#EAE4D8] text-[#5C4738] border-[#D4CCBE] hover:bg-[#DFD8CB] hover:border-[#8C503C]/40',
          tooltip: 'Regular Edition — Max 3 Active Projects',
        };
    }
  }, [currentPlan]);

  const handleNewProjectClick = () => {
    if (savedProjects.length >= maxAllowedProjects) {
      setShowUpgradeModal(true);
    } else {
      navigate("/create");
    }
  };

  // Real Tasks State (synced with LocalStorage)
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskType, setNewTaskType] = useState<StudioTask['type']>("writing");
  const [newTaskUrgency, setNewTaskUrgency] = useState<StudioTask['urgency']>("medium");

  // Auth & Per-User Data Sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (u && !u.isAnonymous) {
        storage.switchUser(u.uid, u.email, u.displayName);
        await storage.syncFromCloud(u.uid);
        setUserProfile(storage.getUserProfile());
        const projs = storage.getProjects().sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        setSavedProjects(projs);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        }
        setTasks(storage.getTasks());
      } else {
        storage.clearCache();
        setUserProfile(storage.getUserProfile());
        setSavedProjects([]);
        setTasks([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleProfileSync = () => {
      setUserProfile(storage.getUserProfile());
    };
    window.addEventListener('storage', handleProfileSync);
    window.addEventListener('focus', handleProfileSync);
    window.addEventListener('novelist-storage-updated', handleProfileSync);
    return () => {
      window.removeEventListener('storage', handleProfileSync);
      window.removeEventListener('focus', handleProfileSync);
      window.removeEventListener('novelist-storage-updated', handleProfileSync);
    };
  }, []);

  // World Radar Expand Modal State
  const [isRadarExpanded, setIsRadarExpanded] = useState(false);
  const [radarSearch, setRadarSearch] = useState("");
  const [radarFilter, setRadarFilter] = useState<'all' | 'active' | 'silent'>('all');
  const [radarEntityType, setRadarEntityType] = useState<'all' | 'characters' | 'locations'>('all');
  const [miniRadarType, setMiniRadarType] = useState<'all' | 'characters' | 'locations'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  // Author Timeline & Stats Configuration Modal
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [timelineSettings, setTimelineSettings] = useState(() => storage.getTimelineSettings());

  useEffect(() => {
    const handleTimelineUpdate = () => {
      setTimelineSettings(storage.getTimelineSettings());
    };
    window.addEventListener('novelist-timeline-updated', handleTimelineUpdate);
    return () => window.removeEventListener('novelist-timeline-updated', handleTimelineUpdate);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isRadarExpanded) {
        setIsRadarExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRadarExpanded]);

  // Real-time synchronization when manuscript updates or tab gains focus
  useEffect(() => {
    const handleSync = () => {
      const updated = storage.getProjects().sort((a, b) => b.lastModified - a.lastModified);
      setSavedProjects(updated);
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('novelist-storage-updated', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('novelist-storage-updated', handleSync);
    };
  }, []);

  const handleManualScan = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsScanning(true);
    const updated = storage.getProjects().sort((a, b) => b.lastModified - a.lastModified);
    setSavedProjects(updated);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => setIsScanning(false), 500);
  };

  // Real Task Handlers
  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updated);
    storage.saveAllTasks(updated);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: StudioTask = {
      id: `task-${Date.now()}`,
      projectId: selectedProjectId || savedProjects[0]?.id,
      title: newTaskTitle.trim(),
      type: newTaskType,
      completed: false,
      urgency: newTaskUrgency,
      createdAt: Date.now(),
    };

    const updated = [newTask, ...tasks];
    setTasks(updated);
    storage.saveTask(newTask);
    setNewTaskTitle("");
    setIsAddingTask(false);
  };

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    storage.deleteTask(taskId);
  };

  const handleDeleteProject = async (proj: ProjectMeta) => {
    setIsDeletingProject(true);
    try {
      storage.deleteProject(proj.id);
      const updated = storage.getProjects().sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      setSavedProjects(updated);
      if (selectedProjectId === proj.id) {
        setSelectedProjectId(updated.length > 0 ? updated[0].id : null);
      }
      if (shelfOpenId === proj.id) setShelfOpenId(undefined);
      setProjectToDelete(null);
    } catch (err) {
      console.error("Error deleting book project:", err);
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Active / Most recent project
  const activeProject = useMemo(() => {
    if (selectedProjectId) {
      const found = savedProjects.find(p => p.id === selectedProjectId);
      if (found) return found;
    }
    return savedProjects.length > 0 ? savedProjects[0] : null;
  }, [savedProjects, selectedProjectId]);

  // Which book lies open on the shelf. Separate from the selected book so a book
  // can be closed again; undefined = default to the selected book.
  const [shelfOpenId, setShelfOpenId] = useState<string | null | undefined>(undefined);
  const openShelfId = shelfOpenId === undefined ? activeProject?.id ?? null : shelfOpenId;

  useEffect(() => {
    if (!openShelfId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"], .fixed.inset-0')) setShelfOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openShelfId]);

  // Project Data for active project (for actual manuscript & entities)
  const activeProjectData = useMemo(() => {
    if (!activeProject) return null;
    return storage.getProjectData(activeProject.id);
  }, [activeProject?.id, activeProject?.lastModified, refreshTrigger]);

  // Real Resume Drafting Stats
  const resumeStats = useMemo(() => {
    if (!activeProject) {
      return {
        chapters: 0,
        scenes: 0,
        currentSceneTitle: "No scenes yet",
        timeAgo: "Recently",
      };
    }

    const manuscript = activeProjectData?.manuscript || [];
    let chaptersCount = 0;
    let scenesCount = 0;
    let firstSceneTitle = "";

    const scanManuscript = (items: ManuscriptItem[]) => {
      for (const item of items) {
        if (item.type === "chapter") chaptersCount++;
        if (item.type === "scene") {
          scenesCount++;
          if (!firstSceneTitle) firstSceneTitle = item.title;
        }
        if (item.children) scanManuscript(item.children);
      }
    };
    scanManuscript(manuscript);

    // Calculate time ago
    const diffMs = Date.now() - (activeProject.lastModified || Date.now());
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    let timeAgo = "Just now";
    if (days > 0) timeAgo = `${days}d ago`;
    else if (hours > 0) timeAgo = `${hours}h ago`;
    else if (mins >= 1) timeAgo = `${mins}m ago`;
    else timeAgo = "Just now";

    const displaySceneTitle = activeProjectData?.lastActiveSceneTitle || firstSceneTitle || "Chapter 1";

    return {
      chapters: chaptersCount || 1,
      scenes: scenesCount || 1,
      currentSceneTitle: displaySceneTitle,
      timeAgo,
    };
  }, [activeProject, activeProjectData]);

  // Real World Radar Stats computed dynamically from the actual project manuscript, characters & locations
  const worldRadarStats = useMemo(() => {
    if (!activeProject) {
      return {
        totalMentions: 0,
        sortedMentions: [] as Array<{
          id: string;
          name: string;
          count: number;
          entityType: 'character' | 'location';
          role: string;
          description?: string;
          avatarUrl?: string;
          imageUrl?: string;
          scenesAppeared: Array<{ id: string; title: string; count: number }>;
        }>,
        characterCount: 0,
        locationCount: 0,
        scenesScanned: 0,
      };
    }

    const manuscript = activeProjectData?.manuscript || [];
    const rawCharacters = activeProjectData?.characters && Array.isArray(activeProjectData.characters)
      ? activeProjectData.characters
      : [];
    const rawLocations = activeProjectData?.locations && Array.isArray(activeProjectData.locations)
      ? activeProjectData.locations
      : [];

    const entityMap: Record<string, {
      id: string;
      name: string;
      count: number;
      entityType: 'character' | 'location';
      role: string;
      description?: string;
      avatarUrl?: string;
      imageUrl?: string;
      scenesAppeared: Array<{ id: string; title: string; count: number }>;
    }> = {};

    const nameToKey: Record<string, string> = {};
    const idToKey: Record<string, string> = {};

    // 1. Register all characters from project roster
    rawCharacters.forEach((c: any) => {
      const name = c.name?.trim();
      if (!name) return;
      const key = `char-${c.id || name}`;
      entityMap[key] = {
        id: key,
        name,
        count: 0,
        entityType: 'character',
        role: c.role || 'Character',
        description: c.backstory || c.description || c.shortBio || '',
        avatarUrl: c.avatarUrl || '',
        scenesAppeared: [],
      };
      nameToKey[name.toLowerCase()] = key;
      if (c.id) idToKey[String(c.id).toLowerCase()] = key;
      if (Array.isArray(c.aliases)) {
        c.aliases.forEach((alias: string) => {
          if (alias?.trim()) nameToKey[alias.trim().toLowerCase()] = key;
        });
      }
    });

    // 2. Register all locations from project atlas
    rawLocations.forEach((loc: any) => {
      const name = loc.name?.trim();
      if (!name) return;
      const key = `loc-${loc.id || name}`;
      entityMap[key] = {
        id: key,
        name,
        count: 0,
        entityType: 'location',
        role: loc.type || 'Location',
        description: loc.description || '',
        imageUrl: loc.imageUrl || '',
        scenesAppeared: [],
      };
      nameToKey[name.toLowerCase()] = key;
      if (loc.id) idToKey[String(loc.id).toLowerCase()] = key;
      if (Array.isArray(loc.aliases)) {
        loc.aliases.forEach((alias: string) => {
          if (alias?.trim()) nameToKey[alias.trim().toLowerCase()] = key;
        });
      }
    });

    let totalMentions = 0;
    let scenesScanned = 0;

    // 3. Deep-scan manuscript content across every scene
    const scanForMentions = (items: ManuscriptItem[]) => {
      for (const item of items) {
        if (item.type === 'scene') {
          scenesScanned++;
          const content = item.content || '';
          if (!content.trim()) {
            if (item.children) scanForMentions(item.children);
            continue;
          }

          const sceneOccurrences: Record<string, number> = {};

          // A. TipTap mention tag extraction (from @ mentions inserted via MentionEditor)
          const tagRegex = /<span[^>]*data-type="mention"[^>]*>([\s\S]*?)<\/span>/gi;
          let tagMatch;
          while ((tagMatch = tagRegex.exec(content)) !== null) {
            const tagHtml = tagMatch[0];
            const innerText = tagMatch[1]?.replace(/<[^>]*>/g, '').replace(/^@/, '').trim();
            const labelMatch = /data-label="([^"]+)"/i.exec(tagHtml);
            const idMatch = /data-id="([^"]+)"/i.exec(tagHtml);

            const label = labelMatch ? labelMatch[1].trim() : innerText;
            const entityId = idMatch ? idMatch[1].trim() : '';

            let matchedKey: string | null = null;
            if (entityId && idToKey[entityId.toLowerCase()]) {
              matchedKey = idToKey[entityId.toLowerCase()];
            } else if (label && nameToKey[label.toLowerCase()]) {
              matchedKey = nameToKey[label.toLowerCase()];
            } else if (innerText && nameToKey[innerText.toLowerCase()]) {
              matchedKey = nameToKey[innerText.toLowerCase()];
            }

            if (matchedKey) {
              sceneOccurrences[matchedKey] = (sceneOccurrences[matchedKey] || 0) + 1;
            } else if (label || innerText) {
              const fallbackName = label || innerText;
              const fallbackKey = `dyn-${fallbackName.toLowerCase()}`;
              if (!entityMap[fallbackKey]) {
                entityMap[fallbackKey] = {
                  id: fallbackKey,
                  name: fallbackName,
                  count: 0,
                  entityType: 'character',
                  role: 'Mentioned Entity',
                  scenesAppeared: [],
                };
                nameToKey[fallbackName.toLowerCase()] = fallbackKey;
              }
              sceneOccurrences[fallbackKey] = (sceneOccurrences[fallbackKey] || 0) + 1;
            }
          }

          // Strip mention spans before narrative scanning to prevent double counting
          const proseWithoutMentions = content
            .replace(/<span[^>]*data-type="mention"[^>]*>[\s\S]*?<\/span>/gi, ' ')
            .replace(/<[^>]+>/g, ' ');

          // B. Scan plain text @Name patterns (if typed manually without autocomplete)
          const atRegex = /@([a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+(?:\s+[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+)?)/g;
          let atMatch;
          while ((atMatch = atRegex.exec(proseWithoutMentions)) !== null) {
            const rawName = atMatch[1].trim();
            const rawKey = nameToKey[rawName.toLowerCase()];
            if (rawKey) {
              sceneOccurrences[rawKey] = (sceneOccurrences[rawKey] || 0) + 1;
            }
          }

          // C. Real text scanning: Find occurrences of character and location names in natural prose
          Object.entries(entityMap).forEach(([key, entity]) => {
            const searchNames = [entity.name];
            // If multi-word name (e.g. "Elena Vance" or "Castle Greyhaven"), also search first distinctive part
            const parts = entity.name.split(/\s+/);
            if (parts.length > 1 && parts[0].length >= 4 && !['the', 'lord', 'lady', 'king', 'queen', 'sir'].includes(parts[0].toLowerCase())) {
              searchNames.push(parts[0]);
            }

            let entityProseMatches = 0;
            searchNames.forEach(targetName => {
              if (targetName && targetName.length >= 3) {
                try {
                  const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  // Unicode-safe word boundaries
                  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gui');
                  const matches = proseWithoutMentions.match(regex);
                  if (matches) {
                    entityProseMatches += matches.length;
                  }
                } catch {
                  // Fallback for environments without Unicode property escapes
                  const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
                  const matches = proseWithoutMentions.match(regex);
                  if (matches) {
                    entityProseMatches += matches.length;
                  }
                }
              }
            });

            if (entityProseMatches > 0) {
              sceneOccurrences[key] = (sceneOccurrences[key] || 0) + entityProseMatches;
            }
          });

          // Aggregate scene occurrences into entityMap
          Object.entries(sceneOccurrences).forEach(([key, count]) => {
            if (entityMap[key] && count > 0) {
              entityMap[key].count += count;
              totalMentions += count;
              entityMap[key].scenesAppeared.push({
                id: item.id,
                title: item.title,
                count,
              });
            }
          });
        }
        if (item.children) scanForMentions(item.children);
      }
    };

    scanForMentions(manuscript);

    const sortedMentions = Object.values(entityMap)
      .sort((a, b) => b.count - a.count);

    const characterCount = sortedMentions.filter(m => m.entityType === 'character').length;
    const locationCount = sortedMentions.filter(m => m.entityType === 'location').length;

    return {
      totalMentions,
      sortedMentions,
      characterCount,
      locationCount,
      scenesScanned,
    };
  }, [activeProject, activeProjectData]);

  // Filtered mentions for expanded World Radar modal
  const filteredRadarMentions = useMemo(() => {
    return worldRadarStats.sortedMentions.filter((item) => {
      // Filter by entity type (All / Characters / Locations)
      if (radarEntityType === 'characters' && item.entityType !== 'character') return false;
      if (radarEntityType === 'locations' && item.entityType !== 'location') return false;

      const matchesSearch = item.name.toLowerCase().includes(radarSearch.toLowerCase()) ||
        (item.role && item.role.toLowerCase().includes(radarSearch.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(radarSearch.toLowerCase())) ||
        item.scenesAppeared.some(s => s.title.toLowerCase().includes(radarSearch.toLowerCase()));
      if (!matchesSearch) return false;

      if (radarFilter === 'active') return item.count > 0;
      if (radarFilter === 'silent') return item.count === 0;
      return true;
    });
  }, [worldRadarStats.sortedMentions, radarSearch, radarFilter, radarEntityType]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (taskFilter === "pending") return !t.completed;
        if (taskFilter === "completed") return t.completed;
        return true;
      })
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [tasks, taskFilter]);

  // Real word stats across all user projects
  const totalWordsAcrossAll = useMemo(() => {
    return savedProjects.reduce((acc, p) => acc + (p.currentWords || 0), 0);
  }, [savedProjects]);

  // Accurate Timeline Streak & Writing Time
  const calculatedAutoStreak = useMemo(() => {
    return storage.calculateTimelineStreak(savedProjects);
  }, [savedProjects]);

  const displayStreak = useMemo(() => {
    const days = timelineSettings.streakMode === 'custom'
      ? timelineSettings.customStreakDays || calculatedAutoStreak
      : calculatedAutoStreak;
    return `${days} ${Number(days) === 1 ? 'Day' : 'Days'}`;
  }, [timelineSettings, calculatedAutoStreak]);

  const displayWritingTime = useMemo(() => {
    if (timelineSettings.timeMode === 'custom') {
      const h = timelineSettings.customHours ?? 0;
      const m = timelineSettings.customMinutes ?? 0;
      return `${h}h ${m}m`;
    }
    // Realistic novel drafting velocity: ~900 words per hour
    const h = Math.floor(totalWordsAcrossAll / 900);
    const m = Math.round((totalWordsAcrossAll % 900) / 15);
    return `${Math.max(0, h)}h ${m}m`;
  }, [timelineSettings, totalWordsAcrossAll]);

  const planLabel = versionBadge.label;
  const quotaLabel = maxAllowedProjects === Infinity ? "∞" : String(maxAllowedProjects);
  const atQuota = savedProjects.length >= maxAllowedProjects;
  const authorName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Author";
  const activeProgress = activeProject
    ? Math.min(100, Math.round(((activeProject.currentWords || 0) / (activeProject.wordGoal || 75000)) * 100))
    : 0;
  const miniRadarItems = worldRadarStats.sortedMentions.filter((item) => {
    if (miniRadarType === "characters") return item.entityType === "character";
    if (miniRadarType === "locations") return item.entityType === "location";
    return true;
  });
  const miniTopCount = Math.max(1, miniRadarItems[0]?.count || 1);
  const recentIds = [...savedProjects].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)).slice(0, 2).map((p) => p.id);

  const openStudio = () => {
    if (!activeProject) return;
    const targetScene = activeProjectData?.lastActiveSceneId;
    navigate(`/project/${activeProject.id}/workspace/studio${targetScene ? `?scene=${targetScene}` : ""}`);
  };

  const pill = (active: boolean, dark = false) =>
    cn(
      "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
      active
        ? dark
          ? "bg-[#E8561F] text-white"
          : "bg-[#0E1D26] text-[#F6F1E7]"
        : dark
          ? "text-[#F6F1E7]/60 hover:text-[#F6F1E7] hover:bg-white/10"
          : "text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#0E1D26]/5"
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex-1 min-h-0 h-full w-full overflow-y-auto custom-scrollbar bg-[#F6F1E7] font-['Outfit'] text-[#0E1D26] selection:bg-[#E8561F] selection:text-white"
    >
      <div className="max-w-[1320px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-5 lg:py-7 flex flex-col gap-6 lg:gap-8">
        {/* ================= HEADER ================= */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBookWave className="w-8 h-8 text-[#E8561F]" />
            <span className="text-[20px] font-bold tracking-tight">Ocean Novel</span>
            <button
              type="button"
              onClick={() => (currentPlan !== "master" ? setShowUpgradeModal(true) : navigate("/settings?tab=billing"))}
              title={`${versionBadge.tooltip} • Click to view license status`}
              className={cn(
                "ml-1 px-2.5 py-1 border text-[10px] font-bold uppercase tracking-[0.2em] leading-none transition-colors cursor-pointer",
                currentPlan === "master"
                  ? "bg-[#0E1D26] border-[#0E1D26] text-[#F0B54B]"
                  : currentPlan === "pro"
                    ? "bg-[#E8561F] border-[#E8561F] text-white"
                    : "border-[#0E1D26]/60 hover:bg-[#0E1D26] hover:text-[#F6F1E7]"
              )}
            >
              {planLabel}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.email && isUserAdmin(currentUser.email) && (
              <button
                onClick={() => navigate("/admin")}
                title="Master Admin Dashboard (CRM & WarriorPlus IPN)"
                className="h-10 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 hover:bg-[#132631] transition-colors cursor-pointer"
              >
                <IconShield className="w-4 h-4 text-[#F0B54B]" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button
              onClick={() => navigate("/settings")}
              title={`Author Settings (${currentUser?.email || "Author"})`}
              className="h-10 pl-1 pr-4 rounded-full bg-white border border-[#E4DAC8] hover:border-[#0E1D26]/40 text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-[#F0B54B] text-[#0E1D26] flex items-center justify-center text-[13px] font-extrabold uppercase">
                {authorName.charAt(0)}
              </span>
              <span className="max-w-[120px] truncate">{authorName}</span>
              <IconGear className="w-4 h-4 text-[#0E1D26]/40" />
            </button>
            <button
              onClick={handleNewProjectClick}
              className="group h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2 shadow-[0_10px_24px_-12px_rgba(232,86,31,0.9)] transition-colors cursor-pointer"
            >
              <span className="whitespace-nowrap">New Book</span>
              {atQuota && (
                <span className="px-1.5 py-0.5 rounded-full bg-black/25 text-[10px] font-bold">
                  {savedProjects.length}/{quotaLabel}
                </span>
              )}
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <IconPlus className="w-4 h-4" />
              </span>
            </button>
          </div>
        </header>

        {/* ================= HERO + STATS ================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          {/* Resume drafting hero */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-[28px] bg-[#0E1D26] text-[#F6F1E7] min-h-[300px] p-7 sm:p-9 flex items-center">
            <div className="absolute -left-16 -bottom-24 w-[220px] h-[260px] rounded-t-full bg-[#F0B54B] rotate-[18deg]" aria-hidden="true" />
            <div className="absolute right-[28%] -top-10 w-[110px] h-[110px] rounded-full border-[16px] border-[#E8561F]/80 hidden md:block" aria-hidden="true" />

            <div className="relative z-10 flex-1 min-w-0 pr-0 md:pr-6">
              {activeProject ? (
                <>
                  <Tag tone="light">Resume Drafting</Tag>
                  <h1 className="mt-4 text-[34px] sm:text-[44px] font-extrabold leading-[0.98] tracking-[-0.02em] line-clamp-2 break-words">
                    {activeProject.title}
                    <span className="text-[#E8561F]">.</span>
                  </h1>
                  <p className="mt-3 text-[14px] text-[#F6F1E7]/65 truncate">
                    {activeProject.genre || "Fiction"} · {resumeStats.currentSceneTitle} · Updated {resumeStats.timeAgo}
                  </p>

                  <div className="mt-6 max-w-[440px]">
                    <div className="flex items-baseline justify-between text-[12px] text-[#F6F1E7]/70">
                      <span>
                        <strong className="text-[#F6F1E7] text-[15px]">{(activeProject.currentWords || 0).toLocaleString()}</strong> /{" "}
                        {(activeProject.wordGoal || 75000).toLocaleString()} words
                      </span>
                      <span className="font-bold text-[#F0B54B]">{activeProgress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#E8561F] to-[#F0B54B]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(3, activeProgress)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#F6F1E7]/45">
                      {resumeStats.chapters} chapters · {resumeStats.scenes} scenes
                    </p>
                  </div>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      onClick={openStudio}
                      className="group h-12 pl-6 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[14px] font-bold flex items-center gap-3 shadow-[0_14px_30px_-14px_rgba(232,86,31,0.9)] transition-colors cursor-pointer"
                    >
                      Continue Writing
                      <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                        <IconArrow className="w-4 h-4" />
                      </span>
                    </button>
                    <button
                      onClick={() => navigate(`/project/${activeProject.id}`)}
                      className="h-12 px-6 rounded-full border border-[#F6F1E7]/30 hover:border-[#F6F1E7] text-[14px] font-semibold transition-colors cursor-pointer"
                    >
                      Book Overview
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Tag tone="light">Start Writing</Tag>
                  <h1 className="mt-4 text-[38px] sm:text-[48px] font-extrabold leading-[0.98] tracking-[-0.02em]">
                    Your first book
                    <br />
                    <span className="text-[#E8561F]">starts here.</span>
                  </h1>
                  <p className="mt-4 text-[15px] text-[#F6F1E7]/70 max-w-[380px]">
                    Create a book to set up its characters, world and manuscript in one place.
                  </p>
                  <button
                    onClick={handleNewProjectClick}
                    className="group mt-7 h-12 pl-6 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[14px] font-bold flex items-center gap-3 transition-colors cursor-pointer"
                  >
                    Create a Book
                    <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                      <IconPlus className="w-4 h-4" />
                    </span>
                  </button>
                </>
              )}
            </div>

            <div className="relative z-10 hidden md:block pr-10">
              <BookMockup
                title={activeProject?.title || "Ocean Novel"}
                genre={activeProject?.genre}
                seed={activeProject?.id || "ocean-novel"}
                theme={activeProject?.themeColor}
                subtitle={activeProject?.genre || "Story Studio"}
                className="w-[170px] h-[224px] lg:w-[190px] lg:h-[250px]"
              />
            </div>
          </div>

          {/* Writing stats */}
          <div className="lg:col-span-4 rounded-[28px] bg-white border border-[#E4DAC8] p-6 sm:p-7 flex flex-col">
            <div className="flex items-center justify-between">
              <Tag>Writing Stats</Tag>
              <button
                onClick={() => setIsTimelineModalOpen(true)}
                className="text-[12px] font-semibold text-[#E8561F] hover:underline cursor-pointer"
              >
                Configure
              </button>
            </div>

            <div className="mt-5 flex-1 flex flex-col justify-between gap-4">
              {[
                { icon: <IconFlame className="w-5 h-5" />, tone: "bg-[#E8561F] text-white", value: displayStreak, label: "Writing streak" },
                {
                  icon: <IconQuill className="w-5 h-5" />,
                  tone: "bg-[#0E1D26] text-[#F0B54B]",
                  value: totalWordsAcrossAll.toLocaleString(),
                  label: "Total words",
                },
                { icon: <IconClock className="w-5 h-5" />, tone: "bg-[#F0B54B] text-[#0E1D26]", value: displayWritingTime, label: "Writing time" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", s.tone)}>{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[26px] font-extrabold leading-none tracking-[-0.02em] truncate">{s.value}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/50">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= BOOKSHELF ================= */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
            <div>
              <Tag>Library</Tag>
              <h2 className="mt-3 text-[30px] sm:text-[36px] font-extrabold leading-none tracking-[-0.02em]">
                Your Bookshelf<span className="text-[#E8561F]">.</span>
              </h2>
            </div>
            <span className="text-[13px] text-[#0E1D26]/55">
              {savedProjects.length} of {quotaLabel} books · click a spine to open it
            </span>
          </div>

          <div className="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar touch-pan-x">
            <div className="relative min-w-full w-max pt-10">
              {/* Shelf plank */}
              <div className="absolute bottom-0 left-0 right-0 h-5 rounded-[6px] bg-[#0E1D26] shadow-[0_14px_24px_-10px_rgba(14,29,38,0.6)]" />
              <div className="absolute bottom-5 left-0 right-0 h-[3px] bg-[#E9DCC5]" />

              <div className="relative flex items-end gap-[3px] h-[290px] pb-[23px] px-4 sm:px-6">
                {/* Left bookend — mustard arch */}
                <div className="shrink-0 w-10 h-20 mr-2 rounded-t-full bg-[#F0B54B]" aria-hidden="true" />

                {savedProjects.map((proj, index) => {
                  const palette = coverPaletteFor(proj.genre || "", proj.id, proj.themeColor);
                  const isSelected = openShelfId === proj.id;
                  const ratio = Math.min(1, Math.max(0, (proj.currentWords || 0) / (proj.wordGoal || 75000)));
                  const pct = Math.round(ratio * 100);
                  const isComplete = ratio >= 1 && (proj.wordGoal || 0) > 0;
                  const isRecent = recentIds.includes(proj.id);

                  // Deterministic "physical" variety so each book keeps its own thickness and height
                  const seed = hashSeed(proj.id || String(index));
                  const spineWidth = Math.min(60, [38, 52, 42, 60, 46, 56, 40, 58, 48, 50][seed % 10] + Math.floor(ratio * 3));
                  const baseHeight = [220, 238, 228, 214, 244][index % 5];
                  const bookHeight = isSelected ? baseHeight + 14 : baseHeight;
                  const coverWidth = 206;
                  const variant = seed % 4;
                  const accent = isComplete ? "#F0B54B" : palette.a;
                  const titleLen = Math.max(1, (proj.title || "").length);
                  const titleSpace = baseHeight - 44;
                  // Scale the spine title so the whole name fits along the spine (extra-bold uppercase Outfit ≈ 0.8em per glyph)
                  const fontSize = Math.max(7.5, Math.min(15, Math.floor((titleSpace / (titleLen * 0.8)) * 2) / 2));

                  return (
                    <Fragment key={proj.id}>
                    <motion.div
                      initial={false}
                      animate={{ width: isSelected ? spineWidth + coverWidth : spineWidth, height: bookHeight }}
                      whileHover={isSelected ? undefined : { y: -10, rotate: -1.5 }}
                      transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.9 }}
                      onClick={() => {
                        if (isSelected) {
                          setShelfOpenId(null);
                        } else {
                          setShelfOpenId(proj.id);
                          setSelectedProjectId(proj.id);
                        }
                      }}
                      title={isSelected ? "Close book" : `${proj.title} • ${proj.genre || "Fiction"}`}
                      className={cn(
                        "group relative shrink-0 cursor-pointer rounded-l-[4px] rounded-r-[6px] overflow-hidden origin-bottom",
                        isSelected
                          ? "shadow-[-6px_14px_28px_-6px_rgba(14,29,38,0.55)] z-10"
                          : "shadow-[-3px_2px_10px_rgba(14,29,38,0.35)] hover:shadow-[-5px_12px_20px_rgba(14,29,38,0.45)]"
                      )}
                      style={{ background: palette.bg }}
                    >
                      {/* Spine */}
                      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: spineWidth, background: palette.bg }}>
                        {/* Cloth weave */}
                        <div
                          className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none"
                          style={{
                            backgroundImage:
                              'url("data:image/svg+xml,%3Csvg viewBox=%220 0 120 120%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")',
                          }}
                        />
                        {/* Head & tail caps of a hardcover */}
                        <div className="absolute top-0 inset-x-0 h-[5px] bg-black/25" />
                        <div className="absolute bottom-0 inset-x-0 h-[5px] bg-black/25" />

                        {variant === 0 && (
                          <>
                            <div className="absolute top-3 inset-x-0 h-[5px]" style={{ background: accent }} />
                            <div className="absolute top-[22px] inset-x-0 h-[2px]" style={{ background: accent }} />
                            <div className="absolute bottom-[22px] inset-x-0 h-[2px]" style={{ background: accent }} />
                            <div className="absolute bottom-3 inset-x-0 h-[5px]" style={{ background: accent }} />
                          </>
                        )}
                        {variant === 1 && (
                          <div
                            className="absolute left-1/2 -translate-x-1/2 top-3 rounded-full"
                            style={{ width: spineWidth * 0.55, height: spineWidth * 0.55, background: palette.b }}
                          />
                        )}
                        {variant === 2 && (
                          <>
                            <div className="absolute top-0 inset-x-0 h-5" style={{ background: accent }} />
                            <div className="absolute bottom-0 inset-x-0 h-9" style={{ background: palette.c }} />
                          </>
                        )}
                        {variant === 3 && (
                          <div
                            className="absolute bottom-0 inset-x-0 rounded-t-full"
                            style={{ height: spineWidth * 0.9, background: accent }}
                          />
                        )}

                        {/* Vertical title */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span
                            className="block flex-none whitespace-nowrap overflow-hidden text-ellipsis font-extrabold uppercase text-center"
                            style={{
                              width: titleSpace,
                              transform: "rotate(-90deg)",
                              color: palette.ink,
                              fontSize,
                              letterSpacing: titleLen < 14 ? "0.14em" : titleLen < 22 ? "0.06em" : "0.01em",
                            }}
                          >
                            {proj.title}
                          </span>
                        </div>

                        {/* Rounded-spine shading: light catches the curve, edges fall into shadow */}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(90deg, rgba(0,0,0,0.38) 0%, rgba(255,255,255,0.14) 16%, rgba(255,255,255,0.04) 38%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0.34) 100%)",
                          }}
                        />

                        {isRecent && <div className="absolute top-0 right-1.5 w-2.5 h-8 bg-[#E8561F] rounded-b-sm shadow-sm" />}
                      </div>

                      {/* Opened book: a simple title plate inside the cover */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.25 } }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                            className="absolute inset-y-0 right-0 p-2.5 cursor-default"
                            style={{ left: spineWidth }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative h-full rounded-[4px] bg-[#FBF8F2] px-4 py-3.5 flex flex-col text-[#0E1D26] shadow-[inset_0_0_0_1px_rgba(14,29,38,0.06),0_2px_8px_rgba(0,0,0,0.25)]">
                              <button
                                type="button"
                                onClick={() => setShelfOpenId(null)}
                                title="Close book"
                                aria-label="Close book"
                                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[#0E1D26]/35 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.06] transition-colors cursor-pointer"
                              >
                                <IconClose className="w-3.5 h-3.5" />
                              </button>

                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E8561F]">
                                Book · {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="mt-2 text-[18px] font-extrabold leading-[1.1] line-clamp-2 break-words">{proj.title}</p>
                              <p className="mt-1 text-[12px] italic text-[#0E1D26]/55 truncate">{proj.genre || "Fiction"}</p>

                              <div className="mt-auto pt-3 border-t border-[#E4DAC8]">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45">Words</span>
                                  <span className="text-[13px] font-bold">{(proj.currentWords || 0).toLocaleString()}</span>
                                </div>
                                <div className="mt-1.5 h-[3px] rounded-full bg-[#E4DAC8] overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", isComplete ? "bg-[#F0B54B]" : "bg-[#E8561F]")}
                                    style={{ width: `${Math.max(4, pct)}%` }}
                                  />
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectToDelete(proj);
                                    }}
                                    title={`Delete "${proj.title}"`}
                                    className="p-1 text-[#0E1D26]/35 hover:text-[#C2410C] transition-colors cursor-pointer"
                                  >
                                    <IconTrash className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/project/${proj.id}`);
                                    }}
                                    className="h-8 px-4 rounded-full bg-[#0E1D26] hover:bg-[#E8561F] text-[#F6F1E7] text-[11px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer"
                                  >
                                    Open Book
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    </Fragment>
                  );
                })}

                {/* Empty slot — new book */}
                <button
                  type="button"
                  onClick={handleNewProjectClick}
                  title={atQuota ? `Plan limit reached (${savedProjects.length}/${quotaLabel})` : "Start a new book"}
                  className="group shrink-0 ml-2 w-[54px] h-[214px] rounded-[5px] border-2 border-dashed border-[#0E1D26]/20 hover:border-[#E8561F] flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer"
                >
                  <span className="w-9 h-9 rounded-full bg-[#E8561F] text-white flex items-center justify-center transition-transform group-hover:scale-110">
                    <IconPlus className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E1D26]/50 [writing-mode:vertical-rl] rotate-180">
                    New Book
                  </span>
                </button>

                {/* Right bookend */}
                {savedProjects.length > 0 && (
                  <div className="shrink-0 w-10 h-24 ml-2 rounded-tl-full bg-[#E8561F]" aria-hidden="true" />
                )}

                {savedProjects.length === 0 && (
                  <p className="self-center ml-4 text-[14px] text-[#0E1D26]/55">
                    Your shelf is empty — add your first book to get started.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= BOARD ================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 pb-4">
          {/* Tasks */}
          <div className="lg:col-span-7 rounded-[28px] bg-white border border-[#E4DAC8] p-6 sm:p-7 flex flex-col min-h-[380px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Tag>Task Notes</Tag>
                <h3 className="mt-3 text-[26px] font-extrabold leading-none tracking-[-0.02em]">
                  Today's Work<span className="text-[#E8561F]">.</span>
                </h3>
              </div>
              <button
                onClick={() => setIsAddingTask(!isAddingTask)}
                className={cn(
                  "h-10 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer",
                  isAddingTask ? "bg-[#0E1D26]/5 text-[#0E1D26]" : "bg-[#0E1D26] text-[#F6F1E7] hover:bg-[#132631]"
                )}
              >
                {isAddingTask ? <IconClose className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
                {isAddingTask ? "Cancel" : "Add Task"}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-1 p-1 rounded-full bg-[#F6F1E7] self-start">
              <button onClick={() => setTaskFilter("all")} className={pill(taskFilter === "all")}>
                All {tasks.length}
              </button>
              <button onClick={() => setTaskFilter("pending")} className={pill(taskFilter === "pending")}>
                Pending {tasks.filter((t) => !t.completed).length}
              </button>
              <button onClick={() => setTaskFilter("completed")} className={pill(taskFilter === "completed")}>
                Done {tasks.filter((t) => t.completed).length}
              </button>
            </div>

            <AnimatePresence>
              {isAddingTask && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddTask}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-4 rounded-2xl bg-[#F6F1E7] flex flex-col gap-3">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Write the confrontation dialogue in Chapter 2…"
                      className="w-full h-11 px-4 bg-white border border-[#E4DAC8] rounded-full text-[14px] placeholder:text-[#0E1D26]/35 outline-none focus:border-[#E8561F] focus:ring-4 focus:ring-[#E8561F]/10"
                      autoFocus
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["writing", "editing", "worldbuilding", "research"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setNewTaskType(t)} className={pill(newTaskType === t)}>
                            {t === "worldbuilding" ? "world" : t}
                          </button>
                        ))}
                        <span className="w-px h-5 bg-[#E4DAC8] mx-1" />
                        {(["low", "medium", "high"] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setNewTaskUrgency(u)}
                            className={cn(
                              pill(false),
                              newTaskUrgency === u && (u === "high" ? "bg-[#E8561F] text-white" : "bg-[#F0B54B] text-[#0E1D26]")
                            )}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={!newTaskTitle.trim()}
                        className="h-9 px-5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] disabled:opacity-40 text-white text-[12px] font-bold transition-colors cursor-pointer"
                      >
                        Save Task
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-4 flex-1 overflow-y-auto max-h-[360px] -mr-2 pr-2 custom-scrollbar">
              {filteredTasks.length === 0 ? (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center">
                  <span className="w-12 h-12 rounded-full bg-[#F6F1E7] text-[#0E1D26]/30 flex items-center justify-center">
                    <IconTick className="w-6 h-6" />
                  </span>
                  <p className="mt-3 text-[15px] font-semibold">No tasks here</p>
                  <p className="mt-1 text-[13px] text-[#0E1D26]/50">Add a task to set your writing priorities.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task.id)}
                      className={cn(
                        "group flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer",
                        task.completed
                          ? "bg-[#F6F1E7]/60 border-transparent"
                          : "bg-white border-[#E4DAC8] hover:border-[#0E1D26]/30"
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(task.id);
                        }}
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                          task.completed ? "bg-[#E8561F] text-white" : "border-2 border-[#0E1D26]/20 hover:border-[#E8561F]"
                        )}
                      >
                        {task.completed && <IconTick className="w-3.5 h-3.5" />}
                      </button>
                      <p
                        className={cn(
                          "flex-1 min-w-0 truncate text-[14px]",
                          task.completed ? "text-[#0E1D26]/40 line-through" : "font-medium"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.urgency === "high" && !task.completed && (
                        <span className="px-2 py-0.5 rounded-full bg-[#E8561F] text-white text-[10px] font-bold uppercase tracking-wider">
                          High
                        </span>
                      )}
                      <span className="px-2 py-0.5 border border-[#0E1D26]/25 text-[9.5px] font-bold uppercase tracking-[0.14em] shrink-0">
                        {task.type === "worldbuilding" ? "world" : task.type}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        title="Delete task"
                        className="opacity-60 sm:opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#C2410C] hover:bg-[#E8561F]/10 transition cursor-pointer"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* World radar */}
          <div
            className="lg:col-span-5 relative overflow-hidden rounded-[28px] bg-[#0E1D26] text-[#F6F1E7] p-6 sm:p-7 flex flex-col min-h-[380px] cursor-pointer"
            onClick={() => setIsRadarExpanded(true)}
            title="Click to expand full World Radar"
          >
            <div className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full bg-[#E8561F]/15" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <Tag tone="light">World Radar</Tag>
                <h3 className="mt-3 text-[26px] font-extrabold leading-none tracking-[-0.02em]">
                  {worldRadarStats.totalMentions}
                  <span className="text-[#E8561F]"> mentions</span>
                </h3>
                <p className="mt-1.5 text-[12px] text-[#F6F1E7]/50 truncate max-w-[220px]">
                  {activeProject ? `in ${activeProject.title}` : "No book selected"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleManualScan}
                  title="Re-scan manuscript text now"
                  className="w-9 h-9 rounded-full border border-[#F6F1E7]/20 hover:border-[#F6F1E7] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <IconRefresh className={cn("w-4 h-4", isScanning && "animate-spin")} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRadarExpanded(true);
                  }}
                  title="Expand World Radar"
                  className="w-9 h-9 rounded-full bg-[#E8561F] hover:bg-[#D44B17] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <IconExpand className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative mt-4 flex items-center gap-1 p-1 rounded-full bg-white/5 self-start" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setMiniRadarType("all")} className={pill(miniRadarType === "all", true)}>
                All {worldRadarStats.sortedMentions.length}
              </button>
              <button onClick={() => setMiniRadarType("characters")} className={pill(miniRadarType === "characters", true)}>
                Characters {worldRadarStats.characterCount}
              </button>
              <button onClick={() => setMiniRadarType("locations")} className={pill(miniRadarType === "locations", true)}>
                Places {worldRadarStats.locationCount}
              </button>
            </div>

            <div className="relative mt-5 flex-1 overflow-y-auto max-h-[300px] -mr-2 pr-2 custom-scrollbar">
              {miniRadarItems.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center">
                  <IconPerson className="w-7 h-7 text-[#F6F1E7]/25" />
                  <p className="mt-2 text-[13px] font-semibold">No entities tracked yet</p>
                  <p className="mt-1 text-[12px] text-[#F6F1E7]/50 max-w-[240px]">
                    Mention characters or places in the Writing Studio to see live frequency.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {miniRadarItems.map((item) => {
                    const pct = item.count > 0 ? Math.max(8, Math.round((item.count / miniTopCount) * 100)) : 0;
                    return (
                      <div key={`radar-mini-${item.id}`} className="group">
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="flex items-center gap-2 min-w-0">
                            {item.entityType === "character" ? (
                              <IconPerson className="w-3.5 h-3.5 text-[#E8561F] shrink-0" />
                            ) : (
                              <IconPin className="w-3.5 h-3.5 text-[#F0B54B] shrink-0" />
                            )}
                            <span className="font-semibold truncate group-hover:text-[#F0B54B] transition-colors">{item.name}</span>
                          </span>
                          <span className="text-[11px] text-[#F6F1E7]/55 shrink-0 tabular-nums">
                            {item.count} · {item.scenesAppeared.length} sc
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              item.entityType === "character" ? "bg-[#E8561F]" : "bg-[#F0B54B]"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ================= WORLD RADAR MODAL ================= */}
      <AnimatePresence>
        {isRadarExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0E1D26]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-['Outfit']"
            onClick={() => setIsRadarExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#F6F1E7] rounded-[28px] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#0E1D26]"
            >
              {/* Header */}
              <div className="relative overflow-hidden bg-[#0E1D26] text-[#F6F1E7] px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="absolute -right-10 -top-16 w-44 h-44 rounded-full bg-[#E8561F]" aria-hidden="true" />
                <div className="relative min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="light">World Radar</Tag>
                    {savedProjects.length > 1 ? (
                      <select
                        value={selectedProjectId || activeProject?.id || ""}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="h-7 px-3 rounded-full bg-white/10 border border-white/20 text-[12px] font-semibold text-[#F6F1E7] outline-none cursor-pointer"
                      >
                        {savedProjects.map((p) => (
                          <option key={p.id} value={p.id} className="text-[#0E1D26]">
                            {p.title}
                          </option>
                        ))}
                      </select>
                    ) : activeProject ? (
                      <span className="text-[12px] text-[#F6F1E7]/70">{activeProject.title}</span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-[28px] sm:text-[34px] font-extrabold leading-none tracking-[-0.02em]">
                    Narrative <span className="text-[#E8561F]">Frequency.</span>
                  </h2>
                  <p className="mt-2 text-[13px] text-[#F6F1E7]/60">
                    Scanned across {worldRadarStats.scenesScanned} scenes{activeProject ? ` in "${activeProject.title}"` : ""}.
                  </p>
                </div>

                <div className="relative flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleManualScan}
                    className="h-10 px-4 rounded-full border border-[#F6F1E7]/30 hover:border-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <IconRefresh className={cn("w-4 h-4", isScanning && "animate-spin")} />
                    {isScanning ? "Scanning…" : "Re-scan"}
                  </button>
                  {activeProject && (
                    <button
                      onClick={() => {
                        setIsRadarExpanded(false);
                        navigate(`/project/${activeProject.id}/characters`);
                      }}
                      className="h-10 pl-4 pr-1.5 rounded-full bg-[#F6F1E7] text-[#0E1D26] text-[13px] font-bold flex items-center gap-2 cursor-pointer"
                    >
                      Cast Dossier
                      <span className="w-7 h-7 rounded-full bg-[#E8561F] text-white flex items-center justify-center">
                        <IconArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsRadarExpanded(false)}
                    title="Close (ESC)"
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary + filters */}
              <div className="px-6 sm:px-8 py-4 border-b border-[#E4DAC8] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { icon: <IconArrowUpRight className="w-3.5 h-3.5" />, v: worldRadarStats.totalMentions, l: "mentions" },
                    { icon: <IconPerson className="w-3.5 h-3.5" />, v: worldRadarStats.characterCount, l: "characters" },
                    { icon: <IconPin className="w-3.5 h-3.5" />, v: worldRadarStats.locationCount, l: "places" },
                    { icon: <IconScenes className="w-3.5 h-3.5" />, v: worldRadarStats.scenesScanned, l: "scenes" },
                  ].map((s) => (
                    <span key={s.l} className="h-8 px-3 rounded-full bg-white border border-[#E4DAC8] flex items-center gap-1.5 text-[12px]">
                      <span className="text-[#E8561F]">{s.icon}</span>
                      <strong>{s.v}</strong>
                      <span className="text-[#0E1D26]/55">{s.l}</span>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-52">
                    <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0E1D26]/40" />
                    <input
                      type="text"
                      placeholder="Search name, role, scene…"
                      value={radarSearch}
                      onChange={(e) => setRadarSearch(e.target.value)}
                      className="w-full h-9 pl-10 pr-8 bg-white border border-[#E4DAC8] rounded-full text-[13px] outline-none focus:border-[#E8561F]"
                    />
                    {radarSearch && (
                      <button
                        onClick={() => setRadarSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0E1D26]/40 hover:text-[#0E1D26] cursor-pointer"
                      >
                        <IconClose className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 p-1 rounded-full bg-white border border-[#E4DAC8]">
                    <button onClick={() => setRadarEntityType("all")} className={pill(radarEntityType === "all")}>All</button>
                    <button onClick={() => setRadarEntityType("characters")} className={pill(radarEntityType === "characters")}>
                      Characters {worldRadarStats.characterCount}
                    </button>
                    <button onClick={() => setRadarEntityType("locations")} className={pill(radarEntityType === "locations")}>
                      Places {worldRadarStats.locationCount}
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5 p-1 rounded-full bg-white border border-[#E4DAC8]">
                    <button onClick={() => setRadarFilter("all")} className={pill(radarFilter === "all")}>All</button>
                    <button onClick={() => setRadarFilter("active")} className={pill(radarFilter === "active")}>
                      Active {worldRadarStats.sortedMentions.filter((m) => m.count > 0).length}
                    </button>
                    <button onClick={() => setRadarFilter("silent")} className={pill(radarFilter === "silent")}>
                      Silent {worldRadarStats.sortedMentions.filter((m) => m.count === 0).length}
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 custom-scrollbar">
                {filteredRadarMentions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRadarMentions.map((item, idx) => {
                      const topCount = Math.max(1, worldRadarStats.sortedMentions[0]?.count || 1);
                      const percentage = item.count > 0 ? Math.round((item.count / topCount) * 100) : 0;
                      const mentionShare =
                        worldRadarStats.totalMentions > 0 ? Math.round((item.count / worldRadarStats.totalMentions) * 100) : 0;
                      const isChar = item.entityType === "character";

                      return (
                        <div
                          key={`radar-modal-${item.id}-${idx}`}
                          className="group p-5 rounded-2xl bg-white border border-[#E4DAC8] hover:border-[#0E1D26]/30 transition-colors flex flex-col"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <span
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold shrink-0",
                                  idx === 0 && item.count > 0
                                    ? "bg-[#E8561F] text-white"
                                    : idx === 1 && item.count > 0
                                      ? "bg-[#F0B54B] text-[#0E1D26]"
                                      : "bg-[#F6F1E7] text-[#0E1D26]/60"
                                )}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-[17px] font-bold leading-tight truncate">{item.name}</h4>
                                  <span className="px-1.5 py-0.5 border border-[#0E1D26]/25 text-[9px] font-bold uppercase tracking-[0.14em]">
                                    {isChar ? "Character" : "Place"}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[12px] text-[#0E1D26]/55 truncate">{item.role || (isChar ? "Character" : "Location")}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-[18px] font-extrabold leading-none", item.count > 0 ? "text-[#E8561F]" : "text-[#0E1D26]/30")}>
                                {item.count}
                              </p>
                              {worldRadarStats.totalMentions > 0 && (
                                <p className="mt-1 text-[10px] text-[#0E1D26]/50">{mentionShare}% share</p>
                              )}
                            </div>
                          </div>

                          {item.description && (
                            <p className="mt-3 text-[13px] text-[#0E1D26]/60 line-clamp-2">{item.description}</p>
                          )}

                          <div className="mt-4">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-[#0E1D26]/45 mb-1.5">
                              <span>Density</span>
                              <span>{percentage}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#F6F1E7] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", isChar ? "bg-[#E8561F]" : "bg-[#F0B54B]")}
                                style={{ width: `${Math.max(percentage, item.count > 0 ? 6 : 0)}%` }}
                              />
                            </div>
                          </div>

                          {item.scenesAppeared.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar">
                              {item.scenesAppeared.map((scene, sceneIdx) => (
                                <span
                                  key={`scene-badge-${item.id}-${scene.id}-${sceneIdx}`}
                                  title={`${scene.count} mention(s) in "${scene.title}"`}
                                  className="h-6 px-2.5 rounded-full bg-[#F6F1E7] text-[11px] flex items-center gap-1"
                                >
                                  <span className="truncate max-w-[120px]">{scene.title}</span>
                                  <strong className="text-[#E8561F]">×{scene.count}</strong>
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-auto pt-4 flex items-center justify-between">
                            <span className="text-[11px] text-[#0E1D26]/45">
                              {item.count > 0
                                ? `Found in ${item.scenesAppeared.length} scene${item.scenesAppeared.length === 1 ? "" : "s"}`
                                : "Not mentioned yet"}
                            </span>
                            <button
                              onClick={() => {
                                setIsRadarExpanded(false);
                                if (activeProject) {
                                  navigate(isChar ? `/project/${activeProject.id}/characters` : `/project/${activeProject.id}/workspace/locations`);
                                }
                              }}
                              className="flex items-center gap-1.5 text-[12px] font-bold text-[#E8561F] hover:underline cursor-pointer"
                            >
                              {isChar ? "View Dossier" : "View Place"}
                              <IconArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-14 text-center">
                    <IconSearch className="w-8 h-8 mx-auto text-[#0E1D26]/25" />
                    <p className="mt-3 text-[15px] font-semibold">No entities match this filter</p>
                    <p className="mt-1 text-[13px] text-[#0E1D26]/50">Try another search term or choose "All".</p>
                  </div>
                )}
              </div>

              <div className="px-6 sm:px-8 py-4 border-t border-[#E4DAC8] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#0E1D26]/60">
                <span>
                  Tip: in the Writing Studio, type names directly or use <strong className="text-[#E8561F]">@</strong> to tag them.
                </span>
                <button
                  onClick={() => setIsRadarExpanded(false)}
                  className="h-9 px-5 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[12px] font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TimelineSettingsModal
        isOpen={isTimelineModalOpen}
        onClose={() => setIsTimelineModalOpen(false)}
        savedProjects={savedProjects}
        totalWords={totalWordsAcrossAll}
        onUpdated={() => setTimelineSettings(storage.getTimelineSettings())}
      />

      {/* ================= DELETE BOOK MODAL ================= */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingProject && setProjectToDelete(null)}
              className="absolute inset-0 bg-[#0E1D26]/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-md bg-[#F6F1E7] rounded-[28px] shadow-2xl p-7 text-[#0E1D26]"
            >
              <button
                disabled={isDeletingProject}
                onClick={() => setProjectToDelete(null)}
                className="absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/50 hover:bg-[#E4DAC8]/60 cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>

              <Tag>Delete Book</Tag>
              <h3 className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.02em]">
                Are you <span className="text-[#E8561F]">sure?</span>
              </h3>

              <div className="mt-5 flex items-center gap-4 p-3 rounded-2xl bg-white border border-[#E4DAC8]">
                <BookCover
                  title={projectToDelete.title}
                  genre={projectToDelete.genre}
                  seed={projectToDelete.id}
                  theme={projectToDelete.themeColor}
                  className="w-14 h-[74px] shrink-0"
                  titleClassName="text-[8px]"
                />
                <div className="min-w-0">
                  <p className="text-[16px] font-bold truncate">{projectToDelete.title}</p>
                  <p className="text-[12px] text-[#0E1D26]/55">
                    {projectToDelete.genre || "Fiction"} · {(projectToDelete.currentWords || 0).toLocaleString()} words
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-[#0E1D26]/65">
                Every chapter, character, location, note and story bible entry in this book will be permanently erased from your account and cloud sync.{" "}
                <strong className="text-[#C2410C]">This cannot be undone.</strong>
              </p>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingProject}
                  onClick={() => setProjectToDelete(null)}
                  className="h-11 px-5 rounded-full border border-[#E4DAC8] bg-white text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Keep Book
                </button>
                <button
                  type="button"
                  disabled={isDeletingProject}
                  onClick={() => handleDeleteProject(projectToDelete)}
                  className="h-11 px-5 rounded-full bg-[#C2410C] hover:bg-[#9A3412] text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeletingProject ? <IconSpinner className="w-4 h-4" /> : <IconTrash className="w-4 h-4" />}
                  {isDeletingProject ? "Deleting…" : "Delete Permanently"}
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
        currentCount={savedProjects.length}
        maxLimit={maxAllowedProjects}
      />
    </motion.div>
  );
}

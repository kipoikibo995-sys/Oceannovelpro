import React, { ReactNode, useState, useEffect, useRef, useMemo } from "react";
import { Plus, MoreVertical, RefreshCw, Copy, X, ListTree, ChevronDown, ChevronRight, ChevronLeft, Check, Focus, Type, BookOpen, PanelRight, Users, MapPin, Search, ExternalLink, AlertTriangle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ManuscriptItem } from "@/mockData";
import MentionEditor from "@/components/MentionEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { storage, ProjectData } from "@/lib/storage";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import GlobalSearchModal from "@/components/GlobalSearchModal";
import AIPromptModal from "@/components/AIPromptModal";
import UpgradeModal from "@/components/UpgradeModal";
import { PLAN_LIMITS } from "@/lib/license";
import { readEditorTypePrefs, saveEditorTypePrefs, editorFamilyFromProfile, editorSizeFromProfile } from "@/lib/editorPrefs";

// Helper functions for manuscript tree
const findFirstSceneId = (items: ManuscriptItem[]): string => {
  for (const item of items) {
    if (item.type === 'scene') return item.id;
    if (item.children) {
      const found = findFirstSceneId(item.children);
      if (found) return found;
    }
  }
  return '';
};

const collectFolderIds = (items: ManuscriptItem[], acc: string[] = []): string[] => {
  for (const item of items) {
    if (item.type !== 'scene') acc.push(item.id);
    if (item.children) collectFolderIds(item.children, acc);
  }
  return acc;
};

// Deep copy with fresh ids so duplicates never share ids with the original
const cloneWithNewIds = (item: ManuscriptItem, stamp: string): ManuscriptItem => ({
  ...item,
  id: `${item.type}-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
  ...(item.children ? { children: item.children.map((c) => cloneWithNewIds(c, stamp)) } : {}),
});

// Which items may live directly inside which (root accepts anything)
const canContain = (parentType: ManuscriptItem['type'] | 'root', childType: ManuscriptItem['type']) => {
  if (parentType === 'root') return true;
  if (parentType === 'part') return childType !== 'part';
  if (parentType === 'chapter') return childType === 'scene';
  return false;
};

const countWords = (html?: string) =>
  html ? html.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').trim().split(/\s+/).filter((w) => w.length > 0).length : 0;



const findNodeById = (items: ManuscriptItem[], id: string): ManuscriptItem | null => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findNodeById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findSceneContent = (items: ManuscriptItem[], sceneId: string): string => {
  for (const item of items) {
    if (item.id === sceneId) return item.content || '';
    if (item.children) {
      const found = findSceneContent(item.children, sceneId);
      if (found !== '') return found;
    }
  }
  return '';
};

export default function WritingStudio() {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'chars' | 'locs' | 'notes'>('chars');
  const [selectedEntity, setSelectedEntity] = useState<{id: string, type: string} | null>(null);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isManuscriptOpen, setIsManuscriptOpen] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAIPromptModalOpen, setIsAIPromptModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // License check for OTO2 AI Ghostwriter
  const userProfile = storage.getUserProfile();
  const currentPlan = userProfile?.plan || 'free';
  const hasAiGhostwriter = PLAN_LIMITS[currentPlan]?.hasAiGhostwriterHub ?? false;

  const handleOpenAiPromptHub = () => {
    if (!hasAiGhostwriter) {
      setShowUpgradeModal(true);
    } else {
      setIsAIPromptModalOpen(true);
    }
  };
  
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sceneParam = searchParams.get('scene');
  const tabParam = searchParams.get('tab');
  const highlightParam = searchParams.get('highlight');
  const [highlightKeyword, setHighlightKeyword] = useState<string | null>(highlightParam || null);

  useEffect(() => {
    if (highlightParam) {
      setHighlightKeyword(highlightParam);
    }
  }, [highlightParam]);

  useEffect(() => {
    if (tabParam === 'notes') {
      setActiveTab('notes');
      setIsContextOpen(true);
    }
  }, [tabParam]);

  // Keyboard shortcut for Global Search: Ctrl+Shift+F or Cmd+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [projectMeta, setProjectMeta] = useState<any>(() => {
    if (projectId) {
      const projects = storage.getProjects();
      return projects.find(p => p.id === projectId) || null;
    }
    return null;
  });

  // Entities & Notes state with synchronous lazy initialization
  const [characters, setCharacters] = useState<any[]>(() => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      if (data?.characters && data.characters.length > 0) return data.characters;
    }
    return [];
  });

  const [locations, setLocations] = useState<any[]>(() => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      if (data?.locations && data.locations.length > 0) return data.locations;
    }
    return [];
  });

  const [sceneNotes, setSceneNotes] = useState<Record<string, string>>(() => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      if (data?.notes) return data.notes;
    }
    return {};
  });

  const [scratchpad, setScratchpad] = useState<string>(() => {
    if (projectId) return storage.getProjectData(projectId)?.generalNotes || '';
    return '';
  });
  const generalNoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleGeneralNoteChange = (text: string) => {
    setScratchpad(text);
    if (generalNoteTimeoutRef.current) clearTimeout(generalNoteTimeoutRef.current);
    generalNoteTimeoutRef.current = setTimeout(() => {
      if (projectId) storage.saveProjectData(projectId, { generalNotes: text });
    }, 600);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
  const [copiedEntityName, setCopiedEntityName] = useState<string | null>(null);
  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Manuscript state with synchronous lazy initialization
  const [manuscript, setManuscript] = useState<ManuscriptItem[]>(() => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      if (data?.manuscript && data.manuscript.length > 0) {
        return data.manuscript;
      }
    }
    return [];
  });

  // Active scene and content initialized with support for sceneParam or lastActiveSceneId
  const [activeDocId, setActiveDocId] = useState<string>(() => {
    const data = projectId ? storage.getProjectData(projectId) : null;
    const initManuscript = data?.manuscript && data.manuscript.length > 0 
      ? data.manuscript 
      : [];
    
    if (sceneParam && findNodeById(initManuscript, sceneParam)) {
      return sceneParam;
    }
    if (data?.lastActiveSceneId && findNodeById(initManuscript, data.lastActiveSceneId)) {
      return data.lastActiveSceneId;
    }
    return findFirstSceneId(initManuscript);
  });

  const [activeContent, setActiveContent] = useState<string>(() => {
    const data = projectId ? storage.getProjectData(projectId) : null;
    const initManuscript = data?.manuscript && data.manuscript.length > 0 
      ? data.manuscript 
      : [];
    
    let targetId = findFirstSceneId(initManuscript);
    if (sceneParam && findNodeById(initManuscript, sceneParam)) {
      targetId = sceneParam;
    } else if (data?.lastActiveSceneId && findNodeById(initManuscript, data.lastActiveSceneId)) {
      targetId = data.lastActiveSceneId;
    }
    return findSceneContent(initManuscript, targetId);
  });

  // Keep in sync if projectId changes in route
  useEffect(() => {
    if (projectId) {
      const data = storage.getProjectData(projectId);
      if (data) {
        const loadedManuscript = data.manuscript && data.manuscript.length > 0 ? data.manuscript : [];
        setManuscript(loadedManuscript);
        
        let target = activeDocId;
        if (sceneParam && findNodeById(loadedManuscript, sceneParam)) {
          target = sceneParam;
        } else if (data.lastActiveSceneId && findNodeById(loadedManuscript, data.lastActiveSceneId)) {
          target = data.lastActiveSceneId;
        } else if (!findNodeById(loadedManuscript, target)) {
          target = findFirstSceneId(loadedManuscript);
        }

        setActiveDocId(target);
        setActiveContent(findSceneContent(loadedManuscript, target));

        setCharacters(data.characters && data.characters.length > 0 ? data.characters : []);
        setLocations(data.locations && data.locations.length > 0 ? data.locations : []);
        setSceneNotes(data.notes || {});
        setScratchpad(data.generalNotes || '');

        const projects = storage.getProjects();
        setProjectMeta(projects.find(p => p.id === projectId) || null);
      }
    }
  }, [projectId]);

  // Persist last active scene for Resume Drafting in Dashboard
  useEffect(() => {
    if (projectId && activeDocId && manuscript.length > 0) {
      const activeNode = findNodeById(manuscript, activeDocId);
      if (activeNode && activeNode.type === 'scene') {
        storage.saveProjectData(projectId, {
          lastActiveSceneId: activeDocId,
          lastActiveSceneTitle: activeNode.title,
        });
      }
    }
  }, [projectId, activeDocId, manuscript]);

  // Switch active scene cleanly without leaving sticky URL query params
  const handleSelectScene = (sceneId: string, customHighlight?: string) => {
    if (sceneId !== activeDocId) {
      setActiveDocId(sceneId);
      setActiveContent(findSceneContent(manuscript, sceneId));
    }

    if (customHighlight !== undefined) {
      setHighlightKeyword(customHighlight);
    } else {
      // Clear highlight when user voluntarily switches to another scene
      setHighlightKeyword(null);
    }

    // Always clear sticky scene and highlight from URL to prevent unwanted auto-reverting
    if (searchParams.has('scene') || searchParams.has('highlight')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('scene');
      nextParams.delete('highlight');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // React to URL sceneParam changes (e.g. initial navigation from Global Search or external links)
  useEffect(() => {
    if (sceneParam && manuscript.length > 0) {
      const node = findNodeById(manuscript, sceneParam);
      if (node) {
        setActiveDocId(sceneParam);
        setActiveContent(findSceneContent(manuscript, sceneParam));
      }
      // CRITICAL FIX: Clean up sceneParam from URL so switching chapters won't get yanked back
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('scene');
      setSearchParams(nextParams, { replace: true });
    }
  }, [sceneParam, manuscript.length]);
  

  const [isSaving, setIsSaving] = useState(false);

  // Binder State
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(collectFolderIds(manuscript)));
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [contextMenuOpenId, setContextMenuOpenId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);


  // Typography Settings
  // Last choice from the Aa menu, else the defaults from Settings
  const [fontSize, setFontSize] = useState<'text-base' | 'text-lg' | 'text-xl' | 'text-2xl'>(
    () => readEditorTypePrefs().size || editorSizeFromProfile(userProfile?.fontSize)
  );
  const [fontFamily, setFontFamily] = useState<'font-serif' | 'font-sans' | 'font-mono'>(
    () => readEditorTypePrefs().family || editorFamilyFromProfile(userProfile?.defaultFont)
  );
  useEffect(() => {
    saveEditorTypePrefs(fontFamily, fontSize);
  }, [fontSize, fontFamily]);
  const [showTypeSettings, setShowTypeSettings] = useState(false);

  // Stats (Active Scene)
  const wordCount = countWords(activeContent);
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // ~200 wpm
  
  // Stats (Project Total)
  const getTotalWords = (items: ManuscriptItem[]): number => {
    let total = 0;
    for (const item of items) {
       if (item.type === 'scene') total += countWords(item.content);
       if (item.children) total += getTotalWords(item.children);
    }
    return total;
  };
  const totalProjectWords = getTotalWords(manuscript);
  
  const currentProjectMeta = projectId ? storage.getProjects().find(p => p.id === projectId) : null;
  const targetWords = currentProjectMeta?.wordGoal || 50000;
  const progressPercent = targetWords > 0 ? Math.min(100, Math.round((totalProjectWords / targetWords) * 100)) : 0;
  const sceneTotal = (function count(items: ManuscriptItem[]): number {
    return items.reduce((n, i) => n + (i.type === 'scene' ? 1 : 0) + (i.children ? count(i.children) : 0), 0);
  })(manuscript);

  // Save timeout and pending content refs for instant persistence
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<{ docId: string; content: string } | null>(null);

  const flushSave = () => {
    if (!pendingContentRef.current || !projectId) return;
    const { docId, content } = pendingContentRef.current;
    pendingContentRef.current = null;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setManuscript(prev => {
      const updateNode = (items: ManuscriptItem[]): ManuscriptItem[] => {
        return items.map(item => {
          if (item.id === docId) {
            return { ...item, content };
          }
          if (item.children) {
            return { ...item, children: updateNode(item.children) };
          }
          return item;
        });
      };
      const updated = updateNode(prev);
      storage.saveProjectData(projectId, { manuscript: updated });
      return updated;
    });
    setIsSaving(false);
  };

  useEffect(() => {
    // Flush any pending unsaved text before loading new scene
    flushSave();
    const content = findSceneContent(manuscript, activeDocId);
    setActiveContent(content);
  }, [activeDocId]);

  // Flush on unmount (e.g., navigating to Dashboard or other tabs)
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [projectId]);

  const handleEntityClick = (entityId: string, entityType: 'character' | 'location') => {
    setSelectedEntity({ id: entityId, type: entityType });
    setActiveTab(entityType === 'character' ? 'chars' : 'locs');
    if (!isContextOpen) setIsContextOpen(true);
    
    // Auto-scroll to entity
    setTimeout(() => {
      const el = document.getElementById(`entity-${entityId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleNoteChange = (newNoteText: string) => {
    setSceneNotes(prev => {
      const updated = { ...prev, [activeDocId]: newNoteText };
      if (noteSaveTimeoutRef.current) clearTimeout(noteSaveTimeoutRef.current);
      noteSaveTimeoutRef.current = setTimeout(() => {
        if (projectId) {
          storage.saveProjectData(projectId, { notes: updated });
        }
      }, 600);
      return updated;
    });
  };

  const getEntityMentionCount = (
    entityOrName: { id?: string | number; name?: string; aliases?: string[] | string } | string
  ) => {
    if (!activeContent) return 0;
    try {
      const entity = typeof entityOrName === 'string'
        ? { id: '', name: entityOrName, aliases: [] }
        : entityOrName;

      if (!entity || !entity.name) return 0;

      const entityId = entity.id ? String(entity.id).trim() : '';

      // 1. Direct Tiptap Mention span matches by data-id (e.g. data-id="char-1" or data-id="1")
      if (entityId) {
        const cleanId = entityId.replace(/^char-|^loc-/, '');
        const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idRegex = new RegExp(`data-id=["'](?:char-|loc-)?${escapedId}["']`, 'gi');
        const idMatches = activeContent.match(idRegex);
        if (idMatches && idMatches.length > 0) {
          return idMatches.length;
        }
      }

      // 2. Gather all recognizable name variations (Full name, aliases, first/call name)
      const name = entity.name.trim();
      const representations = new Set<string>();
      representations.add(name);

      // Aliases
      if (entity.aliases) {
        const aliasList = Array.isArray(entity.aliases)
          ? entity.aliases
          : String(entity.aliases).split(',');
        for (const a of aliasList) {
          const t = a.trim();
          if (t.length >= 2) representations.add(t);
        }
      }

      // First name / significant individual words (e.g. "Aurelia", "Jaxen", "Blackthorn")
      const parts = name.split(/\s+/).filter(p => p.length >= 3);
      for (const p of parts) {
        const lower = p.toLowerCase();
        if (!['princess', 'prince', 'king', 'queen', 'lord', 'lady', 'sir', 'the', 'captain', 'mr', 'mrs'].includes(lower)) {
          representations.add(p);
        }
      }

      // 3. Match against data-label inside mention tags
      let labelCount = 0;
      for (const rep of representations) {
        const escaped = rep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dlRegex = new RegExp(`data-label=["']${escaped}["']`, 'gi');
        const m = activeContent.match(dlRegex);
        if (m) labelCount += m.length;
      }
      if (labelCount > 0) return labelCount;

      // 4. Fallback: Plain-text search in scene prose (stripping HTML tags first to avoid attribute false matches)
      const plainText = activeContent.replace(/<[^>]+>/g, ' ');
      const sortedReps = Array.from(representations).sort((a, b) => b.length - a.length);
      for (const rep of sortedReps) {
        const escaped = rep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
        const m = plainText.match(regex);
        if (m && m.length > 0) {
          return m.length;
        }
      }

      return 0;
    } catch {
      return 0;
    }
  };

  const handleCopyEntityTag = (name: string) => {
    navigator.clipboard.writeText(`@${name}`);
    setCopiedEntityName(name);
    setTimeout(() => setCopiedEntityName(null), 1800);
  };

  const handleContentChange = (newHtml: string) => {
    setActiveContent(newHtml);
    setIsSaving(true);
    pendingContentRef.current = { docId: activeDocId, content: newHtml };
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      flushSave();
    }, 800);
  };


  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNodes(newSet);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedNodeId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNodeId || draggedNodeId === targetId) return;

    const dragged0 = findNodeById(manuscript, draggedNodeId);
    const target0 = findNodeById(manuscript, targetId);
    if (!dragged0 || !target0) return;
    // Dropping a folder into its own descendant would detach the whole branch
    if (findNodeById(dragged0.children || [], targetId)) { setDraggedNodeId(null); return; }
    const targetParentType = (function parentOf(items: ManuscriptItem[], type: ManuscriptItem['type'] | 'root'): ManuscriptItem['type'] | 'root' | null {
      for (const it of items) {
        if (it.id === targetId) return type;
        if (it.children) { const r = parentOf(it.children, it.type); if (r) return r; }
      }
      return null;
    })(manuscript, 'root');
    const dropInside = canContain(target0.type, dragged0.type);
    if (!dropInside && !canContain(targetParentType || 'root', dragged0.type)) { setDraggedNodeId(null); return; }

    const newManuscript = JSON.parse(JSON.stringify(manuscript));
    
    // Find and remove source
    let draggedNode = null;
    const removeNode = (items: ManuscriptItem[]) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === draggedNodeId) {
          draggedNode = items.splice(i, 1)[0];
          return true;
        }
        if (items[i].children && removeNode(items[i].children!)) return true;
      }
      return false;
    };
    removeNode(newManuscript);

    if (!draggedNode) return;

    // Insert at target
    const insertNode = (items: ManuscriptItem[]) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) {
          // Drop inside a folder that can hold it, otherwise place it right after the target
          if (dropInside) {
            if (!items[i].children) items[i].children = [];
            items[i].children!.push(draggedNode!);
            setExpandedNodes(prev => new Set(prev).add(targetId));
          } else {
            items.splice(i + 1, 0, draggedNode!);
          }
          return true;
        }
        if (items[i].children && insertNode(items[i].children!)) return true;
      }
      return false;
    };
    
    if (!insertNode(newManuscript)) {
       // fallback if target not found (shouldn't happen), just push to root
       newManuscript.push(draggedNode);
    }

    setManuscript(newManuscript); if (projectId) storage.saveProjectData(projectId, { manuscript: newManuscript });
    setDraggedNodeId(null);
  };

  const handleAction = (action: string, item: ManuscriptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenuOpenId(null);
    const newManuscript = JSON.parse(JSON.stringify(manuscript));

    const findParentArray = (items: ManuscriptItem[], id: string): ManuscriptItem[] | null => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) return items;
        if (items[i].children) {
          const res = findParentArray(items[i].children!, id);
          if (res) return res;
        }
      }
      return null;
    };

    if (action === 'rename') {
      setEditingNodeId(item.id);
      setEditingTitle(item.title);
      return;
    }

    if (action === 'delete') {
      setContextMenuOpenId(null);
      setItemToDelete(item);
      return;
    }

    if (action === 'duplicate' || action === 'add_scene_below') {
       const parentArr = findParentArray(newManuscript, item.id);
       if (parentArr) {
          const idx = parentArr.findIndex(x => x.id === item.id);
          if (idx > -1) {
             const newId = (action === 'duplicate' ? item.type : 'scene') + '-' + Date.now();
             const newItem: ManuscriptItem = action === 'duplicate' 
                ? { ...cloneWithNewIds(item, String(Date.now())), id: newId, title: item.title + ' (Copy)' }
                : { id: newId, type: 'scene', title: 'New Scene', content: '' };
             
             parentArr.splice(idx + 1, 0, newItem);
             setManuscript(newManuscript); if (projectId) storage.saveProjectData(projectId, { manuscript: newManuscript });
             if (action === 'add_scene_below') {
                setActiveDocId(newId);
                setEditingNodeId(newId);
                setEditingTitle('New Scene');
             }
          }
       }
       return;
    }
  };

  const saveRename = () => {
    if (!editingNodeId) return;
    const newManuscript = JSON.parse(JSON.stringify(manuscript));
    
    const updateTitle = (items: ManuscriptItem[]) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === editingNodeId) {
          items[i].title = editingTitle || 'Untitled';
          return true;
        }
        if (items[i].children && updateTitle(items[i].children!)) return true;
      }
      return false;
    };
    updateTitle(newManuscript);
    setManuscript(newManuscript); if (projectId) storage.saveProjectData(projectId, { manuscript: newManuscript });
    setEditingNodeId(null);
  };

  // State for Create Item Modal
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    type: 'part' | 'chapter' | 'scene';
    parentId?: string;
  } | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createParentId, setCreateParentId] = useState<string>('');

  // State for Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<ManuscriptItem | null>(null);

  // Helper to extract parts
  const availableParts = useMemo(() => {
    return manuscript.filter(m => m.type === 'part').map(p => ({ id: p.id, title: p.title }));
  }, [manuscript]);

  // Helper to extract chapters
  const availableChapters = useMemo(() => {
    const list: { id: string; title: string; partTitle?: string }[] = [];
    for (const item of manuscript) {
      if (item.type === 'chapter') {
        list.push({ id: item.id, title: item.title });
      } else if (item.type === 'part' && item.children) {
        for (const child of item.children) {
          if (child.type === 'chapter') {
            list.push({ id: child.id, title: child.title, partTitle: item.title });
          }
        }
      }
    }
    return list;
  }, [manuscript]);

  const openCreateModal = (type: 'part' | 'chapter' | 'scene', parentId?: string) => {
    setAddMenuOpen(false);
    let initialParent = parentId || '';
    if (!initialParent) {
      if (type === 'chapter' && availableParts.length > 0) {
        initialParent = availableParts[0].id;
      } else if (type === 'scene' && availableChapters.length > 0) {
        const currentChapter = availableChapters.find(c => {
          const chapNode = findNodeById(manuscript, c.id);
          return chapNode?.children?.some(s => s.id === activeDocId);
        });
        initialParent = currentChapter ? currentChapter.id : availableChapters[0].id;
      }
    }
    setCreateParentId(initialParent);
    setCreateTitle('');
    setCreateModal({ isOpen: true, type, parentId: initialParent });
  };

  const handleConfirmCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!createModal) return;

    const { type } = createModal;
    const newManuscript: ManuscriptItem[] = JSON.parse(JSON.stringify(manuscript));
    const newId = `${type}-${Date.now()}`;
    const defaultTitle = type === 'part'
      ? `Part ${availableParts.length + 1}`
      : type === 'chapter'
      ? `Chapter ${availableChapters.length + 1}`
      : `Scene ${Date.now().toString().slice(-4)}`;
    const title = createTitle.trim() || defaultTitle;

    const newItem: ManuscriptItem = {
      id: newId,
      type,
      title,
      ...(type !== 'scene' ? { children: [] } : { content: '<p></p>' })
    };

    if (type === 'part') {
      newManuscript.push(newItem);
      setExpandedNodes(prev => new Set(prev).add(newId));
    } else if (type === 'chapter') {
      if (createParentId) {
        const parentPart = newManuscript.find(m => m.id === createParentId);
        if (parentPart) {
          if (!parentPart.children) parentPart.children = [];
          parentPart.children.push(newItem);
          setExpandedNodes(prev => new Set(prev).add(createParentId).add(newId));
        } else {
          newManuscript.push(newItem);
          setExpandedNodes(prev => new Set(prev).add(newId));
        }
      } else {
        newManuscript.push(newItem);
        setExpandedNodes(prev => new Set(prev).add(newId));
      }
    } else if (type === 'scene') {
      let inserted = false;
      if (createParentId) {
        const insertIntoChapter = (items: ManuscriptItem[]): boolean => {
          for (const item of items) {
            if (item.id === createParentId) {
              if (!item.children) item.children = [];
              item.children.push(newItem);
              setExpandedNodes(prev => new Set(prev).add(item.id));
              return true;
            }
            if (item.children && insertIntoChapter(item.children)) return true;
          }
          return false;
        };
        inserted = insertIntoChapter(newManuscript);
      }

      if (!inserted) {
        if (newManuscript.length > 0) {
          const first = newManuscript[0];
          if (first.type === 'chapter') {
            if (!first.children) first.children = [];
            first.children.push(newItem);
          } else if (first.type === 'part' && first.children && first.children.length > 0) {
            if (!first.children[0].children) first.children[0].children = [];
            first.children[0].children.push(newItem);
          } else {
            newManuscript.push(newItem);
          }
        } else {
          const chapterId = `chapter-${Date.now()}`;
          newManuscript.push({
            id: chapterId,
            type: 'chapter',
            title: 'Chapter 1',
            children: [newItem]
          });
          setExpandedNodes(prev => new Set(prev).add(chapterId));
        }
      }
      setActiveDocId(newId);
    }

    setManuscript(newManuscript);
    if (projectId) {
      storage.saveProjectData(projectId, { manuscript: newManuscript });
    }

    setCreateModal(null);
    setCreateTitle('');
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    const newManuscript: ManuscriptItem[] = JSON.parse(JSON.stringify(manuscript));
    const findParentArray = (items: ManuscriptItem[], id: string): ManuscriptItem[] | null => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) return items;
        if (items[i].children) {
          const res = findParentArray(items[i].children!, id);
          if (res) return res;
        }
      }
      return null;
    };

    const parentArr = findParentArray(newManuscript, itemToDelete.id);
    if (parentArr) {
      const idx = parentArr.findIndex(x => x.id === itemToDelete.id);
      if (idx > -1) {
        parentArr.splice(idx, 1);
      }
      setManuscript(newManuscript);
      if (projectId) {
        storage.saveProjectData(projectId, { manuscript: newManuscript });
      }

      const isDescendantOrSelf = (node: ManuscriptItem, targetId: string): boolean => {
        if (node.id === targetId) return true;
        if (node.children) {
          return node.children.some(child => isDescendantOrSelf(child, targetId));
        }
        return false;
      };

      if (isDescendantOrSelf(itemToDelete, activeDocId)) {
        pendingContentRef.current = null;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(false);
        setActiveDocId(findFirstSceneId(newManuscript));
      }

      const removedIds: string[] = [];
      (function walk(n: ManuscriptItem) { removedIds.push(n.id); n.children?.forEach(walk); })(itemToDelete);
      if (removedIds.some((rid) => sceneNotes[rid] !== undefined)) {
        const nextNotes = { ...sceneNotes };
        removedIds.forEach((rid) => delete nextNotes[rid]);
        setSceneNotes(nextNotes);
        if (projectId) storage.saveProjectData(projectId, { notes: nextNotes });
      }
    }

    setItemToDelete(null);
  };




  // Exit Focus Mode on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
        setIsContextOpen(true);
        setIsManuscriptOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
  

  return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Close binder menus on any outside click
  useEffect(() => {
    if (!contextMenuOpenId && !addMenuOpen && !showTypeSettings) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-studio-menu]')) return;
      setContextMenuOpenId(null);
      setAddMenuOpen(false);
      setShowTypeSettings(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenuOpenId, addMenuOpen, showTypeSettings]);

  // Keep the open scene visible in the binder
  useEffect(() => {
    if (!activeDocId) return;
    const path = getBreadcrumbs(manuscript, activeDocId);
    if (!path) return;
    const folders = path.slice(0, -1).map((p) => p.id);
    if (folders.some((id) => !expandedNodes.has(id))) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        folders.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [activeDocId]);

  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const menuItem = 'w-full text-left px-3 py-2 text-[13px] rounded-xl hover:bg-[#F3EEE4] transition-colors flex items-center gap-2 cursor-pointer';

  const renderManuscriptTree = (items: ManuscriptItem[], level = 0) => {
    return (
      <div className="space-y-0.5">
        {items.map(item => {
          const isFolder = item.type === 'part' || item.type === 'chapter';
          const isExpanded = expandedNodes.has(item.id);
          const isEditing = editingNodeId === item.id;
          const isActive = activeDocId === item.id;
          const words = item.type === 'scene' ? (isActive ? wordCount : countWords(item.content)) : 0;

          return (
          <div key={item.id}>
            <div
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={(e) => { handleDragOver(e); if (dragOverId !== item.id) setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId((cur) => (cur === item.id ? null : cur))}
              onDrop={(e) => { setDragOverId(null); handleDrop(e, item.id); }}
              onDragEnd={() => { setDraggedNodeId(null); setDragOverId(null); }}
              className={`group relative flex items-center gap-1.5 pr-1.5 rounded-xl cursor-pointer transition-colors ${
                isActive
                  ? 'bg-white shadow-[0_1px_2px_rgba(14,29,38,0.06)] ring-1 ring-[#E9E2D4]'
                  : 'hover:bg-[#EFE9DE]/70'
              } ${item.type === 'part' ? 'py-2 mt-2 first:mt-0' : 'py-1.5'} ${draggedNodeId === item.id ? 'opacity-40' : ''} ${
                dragOverId === item.id && draggedNodeId && draggedNodeId !== item.id ? 'ring-2 ring-[#E8561F]/40' : ''
              }`}
              style={{ paddingLeft: `${level * 14 + 6}px` }}
              onClick={() => {
                if (item.type === 'scene') handleSelectScene(item.id);
                else toggleExpand(item.id, { stopPropagation: () => {} } as any);
              }}
            >
              {isFolder ? (
                <span onClick={(e) => toggleExpand(item.id, e)} className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#0E1D26] hover:bg-black/5">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
              ) : (
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#E8561F]' : words > 0 ? 'bg-[#0E1D26]/30' : 'border border-[#0E1D26]/25'}`} />
                </span>
              )}

              {isEditing ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={saveRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingNodeId(null); }}
                  className="flex-1 min-w-0 h-7 px-2 rounded-lg bg-white border border-[#E8561F]/50 text-[13px] font-medium text-[#0E1D26] focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : item.type === 'part' ? (
                <span className="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0E1D26]/50 leading-tight">{item.title}</span>
              ) : item.type === 'chapter' ? (
                <span className="flex-1 min-w-0 text-[13px] font-semibold text-[#0E1D26] leading-snug truncate">{item.title}</span>
              ) : (
                <span className={`flex-1 min-w-0 text-[13px] leading-snug truncate ${isActive ? 'font-semibold text-[#0E1D26]' : 'text-[#0E1D26]/70'}`}>{item.title}</span>
              )}

              {!isEditing && item.type === 'scene' && words > 0 && (
                <span className="shrink-0 text-[11px] tabular-nums text-[#0E1D26]/35 group-hover:hidden">{words.toLocaleString()}</span>
              )}
              {!isEditing && isFolder && item.children && item.children.length > 0 && (
                <span className="shrink-0 text-[11px] tabular-nums text-[#0E1D26]/30 group-hover:hidden">{item.children.length}</span>
              )}

              {/* Row menu */}
              <div className="relative shrink-0" data-studio-menu>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenuOpenId(contextMenuOpenId === item.id ? null : item.id);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[#0E1D26]/50 hover:text-[#0E1D26] hover:bg-black/5 transition-opacity ${contextMenuOpenId === item.id ? 'flex bg-black/5' : 'hidden group-hover:flex'}`}
                  title="More"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {contextMenuOpenId === item.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 p-1.5 bg-white border border-[#E9E2D4] rounded-2xl shadow-[0_12px_32px_-12px_rgba(14,29,38,0.25)] z-50 text-[#0E1D26]">
                    <button onClick={(e) => handleAction('rename', item, e)} className={menuItem}>Rename</button>
                    {item.type === 'part' && (
                      <button onClick={(e) => { e.stopPropagation(); setContextMenuOpenId(null); openCreateModal('chapter', item.id); }} className={menuItem}>
                        <Plus className="w-3.5 h-3.5 text-[#E8561F]" /> Add chapter inside
                      </button>
                    )}
                    {item.type === 'chapter' && (
                      <button onClick={(e) => { e.stopPropagation(); setContextMenuOpenId(null); openCreateModal('scene', item.id); }} className={menuItem}>
                        <Plus className="w-3.5 h-3.5 text-[#E8561F]" /> Add scene inside
                      </button>
                    )}
                    {!isFolder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuOpenId(null);
                          const currentChapter = availableChapters.find(c => {
                            const chapNode = findNodeById(manuscript, c.id);
                            return chapNode?.children?.some(s => s.id === item.id);
                          });
                          openCreateModal('scene', currentChapter?.id);
                        }}
                        className={menuItem}
                      >
                        <Plus className="w-3.5 h-3.5 text-[#E8561F]" /> New scene in chapter
                      </button>
                    )}
                    <button onClick={(e) => handleAction('duplicate', item, e)} className={menuItem}>Duplicate</button>
                    <div className="h-px bg-[#F1ECE2] my-1 mx-2" />
                    <button onClick={(e) => handleAction('delete', item, e)} className={`${menuItem} text-[#B3261E] hover:bg-[#B3261E]/5`}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            {isFolder && isExpanded && item.children && item.children.length > 0 && renderManuscriptTree(item.children, level + 1)}
          </div>
        )})}
      </div>
    );
  };

  function getBreadcrumbs(items: ManuscriptItem[], targetId: string, currentPath: ManuscriptItem[] = []): ManuscriptItem[] | null {
    for (const item of items) {
      const path = [...currentPath, item];
      if (item.id === targetId) return path;
      if (item.children) {
        const found = getBreadcrumbs(item.children, targetId, path);
        if (found) return found;
      }
    }
    return null;
  }

  const breadcrumbs = getBreadcrumbs(manuscript, activeDocId) || [];
  const currentDoc = breadcrumbs[breadcrumbs.length - 1];
  const parentDoc = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const toggleFocus = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    setIsContextOpen(!next);
    setIsManuscriptOpen(!next);
  };

  const iconBtn = (active = false) =>
    `w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
      active ? 'bg-[#0E1D26] text-[#F6F1E7]' : 'text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#EFE9DE]'
    }`;

  // Entities in the current scene first, the rest after
  const matchesQuery = (fields: any[]) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return fields.some((f) => (Array.isArray(f) ? f.some((t) => String(t).toLowerCase().includes(q)) : f && String(f).toLowerCase().includes(q)));
  };
  const rankEntities = (list: any[], kind: 'char' | 'loc') =>
    list
      .filter((e) => (kind === 'char' ? matchesQuery([e.name, e.role, e.description, e.traits]) : matchesQuery([e.name, e.type, e.description])))
      .map((e) => ({ e, count: getEntityMentionCount(e) }))
      .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0));
  const rankedChars = activeTab === 'chars' ? rankEntities(characters, 'char') : [];
  const rankedLocs = activeTab === 'locs' ? rankEntities(locations, 'loc') : [];

  const renderEntityCard = (entity: any, count: number, kind: 'char' | 'loc', idx: number) => {
    const key = `${kind}-${entity.id}`;
    const isExpanded = expandedEntityId === key || selectedEntity?.id === String(entity.id);
    const subtitle = kind === 'char'
      ? `${entity.role || 'Character'}${entity.age ? ` · ${entity.age}` : ''}`
      : entity.type || 'Place';
    return (
      <div
        key={`studio-${key}-${idx}`}
        id={`entity-${entity.id}`}
        className={`rounded-2xl bg-white border transition-colors overflow-hidden ${isExpanded ? 'border-[#0E1D26]/25' : 'border-[#E9E2D4] hover:border-[#D9CFBC]'}`}
      >
        <button
          type="button"
          onClick={() => {
            setExpandedEntityId(isExpanded ? null : key);
            if (isExpanded && selectedEntity?.id === String(entity.id)) setSelectedEntity(null);
          }}
          className="w-full p-3 flex items-center gap-3 text-left cursor-pointer"
        >
          {entity.imageUrl ? (
            <img src={entity.imageUrl} alt={entity.name} className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-[#E9E2D4]" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-[#EFE9DE] text-[#0E1D26]/60 flex items-center justify-center text-[13px] font-bold shrink-0">
              {kind === 'char' ? (entity.name ? entity.name.charAt(0).toUpperCase() : '?') : <MapPin className="w-4 h-4" />}
            </span>
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-[#0E1D26] truncate">{entity.name}</span>
            <span className="block text-[12px] text-[#0E1D26]/50 truncate">{subtitle}</span>
          </span>
          {count > 0 && (
            <span className="shrink-0 h-5 px-2 rounded-full bg-[#E8561F]/10 text-[#C4461A] text-[11px] font-semibold tabular-nums flex items-center" title={`${count} mention${count === 1 ? '' : 's'} in this scene`}>
              {count}×
            </span>
          )}
          <ChevronDown className={`w-4 h-4 shrink-0 text-[#0E1D26]/35 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 text-[13px]">
            {kind === 'loc' && entity.imageUrl && (
              <img src={entity.imageUrl} alt={entity.name} className="w-full h-28 object-cover rounded-xl" />
            )}
            {kind === 'char' && entity.motivation && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0E1D26]/40">Wants</p>
                <p className="mt-0.5 leading-relaxed text-[#0E1D26]/80">{entity.motivation}</p>
              </div>
            )}
            {(kind === 'char' ? entity.description || entity.backstory : entity.description) && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0E1D26]/40">{kind === 'char' ? 'Profile' : 'Atmosphere'}</p>
                <p className={`mt-0.5 leading-relaxed text-[#0E1D26]/65 ${kind === 'char' ? 'line-clamp-5' : ''}`}>
                  {kind === 'char' ? entity.description || entity.backstory : entity.description}
                </p>
              </div>
            )}
            {kind === 'char' && Array.isArray(entity.traits) && entity.traits.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entity.traits.map((trait: string, i: number) => (
                  <span key={i} className="h-6 px-2.5 rounded-full bg-[#F3EEE4] text-[#0E1D26]/70 text-[11px] font-medium flex items-center">{trait}</span>
                ))}
              </div>
            )}
            <div className="pt-2 flex items-center justify-between border-t border-[#F1ECE2]">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCopyEntityTag(entity.name); }}
                className="h-7 px-3 rounded-full bg-[#F3EEE4] hover:bg-[#EFE9DE] text-[12px] font-semibold text-[#0E1D26]/75 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedEntityName === entity.name ? <><Check className="w-3.5 h-3.5 text-[#2F7A4F]" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy @tag</>}
              </button>
              {projectId && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`/project/${projectId}/${kind === 'char' ? 'characters' : 'locations'}`); }}
                  className="text-[12px] font-semibold text-[#0E1D26]/50 hover:text-[#0E1D26] flex items-center gap-1 cursor-pointer"
                >
                  Edit <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEntityList = (ranked: { e: any; count: number }[], kind: 'char' | 'loc', total: number) => {
    const inScene = ranked.filter((r) => r.count > 0);
    const rest = ranked.filter((r) => r.count === 0);
    if (total === 0) {
      return (
        <div className="px-4 py-10 text-center">
          <span className="mx-auto w-11 h-11 rounded-full bg-white border border-[#E9E2D4] flex items-center justify-center text-[#0E1D26]/35">
            {kind === 'char' ? <Users className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </span>
          <p className="mt-3 text-[14px] font-semibold text-[#0E1D26]">{kind === 'char' ? 'No characters yet' : 'No places yet'}</p>
          <p className="mt-1 text-[13px] text-[#0E1D26]/50">{kind === 'char' ? 'Add your cast, then mention them with @ while writing.' : 'Add places in the World Atlas to keep them at hand.'}</p>
        </div>
      );
    }
    if (ranked.length === 0) {
      return <p className="px-4 py-8 text-center text-[13px] text-[#0E1D26]/45">Nothing matches “{searchQuery}”.</p>;
    }
    return (
      <div className="space-y-4">
        {inScene.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">In this scene</p>
            {inScene.map((r, i) => renderEntityCard(r.e, r.count, kind, i))}
          </div>
        )}
        {rest.length > 0 && (
          <div className="space-y-2">
            {inScene.length > 0 && <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Everyone else</p>}
            {rest.map((r, i) => renderEntityCard(r.e, r.count, kind, i + inScene.length))}
          </div>
        )}
      </div>
    );
  };

  const fieldLabel = 'block text-[12px] font-semibold text-[#0E1D26]/60 mb-1.5';
  const fieldInput = 'w-full h-11 px-4 rounded-2xl bg-white border border-[#E9E2D4] text-[14px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 transition-colors';

  return (
    <div className="flex-1 flex overflow-hidden bg-[#F8F5EE] text-[#0E1D26] font-['Outfit']">
      {/* Left: manuscript binder */}
      <AnimatePresence initial={false}>
      {isManuscriptOpen && !isFocusMode && (
        <motion.div key="binder" initial={{ width: 0 }} animate={{ width: 260 }} exit={{ width: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="shrink-0 h-full overflow-hidden z-10">
        <aside className="w-[260px] h-full bg-[#FBF9F4] border-r border-[#E9E2D4] flex flex-col">
          <div className="px-4 pt-5 pb-3 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Manuscript</p>
              <p className="mt-1 text-[12px] text-[#0E1D26]/50 tabular-nums">
                {sceneTotal} {sceneTotal === 1 ? 'scene' : 'scenes'} · {totalProjectWords.toLocaleString()} words
              </p>
            </div>
            <button onClick={() => setIsManuscriptOpen(false)} className={iconBtn()} title="Hide manuscript">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 pb-3 custom-scrollbar">
            {manuscript.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-[13px] text-[#0E1D26]/50">No chapters yet.</p>
                <button
                  onClick={() => openCreateModal('chapter')}
                  className="mt-3 h-9 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> First chapter
                </button>
              </div>
            ) : (
              renderManuscriptTree(manuscript)
            )}
          </div>

          <div className="p-3 border-t border-[#E9E2D4] shrink-0 flex items-center gap-2 relative" data-studio-menu>
            <button
              onClick={() => openCreateModal('scene')}
              className="flex-1 h-10 rounded-full bg-[#0E1D26] hover:bg-[#132631] text-[#F6F1E7] text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" /> New scene
            </button>
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${addMenuOpen ? 'bg-[#EFE9DE] border-[#E9E2D4]' : 'border-[#E9E2D4] hover:bg-[#EFE9DE]'}`}
              title="Add chapter or part"
            >
              <MoreVertical className="w-4 h-4 text-[#0E1D26]/60" />
            </button>
            {addMenuOpen && (
              <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 bg-white border border-[#E9E2D4] rounded-2xl shadow-[0_12px_32px_-12px_rgba(14,29,38,0.25)] z-50">
                <button onClick={() => openCreateModal('chapter')} className={menuItem}><BookOpen className="w-4 h-4 text-[#0E1D26]/50" /> New chapter</button>
                <button onClick={() => openCreateModal('part')} className={menuItem}><ListTree className="w-4 h-4 text-[#0E1D26]/50" /> New part</button>
              </div>
            )}
          </div>
        </aside>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Centre: the page */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        <header className={`shrink-0 h-14 px-4 flex items-center justify-between gap-3 transition-opacity duration-300 ${isFocusMode ? 'opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-50 bg-[#F8F5EE]/95' : 'border-b border-[#E9E2D4] bg-[#F8F5EE] relative z-10'}`}>
          <div className="flex items-center gap-2 min-w-0">
            {!isManuscriptOpen && !isFocusMode && (
              <button onClick={() => setIsManuscriptOpen(true)} className={iconBtn()} title="Show manuscript">
                <ListTree className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0 flex items-baseline gap-1.5 text-[13px]">
              {parentDoc && <span className="text-[#0E1D26]/45 truncate max-w-[180px]">{parentDoc.title}</span>}
              {parentDoc && <span className="text-[#0E1D26]/25">/</span>}
              <span className="font-semibold text-[#0E1D26] truncate">{currentDoc?.title || 'Untitled'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">

            <span className="w-[74px] flex items-center justify-end gap-1.5 text-[12px] text-[#0E1D26]/45">
              {isSaving ? <><RefreshCw className="w-3 h-3 animate-spin" /> Saving</> : <><Check className="w-3.5 h-3.5 text-[#2F7A4F]" /> Saved</>}
            </span>

            <div className="relative" data-studio-menu>
              <button onClick={() => setShowTypeSettings(!showTypeSettings)} className={iconBtn(showTypeSettings)} title="Typography">
                <Type className="w-4 h-4" />
              </button>
              {showTypeSettings && (
                <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-white border border-[#E9E2D4] rounded-2xl shadow-[0_12px_32px_-12px_rgba(14,29,38,0.25)] z-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40 mb-2">Typeface</p>
                  <div className="flex gap-1 p-1 rounded-full bg-[#F3EEE4]">
                    {([['font-serif', 'Serif'], ['font-sans', 'Sans'], ['font-mono', 'Mono']] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setFontFamily(v)} className={`flex-1 h-8 rounded-full text-[13px] ${v} cursor-pointer ${fontFamily === v ? 'bg-white shadow-sm font-semibold text-[#0E1D26]' : 'text-[#0E1D26]/55'}`}>{label}</button>
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40 mt-4 mb-2">Size</p>
                  <div className="flex gap-1 p-1 rounded-full bg-[#F3EEE4]">
                    {([['text-base', 'text-[12px]'], ['text-lg', 'text-[14px]'], ['text-xl', 'text-[16px]'], ['text-2xl', 'text-[18px]']] as const).map(([v, cls]) => (
                      <button key={v} onClick={() => setFontSize(v)} className={`flex-1 h-8 rounded-full ${cls} cursor-pointer ${fontSize === v ? 'bg-white shadow-sm font-semibold text-[#0E1D26]' : 'text-[#0E1D26]/55'}`}>A</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setIsSearchModalOpen(true)} className={iconBtn()} title="Search & replace (Ctrl+Shift+F)">
              <Search className="w-4 h-4" />
            </button>
            {!isFocusMode && (
              <button onClick={() => setIsContextOpen(!isContextOpen)} className={iconBtn(isContextOpen)} title={isContextOpen ? 'Hide cast & notes' : 'Show cast & notes'}>
                <PanelRight className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleFocus} className={iconBtn(isFocusMode)} title={isFocusMode ? 'Leave focus mode (Esc)' : 'Focus mode'}>
              <Focus className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-0">
          <div className={`max-w-[820px] mx-auto min-h-full flex flex-col px-4 sm:px-6 ${isFocusMode ? 'pt-16 pb-20' : 'py-8'}`}>
            {manuscript.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <span className="w-12 h-12 rounded-full bg-white border border-[#E9E2D4] flex items-center justify-center text-[#0E1D26]/40">
                  <BookOpen className="w-5 h-5" />
                </span>
                <p className="mt-4 text-[20px] font-bold">A blank first page</p>
                <p className="mt-1 text-[14px] text-[#0E1D26]/55 max-w-sm">Create a scene and start writing. Chapters and parts can come later.</p>
                <button
                  onClick={() => { setCreateModal({ isOpen: true, type: 'scene', parentId: undefined }); setCreateTitle('Scene 1'); }}
                  className="mt-5 h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  Create first scene
                  <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Plus className="w-4 h-4" /></span>
                </button>
              </div>
            ) : !activeDocId || !currentDoc || currentDoc.type !== 'scene' ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <p className="text-[15px] text-[#0E1D26]/50">Pick a scene from the manuscript to start writing.</p>
                <button onClick={() => openCreateModal('scene')} className="mt-4 h-9 px-4 rounded-full border border-[#E9E2D4] hover:bg-[#EFE9DE] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" /> New scene
                </button>
              </div>
            ) : (
              <>
              <div className="sticky top-3 z-20 mb-4 flex justify-center pointer-events-none">
                <div id="editor-toolbar-portal-target" className="pointer-events-auto flex items-center rounded-full bg-white/95 backdrop-blur border border-[#E9E2D4] shadow-[0_6px_20px_-12px_rgba(14,29,38,0.3)] p-1 empty:hidden"></div>
              </div>
              <article className={`flex-1 flex flex-col bg-white rounded-[28px] ${isFocusMode ? 'border border-transparent' : 'border border-[#EDE6D8] shadow-[0_1px_2px_rgba(14,29,38,0.04)]'} px-5 sm:px-12 lg:px-16 pt-12 pb-16`}>
                <div className="mb-8 px-4">
                  {parentDoc && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0E1D26]/40">{parentDoc.title}</p>}
                  <h1 className="mt-2 font-serif text-[28px] sm:text-[32px] font-bold leading-tight text-[#0E1D26]">{currentDoc.title}</h1>
                  <span className="mt-4 block w-8 h-[3px] rounded-full bg-[#E8561F]" />
                </div>

                {highlightKeyword && (
                  <div className="mb-6 mx-4 h-10 pl-4 pr-1.5 rounded-full bg-[#FFF6DC] border border-[#F0B54B]/50 flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex items-center gap-2 min-w-0 text-[#0E1D26]/75">
                      <Search className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Showing matches for <strong className="text-[#0E1D26]">“{highlightKeyword}”</strong></span>
                    </span>
                    <button onClick={() => setHighlightKeyword(null)} className="h-7 px-3 rounded-full bg-white/80 hover:bg-white text-[12px] font-semibold cursor-pointer" title="Clear highlight">
                      Clear
                    </button>
                  </div>
                )}

                <MentionEditor
                  key={`${activeDocId}-${highlightKeyword || ''}`}
                  initialValue={activeContent}
                  mentionItems={[...characters, ...locations]}
                  onEntityClick={handleEntityClick}
                  onChange={handleContentChange}
                  highlightText={highlightKeyword || undefined}
                  className={`flex-1 min-h-[50vh] ${fontFamily} ${fontSize} leading-[1.8] text-[#1D2A31]`}
                />
              </article>
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        <footer className={`shrink-0 h-12 px-5 border-t border-[#E9E2D4] bg-[#F8F5EE] flex items-center justify-between gap-4 transition-opacity duration-300 ${isFocusMode ? 'opacity-0 hover:opacity-100 absolute bottom-0 left-0 right-0 z-50' : 'relative z-10'}`}>
          <div className="flex items-center gap-4 text-[12px] text-[#0E1D26]/55 tabular-nums">
            <span><strong className="font-semibold text-[#0E1D26]">{wordCount.toLocaleString()}</strong> words</span>
            <span className="hidden sm:inline">{readingTime} min read</span>
          </div>

          <button
            onClick={handleOpenAiPromptHub}
            className="h-8 pl-3.5 pr-1.5 rounded-full border border-[#0E1D26]/15 hover:border-[#0E1D26]/40 bg-white text-[12px] font-semibold text-[#0E1D26] flex items-center gap-2 cursor-pointer transition-colors"
            title="Open the AI Prompt Hub"
          >
            AI Prompt Hub
            {!hasAiGhostwriter ? (
              <span className="h-5 px-2 rounded-full bg-[#E8561F]/10 text-[#C4461A] text-[10px] font-bold uppercase tracking-wider flex items-center">Premium</span>
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#0E1D26] text-[#F6F1E7] flex items-center justify-center"><ChevronRight className="w-3 h-3" /></span>
            )}
          </button>

          <div className="flex items-center gap-2.5 text-[12px] text-[#0E1D26]/55 tabular-nums" title={`${totalProjectWords.toLocaleString()} of ${targetWords.toLocaleString()} words`}>
            <span className="hidden md:inline">Book goal</span>
            <span className="w-24 h-1.5 rounded-full bg-[#E9E2D4] overflow-hidden">
              <span className="block h-full rounded-full bg-[#E8561F] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </span>
            <span className="font-semibold text-[#0E1D26]">{progressPercent}%</span>
          </div>
        </footer>
      </div>

      {/* Right: cast, places, notes */}
      <AnimatePresence initial={false}>
      {isContextOpen && !isFocusMode && (
        <motion.div key="context" initial={{ width: 0 }} animate={{ width: 320 }} exit={{ width: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="shrink-0 h-full overflow-hidden relative z-20">
        <aside className="w-[320px] bg-[#FBF9F4] border-l border-[#E9E2D4] flex flex-col h-full relative">
          <div className="p-3 shrink-0 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
              {([['chars', 'Cast'], ['locs', 'Places'], ['notes', 'Notes']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                  className={`flex-1 h-8 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${activeTab === tab ? 'bg-white text-[#0E1D26] shadow-sm' : 'text-[#0E1D26]/55 hover:text-[#0E1D26]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setIsContextOpen(false)} className={iconBtn()} title="Close panel">
              <X className="w-4 h-4" />
            </button>
          </div>

          {(activeTab === 'chars' || activeTab === 'locs') && (
            <>
              <div className="px-3 pb-3 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#0E1D26]/35 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'chars' ? 'Find a character' : 'Find a place'}
                    className="w-full h-10 pl-10 pr-9 rounded-full bg-white border border-[#E9E2D4] text-[13px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/35"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
                {activeTab === 'chars' ? renderEntityList(rankedChars, 'char', characters.length) : renderEntityList(rankedLocs, 'loc', locations.length)}
              </div>
              {projectId && (
                <div className="p-3 border-t border-[#E9E2D4] shrink-0">
                  <button
                    onClick={() => navigate(`/project/${projectId}/${activeTab === 'chars' ? 'characters' : 'locations'}`)}
                    className="w-full h-9 rounded-full hover:bg-[#EFE9DE] text-[13px] font-semibold text-[#0E1D26]/65 hover:text-[#0E1D26] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {activeTab === 'chars' ? 'Open Characters' : 'Open World Atlas'} <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'notes' && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-3 custom-scrollbar">
              <section className="rounded-2xl bg-white border border-[#E9E2D4] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">This scene</p>
                  <span className="text-[11px] text-[#0E1D26]/35">Saved automatically</span>
                </div>
                <p className="mt-1 text-[14px] font-semibold truncate">{currentDoc?.title || 'No scene open'}</p>
                <textarea
                  value={sceneNotes[activeDocId] || ''}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  disabled={!activeDocId}
                  placeholder="Beats, secrets to reveal, sensory details, what to fix on the next pass…"
                  rows={8}
                  className="mt-3 w-full rounded-xl bg-[#FBF9F4] border border-[#EFE9DE] p-3 text-[13px] leading-relaxed text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/30 resize-none disabled:opacity-50"
                />
              </section>

              <section className="rounded-2xl border border-[#E9E2D4] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Before you write</p>
                  <button onClick={handleOpenAiPromptHub} className="text-[12px] font-semibold text-[#C4461A] hover:underline cursor-pointer">Build AI prompt</button>
                </div>
                <ul className="mt-2.5 space-y-2 text-[13px] leading-snug text-[#0E1D26]/70">
                  {[
                    'What does the viewpoint character want right now?',
                    'Which detail puts the reader in the room?',
                    'What shifts the tension before the scene ends?',
                  ].map((q) => (
                    <li key={q} className="flex gap-2"><span className="mt-[7px] w-1 h-1 rounded-full bg-[#E8561F] shrink-0" />{q}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl bg-white border border-[#E9E2D4] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1D26]/40">Whole book</p>
                <textarea
                  value={scratchpad}
                  onChange={(e) => handleGeneralNoteChange(e.target.value)}
                  placeholder="Ideas, future twists, things to research…"
                  rows={5}
                  className="mt-3 w-full rounded-xl bg-[#FBF9F4] border border-[#EFE9DE] p-3 text-[13px] leading-relaxed text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/30 resize-none"
                />
              </section>
            </div>
          )}
        </aside>
        </motion.div>
      )}
      </AnimatePresence>

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        projectId={projectId || "1"}
        onNavigateToScene={(sceneId, highlightWord) => {
          handleSelectScene(sceneId, highlightWord);
        }}
      />

      <AIPromptModal
        isOpen={isAIPromptModalOpen}
        onClose={() => setIsAIPromptModalOpen(false)}
        projectMeta={projectMeta}
        activeSceneTitle={currentDoc?.title || 'Current Scene'}
        activeSceneNotes={sceneNotes[activeDocId] || ''}
        activeSceneContent={activeContent}
        characters={(() => {
          if (projectId) {
            const data = storage.getProjectData(projectId);
            if (data?.characters && data.characters.length > 0) return data.characters;
          }
          return characters;
        })()}
        locations={locations}
      />

      {/* Create item */}
      <AnimatePresence>
        {createModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0E1D26]/40 backdrop-blur-sm" onClick={() => setCreateModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="relative w-full max-w-md bg-[#FBF9F4] rounded-[28px] border border-[#E9E2D4] shadow-2xl z-10 text-[#0E1D26]"
            >
              <form onSubmit={handleConfirmCreate} className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Manuscript</p>
                    <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.01em]">New {createModal.type}</h2>
                  </div>
                  <button type="button" onClick={() => setCreateModal(null)} className={iconBtn()}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className={fieldLabel}>Title</label>
                    <input
                      type="text"
                      autoFocus
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder={createModal.type === 'part' ? 'Part I: The Silent Twilight' : createModal.type === 'chapter' ? 'Chapter 1: Whispers in the Dark' : 'An unexpected encounter'}
                      className={fieldInput}
                    />
                  </div>

                  {createModal.type === 'chapter' && availableParts.length > 0 && (
                    <div>
                      <label className={fieldLabel}>Inside part</label>
                      <select value={createParentId} onChange={(e) => setCreateParentId(e.target.value)} className={fieldInput}>
                        <option value="">No part (top level)</option>
                        {availableParts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                  )}

                  {createModal.type === 'scene' && availableChapters.length > 0 && (
                    <div>
                      <label className={fieldLabel}>Chapter</label>
                      <select value={createParentId} onChange={(e) => setCreateParentId(e.target.value)} className={fieldInput}>
                        {availableChapters.map((c) => (
                          <option key={c.id} value={c.id}>{c.partTitle ? `${c.partTitle} — ${c.title}` : c.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-7 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setCreateModal(null)} className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2 cursor-pointer transition-colors">
                    Create {createModal.type}
                    <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Plus className="w-4 h-4" /></span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Outfit']">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0E1D26]/40 backdrop-blur-sm" onClick={() => setItemToDelete(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="relative w-full max-w-md bg-[#FBF9F4] rounded-[28px] border border-[#E9E2D4] shadow-2xl z-10 p-6 sm:p-7 text-[#0E1D26]"
            >
              <span className="w-11 h-11 rounded-full bg-[#B3261E]/10 text-[#B3261E] flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="mt-4 text-[20px] font-extrabold tracking-[-0.01em]">Delete this {itemToDelete.type}?</h3>
              <p className="mt-1.5 text-[14px] text-[#0E1D26]/65">
                “{itemToDelete.title}” will be removed from the manuscript. This can’t be undone.
              </p>
              {itemToDelete.children && itemToDelete.children.length > 0 && (
                <div className="mt-4 p-3 rounded-2xl bg-[#FFF6DC] border border-[#F0B54B]/50 text-[13px] text-[#0E1D26]/80 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B7791F] shrink-0 mt-0.5" />
                  <span>Everything inside it goes too — {itemToDelete.children.length} item{itemToDelete.children.length === 1 ? '' : 's'} and their scenes.</span>
                </div>
              )}
              <div className="mt-7 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setItemToDelete(null)} className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmDelete} className="h-10 px-5 rounded-full bg-[#B3261E] hover:bg-[#9A2019] text-white text-[13px] font-bold cursor-pointer transition-colors">
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="ai_hub"
      />
    </div>
  );
}

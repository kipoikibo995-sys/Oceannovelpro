import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  ArrowDownUp,
  Folder,
  Grid,
  Users,
  Upload,
  Download,
  Copy,
  Trash2,
  Edit3,
  Plus,
  Home,
  Shield,
  Heart,
  Swords,
  UserPlus,
  X,
  Bookmark,
  Clock,
  Image as ImageIcon,
  LayoutGrid,
  FileText,
  ClipboardCopy,
  Check,
  Scissors,
  Link2,
  BookOpen,
  HelpCircle,
  Info,
  Feather,
  Lock
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { storage } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/license";
import UpgradeModal from "@/components/UpgradeModal";
import ImageDropzoneCard from "@/components/ImageDropzoneCard";
import ImagePickerModal from "@/components/ImagePickerModal";
import CharacterPresetPickerModal from "@/components/CharacterPresetPickerModal";
import { CharacterPreset } from "@/data/characterPresets";
import { FANTASY_PRESET_PORTRAITS } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";
import {
  IconCopy,
  IconEdit,
  IconFilter,
  IconFolder,
  IconGallery,
  IconHelp,
  IconImage,
  IconLink,
  IconLock,
  IconMinus,
  IconOverview,
  IconPlus,
  IconScissors,
  IconSearch,
  IconSort,
  IconTick,
  IconTrash,
  IconUsers,
} from "@/components/brand/ocean-ui";

// Define exact mock characters based on the provided image
const CATALOG_CHARACTERS: any[] = [];

const MOCK_NODES: any[] = [];

const MOCK_EDGES: any[] = [];

export const RELATION_OPTIONS = [
  { label: "ALLY", color: "#78c3b4", icon: UserPlus },
  { label: "ENEMY", color: "#e15b64", icon: Swords },
  { label: "FAMILY", color: "#6184d8", icon: Shield },
  { label: "LOVER", color: "#f9a8d4", icon: Heart },
  { label: "FRIEND", color: "#fca311", icon: Users },
  { label: "RIVAL", color: "#9c27b0", icon: Swords },
];

export const STANDARD_CHARACTER_GROUPS = [
  { value: "none", label: "None (Ungrouped)" },
  { value: "Divinities", label: "Divinities & Celestials" },
  { value: "Allies", label: "Protagonists & Allies" },
  { value: "Antagonists", label: "Antagonists & Villains" },
  { value: "Royal Court", label: "Royal Court & Nobility" },
  { value: "Guilds & Factions", label: "Guilds & Factions" },
  { value: "Military & Knights", label: "Military & Knights" },
  { value: "Secret Societies", label: "Secret Societies & Cults" },
  { value: "Family & Clan", label: "Family & Clan" },
  { value: "Mentors & Scholars", label: "Mentors & Scholars" },
  { value: "Outlaws & Rogues", label: "Outlaws & Rogues" },
  { value: "Supernatural", label: "Supernatural & Mythical" },
  { value: "Civilians & Townsfolk", label: "Civilians & Townsfolk" },
];

export const CHARACTER_CREATION_AI_PROMPT = `I want you to help me create a character for my novel project.

First, ask me to provide:

1. NOVEL / STORY CONTEXT
A short description of my novel, premise, or current story idea.

2. CHARACTER IDEA
Who I want this character to be.
This can be very simple, such as:
- main female protagonist
- mysterious villain
- protagonist's mother
- young warrior
- old mentor
- romantic interest

3. CHARACTER NAME
Optional. If I already have a name, preserve it exactly.
If I do not provide one, create a suitable name.

After I provide this information, create ONLY the following character information for my Ocean Novel Character form:

1. Character Name
Create a suitable name only if I did not provide one.

2. Age
Choose an appropriate age based on the character's role and story.

3. Status
Choose a concise status such as:
- Alive
- Dead
- Missing
- Unknown
- Presumed Dead

4. Group
State the faction, organization, family, kingdom, team, or group the character belongs to.
If none is appropriate, use:
None

5. Role
Choose the character's primary narrative role, such as:
- Protagonist
- Antagonist
- Deuteragonist
- Supporting Character
- Mentor
- Ally
- Rival
- Love Interest

Choose only ONE primary role.

6. Aliases
Provide 0–3 useful aliases, titles, nicknames, or identities.
If none are needed, write:
None

7. Backstory
Write a concise character backstory of approximately 50–100 words.
Include only the most important past events, motivation, and connection to the main story.

8. MBTI
Choose exactly ONE MBTI personality type that best fits the character.

9. Traits
Provide 5–8 concise personality traits.

10. Physical Appearance
Write a concise 35–70 word physical description including the character's general appearance, hair, eyes, build, clothing style, and any distinctive feature that matters.

IMPORTANT RULES:
- Keep the character consistent with the novel context I provide.
- Do not create chapters, scenes, dialogue, locations, or plot outlines.
- Do not rewrite my entire story.
- Do not add unnecessary lore.
- Do not create relationships unless they are necessary to explain the backstory.
- Keep all fields concise and easy to copy into a form.
- If I provide existing story facts, preserve them and do not contradict them.

After I provide the information, return ONLY this format:

Character Name:
...

Age:
...

Status:
...

Group:
...

Role:
...

Aliases:
...

Backstory:
...

MBTI:
...

Traits:
...

Physical Appearance:
...`;


export function getEdgeIconComponent(edge: any) {
  // If edge.icon is an actual function or valid React component
  if (typeof edge?.icon === "function") {
    return edge.icon;
  }
  if (
    edge?.icon &&
    typeof edge.icon === "object" &&
    (typeof edge.icon.render === "function" ||
      ("$$typeof" in edge.icon && typeof (edge.icon as any).$$typeof === "symbol"))
  ) {
    return edge.icon;
  }
  // Lookup from RELATION_OPTIONS by label
  if (edge?.label) {
    const found = RELATION_OPTIONS.find(
      (r) => r.label.toUpperCase() === String(edge.label).toUpperCase()
    );
    if (found?.icon) return found.icon;
  }
  if (edge?.label === "CUSTOM") return Bookmark;
  return Swords;
}

export function buildDefaultProjectGraph(projectId: string | undefined, chars: any[]) {
  // If stored in project data, validate and return
  if (projectId) {
    const data = storage.getProjectData(projectId);
    if (data?.characterGraphs && data.characterGraphs.length > 0) {
      const firstGraph = data.characterGraphs[0];
      const hasMatchingNode = firstGraph.nodes.some((n: any) => chars.some((c: any) => c.id === n.id));
      if (hasMatchingNode) {
        return data.characterGraphs;
      }
    }
  }

  // Pre-configured relationships for the 5 fantasy books
  if (projectId === "book-golden-oasis") {
    return [
      {
        id: "1",
        name: "Main Plot",
        nodes: [
          { id: "char-amira", x: 420, y: 260 },
          { id: "char-tariq", x: 680, y: 200 },
          { id: "char-zahir", x: 230, y: 240 },
          { id: "char-maheera", x: 480, y: 470 },
        ],
        edges: [
          { id: "e1", source: "char-amira", target: "char-tariq", label: "ALLY", color: "#78c3b4" },
          { id: "e2", source: "char-amira", target: "char-zahir", label: "FAMILY", color: "#6184d8" },
          { id: "e3", source: "char-amira", target: "char-maheera", label: "ENEMY", color: "#e15b64" },
          { id: "e4", source: "char-tariq", target: "char-maheera", label: "RIVAL", color: "#9c27b0" },
        ],
      },
    ];
  }

  if (projectId === "book-sunken-crown") {
    return [
      {
        id: "1",
        name: "Main Plot",
        nodes: [
          { id: "char-valen", x: 420, y: 260 },
          { id: "char-lyra", x: 680, y: 200 },
          { id: "char-garrick", x: 230, y: 240 },
          { id: "char-morath", x: 480, y: 470 },
        ],
        edges: [
          { id: "e1", source: "char-valen", target: "char-lyra", label: "ALLY", color: "#78c3b4" },
          { id: "e2", source: "char-valen", target: "char-garrick", label: "FRIEND", color: "#fca311" },
          { id: "e3", source: "char-valen", target: "char-morath", label: "ENEMY", color: "#e15b64" },
          { id: "e4", source: "char-lyra", target: "char-morath", label: "RIVAL", color: "#9c27b0" },
        ],
      },
    ];
  }

  if (projectId === "book-astral-spire") {
    return [
      {
        id: "1",
        name: "Main Plot",
        nodes: [
          { id: "char-alistair", x: 420, y: 260 },
          { id: "char-sylvia", x: 680, y: 200 },
          { id: "char-kaelen", x: 230, y: 240 },
          { id: "char-inquisitor", x: 480, y: 470 },
        ],
        edges: [
          { id: "e1", source: "char-alistair", target: "char-sylvia", label: "FRIEND", color: "#fca311" },
          { id: "e2", source: "char-alistair", target: "char-kaelen", label: "ALLY", color: "#78c3b4" },
          { id: "e3", source: "char-alistair", target: "char-inquisitor", label: "ENEMY", color: "#e15b64" },
          { id: "e4", source: "char-kaelen", target: "char-inquisitor", label: "RIVAL", color: "#9c27b0" },
        ],
      },
    ];
  }

  if (projectId === "book-frostgate") {
    return [
      {
        id: "1",
        name: "Main Plot",
        nodes: [
          { id: "char-torvin", x: 420, y: 260 },
          { id: "char-freyja", x: 680, y: 200 },
          { id: "char-astrid", x: 230, y: 240 },
          { id: "char-malakor", x: 480, y: 470 },
        ],
        edges: [
          { id: "e1", source: "char-torvin", target: "char-freyja", label: "ALLY", color: "#78c3b4" },
          { id: "e2", source: "char-torvin", target: "char-astrid", label: "FAMILY", color: "#6184d8" },
          { id: "e3", source: "char-torvin", target: "char-malakor", label: "ENEMY", color: "#e15b64" },
          { id: "e4", source: "char-freyja", target: "char-malakor", label: "RIVAL", color: "#9c27b0" },
        ],
      },
    ];
  }

  if (projectId === "book-silent-harbor" || (!projectId && chars.some((c) => c.id === "1"))) {
    return [
      {
        id: "1",
        name: "Main Plot",
        nodes: [
          { id: "1", x: 420, y: 280 },
          { id: "2", x: 680, y: 220 },
          { id: "3", x: 260, y: 440 },
        ],
        edges: [
          { id: "e1", source: "1", target: "2", label: "ALLY", color: "#78c3b4" },
          { id: "e2", source: "1", target: "3", label: "FAMILY", color: "#6184d8" },
        ],
      },
    ];
  }

  // Dynamic layout for any custom characters
  if (chars && chars.length > 0) {
    const layoutPositions = [
      { x: 420, y: 260 },
      { x: 680, y: 200 },
      { x: 230, y: 240 },
      { x: 480, y: 470 },
      { x: 720, y: 450 },
      { x: 200, y: 450 },
    ];
    const dynNodes = chars.map((c, i) => {
      const pos = layoutPositions[i % layoutPositions.length];
      return { id: c.id, x: pos.x, y: pos.y };
    });
    const dynEdges: any[] = [];
    if (chars.length >= 2) {
      dynEdges.push({ id: "e1", source: chars[0].id, target: chars[1].id, label: "ALLY", color: "#78c3b4" });
    }
    if (chars.length >= 3) {
      dynEdges.push({ id: "e2", source: chars[0].id, target: chars[2].id, label: "FAMILY", color: "#6184d8" });
    }
    if (chars.length >= 4) {
      dynEdges.push({ id: "e3", source: chars[0].id, target: chars[3].id, label: "ENEMY", color: "#e15b64" });
    }
    return [{ id: "1", name: "Main Plot", nodes: dynNodes, edges: dynEdges }];
  }

  return [{ id: "1", name: "Main Plot", nodes: MOCK_NODES, edges: MOCK_EDGES }];
}

export default function Characters() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();


  const [viewMode, setViewMode] = useState<"registry" | "connections" | "editor">(
    "connections",
  );
  const [previousViewMode, setPreviousViewMode] = useState<"registry" | "connections">("connections");
  const [characters, setCharacters] = useState<Array<any>>(() => {
    if (id) {
      const data = storage.getProjectData(id);
      if (data?.characters && data.characters.length > 0) {
        return data.characters;
      }
    }
    return CATALOG_CHARACTERS;
  });

  useEffect(() => {
    if (id) {
      const data = storage.getProjectData(id);
      if (data?.characters && data.characters.length > 0) {
        let hasChanges = false;
        const updatedCharacters = data.characters.map((char: any, index: number) => {
          let hasModified = false;
          let backstory = char.backstory;
          let description = char.description;
          if (!backstory && description) {
            backstory = description;
            hasModified = true;
          } else if (!description && backstory) {
            description = backstory;
            hasModified = true;
          }

          let traits = char.traits;
          if (!Array.isArray(traits)) {
            traits = typeof traits === 'string' && traits.trim() ? traits.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            hasModified = true;
          }

          let imageUrl = char.imageUrl;
          if (!imageUrl || imageUrl.includes("unsplash.com") || imageUrl.includes(".webp")) {
            hasModified = true;
            const fallbackPreset = FANTASY_PRESET_PORTRAITS[index % FANTASY_PRESET_PORTRAITS.length];
            imageUrl = fallbackPreset ? fallbackPreset.url : FANTASY_PRESET_PORTRAITS[0].url;
          }

          if (hasModified) hasChanges = true;

          return {
            ...char,
            backstory: backstory || "",
            description: description || backstory || "",
            traits,
            imageUrl,
          };
        });

        if (hasChanges) {
          storage.saveProjectData(id, { characters: updatedCharacters });
        }

        setCharacters(updatedCharacters);
        const projectGraphs = buildDefaultProjectGraph(id, updatedCharacters);
        setGraphs(projectGraphs);
        setActiveGraphId(projectGraphs[0]?.id || "1");
      }
    }
  }, [id]);

  // Editor State
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [traitInput, setTraitInput] = useState("");
  const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);

  // Registry State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState("name_asc");
  const [registryView, setRegistryView] = useState<"grid" | "folder" | "gallery">("grid");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
  const [showClearGraphConfirm, setShowClearGraphConfirm] = useState(false);
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null);
  const [copiedEditor, setCopiedEditor] = useState(false);
  const [quickImageChar, setQuickImageChar] = useState<any | null>(null);
  const [showPortraitGalleryModal, setShowPortraitGalleryModal] = useState(false);
  const [showCharacterGuideModal, setShowCharacterGuideModal] = useState(false);
  const [isCharacterPromptCopied, setIsCharacterPromptCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<"characters" | "image_library">("characters");

  // License quota check
  const profile = storage.getUserProfile();
  const maxCharacters = PLAN_LIMITS[profile?.plan || 'free'].maxCharactersPerProject;
  const hasImageLibrary = PLAN_LIMITS[profile?.plan || 'free'].hasImageLibrary;
  const isCharacterLimitReached = characters.length >= maxCharacters;

  // 50 Character Presets Modal State
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetModalMode, setPresetModalMode] = useState<"editor" | "registry">("editor");

  // Group Management State (Standard + Custom)
  const [isCustomGroupMode, setIsCustomGroupMode] = useState(false);
  const [customGroupInput, setCustomGroupInput] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    age: "",
    status: "",
    aliases: [] as string[],
    backstory: "",
    traits: [] as string[],
    imageUrl: FANTASY_PRESET_PORTRAITS[0]?.url || "https://res.cloudinary.com/mekoxs1q/image/upload/v1790564447/fantasy_01_under_100kb_klikgx.jpg",
    mbti: "",
    archetype: "",
    conflict: "",
    goal: "",
    trauma: "",
    group: "none",
    customAttributes: [] as { key: string, value: string }[],
  });

  // Collect any custom groups that characters in the story already belong to
  const existingCustomGroups = React.useMemo(() => {
    const standardSet = new Set([
      "none",
      ...STANDARD_CHARACTER_GROUPS.map((g) => g.value.toLowerCase()),
      "divinities",
    ]);
    const set = new Set<string>();
    characters.forEach((c: any) => {
      const g = (c.group || "").trim();
      if (g && !standardSet.has(g.toLowerCase())) {
        set.add(g);
      }
    });
    return Array.from(set).sort();
  }, [characters]);

  const handleCopyCharacterPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHARACTER_CREATION_AI_PROMPT);
      setIsCharacterPromptCopied(true);
      setTimeout(() => setIsCharacterPromptCopied(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = CHARACTER_CREATION_AI_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setIsCharacterPromptCopied(true);
      setTimeout(() => setIsCharacterPromptCopied(false), 2500);
    }
  };

  const handleOpenEditorNew = () => {
    if (isCharacterLimitReached) {
      setUpgradeModalFeature("characters");
      setShowUpgradeModal(true);
      return;
    }
    setPreviousViewMode(viewMode === "editor" ? previousViewMode : viewMode);
    setEditingCharId(null);
    setAliasInput("");
    setTraitInput("");
    setShowAttributeDropdown(false);
    setIsCustomGroupMode(false);
    setCustomGroupInput("");
    setFormData({
      name: "",
      role: "",
      age: "",
      status: "ALIVE",
      aliases: [],
      backstory: "",
      traits: [],
      imageUrl: FANTASY_PRESET_PORTRAITS[0]?.url || "https://res.cloudinary.com/mekoxs1q/image/upload/v1790564447/fantasy_01_under_100kb_klikgx.jpg",
      mbti: "",
      archetype: "",
      conflict: "",
      goal: "",
      trauma: "",
      group: "none",
      customAttributes: [],
    });
    setViewMode("editor");
  };

  const handleSelectPreset = (preset: CharacterPreset, directSave = false) => {
    if (isCharacterLimitReached) {
      setUpgradeModalFeature("characters");
      setShowUpgradeModal(true);
      return;
    }

    const newAliases = preset.title
      ? [preset.title, ...(preset.aliases || [])]
      : (preset.aliases || []);
    const cleanGroup = preset.group || "none";

    const customAttrs = [
      { key: "Species", value: preset.race },
      { key: "Signature Ability", value: preset.signatureAbility },
      { key: "Iconic Gear", value: preset.gear },
    ];

    const presetData = {
      name: preset.name,
      role: preset.role,
      age: preset.age,
      status: preset.status,
      aliases: newAliases,
      backstory: preset.backstory,
      traits: [...preset.traits],
      imageUrl: preset.imageUrl,
      mbti: preset.mbti,
      archetype: preset.archetype,
      conflict: preset.conflict,
      goal: preset.goal,
      trauma: preset.trauma,
      group: cleanGroup,
      customAttributes: customAttrs,
    };

    setFormData(presetData);
    setTraitInput("");
    setAliasInput("");

    if (directSave) {
      const newChar = {
        id: Date.now().toString(),
        ...presetData,
        description: preset.backstory,
      };
      const updatedChars = [...characters, newChar];
      setCharacters(updatedChars);
      setNodes((prev: any) => [...prev, { id: newChar.id, x: 200, y: 200 }]);
      if (id) {
        storage.saveProjectData(id, { characters: updatedChars });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      setPreviousViewMode(viewMode === "editor" ? previousViewMode : viewMode);
      setEditingCharId(null);
      setViewMode("editor");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleOpenEditorEdit = (char: any) => {
    setPreviousViewMode(viewMode === "editor" ? previousViewMode : viewMode);
    setEditingCharId(char.id);
    setAliasInput("");
    setTraitInput("");
    setShowAttributeDropdown(false);

    let charTraits: string[] = [];
    if (Array.isArray(char.traits)) {
      charTraits = char.traits.filter(Boolean);
    } else if (typeof char.traits === 'string' && char.traits.trim()) {
      charTraits = char.traits.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    const rawGroup = (char.group || "none").trim();
    const isStandard = STANDARD_CHARACTER_GROUPS.some(
      (g) => g.value.toLowerCase() === rawGroup.toLowerCase()
    ) || rawGroup.toLowerCase() === "divinities";

    if (rawGroup !== "none" && !isStandard) {
      setCustomGroupInput(rawGroup);
      setIsCustomGroupMode(true);
    } else {
      setIsCustomGroupMode(false);
      setCustomGroupInput("");
    }

    setFormData({
      name: char.name || "",
      role: char.role || "",
      age: char.age || "",
      status: char.status || "ALIVE",
      aliases: char.aliases || [],
      backstory: char.backstory || char.description || char.shortBio || "",
      traits: charTraits,
      imageUrl: char.imageUrl || "",
      mbti: char.mbti || "",
      archetype: char.archetype || "",
      conflict: char.conflict || "",
      goal: char.goal || "",
      trauma: char.trauma || "",
      group: rawGroup.toLowerCase() === "divinities" ? "Divinities" : rawGroup,
      customAttributes: char.customAttributes || [],
    });
    setViewMode("editor");
  };

  const handleSaveEditor = () => {
    if (!formData.name.trim()) return;

    // Flush any pending trait input that user typed without pressing Enter
    const currentTraits = [...formData.traits];
    if (traitInput.trim()) {
      const splitTraits = traitInput.split(',').map(s => s.trim()).filter(Boolean);
      for (const t of splitTraits) {
        if (!currentTraits.includes(t)) {
          currentTraits.push(t);
        }
      }
      setTraitInput("");
      setFormData(prev => ({ ...prev, traits: currentTraits }));
    }

    const backstoryContent = formData.backstory || "";
    const cleanGroup = (formData.group && formData.group.trim()) ? formData.group.trim() : "none";

    const newChar = {
      id: editingCharId || Date.now().toString(),
      name: formData.name.trim() || "New Character",
      role: formData.role || "PROTAGONIST",
      age: formData.age || "",
      status: formData.status || "ALIVE",
      aliases: formData.aliases || [],
      backstory: backstoryContent,
      description: backstoryContent, // Synchronize for all AI prompts, search, and overview widgets
      traits: currentTraits,
      imageUrl: formData.imageUrl || FANTASY_PRESET_PORTRAITS[0]?.url || "https://res.cloudinary.com/mekoxs1q/image/upload/v1790564447/fantasy_01_under_100kb_klikgx.jpg",
      mbti: formData.mbti || "",
      archetype: formData.archetype || "",
      conflict: formData.conflict || "",
      goal: formData.goal || "",
      trauma: formData.trauma || "",
      group: cleanGroup,
      customAttributes: formData.customAttributes || [],
    };

    let updatedCharacters: any[];
    if (editingCharId) {
      updatedCharacters = characters.map((c) => (c.id === editingCharId ? newChar : c));
    } else {
      updatedCharacters = [...characters, newChar];
      setNodes((prev: any) => [...prev, { id: newChar.id, x: 200, y: 200 }]);
    }
    
    setCharacters(updatedCharacters);

    if (id) {
      storage.saveProjectData(id, { characters: updatedCharacters });
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  const handleDeleteCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharacterToDelete(id);
  };

  const confirmDelete = () => {
    if (characterToDelete) {
      const updatedChars = characters.filter((c) => c.id !== characterToDelete);
      setCharacters(updatedChars);
      setNodes((prev) => prev.filter((n) => n.id !== characterToDelete));
      if (id) {
        storage.saveProjectData(id, { characters: updatedChars });
      }
      setCharacterToDelete(null);
    }
  };

  const handleCopyText = (char: any, e: React.MouseEvent) => {
    e.stopPropagation();

    let traitsList = "None recorded";
    if (Array.isArray(char.traits) && char.traits.length > 0) {
      traitsList = char.traits.filter(Boolean).join(', ');
    } else if (typeof char.traits === 'string' && char.traits.trim()) {
      traitsList = char.traits.trim();
    }

    const backstoryText = char.backstory || char.description || char.shortBio || "No backstory recorded.";

    let textContent = `Name: ${char.name || 'Unknown'}
Role: ${char.role || 'Unknown'}
Age: ${char.age || 'Unknown'}
Status: ${char.status || 'Active'}
${char.mbti ? `MBTI: ${char.mbti}\n` : ''}${char.archetype ? `Archetype: ${char.archetype}\n` : ''}Traits: ${traitsList}

Backstory:
${backstoryText}`;

    const extras: string[] = [];
    if (char.goal) extras.push(`Goal: ${char.goal}`);
    if (char.conflict) extras.push(`Conflict: ${char.conflict}`);
    if (char.trauma) extras.push(`Trauma: ${char.trauma}`);
    if (extras.length > 0) {
      textContent += `\n\nPsychology & Drive:\n${extras.join('\n')}`;
    }

    textContent += '\n';

    navigator.clipboard.writeText(textContent).then(() => {
      setCopiedCharId(char.id);
      setTimeout(() => setCopiedCharId(null), 2000);
    }).catch(err => {
      console.error("Clipboard copy failed:", err);
    });
  };

  const handleCopyEditor = () => {
    // Flush any pending trait input
    const currentTraits = [...formData.traits];
    if (traitInput.trim()) {
      const split = traitInput.split(',').map(s => s.trim()).filter(Boolean);
      for (const t of split) {
        if (!currentTraits.includes(t)) currentTraits.push(t);
      }
    }

    const traitsList = currentTraits.length > 0 ? currentTraits.join(', ') : "None recorded";
    const backstoryText = formData.backstory || "No backstory recorded.";

    let textContent = `Name: ${formData.name || 'Unknown'}
Role: ${formData.role || 'Unknown'}
Age: ${formData.age || 'Unknown'}
Status: ${formData.status || 'Active'}
${formData.mbti ? `MBTI: ${formData.mbti}\n` : ''}${formData.archetype ? `Archetype: ${formData.archetype}\n` : ''}Traits: ${traitsList}

Backstory:
${backstoryText}`;

    const extras: string[] = [];
    if (formData.goal) extras.push(`Goal: ${formData.goal}`);
    if (formData.conflict) extras.push(`Conflict: ${formData.conflict}`);
    if (formData.trauma) extras.push(`Trauma: ${formData.trauma}`);
    if (extras.length > 0) {
      textContent += `\n\nPsychology & Drive:\n${extras.join('\n')}`;
    }

    textContent += '\n';

    navigator.clipboard.writeText(textContent).then(() => {
      setCopiedEditor(true);
      setTimeout(() => setCopiedEditor(false), 2000);
    }).catch(err => {
      console.error("Clipboard copy failed:", err);
    });
  };

  const handleDuplicateCharacter = (char: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated = {
      ...char,
      id: Date.now().toString(),
      name: char.name + " (Copy)",
    };
    setCharacters((prev) => [...prev, duplicated]);
    setNodes((prev) => [...prev, { id: duplicated.id, x: 200, y: 200 }]);
  };

  const [graphs, setGraphs] = useState(() => {
    const initialChars = (() => {
      if (id) {
        const data = storage.getProjectData(id);
        if (data?.characters && data.characters.length > 0) return data.characters;
      }
      return CATALOG_CHARACTERS;
    })();
    return buildDefaultProjectGraph(id, initialChars);
  });
  const [activeGraphId, setActiveGraphId] = useState("1");
  const [showNewGraphModal, setShowNewGraphModal] = useState(false);
  const [newGraphName, setNewGraphName] = useState("");

  // Persist graphs to storage whenever graphs changes
  useEffect(() => {
    if (id && graphs.length > 0) {
      storage.saveProjectData(id, { characterGraphs: graphs });
    }
  }, [id, graphs]);

  useEffect(() => {
    if (id && characters) {
      storage.saveProjectData(id, { characters });
    }
  }, [id, characters]);

  const activeGraph = graphs.find(g => g.id === activeGraphId) || graphs[0] || { id: "1", name: "Main Plot", nodes: [], edges: [] };

  const nodes = activeGraph.nodes || [];
  const setNodes = (action: any) => {
    setGraphs(prev => prev.map(g => {
      if (g.id === activeGraphId) {
        const nextNodes = typeof action === 'function' ? action(g.nodes || []) : action;
        return { ...g, nodes: nextNodes };
      }
      return g;
    }));
  };

  const edges = activeGraph.edges || [];
  const setEdges = (action: any) => {
    setGraphs(prev => prev.map(g => {
      if (g.id === activeGraphId) {
        const nextEdges = typeof action === 'function' ? action(g.edges || []) : action;
        return { ...g, edges: nextEdges };
      }
      return g;
    }));
  };
  
  // Drawing Edges State
  const [drawingEdge, setDrawingEdge] = useState<{ source: string, currentX: number, currentY: number } | null>(null);
  const [pendingEdge, setPendingEdge] = useState<{ source: string, target: string, edgeId?: string } | null>(null);

  // Drag, Pan & Zoom State
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panHasDragged, setPanHasDragged] = useState(false);
  
  // Selection State
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startX: number;
    startY: number;
    hasDragged: boolean;
  } | null>(null);

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch(e) {}
    setDraggingNode({ id, startX: e.clientX, startY: e.clientY, hasDragged: false });
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!draggingNode) return;
    e.stopPropagation();
    
    const dxReal = e.clientX - draggingNode.startX;
    const dyReal = e.clientY - draggingNode.startY;
    
    if (!draggingNode.hasDragged && (Math.abs(dxReal) > 3 || Math.abs(dyReal) > 3)) {
      setDraggingNode(prev => prev ? { ...prev, hasDragged: true } : null);
    }
    
    if (draggingNode.hasDragged) {
      const dx = (e.clientX - draggingNode.startX) / scale;
      const dy = (e.clientY - draggingNode.startY) / scale;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === draggingNode.id ? { ...n, x: n.x + dx, y: n.y + dy } : n,
        ),
      );
      setDraggingNode({
        id: draggingNode.id,
        startX: e.clientX,
        startY: e.clientY,
        hasDragged: true
      });
    }
  };

  const handleStartDrawEdge = (e: React.PointerEvent, sourceId: string) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch(e) {}
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      setDrawingEdge({ source: sourceId, currentX: x, currentY: y });
    }
  };

  const handleDrawEdgeMove = (e: React.PointerEvent) => {
    if (!drawingEdge || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / scale;
    const y = (e.clientY - rect.top - pan.y) / scale;
    setDrawingEdge({ ...drawingEdge, currentX: x, currentY: y });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch(e) {}
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setPanHasDragged(false);
    setSelectedCharId(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (drawingEdge) {
      handleDrawEdgeMove(e);
      return;
    }
    if (!isPanning) return;
    
    const dxReal = e.clientX - panStart.x;
    const dyReal = e.clientY - panStart.y;
    if (!panHasDragged && (Math.abs(dxReal) > 3 || Math.abs(dyReal) > 3)) {
      setPanHasDragged(true);
    }

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (drawingEdge) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch(e) {}
      
      const dropX = drawingEdge.currentX;
      const dropY = drawingEdge.currentY;
      
      const targetNode = nodes.find(n => {
        if (n.id === drawingEdge.source) return false;
        // The center of the polaroid is roughly node.x, node.y + 40
        const dist = Math.sqrt(Math.pow(n.x - dropX, 2) + Math.pow((n.y + 40) - dropY, 2));
        return dist < 80;
      });

      if (targetNode) {
        setPendingEdge({ source: drawingEdge.source, target: targetNode.id });
      }
      setDrawingEdge(null);
    }
    
    if (draggingNode) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch(e) {}
      if (!draggingNode.hasDragged) {
         setSelectedCharId(draggingNode.id === selectedCharId ? null : draggingNode.id);
      }
      setDraggingNode(null);
    }
    if (isPanning) {
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch(e) {}
      setIsPanning(false);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s * 1.3, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.3, 0.2));

  const filteredAndSortedCharacters = React.useMemo(() => {
    let result = [...characters];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.role && c.role.toLowerCase().includes(q)) || 
        (c.group && c.group.toLowerCase().includes(q)) || 
        (c.aliases && c.aliases.some((a: string) => a.toLowerCase().includes(q))) ||
        (c.traits && c.traits.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    // Filter by role
    if (filterRole !== "ALL") {
      result = result.filter(c => c.role === filterRole);
    }

    // Filter by status
    if (filterStatus !== "ALL") {
      result = result.filter(c => c.status === filterStatus);
    }

    // Sort
    if (sortBy === "name_asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name_desc") {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "recent") {
      // Assuming ID is timestamp-based or just roughly sort by string
      result.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    }

    return result;
  }, [characters, searchQuery, filterRole, filterStatus, sortBy]);

  if (viewMode === "editor") {
    return (
      <div className="flex-1 flex flex-col w-full h-full bg-[#fcfaf5] overflow-y-auto selection:bg-[#c17a7a]/20 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-track]:bg-transparent relative">
        {/* Success Toast */}
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 bg-[#fcfaf5] text-[#8a5b46] px-6 py-3 rounded-md shadow-lg border border-[#e5e0d5] font-bold text-[10px] tracking-widest uppercase transition-all duration-300 z-50 ${saveSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          Character Saved Successfully
        </div>
        
        {/* Top Nav */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-8 py-4 bg-[#fcfaf5]/90 backdrop-blur-sm border-b border-[#e5e0d5]/50">
          <div className="flex items-center gap-3 text-[#8a5b46]">
            <button
              type="button"
              onClick={() => {
                setPresetModalMode("editor");
                setShowPresetModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#b8785e]/15 hover:bg-[#b8785e]/25 text-[#b8785e] border border-[#b8785e]/40 text-[10px] font-bold tracking-widest uppercase transition-all shadow-2xs"
              title="Load from 50 Premade Character Archetypes"
            >
              <Users className="w-3.5 h-3.5 text-[#b8785e]" />
              <span>50 Premade Archetypes</span>
            </button>
            <span className="text-[10px] font-mono text-stone-400 hidden sm:inline">
              • {editingCharId ? "Editing Dossier" : "New Dossier"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopyEditor}
              title="Copy Info (For ChatGPT)"
              className="w-8 h-8 flex items-center justify-center rounded-sm text-[#8a5b46] hover:bg-[#e5e0d5]/40 hover:text-[#b8785e] transition-colors border border-[#e5e0d5]/50 shadow-sm bg-[#fcfaf5]"
            >
              {copiedEditor ? <Check className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 stroke-[1.5]" />}
            </button>
            <button
              onClick={handleSaveEditor}
              disabled={!formData.name.trim()}
              className={`px-6 py-1.5 text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all ${
                !formData.name.trim() 
                ? "bg-stone-300 cursor-not-allowed opacity-50" 
                : "bg-[#b8785e] hover:bg-[#a66850] hover:shadow-lg"
              }`}
            >
              Save
            </button>
            <div className="w-px h-6 bg-[#e5e0d5] mx-1" />
            <button
              onClick={() => setViewMode(previousViewMode)}
              className="w-8 h-8 flex items-center justify-center rounded-sm text-stone-400 hover:text-[#b8785e] transition-colors"
            >
              <X className="w-6 h-6 stroke-[1.5]" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto px-8 lg:px-16 pt-12 pb-32 gap-16 lg:gap-24">
          
          {/* Left Column (Forms) */}
          <div className="flex-1 max-w-[800px] space-y-12">
            
            {/* Identity Section */}
            <section className="space-y-8">
              <div className="flex items-center gap-2 text-[#a66850] opacity-80 mb-2">
                <h3 className="text-sm font-bold tracking-[0.2em] uppercase">Identity</h3>
                <div className="w-4 h-4 border border-current rounded-full flex items-center justify-center text-[10px] cursor-help">?</div>
              </div>
              
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="New Character"
                className="w-full text-5xl lg:text-7xl font-serif font-bold text-stone-300 focus:text-[#8a5b46] placeholder-stone-200 bg-transparent outline-none transition-colors"
              />

              <div className="flex flex-col sm:flex-row gap-8 lg:gap-16">
                <div className="space-y-2 flex-1">
                  <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">Age</label>
                  <input 
                    type="text" 
                    value={formData.age}
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="e.g. 25" 
                    className="w-full bg-transparent border-b border-stone-200 border-dotted pb-2 text-xs font-bold text-stone-600 uppercase tracking-widest outline-none focus:border-[#8a5b46] transition-colors"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-transparent border-b border-stone-200 border-dotted pb-2 text-xs font-bold text-[#a66850] uppercase tracking-widest outline-none focus:border-[#8a5b46] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select Status</option>
                    <option value="ALIVE">Alive</option>
                    <option value="DECEASED">Deceased</option>
                    <option value="UNKNOWN">Unknown</option>
                    <option value="IN PROGRESS">In Progress</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-8 lg:gap-16">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">Group</label>
                    {isCustomGroupMode && (
                      <span className="text-[9px] font-bold text-[#b8785e] tracking-wider uppercase">Custom Mode</span>
                    )}
                  </div>
                  <select 
                    value={
                      isCustomGroupMode 
                        ? "__custom__" 
                        : (formData.group?.toLowerCase() === "divinities" 
                            ? "Divinities" 
                            : (formData.group || "none"))
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__custom__") {
                        setIsCustomGroupMode(true);
                        setFormData(prev => ({ ...prev, group: customGroupInput.trim() }));
                      } else {
                        setIsCustomGroupMode(false);
                        setFormData(prev => ({ ...prev, group: val }));
                      }
                    }}
                    className="w-full bg-transparent border-b border-stone-200 border-dotted pb-2 text-xs font-bold text-[#8a5b46] uppercase tracking-widest outline-none focus:border-[#8a5b46] transition-colors appearance-none cursor-pointer"
                  >
                    <optgroup label="Standard Groups" className="bg-[#fcfaf5] text-stone-700 font-sans font-medium normal-case">
                      {STANDARD_CHARACTER_GROUPS.map((grp) => (
                        <option key={grp.value} value={grp.value}>
                          {grp.label}
                        </option>
                      ))}
                    </optgroup>

                    {existingCustomGroups.length > 0 && (
                      <optgroup label="Story Groups" className="bg-[#fcfaf5] text-stone-700 font-sans font-medium normal-case">
                        {existingCustomGroups.map((grp) => (
                          <option key={grp} value={grp}>
                            {grp}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="Custom Option" className="bg-[#fcfaf5] text-[#8a5b46] font-sans font-bold normal-case">
                      <option value="__custom__">+ Custom Group (Type your own)...</option>
                    </optgroup>
                  </select>

                  {isCustomGroupMode && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={customGroupInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomGroupInput(val);
                            setFormData(prev => ({ ...prev, group: val }));
                          }}
                          placeholder="Enter custom group (e.g. Shadow Syndicate)..."
                          className="flex-1 bg-white/80 border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-[#8a5b46] focus:bg-white transition-colors"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomGroupMode(false);
                            setCustomGroupInput("");
                            setFormData(prev => ({ ...prev, group: "none" }));
                          }}
                          className="text-[10px] text-stone-500 hover:text-stone-800 px-2 py-1.5 rounded bg-stone-200/70 hover:bg-stone-200 uppercase font-bold tracking-wider transition-colors shrink-0"
                          title="Reset to None"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1 italic">
                        Type a custom faction, clan, or organization. It will create its own folder in Archives.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">Role</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-transparent border-b border-stone-200 border-dotted pb-2 text-xs font-bold text-[#a66850] uppercase tracking-widest outline-none focus:border-[#8a5b46] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="PROTAGONIST">Protagonist</option>
                    <option value="ANTAGONIST">Antagonist</option>
                    <option value="SUPPORTING">Supporting</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 border-b border-stone-200 border-dotted pb-2">
                  <div className="flex items-baseline gap-4">
                    <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase shrink-0">Aliases:</label>
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aliasInput.trim()) {
                          e.preventDefault();
                          if (!formData.aliases.includes(aliasInput.trim())) {
                            setFormData(prev => ({ ...prev, aliases: [...prev.aliases, aliasInput.trim()] }));
                          }
                          setAliasInput("");
                        }
                      }}
                      placeholder="+ ADD NOTE (Press Enter)..."
                      className="flex-1 bg-transparent text-xs font-serif italic text-stone-300 placeholder-stone-200 outline-none focus:text-stone-600"
                    />
                  </div>
                  {formData.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pl-16">
                      {formData.aliases.map((alias, idx) => (
                        <span key={idx} className="bg-stone-200 text-stone-600 text-[9px] font-bold px-2 py-1 rounded-sm uppercase tracking-widest flex items-center gap-1 group">
                          {alias}
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({ ...prev, aliases: prev.aliases.filter((_, i) => i !== idx) }))}
                            className="hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Backstory Section */}
            <section id="backstory" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#a66850] tracking-[0.2em] uppercase">Backstory</h3>
                <span className="text-[10px] text-stone-400 font-serif italic">Included in AI Prompts & Clipboard</span>
              </div>
              <textarea
                value={formData.backstory}
                onChange={(e) => setFormData(prev => ({ ...prev, backstory: e.target.value }))}
                placeholder="Write the character's backstory, origins, life history, and formative experiences..."
                className="w-full h-44 bg-transparent text-sm font-serif leading-relaxed text-[#332218] placeholder-stone-300 outline-none resize-none border-b border-stone-300 border-dotted focus:border-[#8a5b46] transition-colors"
              />
            </section>

            {/* MBTI & Traits Section */}
            <section id="mbti-traits" className="space-y-6 pt-4">
              <h3 className="text-sm font-bold text-[#a66850] tracking-[0.2em] uppercase">MBTI & Traits</h3>
              <div className="flex flex-col sm:flex-row gap-8 lg:gap-16">
                <div className="flex-1 space-y-2 border-b border-stone-200 border-dotted pb-2">
                  <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">MBTI</label>
                  <input 
                    type="text" 
                    value={formData.mbti}
                    onChange={(e) => setFormData(prev => ({ ...prev, mbti: e.target.value }))}
                    placeholder="e.g. INTJ"
                    className="w-full bg-transparent text-sm font-serif text-[#332218] placeholder-stone-300 outline-none focus:text-stone-800" 
                  />
                </div>
                <div className="flex-1 space-y-2 border-b border-stone-200 border-dotted pb-2 flex flex-col justify-end">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-stone-400 tracking-[0.2em] uppercase block">Traits</label>
                    <span className="text-[9px] text-stone-400 italic">Press Enter or comma to add</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      id="trait-input"
                      type="text" 
                      value={traitInput}
                      onChange={(e) => setTraitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ',') && traitInput.trim()) {
                          e.preventDefault();
                          const newTraits = traitInput.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => {
                            const updated = [...prev.traits];
                            for (const nt of newTraits) {
                              if (!updated.includes(nt)) updated.push(nt);
                            }
                            return { ...prev, traits: updated };
                          });
                          setTraitInput("");
                        }
                      }}
                      onBlur={() => {
                        if (traitInput.trim()) {
                          const newTraits = traitInput.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => {
                            const updated = [...prev.traits];
                            for (const nt of newTraits) {
                              if (!updated.includes(nt)) updated.push(nt);
                            }
                            return { ...prev, traits: updated };
                          });
                          setTraitInput("");
                        }
                      }}
                      placeholder="+ Add trait (e.g. Brave, Loyal)..." 
                      className="flex-1 bg-transparent text-sm font-serif text-[#332218] placeholder-stone-300 outline-none focus:text-stone-800" 
                    />
                    {traitInput.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const newTraits = traitInput.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => {
                            const updated = [...prev.traits];
                            for (const nt of newTraits) {
                              if (!updated.includes(nt)) updated.push(nt);
                            }
                            return { ...prev, traits: updated };
                          });
                          setTraitInput("");
                        }}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#8c503c] text-white rounded-xs hover:bg-[#a66850] transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                  {formData.traits.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.traits.map((trait, idx) => (
                        <span key={idx} className="bg-[#ede8dc] text-[#5d3f32] border border-[#e5e0d5] text-[9px] font-bold px-2 py-1 rounded-sm uppercase tracking-widest flex items-center gap-1.5 group">
                          {trait}
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({ ...prev, traits: prev.traits.filter((_, i) => i !== idx) }))}
                            className="hover:text-red-600 opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-12">
            
            {/* Character Image */}
            <ImageDropzoneCard
              type="character"
              aspectRatio="portrait"
              imageUrl={formData.imageUrl}
              onImageChange={(newUrl) => setFormData(prev => ({ ...prev, imageUrl: newUrl }))}
              label="Character Portrait"
            />

            {/* Table of Contents */}
            <div className="space-y-4 hidden lg:block sticky top-24">
              <label className="text-[10px] font-bold text-[#a66850] tracking-[0.2em] uppercase block border-b border-stone-200 pb-2">Table of Contents</label>
              <ul className="space-y-3 pt-2">
                <li><a href="#backstory" onClick={(e) => { e.preventDefault(); document.getElementById('backstory')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-[10px] font-serif italic text-stone-400 hover:text-[#a66850] uppercase tracking-widest transition-colors">— Backstory</a></li>
                <li><a href="#mbti-traits" onClick={(e) => { e.preventDefault(); document.getElementById('mbti-traits')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-[10px] font-serif italic text-stone-400 hover:text-[#a66850] uppercase tracking-widest transition-colors">— MBTI & Traits</a></li>
                <li><a href="#physical-appearance" onClick={(e) => { e.preventDefault(); document.getElementById('physical-appearance')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-[10px] font-serif italic text-stone-400 hover:text-[#a66850] uppercase tracking-widest transition-colors">— Physical Appearance</a></li>
              </ul>
            </div>

            {/* Relationships */}
            <div className="space-y-4 hidden lg:block">
              <label className="text-[10px] font-bold text-[#a66850] tracking-[0.2em] uppercase block border-b border-stone-200 pb-2">Relationships</label>
              <div className="pt-2 space-y-2">
                {edges.filter(e => e.source === editingCharId || e.target === editingCharId).map(edge => {
                  const relatedId = edge.source === editingCharId ? edge.target : edge.source;
                  const relatedChar = characters.find(c => c.id === relatedId);
                  if (!relatedChar) return null;
                  return (
                    <div key={edge.id} className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-sm hover:border-[#d49a89] transition-colors group">
                      <div className="flex items-center gap-3">
                        <img src={relatedChar.imageUrl} alt={relatedChar.name} className="w-8 h-8 rounded-sm object-cover border border-[#e5e0d5]" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[#4a3225] uppercase tracking-wider">{relatedChar.name}</span>
                          <span className="text-[9px] font-bold text-[#a66850] uppercase tracking-widest">{edge.label || "Connected"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {edges.filter(e => e.source === editingCharId || e.target === editingCharId).length === 0 && (
                  <p className="text-[10px] font-serif italic text-stone-500 mb-2">No relationships recorded.</p>
                )}
                <button 
                  onClick={() => setViewMode("connections")}
                  className="w-full py-2.5 bg-[#fcfaf5] border border-stone-200 text-stone-400 text-[9px] font-bold tracking-[0.2em] uppercase hover:bg-white hover:text-[#a66850] hover:border-[#a66850] transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  <Plus className="w-3 h-3" /> Go to Board to link
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 50 Premade Character Archetypes Modal */}
        <CharacterPresetPickerModal
          isOpen={showPresetModal}
          onClose={() => setShowPresetModal(false)}
          onSelectPreset={(preset, directSave) => handleSelectPreset(preset, directSave)}
          title="50 Premade Character Archetypes"
          subtitle="Select any archetype to populate this character dossier with lore, motivations, personality traits, and portraits."
          actionLabel="Load into Dossier"
        />

      </div>
    );
  }

  const traitsOf = (char: any): string[] =>
    Array.isArray(char.traits)
      ? char.traits.filter(Boolean)
      : typeof char.traits === "string" && char.traits.trim()
        ? [char.traits.trim()]
        : [];

  const iconBtn = (active = false) =>
    cn(
      "w-10 h-10 rounded-full flex items-center justify-center border transition-colors cursor-pointer",
      active ? "bg-[#0E1D26] border-[#0E1D26] text-[#F6F1E7]" : "bg-white border-[#E9E2D4] text-[#0E1D26]/55 hover:text-[#0E1D26] hover:border-[#0E1D26]/30"
    );

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative bg-[#F8F5EE] text-[#0E1D26] font-['Outfit']">
      <div className="flex-1 relative flex flex-col overflow-hidden">
        {/* Header */}
        <div className={cn("shrink-0 w-full", viewMode === "registry" ? "max-w-[1400px] mx-auto px-6 lg:px-10 pt-8 lg:pt-10 pb-5" : "px-5 py-3 border-b border-[#E9E2D4] bg-[#F8F5EE]")}>
          {viewMode === "registry" && (
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Cast</p>
                <h1 className="mt-2 text-[34px] lg:text-[40px] font-extrabold leading-none tracking-[-0.02em]">
                  Characters <span className="text-[#0E1D26]/30 font-bold text-[24px] align-middle">{characters.length}</span>
                </h1>
              </div>
              <button
                onClick={handleOpenEditorNew}
                className="h-11 pl-5 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                {isCharacterLimitReached ? "Unlock more characters" : "New Character"}
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  {isCharacterLimitReached ? <IconLock className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
                </span>
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {viewMode === "registry" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64 max-w-full">
                  <IconSearch className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#0E1D26]/35" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search characters"
                    className="w-full h-10 pl-10 pr-4 bg-white border border-[#E9E2D4] rounded-full text-[14px] placeholder:text-[#0E1D26]/35 outline-none focus:border-[#0E1D26]/35 transition-colors"
                  />
                </div>

                <div className="relative">
                  <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={iconBtn(filterRole !== "ALL" || filterStatus !== "ALL")} title="Filter">
                    <IconFilter className="w-4 h-4" />
                  </button>
                  {showFilterMenu && (
                    <div className="absolute top-full mt-2 w-52 bg-white rounded-2xl shadow-[0_16px_40px_-16px_rgba(14,29,38,0.35)] border border-[#E9E2D4] z-50 p-3 space-y-3">
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45 mb-1">Role</span>
                        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full h-9 px-3 rounded-full bg-[#F8F5EE] text-[13px] outline-none cursor-pointer">
                          <option value="ALL">All roles</option>
                          <option value="PROTAGONIST">Protagonist</option>
                          <option value="ANTAGONIST">Antagonist</option>
                          <option value="SUPPORTING">Supporting</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45 mb-1">Status</span>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full h-9 px-3 rounded-full bg-[#F8F5EE] text-[13px] outline-none cursor-pointer">
                          <option value="ALL">All status</option>
                          <option value="ALIVE">Alive</option>
                          <option value="DECEASED">Deceased</option>
                          <option value="UNKNOWN">Unknown</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => setShowSortMenu(!showSortMenu)} className={iconBtn(sortBy !== "name_asc")} title="Sort">
                    <IconSort className="w-4 h-4" />
                  </button>
                  {showSortMenu && (
                    <div className="absolute top-full mt-2 w-36 bg-white rounded-2xl shadow-[0_16px_40px_-16px_rgba(14,29,38,0.35)] border border-[#E9E2D4] z-50 p-1.5">
                      {([
                        ["name_asc", "A to Z"],
                        ["name_desc", "Z to A"],
                        ["recent", "Newest"],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSortBy(key);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-[13px] transition-colors cursor-pointer",
                            sortBy === key ? "bg-[#F8F5EE] font-semibold" : "text-[#0E1D26]/65 hover:bg-[#F8F5EE]"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
                  {([
                    ["grid", IconOverview, "Cards"],
                    ["gallery", IconGallery, "Gallery"],
                    ["folder", IconFolder, "Folders"],
                  ] as const).map(([key, Ico, label]) => (
                    <button
                      key={key}
                      onClick={() => setRegistryView(key)}
                      title={label}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                        registryView === key ? "bg-white text-[#0E1D26] shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/45 hover:text-[#0E1D26]"
                      )}
                    >
                      <Ico className="w-4 h-4" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (!hasImageLibrary) {
                      setUpgradeModalFeature("image_library");
                      setShowUpgradeModal(true);
                    } else {
                      setShowPortraitGalleryModal(true);
                    }
                  }}
                  title={hasImageLibrary ? "Browse the portrait library" : "Portrait Library (Pro feature)"}
                  className="h-10 px-4 rounded-full bg-white border border-[#E9E2D4] hover:border-[#0E1D26]/30 text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <IconImage className="w-4 h-4 text-[#0E1D26]/55" />
                  <span className="hidden sm:inline">Portraits</span>
                  {!hasImageLibrary && <IconLock className="w-3.5 h-3.5 text-[#0E1D26]/40" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {graphs.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGraphId(g.id)}
                    className={cn(
                      "h-9 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer",
                      activeGraphId === g.id ? "bg-white text-[#0E1D26] shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
                    )}
                  >
                    {g.name}
                  </button>
                ))}
                <button
                  onClick={() => setShowNewGraphModal(true)}
                  className="h-9 px-3 rounded-full text-[13px] font-semibold text-[#0E1D26]/45 hover:text-[#0E1D26] flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <IconPlus className="w-4 h-4" /> New graph
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
                {([
                  ["registry", "Registry"],
                  ["connections", "Connections"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setViewMode(key)}
                    className={cn(
                      "h-8 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer",
                      viewMode === key ? "bg-[#0E1D26] text-[#F6F1E7]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPresetModalMode("registry");
                  setShowPresetModal(true);
                }}
                title="Browse 50 premade character archetypes"
                className="h-10 px-4 rounded-full bg-white border border-[#E9E2D4] hover:border-[#0E1D26]/30 text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <IconUsers className="w-4 h-4 text-[#0E1D26]/55" />
                <span className="hidden sm:inline">50 Archetypes</span>
              </button>

              <button type="button" onClick={() => setShowCharacterGuideModal(true)} className={iconBtn()} title="Character guide & AI prompt" aria-label="Character guide & AI prompt">
                <IconHelp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "registry" ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* New character */}
              <button
                onClick={handleOpenEditorNew}
                className={cn(
                  "group rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer",
                  registryView === "gallery" ? "min-h-[300px]" : "min-h-[260px]",
                  isCharacterLimitReached ? "border-[#E8561F]/40 hover:border-[#E8561F]" : "border-[#0E1D26]/15 hover:border-[#0E1D26]/35"
                )}
              >
                <span className="w-12 h-12 rounded-full bg-white border border-[#E9E2D4] flex items-center justify-center text-[#0E1D26]/50 group-hover:text-[#0E1D26] transition-colors">
                  {isCharacterLimitReached ? <IconLock className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}
                </span>
                <span className="mt-3 text-[14px] font-semibold">{isCharacterLimitReached ? "Plan limit reached" : "New character"}</span>
                <span className="mt-1 text-[12px] text-[#0E1D26]/45">
                  {characters.length} / {maxCharacters === Infinity ? "∞" : maxCharacters} characters
                </span>
              </button>

              {registryView === "folder" ? (
                Object.entries(
                  filteredAndSortedCharacters.reduce((acc, char) => {
                    const group = char.group || "none";
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(char);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([groupName, groupChars]: [string, any[]]) => (
                  <div key={groupName} className="rounded-3xl bg-white border border-[#E9E2D4] p-6 min-h-[260px] flex flex-col">
                    <div className="flex items-center gap-2 text-[#0E1D26]/45">
                      <IconFolder className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Folder</span>
                    </div>
                    <h2 className="mt-3 text-[22px] font-extrabold leading-tight truncate">{groupName === "none" ? "Ungrouped" : groupName}</h2>
                    <p className="mt-1 text-[13px] text-[#0E1D26]/55">
                      {groupChars.length} {groupChars.length === 1 ? "character" : "characters"}
                    </p>
                    <div className="mt-auto flex -space-x-2">
                      {groupChars.slice(0, 6).map((c) => (
                        <img key={c.id} src={c.imageUrl} alt={c.name} title={c.name} className="w-9 h-9 rounded-full ring-2 ring-white object-cover" />
                      ))}
                    </div>
                  </div>
                ))
              ) : registryView === "gallery" ? (
                filteredAndSortedCharacters.map((char) => (
                  <button key={char.id} onClick={() => handleOpenEditorEdit(char)} className="group text-left cursor-pointer">
                    <div className="aspect-[3/4] rounded-3xl overflow-hidden bg-[#EFE9DE]">
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </div>
                    <p className="mt-3 px-1 text-[15px] font-bold truncate">{char.name}</p>
                    <p className="px-1 text-[12px] text-[#0E1D26]/50 truncate capitalize">{(char.role || "").toLowerCase()}</p>
                  </button>
                ))
              ) : (
                filteredAndSortedCharacters.map((char) => {
                  const traits = traitsOf(char);
                  return (
                    <div
                      key={char.id}
                      onClick={() => handleOpenEditorEdit(char)}
                      className="group rounded-3xl bg-white border border-[#E9E2D4] hover:border-[#0E1D26]/25 p-5 min-h-[260px] flex flex-col transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickImageChar(char);
                          }}
                          title="Change portrait"
                          className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-[#EFE9DE] cursor-pointer"
                        >
                          <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-bold leading-tight truncate">{char.name}</h3>
                          <p className="mt-1 text-[12px] text-[#0E1D26]/50 truncate">
                            <span className="capitalize">{(char.role || "").toLowerCase()}</span>
                            {char.age ? ` · ${char.age}` : ""}
                          </p>
                          {char.group && char.group !== "none" && (
                            <span className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-[#F1ECE2] text-[11px] text-[#0E1D26]/60">{char.group}</span>
                          )}
                        </div>
                      </div>

                      <p className="mt-4 text-[13px] leading-relaxed text-[#0E1D26]/60 line-clamp-3">
                        {char.backstory || char.description || char.shortBio || "No backstory yet."}
                      </p>

                      <div className="mt-auto pt-4 flex items-end justify-between gap-2">
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {traits.slice(0, 3).map((trait, i) => (
                            <span key={`${char.id}-${trait}-${i}`} className="px-2 py-0.5 rounded-full bg-[#F1ECE2] text-[11px] text-[#0E1D26]/65">
                              {trait}
                            </span>
                          ))}
                          {traits.length > 3 && <span className="px-1 text-[11px] text-[#0E1D26]/40">+{traits.length - 3}</span>}
                        </div>
                        <div className="flex items-center shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => handleCopyText(char, e)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#0E1D26] hover:bg-[#F8F5EE] cursor-pointer" title="Copy info for AI">
                            {copiedCharId === char.id ? <IconTick className="w-4 h-4 text-emerald-600" /> : <IconCopy className="w-4 h-4" />}
                          </button>
                          <button onClick={(e) => handleDuplicateCharacter(char, e)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#0E1D26] hover:bg-[#F8F5EE] cursor-pointer" title="Duplicate">
                            <IconPlus className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => handleDeleteCharacter(char.id, e)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/40 hover:text-[#C2410C] hover:bg-[#C2410C]/[0.06] cursor-pointer" title="Delete">
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Cast sidebar */}
            <div className="w-64 border-r border-[#E9E2D4] bg-[#F8F5EE] flex flex-col z-20">
              <p className="px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45">Cast · drag onto the board</p>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-1">
                {characters.map((char) => {
                  const onBoard = !!nodes.find((n) => n.id === char.id);
                  return (
                    <div
                      key={char.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/char-id", char.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className="group flex items-center gap-3 p-2 rounded-2xl hover:bg-white cursor-grab transition-colors"
                      title={char.name}
                    >
                      <img src={char.imageUrl} alt="" className={cn("w-9 h-9 shrink-0 rounded-full object-cover", !onBoard && "opacity-60")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-tight truncate">{char.name}</p>
                        <p className="text-[11px] text-[#0E1D26]/45 truncate capitalize">{(char.role || "").toLowerCase()}</p>
                      </div>
                      <button
                        className={cn(
                          "w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                          onBoard ? "text-emerald-600" : "text-[#0E1D26]/35 opacity-0 group-hover:opacity-100 hover:text-[#0E1D26] hover:bg-[#F8F5EE]"
                        )}
                        onClick={() => {
                          if (!onBoard) {
                            setNodes((prev) => [...prev, { id: char.id, x: 200 - pan.x / scale, y: 200 - pan.y / scale }]);
                          }
                        }}
                        title={onBoard ? "Already on the board" : "Add to board"}
                      >
                        {onBoard ? <IconTick className="w-3.5 h-3.5" /> : <IconPlus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={handleOpenEditorNew}
                  className="w-full mt-2 h-10 rounded-full border border-dashed border-[#0E1D26]/20 hover:border-[#0E1D26]/40 text-[13px] font-semibold text-[#0E1D26]/55 hover:text-[#0E1D26] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <IconPlus className="w-4 h-4" /> Add character
                </button>
              </div>
            </div>

            {/* Board */}
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#FBF9F5]"
              style={{ backgroundImage: "radial-gradient(rgba(14,29,38,0.09) 1px, transparent 1px)", backgroundSize: `${22 * scale}px ${22 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const charId = e.dataTransfer.getData("application/char-id");
                if (charId && !nodes.find((n) => n.id === charId) && canvasRef.current) {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const dropX = (e.clientX - rect.left - pan.x) / scale;
                  const dropY = (e.clientY - rect.top - pan.y) / scale;
                  setNodes((prev) => [...prev, { id: charId, x: dropX, y: dropY }]);
                }
              }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={(e) => {
                if (drawingEdge) handleCanvasPointerMove(e);
                else if (isPanning) handleCanvasPointerMove(e);
                else if (draggingNode) handleNodePointerMove(e);
              }}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={(e) => {
                if (e.deltaY < 0) handleZoomIn();
                else handleZoomOut();
              }}
            >
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[14px] text-[#0E1D26]/40">Drag characters from the left, then pull a wire between two portraits.</p>
                </div>
              )}

              <div className="absolute inset-0 w-full h-full origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                {/* Wires */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  {edges.map((edge) => {
                    const sourceNode = nodes.find((n) => n.id === edge.source);
                    const targetNode = nodes.find((n) => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    // Safeguard: Ensure both source and target characters exist in the current project
                    const sourceChar = characters.find((c) => c.id === edge.source);
                    const targetChar = characters.find((c) => c.id === edge.target);
                    if (!sourceChar || !targetChar) return null;

                    // Coordinates map to the avatar's center point
                    const sx = sourceNode.x;
                    const sy = sourceNode.y + 20;
                    const tx = targetNode.x;
                    const ty = targetNode.y + 20;

                    const dist = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
                    const sag = dist * 0.12;
                    const cx = (sx + tx) / 2;
                    const cy = (sy + ty) / 2 + sag;
                    const mx = (sx + tx) / 2;
                    const my = (sy + ty) / 2 + sag * 0.5;

                    const EdgeIcon = getEdgeIconComponent(edge);
                    const labelWidth = Math.max(64, (edge.label || "").length * 6.2 + 34);

                    return (
                      <g key={edge.id}>
                        <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`} stroke={edge.color} strokeWidth="2" opacity="0.75" fill="none" strokeLinecap="round" />
                        <g
                          transform={`translate(${mx}, ${my})`}
                          className="pointer-events-auto cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingEdge({ source: edge.source, target: edge.target, edgeId: edge.id });
                          }}
                        >
                          <rect x={-labelWidth / 2} y="-11" width={labelWidth} height="22" rx="11" fill="#FFFFFF" stroke="#E9E2D4" strokeWidth="1" className="group-hover:stroke-[#0E1D26]/40 transition-colors" />
                          <foreignObject x={-labelWidth / 2 + 7} y="-7" width="14" height="14">
                            <div className="w-full h-full flex items-center justify-center">
                              <EdgeIcon className="w-3 h-3" style={{ color: edge.color }} />
                            </div>
                          </foreignObject>
                          <text x={-labelWidth / 2 + 25} y="1" fontSize="10" fontWeight="600" fill="#0E1D26" dominantBaseline="middle" fontFamily="Outfit, sans-serif">
                            {edge.label}
                          </text>
                          <foreignObject x={labelWidth / 2 + 2} y="-10" width="20" height="20" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="w-5 h-5 bg-white border border-[#E9E2D4] rounded-full flex items-center justify-center text-[#C2410C] hover:bg-[#C2410C]/10"
                              title="Cut this relationship"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEdges((prev) => prev.filter((eItem) => eItem.id !== edge.id));
                              }}
                            >
                              <IconScissors className="w-3 h-3" />
                            </button>
                          </foreignObject>
                        </g>
                      </g>
                    );
                  })}

                  {/* Wire being drawn */}
                  {drawingEdge &&
                    (() => {
                      const sourceNode = nodes.find((n) => n.id === drawingEdge.source);
                      if (!sourceNode) return null;
                      const sx = sourceNode.x;
                      const sy = sourceNode.y + 20;
                      const tx = drawingEdge.currentX;
                      const ty = drawingEdge.currentY;
                      const dist = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
                      const sag = dist * 0.12;
                      const cx = (sx + tx) / 2;
                      const cy = (sy + ty) / 2 + sag;
                      return <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`} stroke="#E8561F" strokeWidth="2" fill="none" strokeDasharray="5 5" strokeLinecap="round" />;
                    })()}
                </svg>

                {/* Portrait nodes */}
                {nodes.map((node) => {
                  const char = characters.find((c) => c.id === node.id);
                  if (!char) return null;
                  const nodeTraits = traitsOf(char);
                  const relations = edges.filter((e) => e.source === char.id || e.target === char.id);

                  return (
                    <div
                      key={node.id}
                      className="absolute flex flex-col items-center cursor-grab active:cursor-grabbing hover:z-20 group"
                      style={{ left: node.x, top: node.y, transform: "translate(-50%, -24px)", touchAction: "none" }}
                      onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                      onPointerMove={handleNodePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      <div className="relative" title={char.name}>
                        <img
                          src={char.imageUrl}
                          alt=""
                          className={cn(
                            "w-[88px] h-[88px] rounded-full object-cover bg-white ring-4 shadow-[0_10px_24px_-12px_rgba(14,29,38,0.55)] pointer-events-none transition-shadow",
                            selectedCharId === node.id ? "ring-[#E8561F]" : "ring-white"
                          )}
                        />
                        {/* Wire handle */}
                        <div
                          className="absolute -right-1 bottom-1 w-7 h-7 bg-white border border-[#E9E2D4] rounded-full flex items-center justify-center text-[#0E1D26]/55 opacity-0 group-hover:opacity-100 hover:bg-[#0E1D26] hover:text-white transition cursor-crosshair shadow-sm z-30"
                          onPointerDown={(e) => handleStartDrawEdge(e, node.id)}
                          title="Pull a relationship wire"
                        >
                          <IconLink className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="mt-2 max-w-[140px] px-2.5 py-1 rounded-full bg-white/90 border border-[#E9E2D4] text-center pointer-events-none">
                        <p className="text-[12px] font-bold leading-tight truncate">{char.name}</p>
                      </div>

                      {/* Dossier card */}
                      {selectedCharId === node.id && (
                        <div
                          className="absolute left-[calc(50%+60px)] top-0 w-72 bg-white rounded-3xl shadow-[0_24px_48px_-20px_rgba(14,29,38,0.45)] border border-[#E9E2D4] p-5 cursor-auto z-50 text-left animate-in fade-in zoom-in-95 duration-150"
                          style={{ touchAction: "auto" }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-3">
                            <img src={char.imageUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                            <div className="min-w-0">
                              <h3 className="text-[17px] font-bold leading-tight truncate">{char.name}</h3>
                              <p className="mt-0.5 text-[12px] text-[#0E1D26]/50 truncate">
                                <span className="capitalize">{(char.role || "").toLowerCase()}</span>
                                {char.age ? ` · ${char.age}` : ""}
                              </p>
                            </div>
                          </div>

                          <p className="mt-4 text-[13px] leading-relaxed text-[#0E1D26]/65 line-clamp-4">
                            {char.backstory || char.description || char.shortBio || "No backstory yet."}
                          </p>

                          {nodeTraits.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {nodeTraits.map((trait, i) => (
                                <span key={`${char.id}-dossier-${trait}-${i}`} className="px-2 py-0.5 rounded-full bg-[#F1ECE2] text-[11px] text-[#0E1D26]/65">
                                  {trait}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/40">Relationships</p>
                            <div className="mt-1.5 space-y-1">
                              {relations.map((edge) => {
                                const relatedChar = characters.find((c) => c.id === (edge.source === char.id ? edge.target : edge.source));
                                if (!relatedChar) return null;
                                return (
                                  <p key={edge.id} className="flex items-center gap-2 text-[13px]">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: edge.color }} />
                                    <span className="font-semibold truncate">{relatedChar.name}</span>
                                    <span className="text-[#0E1D26]/45 truncate">{edge.label || "Connected"}</span>
                                  </p>
                                );
                              })}
                              {relations.length === 0 && <p className="text-[13px] text-[#0E1D26]/45">None yet.</p>}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-[#F1ECE2] flex items-center justify-end gap-1">
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#F8F5EE] cursor-pointer" title="Copy info for AI" onClick={(e) => handleCopyText(char, e)}>
                              {copiedCharId === char.id ? <IconTick className="w-4 h-4 text-emerald-600" /> : <IconCopy className="w-4 h-4" />}
                            </button>
                            <button
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#F8F5EE] cursor-pointer"
                              title="Edit profile"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditorEdit(char);
                              }}
                            >
                              <IconEdit className="w-4 h-4" />
                            </button>
                            <button
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#C2410C] hover:bg-[#C2410C]/[0.06] cursor-pointer"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCharacterToDelete(char.id);
                              }}
                            >
                              <IconTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Zoom */}
              <div className="absolute bottom-5 left-5 flex items-center gap-1 p-1 rounded-full bg-white border border-[#E9E2D4] shadow-[0_8px_20px_-12px_rgba(14,29,38,0.4)]">
                <button onClick={handleZoomOut} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F8F5EE] cursor-pointer" title="Zoom out">
                  <IconMinus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-[12px] font-semibold tabular-nums text-[#0E1D26]/55">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F8F5EE] cursor-pointer" title="Zoom in">
                  <IconPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Relationship picker */}
              {pendingEdge && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0E1D26]/30 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="bg-[#F8F5EE] p-6 rounded-[28px] shadow-2xl max-w-sm w-full mx-4">
                    <h3 className="text-[22px] font-extrabold tracking-[-0.02em]">{pendingEdge.edgeId ? "Change relationship" : "New relationship"}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                      {RELATION_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon;
                        return (
                          <button
                            key={opt.label}
                            className="flex items-center gap-2.5 p-2 rounded-2xl bg-white border border-[#E9E2D4] hover:border-[#0E1D26]/30 text-left transition-colors cursor-pointer"
                            onClick={() => {
                              if (pendingEdge.edgeId) {
                                setEdges((prev) => prev.map((e) => (e.id === pendingEdge.edgeId ? { ...e, label: opt.label, color: opt.color } : e)));
                              } else {
                                setEdges((prev) => [
                                  ...prev,
                                  { id: Date.now().toString(), source: pendingEdge.source, target: pendingEdge.target, label: opt.label, color: opt.color },
                                ]);
                              }
                              setPendingEdge(null);
                            }}
                          >
                            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: opt.color + "18", color: opt.color }}>
                              <OptIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[12px] font-semibold truncate capitalize">{opt.label.toLowerCase()}</span>
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      autoFocus
                      placeholder="Or type your own, then press Enter"
                      className="mt-4 w-full h-11 px-4 bg-white border border-[#E9E2D4] rounded-full text-[14px] placeholder:text-[#0E1D26]/35 outline-none focus:border-[#0E1D26]/35"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const val = e.currentTarget.value.trim().toUpperCase();
                          if (pendingEdge.edgeId) {
                            setEdges((prev) => prev.map((edge) => (edge.id === pendingEdge.edgeId ? { ...edge, label: val, color: "#0E1D26" } : edge)));
                          } else {
                            setEdges((prev) => [...prev, { id: Date.now().toString(), source: pendingEdge.source, target: pendingEdge.target, label: val, color: "#0E1D26" }]);
                          }
                          setPendingEdge(null);
                        }
                      }}
                    />

                    <button
                      className="mt-3 w-full h-10 rounded-full text-[13px] font-semibold text-[#0E1D26]/55 hover:text-[#0E1D26] hover:bg-[#EFE9DE] transition-colors cursor-pointer"
                      onClick={() => setPendingEdge(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {characterToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#fcfaf5] border border-[#e5e0d5] rounded-sm shadow-2xl p-6 max-w-sm w-full relative">
            <h2 className="text-xl font-serif font-bold text-[#4a3225] mb-2 uppercase tracking-wide">Confirm Deletion</h2>
            <p className="text-sm text-stone-600 mb-6">
              Are you sure you want to delete this character? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setCharacterToDelete(null)}
                className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-stone-500 hover:text-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold tracking-widest uppercase bg-[#c17a7a] text-white rounded-sm shadow-sm hover:bg-[#a66850] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Graph Modal */}
      {showNewGraphModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#fcfaf5] border border-[#e5e0d5] rounded-sm shadow-2xl p-6 max-w-sm w-full relative">
            <h2 className="text-xl font-serif font-bold text-[#4a3225] mb-2 uppercase tracking-wide">New Graph</h2>
            <p className="text-sm text-stone-600 mb-4">
              Enter a name for the new graph.
            </p>
            <input 
              type="text" 
              value={newGraphName}
              onChange={(e) => setNewGraphName(e.target.value)}
              placeholder="e.g. Royal Family"
              className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm text-stone-800 focus:outline-none focus:border-[#b8785e] mb-6"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowNewGraphModal(false);
                  setNewGraphName("");
                }}
                className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-stone-500 hover:text-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={!newGraphName.trim()}
                onClick={() => {
                  const newGraph = {
                    id: Date.now().toString(),
                    name: newGraphName.trim(),
                    nodes: [],
                    edges: []
                  };
                  setGraphs(prev => [...prev, newGraph]);
                  setActiveGraphId(newGraph.id);
                  setShowNewGraphModal(false);
                  setNewGraphName("");
                }}
                className={`px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-sm shadow-sm transition-colors ${
                  !newGraphName.trim() ? "bg-stone-300 text-white cursor-not-allowed" : "bg-[#c17a7a] text-white hover:bg-[#a66850]"
                }`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Image Picker Modal for Character */}
      <ImagePickerModal
        isOpen={!!quickImageChar}
        onClose={() => setQuickImageChar(null)}
        type="character"
        title={`Change Portrait for ${quickImageChar?.name || "Character"}`}
        currentImage={quickImageChar?.imageUrl || ""}
        onSelectImage={(newUrl) => {
          if (quickImageChar) {
            setCharacters(prev => prev.map(c => c.id === quickImageChar.id ? { ...c, imageUrl: newUrl } : c));
            if (id) {
              const updated = characters.map(c => c.id === quickImageChar.id ? { ...c, imageUrl: newUrl } : c);
              storage.saveProjectData(id, { characters: updated });
            }
          }
        }}
      />

      {/* Portrait Gallery Modal to browse presets and create/assign */}
      <ImagePickerModal
        isOpen={showPortraitGalleryModal}
        onClose={() => setShowPortraitGalleryModal(false)}
        type="character"
        title={`Preset Character Portrait Library (${FANTASY_PRESET_PORTRAITS.length} Portraits)`}
        defaultTab="presets"
        currentImage=""
        onSelectImage={(selectedUrl) => {
          setShowPortraitGalleryModal(false);
          const found = FANTASY_PRESET_PORTRAITS.find(p => p.url === selectedUrl);
          
          setPreviousViewMode(viewMode === "registry" ? "registry" : "connections");
          setEditingCharId(null);
          setAliasInput("");
          setTraitInput("");
          setShowAttributeDropdown(false);
          setFormData({
            name: found ? found.label.split("/")[0].trim() : "New Character",
            role: "PROTAGONIST",
            age: "",
            status: "ALIVE",
            aliases: [],
            backstory: found?.description || "",
            traits: found?.tags?.slice(0, 4) || [],
            imageUrl: selectedUrl,
            mbti: "",
            archetype: found?.category || "",
            conflict: "",
            goal: "",
            trauma: "",
            group: "none",
            customAttributes: [],
          });
          setViewMode("editor");
        }}
      />

      {/* Character & Graph Workflow Guide Modal */}
      {showCharacterGuideModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowCharacterGuideModal(false)}
        >
          <div 
            className="bg-[#fcfaf5] border border-[#e5e0d5] rounded-sm shadow-[8px_24px_64px_rgba(0,0,0,0.5)] max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden text-stone-800 relative my-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e0d5] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46] shrink-0">
                  <HelpCircle className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div>
                  <h2 className="text-base font-serif font-bold text-[#4a3225] uppercase tracking-wide">
                    Character Studio & Relationship Guide
                  </h2>
                  <p className="text-xs font-serif text-stone-500">
                    Step-by-step workflow for character dossiers, relationship webs, and AI ideation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCharacterGuideModal(false)}
                className="w-8 h-8 rounded-sm text-stone-400 hover:text-[#b8785e] hover:bg-[#f4efe6] flex items-center justify-center transition-colors"
                aria-label="Close guide modal"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-700 custom-scrollbar bg-[#fcfaf5]">
              {/* Section 1: Workflow Steps */}
              <div className="space-y-3">
                <h3 className="text-xs font-serif font-bold uppercase tracking-widest text-[#8a5b46] flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  What steps do you take in Character Studio?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">1</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Build Character Dossiers</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Click <strong className="text-[#4a3225] font-semibold">+ New Character</strong> in Registry to record identity, role, aliases, status, age, MBTI, personality traits, physical appearance, and backstory.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">2</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Portrait Studio & Visuals</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Click <strong className="text-[#4a3225] font-semibold">Portrait Library</strong> to browse 25 high-resolution genre presets or upload/drop your own custom concept art and reference portraits.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">3</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Factions & Folder Archives</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Assign characters to standard groups (Divinities, Royal Court, Guilds) or type custom factions. Switch to <strong className="text-[#4a3225] font-semibold">Folder View</strong> to review cast organized by faction.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">4</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Relational Webs & Graphs</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Switch to <strong className="text-[#4a3225] font-semibold">Connections</strong> and click <strong className="text-[#4a3225] font-semibold">+ NEW GRAPH</strong> to map character relationship networks with color-coded bonds (Ally, Enemy, Family, Rival, Mentor, Romance).
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: AI Character Architect Prompt */}
              <div className="space-y-3 pt-4 border-t border-[#e5e0d5]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-serif font-bold uppercase tracking-widest text-[#8a5b46] flex items-center gap-2">
                      <Feather className="w-4 h-4" />
                      Unsure what to write? Copy this AI Character Prompt
                    </h3>
                    <p className="text-xs font-serif text-stone-500 mt-0.5">
                      Send this prompt to ChatGPT, Claude, or Gemini alongside your novel premise to generate a complete character dossier:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCharacterPrompt}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                      isCharacterPromptCopied
                        ? "bg-emerald-700 text-white"
                        : "bg-[#b8785e] hover:bg-[#a66850] text-white"
                    }`}
                  >
                    {isCharacterPromptCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Prompt Copied!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        <span>Copy Prompt to Clipboard</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Prompt Code Block Preview */}
                <div className="relative">
                  <pre className="p-4 rounded-sm bg-white border border-[#e5e0d5] text-xs font-mono leading-relaxed text-stone-700 max-h-56 overflow-y-auto whitespace-pre-wrap select-all selection:bg-[#c17a7a]/20 custom-scrollbar shadow-xs">
{CHARACTER_CREATION_AI_PROMPT}
                  </pre>
                </div>

                <div className="p-3.5 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] text-xs text-[#5c4033] flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#8a5b46] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="font-semibold text-[#4a3225]">Tip:</strong> Once the AI returns your character details, click <em className="font-serif">"+ New Character"</em> in the Registry and paste the generated name, role, traits, and backstory directly into the form.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-[#e5e0d5] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowCharacterGuideModal(false)}
                className="px-5 py-2 rounded-sm bg-[#f4efe6] hover:bg-[#eae3d5] text-[#4a3225] border border-[#e5e0d5] text-xs font-bold uppercase tracking-widest transition-colors shadow-xs"
              >
                Got it, return to Studio
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Character Quota Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeModalFeature}
        currentCount={characters.length}
        maxLimit={maxCharacters}
      />

      {/* 50 Premade Character Archetypes Modal */}
      <CharacterPresetPickerModal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        onSelectPreset={(preset, directSave) => handleSelectPreset(preset, directSave)}
        title="50 Premade Character Archetypes"
        subtitle="Browse all 50 full character sheets. Select any archetype to customize in the editor or inspect complete backstories and traits."
        actionLabel={presetModalMode === "registry" ? "Use Character" : "Load into Dossier"}
      />
    </div>
  );
}

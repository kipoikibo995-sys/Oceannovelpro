import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { storage } from "@/lib/storage";
import { 
  Plus, MoreVertical, Search, X, MapPin, Map as MapIcon, Compass, Mountain, 
  TreePine, Castle, Edit3, Trash2, Home, Building, LayoutGrid, Route, Move, 
  Pen, Link2, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon,
  Users, BookOpen, HelpCircle, Check, ClipboardCopy, Feather, Info, Lock
} from "lucide-react";
import ImageDropzoneCard from "@/components/ImageDropzoneCard";
import { PLAN_LIMITS } from "@/lib/license";
import UpgradeModal from "@/components/UpgradeModal";

export interface LocationNode {
  id: string;
  x: number;
  y: number;
}

export interface LocationEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

// Helper to build project-specific location nodes and edges
export function buildDefaultProjectLocationMap(projectId: string | undefined, locList: any[]) {
  // Clean up old legacy global keys that leaked across books
  try {
    localStorage.removeItem('story_nodes');
    localStorage.removeItem('story_edges');
    localStorage.removeItem('story_unmapped');
    localStorage.removeItem('story_locations');
  } catch (e) {}

  // 1. If stored in project data, validate that nodes and edges match current locations
  if (projectId) {
    const data = storage.getProjectData(projectId);
    if (data?.locationMap?.nodes && data.locationMap.nodes.length > 0) {
      const validNodes = data.locationMap.nodes.filter(n => locList.some(l => l.id === n.id));
      if (validNodes.length > 0) {
        const validEdges = (data.locationMap.edges || []).filter(e =>
          validNodes.some(n => n.id === e.source) && validNodes.some(n => n.id === e.target)
        );
        return {
          nodes: validNodes,
          edges: validEdges,
          unmapped: data.locationMap.unmapped || []
        };
      }
    }
  }

  // 2. Pre-configured relationships for each fantasy book
  if (projectId === "book-golden-oasis") {
    return {
      nodes: [
        { id: "loc-golden-oasis", x: 240, y: 200 },
        { id: "loc-volcano-desert", x: 620, y: 160 },
        { id: "loc-harbor-desert", x: 430, y: 440 },
      ],
      edges: [
        { id: "e1", source: "loc-golden-oasis", target: "loc-volcano-desert", label: "Dune Caravan (4 days)" },
        { id: "e2", source: "loc-golden-oasis", target: "loc-harbor-desert", label: "Dry Riverbed Trail" },
      ],
      unmapped: []
    };
  }

  if (projectId === "book-sunken-crown") {
    return {
      nodes: [
        { id: "loc-volcano", x: 240, y: 200 },
        { id: "loc-oasis", x: 620, y: 160 },
        { id: "loc-peak", x: 430, y: 440 },
      ],
      edges: [
        { id: "e1", source: "loc-volcano", target: "loc-oasis", label: "Trade Caravan (5 days)" },
        { id: "e2", source: "loc-volcano", target: "loc-peak", label: "Dragon Flight Path" },
      ],
      unmapped: []
    };
  }

  if (projectId === "book-astral-spire") {
    return {
      nodes: [
        { id: "loc-astral", x: 440, y: 160 },
        { id: "loc-woods", x: 220, y: 440 },
        { id: "loc-lighthouse-astral", x: 660, y: 440 },
      ],
      edges: [
        { id: "e1", source: "loc-astral", target: "loc-woods", label: "Enchanted Trail" },
        { id: "e2", source: "loc-astral", target: "loc-lighthouse-astral", label: "Celestial Ley Line" },
      ],
      unmapped: []
    };
  }

  if (projectId === "book-frostgate") {
    return {
      nodes: [
        { id: "loc-frostgate", x: 240, y: 200 },
        { id: "loc-harbor-frost", x: 620, y: 160 },
        { id: "loc-woods-frost", x: 430, y: 440 },
      ],
      edges: [
        { id: "e1", source: "loc-frostgate", target: "loc-harbor-frost", label: "Glacial Sled Route" },
        { id: "e2", source: "loc-frostgate", target: "loc-woods-frost", label: "Snowshoe Pass" },
      ],
      unmapped: []
    };
  }

  if (projectId === "book-silent-harbor" || (!projectId && locList.some(l => l.id === "1"))) {
    return {
      nodes: [
        { id: "1", x: 240, y: 200 },
        { id: "2", x: 620, y: 160 },
        { id: "3", x: 430, y: 440 },
      ],
      edges: [
        { id: "e1", source: "1", target: "2", label: "2 days by boat" },
        { id: "e2", source: "1", target: "3", label: "Mountain pass" },
      ],
      unmapped: []
    };
  }

  // 3. Dynamic layout fallback for custom books / locations
  if (locList && locList.length > 0) {
    const layoutPositions = [
      { x: 240, y: 200 },
      { x: 620, y: 160 },
      { x: 430, y: 440 },
      { x: 740, y: 440 },
      { x: 180, y: 440 },
    ];
    const dynNodes = locList.map((l, i) => {
      const pos = layoutPositions[i % layoutPositions.length];
      return { id: l.id, x: pos.x, y: pos.y };
    });
    const dynEdges: LocationEdge[] = [];
    if (locList.length >= 2) {
      dynEdges.push({ id: "e1", source: locList[0].id, target: locList[1].id, label: "Direct Route" });
    }
    if (locList.length >= 3) {
      dynEdges.push({ id: "e2", source: locList[0].id, target: locList[2].id, label: "Mountain Pass" });
    }
    return { nodes: dynNodes, edges: dynEdges, unmapped: [] };
  }

  return { nodes: [], edges: [], unmapped: [] };
}

export const LOCATION_CREATION_AI_PROMPT = `I want you to help me create a new location for my novel project.

First, ask me to provide:

1. NOVEL / STORY CONTEXT
A short description of my novel, premise, genre, or current story world.

2. LOCATION IDEA
What kind of location I want to create.
This can be very simple, such as:
- capital city
- ancient forest
- hidden temple
- abandoned library
- mountain fortress
- magical tower
- small village

3. LOCATION NAME
Optional. If I already have a name, preserve it exactly.
If I do not provide one, create a suitable name.

After I provide this information, generate ONLY the following information for my Ocean Novel New Location form:

1. Location Name
Create a suitable and memorable location name only if I did not provide one.

2. Type
Choose a concise location type, such as:
- City
- Village
- Kingdom
- Forest
- Castle
- Fortress
- Temple
- Library
- Landmark
- Ruins
- Mountain
- Island
- Underground Location
- Magical Realm

Use the most appropriate type for the location.

3. Short Description
Write a concise 25–60 word description explaining what the location is and why it matters to the story.

4. Atmosphere / Mood
Provide 3–5 concise words describing the location's atmosphere.
Examples:
Mysterious, ancient, dangerous
Cold, isolated, imposing
Warm, peaceful, rustic

5. Region / Parent
State the larger region, kingdom, city, forest, territory, or parent location this place belongs to.
If no parent location is established, create a simple suitable region that fits the story.
If none is needed, write:
None

IMPORTANT RULES:
- Keep the location consistent with the novel context I provide.
- Preserve any location facts or names I already provide.
- Do not create characters, chapters, scenes, dialogue, plot outlines, or unrelated worldbuilding.
- Do not add excessive lore.
- Keep every field concise and easy to copy into a form.

After I provide the information, return ONLY this format:

Location Name:
...

Type:
...

Short Description:
...

Atmosphere / Mood:
...

Region / Parent:
...`;

// Paper grain for the atlas desk and map
const ATLAS_GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")';

export default function Locations() {
  const { id } = useParams<{ id: string }>();

  const getAssociatedScenes = (locId: string) => {
    if (!id || !locId) return [];
    const scenes: { title: string; content: string }[] = [];
    const data = storage.getProjectData(id);
    const manuscript = data?.manuscript || [];
    const loc = locations.find(l => l.id === locId);
    const locName = loc?.name?.toLowerCase();
    
    const searchItems = (items: any[]) => {
      for (const item of items) {
        if (item.type === 'scene' && item.content) {
          const contentLower = item.content.toLowerCase();
          if (
            item.content.includes(`data-id="${locId}"`) || 
            (locName && contentLower.includes(locName))
          ) {
            scenes.push(item);
          }
        }
        if (item.children) {
          searchItems(item.children);
        }
      }
    };
    
    searchItems(manuscript);
    return scenes;
  };

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const projectCharacters = React.useMemo(() => {
    if (!id) return [];
    const data = storage.getProjectData(id);
    return data?.characters || [];
  }, [id]);

  // Initialize project-specific locations and map state
  const initialBundle = React.useMemo(() => {
    let locs: any[] = [];
    if (id) {
      const data = storage.getProjectData(id);
      if (data?.locations && data.locations.length > 0) {
        locs = data.locations.map(loc => ({
          ...loc,
          atmosphere: (loc as any).atmosphere || "Mysterious",
          region: (loc as any).region || "Ancient Realm"
        }));
      }
    }
    if (locs.length === 0) {
      locs = [];
    }
    const map = buildDefaultProjectLocationMap(id, locs);
    return { locs, map };
  }, [id]);

  const [locations, setLocations] = useState(initialBundle.locs);
  const [nodes, setNodes] = useState<LocationNode[]>(initialBundle.map.nodes);
  const [edges, setEdges] = useState<LocationEdge[]>(initialBundle.map.edges);
  const [unmappedLocations, setUnmappedLocations] = useState<any[]>(initialBundle.map.unmapped);

  const availableRegions = React.useMemo(() => {
    const set = new Set<string>();
    locations.forEach(loc => {
      if ((loc as any).region) set.add((loc as any).region);
    });
    return Array.from(set);
  }, [locations]);

  const [atlasQuery, setAtlasQuery] = useState("");

  const displayLocations = React.useMemo(() => {
    const q = atlasQuery.trim().toLowerCase();
    return locations.filter((l: any) => {
      if (selectedRegion && l.region !== selectedRegion) return false;
      if (!q) return true;
      return [l.name, l.type, l.region, l.description].some((v) => typeof v === "string" && v.toLowerCase().includes(q));
    });
  }, [locations, selectedRegion, atlasQuery]);

  // Synchronize when active project ID changes
  React.useEffect(() => {
    if (id) {
      const data = storage.getProjectData(id);
      const locs = (data?.locations && data.locations.length > 0)
        ? data.locations.map(loc => ({
            ...loc,
            atmosphere: (loc as any).atmosphere || "Mysterious",
            region: (loc as any).region || "Ancient Realm"
          }))
        : [];
      setLocations(locs);

      const map = buildDefaultProjectLocationMap(id, locs);
      setNodes(map.nodes);
      setEdges(map.edges);
      setUnmappedLocations(map.unmapped || []);
    }
  }, [id]);

  // Persist location map changes to project storage
  React.useEffect(() => {
    if (id) {
      storage.saveProjectData(id, {
        locations,
        locationMap: {
          nodes,
          edges,
          unmapped: unmappedLocations
        }
      });
    }
  }, [id, locations, nodes, edges, unmappedLocations]);

  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [drawingEdge, setDrawingEdge] = useState<{source: string, currentX: number, currentY: number} | null>(null);
  const [newEdgePopup, setNewEdgePopup] = useState<{source: string, target: string, label: string} | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  
  const [mapMode, setMapMode] = useState<"pan" | "draw">("pan");
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [edgeToDelete, setEdgeToDelete] = useState<string | null>(null);

  const [showLocationGuideModal, setShowLocationGuideModal] = useState(false);
  const [isLocationPromptCopied, setIsLocationPromptCopied] = useState(false);

  const handleCopyLocationPrompt = async () => {
    try {
      await navigator.clipboard.writeText(LOCATION_CREATION_AI_PROMPT);
      setIsLocationPromptCopied(true);
      setTimeout(() => setIsLocationPromptCopied(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = LOCATION_CREATION_AI_PROMPT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setIsLocationPromptCopied(true);
      setTimeout(() => setIsLocationPromptCopied(false), 2500);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Zoom logic
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    
    setScale(prev => {
      const newScale = Math.min(Math.max(0.2, prev + delta), 3);
      return newScale;
    });
  };


  // Helper to draw bezier curve between two points
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    // Control point distance based on how far apart they are
    const offset = Math.max(dx * 0.4, dy * 0.4, 50); 
    
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
  };

  const handleMapLocation = (unmapped: any) => {
    const newId = Date.now().toString();
    const newLoc = {
      id: newId,
      name: unmapped.name,
      type: unmapped.type,
      description: "Needs description...",
      atmosphere: "Unknown",
      region: "Unmapped Lands",
      imageUrl: unmapped.imageUrl
    };
    
    // Add to locations
    setLocations(prev => [...prev, newLoc]);
    
    // Calculate center of current map view
    let centerX = 400;
    let centerY = 300;
    if(canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        centerX = (rect.width / 2 - pan.x) / scale;
        centerY = (rect.height / 2 - pan.y) / scale;
    }
    
    // Add to nodes
    setNodes(prev => [...prev, { id: newId, x: centerX, y: centerY }]);
    
    // Remove from unmapped
    setUnmappedLocations(prev => prev.filter(l => l.id !== unmapped.id));
    
    // Switch to map view to show it
    setViewMode("map");
  };


  const handleStartDrawEdge = (e: React.PointerEvent, sourceId: string) => {
    e.stopPropagation();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch(err) {}
    
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      setDrawingEdge({ source: sourceId, currentX: x, currentY: y });
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch(err) {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    } else if (draggingNode) {
      setNodes(prev => prev.map(n => 
        n.id === draggingNode 
          ? { ...n, x: n.x + e.movementX / scale, y: n.y + e.movementY / scale }
          : n
      ));
    } else if (drawingEdge && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      setDrawingEdge(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    if(drawingEdge) {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetNodeEl = elements.find(el => el.getAttribute('data-node-id'));
      if (targetNodeEl) {
        const targetId = targetNodeEl.getAttribute('data-node-id');
        if (targetId && targetId !== drawingEdge.source) {
          setNewEdgePopup({ source: drawingEdge.source, target: targetId, label: "" });
        }
      }
    }
    setDraggingNode(null);
    setDrawingEdge(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
  };

  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // License quota check
  const profile = storage.getUserProfile();
  const maxLocations = PLAN_LIMITS[profile?.plan || 'free'].maxLocationsPerProject;
  const isLocationLimitReached = locations.length >= maxLocations;

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    atmosphere: "",
    region: "",
    imageUrl: "",
  });

  const handleOpenCreate = () => {
    if (isLocationLimitReached) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingLocId(null);
    setFormData({ name: "", type: "", description: "", atmosphere: "", region: "", imageUrl: "" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (loc: any) => {
    setEditingLocId(loc.id);
    setFormData({
      name: loc.name || "",
      type: loc.type || "",
      description: loc.description || "",
      atmosphere: loc.atmosphere || "",
      region: loc.region || "",
      imageUrl: (loc as any).imageUrl || "",
    });
    setIsModalOpen(true);
  };

  const [locToDelete, setLocToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setLocToDelete(id);
  };

  const confirmDelete = () => {
    if (locToDelete) {
      setLocations(prev => prev.filter(l => l.id !== locToDelete));
      setNodes(prev => prev.filter(n => n.id !== locToDelete));
      setEdges(prev => prev.filter(e => e.source !== locToDelete && e.target !== locToDelete));
      setLocToDelete(null);
    }
  };

  const getTypeIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes('town') || t.includes('city') || t.includes('village')) return <Building className="w-3.5 h-3.5" />;
    if (t.includes('house') || t.includes('home') || t.includes('tavern') || t.includes('inn')) return <Home className="w-3.5 h-3.5" />;
    if (t.includes('forest') || t.includes('woods')) return <TreePine className="w-3.5 h-3.5" />;
    if (t.includes('mountain') || t.includes('peak')) return <Mountain className="w-3.5 h-3.5" />;
    if (t.includes('castle') || t.includes('keep') || t.includes('fort')) return <Castle className="w-3.5 h-3.5" />;
    return <MapPin className="w-3.5 h-3.5" />;
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingLocId) {
      setLocations(prev => prev.map(loc => 
        loc.id === editingLocId ? { ...loc, ...formData } : loc
      ));
    } else {
      const newLoc = {
        id: Date.now().toString(),
        ...formData
      };
      setLocations(prev => [newLoc, ...prev]);
      setNodes(prev => [...prev, { id: newLoc.id, x: 200, y: 200 }]);
    }
    setIsModalOpen(false);
  };

  const tiltOf = (seed: string, range = 2) => ((String(seed).split("").reduce((s, c) => s + c.charCodeAt(0), 0) % (range * 2 + 1)) - range) * 0.5;
  const REGION_INK = ["#E8561F", "#0E1D26", "#C8912B", "#5B7A5A", "#8A4F7D", "#3D6A8A"];
  const regionInk = (region?: string) => (region ? REGION_INK[availableRegions.indexOf(region) % REGION_INK.length] || "#0E1D26" : "#0E1D26");
  const pillBtn = (active: boolean) =>
    `h-8 px-4 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
      active ? "bg-[#0E1D26] text-[#F6F1E7]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
    }`;

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative text-[#0E1D26] font-['Outfit']" style={{ backgroundColor: "#ECE5D8" }}>
      <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-30" style={{ backgroundImage: ATLAS_GRAIN }} />

      {/* Header */}
      <div className="relative z-10 px-6 lg:px-8 pt-6 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4 shrink-0 border-b border-[#0E1D26]/10">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Cartography</p>
          <div className="mt-2 flex items-center gap-2.5">
            <h1 className="text-[34px] lg:text-[40px] font-extrabold leading-none tracking-[-0.02em]">World Atlas</h1>
            <button
              type="button"
              onClick={() => setShowLocationGuideModal(true)}
              className="w-9 h-9 rounded-full bg-[#FDFBF6] text-[#0E1D26]/55 hover:text-[#0E1D26] flex items-center justify-center shadow-sm cursor-pointer"
              title="Atlas guide & AI prompt"
              aria-label="Atlas guide & AI prompt"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0E1D26]/35" />
            <input
              type="text"
              value={atlasQuery}
              onChange={(e) => setAtlasQuery(e.target.value)}
              placeholder="Search places"
              className="w-full h-10 pl-10 pr-4 bg-[#FDFBF6] border border-[#DDD3C2] rounded-full text-[14px] placeholder:text-[#0E1D26]/35 outline-none focus:border-[#0E1D26]/35"
            />
          </div>

          <div className="flex items-center gap-0.5 p-1 rounded-full bg-[#FDFBF6]/70">
            <button onClick={() => setViewMode("grid")} className={pillBtn(viewMode === "grid")}>
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setViewMode("map")} className={pillBtn(viewMode === "map")}>
              <Route className="w-3.5 h-3.5" /> Map
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            Add Location
            <span className="h-7 px-2 rounded-full bg-white/20 flex items-center gap-1 text-[11px]">
              {isLocationLimitReached ? <Lock className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {locations.length}/{maxLocations === Infinity ? "∞" : maxLocations}
            </span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex overflow-hidden">
        {/* Region index */}
        <div className="w-60 shrink-0 hidden md:flex flex-col border-r border-[#0E1D26]/10 bg-[#F3EEE4]/80">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E1D26]/40">Regions</p>
            <button
              onClick={() => setSelectedRegion(null)}
              className={`w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between transition-colors cursor-pointer ${
                selectedRegion === null ? "bg-[#FDFBF6] font-semibold shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#FDFBF6]/60"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Compass className="w-4 h-4" /> All regions
              </span>
              <span className="text-[12px] text-[#0E1D26]/40">{locations.length}</span>
            </button>

            {availableRegions.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region === selectedRegion ? null : region)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[14px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedRegion === region ? "bg-[#FDFBF6] font-semibold shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#FDFBF6]/60"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: regionInk(region) }} />
                  <span className="truncate">{region}</span>
                </span>
                <span className="text-[12px] text-[#0E1D26]/40 shrink-0">{locations.filter((l) => (l as any).region === region).length}</span>
              </button>
            ))}

            {availableRegions.length === 0 && <p className="px-3 py-2 text-[13px] text-[#0E1D26]/45">No regions yet.</p>}

            {/* Unmapped lands — a sticky note */}
            <div className="relative mt-6 mx-1 bg-[#F7E3A6] p-4 -rotate-1 shadow-[0_10px_18px_-12px_rgba(14,29,38,0.55)]">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-white/60 rotate-2" />
              <p className="font-['Caveat'] text-[22px] font-bold leading-none">Unmapped lands</p>
              {unmappedLocations.length === 0 ? (
                <p className="mt-2 text-[12px] text-[#0E1D26]/60">Every place is on the map.</p>
              ) : (
                <div className="mt-2 space-y-0.5">
                  {unmappedLocations.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleMapLocation(u)}
                      className="group w-full text-left py-1 text-[13px] flex items-center justify-between gap-2 cursor-pointer"
                      title="Pin to the map"
                    >
                      <span className="truncate">{u.name}</span>
                      <span className="text-[11px] font-semibold text-[#E8561F] opacity-0 group-hover:opacity-100">+ map</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-7 gap-y-9">
              {/* New location — blank postcard */}
              <button
                onClick={handleOpenCreate}
                className="group relative min-h-[320px] rounded-[3px] border-2 border-dashed border-[#0E1D26]/20 hover:border-[#0E1D26]/40 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
              >
                <span className="w-12 h-12 rounded-full border-2 border-dashed border-[#0E1D26]/25 flex items-center justify-center text-[#0E1D26]/50 group-hover:text-[#0E1D26]">
                  {isLocationLimitReached ? <Lock className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </span>
                <span className="mt-3 font-['Caveat'] text-[26px] font-bold leading-none">Chart a new place</span>
                <span className="mt-2 text-[12px] text-[#0E1D26]/50">
                  {locations.length} / {maxLocations === Infinity ? "∞" : maxLocations} locations
                </span>
              </button>

              {displayLocations.length === 0 && (
                <p className="self-center text-[14px] text-[#0E1D26]/50">No places match{atlasQuery ? ` “${atlasQuery}”` : ""}.</p>
              )}

              {displayLocations.map((loc: any, idx) => (
                <div
                  key={`loc-card-${loc.id || idx}`}
                  onClick={() => handleOpenEdit(loc)}
                  style={{ transform: `rotate(${tiltOf(loc.id || loc.name)}deg)` }}
                  className="group relative bg-[#FDFBF6] p-3 rounded-[3px] shadow-[0_16px_26px_-18px_rgba(14,29,38,0.6),0_1px_2px_rgba(14,29,38,0.15)] transition-transform duration-300 hover:!rotate-0 hover:-translate-y-1 cursor-pointer flex flex-col"
                >
                  {/* tape */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 bg-white/60 shadow-[0_1px_2px_rgba(14,29,38,0.12)] rotate-[-3deg] z-10" />

                  {loc.imageUrl ? (
                    <div className="relative h-44 w-full overflow-hidden bg-[#EFE9DE]">
                      <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                      {/* photo corner mounts */}
                      {["top-0 left-0", "top-0 right-0 rotate-90", "bottom-0 right-0 rotate-180", "bottom-0 left-0 -rotate-90"].map((pos) => (
                        <span key={pos} className={`absolute ${pos} w-4 h-4 bg-[#0E1D26]/70`} style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="h-28 w-full flex items-center justify-center bg-[#F1ECE2] text-[#0E1D26]/35"
                      style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(14,29,38,0.04) 0 8px, transparent 8px 16px)" }}
                    >
                      {getTypeIcon(loc.type)}
                    </div>
                  )}

                  <div className="relative px-2 pt-4 pb-2 flex-1 flex flex-col">
                    {/* region stamp */}
                    <div
                      className="absolute -top-7 right-3 w-[70px] h-[70px] rounded-full border-2 border-dashed flex items-center justify-center text-center rotate-12 bg-[#FDFBF6]/85"
                      style={{ borderColor: regionInk(loc.region), color: regionInk(loc.region) }}
                    >
                      <span className="px-1.5 text-[8.5px] font-bold uppercase tracking-[0.08em] leading-tight line-clamp-3">{loc.region || "Unassigned"}</span>
                    </div>

                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0E1D26]/45 pr-20">
                      {getTypeIcon(loc.type)}
                      <span className="truncate">{loc.type || "Unknown type"}</span>
                    </p>
                    <h3 className="mt-1.5 text-[21px] font-extrabold leading-tight tracking-[-0.01em] pr-16" title={loc.name}>
                      {loc.name}
                    </h3>
                    <p
                      className="mt-3 text-[13px] leading-[22px] text-[#0E1D26]/70 line-clamp-4"
                      style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 21px, rgba(14,29,38,0.08) 21px 22px)" }}
                    >
                      {loc.description || "No description yet."}
                    </p>

                    <div className="mt-auto pt-3 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(loc);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#F1ECE2] cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(loc.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#C2410C] hover:bg-[#C2410C]/[0.06] cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: "#E7DAC0",
                backgroundImage: "linear-gradient(rgba(110,80,40,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(110,80,40,0.10) 1px, transparent 1px)",
                backgroundSize: `${80 * scale}px ${80 * scale}px`,
                backgroundPosition: `${pan.x}px ${pan.y}px`,
              }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={(e) => {
                const zoomFactor = 0.1;
                if (e.deltaY < 0) {
                  setScale((s) => Math.min(s + zoomFactor, 2));
                } else {
                  setScale((s) => Math.max(s - zoomFactor, 0.3));
                }
              }}
            >
              {/* Aged-paper grain, vignette and compass rose */}
              <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-50" style={{ backgroundImage: ATLAS_GRAIN }} />
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 140px rgba(110,70,25,0.35)" }} />
              <svg className="absolute left-6 bottom-6 w-28 h-28 pointer-events-none text-[#6E4E2A] opacity-50" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" />
                <path d="M50 8 L56 50 L50 92 L44 50 Z" fill="currentColor" opacity="0.8" />
                <path d="M8 50 L50 44 L92 50 L50 56 Z" fill="currentColor" opacity="0.45" />
                <text x="50" y="6" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">N</text>
              </svg>

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-[#F7E3A6] px-6 py-5 -rotate-2 shadow-[0_14px_24px_-16px_rgba(14,29,38,0.6)] max-w-[280px] text-center">
                    <p className="font-['Caveat'] text-[24px] font-bold leading-snug">Pin places from “Unmapped lands”, then draw roads between them.</p>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  {edges.map((edge) => {
                    const sourceLoc = locations.find((l) => l.id === edge.source);
                    const targetLoc = locations.find((l) => l.id === edge.target);
                    // SAFEGUARD: Both locations must exist in the active project to prevent orphan/ghost connection lines
                    if (!sourceLoc || !targetLoc) return null;

                    const sourceNode = nodes.find((n) => n.id === edge.source);
                    const targetNode = nodes.find((n) => n.id === edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const sHasImg = !!sourceLoc.imageUrl;
                    const tHasImg = !!targetLoc.imageUrl;
                    const x1 = sourceNode.x + 90;
                    const y1 = sourceNode.y + (sHasImg ? 70 : 40);
                    const x2 = targetNode.x + 90;
                    const y2 = targetNode.y + (tHasImg ? 70 : 40);

                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const pillWidth = Math.max(edge.label.length * 6.5 + 24, 70);

                    return (
                      <g key={edge.id} className="pointer-events-auto group/edge cursor-pointer" onClick={() => setEdgeToDelete(edge.id)}>
                        {/* ink road */}
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6E4E2A" strokeWidth="2.2" strokeDasharray="8 6" strokeLinecap="round" opacity="0.8" className="group-hover/edge:stroke-[#E8561F] transition-colors" />
                        <rect x={midX - pillWidth / 2 + 1.5} y={midY - 10} width={pillWidth} height="22" fill="rgba(110,70,25,0.2)" />
                        <rect x={midX - pillWidth / 2} y={midY - 11.5} width={pillWidth} height="22" fill="#FDFBF6" stroke="#D8C8A8" className="group-hover/edge:stroke-[#E8561F] transition-colors" />
                        <text x={midX} y={midY + 3} fontSize="9.5" fill="#0E1D26" fontWeight="700" textAnchor="middle" letterSpacing="0.06em" fontFamily="Outfit, sans-serif" className="select-none pointer-events-none">
                          {edge.label.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}

                  {drawingEdge &&
                    (() => {
                      const sourceNode = nodes.find((n) => n.id === drawingEdge.source);
                      if (!sourceNode) return null;
                      const sourceHasImg = !!locations.find((l) => l.id === sourceNode.id)?.imageUrl;
                      return (
                        <line
                          x1={sourceNode.x + 90}
                          y1={sourceNode.y + (sourceHasImg ? 70 : 30)}
                          x2={drawingEdge.currentX}
                          y2={drawingEdge.currentY}
                          stroke="#E8561F"
                          strokeWidth="2.5"
                          strokeDasharray="8 6"
                          strokeLinecap="round"
                        />
                      );
                    })()}
                </svg>

                {nodes.map((node) => {
                  const loc = locations.find((l) => l.id === node.id);
                  if (!loc) return null;
                  const ink = regionInk((loc as any).region);

                  return (
                    <div
                      key={node.id}
                      data-node-id={node.id}
                      className="group absolute select-none w-[180px] cursor-pointer overflow-visible"
                      style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggingNode(node.id);
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch (err) {}
                      }}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        setDraggingNode(null);
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch (err) {}
                      }}
                      onDoubleClick={() => handleOpenEdit(loc)}
                      title="Drag to move · double-click to edit"
                    >
                      <div
                        className="relative bg-[#FDFBF6] p-1.5 shadow-[0_14px_22px_-12px_rgba(60,40,15,0.65),0_1px_2px_rgba(60,40,15,0.2)] group-hover:shadow-[0_18px_28px_-12px_rgba(60,40,15,0.7)] transition-shadow"
                        style={{ transform: `rotate(${tiltOf(node.id, 2)}deg)` }}
                      >
                        {/* push pin in the region's ink */}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 w-3.5 h-3.5 rounded-full shadow-[1px_2px_3px_rgba(0,0,0,0.35)]" style={{ background: ink }} />
                        {(loc as any).imageUrl && (
                          <div className="h-24 w-full overflow-hidden bg-[#EFE9DE]">
                            <img src={(loc as any).imageUrl} alt={loc.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                          </div>
                        )}
                        <div className="px-2 py-2 text-center pointer-events-none">
                          <div className="flex justify-center text-[#0E1D26]/45">{getTypeIcon(loc.type)}</div>
                          <h4 className="mt-0.5 font-['Caveat'] text-[20px] font-bold leading-none">{loc.name}</h4>
                        </div>
                      </div>
                      {/* road handle */}
                      <div
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-white border border-[#D8C8A8] rounded-full flex items-center justify-center text-[#0E1D26]/55 opacity-0 group-hover:opacity-100 transition cursor-crosshair hover:bg-[#0E1D26] hover:text-white shadow-sm z-30"
                        onPointerDown={(e) => handleStartDrawEdge(e, node.id)}
                        title="Draw a road to another place"
                      >
                        <Link2 className="w-3.5 h-3.5 pointer-events-none" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Zoom */}
              <div className="absolute bottom-5 right-5 flex items-center gap-1 p-1 rounded-full bg-[#FDFBF6] shadow-[0_8px_20px_-12px_rgba(14,29,38,0.5)]">
                <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.2))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F1ECE2] cursor-pointer" title="Zoom out">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setScale(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="h-8 px-2 rounded-full text-[12px] font-semibold tabular-nums text-[#0E1D26]/60 hover:bg-[#F1ECE2] cursor-pointer"
                  title="Reset view"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F1ECE2] cursor-pointer" title="Zoom in">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="bg-[#fcfaf5] rounded-sm shadow-[8px_16px_48px_rgba(0,0,0,0.5)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[#e5e0d5] relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-[#e5e0d5] bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46]">
                  <MapIcon className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#4a3225]">
                    {editingLocId ? "Edit Location" : "Cartographer's Log"}
                  </h2>
                  <p className="text-[10px] font-bold text-[#a66850] tracking-widest uppercase mt-0.5">
                    {editingLocId ? "Update existing records" : "Record a New Location"}
                  </p>
                </div>
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-sm text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[#fcfaf5]">
              
              {/* Layout for 2 columns: Form (Left) & Cross-Linking (Right) */}
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <h3 className="text-sm font-bold text-[#4a3225] border-b border-[#e5e0d5] pb-2">General Information</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Location Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. The Old Lighthouse" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-bold text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Type (City, Landmark...)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Landmark" 
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-bold text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Short Description</label>
                    <textarea 
                      className="w-full h-24 bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-serif italic text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner resize-none" 
                      placeholder="Describe the setting and its significance..."
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Atmosphere / Mood</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Cold, damp, imposing" 
                        value={formData.atmosphere}
                        onChange={(e) => setFormData({...formData, atmosphere: e.target.value})}
                        className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-bold text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Region / Parent</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Whispering Woods" 
                        value={formData.region}
                        onChange={(e) => setFormData({...formData, region: e.target.value})}
                        className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-bold text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-[320px] shrink-0 space-y-6">
                  <h3 className="text-sm font-bold text-[#4a3225] border-b border-[#e5e0d5] pb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#a66850]" />
                    Location Artwork
                  </h3>
                  <ImageDropzoneCard
                    type="location"
                    aspectRatio="landscape"
                    imageUrl={formData.imageUrl}
                    onImageChange={(newUrl) => setFormData(prev => ({ ...prev, imageUrl: newUrl }))}
                    label="Illustration / Map View"
                  />

                  {editingLocId && (
                    <>
                      {/* Residents */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-[10px] font-bold text-[#a66850] uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" />
                          Residents
                        </h4>
                        <div className="space-y-2">
                          {projectCharacters.filter((c: any) => c.locationId === editingLocId).length > 0 ? (
                            projectCharacters.filter((c: any) => c.locationId === editingLocId).map((char: any, rIdx: number) => (
                              <div key={`loc-res-${char.id || rIdx}`} className="bg-white border border-[#e5e0d5] rounded-sm p-2 flex items-center gap-2 shadow-sm">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                                  {char.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-[#4a3225] truncate">{char.name}</p>
                                  <p className="text-[9px] text-stone-400 uppercase tracking-wider truncate">{char.role}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-stone-400 italic">No known residents.</p>
                          )}
                        </div>
                      </div>

                      {/* Associated Events */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-[#a66850] uppercase tracking-widest flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5" />
                          Plot Events
                        </h4>
                        <div className="space-y-2">
                          {getAssociatedScenes(editingLocId).length > 0 ? (
                            getAssociatedScenes(editingLocId).map((scene, idx) => (
                              <div key={idx} className="bg-white border border-[#e5e0d5] rounded-sm p-2 shadow-sm">
                                <p className="text-xs font-bold text-[#4a3225] truncate">{scene.title}</p>
                                <p className="text-[10px] text-stone-500 mt-1 line-clamp-2 italic">
                                  Appears in manuscript scene.
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-stone-400 italic">No events recorded here.</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-[#e5e0d5] flex justify-end gap-3 bg-white">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-[#8a5b46] text-[11px] font-bold tracking-widest uppercase hover:bg-stone-100 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className={`px-6 py-2 text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all ${
                  !formData.name.trim() 
                    ? 'bg-stone-300 cursor-not-allowed' 
                    : 'bg-[#b8785e] hover:bg-[#a66850]'
                }`}
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {locToDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="bg-[#fcfaf5] rounded-sm shadow-[8px_16px_48px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col overflow-hidden border border-[#e5e0d5] relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2 shadow-sm">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#4a3225]">Delete Location</h3>
              <p className="text-sm font-serif italic text-stone-500">
                Are you sure you want to delete this location? This action cannot be undone.
              </p>
            </div>
            
            <div className="p-4 border-t border-[#e5e0d5] flex justify-center gap-3 bg-white">
              <button 
                onClick={() => setLocToDelete(null)}
                className="px-6 py-2 text-[#8a5b46] text-[11px] font-bold tracking-widest uppercase hover:bg-stone-100 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    
      {newEdgePopup && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="bg-[#fcfaf5] rounded-sm shadow-[8px_16px_48px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col overflow-hidden border border-[#e5e0d5] relative animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46]">
                  <Route className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#4a3225]">New Route</h3>
                  <p className="text-[9px] font-bold text-[#a66850] tracking-widest uppercase mt-0.5">Connect Locations</p>
                </div>
              </div>
              
              <div className="bg-white border border-stone-200 rounded-sm p-3 shadow-inner flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-600 truncate">{locations.find(l => l.id === newEdgePopup.source)?.name}</span>
                <Move className="w-3 h-3 text-stone-400 shrink-0" />
                <span className="text-xs font-bold text-stone-600 truncate">{locations.find(l => l.id === newEdgePopup.target)?.name}</span>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Route Label / Distance</label>
                <input 
                  type="text"
                  autoFocus
                  placeholder="e.g. 5 days by horse"
                  className="w-full bg-white border border-[#e5e0d5] rounded-sm px-3 py-2 text-sm font-bold text-[#4a3225] focus:outline-none focus:border-[#d49a89] shadow-inner"
                  value={newEdgePopup.label}
                  onChange={e => setNewEdgePopup({...newEdgePopup, label: e.target.value})}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newEdgePopup.label.trim()) {
                      setEdges(prev => [...prev, {
                        id: Date.now().toString(),
                        source: newEdgePopup.source,
                        target: newEdgePopup.target,
                        label: newEdgePopup.label
                      }]);
                      setNewEdgePopup(null);
                    }
                  }}
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#e5e0d5] flex justify-end gap-3 bg-white">
              <button 
                onClick={() => setNewEdgePopup(null)}
                className="px-6 py-2 text-[#8a5b46] text-[11px] font-bold tracking-widest uppercase hover:bg-stone-100 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (newEdgePopup.label.trim()) {
                    setEdges(prev => [...prev, {
                      id: Date.now().toString(),
                      source: newEdgePopup.source,
                      target: newEdgePopup.target,
                      label: newEdgePopup.label
                    }]);
                  }
                  setNewEdgePopup(null);
                }}
                disabled={!newEdgePopup.label.trim()}
                className={`px-6 py-2 text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all ${!newEdgePopup.label.trim() ? 'bg-stone-300' : 'bg-[#b8785e] hover:bg-[#a66850]'}`}
              >
                Save Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Edge Modal */}
      {edgeToDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="bg-[#fcfaf5] rounded-sm shadow-[8px_16px_48px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col overflow-hidden border border-[#e5e0d5] relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2 shadow-sm">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#4a3225]">Remove Route</h3>
              <p className="text-sm font-serif italic text-stone-500">
                Are you sure you want to remove this connection between locations?
              </p>
            </div>
            <div className="p-4 border-t border-[#e5e0d5] flex justify-center gap-3 bg-white">
              <button 
                onClick={() => setEdgeToDelete(null)}
                className="px-6 py-2 text-[#8a5b46] text-[11px] font-bold tracking-widest uppercase hover:bg-stone-100 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setEdges(prev => prev.filter(e => e.id !== edgeToDelete));
                  setEdgeToDelete(null);
                  setHoveredEdge(null);
                }}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold tracking-widest uppercase rounded-sm shadow-md transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* World Atlas & Location Workflow Guide Modal */}
      {showLocationGuideModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowLocationGuideModal(false)}
        >
          <div 
            className="bg-[#fcfaf5] border border-[#e5e0d5] rounded-sm shadow-[8px_24px_64px_rgba(0,0,0,0.5)] max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden text-stone-800 relative my-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e5e0d5] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] flex items-center justify-center text-[#8a5b46] shrink-0">
                  <Compass className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div>
                  <h2 className="text-base font-serif font-bold text-[#4a3225] uppercase tracking-wide">
                    World Atlas & Location Guide
                  </h2>
                  <p className="text-xs font-serif text-stone-500">
                    Step-by-step workflow for realm building, geographic cartography, and AI ideation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationGuideModal(false)}
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
                  What steps do you take in World Atlas?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">1</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Catalogue Realms & Sites</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Click <strong className="text-[#4a3225] font-semibold">Add Location</strong> in the Atlas toolbar to record name, category (City, Castle, Forest, Temple, etc.), parent region, atmosphere, and description.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">2</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Attach Setting Artworks</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Upload atmospheric scenery illustrations, concept landscapes, or choose curated environment presets to give each location distinct visual presence.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">3</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Cartographic Map View</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Switch to <strong className="text-[#4a3225] font-semibold">Map</strong> view to arrange locations across an interactive canvas, pan, zoom, and organize territorial borders.
                    </p>
                  </div>

                  <div className="p-4 rounded-sm bg-white border border-[#e5e0d5] shadow-xs space-y-1.5 hover:border-[#b8785e]/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#f4efe6] text-[#8a5b46] border border-[#e5e0d5] text-[10px] font-bold flex items-center justify-center font-serif shrink-0">4</span>
                      <span className="font-serif font-bold text-xs uppercase tracking-wider text-[#4a3225]">Connect Routes & Trails</span>
                    </div>
                    <p className="text-stone-600 leading-relaxed font-sans pl-7">
                      Link settlements and landmarks with custom travel routes, caravan highways, perilous sea channels, and mountain passes labeled with travel duration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: AI Location Architect Prompt */}
              <div className="space-y-3 pt-4 border-t border-[#e5e0d5]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-serif font-bold uppercase tracking-widest text-[#8a5b46] flex items-center gap-2">
                      <Feather className="w-4 h-4" />
                      Unsure what to write? Copy this AI Location Prompt
                    </h3>
                    <p className="text-xs font-serif text-stone-500 mt-0.5">
                      Send this prompt to ChatGPT, Claude, or Gemini alongside your novel premise to generate an authentic location profile:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLocationPrompt}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
                      isLocationPromptCopied
                        ? "bg-emerald-700 text-white"
                        : "bg-[#b8785e] hover:bg-[#a66850] text-white"
                    }`}
                  >
                    {isLocationPromptCopied ? (
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
{LOCATION_CREATION_AI_PROMPT}
                  </pre>
                </div>

                <div className="p-3.5 rounded-sm bg-[#f4efe6] border border-[#e5e0d5] text-xs text-[#5c4033] flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#8a5b46] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="font-semibold text-[#4a3225]">Tip:</strong> Once the AI returns your location details, click <em className="font-serif">"+ Add Location"</em> in the World Atlas and paste the generated name, type, atmosphere, and description directly into the form.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-[#e5e0d5] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowLocationGuideModal(false)}
                className="px-5 py-2 rounded-sm bg-[#f4efe6] hover:bg-[#eae3d5] text-[#4a3225] border border-[#e5e0d5] text-xs font-bold uppercase tracking-widest transition-colors shadow-xs"
              >
                Got it, return to Atlas
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Location Quota Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="locations"
        currentCount={locations.length}
        maxLimit={maxLocations}
      />
    </div>
  );
}

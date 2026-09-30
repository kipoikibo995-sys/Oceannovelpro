import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { storage } from "@/lib/storage";
import { Plus, MoreVertical, GripVertical, Clock, LayoutList, CheckCircle2, ChevronRight, Tags, MapPin, Users, Edit3, Trash2, Calendar, Columns, X, Spline, GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";


type PlotArc = {
  id: string;
  name: string;
  color: string;
};

type StoryEvent = {
  id: string;
  title: string;
  date: string;
  description: string;
  characters: string[];
  locationId: string | null;
  arcId: string;
  act: number;
  parentId: string | null;
  x: number;
  y: number;
  completed?: boolean;
};

const DEFAULT_ARCS: PlotArc[] = [
  { id: "a1", name: "Main Plot", color: "#965A5A" },
  { id: "a2", name: "Character Arc", color: "#5A7A96" },
  { id: "a3", name: "Political Subplot", color: "#5A9672" }
];

const DEFAULT_EVENTS: StoryEvent[] = [
  {
    id: "e1",
    title: "The Fall of Eldoria",
    date: "14 Moonfall – Year 302",
    description: "The northern army attacks Eldoria unexpectedly during the night. The castle is breached and the royal family must flee.",
    characters: ["1", "3"],
    locationId: "1",
    arcId: "a1",
    act: 1,
    parentId: null,
    x: 500,
    y: 80
  },
  {
    id: "e2",
    title: "A Secret Meeting",
    date: "18 Moonfall – Year 302",
    description: "In the ruins of the old temple, an alliance is forged between former enemies who realize they share a common threat.",
    characters: ["1", "2"],
    locationId: "2",
    arcId: "a2",
    act: 1,
    parentId: "e1",
    x: 250,
    y: 350
  },
  {
    id: "e3",
    title: "The Great Betrayal",
    date: "25 Moonfall – Year 302",
    description: "A trusted advisor turns against the group, stealing the artifact and leaving them trapped in the canyon.",
    characters: ["2", "3"],
    locationId: "3",
    arcId: "a3",
    act: 2,
    parentId: "e1",
    x: 750,
    y: 350
  }
];

export default function Plot() {
  const { id } = useParams();
  const projectData = useMemo(() => {
    return id ? storage.getProjectData(id) : null;
  }, [id]);

  const [view, setView] = useState<"list" | "board" | "tree">("tree");
  
  const currentProjectIdRef = useRef<string | undefined>(id);

  const getInitialPlot = (projId: string | undefined) => {
    if (!projId) return { arcs: DEFAULT_ARCS, events: DEFAULT_EVENTS };
    const data = storage.getProjectData(projId);
    const loadedArcs = (data?.plotArcs && data.plotArcs.length > 0) ? data.plotArcs : DEFAULT_ARCS;
    
    let loadedEvents: StoryEvent[] = [];
    if (data?.plotEvents && data.plotEvents.length > 0) {
      loadedEvents = data.plotEvents.map((e: any) => ({
        ...e,
        x: e.x || 500,
        y: e.y || 100,
        parentId: e.parentId || null
      }));
    }
    return { arcs: loadedArcs, events: loadedEvents };
  };

  const initialPlot = useMemo(() => getInitialPlot(id), [id]);
  const [arcs, setArcs] = useState<PlotArc[]>(initialPlot.arcs);
  const [events, setEvents] = useState<StoryEvent[]>(initialPlot.events);

  useEffect(() => {
    const { arcs: a, events: e } = getInitialPlot(id);
    currentProjectIdRef.current = id;
    setArcs(a);
    setEvents(e);
  }, [id]);

  useEffect(() => {
    if (id && currentProjectIdRef.current === id && arcs.length > 0) {
      storage.saveProjectData(id, { plotArcs: arcs });
    }
  }, [arcs, id]);

  useEffect(() => {
    if (id && currentProjectIdRef.current === id) {
      storage.saveProjectData(id, { plotEvents: events });
    }
  }, [events, id]);

  const [editingEvent, setEditingEvent] = useState<StoryEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleEdit = (event: StoryEvent) => {
    setEditingEvent(event);
    setIsEditorOpen(true);
  };

  const handleAddNew = () => {
    setEditingEvent({
      id: Date.now().toString(),
      title: "",
      date: "",
      description: "",
      characters: [],
      locationId: null,
      arcId: arcs[0]?.id || "",
      act: 1,
      parentId: null,
      x: 500,
      y: Math.max(100, ...events.map(e => e.y)) + 150
    });
    setIsEditorOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    const parent = events.find(e => e.id === parentId);
    const children = events.filter(e => e.parentId === parentId);
    const offsetX = children.length * 350 - 175; 
    
    setEditingEvent({
      id: Date.now().toString(),
      title: "",
      date: "",
      description: "",
      characters: [],
      locationId: null,
      arcId: parent?.arcId || arcs[0]?.id || "",
      act: parent ? Math.min(parent.act, 3) : 1,
      parentId: parentId,
      x: parent ? parent.x + offsetX : 500,
      y: parent ? parent.y + 300 : 400
    });
    setIsEditorOpen(true);
  };

  const saveEvent = () => {
    if (!editingEvent) return;
    setEvents(prev => {
      const exists = prev.find(e => e.id === editingEvent.id);
      if (exists) {
        return prev.map(e => e.id === editingEvent.id ? editingEvent : e);
      }
      return [...prev, editingEvent];
    });
    setIsEditorOpen(false);
  };

  const deleteEvent = (id: string) => {
    const target = events.find(e => e.id === id);
    if (!target) {
      setIsEditorOpen(false);
      return;
    }
    if (!window.confirm(`Delete "${target.title || "this event"}"? Its branches will move up one level.`)) return;
    setEvents(prev => prev
      .filter(e => e.id !== id)
      .map(e => e.parentId === id ? { ...e, parentId: target.parentId } : e));
    setIsEditorOpen(false);
  };

  // 5. Mark an event as reached in the draft (drives Plot coverage on the Overview)
  const toggleCompleted = (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  };

  // Tree Canvas Logic
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const node = events.find((ev) => ev.id === id);
    if (node) {
      setDraggingNode(id);
      setNodeDragOffset({
        x: e.clientX / scale - node.x,
        y: e.clientY / scale - node.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggingNode) {
      setEvents(prev => prev.map(ev => 
        ev.id === draggingNode 
          ? { ...ev, x: e.clientX / scale - nodeDragOffset.x, y: e.clientY / scale - nodeDragOffset.y }
          : ev
      ));
    }
  };

  const handlePointerUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNode(null);
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const getArcColor = (arcId: string) => arcs.find(a => a.id === arcId)?.color || "#999";
  const getArcName = (arcId: string) => arcs.find(a => a.id === arcId)?.name || "Unknown Arc";

  const eventsByAct = {
    1: events.filter(e => e.act === 1),
    2: events.filter(e => e.act === 2),
    3: events.filter(e => e.act === 3),
  };
  const ACTS = [
    { n: 1, roman: "I", label: "Setup & inciting incident" },
    { n: 2, roman: "II", label: "Rising action & midpoint" },
    { n: 3, roman: "III", label: "Climax & resolution" },
  ];
  const doneCount = events.filter(e => e.completed).length;
  const charName = (cid: string) => (projectData?.characters || []).find((c: any) => c.id === cid);
  const locName = (lid: string | null) => (lid ? (projectData?.locations || []).find((l: any) => l.id === lid)?.name : undefined);

  const inputCls =
    "w-full h-11 px-4 bg-white border border-[#E9E2D4] rounded-2xl text-[14px] text-[#0E1D26] placeholder:text-[#0E1D26]/30 outline-none focus:border-[#0E1D26]/35";
  const labelCls = "flex items-center gap-1.5 pl-1 mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0E1D26]/45";

  const ArcTag = ({ arcId }: { arcId: string }) => (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0E1D26]/60">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getArcColor(arcId) }} />
      {getArcName(arcId)}
    </span>
  );

  const Cast = ({ ids, max = 4 }: { ids: string[]; max?: number }) => {
    const people = ids.map(charName).filter(Boolean) as any[];
    if (people.length === 0) return null;
    return (
      <span className="flex -space-x-1.5">
        {people.slice(0, max).map((c, i) =>
          c.imageUrl ? (
            <img key={`${c.id}-${i}`} src={c.imageUrl} alt={c.name} title={c.name} className="w-6 h-6 rounded-full object-cover ring-2 ring-white" />
          ) : (
            <span key={`${c.id}-${i}`} title={c.name} className="w-6 h-6 rounded-full ring-2 ring-white bg-[#EFE9DE] flex items-center justify-center text-[10px] font-bold">
              {c.name.charAt(0)}
            </span>
          )
        )}
        {people.length > max && (
          <span className="w-6 h-6 rounded-full ring-2 ring-white bg-[#EFE9DE] flex items-center justify-center text-[10px] font-bold">+{people.length - max}</span>
        )}
      </span>
    );
  };

  const DoneToggle = ({ event }: { event: StoryEvent }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleCompleted(event.id);
      }}
      title={event.completed ? "Reached in the draft — click to undo" : "Mark as reached in the draft"}
      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
        event.completed ? "bg-[#E8561F] text-white" : "border-2 border-[#0E1D26]/20 hover:border-[#E8561F] text-transparent hover:text-[#E8561F]"
      }`}
    >
      <CheckCircle2 className="w-3.5 h-3.5" />
    </button>
  );

  const seg = (active: boolean) =>
    `h-8 px-4 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
      active ? "bg-white text-[#0E1D26] shadow-[0_1px_2px_rgba(14,29,38,0.08)]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
    }`;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F8F5EE] text-[#0E1D26] font-['Outfit']">
      {/* Header */}
      <div className="shrink-0 relative z-20 border-b border-[#E9E2D4]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-8 pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Structure</p>
            <h1 className="mt-2 text-[34px] lg:text-[40px] font-extrabold leading-none tracking-[-0.02em]">Plot & Timeline</h1>
            <p className="mt-2 text-[14px] text-[#0E1D26]/55">
              {events.length} {events.length === 1 ? "event" : "events"} · {doneCount} reached in the draft
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 p-1 rounded-full bg-[#EFE9DE]">
              <button className={seg(view === "list")} onClick={() => setView("list")}>Acts</button>
              <button className={seg(view === "board")} onClick={() => setView("board")}>Arcs</button>
              <button className={seg(view === "tree")} onClick={() => setView("tree")}>Branch tree</button>
            </div>
            <button
              onClick={handleAddNew}
              className="h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              Add Event
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative z-0">
        {events.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none">
            <div className="max-w-sm text-center pointer-events-auto">
              <span className="mx-auto w-12 h-12 rounded-full bg-white border border-[#E9E2D4] flex items-center justify-center text-[#0E1D26]/40">
                <GitBranch className="w-5 h-5" />
              </span>
              <p className="mt-4 text-[18px] font-bold">No plot events yet</p>
              <p className="mt-1 text-[14px] text-[#0E1D26]/55">Add the first turning point of your story. You can place it in an act, an arc and a branch later.</p>
              <button
                onClick={handleAddNew}
                className="mt-5 h-10 px-5 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add first event
              </button>
            </div>
          </div>
        )}

        {view === "list" && events.length > 0 && (
          <div className="absolute inset-0 overflow-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 space-y-12">
              {ACTS.map(({ n, roman, label }) => {
                const list = eventsByAct[n as 1 | 2 | 3];
                return (
                  <section key={n}>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-[26px] font-extrabold tracking-[-0.02em]">Act {roman}</h2>
                      <span className="text-[13px] text-[#0E1D26]/45">{label}</span>
                      <span className="ml-auto text-[12px] text-[#0E1D26]/40">{list.length}</span>
                    </div>

                    <div className="mt-4 relative pl-8">
                      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#E4DAC8]" />
                      {list.length === 0 ? (
                        <p className="py-6 text-[14px] text-[#0E1D26]/40">No events in this act yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {list.map((event) => (
                            <div key={event.id} className="relative group">
                              <span
                                className="absolute -left-[26px] top-5 w-3 h-3 rounded-full ring-4 ring-[#F8F5EE]"
                                style={{ backgroundColor: getArcColor(event.arcId) }}
                              />
                              <div
                                onClick={() => handleEdit(event)}
                                className={`rounded-3xl bg-white border border-[#E9E2D4] hover:border-[#0E1D26]/25 p-5 transition-colors cursor-pointer ${event.completed ? "opacity-70" : ""}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <ArcTag arcId={event.arcId} />
                                      {event.date && (
                                        <span className="flex items-center gap-1 text-[12px] text-[#0E1D26]/45">
                                          <Calendar className="w-3 h-3" /> {event.date}
                                        </span>
                                      )}
                                    </div>
                                    <h3 className={`mt-1.5 text-[18px] font-bold leading-snug ${event.completed ? "line-through decoration-[#0E1D26]/30" : ""}`}>
                                      {event.title || "Untitled event"}
                                    </h3>
                                  </div>
                                  <DoneToggle event={event} />
                                </div>
                                {event.description && <p className="mt-2 text-[14px] leading-relaxed text-[#0E1D26]/65">{event.description}</p>}
                                {(event.locationId || event.characters.length > 0) && (
                                  <div className="mt-4 pt-3 border-t border-[#F1ECE2] flex items-center justify-between gap-3">
                                    {locName(event.locationId) ? (
                                      <span className="flex items-center gap-1.5 text-[12px] text-[#0E1D26]/55 truncate">
                                        <MapPin className="w-3.5 h-3.5" /> {locName(event.locationId)}
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                    <Cast ids={event.characters} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {view === "board" && events.length > 0 && (
          <div className="absolute inset-0 overflow-auto custom-scrollbar">
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 min-w-max">
              {arcs.map((arc) => {
                const arcEvents = events.filter((e) => e.arcId === arc.id).sort((a, b) => a.act - b.act);
                return (
                  <section key={arc.id} className="rounded-3xl bg-white border border-[#E9E2D4] p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: arc.color }} />
                      <h3 className="text-[16px] font-bold">{arc.name}</h3>
                      <span className="text-[12px] text-[#0E1D26]/40">{arcEvents.length}</span>
                    </div>
                    <div className="mt-4 relative flex items-stretch gap-4">
                      <div className="absolute left-0 right-0 top-1/2 h-px opacity-30" style={{ backgroundColor: arc.color }} />
                      {arcEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={() => handleEdit(event)}
                          className={`relative z-10 w-64 shrink-0 rounded-2xl bg-[#FBF9F5] border border-[#E9E2D4] hover:border-[#0E1D26]/25 p-4 cursor-pointer transition-colors flex flex-col ${event.completed ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0E1D26]/45">Act {["I", "II", "III"][event.act - 1] || event.act}</span>
                            <DoneToggle event={event} />
                          </div>
                          <h4 className="mt-1 text-[15px] font-bold leading-snug line-clamp-2">{event.title || "Untitled event"}</h4>
                          {event.description && <p className="mt-1.5 text-[12px] text-[#0E1D26]/55 line-clamp-3">{event.description}</p>}
                          <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#0E1D26]/45 truncate">{event.date || locName(event.locationId) || ""}</span>
                            <Cast ids={event.characters} max={3} />
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setEditingEvent({
                            id: Date.now().toString(),
                            title: "",
                            date: "",
                            description: "",
                            characters: [],
                            locationId: null,
                            arcId: arc.id,
                            act: 1,
                            parentId: null,
                            x: 500,
                            y: 100,
                          });
                          setIsEditorOpen(true);
                        }}
                        className="relative z-10 w-12 h-12 self-center shrink-0 rounded-full bg-white border-2 border-dashed border-[#0E1D26]/20 hover:border-[#0E1D26]/40 text-[#0E1D26]/45 hover:text-[#0E1D26] flex items-center justify-center cursor-pointer"
                        title={`Add event to ${arc.name}`}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {view === "tree" && events.length > 0 && (
          <div
            className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
            style={{
              backgroundColor: "#FBF9F5",
              backgroundImage: "radial-gradient(rgba(14,29,38,0.09) 1px, transparent 1px)",
              backgroundSize: `${28 * scale}px ${28 * scale}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(e) => {
              const delta = e.deltaY * -0.001;
              setScale(Math.min(Math.max(0.2, scale + delta), 2));
            }}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "0 0" }} className="absolute inset-0 pointer-events-none">
              <svg className="absolute inset-0 overflow-visible z-0" style={{ width: "10000px", height: "10000px", left: "-5000px", top: "-5000px" }}>
                <g transform="translate(5000, 5000)">
                  {events.map((event) => {
                    if (!event.parentId) return null;
                    const parent = events.find((e) => e.id === event.parentId);
                    if (!parent) return null;
                    const sx = parent.x + 160;
                    const sy = parent.y + 100;
                    const tx = event.x + 160;
                    const ty = event.y + 20;
                    return (
                      <path
                        key={`line-${event.id}`}
                        d={`M ${sx} ${sy} C ${sx} ${sy + 100}, ${tx} ${ty - 100}, ${tx} ${ty}`}
                        fill="none"
                        stroke={getArcColor(event.arcId)}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        opacity="0.5"
                      />
                    );
                  })}
                </g>
              </svg>

              <div className="absolute inset-0 z-10" style={{ width: "10000px", height: "10000px", left: "-5000px", top: "-5000px" }}>
                <div className="absolute inset-0 transform translate-x-[5000px] translate-y-[5000px]">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="absolute pointer-events-auto cursor-grab active:cursor-grabbing group"
                      style={{ left: event.x, top: event.y, width: 320, touchAction: "none" }}
                      onPointerDown={(e) => handleNodePointerDown(e, event.id)}
                      onDoubleClick={() => handleEdit(event)}
                    >
                      <div className={`relative rounded-3xl bg-white border border-[#E9E2D4] group-hover:border-[#0E1D26]/25 p-5 shadow-[0_10px_24px_-18px_rgba(14,29,38,0.5)] transition-colors ${event.completed ? "opacity-75" : ""}`}>
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ring-4 ring-[#FBF9F5]" style={{ backgroundColor: getArcColor(event.arcId) }} />
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <ArcTag arcId={event.arcId} />
                              {event.date && <span className="text-[11px] text-[#0E1D26]/40">{event.date}</span>}
                            </div>
                            <h3 className="mt-1.5 text-[16px] font-bold leading-snug">{event.title || "Untitled event"}</h3>
                          </div>
                          <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(event);
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[#0E1D26]/35 hover:text-[#0E1D26] hover:bg-[#F1ECE2] cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <DoneToggle event={event} />
                          </div>
                        </div>
                        {event.description && <p className="mt-2 text-[13px] leading-relaxed text-[#0E1D26]/60 line-clamp-3">{event.description}</p>}
                        {event.characters.length > 0 && (
                          <div className="mt-3">
                            <Cast ids={event.characters} />
                          </div>
                        )}

                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddChild(event.id);
                          }}
                          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-[#E9E2D4] shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:border-[#E8561F] hover:text-[#E8561F] text-[#0E1D26]/45 z-20 cursor-pointer"
                          title="Branch a new event from here"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Zoom */}
            <div className="absolute bottom-5 left-5 flex items-center gap-1 p-1 rounded-full bg-white border border-[#E9E2D4] shadow-[0_8px_20px_-12px_rgba(14,29,38,0.4)] z-50">
              <button onClick={() => setScale((s) => Math.max(0.2, s - 0.2))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F8F5EE] cursor-pointer" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={resetView} className="h-8 px-2 rounded-full text-[12px] font-semibold tabular-nums text-[#0E1D26]/55 hover:bg-[#F8F5EE] cursor-pointer" title="Reset view">
                {Math.round(scale * 100)}%
              </button>
              <button onClick={() => setScale((s) => Math.min(2, s + 0.2))} className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/60 hover:bg-[#F8F5EE] cursor-pointer" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <p className="absolute bottom-6 right-6 text-[12px] text-[#0E1D26]/40 pointer-events-none">Drag cards to arrange · double-click to edit · + to branch</p>
          </div>
        )}
      </div>

      {/* Slide-out editor */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-[#F8F5EE] shadow-[0_0_48px_rgba(14,29,38,0.25)] z-[60] transform transition-transform duration-300 ease-in-out flex flex-col font-['Outfit'] text-[#0E1D26] ${
          isEditorOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {isEditorOpen && editingEvent && (
          <>
            <div className="px-6 pt-6 pb-4 flex justify-between items-start shrink-0">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45">Plot event</p>
                <h2 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.02em]">{events.some((e) => e.id === editingEvent.id) ? "Edit event" : "New event"}</h2>
              </div>
              <button onClick={() => setIsEditorOpen(false)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#EFE9DE] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6 space-y-5">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  type="text"
                  autoFocus
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="e.g. The King's Assassination"
                  className={`${inputCls} font-semibold`}
                />
              </div>
              <div>
                <label className={labelCls}>In-world date</label>
                <input
                  type="text"
                  value={editingEvent.date}
                  onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                  placeholder="e.g. 14 Moonfall – Year 302"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    <Spline className="w-3 h-3" /> Arc
                  </label>
                  <select value={editingEvent.arcId} onChange={(e) => setEditingEvent({ ...editingEvent, arcId: e.target.value })} className={`${inputCls} cursor-pointer`}>
                    {arcs.map((arc) => (
                      <option key={arc.id} value={arc.id}>
                        {arc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    <Columns className="w-3 h-3" /> Act
                  </label>
                  <select value={editingEvent.act} onChange={(e) => setEditingEvent({ ...editingEvent, act: Number(e.target.value) })} className={`${inputCls} cursor-pointer`}>
                    <option value={1}>Act I · Setup</option>
                    <option value={2}>Act II · Rising action</option>
                    <option value={3}>Act III · Resolution</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  <GitBranch className="w-3 h-3" /> Branches from
                </label>
                <select
                  value={editingEvent.parentId || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, parentId: e.target.value || null })}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="">Main trunk (no parent)</option>
                  {events
                    .filter((e) => e.id !== editingEvent.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title || "Untitled event"}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>What happens</label>
                <textarea
                  value={editingEvent.description}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={5}
                  placeholder="What happens in this event, and why does it matter?"
                  className="w-full px-4 py-3 bg-white border border-[#E9E2D4] rounded-2xl text-[14px] leading-relaxed placeholder:text-[#0E1D26]/30 outline-none focus:border-[#0E1D26]/35 resize-none"
                />
              </div>

              <div>
                <label className={labelCls}>
                  <MapPin className="w-3 h-3" /> Location
                </label>
                <select
                  value={editingEvent.locationId || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, locationId: e.target.value || null })}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="">No specific location</option>
                  {(projectData?.locations || []).map((loc: any) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  <Users className="w-3 h-3" /> Characters involved
                </label>
                {(projectData?.characters || []).length === 0 ? (
                  <p className="pl-1 text-[13px] text-[#0E1D26]/45">No characters in this book yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(projectData?.characters || []).map((char: any) => {
                      const isSelected = editingEvent.characters.includes(char.id);
                      return (
                        <button
                          key={char.id}
                          onClick={() => {
                            setEditingEvent((prev) => ({
                              ...prev!,
                              characters: isSelected ? prev!.characters.filter((cid) => cid !== char.id) : [...prev!.characters, char.id],
                            }));
                          }}
                          className={`h-8 pl-1 pr-3 rounded-full text-[12px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            isSelected ? "bg-[#0E1D26] border-[#0E1D26] text-[#F6F1E7]" : "bg-white border-[#E9E2D4] text-[#0E1D26]/65 hover:border-[#0E1D26]/30"
                          }`}
                        >
                          {char.imageUrl ? (
                            <img src={char.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-[#EFE9DE] text-[#0E1D26] flex items-center justify-center text-[10px] font-bold">{char.name.charAt(0)}</span>
                          )}
                          {char.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2.5 pl-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!editingEvent.completed}
                  onChange={(e) => setEditingEvent({ ...editingEvent, completed: e.target.checked })}
                  className="w-4 h-4 accent-[#E8561F] cursor-pointer"
                />
                <span className="text-[14px]">Reached in the draft</span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-[#E9E2D4] flex justify-between items-center shrink-0">
              {events.some((e) => e.id === editingEvent.id) ? (
                <button
                  onClick={() => deleteEvent(editingEvent.id)}
                  className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#C2410C] hover:bg-[#C2410C]/[0.06] flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={() => setIsEditorOpen(false)} className="h-10 px-5 rounded-full border border-[#E9E2D4] bg-white text-[13px] font-semibold cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={saveEvent}
                  disabled={!editingEvent.title.trim()}
                  className="h-10 px-5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold cursor-pointer"
                >
                  Save event
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isEditorOpen && <div className="fixed inset-0 bg-[#0E1D26]/20 backdrop-blur-sm z-[50]" onClick={() => setIsEditorOpen(false)} />}
    </div>
  );
}

import React, { useState, useEffect, Suspense } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  IconArrow,
  IconBook,
  IconBookWave,
  IconChevronLeft,
  IconGear,
  IconMenu,
  IconOverview,
  IconPerson,
  IconPin,
  IconQuill,
  IconSearch,
  IconShield,
  IconTimeline,
  type IconProps,
} from "@/components/brand/ocean-ui";

export function AppLayout() {
  return (
    <div className="h-screen w-screen bg-[#F4F1EA] text-stone-800 font-sans flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Suspense fallback={<div className="flex-1 bg-[#F8F5EE]" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

type NavItem = { label: string; icon: (p: IconProps) => React.ReactElement; href: string };

export function ProjectLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const projId = location.pathname.split("/")[2] || "1";

  useEffect(() => {
    if (location.pathname.includes("/workspace/studio")) {
      setIsExpanded(false);
    }
  }, [location.pathname]);

  const navItems: NavItem[] = [
    { label: "Overview", icon: IconOverview, href: `/project/${projId}` },
    { label: "Story Bible", icon: IconBook, href: `/project/${projId}/workspace/bible` },
    { label: "Characters", icon: IconPerson, href: `/project/${projId}/characters` },
    { label: "Locations", icon: IconPin, href: `/project/${projId}/workspace/locations` },
    { label: "Plot & Timeline", icon: IconTimeline, href: `/project/${projId}/workspace/plot` },
  ];

  const toolItems: NavItem[] = [
    { label: "Search & Replace", icon: IconSearch, href: `/project/${projId}/workspace/search` },
    { label: "Consistency Checker", icon: IconShield, href: `/project/${projId}/workspace/consistency` },
  ];

  const studioHref = `/project/${projId}/workspace/studio`;
  const isStudio = location.pathname === studioHref;
  const inSettings = location.pathname.includes("settings");
  const isProfile = inSettings && (location.search.includes("tab=profile") || !location.search.includes("tab="));
  const isPrefs = inSettings && location.search.includes("tab=preferences");

  // Every row keeps the same geometry in both states: the icon never moves,
  // only the rail widens and the labels fade. Nothing mounts or re-flows mid-animation.
  const rowCls = "w-full h-10 pl-[11px] pr-3 gap-3 flex items-center rounded-full";
  const labelCls = cn(
    "whitespace-nowrap transition-opacity",
    isExpanded ? "opacity-100 duration-200 delay-100" : "opacity-0 duration-100 pointer-events-none"
  );

  const itemCls = (active: boolean) =>
    cn(
      "relative transition-colors",
      rowCls,
      active
        ? "bg-white text-[#0E1D26] font-semibold shadow-[0_1px_2px_rgba(14,29,38,0.08)]"
        : "text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.04] font-medium"
    );

  // Same height open or closed: a label when open, a short rule when closed
  const sectionLabel = (text: string) => (
    <div className="relative h-8 shrink-0" aria-hidden={!isExpanded}>
      <span className={cn("absolute left-4 bottom-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1D26]/35", labelCls)}>{text}</span>
      <span
        className={cn(
          "absolute left-[12px] top-1/2 w-4 h-px bg-[#D9D0BF] transition-opacity",
          isExpanded ? "opacity-0 duration-100" : "opacity-100 duration-200 delay-100"
        )}
      />
    </div>
  );

  const renderItem = (item: NavItem) => {
    const active = location.pathname === item.href;
    return (
      <Link key={item.href} to={item.href} title={!isExpanded ? item.label : undefined} className={itemCls(active)}>
        <item.icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-[#E8561F]" : "")} />
        <span className={cn("text-[14px]", labelCls)}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#F8F5EE] font-['Outfit'] text-[#0E1D26]">
      <aside
        className={cn(
          "bg-[#F1ECE2] border-r border-[#E6DFD2] flex flex-col shrink-0 py-5 px-3 z-50 overflow-hidden",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isExpanded ? "w-60" : "w-16"
        )}
      >
        {/* Toggle & brand */}
        <div className="flex items-center gap-2 mb-5 h-10 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isExpanded}
            className="relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.05] transition-colors cursor-pointer"
          >
            <IconMenu className={cn("w-[18px] h-[18px] absolute transition-all duration-200", isExpanded ? "opacity-0 rotate-90 scale-75" : "opacity-100")} />
            <IconChevronLeft className={cn("w-[18px] h-[18px] transition-all duration-200", isExpanded ? "opacity-100" : "opacity-0 -rotate-90 scale-75")} />
          </button>
          <span className={cn("flex items-center gap-2", labelCls)}>
            <IconBookWave className="w-6 h-6 text-[#E8561F]" />
            <span className="text-[16px] font-bold tracking-tight">Ocean Novel</span>
          </span>
        </div>

        {/* Back to all books */}
        <button
          onClick={() => navigate("/dashboard")}
          title={!isExpanded ? "All Books" : undefined}
          className={cn(rowCls, "shrink-0 border border-[#E0D8C9] text-[#0E1D26]/70 hover:text-[#0E1D26] hover:border-[#0E1D26]/30 transition-colors cursor-pointer")}
        >
          <IconArrow className="w-4 h-4 rotate-180 shrink-0" />
          <span className={cn("text-[13px] font-semibold", labelCls)}>All Books</span>
        </button>

        {/* Primary action: write */}
        <Link
          to={studioHref}
          title={!isExpanded ? "Writing Studio" : undefined}
          className={cn(
            rowCls,
            "mt-3 shrink-0 transition-colors",
            isStudio ? "bg-[#E8561F] text-white" : "bg-[#0E1D26] text-[#F6F1E7] hover:bg-[#132631]"
          )}
        >
          <IconQuill className={cn("w-[18px] h-[18px] shrink-0", isStudio ? "text-white" : "text-[#F0B54B]")} />
          <span className={cn("text-[14px] font-bold", labelCls)}>Writing Studio</span>
        </Link>

        <nav className="flex-1 w-full flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden min-h-0 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {sectionLabel("Book")}
          {navItems.map(renderItem)}

          {sectionLabel("Tools")}
          {toolItems.map(renderItem)}
        </nav>

        <div className="flex flex-col gap-0.5 shrink-0 pt-3 border-t border-[#E0D8C9]">
          <button
            onClick={() => navigate(`/project/${projId}/workspace/settings?tab=profile`)}
            className={cn(itemCls(isProfile), "cursor-pointer")}
            title={!isExpanded ? "Profile" : undefined}
          >
            <IconPerson className="w-[18px] h-[18px] shrink-0" />
            <span className={cn("text-[14px]", labelCls)}>Profile</span>
          </button>
          <button
            onClick={() => navigate(`/project/${projId}/workspace/settings?tab=preferences`)}
            className={cn(itemCls(isPrefs), "cursor-pointer")}
            title={!isExpanded ? "Settings" : undefined}
          >
            <IconGear className="w-[18px] h-[18px] shrink-0" />
            <span className={cn("text-[14px]", labelCls)}>Settings</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F8F5EE]">
        <Suspense fallback={<div className="flex-1 bg-[#F8F5EE]" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

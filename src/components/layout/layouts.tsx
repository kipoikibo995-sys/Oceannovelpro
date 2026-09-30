import React, { useState, useEffect } from "react";
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
        <Outlet />
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

  const itemCls = (active: boolean) =>
    cn(
      "relative flex items-center rounded-full transition-colors",
      isExpanded ? "w-full px-4 h-10 gap-3" : "w-10 h-10 justify-center mx-auto",
      active
        ? "bg-white text-[#0E1D26] font-semibold shadow-[0_1px_2px_rgba(14,29,38,0.08)]"
        : "text-[#0E1D26]/60 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.04] font-medium"
    );

  const sectionLabel = (text: string) =>
    isExpanded && (
      <div className="px-4 mt-4 mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0E1D26]/35">{text}</div>
    );

  const renderItem = (item: NavItem) => {
    const active = location.pathname === item.href;
    return (
      <Link key={item.href} to={item.href} title={!isExpanded ? item.label : undefined} className={itemCls(active)}>
        <item.icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-[#E8561F]" : "")} />
        {isExpanded && <span className="text-[14px] truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#F8F5EE] font-['Outfit'] text-[#0E1D26]">
      <aside
        className={cn(
          "bg-[#F1ECE2] border-r border-[#E6DFD2] flex flex-col shrink-0 py-5 z-50 transition-all duration-300 ease-in-out",
          isExpanded ? "w-60 px-3 items-stretch" : "w-16 px-0 items-center"
        )}
      >
        {/* Brand & toggle */}
        <div className={cn("flex items-center mb-5", isExpanded ? "justify-between px-3" : "justify-center")}>
          {isExpanded && (
            <span className="flex items-center gap-2">
              <IconBookWave className="w-6 h-6 text-[#E8561F]" />
              <span className="text-[16px] font-bold tracking-tight">Ocean Novel</span>
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#0E1D26]/45 hover:text-[#0E1D26] hover:bg-[#0E1D26]/[0.05] transition-colors cursor-pointer"
          >
            {isExpanded ? <IconChevronLeft className="w-[18px] h-[18px]" /> : <IconMenu className="w-[18px] h-[18px]" />}
          </button>
        </div>

        {/* Back to all books */}
        <button
          onClick={() => navigate("/dashboard")}
          title="All Books"
          className={cn(
            "flex items-center rounded-full border border-[#E0D8C9] text-[#0E1D26]/70 hover:text-[#0E1D26] hover:border-[#0E1D26]/30 transition-colors cursor-pointer",
            isExpanded ? "w-full h-10 px-4 gap-3" : "w-10 h-10 justify-center mx-auto"
          )}
        >
          <IconArrow className="w-4 h-4 rotate-180 shrink-0" />
          {isExpanded && <span className="text-[13px] font-semibold">All Books</span>}
        </button>

        {/* Primary action: write */}
        <Link
          to={studioHref}
          title={!isExpanded ? "Writing Studio" : undefined}
          className={cn(
            "mt-3 flex items-center rounded-full transition-colors",
            isExpanded ? "w-full h-11 px-4 gap-3" : "w-11 h-11 justify-center mx-auto",
            isStudio ? "bg-[#E8561F] text-white" : "bg-[#0E1D26] text-[#F6F1E7] hover:bg-[#132631]"
          )}
        >
          <IconQuill className={cn("w-[18px] h-[18px] shrink-0", isStudio ? "text-white" : "text-[#F0B54B]")} />
          {isExpanded && <span className="text-[14px] font-bold">Writing Studio</span>}
        </Link>

        <nav className="flex-1 w-full flex flex-col gap-0.5 overflow-y-auto min-h-0 mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {sectionLabel("Book")}
          {!isExpanded && <div className="h-3" />}
          {navItems.map(renderItem)}

          {sectionLabel("Tools")}
          {!isExpanded && <div className="w-6 h-px bg-[#E0D8C9] mx-auto my-3" />}
          {toolItems.map(renderItem)}
        </nav>

        <div className={cn("flex flex-col gap-0.5 shrink-0 pt-3 border-t border-[#E0D8C9]", isExpanded ? "mx-1" : "")}>
          <button
            onClick={() => navigate(`/project/${projId}/workspace/settings?tab=profile`)}
            className={cn(itemCls(isProfile), "cursor-pointer")}
            title="Profile"
          >
            <IconPerson className="w-[18px] h-[18px] shrink-0" />
            {isExpanded && <span className="text-[14px]">Profile</span>}
          </button>
          <button
            onClick={() => navigate(`/project/${projId}/workspace/settings?tab=preferences`)}
            className={cn(itemCls(isPrefs), "cursor-pointer")}
            title="Settings"
          >
            <IconGear className="w-[18px] h-[18px] shrink-0" />
            {isExpanded && <span className="text-[14px]">Settings</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F8F5EE]">
        <Outlet />
      </main>
    </div>
  );
}

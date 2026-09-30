// Writing Studio typography, shared by Settings (defaults) and the Studio (per-session Aa menu).

export type EditorFamily = "font-serif" | "font-sans" | "font-mono";
export type EditorSize = "text-base" | "text-lg" | "text-xl" | "text-2xl";

export const EDITOR_PREFS_KEY = "ocean_studio_type";

// Profile values may be new ("Serif", "Medium") or legacy ("Merriweather (Serif)", "Medium (18px)")
export function editorFamilyFromProfile(value?: string): EditorFamily {
  const v = (value || "").toLowerCase();
  if (v.includes("mono")) return "font-mono";
  if (v.includes("sans")) return "font-sans";
  return "font-serif";
}

export function editorSizeFromProfile(value?: string): EditorSize {
  const v = (value || "").toLowerCase();
  if (v.startsWith("extra")) return "text-2xl";
  if (v.startsWith("large")) return "text-xl";
  if (v.startsWith("small")) return "text-base";
  return "text-lg";
}

export function readEditorTypePrefs(): { family?: EditorFamily; size?: EditorSize } {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as { family?: string; size?: string };
    const family = p.family === "font-serif" || p.family === "font-sans" || p.family === "font-mono" ? p.family : undefined;
    const size = p.size === "text-base" || p.size === "text-lg" || p.size === "text-xl" || p.size === "text-2xl" ? p.size : undefined;
    return { family, size };
  } catch {
    return {};
  }
}

export function saveEditorTypePrefs(family: EditorFamily, size: EditorSize) {
  try {
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify({ size, family }));
  } catch {}
}

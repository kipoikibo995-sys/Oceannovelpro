import { useEffect, useState } from "react";

// Cloud save state per book, so the studio can say "Saved" only when the cloud really has it.
export type CloudSaveState = "saved" | "saving" | "offline" | "error";
export interface CloudSaveInfo {
  state: CloudSaveState;
  message?: string;
}

const EVENT = "ocean-cloud-save";
const states: Record<string, CloudSaveInfo> = {};

export function setCloudSave(projectId: string, info: CloudSaveInfo) {
  states[projectId] = info;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { projectId } }));
}

export function getCloudSave(projectId: string): CloudSaveInfo {
  return states[projectId] || { state: "saved" };
}

export function failedCloudSaves(): { projectId: string; info: CloudSaveInfo }[] {
  return Object.entries(states)
    .filter(([, i]) => i.state === "error")
    .map(([projectId, info]) => ({ projectId, info }));
}

export function useCloudSave(projectId?: string): CloudSaveInfo {
  const [info, setInfo] = useState<CloudSaveInfo>(() => (projectId ? getCloudSave(projectId) : { state: "saved" }));
  useEffect(() => {
    if (!projectId) return;
    setInfo(getCloudSave(projectId));
    const on = (e: Event) => {
      if ((e as CustomEvent).detail?.projectId === projectId) setInfo(getCloudSave(projectId));
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [projectId]);
  return info;
}

/** Re-renders whenever any book's save state changes. */
export function useCloudSaveTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener(EVENT, on);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  return n;
}

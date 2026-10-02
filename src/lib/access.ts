import { useEffect, useState } from "react";

// Whether the signed-in account may use the studio (bought Ocean Novel, or admin-granted).
// Accounts that signed up without buying only see a locked dashboard.
// Remembered per account on this device so returning buyers open instantly; re-checked on every sign-in.
const key = (uid: string) => `ocean_access_${uid}`;
const EVENT = "ocean-access-changed";

export function getCachedAccess(uid?: string | null): boolean | null {
  if (!uid) return null;
  try {
    const v = localStorage.getItem(key(uid));
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

let current: boolean | null = null;

export function setStudioAccess(uid: string, hasAccess: boolean) {
  current = hasAccess;
  try {
    localStorage.setItem(key(uid), hasAccess ? "1" : "0");
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: hasAccess }));
}

export function useStudioAccess(uid?: string | null): boolean {
  const [access, setAccess] = useState<boolean>(() => getCachedAccess(uid) ?? current ?? true);
  useEffect(() => {
    const onChange = (e: Event) => setAccess(Boolean((e as CustomEvent).detail));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return access;
}

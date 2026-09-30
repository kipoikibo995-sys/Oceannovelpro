import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { storage, UserProfile } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { isUserAdmin } from "@/lib/adminService";
import { tierToPlan } from "@/lib/license";
import { openSalesPage } from "@/lib/salesConfig";
import { editorFamilyFromProfile, editorSizeFromProfile, saveEditorTypePrefs } from "@/lib/editorPrefs";
import { cn } from "@/lib/utils";
import { Check, LogOut, LogIn, RefreshCw, Download, ExternalLink, ShieldCheck, ArrowLeft } from "lucide-react";

type Tab = "profile" | "preferences" | "billing" | "data";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "profile", label: "Profile", hint: "Account & pen name" },
  { id: "preferences", label: "Writing", hint: "Editor & defaults" },
  { id: "billing", label: "Plan", hint: "Your edition" },
  { id: "data", label: "Data", hint: "Sync & backup" },
];

const PLAN_INFO: Record<string, { name: string; features: string[] }> = {
  free: {
    name: "Regular Edition",
    features: ["Up to 3 books", "25 characters & 15 locations per book", "Smart @mentions", "Word (.docx) & plain text export"],
  },
  pro: {
    name: "Pro Edition",
    features: ["Unlimited books", "Unlimited characters & locations", "50+ curated fantasy art library", "EPUB 3 export for Amazon KDP"],
  },
  master: {
    name: "Premium Edition",
    features: [
      "Everything in Pro",
      "AI Prompt Hub",
      "Consistency & continuity checker",
      "Word echoes & prose cadence scanner",
    ],
  },
};

const fieldLabel = "block text-[12px] font-semibold text-[#0E1D26]/60 mb-1.5";
const fieldInput =
  "w-full h-11 px-4 rounded-2xl bg-white border border-[#E9E2D4] text-[14px] text-[#0E1D26] placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 transition-colors";
const card = "rounded-3xl bg-white border border-[#E9E2D4] p-6 sm:p-7";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E1D26]/45";

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-full bg-[#F3EEE4]">
      {options.map(([v, label, cls]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 h-9 rounded-full text-[13px] transition-colors cursor-pointer",
            cls,
            value === v ? "bg-white shadow-sm font-semibold text-[#0E1D26]" : "text-[#0E1D26]/55 hover:text-[#0E1D26]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { id: projectId } = useParams();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile>(() => storage.getUserProfile());
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    let unsubSnapshotReg: (() => void) | null = null;
    let unsubSnapshotProfile: (() => void) | null = null;

    const handleStorageUpdate = () => {
      setProfile(storage.getUserProfile());
      setDataVersion((v) => v + 1);
    };
    window.addEventListener("novelist-storage-updated", handleStorageUpdate);

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        storage.switchUser(u.uid, u.email, u.displayName);
        await storage.syncFromCloud(u.uid);
        setProfile(storage.getUserProfile());
        setDataVersion((v) => v + 1);

        const isAdminUser = isUserAdmin(u.email);

        // Live plan from the licence record
        try {
          unsubSnapshotReg = onSnapshot(
            doc(db, "registeredUsers", u.uid),
            (snap) => {
              if (snap.exists()) {
                const livePlan = isAdminUser ? "master" : tierToPlan(snap.data()?.tier);
                if (storage.getUserProfile().plan !== livePlan) setProfile(storage.saveUserProfile({ plan: livePlan }, true));
              }
            },
            (err) => console.warn("Live registeredUsers listener notice:", err)
          );
        } catch (e) {
          console.warn("Could not attach registeredUsers snapshot:", e);
        }

        // Live profile document
        try {
          unsubSnapshotProfile = onSnapshot(
            doc(db, `users/${u.uid}/profile/default`),
            (snap) => {
              if (snap.exists()) {
                const pData = snap.data() as UserProfile;
                const targetPlan = isAdminUser ? "master" : pData?.plan || "free";
                if (storage.getUserProfile().plan !== targetPlan) setProfile(storage.saveUserProfile({ plan: targetPlan }, true));
                else setProfile((prev) => ({ ...prev, ...pData, plan: targetPlan }));
              }
            },
            (err) => console.warn("Live profile snapshot notice:", err)
          );
        } catch (e) {
          console.warn("Could not attach profile snapshot:", e);
        }
      }
    });

    return () => {
      window.removeEventListener("novelist-storage-updated", handleStorageUpdate);
      unsubAuth();
      if (unsubSnapshotReg) unsubSnapshotReg();
      if (unsubSnapshotProfile) unsubSnapshotProfile();
    };
  }, []);

  // Old links used ?tab=appearance; that tab never did anything and now lives under Writing
  const rawTab = searchParams.get("tab") || "profile";
  const activeTab: Tab = rawTab === "appearance" ? "preferences" : TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "profile";
  const handleTabChange = (tab: Tab) => setSearchParams({ tab });

  const isSignedIn = !!firebaseUser && !firebaseUser.isAnonymous;
  const isAdmin = isUserAdmin(firebaseUser?.email || profile.email);
  // Only a signed-in account has a real email (the guest profile carries a placeholder)
  const accountEmail = isSignedIn ? firebaseUser?.email || profile.email || "" : "";

  const flash = (text: string) => {
    setSaveStatus(text);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      storage.clearCache();
      navigate("/login", { replace: true });
    } catch (err: any) {
      console.warn("Sign out error:", err);
    }
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    e?.preventDefault();
    setProfile(storage.saveUserProfile({ name: profile.name, penName: profile.penName, bio: profile.bio }));
    flash("Profile saved");
  };

  // Editor preferences apply to the Writing Studio straight away
  const editorFamily = editorFamilyFromProfile(profile.defaultFont);
  const editorSize = editorSizeFromProfile(profile.fontSize);
  const handleSavePreferences = (e?: React.FormEvent) => {
    e?.preventDefault();
    setProfile(
      storage.saveUserProfile({
        defaultFont: profile.defaultFont,
        fontSize: profile.fontSize,
        defaultPov: profile.defaultPov,
        defaultTone: profile.defaultTone,
      })
    );
    saveEditorTypePrefs(editorFamily, editorSize);
    flash("Writing preferences saved");
  };

  const handleSyncCloudNow = async () => {
    setIsSyncingCloud(true);
    setCloudSyncStatus(null);
    try {
      const ok = await storage.syncAllLocalDataToCloud();
      setCloudSyncStatus(
        ok
          ? { ok: true, text: "Everything is synced to your account." }
          : { ok: false, text: "Couldn’t reach the cloud. Your work is still saved in this browser — try again shortly." }
      );
    } catch {
      setCloudSyncStatus({ ok: false, text: "Couldn’t reach the cloud. Your work is still saved in this browser — try again shortly." });
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setCloudSyncStatus(null), 6000);
    }
  };

  // Real numbers for the data tab
  const library = useMemo(() => {
    const projects = storage.getProjects();
    let words = 0;
    let characters = 0;
    let locations = 0;
    projects.forEach((p) => {
      words += p.currentWords || 0;
      const d = storage.getProjectData(p.id);
      characters += d?.characters?.length || 0;
      locations += d?.locations?.length || 0;
    });
    return { books: projects.length, words, characters, locations };
  }, [dataVersion]);

  const handleExportData = () => {
    const projects = storage.getProjects();
    const fullBackup: Record<string, any> = {
      profile: storage.getUserProfile(),
      projects,
      projectData: {},
      exportedAt: new Date().toISOString(),
    };
    projects.forEach((p) => {
      fullBackup.projectData[p.id] = storage.getProjectData(p.id);
    });
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocean_novel_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const plan = profile.plan || "free";
  const current = PLAN_INFO[plan] || PLAN_INFO.free;
  const next = plan === "free" ? PLAN_INFO.pro : plan === "pro" ? PLAN_INFO.master : null;
  const initial = (profile.penName || firebaseUser?.displayName || profile.name || "A").trim().charAt(0).toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F5EE] text-[#0E1D26] font-['Outfit'] custom-scrollbar">
      {/* Header */}
      <div className="border-b border-[#E9E2D4]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-8 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>Account</p>
            <h1 className="mt-2 text-[34px] lg:text-[40px] font-extrabold leading-none tracking-[-0.02em]">Settings</h1>
            <p className="mt-2 text-[14px] text-[#0E1D26]/55">Your pen name, editor defaults, plan and backups.</p>
          </div>
          <button
            onClick={() => navigate(projectId ? `/project/${projectId}` : "/dashboard")}
            className="self-start sm:self-auto h-10 px-4 rounded-full border border-[#E9E2D4] hover:bg-[#EFE9DE] text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {projectId ? "Back to book" : "Back to bookshelf"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 grid lg:grid-cols-[200px_1fr] gap-6 lg:gap-10">
        {/* Section nav */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "shrink-0 text-left px-4 py-2.5 rounded-2xl transition-colors cursor-pointer",
                activeTab === t.id ? "bg-white shadow-[0_1px_2px_rgba(14,29,38,0.06)] ring-1 ring-[#E9E2D4]" : "hover:bg-[#EFE9DE]/70"
              )}
            >
              <span className={cn("block text-[14px]", activeTab === t.id ? "font-bold" : "font-semibold text-[#0E1D26]/70")}>{t.label}</span>
              <span className="hidden lg:block text-[12px] text-[#0E1D26]/45">{t.hint}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          {saveStatus && (
            <div className="h-10 px-4 rounded-full bg-white border border-[#E9E2D4] text-[13px] font-semibold inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-[#2F7A4F]" /> {saveStatus}
            </div>
          )}

          {/* PROFILE */}
          {activeTab === "profile" && (
            <>
              <section className={card}>
                <p className={eyebrow}>Account</p>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="w-12 h-12 rounded-full bg-[#0E1D26] text-[#F6F1E7] flex items-center justify-center text-[18px] font-bold shrink-0">{initial}</span>
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold truncate">{firebaseUser?.displayName || profile.penName || profile.name || "Author"}</p>
                      <p className="text-[13px] text-[#0E1D26]/55 truncate">{accountEmail || "Not signed in"}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 h-6 px-2.5 rounded-full text-[11px] font-semibold flex items-center",
                        isSignedIn ? "bg-[#2F7A4F]/10 text-[#2F7A4F]" : "bg-[#F0B54B]/20 text-[#8A5A12]"
                      )}
                    >
                      {isSignedIn ? "Signed in" : "Guest"}
                    </span>
                  </div>
                  {isSignedIn ? (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="self-start sm:self-auto h-10 px-4 rounded-full border border-[#E9E2D4] hover:border-[#B3261E]/40 hover:text-[#B3261E] text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="self-start sm:self-auto h-10 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" /> Sign in
                    </button>
                  )}
                </div>
              </section>

              <form onSubmit={handleSaveProfile} className={card}>
                <p className={eyebrow}>Author</p>
                <p className="mt-1 text-[13px] text-[#0E1D26]/55">Your pen name and bio fill the title page and About the Author when you export.</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={fieldLabel}>Name</label>
                    <input value={profile.name || ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Jane Smith" className={fieldInput} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Pen name</label>
                    <input value={profile.penName || ""} onChange={(e) => setProfile({ ...profile, penName: e.target.value })} placeholder="J. S. Hawthorne" className={fieldInput} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={fieldLabel}>Bio</label>
                  <textarea
                    rows={4}
                    value={profile.bio || ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="A few lines about you, in your own words."
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E9E2D4] text-[14px] leading-relaxed placeholder:text-[#0E1D26]/35 focus:outline-none focus:border-[#0E1D26]/40 resize-none"
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button type="submit" className="h-10 px-5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold cursor-pointer transition-colors">
                    Save profile
                  </button>
                </div>
              </form>
            </>
          )}

          {/* WRITING PREFERENCES */}
          {activeTab === "preferences" && (
            <form onSubmit={handleSavePreferences} className="space-y-5">
              <section className={card}>
                <p className={eyebrow}>Editor</p>
                <p className="mt-1 text-[13px] text-[#0E1D26]/55">How text looks in the Writing Studio. You can still change it per session from the Aa button.</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className={fieldLabel}>Typeface</p>
                    <Segmented
                      value={editorFamily}
                      options={[["font-serif", "Serif", "font-serif"], ["font-sans", "Sans", "font-sans"], ["font-mono", "Mono", "font-mono"]]}
                      onChange={(v) => setProfile((p) => ({ ...p, defaultFont: v === "font-sans" ? "Sans" : v === "font-mono" ? "Mono" : "Serif" }))}
                    />
                  </div>
                  <div>
                    <p className={fieldLabel}>Size</p>
                    <Segmented
                      value={editorSize}
                      options={[["text-base", "S"], ["text-lg", "M"], ["text-xl", "L"], ["text-2xl", "XL"]]}
                      onChange={(v) =>
                        setProfile((p) => ({ ...p, fontSize: v === "text-base" ? "Small" : v === "text-xl" ? "Large" : v === "text-2xl" ? "Extra Large" : "Medium" }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#FBF9F4] border border-[#EFE9DE] px-5 py-4">
                  <p className={cn(editorFamily, editorSize, "leading-[1.8] text-[#1D2A31]")}>
                    The fog came before the ships, and with it the old bell began to ring.
                  </p>
                </div>
              </section>

              <section className={card}>
                <p className={eyebrow}>Story defaults</p>
                <p className="mt-1 text-[13px] text-[#0E1D26]/55">Used by the AI Prompt Hub when a book’s Story Bible doesn’t set its own.</p>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={fieldLabel}>Point of view</label>
                    <input value={profile.defaultPov || ""} onChange={(e) => setProfile({ ...profile, defaultPov: e.target.value })} placeholder="Third person limited" className={fieldInput} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Tone</label>
                    <input value={profile.defaultTone || ""} onChange={(e) => setProfile({ ...profile, defaultTone: e.target.value })} placeholder="Atmospheric, suspenseful" className={fieldInput} />
                  </div>
                </div>
                <p className="mt-5 text-[12px] text-[#0E1D26]/45">The Studio saves your writing automatically a moment after you stop typing.</p>
                <div className="mt-6 flex justify-end">
                  <button type="submit" className="h-10 px-5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold cursor-pointer transition-colors">
                    Save preferences
                  </button>
                </div>
              </section>
            </form>
          )}

          {/* PLAN */}
          {activeTab === "billing" && (
            <>
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={eyebrow}>Your plan</p>
                    <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.01em]">{current.name}</h2>
                    <p className="mt-1 text-[13px] text-[#0E1D26]/55">
                      {plan === "master" ? "Lifetime licence · every feature unlocked." : "Lifetime licence for this edition."}
                      {accountEmail ? ` Linked to ${accountEmail}.` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-7 px-3 rounded-full bg-[#2F7A4F]/10 text-[#2F7A4F] text-[12px] font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => navigate("/admin")}
                        className="h-8 px-3 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Admin
                      </button>
                    )}
                  </div>
                </div>
                <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {current.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-[#0E1D26]/80">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#2F7A4F]" /> {f}
                    </li>
                  ))}
                </ul>
              </section>

              {next && (
                <section className="rounded-3xl bg-[#0E1D26] text-[#F6F1E7] p-6 sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F6F1E7]/50">Next step</p>
                  <h3 className="mt-2 text-[22px] font-extrabold tracking-[-0.01em]">{next.name}</h3>
                  <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {next.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px] text-[#F6F1E7]/80">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#F0B54B] shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => openSalesPage(plan === "pro" ? "premium" : "pro")}
                    className="mt-6 h-10 pl-4 pr-1.5 rounded-full bg-[#E8561F] hover:bg-[#D44B17] text-white text-[13px] font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    Upgrade to {next.name}
                    <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </section>
              )}
            </>
          )}

          {/* DATA */}
          {activeTab === "data" && (
            <>
              <section className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={eyebrow}>Cloud sync</p>
                    <p className="mt-2 text-[15px] font-semibold">
                      {isSignedIn ? "Your books sync to your account" : "Stored in this browser only"}
                    </p>
                    <p className="mt-1 text-[13px] text-[#0E1D26]/55">
                      {isSignedIn
                        ? "Changes are saved in this browser and sent to the cloud as you work. Use Sync now after working offline."
                        : "Sign in to keep your books safe in the cloud and open them on other devices."}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "h-6 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5",
                      isSignedIn ? "bg-[#2F7A4F]/10 text-[#2F7A4F]" : "bg-[#F0B54B]/20 text-[#8A5A12]"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", isSignedIn ? "bg-[#2F7A4F]" : "bg-[#B7791F]")} />
                    {isSignedIn ? "Connected" : "Offline"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    [library.books, library.books === 1 ? "Book" : "Books"],
                    [library.words, "Words"],
                    [library.characters, "Characters"],
                    [library.locations, "Places"],
                  ].map(([n, label]) => (
                    <div key={label as string} className="rounded-2xl bg-[#FBF9F4] border border-[#EFE9DE] px-4 py-3">
                      <p className="text-[20px] font-extrabold tabular-nums">{Number(n).toLocaleString()}</p>
                      <p className="text-[12px] text-[#0E1D26]/50">{label}</p>
                    </div>
                  ))}
                </div>

                {cloudSyncStatus && (
                  <p className={cn("mt-4 text-[13px] flex items-center gap-2", cloudSyncStatus.ok ? "text-[#2F7A4F]" : "text-[#8A5A12]")}>
                    {cloudSyncStatus.ok && <Check className="w-4 h-4" />} {cloudSyncStatus.text}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  {isSignedIn ? (
                    <button
                      onClick={handleSyncCloudNow}
                      disabled={isSyncingCloud}
                      className="h-10 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={cn("w-4 h-4", isSyncingCloud && "animate-spin")} />
                      {isSyncingCloud ? "Syncing…" : "Sync now"}
                    </button>
                  ) : (
                    <button onClick={() => navigate("/login")} className="h-10 px-4 rounded-full bg-[#0E1D26] text-[#F6F1E7] text-[13px] font-semibold flex items-center gap-2 cursor-pointer">
                      <LogIn className="w-4 h-4" /> Sign in
                    </button>
                  )}
                </div>
              </section>

              <section className={card}>
                <p className={eyebrow}>Backup</p>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-semibold">Download everything as one file</p>
                    <p className="mt-1 text-[13px] text-[#0E1D26]/55">All books, chapters, characters, places, notes and your profile, as JSON.</p>
                  </div>
                  <button
                    onClick={handleExportData}
                    className="shrink-0 h-10 px-4 rounded-full border border-[#E9E2D4] hover:bg-[#EFE9DE] text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download backup
                  </button>
                </div>
                <p className="mt-5 pt-4 border-t border-[#F1ECE2] text-[12px] text-[#0E1D26]/50">
                  To publish a book as EPUB, Word or plain text, open the book and use <strong className="font-semibold text-[#0E1D26]/70">Export</strong> on its Overview page.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

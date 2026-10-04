import { ManuscriptItem, MOCK_MANUSCRIPT, MOCK_CHARACTERS, MOCK_LOCATIONS } from "@/mockData";
import { db, auth } from './firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, limit, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { isUserAdmin } from './adminService';
import { externalizePictures, internalizePictures, rememberPictures } from './imageStore';
import { setCloudSave, getCloudSave } from './saveStatus';
import { getLocalBook, setLocalBook, deleteLocalBook } from './localBooks';

export interface ProjectMeta {
  id: string;
  title: string;
  author: string;
  genre: string;
  audience: string;
  logline: string;
  wordGoal: number;
  currentWords: number;
  lastModified: number;
  themeColor: string;
  coverUrl?: string;
  userId?: string;
  /** When the book's content was last saved to the cloud (matches ProjectData.savedAt) */
  dataSavedAt?: number;
}

export interface StoryBibleData {
  title?: string;
  genre?: string;
  subgenre?: string;
  targetAudience?: string;
  pov?: string;
  tone?: string;
  premise?: string;
  mainConflict?: string;
  storyGoal?: string;
  themes?: string;
  timePeriod?: string;
  primarySetting?: string;
  worldDescription?: string;
  importantRules?: string;
  narrativeStyle?: string;
  dialogueStyle?: string;
  pacing?: string;
  aiInstructions?: string;
}

export interface AuthorTimelineSettings {
  streakMode: 'auto' | 'custom';
  customStreakDays: number;
  timeMode: 'auto' | 'custom';
  customHours: number;
  customMinutes: number;
  activeDates?: string[];
  totalWritingMinutesTracked?: number;
}

const defaultTimelineSettings: AuthorTimelineSettings = {
  streakMode: 'auto',
  customStreakDays: 1,
  timeMode: 'auto',
  customHours: 0,
  customMinutes: 0,
  activeDates: [],
  totalWritingMinutesTracked: 0,
};

import { LicensePlan, planFromRegistration } from './license';

export interface UserProfile {
  name: string;
  penName: string;
  email: string;
  bio: string;
  avatarUrl?: string;
  plan: LicensePlan;
  defaultFont: string;
  fontSize: string;
  defaultPov: string;
  defaultTone: string;
  theme: 'light' | 'dark' | 'system';
}

export interface FrontBackMatterData {
  subtitle?: string;
  publisher?: string;
  edition?: string;
  copyrightYear?: string;
  copyrightOwner?: string;
  isbn?: string;
  asin?: string;
  disclaimerText?: string;
  dedication?: string;
  acknowledgmentsText?: string;
  authorPenName?: string;
  authorBioText?: string;
  authorWebsiteOrNewsletter?: string;
  includeReviewRequest?: boolean;
  reviewCtaHeading?: string;
  reviewCtaText?: string;
}

export interface ProjectData {
  id?: string;
  /** Set on every cloud save; lets a device skip downloading a book it already has */
  savedAt?: number;
  manuscript: ManuscriptItem[];
  characters: any[];
  locations: any[];
  characterGraphs?: Array<{ id: string; name: string; nodes: any[]; edges: any[] }>;
  locationMap?: {
    nodes: Array<{ id: string; x: number; y: number }>;
    edges: Array<{ id: string; source: string; target: string; label: string }>;
    unmapped?: any[];
  };
  notes?: Record<string, string>;
  generalNotes?: string;
  lastActiveSceneId?: string;
  lastActiveSceneTitle?: string;
  storyBible?: StoryBibleData;
  plotEvents?: any[];
  plotArcs?: any[];
  frontBackMatter?: FrontBackMatterData;
  userId?: string;
}

export interface StudioTask {
  id: string;
  projectId?: string;
  title: string;
  type: 'writing' | 'editing' | 'worldbuilding' | 'research';
  completed: boolean;
  urgency: 'low' | 'medium' | 'high';
  createdAt: number;
  userId?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOfflineOrUnavailable =
    errMsg.includes('unavailable') ||
    errMsg.includes('could not reach') ||
    errMsg.includes('offline') ||
    errMsg.includes('network');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isOfflineOrUnavailable) {
    console.warn('[Firestore Offline Buffer]: Client is operating in resilient offline/local mode.', errMsg);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
}

let currentUserId: string | null = null;

/**
 * Returns a user-scoped localStorage key to completely isolate data between different user accounts.
 */
function getStorageKey(suffix: string, uid = currentUserId): string {
  if (uid && uid !== 'null' && uid !== 'undefined') {
    return `ocean_novelist_u_${uid}_${suffix}`;
  }
  return `ocean_novelist_guest_${suffix}`;
}

/**
 * Safe wrapper for localStorage.setItem with automatic QuotaExceededError recovery.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014 ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    if (isQuota) {
      console.warn(`[Ocean Novel Storage] QuotaExceededError writing "${key}". Initiating auto-recovery...`);
      try {
        // Clear non-critical entries to free space
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key && !k.endsWith('_profile')) {
            const itemVal = localStorage.getItem(k);
            if (itemVal && itemVal.length > 200000) {
              keysToRemove.push(k);
            }
          }
        }
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k); } catch {}
        });

        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function createDefaultProfile(email?: string | null, name?: string | null): UserProfile {
  const cleanName = name || (email ? email.split('@')[0] : "Author");
  const cleanEmail = email || "author@oceannovel.app";
  const isAdmin = isUserAdmin(cleanEmail);
  return {
    name: cleanName,
    penName: cleanName,
    email: cleanEmail,
    bio: isAdmin ? "Master Administrator & Novel Architect at Ocean Novel." : "Author & Novel Architect at Ocean Novel.",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    plan: isAdmin ? "master" : "free",
    defaultFont: "Merriweather (Serif)",
    fontSize: "Medium (18px)",
    defaultPov: "Third Person Limited",
    defaultTone: "Suspenseful",
    theme: "light",
  };
}

const DEFAULT_TASKS: StudioTask[] = [
  {
    id: 'task-1',
    title: 'Draft Chapter 1 opening hook and sensory details',
    type: 'writing',
    completed: false,
    urgency: 'high',
    createdAt: Date.now() - 3600000 * 24,
  }
];

// Per-User In-Memory Caches
let cachedProjects: ProjectMeta[] = [];
let cachedProjectData: Record<string, ProjectData> = {};
let cachedTasks: StudioTask[] = [];
let cachedProfile: UserProfile | null = null;
let syncInFlight: { uid: string; promise: Promise<void> } | null = null;
let lastCloudSync: { uid: string; at: number } | null = null;

function loadLocalUserCache(uid: string | null) {
  try {
    const pRaw = localStorage.getItem(getStorageKey('projects', uid));
    cachedProjects = pRaw ? JSON.parse(pRaw) : [];
  } catch {
    cachedProjects = [];
  }

  try {
    const tRaw = localStorage.getItem(getStorageKey('tasks', uid));
    cachedTasks = tRaw ? JSON.parse(tRaw) : DEFAULT_TASKS;
  } catch {
    cachedTasks = DEFAULT_TASKS;
  }

  try {
    const profRaw = localStorage.getItem(getStorageKey('profile', uid));
    cachedProfile = profRaw ? JSON.parse(profRaw) : null;
    if (cachedProfile) {
      const userEmail = auth.currentUser?.email || cachedProfile.email;
      if (isUserAdmin(userEmail)) {
        cachedProfile.plan = 'master';
      }
    }
  } catch {
    cachedProfile = null;
  }

  cachedProjectData = {};
  localBooksReady = loadLocalBooks(uid).catch(() => {});
}

/**
 * Strips undefined properties and deeply prepares objects for error-free Firestore document insertion.
 */
function cleanForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

// Firestore rejects documents over 1 MiB; leave headroom for field overhead
const MAX_BOOK_BYTES = 1_000_000;
class BookTooLargeError extends Error {
  constructor(public bytes: number) {
    super(`Book document is ${bytes} bytes, over the Firestore limit`);
  }
}

/**
 * Writes a book to the cloud: the content document and its shelf entry together, stamped with the
 * same savedAt so other devices can tell whether their copy is current. Pictures are stored as
 * their own documents (see imageStore).
 */
async function writeBookToCloud(uid: string, id: string, data: ProjectData, meta?: ProjectMeta | null): Promise<number> {
  const savedAt = Date.now();
  const slim = await externalizePictures(uid, id, cleanForFirestore({ ...data, userId: uid, id, savedAt }));
  const bytes = new Blob([JSON.stringify(slim)]).size;
  if (bytes > MAX_BOOK_BYTES) throw new BookTooLargeError(bytes);
  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}/projectData/${id}`), slim);
  if (meta) batch.set(doc(db, `users/${uid}/projects/${id}`), cleanForFirestore({ ...meta, userId: uid, dataSavedAt: savedAt }), { merge: true });
  await batch.commit();
  return savedAt;
}

/* ---- What this device knows about each book's cloud copy ---- */
interface BookSync {
  savedAt?: number; // savedAt of the last version this device saved or downloaded
  dirty?: boolean; // edited here since then, not yet in the cloud
}
function readBookSync(uid: string): Record<string, BookSync> {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey('booksync', uid)) || '{}');
  } catch {
    return {};
  }
}
function getBookSync(uid: string, id: string): BookSync {
  return readBookSync(uid)[id] || {};
}
function setBookSync(uid: string, id: string, patch: BookSync | null) {
  const all = readBookSync(uid);
  if (patch) all[id] = { ...all[id], ...patch };
  else delete all[id];
  safeLocalStorageSet(getStorageKey('booksync', uid), JSON.stringify(all));
}

/*
 * Cloud saves are batched. Every edit is kept on this device at once; the cloud gets the newest
 * version at most every CLOUD_SAVE_INTERVAL per book (the first save after a quiet spell goes out
 * straight away), plus immediately when the tab is hidden or closed. Typing used to cost one cloud
 * write per pause, which burns through Firestore quota and money.
 */
const CLOUD_SAVE_INTERVAL = 10_000;
const bookWrites: Record<string, { uid: string; pending: boolean; running: boolean; timer: ReturnType<typeof setTimeout> | null; lastStart: number }> = {};

function queueBookWrite(uid: string, id: string) {
  const q = (bookWrites[id] ||= { uid, pending: false, running: false, timer: null, lastStart: 0 });
  q.uid = uid;
  q.pending = true;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  setCloudSave(id, { state: offline ? 'offline' : 'saving' });
  scheduleBookWrite(id, false);
}

function scheduleBookWrite(id: string, now: boolean) {
  const q = bookWrites[id];
  if (!q || q.running || !q.pending) return;
  const wait = now ? 0 : Math.max(0, q.lastStart + CLOUD_SAVE_INTERVAL - Date.now());
  if (q.timer) {
    if (!now) return;
    clearTimeout(q.timer);
  }
  q.timer = setTimeout(() => {
    q.timer = null;
    void runBookWrite(id);
  }, wait);
}

async function runBookWrite(id: string) {
  const q = bookWrites[id];
  if (!q || q.running || !q.pending) return;
  // Signed out or switched account since the edit: that account's copy stays on its device
  if (q.uid !== currentUserId) {
    q.pending = false;
    return;
  }
  q.running = true;
  q.pending = false;
  q.lastStart = Date.now();
  const uid = q.uid;
  try {
    const data = cachedProjectData[id];
    if (data) {
      const savedAt = await writeBookToCloud(uid, id, data, cachedProjects.find((p) => p.id === id));
      if (cachedProjectData[id]) cachedProjectData[id].savedAt = savedAt;
      setBookSync(uid, id, q.pending ? { savedAt } : { savedAt, dirty: false });
    }
    if (!q.pending) setCloudSave(id, { state: 'saved' });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${uid}/projectData/${id}`);
    if (!q.pending) {
      setCloudSave(id, {
        state: 'error',
        message:
          e instanceof BookTooLargeError
            ? 'This book has grown too large to save to the cloud in one piece.'
            : 'Your latest changes could not be saved to the cloud.',
      });
    }
  } finally {
    q.running = false;
  }
  if (q.pending) scheduleBookWrite(id, typeof document !== 'undefined' && document.visibilityState === 'hidden');
}

/** Sends every waiting book to the cloud now. */
function flushBookWrites() {
  Object.keys(bookWrites).forEach((id) => scheduleBookWrite(id, true));
}

function hasUnsavedBooks() {
  return Object.keys(bookWrites).some((id) => bookWrites[id].pending || bookWrites[id].running || getCloudSave(id).state === 'error');
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBookWrites();
  });
  window.addEventListener('pagehide', flushBookWrites);
  window.addEventListener('online', flushBookWrites);
  // Closing the tab mid-save: send now and ask the browser to hold the page
  window.addEventListener('beforeunload', (e) => {
    if (!hasUnsavedBooks()) return;
    flushBookWrites();
    e.preventDefault();
    e.returnValue = '';
  });
}

/* ---- On-device books ---- */
let localBooksReady: Promise<void> = Promise.resolve();

/** Loads this account's books from the device into memory (moving old localStorage copies into IndexedDB). */
async function loadLocalBooks(uid: string | null) {
  const ids = cachedProjects.map((p) => p.id);
  await Promise.all(
    ids.map(async (id) => {
      if (cachedProjectData[id]) return;
      const key = getStorageKey(`data_${id}`, uid);
      const book = await getLocalBook<ProjectData>(key);
      if (book && uid === currentUserId && !cachedProjectData[id]) {
        cachedProjectData[id] = book;
        if (localStorage.getItem(key)) void setLocalBook(key, book);
      }
    })
  );
}

function canSyncWithFirestore(targetUserId?: string | null): boolean {
  const uid = targetUserId || currentUserId;
  const user = auth.currentUser;
  return Boolean(
    user &&
    !user.isAnonymous &&
    uid &&
    uid !== 'null' &&
    uid !== 'undefined' &&
    user.uid === uid
  );
}

/**
 * Creates starter sample fantasy novels specifically assigned to the newly created/logged-in user.
 */
function createStarterProjectsForUser(userId: string): { meta: ProjectMeta; data: ProjectData }[] {
  return [
    {
      meta: {
        id: `book-silent-harbor-${userId.slice(0, 6)}`,
        title: "The Silent Harbor",
        author: "Sarah Cole",
        genre: "Gothic Coast Fantasy",
        audience: "Adult",
        logline: "An investigator returns to an isolated coastal town haunted by drowned gods and the fifteen-year-old mystery of her sister's disappearance.",
        wordGoal: 75000,
        currentWords: 18450,
        lastModified: Date.now() - 3600000 * 2,
        themeColor: "bg-[#2a1a14]",
        userId,
      },
      data: {
        manuscript: MOCK_MANUSCRIPT,
        characters: MOCK_CHARACTERS,
        locations: MOCK_LOCATIONS,
        userId,
        storyBible: {
          title: "The Silent Harbor",
          genre: "Gothic Coast Fantasy",
          subgenre: "Occult Mystery",
          targetAudience: "Adult",
          pov: "Third Person Limited",
          tone: "Melancholic, tense, atmospheric",
          premise: "An occult investigator unearths ancient drowned deities lurking under her hometown.",
          mainConflict: "Uncovering the truth of the sister's sacrifice while the town's secret society hunts her.",
          worldDescription: "Cold, wind-battered coastlines lined with jagged obsidian cliffs and drowned sunken ruins.",
          importantRules: "The Tide mirrors the heartbeat of the Sunken God; blood spilled on wet stone cannot be washed away by rainwater.",
          narrativeStyle: "Lyrical prose with sensory focus on damp brine, creaking timber, and creeping shadows."
        }
      }
    },
    {
      meta: {
        id: `book-sunken-crown-${userId.slice(0, 6)}`,
        title: "The Sunken Crown of Eldoria",
        author: "Valen Hawke",
        genre: "Epic High Fantasy",
        audience: "Young Adult / New Adult",
        logline: "When the Dragon Emperor perishes without an heir, an outcast solar knight and an exiled elven sorceress journey into the volcanic abyss to claim the mythical Sunken Crown.",
        wordGoal: 95000,
        currentWords: 31200,
        lastModified: Date.now() - 3600000 * 5,
        themeColor: "bg-[#3e1f17]",
        userId,
      },
      data: {
        manuscript: [
          {
            id: `sc-part-1-${userId.slice(0, 4)}`,
            type: "part",
            title: "Part I: The Shattered Altar",
            children: [
              {
                id: `sc-ch-1-${userId.slice(0, 4)}`,
                type: "chapter",
                title: "Chapter 1: Ashes of the Dragon Throne",
                children: [
                  {
                    id: `sc-scene-1-${userId.slice(0, 4)}`,
                    type: "scene",
                    title: "The Obsidian Citadel",
                    content: `<p>The imperial throne room was choked with the smell of sulfur and scorched bronze. Above the shattered basalt dais, the Dragon Emperor's obsidian crown hung in midair, bathed in violet flames that refused to die.</p><p>Valen tightened his grip on the hilt of his sun-forged broadsword. The embers whispered to him in the archaic tongue of the Wyrm Lords—a promise of dominion, and a curse of blood.</p>`
                  }
                ]
              }
            ]
          }
        ],
        characters: [
          {
            id: "1",
            name: "Valen Hawke",
            role: "Protagonist",
            description: "Disgraced Knight of the Solar Order carrying the cursed sun-forged blade.",
            age: "26",
            motivation: "To redeem his fallen lineage and shatter the volcanic seal.",
            locationId: "1",
            traits: ["HONORABLE", "TORMENTED", "FEARLESS"],
            imageUrl: "https://res.cloudinary.com/mekoxs1q/image/upload/v1790564449/fantasy_08_under_100kb_mkojix.jpg",
            backstory: "Exiled from the High Citadel after refusing to execute civilian sympathizers."
          }
        ],
        locations: MOCK_LOCATIONS,
        userId,
        storyBible: {
          title: "The Sunken Crown of Eldoria",
          genre: "Epic High Fantasy",
          targetAudience: "Young Adult / New Adult",
          pov: "Third Person Multi-POV",
          tone: "Heroic, grim, high-stakes",
          premise: "An outcast knight and an elven sorceress brave volcanic depths for an emperor's relic.",
          mainConflict: "Claiming the Crown before the necromantic dragon warlord conquers Eldoria.",
          worldDescription: "A fractured realm of floating obsidian citadels and molten magma rivers.",
          narrativeStyle: "Epic, grand, sweeping scale with poetic description of elemental sorcery."
        }
      }
    }
  ];
}

export const storage = {
  getCurrentUserId: () => currentUserId,

  /**
   * Switch the active user context. Completely isolates and reloads the cache.
   */
  switchUser: (userId: string | null, email?: string | null, displayName?: string | null) => {
    currentUserId = userId && userId !== 'null' ? userId : null;
    loadLocalUserCache(currentUserId);

    if (currentUserId && !cachedProfile) {
      cachedProfile = createDefaultProfile(email, displayName);
      safeLocalStorageSet(getStorageKey('profile', currentUserId), JSON.stringify(cachedProfile));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { userId: currentUserId } }));
    }
  },

  setCurrentUserId: (userId: string | null) => {
    storage.switchUser(userId);
  },

  clearCache: () => {
    currentUserId = null;
    syncInFlight = null;
    lastCloudSync = null;
    cachedProjects = [];
    cachedProjectData = {};
    cachedTasks = [];
    cachedProfile = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { userId: null } }));
    }
  },

  syncAllLocalDataToCloud: async (userId?: string) => {
    const effectiveUid = userId || currentUserId;
    if (!effectiveUid || !auth.currentUser || !canSyncWithFirestore(effectiveUid)) {
      return false;
    }

    try {
      // 1. Profile
      const prof = storage.getUserProfile();
      await setDoc(doc(db, `users/${effectiveUid}/profile/default`), cleanForFirestore(prof), { merge: true });

      // 2. Projects & ProjectData (for this user only)
      const projs = storage.getProjects();
      for (const p of projs) {
        const pData = storage.getProjectData(p.id);
        if (pData) {
          const savedAt = await writeBookToCloud(effectiveUid, p.id, pData, p);
          setBookSync(effectiveUid, p.id, { savedAt, dirty: false });
        } else {
          await setDoc(doc(db, `users/${effectiveUid}/projects/${p.id}`), cleanForFirestore({ ...p, userId: effectiveUid }), { merge: true });
        }
      }

      // 3. Tasks
      const ts = storage.getTasks();
      for (const t of ts) {
        const tWithUser = cleanForFirestore({ ...t, userId: effectiveUid });
        await setDoc(doc(db, `users/${effectiveUid}/tasks/${t.id}`), tWithUser, { merge: true });
      }

      // 4. Timeline Settings
      const tl = storage.getTimelineSettings();
      await setDoc(doc(db, `users/${effectiveUid}/settings/timeline`), cleanForFirestore(tl), { merge: true });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('novelist-cloud-synced', {
          detail: { success: true, timestamp: Date.now(), userId: effectiveUid, email: prof.email }
        }));
      }

      return true;
    } catch (e) {
      console.warn("Could not sync all to cloud directly", e);
      handleFirestoreError(e, OperationType.WRITE, `users/${effectiveUid}`);
      return false;
    }
  },

  initAutoSync: () => {
    try {
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user && !user.isAnonymous) {
          storage.switchUser(user.uid, user.email, user.displayName);
          await storage.syncFromCloud(user.uid);
        } else if (!user) {
          storage.clearCache();
        }
      });
    } catch (err) {
      console.warn('Init auto-sync listener error:', err);
    }
  },

  /** Resolves once this account's books on the device are loaded into memory. */
  whenLocalReady: (): Promise<void> => localBooksReady,

  syncFromCloud: (userId: string, options?: { force?: boolean }): Promise<void> => {
    if (!userId || userId === 'null') return Promise.resolve();
    if (syncInFlight && syncInFlight.uid === userId) return syncInFlight.promise;
    if (!options?.force && lastCloudSync && lastCloudSync.uid === userId && Date.now() - lastCloudSync.at < 60_000) {
      return Promise.resolve();
    }
    const promise = storage._syncFromCloudOnce(userId).finally(() => {
      lastCloudSync = { uid: userId, at: Date.now() };
      if (syncInFlight?.promise === promise) syncInFlight = null;
    });
    syncInFlight = { uid: userId, promise };
    return promise;
  },

  _syncFromCloudOnce: async (userId: string) => {
    if (!userId || userId === 'null') return;
    if (!canSyncWithFirestore(userId)) return;
    // Books already on this device decide what needs downloading
    await localBooksReady;

    currentUserId = userId;

    try {
      // Sections are independent reads, so they run in parallel
      await Promise.all([
      (async () => {
      // 1. Load Profile from Cloud with authoritative CRM Tier sync
      try {
        const currentUser = auth.currentUser;
        const userEmail = currentUser?.email || "";
        const isAdmin = isUserAdmin(userEmail);

        let authoritativePlan: LicensePlan = isAdmin ? 'master' : 'free';
        let regData: any = null;

        // Check CRM registeredUsers record by userId, or fallback query by email
        try {
          const regDoc = await getDoc(doc(db, `registeredUsers/${userId}`));
          if (regDoc.exists()) {
            regData = regDoc.data();
          } else if (userEmail) {
            const q = query(collection(db, "registeredUsers"), where("email", "==", userEmail.toLowerCase().trim()), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              regData = snap.docs[0].data();
            }
          }

          if (isAdmin) {
            authoritativePlan = 'master';
          } else if (regData) {
            authoritativePlan = planFromRegistration(regData);
          }
        } catch (crmErr) {
          console.warn("Could not read CRM registeredUsers for plan sync:", crmErr);
        }

        const profileDoc = await getDoc(doc(db, `users/${userId}/profile/default`));
        if (profileDoc.exists()) {
          const loadedProfile = profileDoc.data() as UserProfile;
          // The profile doc is user-writable, so its `plan` is never trusted — only registeredUsers.tier is.
          cachedProfile = {
            ...loadedProfile,
            plan: authoritativePlan,
          };
          safeLocalStorageSet(getStorageKey('profile', userId), JSON.stringify(cachedProfile));
          // If the cloud profile had a stale plan, update it with the authoritative plan
          if (loadedProfile.plan !== authoritativePlan) {
            await setDoc(doc(db, `users/${userId}/profile/default`), cleanForFirestore(cachedProfile), { merge: true });
          }
        } else {
          // Initialize fresh profile for this user from Firebase Auth
          cachedProfile = createDefaultProfile(userEmail, currentUser?.displayName);
          cachedProfile.plan = authoritativePlan;
          safeLocalStorageSet(getStorageKey('profile', userId), JSON.stringify(cachedProfile));
          await setDoc(doc(db, `users/${userId}/profile/default`), cleanForFirestore(cachedProfile));
        }
      } catch(e) {
        handleFirestoreError(e, OperationType.GET, `users/${userId}/profile/default`);
      }
      })(),
      (async () => {
      // 2. Load Timeline Settings
      try {
        const tlDoc = await getDoc(doc(db, `users/${userId}/settings/timeline`));
        if (tlDoc.exists()) {
          const cloudTl = tlDoc.data() as AuthorTimelineSettings;
          safeLocalStorageSet(getStorageKey('timeline', userId), JSON.stringify(cloudTl));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('novelist-timeline-updated', { detail: cloudTl }));
          }
        }
      } catch(e) {
        handleFirestoreError(e, OperationType.GET, `users/${userId}/settings/timeline`);
      }
      })(),
      (async () => {
      // 3. Load Projects from Cloud (100% User Isolated)
      try {
        const projSnapshot = await getDocs(collection(db, `users/${userId}/projects`));

        if (projSnapshot.empty) {
          // Brand new user on Cloud: check if local scoped cache has projects
          if (!cachedProjects || cachedProjects.length === 0) {
            // Seed starter projects specifically for this user
            const starters = createStarterProjectsForUser(userId);
            cachedProjects = starters.map(s => s.meta);
            safeLocalStorageSet(getStorageKey('projects', userId), JSON.stringify(cachedProjects));

            for (const s of starters) {
              cachedProjectData[s.meta.id] = s.data;
              void setLocalBook(getStorageKey(`data_${s.meta.id}`, userId), s.data);
              const savedAt = await writeBookToCloud(userId, s.meta.id, s.data, s.meta);
              setBookSync(userId, s.meta.id, { savedAt, dirty: false });
            }
          } else {
            // Upload current user's local projects
            for (const p of cachedProjects) {
              const pData = storage.getProjectData(p.id);
              if (pData) {
                const savedAt = await writeBookToCloud(userId, p.id, pData, p);
                setBookSync(userId, p.id, { savedAt, dirty: false });
              } else {
                await setDoc(doc(db, `users/${userId}/projects/${p.id}`), cleanForFirestore({ ...p, userId }));
              }
            }
          }
        } else {
          // User has projects in Firestore: populate user cache from Firestore
          const busy = (id: string) => Boolean(bookWrites[id] && (bookWrites[id].pending || bookWrites[id].running));
          const cloudProjects: ProjectMeta[] = [];
          projSnapshot.docs.forEach(d => {
            const meta = { ...d.data(), id: d.id } as ProjectMeta;
            // A book being saved from this device keeps its local shelf entry
            const local = busy(d.id) ? cachedProjects.find(p => p.id === d.id) : null;
            cloudProjects.push(local || meta);
          });
          cachedProjects = cloudProjects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
          safeLocalStorageSet(getStorageKey('projects', userId), JSON.stringify(cachedProjects));

          // Download only the books whose cloud copy differs from the one on this device
          await Promise.all(projSnapshot.docs.map(async d => {
            const id = d.id;
            const cloudSavedAt = (d.data() as ProjectMeta).dataSavedAt;
            const local = cachedProjectData[id];
            const sync = getBookSync(userId, id);
            if (busy(id)) return;
            if (local && cloudSavedAt && sync.savedAt === cloudSavedAt) {
              // Same version as the cloud; edits made here offline still need sending
              if (sync.dirty) queueBookWrite(userId, id);
              return;
            }
            if (local && sync.dirty && (!cloudSavedAt || (sync.savedAt || 0) >= cloudSavedAt)) {
              // Unsent edits from this device are the newest version
              queueBookWrite(userId, id);
              return;
            }
            try {
              const snap = await getDoc(doc(db, `users/${userId}/projectData/${id}`));
              if (!snap.exists()) {
                if (local) queueBookWrite(userId, id);
                return;
              }
              if (local && sync.dirty) {
                // Another device saved a newer version over unsent edits here: keep a copy of ours
                void setLocalBook(getStorageKey(`backup_${id}_${Date.now()}`, userId), local);
              }
              // Pictures already on this device don't need downloading again
              if (local) await rememberPictures(local);
              const cloudPData = await internalizePictures(userId, snap.data() as ProjectData);
              if (busy(id)) return;
              cachedProjectData[id] = cloudPData;
              void setLocalBook(getStorageKey(`data_${id}`, userId), cloudPData);
              setBookSync(userId, id, { savedAt: cloudPData.savedAt || cloudSavedAt, dirty: false });
            } catch (e) {
              handleFirestoreError(e, OperationType.GET, `users/${userId}/projectData/${id}`);
            }
          }));
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { userId } }));
        }
      } catch(e) {
        handleFirestoreError(e, OperationType.LIST, `users/${userId}/projects`);
      }
      })(),
      (async () => {
      // 4. Load Tasks from Cloud
      try {
        const taskSnapshot = await getDocs(collection(db, `users/${userId}/tasks`));
        if (!taskSnapshot.empty) {
          const cloudTasks: StudioTask[] = [];
          taskSnapshot.docs.forEach(d => {
            cloudTasks.push({ ...d.data(), id: d.id } as StudioTask);
          });
          cachedTasks = cloudTasks;
          safeLocalStorageSet(getStorageKey('tasks', userId), JSON.stringify(cachedTasks));
        }
      } catch(e) {
        handleFirestoreError(e, OperationType.LIST, `users/${userId}/tasks`);
      }
      })(),
      ]);
    } catch (e) {
      console.error("Critical Cloud Sync Error:", e);
    }
  },

  getTasks: (projectId?: string): StudioTask[] => {
    if (!cachedTasks) return [];
    if (projectId) {
      return cachedTasks.filter((t) => !t.projectId || t.projectId === projectId);
    }
    return cachedTasks;
  },

  saveTask: (task: StudioTask) => {
    const taskWithUser = { ...task, userId: currentUserId || undefined };
    const existingIndex = cachedTasks.findIndex((t) => t.id === task.id);
    if (existingIndex >= 0) {
      cachedTasks[existingIndex] = taskWithUser;
    } else {
      cachedTasks.unshift(taskWithUser);
    }

    safeLocalStorageSet(getStorageKey('tasks'), JSON.stringify(cachedTasks));
    if (canSyncWithFirestore()) {
      setDoc(doc(db, `users/${currentUserId}/tasks/${task.id}`), cleanForFirestore(taskWithUser))
        .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/tasks/${task.id}`));
    }
  },

  deleteTask: (taskId: string) => {
    cachedTasks = cachedTasks.filter((t) => t.id !== taskId);
    safeLocalStorageSet(getStorageKey('tasks'), JSON.stringify(cachedTasks));
    if (canSyncWithFirestore()) {
      deleteDoc(doc(db, `users/${currentUserId}/tasks/${taskId}`))
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${currentUserId}/tasks/${taskId}`));
    }
  },

  saveAllTasks: (tasks: StudioTask[]) => {
    cachedTasks = tasks.map(t => ({ ...t, userId: currentUserId || undefined }));
    safeLocalStorageSet(getStorageKey('tasks'), JSON.stringify(cachedTasks));
    if (canSyncWithFirestore()) {
      cachedTasks.forEach(task => {
        setDoc(doc(db, `users/${currentUserId}/tasks/${task.id}`), cleanForFirestore(task))
          .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/tasks/${task.id}`));
      });
    }
  },

  getProjects: (): ProjectMeta[] => {
    return cachedProjects || [];
  },

  saveProject: (project: ProjectMeta) => {
    const sanitizedProject: ProjectMeta = { ...project, userId: currentUserId || project.userId };
    if (sanitizedProject.coverUrl && sanitizedProject.coverUrl.startsWith('data:') && sanitizedProject.coverUrl.length > 80000) {
      sanitizedProject.coverUrl = "https://res.cloudinary.com/mekoxs1q/image/upload/v1788788313/7e1e3f9e-023d-4556-a04c-e0d633ba4cea_rcjcwh.png";
    }

    const existingIndex = cachedProjects.findIndex(p => p.id === sanitizedProject.id);
    if (existingIndex >= 0) {
      cachedProjects[existingIndex] = sanitizedProject;
    } else {
      cachedProjects.push(sanitizedProject);
    }

    safeLocalStorageSet(getStorageKey('projects'), JSON.stringify(cachedProjects));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { projectId: sanitizedProject.id } }));
    }
    if (canSyncWithFirestore()) {
      setDoc(doc(db, `users/${currentUserId}/projects/${sanitizedProject.id}`), cleanForFirestore(sanitizedProject))
        .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/projects/${sanitizedProject.id}`));
    }
  },

  updateProject: (id: string, updates: Partial<ProjectMeta>) => {
    const existingIndex = cachedProjects.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.coverUrl && sanitizedUpdates.coverUrl.startsWith('data:') && sanitizedUpdates.coverUrl.length > 80000) {
        sanitizedUpdates.coverUrl = "https://res.cloudinary.com/mekoxs1q/image/upload/v1788788313/7e1e3f9e-023d-4556-a04c-e0d633ba4cea_rcjcwh.png";
      }
      cachedProjects[existingIndex] = { ...cachedProjects[existingIndex], ...sanitizedUpdates };
      safeLocalStorageSet(getStorageKey('projects'), JSON.stringify(cachedProjects));
      if (canSyncWithFirestore()) {
        setDoc(doc(db, `users/${currentUserId}/projects/${id}`), cleanForFirestore(cachedProjects[existingIndex]), { merge: true })
          .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/projects/${id}`));
      }
    }
  },

  deleteProject: (id: string) => {
    cachedProjects = cachedProjects.filter(p => p.id !== id);
    delete cachedProjectData[id];
    safeLocalStorageSet(getStorageKey('projects'), JSON.stringify(cachedProjects));
    void deleteLocalBook(getStorageKey(`data_${id}`));
    if (bookWrites[id]) {
      if (bookWrites[id].timer) clearTimeout(bookWrites[id].timer!);
      delete bookWrites[id];
    }
    if (currentUserId) setBookSync(currentUserId, id, null);
    setCloudSave(id, { state: 'saved' });
    if (canSyncWithFirestore()) {
      deleteDoc(doc(db, `users/${currentUserId}/projects/${id}`))
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${currentUserId}/projects/${id}`));
      deleteDoc(doc(db, `users/${currentUserId}/projectData/${id}`))
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${currentUserId}/projectData/${id}`));
    }
  },

  getProjectData: (id: string): ProjectData | null => {
    if (cachedProjectData[id]) return cachedProjectData[id];

    try {
      const data = localStorage.getItem(getStorageKey(`data_${id}`));
      if (data) {
        const parsed = JSON.parse(data);
        cachedProjectData[id] = parsed;
        return parsed;
      }
    } catch { return null; }

    return null;
  },

  saveProjectData: (id: string, data: Partial<ProjectData>) => {
    const existing = storage.getProjectData(id) || { manuscript: [], characters: [], locations: [] };
    const newData: ProjectData = { ...existing, ...data, id, userId: currentUserId || existing.userId };
    cachedProjectData[id] = newData;
    void setLocalBook(getStorageKey(`data_${id}`), newData);
    if (currentUserId) setBookSync(currentUserId, id, { dirty: true });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { projectId: id } }));
    }

    const project = cachedProjects.find(p => p.id === id);
    if (project) {
      project.lastModified = Date.now();
      if (data.manuscript) {
        let totalWords = 0;
        const countWords = (items: ManuscriptItem[]) => {
          for (const item of items) {
            if (item.type === 'scene' && item.content) {
              const plainText = item.content.replace(/<[^>]*>?/gm, ' ');
              const words = plainText.trim().split(/\s+/).filter(w => w.length > 0).length;
              totalWords += words;
            }
            if (item.children) {
              countWords(item.children);
            }
          }
        };
        countWords(data.manuscript);
        project.currentWords = totalWords;
      }
      // The shelf entry goes to the cloud together with the book (see writeBookToCloud)
      safeLocalStorageSet(getStorageKey('projects'), JSON.stringify(cachedProjects));
    }

    if (canSyncWithFirestore() && currentUserId) {
      queueBookWrite(currentUserId, id);
    }
  },

  /** Tries the cloud save of a book again (after a failed save). */
  retryCloudSave: (id: string) => {
    const data = storage.getProjectData(id);
    if (data && currentUserId && canSyncWithFirestore()) {
      queueBookWrite(currentUserId, id);
      scheduleBookWrite(id, true);
    }
  },

  getUserProfile: (): UserProfile => {
    const currentUser = auth.currentUser;
    const isAdmin = isUserAdmin(currentUser?.email);

    if (cachedProfile) {
      if (isAdmin && cachedProfile.plan !== 'master') {
        cachedProfile.plan = 'master';
      }
      return cachedProfile;
    }
    const fallback = createDefaultProfile(currentUser?.email, currentUser?.displayName);
    cachedProfile = fallback;
    return fallback;
  },

  saveUserProfile: (profile: Partial<UserProfile>, forcePlan = false): UserProfile => {
    const current = cachedProfile || storage.getUserProfile();
    const currentUser = auth.currentUser;
    const isAdmin = isUserAdmin(currentUser?.email || current.email);

    let targetPlan = current.plan;
    if (profile.plan !== undefined) {
      if (isAdmin || forcePlan) {
        targetPlan = profile.plan;
      } else {
        targetPlan = current.plan;
      }
    }
    if (isAdmin && !profile.plan && targetPlan !== 'master') {
      targetPlan = 'master';
    }

    const updated: UserProfile = {
      ...current,
      ...profile,
      plan: targetPlan,
    };
    cachedProfile = updated;
    safeLocalStorageSet(getStorageKey('profile'), JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-storage-updated', { detail: { profile: updated } }));
    }
    if (canSyncWithFirestore()) {
      setDoc(doc(db, `users/${currentUserId}/profile/default`), cleanForFirestore(updated))
        .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/profile/default`));
    }
    return updated;
  },

  getTimelineSettings: (): AuthorTimelineSettings => {
    try {
      const stored = localStorage.getItem(getStorageKey('timeline'));
      return stored ? { ...defaultTimelineSettings, ...JSON.parse(stored) } : defaultTimelineSettings;
    } catch {
      return defaultTimelineSettings;
    }
  },

  saveTimelineSettings: (settings: Partial<AuthorTimelineSettings>): AuthorTimelineSettings => {
    const current = storage.getTimelineSettings();
    const updated = { ...current, ...settings };
    try {
      safeLocalStorageSet(getStorageKey('timeline'), JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('novelist-timeline-updated', { detail: updated }));
      }
      if (canSyncWithFirestore()) {
        setDoc(doc(db, `users/${currentUserId}/settings/timeline`), cleanForFirestore(updated), { merge: true })
          .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUserId}/settings/timeline`));
      }
    } catch (e) {
      console.error("Error saving timeline settings", e);
    }
    return updated;
  },

  calculateTimelineStreak: (projects: ProjectMeta[]): number => {
    const today = new Date().toISOString().slice(0, 10);
    const dateSet = new Set<string>();
    dateSet.add(today);

    (projects || []).forEach(p => {
      if (p.lastModified) {
        try {
          const d = new Date(p.lastModified).toISOString().slice(0, 10);
          dateSet.add(d);
        } catch { /* ignore */ }
      }
    });

    const settings = storage.getTimelineSettings();
    if (settings.activeDates) {
      settings.activeDates.forEach(d => dateSet.add(d));
    }

    const sortedDates = Array.from(dateSet).sort().reverse();
    if (sortedDates.length === 0) return 1;

    let streak = 0;
    const checkDate = new Date();

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (dateSet.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        if (i === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = checkDate.toISOString().slice(0, 10);
          if (dateSet.has(yesterdayStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    return Math.max(1, streak);
  }
};

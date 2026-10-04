/**
 * On-device copy of each book, kept in IndexedDB.
 * localStorage holds only ~5 MB per site, which a few books with pictures used to fill,
 * after which nothing more was cached. IndexedDB has far more room and stores objects directly.
 * Falls back to localStorage where IndexedDB isn't available (some private windows).
 */
const DB_NAME = "ocean-novel";
const STORE = "books";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return reject(new Error("no-idb"));
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function getLocalBook<T = any>(key: string): Promise<T | null> {
  try {
    const v = await run<T>("readonly", (s) => s.get(key));
    if (v !== undefined && v !== null) return v;
  } catch {}
  // Older versions (and the no-IndexedDB fallback) kept books in localStorage
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setLocalBook(key: string, value: unknown): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(value, key));
    // Moved into IndexedDB: free the old localStorage copy
    try {
      localStorage.removeItem(key);
    } catch {}
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[local books] could not keep a copy on this device", e);
    }
  }
}

export async function deleteLocalBook(key: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(key));
  } catch {}
  try {
    localStorage.removeItem(key);
  } catch {}
}

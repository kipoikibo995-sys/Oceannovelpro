import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Keeps pictures out of the book document.
 * Firestore caps a document at 1 MiB, and a book used to carry every portrait, place and cover
 * picture inline as base64, so a dozen uploads could make the whole book fail to save.
 * Before a book is written, each large inline picture is stored once in users/{uid}/images/{id}
 * (id = hash of the picture) and replaced by "oimg:{id}". When a book is read back, the
 * references are swapped for the pictures again, so the rest of the app only ever sees data URLs.
 */
const PREFIX = "oimg:";
// Small inline images (icons, the blank portrait) stay in the book
const MIN_INLINE = 4000;

const pictures = new Map<string, string>(); // id -> data URL
const idOf = new Map<string, string>(); // data URL -> id
const uploaded = new Set<string>(); // "uid/id"
let uploadedLoadedFor: string | null = null;

const uploadedKey = (uid: string) => `ocean_imgs_${uid}`;
function loadUploaded(uid: string) {
  if (uploadedLoadedFor === uid) return;
  uploadedLoadedFor = uid;
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(uploadedKey(uid)) || "[]");
    ids.forEach((id) => uploaded.add(`${uid}/${id}`));
  } catch {}
}
function rememberUploaded(uid: string, id: string) {
  uploaded.add(`${uid}/${id}`);
  try {
    const ids = [...uploaded].filter((k) => k.startsWith(uid + "/")).map((k) => k.slice(uid.length + 1));
    localStorage.setItem(uploadedKey(uid), JSON.stringify(ids));
  } catch {}
}

async function pictureId(dataUrl: string): Promise<string> {
  const known = idOf.get(dataUrl);
  if (known) return known;
  let id: string;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
    id = [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // No WebCrypto (very old browser or insecure context): FNV-1a is enough to tell pictures apart
    let h = 0x811c9dc5;
    for (let i = 0; i < dataUrl.length; i++) h = Math.imul(h ^ dataUrl.charCodeAt(i), 0x01000193);
    id = (h >>> 0).toString(16) + dataUrl.length.toString(16);
  }
  idOf.set(dataUrl, id);
  pictures.set(id, dataUrl);
  return id;
}

const isInlinePicture = (v: unknown): v is string =>
  typeof v === "string" && v.length >= MIN_INLINE && v.startsWith("data:image/");

function walk(node: any, visit: (value: string, set: (v: string) => void) => void) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => (typeof v === "string" ? visit(v, (nv) => (node[i] = nv)) : walk(v, visit)));
  } else if (node && typeof node === "object") {
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (typeof v === "string") visit(v, (nv) => (node[k] = nv));
      else walk(v, visit);
    });
  }
}

/** Learn the pictures already on this device, so reading a book back doesn't download them again. */
export async function rememberPictures(data: unknown) {
  const found: string[] = [];
  walk(data, (v) => isInlinePicture(v) && found.push(v));
  await Promise.all(found.map(pictureId));
}

/** Uploads the book's pictures (once each) and returns the data with references instead. Mutates `data`. */
export async function externalizePictures<T>(uid: string, projectId: string, data: T): Promise<T> {
  loadUploaded(uid);
  const jobs: Promise<void>[] = [];
  walk(data, (v, set) => {
    if (!isInlinePicture(v)) return;
    jobs.push(
      pictureId(v).then(async (id) => {
        if (!uploaded.has(`${uid}/${id}`)) {
          await setDoc(doc(db, `users/${uid}/images/${id}`), { data: v, projectId, size: v.length, createdAt: Date.now() });
          rememberUploaded(uid, id);
        }
        set(PREFIX + id);
      })
    );
  });
  await Promise.all(jobs);
  return data;
}

/** Swaps picture references back for the pictures. Missing pictures become "". Mutates `data`. */
export async function internalizePictures<T>(uid: string, data: T): Promise<T> {
  const refs: { id: string; set: (v: string) => void }[] = [];
  walk(data, (v, set) => {
    if (v.startsWith(PREFIX)) refs.push({ id: v.slice(PREFIX.length), set });
  });
  const missing = [...new Set(refs.map((r) => r.id).filter((id) => !pictures.has(id)))];
  await Promise.all(
    missing.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, `users/${uid}/images/${id}`));
        const value = snap.exists() ? (snap.data().data as string) : "";
        if (value) {
          pictures.set(id, value);
          idOf.set(value, id);
          rememberUploaded(uid, id);
        }
      } catch (e) {
        console.warn("[images] could not load picture", id, e);
      }
    })
  );
  refs.forEach((r) => r.set(pictures.get(r.id) || ""));
  return data;
}

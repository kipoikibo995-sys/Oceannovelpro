import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Suppress transient offline reconnection logs in console
setLogLevel('error');

// Long polling used to be forced for the AI Studio preview iframe; on a normal host it only adds
// latency. Let the SDK stream and fall back to long polling only behind proxies that need it.
try {
  initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  // Instance may already be initialized in HMR or reloads
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// A sign-in lasts for this tab only: reloading keeps it, closing the tab signs out.
// Setting it here also moves sessions saved by older builds out of permanent storage.
export const authReady = setPersistence(auth, browserSessionPersistence).catch((e) =>
  console.warn('Auth persistence note:', e)
);

// WarriorPlus IPN processing on the server (Vercel function) with the Firebase Admin SDK.
// The Admin SDK bypasses Firestore rules, which is exactly why this must only run on the server
// and only after the WarriorPlus security key has been checked.

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createHash, timingSafeEqual } from 'node:crypto';

export type Tier = 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';

const PROJECT_ID = 'oceannovel';
const DATABASE_ID = 'ai-studio-novelist-fca8c749-967d-46b4-9714-a261746c3222';
const TIER_RANK: Record<Tier, number> = { Free: 0, FrontEnd: 1, OTO1: 2, OTO2: 3 };
const DEFAULT_PRICE: Record<Tier, string> = { Free: '$0.00', FrontEnd: '$27.00', OTO1: '$47.00', OTO2: '$67.00' };

export interface IpnResult {
  status: 'upgraded' | 'pending' | 'refunded' | 'duplicate' | 'ignored';
  email: string;
  tier: Tier;
  txnId: string;
  message: string;
}

export class IpnError extends Error {
  constructor(public httpStatus: number, message: string) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Firebase Admin                                                      */
/* ------------------------------------------------------------------ */

let cachedDb: Firestore | null = null;

// FIREBASE_SERVICE_ACCOUNT holds the service-account JSON (raw or base64-encoded)
function adminDb(): Firestore {
  if (cachedDb) return cachedDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new IpnError(500, 'Server not configured: FIREBASE_SERVICE_ACCOUNT is missing.');
  let json: any;
  try {
    json = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new IpnError(500, 'Server not configured: FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }
  if (typeof json.private_key === 'string') json.private_key = json.private_key.replace(/\\n/g, '\n');
  const app: App =
    getApps()[0] ||
    initializeApp({ credential: cert(json), projectId: json.project_id || PROJECT_ID });
  cachedDb = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || DATABASE_ID);
  return cachedDb;
}

/* ------------------------------------------------------------------ */
/* Payload helpers                                                     */
/* ------------------------------------------------------------------ */

const listEnv = (name: string) =>
  (process.env[name] || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// Product → tier. Item numbers configured in Vercel win; names are matched on whole words only
// (the old substring match turned "product" into Pro and "email" into the AI tier).
export function mapProductToTier(itemName = '', itemNumber = ''): Tier {
  const num = itemNumber.trim().toLowerCase();
  if (num) {
    if (listEnv('WPLUS_ITEMS_PREMIUM').includes(num)) return 'OTO2';
    if (listEnv('WPLUS_ITEMS_PRO').includes(num)) return 'OTO1';
    if (listEnv('WPLUS_ITEMS_FRONTEND').includes(num)) return 'FrontEnd';
  }
  const name = ` ${itemName.toLowerCase()} `;
  if (/\b(premium|oto\s*-?\s*2|ghostwriter)\b/.test(name)) return 'OTO2';
  if (/\b(pro|oto\s*-?\s*1|unlimited)\b/.test(name)) return 'OTO1';
  return 'FrontEnd';
}

// Firestore rules only accept claim ids made of these characters
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

function highestTier(history: any[]): Tier {
  let best: Tier = 'Free';
  for (const p of history) {
    if (p?.refunded) continue;
    const t = p?.tier as Tier;
    if (t in TIER_RANK && TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}

// Constant-time comparison so the key cannot be guessed from response timing
function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

export async function processWarriorPlusIpn(body: Record<string, any>): Promise<IpnResult> {
  const expectedKey = (process.env.WARRIORPLUS_SECURITY_KEY || '').trim();
  // Without a key anyone could POST a fake sale and unlock a plan, so refuse to run at all
  if (!expectedKey) throw new IpnError(500, 'Server not configured: WARRIORPLUS_SECURITY_KEY is missing.');
  if (!sameSecret(String(body.WP_SECURITYKEY || '').trim(), expectedKey)) throw new IpnError(401, 'Invalid security key.');

  const action = String(body.WP_ACTION || 'sale').toLowerCase().trim();
  const email = String(body.WP_BUYER_EMAIL || '').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new IpnError(400, 'Missing or malformed WP_BUYER_EMAIL.');

  const itemName = String(body.WP_ITEM_NAME || 'Ocean Novel Studio');
  const itemNumber = String(body.WP_ITEM_NUMBER || '');
  const txnId = String(body.WP_TXNID || body.WP_SALEID || '').trim();
  if (!txnId) throw new IpnError(400, 'Missing WP_TXNID.');
  const tier = mapProductToTier(itemName, itemNumber);
  const gross = parseFloat(String(body.WP_PAYMENT_GROSS || body.WP_SALE_AMOUNT || ''));
  const amount = Number.isFinite(gross) && gross > 0 ? `$${gross.toFixed(2)}` : DEFAULT_PRICE[tier];

  const db = adminDb();

  if (action === 'refund' || action === 'chargeback' || action === 'cancel' || action === 'reversal') {
    return refund(db, email, txnId);
  }
  if (action !== 'sale' && action !== 'subscr_payment' && action !== 'subscr_created') {
    return { status: 'ignored', email, tier, txnId, message: `Ignored WP_ACTION "${action}".` };
  }
  return sale(db, email, String(body.WP_BUYER_NAME || ''), itemName, tier, amount, txnId);
}

async function sale(db: Firestore, email: string, buyerName: string, itemName: string, tier: Tier, amount: string, txnId: string): Promise<IpnResult> {
  const users = await db.collection('registeredUsers').where('email', '==', email).limit(1).get();

  if (!users.empty) {
    const ref = users.docs[0].ref;
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() || {};
      const history: any[] = Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [];
      // WarriorPlus retries notifications; the same transaction must never be applied twice
      if (history.some((p) => p?.txnId === txnId)) {
        return { status: 'duplicate' as const, email, tier: (data.tier as Tier) || 'Free', txnId, message: 'Transaction already applied.' };
      }
      const nextHistory = [...history, { id: `wplus_${safeId(txnId)}`, productItem: itemName, tier, amount, date: Date.now(), txnId }];
      const current = (data.tier as Tier) || 'Free';
      const finalTier = TIER_RANK[tier] > TIER_RANK[current] ? tier : current;
      tx.update(ref, { tier: finalTier, purchaseHistory: nextHistory, lastActive: Date.now() });
      return { status: 'upgraded' as const, email, tier: finalTier, txnId, message: `Account ${email} is now ${finalTier}.` };
    });
  }

  // No account yet: park the purchase; it is claimed automatically on the buyer's first verified sign-in.
  // Keyed by transaction id, so a retried notification overwrites instead of duplicating.
  const pendingId = `wp_${safeId(txnId)}`;
  await db.collection('ipnPendingPurchases').doc(pendingId).set({
    id: pendingId,
    buyerEmail: email,
    buyerName,
    productItem: itemName,
    tier,
    amount,
    dateReceived: Date.now(),
    txnId,
  });
  return { status: 'pending', email, tier, txnId, message: `No account for ${email} yet; purchase queued until first sign-in.` };
}

async function refund(db: Firestore, email: string, txnId: string): Promise<IpnResult> {
  // Remove any unclaimed purchase for this transaction
  const pending = await db.collection('ipnPendingPurchases').where('buyerEmail', '==', email).get();
  const batch = db.batch();
  let removedPending = 0;
  pending.docs.forEach((d) => {
    if (d.data().txnId === txnId) {
      batch.delete(d.ref);
      removedPending++;
    }
  });
  if (removedPending) await batch.commit();

  const users = await db.collection('registeredUsers').where('email', '==', email).limit(1).get();
  if (users.empty) {
    return { status: 'refunded', email, tier: 'Free', txnId, message: `Refund for ${email}: removed ${removedPending} pending purchase(s).` };
  }

  const ref = users.docs[0].ref;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const history: any[] = Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [];
    const nextHistory = history.map((p) => (p?.txnId === txnId ? { ...p, refunded: true, refundedAt: Date.now() } : p));
    const matched = history.some((p) => p?.txnId === txnId);
    // Only the refunded product is taken away; other purchases (and admin grants) keep their tier
    const finalTier = matched ? highestTier(nextHistory) : ((data.tier as Tier) || 'Free');
    tx.update(ref, { tier: finalTier, purchaseHistory: nextHistory });
    return {
      status: 'refunded' as const,
      email,
      tier: finalTier,
      txnId,
      message: matched ? `Refund applied; ${email} is now ${finalTier}.` : `Refund for unknown transaction ${txnId}; tier unchanged.`,
    };
  });
}

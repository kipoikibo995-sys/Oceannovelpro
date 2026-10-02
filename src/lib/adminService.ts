import { db, auth } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

export const ADMIN_EMAIL = "kojiacademy2026@gmail.com";

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

export interface PurchaseRecord {
  id: string;
  productItem: string;
  tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';
  amount: string;
  date: number;
  txnId: string;
}

export interface RegisteredUser {
  uid: string;
  email: string;
  displayName: string;
  tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';
  isBanned: boolean;
  lastActive: number;
  createdAt: number;
  purchaseHistory?: PurchaseRecord[];
  lastClaimedPendingId?: string;
}

export interface IpnPendingPurchase {
  id: string;
  buyerEmail: string;
  productItem: string;
  tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';
  amount: string;
  dateReceived: number;
  txnId: string;
}

export const adminService = {
  /**
   * Tracks user activity and syncs real account state to registeredUsers collection in Firestore.
   * Special grant for kojiacademy2026@gmail.com as the primary Administrator.
   */
  trackUserActivity: async (user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }): Promise<{ isBanned: boolean; matchedPurchases: number; hasAccess: boolean | null }> => {
    if (!user.uid) return { isBanned: false, matchedPurchases: 0, hasAccess: null };

    const cleanEmail = (user.email || "").toLowerCase().trim();
    const isAdmin = isUserAdmin(cleanEmail);

    try {
      const userDocRef = doc(db, "registeredUsers", user.uid);
      const userSnap = await getDoc(userDocRef);

      let isBanned = false;
      // New sign-ups start without access; a WarriorPlus purchase (or an admin) raises the tier
      let currentTier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2' = isAdmin ? "OTO2" : "Free";
      let history: PurchaseRecord[] = [];

      const displayName = user.displayName || (isAdmin ? "Koji Academy Admin" : cleanEmail.split("@")[0] || "Author");

      if (userSnap.exists()) {
        const data = userSnap.data() as RegisteredUser;
        isBanned = isAdmin ? false : Boolean(data.isBanned);
        currentTier = isAdmin ? "OTO2" : (data.tier || "Free");
        history = Array.isArray(data.purchaseHistory) ? data.purchaseHistory : [];

        await updateDoc(userDocRef, {
          lastActive: Date.now(),
          email: cleanEmail || data.email,
          displayName: displayName || data.displayName,
          tier: currentTier,
          isBanned,
        });
      } else {
        const newUser: RegisteredUser = {
          uid: user.uid,
          email: cleanEmail,
          displayName,
          tier: currentTier,
          isBanned: false,
          lastActive: Date.now(),
          createdAt: Date.now(),
          purchaseHistory: isAdmin
            ? [
                {
                  id: "admin_grant_init",
                  productItem: "Ocean Novel Studio - Master License",
                  tier: "OTO2",
                  amount: "Lifetime Access",
                  date: Date.now(),
                  txnId: "ADMIN-LIFETIME-PERM",
                },
              ]
            : [],
        };

        await setDoc(userDocRef, newUser);
      }

      // Check if this real email has any pending WarriorPlus IPN purchases waiting to be reconciled
      let matchedPurchases = 0;
      if (cleanEmail) {
        try {
          const pendingCol = collection(db, "ipnPendingPurchases");
          const q = query(pendingCol, where("buyerEmail", "==", cleanEmail));
          const snap = await getDocs(q);

          // Each claim is one atomic batch (upgrade + delete pending record) — Firestore rules
          // only accept a tier change when it is backed by a pending purchase deleted in the same batch.
          for (const docItem of snap.docs) {
            const pendingData = docItem.data() as IpnPendingPurchase;

            let nextTier = currentTier;
            if (pendingData.tier === "OTO2") {
              nextTier = "OTO2";
            } else if (pendingData.tier === "OTO1" && currentTier !== "OTO2") {
              nextTier = "OTO1";
            } else if (pendingData.tier === "FrontEnd" && currentTier === "Free") {
              nextTier = "FrontEnd";
            }

            const nextHistory: PurchaseRecord[] = [
              ...history,
              {
                id: "auto_" + docItem.id,
                productItem: pendingData.productItem,
                tier: pendingData.tier,
                amount: pendingData.amount || (pendingData.tier === "OTO2" ? "$97.00" : pendingData.tier === "OTO1" ? "$47.00" : "$17.00"),
                date: Date.now(),
                txnId: pendingData.txnId || "WP-AUTO-" + Date.now().toString(36).toUpperCase(),
              },
            ];

            const batch = writeBatch(db);
            batch.update(userDocRef, {
              tier: nextTier,
              purchaseHistory: nextHistory,
              lastClaimedPendingId: docItem.id,
            });
            batch.delete(docItem.ref);
            await batch.commit();

            currentTier = nextTier;
            history = nextHistory;
            matchedPurchases++;
          }
        } catch (reconcileErr) {
          console.warn("Real IPN auto-reconcile check notice:", reconcileErr);
        }
      }

      const hasAccess = isAdmin || currentTier !== "Free" || history.some((p: any) => p && !p.refunded);
      return { isBanned, matchedPurchases, hasAccess };
    } catch (err) {
      console.warn("trackUserActivity error:", err);
      return { isBanned: false, matchedPurchases: 0, hasAccess: null };
    }
  },

  /**
   * Check if specific UID is banned
   */
  isUserBanned: async (uid: string): Promise<boolean> => {
    try {
      const snap = await getDoc(doc(db, "registeredUsers", uid));
      if (snap.exists()) {
        return Boolean(snap.data()?.isBanned);
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Get all registered users from Firestore database
   */
  getAllUsers: async (): Promise<RegisteredUser[]> => {
    try {
      const colRef = collection(db, "registeredUsers");
      const snap = await getDocs(colRef);

      const users: RegisteredUser[] = [];
      snap.forEach((d) => {
        users.push({ ...d.data(), uid: d.id } as RegisteredUser);
      });

      // If current logged-in user isn't in Firestore yet, sync them right now
      const cur = auth.currentUser;
      if (cur && !users.some((u) => u.uid === cur.uid)) {
        const cleanEmail = (cur.email || "").toLowerCase().trim();
        const isAdmin = isUserAdmin(cleanEmail);
        const liveUser: RegisteredUser = {
          uid: cur.uid,
          email: cleanEmail,
          displayName: cur.displayName || (isAdmin ? "Koji Academy Admin" : "Author"),
          tier: isAdmin ? "OTO2" : "Free",
          isBanned: false,
          lastActive: Date.now(),
          createdAt: Date.now(),
          purchaseHistory: isAdmin
            ? [
                {
                  id: "admin_grant_init",
                  productItem: "Ocean Novel Studio - Master License",
                  tier: "OTO2",
                  amount: "Lifetime Access",
                  date: Date.now(),
                  txnId: "ADMIN-LIFETIME-PERM",
                },
              ]
            : [],
        };

        try {
          await setDoc(doc(db, "registeredUsers", cur.uid), liveUser);
          users.push(liveUser);
        } catch (e) {
          console.warn("Could not auto-write current user to CRM:", e);
        }
      }

      // Sort by lastActive descending
      return users.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    } catch (err) {
      console.warn("getAllUsers Firestore query notice:", err);
      return [];
    }
  },

  /**
   * Upgrade Tier for User in Firestore & sync to user profile
   */
  updateTier: async (uid: string, tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2'): Promise<void> => {
    const userDocRef = doc(db, "registeredUsers", uid);
    await updateDoc(userDocRef, { tier });

    // Sync authoritative plan to user profile document
    const planMap: Record<string, 'free' | 'pro' | 'master'> = {
      'OTO2': 'master',
      'OTO1': 'pro',
      'FrontEnd': 'free',
      'Free': 'free',
    };
    const newPlan = planMap[tier] || 'free';
    try {
      const userProfileRef = doc(db, `users/${uid}/profile/default`);
      const profSnap = await getDoc(userProfileRef);
      if (profSnap.exists()) {
        await updateDoc(userProfileRef, { plan: newPlan });
      } else {
        await setDoc(userProfileRef, { plan: newPlan }, { merge: true });
      }
    } catch (e) {
      console.warn("Could not sync updated plan to user profile doc:", e);
    }
  },

  /**
   * Ban or Unban User in Firestore
   */
  setUserBanned: async (uid: string, isBanned: boolean): Promise<void> => {
    const userDocRef = doc(db, "registeredUsers", uid);
    await updateDoc(userDocRef, { isBanned });
  },

  /**
   * Delete User Record from CRM
   */
  deleteUserRecord: async (uid: string): Promise<void> => {
    const userDocRef = doc(db, "registeredUsers", uid);
    await deleteDoc(userDocRef);
  },

  /**
   * Get Pending Purchases from Firestore
   */
  getPendingPurchases: async (): Promise<IpnPendingPurchase[]> => {
    try {
      const colRef = collection(db, "ipnPendingPurchases");
      const snap = await getDocs(colRef);

      const list: IpnPendingPurchase[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as IpnPendingPurchase);
      });

      return list.sort((a, b) => (b.dateReceived || 0) - (a.dateReceived || 0));
    } catch (err) {
      console.warn("getPendingPurchases error:", err);
      return [];
    }
  },

  /**
   * Delete Pending Purchase (e.g. Refunded order)
   */
  deletePendingPurchase: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, "ipnPendingPurchases", id));
  },

  /**
   * Simulate WarriorPlus IPN Webhook (License Tier Fulfillment without credits)
   */
  simulateIpnWebhook: async (payload: {
    buyerEmail: string;
    productItem: string;
    tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';
    amount?: string;
    txnId?: string;
  }): Promise<{ matchedUser: boolean; message: string; targetUser?: string }> => {
    const cleanEmail = payload.buyerEmail.toLowerCase().trim();
    const txnId = payload.txnId || "WP-TXN-" + Math.floor(100000 + Math.random() * 900000);
    const amount = payload.amount || (payload.tier === "OTO2" ? "$97.00" : payload.tier === "OTO1" ? "$47.00" : "$17.00");

    try {
      const usersCol = collection(db, "registeredUsers");
      const q = query(usersCol, where("email", "==", cleanEmail));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        // User account exists! Instantly upgrade license tier
        const userDoc = querySnap.docs[0];
        const userData = userDoc.data() as RegisteredUser;

        const newHistory: PurchaseRecord[] = [
          ...(userData.purchaseHistory || []),
          {
            id: "ipn_" + Date.now(),
            productItem: payload.productItem,
            tier: payload.tier,
            amount,
            date: Date.now(),
            txnId,
          },
        ];

        await updateDoc(userDoc.ref, {
          tier: payload.tier,
          purchaseHistory: newHistory,
        });

        return {
          matchedUser: true,
          targetUser: userData.displayName || cleanEmail,
          message: `IPN Reconciled: Matched user "${userData.displayName || cleanEmail}". Account license tier instantly unlocked to ${payload.tier}.`,
        };
      } else {
        // User has not registered yet. Store in Pending Purchases table in Firestore
        const pendId = "wp_pend_" + Date.now();
        const pendingItem: IpnPendingPurchase = {
          id: pendId,
          buyerEmail: cleanEmail,
          productItem: payload.productItem,
          tier: payload.tier,
          amount,
          dateReceived: Date.now(),
          txnId,
        };

        await setDoc(doc(db, "ipnPendingPurchases", pendId), pendingItem);

        return {
          matchedUser: false,
          message: `IPN Logged: Buyer "${cleanEmail}" does not have an account yet. Recorded in Pending Purchases. The ${payload.tier} license tier will automatically be granted when they register.`,
        };
      }
    } catch (err: any) {
      console.error("simulateIpnWebhook error:", err);
      throw new Error(err.message || "Failed to process simulated IPN webhook.");
    }
  },
};

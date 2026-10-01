import { db } from './firebase';
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
} from 'firebase/firestore';
import { RegisteredUser, IpnPendingPurchase, PurchaseRecord } from './adminService';

/**
 * Standard WarriorPlus IPN (Instant Payment Notification) Payload Structure
 * Documentation: https://warriorplus.com/account/ipn/docs
 */
export interface WarriorPlusIpnRawPayload {
  WP_ACTION?: string; // 'sale' | 'refund' | 'chargeback' | 'cancel'
  WP_SECURITYKEY?: string; // Vendor Verification Key set in WarriorPlus profile
  WP_ITEM_NAME?: string; // Name of the product (e.g. "Ocean Novel Studio - FrontEnd")
  WP_ITEM_NUMBER?: string; // Product Item ID in WarriorPlus
  WP_BUYER_NAME?: string; // Full name of buyer
  WP_BUYER_EMAIL?: string; // Buyer's email (used to bind license)
  WP_TXNID?: string; // WarriorPlus Transaction ID
  WP_PAYMENT_GROSS?: string; // Total paid e.g. "27.00"
  WP_AFF_ID?: string; // Affiliate ID who referred the sale
  WP_TIME?: string; // Timestamp
}

export interface IpnProcessResult {
  success: boolean;
  action: 'sale' | 'refund' | 'unknown';
  matchedUser: boolean;
  targetEmail: string;
  assignedTier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2';
  message: string;
  txnId: string;
}

/**
 * Maps WarriorPlus Item ID or Item Name to Ocean Novel Studio License Tier
 */
export function mapProductToTier(
  itemName: string = '',
  itemNumber: string = ''
): { tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2'; defaultPrice: string } {
  const combined = (itemName + ' ' + itemNumber).toLowerCase();

  if (combined.includes('premium') || combined.includes('oto2') || combined.includes('ai') || combined.includes('ghostwriter') || combined.includes('lore')) {
    return { tier: 'OTO2', defaultPrice: '$97.00' };
  }
  if (combined.includes('pro') || combined.includes('oto1') || combined.includes('unlimited')) {
    return { tier: 'OTO1', defaultPrice: '$47.00' };
  }
  return { tier: 'FrontEnd', defaultPrice: '$17.00' };
}

/**
 * Real Production WarriorPlus IPN Handler
 * Can be called by an Express API route, Firebase Cloud Function, or Next.js serverless route
 */
export async function handleWarriorPlusWebhook(
  rawBody: Record<string, string>,
  expectedSecurityKey?: string
): Promise<IpnProcessResult> {
  const action = (rawBody.WP_ACTION || 'sale').toLowerCase().trim();
  const incomingKey = rawBody.WP_SECURITYKEY || '';
  const buyerEmail = (rawBody.WP_BUYER_EMAIL || '').toLowerCase().trim();
  const buyerName = rawBody.WP_BUYER_NAME || buyerEmail.split('@')[0] || 'Author';
  const itemName = rawBody.WP_ITEM_NAME || 'Ocean Novel Studio';
  const itemNumber = rawBody.WP_ITEM_NUMBER || '';
  const txnId = rawBody.WP_TXNID || 'WP-' + Date.now().toString(36).toUpperCase();
  const rawGross = rawBody.WP_PAYMENT_GROSS ? `$${parseFloat(rawBody.WP_PAYMENT_GROSS).toFixed(2)}` : '';

  // 1. Security Key Validation (If configured)
  if (expectedSecurityKey && expectedSecurityKey.trim() !== '') {
    if (incomingKey !== expectedSecurityKey.trim()) {
      throw new Error(`Unauthorized: Security key mismatch. Expected valid WarriorPlus secret key.`);
    }
  }

  if (!buyerEmail || !buyerEmail.includes('@')) {
    throw new Error(`Invalid IPN: Missing or malformed WP_BUYER_EMAIL.`);
  }

  const { tier, defaultPrice } = mapProductToTier(itemName, itemNumber);
  const amount = rawGross || defaultPrice;

  // 2. Handle REFUND / CHARGEBACK
  if (action === 'refund' || action === 'chargeback' || action === 'cancel') {
    return await handleRefund(buyerEmail, txnId, itemName);
  }

  // 3. Handle SALE / UPGRADE
  return await handleSale(buyerEmail, buyerName, itemName, tier, amount, txnId);
}

/**
 * Fulfill a Sale event
 */
async function handleSale(
  buyerEmail: string,
  buyerName: string,
  itemName: string,
  tier: 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2',
  amount: string,
  txnId: string
): Promise<IpnProcessResult> {
  const usersCol = collection(db, 'registeredUsers');
  const q = query(usersCol, where('email', '==', buyerEmail));
  const snap = await getDocs(q);

  if (!snap.empty) {
    // User already has an account in Firestore!
    const userDoc = snap.docs[0];
    const userData = userDoc.data() as RegisteredUser;

    const existingHistory = Array.isArray(userData.purchaseHistory) ? userData.purchaseHistory : [];
    const newHistory: PurchaseRecord[] = [
      ...existingHistory,
      {
        id: 'wplus_' + Date.now(),
        productItem: itemName,
        tier,
        amount,
        date: Date.now(),
        txnId,
      },
    ];

    // Priority tier upgrade
    let finalTier = userData.tier || 'FrontEnd';
    if (tier === 'OTO2') {
      finalTier = 'OTO2';
    } else if (tier === 'OTO1' && finalTier !== 'OTO2') {
      finalTier = 'OTO1';
    } else if (tier === 'FrontEnd' && finalTier === 'Free') {
      finalTier = 'FrontEnd';
    }

    await updateDoc(userDoc.ref, {
      tier: finalTier,
      purchaseHistory: newHistory,
      lastActive: Date.now(),
    });

    return {
      success: true,
      action: 'sale',
      matchedUser: true,
      targetEmail: buyerEmail,
      assignedTier: finalTier,
      txnId,
      message: `IPN Success: Active user account "${userData.displayName || buyerEmail}" instantly upgraded to ${finalTier} tier.`,
    };
  } else {
    // User has not created an account yet.
    // Store in ipnPendingPurchases so that when they sign up, their tier is automatically assigned!
    const pendId = 'wp_pend_' + Date.now();
    const pendingItem: IpnPendingPurchase = {
      id: pendId,
      buyerEmail,
      productItem: itemName,
      tier,
      amount,
      dateReceived: Date.now(),
      txnId,
    };

    await setDoc(doc(db, 'ipnPendingPurchases', pendId), pendingItem);

    return {
      success: true,
      action: 'sale',
      matchedUser: false,
      targetEmail: buyerEmail,
      assignedTier: tier,
      txnId,
      message: `IPN Recorded: Buyer "${buyerEmail}" is queued in Pending Purchases ledger. Will auto-activate upon first login.`,
    };
  }
}

/**
 * Handle a Refund / Revocation event
 */
async function handleRefund(
  buyerEmail: string,
  txnId: string,
  itemName: string
): Promise<IpnProcessResult> {
  const usersCol = collection(db, 'registeredUsers');
  const q = query(usersCol, where('email', '==', buyerEmail));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const userDoc = snap.docs[0];
    const userData = userDoc.data() as RegisteredUser;

    // Downgrade user back to Free tier upon full refund
    await updateDoc(userDoc.ref, {
      tier: 'Free',
      isBanned: false,
    });

    return {
      success: true,
      action: 'refund',
      matchedUser: true,
      targetEmail: buyerEmail,
      assignedTier: 'Free',
      txnId,
      message: `IPN Refund Processed: License for "${buyerEmail}" downgraded to Free tier.`,
    };
  } else {
    // Check if in pending ledger and delete it
    const pendingCol = collection(db, 'ipnPendingPurchases');
    const pq = query(pendingCol, where('buyerEmail', '==', buyerEmail));
    const psnap = await getDocs(pq);
    for (const docItem of psnap.docs) {
      await deleteDoc(docItem.ref);
    }

    return {
      success: true,
      action: 'refund',
      matchedUser: false,
      targetEmail: buyerEmail,
      assignedTier: 'Free',
      txnId,
      message: `IPN Refund: Removed pending unmatched order for "${buyerEmail}".`,
    };
  }
}

// Ocean Novel License Tiers & Funnel Packages
// Regular: Author Edition ($17)
// Pro: Unlimited Studio Edition ($47)
// Premium: unlimited books + EPUB 3 + AI Prompt Hub & consistency tools ($97), without Pro's
// 50 ready-made characters / art library — offered to Pro buyers in the funnel.
// Pro and Premium are separate add-ons that stack: 'premium' = Premium without Pro,
// 'master' = Pro + Premium (and admins).

export type LicensePlan = 'free' | 'pro' | 'premium' | 'master' | 'commercial';

export interface PlanLimits {
  tierCode: 'REGULAR' | 'PRO' | 'PREMIUM' | 'COMMERCIAL' | 'FE' | 'OTO1' | 'OTO2';
  tierName: string;
  maxProjects: number;             // Regular: 3, Pro/Premium: unlimited
  maxCharactersPerProject: number;    // Regular: 25, Pro/Premium: unlimited
  maxLocationsPerProject: number;     // Regular: 15, Pro/Premium: unlimited
  hasImageLibrary: boolean;         // Regular: false, Pro+: true (50+ preset portraits & locations)
  hasEpub3Export: boolean;          // Regular: false, Pro+: true (Amazon KDP EPUB 3 export)
  hasAiGhostwriterHub: boolean;     // Regular/Pro: false, Premium: true (AI Prompt Hub & Ghostwriter generator)
  hasContinuityEngine: boolean;     // Regular/Pro: false, Premium: true (Deep Logic & Continuity Conflict Engine)
  hasCommercialKit: boolean;        // Commercial: true
}

export const PLAN_LIMITS: Record<LicensePlan, PlanLimits> = {
  free: {
    tierCode: 'REGULAR',
    tierName: 'Regular Edition',
    maxProjects: 3,
    maxCharactersPerProject: 25,
    maxLocationsPerProject: 15,
    hasImageLibrary: false,
    hasEpub3Export: false,
    hasAiGhostwriterHub: false,
    hasContinuityEngine: false,
    hasCommercialKit: false,
  },
  pro: {
    tierCode: 'PRO',
    tierName: 'Pro Edition',
    maxProjects: Infinity,
    maxCharactersPerProject: Infinity,
    maxLocationsPerProject: Infinity,
    hasImageLibrary: true,
    hasEpub3Export: true,
    hasAiGhostwriterHub: false,
    hasContinuityEngine: false,
    hasCommercialKit: false,
  },
  premium: {
    tierCode: 'PREMIUM',
    tierName: 'Premium Edition',
    maxProjects: Infinity,
    maxCharactersPerProject: Infinity,
    maxLocationsPerProject: Infinity,
    hasImageLibrary: false, // 50 ready-made characters + art library stay Pro-only
    hasEpub3Export: true,
    hasAiGhostwriterHub: true,
    hasContinuityEngine: true,
    hasCommercialKit: false,
  },
  master: {
    tierCode: 'PREMIUM',
    tierName: 'Premium Edition',
    maxProjects: Infinity,
    maxCharactersPerProject: Infinity,
    maxLocationsPerProject: Infinity,
    hasImageLibrary: true,
    hasEpub3Export: true,
    hasAiGhostwriterHub: true,
    hasContinuityEngine: true,
    hasCommercialKit: false,
  },
  commercial: {
    tierCode: 'COMMERCIAL',
    tierName: 'Agency & Commercial Enterprise',
    maxProjects: Infinity,
    maxCharactersPerProject: Infinity,
    maxLocationsPerProject: Infinity,
    hasImageLibrary: true,
    hasEpub3Export: true,
    hasAiGhostwriterHub: true,
    hasContinuityEngine: true,
    hasCommercialKit: true,
  },
};

export const FE_QUOTAS = {
  MAX_PROJECTS: 3,
  MAX_CHARACTERS_PER_PROJECT: 25,
  MAX_LOCATIONS_PER_PROJECT: 15,
};

export function tierToPlan(tier?: string | null): LicensePlan {
  if (!tier) return 'free';
  const clean = tier.trim().toUpperCase();
  if (clean === 'PREMIUM' || clean === 'OTO2' || clean === 'MASTER') return 'master';
  if (clean === 'PRO' || clean === 'OTO1') return 'pro';
  if (clean === 'COMMERCIAL') return 'commercial';
  return 'free';
}

// Premium purchases made before this moment were sold as "everything in Pro, plus…", so they keep Pro.
const PREMIUM_INCLUDES_PRO_BEFORE = Date.UTC(2026, 9, 2); // 2 Oct 2026

/**
 * The plan a registered user is entitled to. Pro and Premium are separate add-ons, so the plan is
 * built from the (server-written, rule-protected) purchase history; refunded purchases don't count.
 * Accounts without purchase records (admin grants, very old accounts) fall back to the tier field.
 */
export function planFromRegistration(reg?: { tier?: string | null; purchaseHistory?: any[] } | null): LicensePlan {
  if (!reg) return 'free';
  const tierPlan = tierToPlan(reg.tier);
  const history = (Array.isArray(reg.purchaseHistory) ? reg.purchaseHistory : []).filter((p) => p && !p.refunded);
  const bought = (t: string) => history.filter((p) => String(p.tier || '').toUpperCase() === t);
  if (history.length === 0) return tierPlan;

  const premiumBuys = bought('OTO2');
  const hasPremium = premiumBuys.length > 0;
  const hasPro = bought('OTO1').length > 0 || premiumBuys.some((p) => Number(p.date) > 0 && Number(p.date) < PREMIUM_INCLUDES_PRO_BEFORE);
  if (hasPro && hasPremium) return 'master';
  if (hasPremium) return 'premium';
  if (hasPro) return 'pro';
  // Tier raised by an admin above what the history shows
  return tierPlan === 'pro' || tierPlan === 'master' ? tierPlan : 'free';
}

export function planToTier(plan?: LicensePlan): 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2' {
  if (plan === 'master' || plan === 'commercial' || plan === 'premium') return 'OTO2';
  if (plan === 'pro') return 'OTO1';
  return 'FrontEnd';
}


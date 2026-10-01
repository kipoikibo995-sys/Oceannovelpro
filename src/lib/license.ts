// Ocean Novel License Tiers & Funnel Packages
// Regular: Author Edition ($17)
// Pro: Unlimited Studio Edition ($47)
// Premium: Ocean Novel Premium - AI Ghostwriter & Lore Architecture ($97)

export type LicensePlan = 'free' | 'pro' | 'master' | 'commercial';

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

export function planToTier(plan?: LicensePlan): 'Free' | 'FrontEnd' | 'OTO1' | 'OTO2' {
  if (plan === 'master' || plan === 'commercial') return 'OTO2';
  if (plan === 'pro') return 'OTO1';
  return 'FrontEnd';
}


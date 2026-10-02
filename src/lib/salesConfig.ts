/**
 * SALES PAGE LINKS FOR EACH TIER
 */

export const SALES_PAGE_CONFIG = {
  // Regular / front-end offer — shown to accounts that signed up without buying
  frontEndSalesUrl: "https://kojilaunch.com/fe-oceannovel/",

  // Pro Edition (unlimited + 50 ready-made characters & art library)
  proSalesUrl: "https://kojilaunch.com/pro-oceannovel/",

  // Premium Edition (AI Prompt Hub & consistency tools)
  premiumSalesUrl: "https://kojilaunch.com/premium-ocean-novel/",
};

/**
 * Open sales page in a new window/tab for the designated tier
 */
export function openSalesPage(tier: 'fe' | 'pro' | 'premium'): void {
  const url =
    tier === 'fe' ? SALES_PAGE_CONFIG.frontEndSalesUrl : tier === 'pro' ? SALES_PAGE_CONFIG.proSalesUrl : SALES_PAGE_CONFIG.premiumSalesUrl;
  if (url && url !== '#') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

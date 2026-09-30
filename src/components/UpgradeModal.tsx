import React from "react";
import { X, Lock, ArrowRight, ShieldCheck, CheckCircle2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openSalesPage } from "@/lib/salesConfig";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  feature?: "projects" | "characters" | "locations" | "image_library" | "epub" | "continuity" | "ai_hub";
  currentCount?: number;
  maxLimit?: number;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title,
  description,
  feature = "projects",
  currentCount,
  maxLimit,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getFeatureDetails = () => {
    switch (feature) {
      case "ai_hub":
        return {
          badge: "Premium Edition — Ocean Novel",
          heading: "Unlock AI Ghostwriter & Lore Generator",
          desc: description || "The AI Prompt Hub and Ghostwriter Generation Suite are exclusively unlocked in Premium Edition ($67). Generate high-yield scene beats, character psychology prompts, and prose polish instructions instantly.",
          perks: [
            "AI Scene Drafting Prompts with custom tension, POV, and pacing controls",
            "Master Story System setup instructions for ChatGPT, Claude, and Gemini",
            "Sensory-rich prose polish & show-don't-tell cadence enhancers",
            "Automatic Story Bible character & location context injection into AI prompts",
          ],
        };
      case "continuity":
        return {
          badge: "Premium Edition — Ocean Novel",
          heading: "Unlock Logic & Continuity Conflict Engine",
          desc: description || "Deep narrative consistency scanning (character appearance inconsistencies, timeline paradoxes, alias misspellings, and prose monotony warnings) is powered by Premium Edition.",
          perks: [
            "Timeline chronology & scene timestamp paradox scanner",
            "Character physical appearance and trait consistency tracker",
            "Prose repetition, echo alert, and rhythm monotony diagnosis",
            "One-click batch alias and terminology corrector across entire manuscript",
          ],
        };
      case "projects":
        return {
          badge: "Manuscript Limit Reached",
          heading: "You've Reached the 3 Manuscripts Quota",
          desc: description || "The Regular Edition includes up to 3 active novel archives. Upgrade to Pro Edition to unlock unlimited manuscripts and series shelves.",
          perks: [
            "Unlimited novel archives & multi-book series",
            "Full EPUB 3 Amazon KDP export engine with ISBN formatting",
            "High-resolution fantasy portrait & location art library (50+ presets)",
            "Unlimited Story Bible characters & world locations",
          ],
        };
      case "characters":
        return {
          badge: "Character Registry Quota",
          heading: `Story Bible Limit Reached (${currentCount || 25}/${maxLimit || 25})`,
          desc: description || "The Regular Edition provides 25 deep character dossiers per novel. Upgrade to Pro Edition for infinite characters, clan hierarchies, and divine pantheons.",
          perks: [
            "Unlimited character dossiers per manuscript",
            "Access to 49 high-res fantasy character portraits",
            "Infinite relationship graph networks & family trees",
            "Full character psychology & MBTI archetypes export",
          ],
        };
      case "locations":
        return {
          badge: "World Atlas Quota",
          heading: `Atlas Landmark Limit Reached (${currentCount || 15}/${maxLimit || 15})`,
          desc: description || "The Regular Edition provides 15 landmark dossiers per project. Upgrade to Pro Edition to map infinite kingdoms, realms, routes, and secret archives.",
          perks: [
            "Unlimited locations, kingdoms, and landmarks",
            "Interactive fantasy world map & route connecting canvas",
            "Preset fantasy location art library",
            "Regional lore and atmospheric climate matrices",
          ],
        };
      case "image_library":
        return {
          badge: "Pro Studio Asset Library",
          heading: "Exclusive Fantasy Art & Portrait Library",
          desc: description || "The curated 50+ high-res Fantasy Portrait and Location Art Library is exclusively available in Pro Edition. In the Regular Edition, you can still upload your own images from your device or paste web image links freely!",
          perks: [
            "Instant access to 49 curated fantasy character portraits",
            "Atmospheric fantasy location backgrounds and landscape art",
            "Pre-calibrated genre tags, archetypes, and lighting presets",
            "Commercial publication rights for all built-in art assets",
          ],
        };
      default:
        return {
          badge: "Premium Exclusive Feature",
          heading: "Unlock Advanced Writing Architecture",
          desc: description || "Upgrade your studio license to unleash the full power of Ocean Novel.",
          perks: [
            "Unlimited novel archives & multi-book series (Pro)",
            "Full EPUB 3 Amazon KDP export engine (Pro)",
            "AI Ghostwriter & Lore Generator Hub (Premium)",
            "Deep Narrative Continuity & Logic Conflict Engine (Premium)",
          ],
        };
    }
  };

  const details = getFeatureDetails();
  const isPremiumFeature = feature === 'ai_hub' || feature === 'continuity';
  const targetTier = isPremiumFeature ? 'premium' : 'pro';

  const handleGoToUpgrade = () => {
    onClose();
    openSalesPage(targetTier);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FCFAF5] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.4)] w-full max-w-lg border border-[#E5E0D5] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Header */}
        <div className="bg-[#2C1D16] text-[#FAF7F2] p-6 border-b border-[#3E291F] relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#8C503C]/30 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-[#8C503C] border border-[#A25D47] flex items-center justify-center text-amber-200 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-300/90 uppercase block">
                  {details.badge}
                </span>
                <h3 className="font-serif text-lg font-bold text-white leading-tight mt-0.5">
                  {title || details.heading}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-stone-700 leading-relaxed font-serif">
            {details.desc}
          </p>

          <div className="bg-[#F4F1EA] border border-[#E5E0D5] rounded-md p-4 space-y-2.5">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#8C503C] block">
              {isPremiumFeature ? "What you unlock in Ocean Novel Premium:" : "What you unlock in Ocean Novel Pro:"}
            </span>
            <ul className="space-y-2">
              {details.perks.map((perk, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-stone-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5A9672] shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Keep Current Plan
            </button>

            <button
              type="button"
              onClick={handleGoToUpgrade}
              className="px-5 py-2.5 bg-[#8C503C] hover:bg-[#723E2E] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg"
            >
              <span>{isPremiumFeature ? "Upgrade to Premium" : "Upgrade to Pro"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

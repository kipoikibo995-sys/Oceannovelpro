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
          heading: "Unlock the AI Prompt Hub",
          desc: description || "The AI Prompt Hub is part of Premium Edition ($97). It writes ready-to-paste prompts for ChatGPT, Claude or Gemini, filled with your own characters, places and scene details. Ocean Novel doesn't write your book; it gives your AI tool the right context.",
          perks: [
            "Scene drafting prompts with your POV, tone, tension and pacing",
            "Story setup prompts to brief ChatGPT, Claude or Gemini on your book",
            "Prose polish prompts: show-don't-tell, sensory detail, rhythm",
            "Your Story Bible characters & places added to each prompt automatically",
          ],
        };
      case "continuity":
        return {
          badge: "Premium Edition — Ocean Novel",
          heading: "Unlock the Consistency Checker",
          desc: description || "The Consistency Checker is part of Premium Edition ($97). It reads your whole manuscript against your Story Bible and flags slips before your readers do.",
          perks: [
            "Misspelled character and place names, with one-click fixes",
            "Names in your manuscript that aren't in your Story Bible yet",
            "Characters marked as dead who still appear in later scenes",
            "Word echoes and repetitive sentence rhythm in your prose",
          ],
        };
      case "projects":
        return {
          badge: "Manuscript Limit Reached",
          heading: "You've Reached the 3 Manuscripts Quota",
          desc: description || "The Regular Edition includes up to 3 books. Pro Edition and Premium Edition both remove the limit.",
          perks: [
            "Unlimited books (Pro or Premium)",
            "Unlimited characters & places in every book (Pro or Premium)",
            "EPUB 3 export for Amazon KDP (Pro or Premium)",
            "50 ready-made characters & fantasy art library (Pro)",
          ],
        };
      case "characters":
        return {
          badge: "Character Registry Quota",
          heading: `Story Bible Limit Reached (${currentCount || 25}/${maxLimit || 25})`,
          desc: description || "The Regular Edition includes 25 characters per book. Pro Edition and Premium Edition both remove the limit.",
          perks: [
            "Unlimited characters in every book (Pro or Premium)",
            "Unlimited books and places too (Pro or Premium)",
            "EPUB 3 export for Amazon KDP (Pro or Premium)",
            "50 ready-made characters with portraits (Pro)",
          ],
        };
      case "locations":
        return {
          badge: "World Atlas Quota",
          heading: `Atlas Landmark Limit Reached (${currentCount || 15}/${maxLimit || 15})`,
          desc: description || "The Regular Edition includes 15 places per book. Pro Edition and Premium Edition both remove the limit.",
          perks: [
            "Unlimited places in every book (Pro or Premium)",
            "Unlimited books and characters too (Pro or Premium)",
            "EPUB 3 export for Amazon KDP (Pro or Premium)",
            "Fantasy location art library (Pro)",
          ],
        };
      case "image_library":
        return {
          badge: "Pro Studio Asset Library",
          heading: "50 Ready-Made Characters & Fantasy Art Library",
          desc: description || "50 ready-made fantasy characters (backstory, traits and portrait) plus the curated portrait and location art library are part of Pro Edition. In the Regular Edition you can create characters yourself and upload your own images or paste image links.",
          perks: [
            "50 ready-made characters with backstories, traits and portraits",
            "Curated fantasy portrait library for your own characters",
            "Atmospheric fantasy location backgrounds and landscape art",
            "Genre tags and archetypes to filter the library",
          ],
        };
      default:
        return {
          badge: "Premium Exclusive Feature",
          heading: "Upgrade Ocean Novel",
          desc: description || "Pro and Premium are separate add-ons. Pick the one that fits how you write, or get both.",
          perks: [
            "Unlimited books, characters & places (Pro or Premium)",
            "EPUB 3 export for Amazon KDP (Pro or Premium)",
            "50 ready-made characters & fantasy art library (Pro)",
            "AI Prompt Hub & Consistency Checker (Premium)",
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

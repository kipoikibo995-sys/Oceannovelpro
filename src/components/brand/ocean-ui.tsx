import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Ocean Novel design language — navy / burnt orange / mustard / cream */
/* ------------------------------------------------------------------ */

export const OCEAN = {
  navy: "#0E1D26",
  navy2: "#132631",
  orange: "#E8561F",
  orangeDark: "#D44B17",
  mustard: "#F0B54B",
  cream: "#F6F1E7",
  sand: "#E9DCC5",
  line: "#E4DAC8",
} as const;

// Outlined uppercase label box
export function Tag({
  children,
  tone = "dark",
  className,
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block px-2.5 py-1 border text-[10px] font-bold uppercase tracking-[0.2em] leading-none",
        tone === "dark" ? "border-[#0E1D26]/60 text-[#0E1D26]" : "border-[#F6F1E7]/60 text-[#F6F1E7]",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Book cover — deterministic Bauhaus art per book                     */
/* ------------------------------------------------------------------ */

const COVER_PALETTES = [
  { bg: "#F6F1E7", a: "#E8561F", b: "#F0B54B", c: "#0E1D26", ink: "#0E1D26" },
  { bg: "#0E1D26", a: "#E8561F", b: "#F0B54B", c: "#F6F1E7", ink: "#F6F1E7" },
  { bg: "#E8561F", a: "#0E1D26", b: "#F0B54B", c: "#F6F1E7", ink: "#F6F1E7" },
  { bg: "#E9DCC5", a: "#0E1D26", b: "#E8561F", c: "#F0B54B", ink: "#0E1D26" },
  { bg: "#F0B54B", a: "#0E1D26", b: "#E8561F", c: "#F6F1E7", ink: "#0E1D26" },
];

function hashSeed(seed: string) {
  return seed.split("").reduce((acc, ch, i) => (acc * 31 + ch.charCodeAt(0) * (i + 1)) >>> 0, 7);
}

// Genre nudges the palette so shelves read at a glance; the seed varies the composition
function paletteFor(genre: string, seed: number) {
  const g = genre.toLowerCase();
  if (g.includes("fantasy")) return COVER_PALETTES[seed % 2 === 0 ? 1 : 0];
  if (g.includes("thriller") || g.includes("horror") || g.includes("mystery")) return COVER_PALETTES[2];
  if (g.includes("romance")) return COVER_PALETTES[4];
  if (g.includes("sci")) return COVER_PALETTES[1];
  if (g.includes("historical")) return COVER_PALETTES[3];
  return COVER_PALETTES[seed % COVER_PALETTES.length];
}

export function BookCover({
  title,
  genre = "",
  seed,
  subtitle,
  className,
  titleClassName,
}: {
  title: string;
  genre?: string;
  seed: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
}) {
  const h = hashSeed(seed || title);
  const p = paletteFor(genre, h);
  const variant = h % 3;

  return (
    <div className={cn("relative overflow-hidden rounded-r-md rounded-l-sm", className)} style={{ background: p.bg }}>
      <svg viewBox="0 0 210 276" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        {variant === 0 && (
          <>
            <circle cx="130" cy="58" r="34" fill={p.b} />
            <rect x="164" y="0" width="22" height="276" fill={p.c} />
            <path d="M40 276 A 80 80 0 0 1 164 200 L 164 276 Z" fill={p.a} />
            <path d="M92 276 L 164 222 L 164 276 Z" fill={p.bg} opacity="0.55" />
          </>
        )}
        {variant === 1 && (
          <>
            <rect x="0" y="176" width="210" height="100" fill={p.a} />
            <path d="M120 276 V196 A 40 40 0 0 1 200 196 V276 Z" fill={p.c} />
            <path d="M140 276 V204 A 20 20 0 0 1 180 204 V276 Z" fill={p.b} />
            <circle cx="46" cy="44" r="22" fill={p.b} />
          </>
        )}
        {variant === 2 && (
          <>
            <circle cx="180" cy="40" r="60" fill={p.a} />
            {[0, 1, 2, 3, 4].map((s) => (
              <rect key={s} x={s * 26} y={276 - (s + 1) * 18} width={210 - s * 26} height="18" fill={s % 2 ? p.b : p.c} />
            ))}
          </>
        )}
      </svg>
      {/* spine shading */}
      <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/20 to-transparent" />
      <div className="absolute left-[11%] right-[26%] top-[30%]">
        <p
          className={cn("font-extrabold leading-[0.95] tracking-[-0.02em] line-clamp-3 break-words", titleClassName)}
          style={{ color: p.ink }}
        >
          {title}
        </p>
        {subtitle && (
          <p className="mt-1.5 text-[7px] font-bold uppercase tracking-[0.28em] line-clamp-1" style={{ color: p.ink, opacity: 0.65 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// Hardcover in 3D with a page block, floating over an orange sun
export function BookMockup({
  title,
  genre,
  seed,
  subtitle,
  className,
}: {
  title: string;
  genre?: string;
  seed: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, rotate: -8, y: 16 }}
      animate={{ opacity: 1, rotate: -5, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={cn("relative shrink-0 w-[190px] h-[250px]", className)}
      aria-hidden="true"
    >
      <div className="absolute -right-16 top-2 w-[76%] aspect-square rounded-full bg-[#E8561F]" />
      <div className="absolute inset-y-[6px] -right-[10px] w-[14px] rounded-r-sm bg-[repeating-linear-gradient(90deg,#EFE7D6_0_1px,#D9CDB6_1px_2px)] shadow-[4px_6px_12px_rgba(0,0,0,0.35)]" />
      <BookCover
        title={title}
        genre={genre}
        seed={seed}
        subtitle={subtitle}
        className="absolute inset-0 shadow-[18px_24px_40px_-12px_rgba(0,0,0,0.6)]"
        titleClassName="text-[26px]"
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Icon set — 24px grid, 1.75 stroke, round caps                       */
/* ------------------------------------------------------------------ */

export type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Brand glyph: an open book resting on a wave
export function IconBookWave(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3.5 5.75c2.9-1.3 5.8-1 8.5 1.1v10c-2.7-2.1-5.6-2.4-8.5-1.1z" />
      <path d="M20.5 5.75c-2.9-1.3-5.8-1-8.5 1.1v10c2.7-2.1 5.6-2.4 8.5-1.1z" />
      <path d="M2.5 20.25c1.6-1.1 3.2-1.1 4.9 0s3.2 1.1 4.6 0 3.2-1.1 4.6 0 3.3 1.1 4.9 0" />
    </Icon>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Icon>
  );
}

export function IconEyeOff(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 7.4A15.6 15.6 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1" />
      <path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9" />
      <path d="m3.5 3.5 17 17" />
    </Icon>
  );
}

export function IconArrow(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
  );
}

export function IconArrowUpRight(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </Icon>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </Icon>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.25M12 16.25v.25" />
    </Icon>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.25 12.25 2.5 2.5 5-5.25" />
    </Icon>
  );
}

export function IconTick(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m5.5 12.5 4 4 9-9.5" />
    </Icon>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4.5 7h15M9.5 7V4.75h5V7M6.5 7l.9 12.25h9.2L17.5 7" />
      <path d="M10.25 11v5M13.75 11v5" />
    </Icon>
  );
}

export function IconFlame(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 21c-3.6 0-6.25-2.5-6.25-5.9 0-3.4 3-5.3 3.4-8.6 2.5 1.4 3.4 3.4 3.3 5.1 1-.6 1.6-1.8 1.7-3.1 2.2 1.7 4.1 4 4.1 6.6C18.25 18.5 15.6 21 12 21Z" />
    </Icon>
  );
}

export function IconQuill(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 4c-7 .5-11.5 5-13 12.5L5 20" />
      <path d="M7.5 15.5c3.5.2 6.8-1.5 8.5-4.5M10 10.5c2.2.1 4.2-.6 5.9-2" />
    </Icon>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function IconGear(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" />
    </Icon>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3 4.75 6v5.5c0 4.4 3 7.9 7.25 9.5 4.25-1.6 7.25-5.1 7.25-9.5V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Icon>
  );
}

export function IconExpand(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M14.5 4.5h5v5M9.5 19.5h-5v-5M19.5 4.5 14 10M4.5 19.5 10 14" />
    </Icon>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </Icon>
  );
}

export function IconPerson(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20c.9-3.6 3.7-5.5 7.25-5.5s6.35 1.9 7.25 5.5" />
    </Icon>
  );
}

export function IconPin(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.25" />
    </Icon>
  );
}

export function IconScenes(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 9.5h16M9.5 9.5V20" />
    </Icon>
  );
}

export function IconSpinner({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("animate-spin", className)} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

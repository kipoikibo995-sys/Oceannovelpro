const LOGO_URL =
  "https://res.cloudinary.com/mekoxs1q/image/upload/v1790161979/cb32de78-f03c-42e2-b8fc-b0cdf160a1db_pzozap.png";

// One wave period across 1440 units; start and end share height and slope, so
// two copies side by side loop seamlessly when shifted by half their width.
const WAVE_TILE = "C320,18 400,18 720,64 C1040,110 1120,110 1440,64";
const wavePath = (y: number) => {
  const shift = y - 64;
  const tile = (x: number) =>
    WAVE_TILE.replace(/(\d+),(\d+)/g, (_, a, b) => `${Number(a) + x},${Number(b) + shift}`);
  return `M0,${y} ${tile(0)} ${tile(1440)} L2880,200 L0,200 Z`;
};

const LAYERS = [
  { y: 64, color: "#E9DCC5", opacity: 0.9, duration: 22, delay: 0 },
  { y: 96, color: "#F0B54B", opacity: 0.55, duration: 15, delay: -4 },
  { y: 136, color: "#0E1D26", opacity: 1, duration: 10, delay: -2 },
];

export default function WaveLoader({ label = "Opening your library…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative min-h-screen w-full overflow-hidden bg-[#F8F5EE] flex flex-col items-center justify-center select-none p-6 ocean-fade-in"
    >
      {/* Rolling sea along the bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] min-h-[180px]" aria-hidden="true">
        {LAYERS.map((l, i) => (
          <svg
            key={i}
            className="absolute bottom-0 left-0 h-full w-[200%] ocean-wave"
            style={{ animationDuration: `${l.duration}s`, animationDelay: `${l.delay}s` }}
            viewBox="0 0 2880 200"
            preserveAspectRatio="none"
          >
            <path d={wavePath(l.y)} fill={l.color} fillOpacity={l.opacity} />
          </svg>
        ))}
      </div>

      <div className="relative flex flex-col items-center max-w-sm text-center -mt-[8vh]">
        <img
          src={LOGO_URL}
          alt="Ocean Novel"
          className="w-56 sm:w-72 md:w-80 max-w-full h-auto object-contain ocean-bob"
          draggable={false}
        />

        {/* A thin wave that keeps travelling while we wait */}
        <svg className="mt-6 w-40 h-5 overflow-visible" viewBox="0 0 160 20" aria-hidden="true">
          <path
            d="M0,10 C20,0 30,0 40,10 C50,20 60,20 80,10 C100,0 110,0 120,10 C130,20 140,20 160,10"
            fill="none"
            stroke="#0E1D26"
            strokeOpacity="0.12"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            className="ocean-line"
            d="M0,10 C20,0 30,0 40,10 C50,20 60,20 80,10 C100,0 110,0 120,10 C130,20 140,20 160,10"
            fill="none"
            stroke="#E8561F"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={100}
          />
        </svg>
        <span className="mt-3 text-[13px] tracking-wide text-[#0E1D26]/55 font-['Outfit']">{label}</span>
      </div>
    </div>
  );
}

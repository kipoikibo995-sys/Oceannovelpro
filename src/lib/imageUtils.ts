import { CHARACTER_PRESETS } from "@/data/characterPresets";
/**
 * Utility to process uploaded image files (resize and compress to base64)
 * to ensure fast client-side rendering and protect against localStorage quota limits.
 */
// Each picture is stored as its own cloud document (1 MiB cap); keep uploads well under that
const MAX_PICTURE_CHARS = 300_000;

export async function fileToOptimizedDataUrl(
  file: File,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // SVG stays vector; everything else (GIF included) is re-encoded as a JPEG
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          // White behind transparent PNGs, otherwise JPEG turns them black
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Step the quality down until the picture is small enough
          let q = quality;
          let compressed = canvas.toDataURL('image/jpeg', q);
          while (compressed.length > MAX_PICTURE_CHARS && q > 0.5) {
            q = Math.round((q - 0.1) * 100) / 100;
            compressed = canvas.toDataURL('image/jpeg', q);
          }
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => {
        resolve(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface PresetImage {
  label: string;
  url: string;
  category?: string;
  tags?: string[];
  description?: string;
}

// Built from the character presets so labels always describe the actual portrait
export const FANTASY_PRESET_PORTRAITS: PresetImage[] = CHARACTER_PRESETS.filter(
  (p, i, all) => all.findIndex((q) => q.imageUrl === p.imageUrl) === i
).map((p) => ({
  label: p.title,
  url: p.imageUrl,
  category: p.category,
  tags: p.tags,
  description: p.physicalAppearance,
}));

export const FANTASY_PRESET_LOCATIONS = [
  {
    label: "Golden Oasis City",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769186/06_golden_oasis_city_at_sunset_so7xdx.jpg",
  },
  {
    label: "Volcanic Citadel",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769186/04_volcanic_citadel_at_sunset_yafvd7.jpg",
  },
  {
    label: "Enchanted Woods",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769187/08_enchanted_forest_of_older_paths_azvbp4.jpg",
  },
  {
    label: "Frostgate Citadel",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769187/02_frostgate_citadel_in_the_snowstorm_zy2pb8.jpg",
  },
  {
    label: "Stormlit Harbor",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769187/09_stormlit_harbor_of_the_cliffside_citadel_jpisuj.jpg",
  },
  {
    label: "Ruined Emerald Citadel",
    url: "https://res.cloudinary.com/mekoxs1q/image/upload/v1788769186/07_ruined_citadel_beneath_the_green_storm_po3es7.jpg",
  },
];

// Neutral placeholder for characters without an image on plans without the art library
export const BLANK_PORTRAIT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><rect width="240" height="300" fill="#EFE9DE"/><circle cx="120" cy="118" r="46" fill="#D9CFBC"/><path d="M40 300c0-56 36-92 80-92s80 36 80 92z" fill="#D9CFBC"/></svg>'
  );

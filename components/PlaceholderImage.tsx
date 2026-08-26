import Alpona from "@/components/Alpona";
import { paletteGradient, type Palette } from "@/lib/palette";

type PlaceholderImageProps = {
  palette: Palette;
  caption?: string;
  banglaCaption?: string;
  className?: string;
};

/** Gradient + alpona placeholder that stands in for a real photo until content arrives. */
export default function PlaceholderImage({
  palette,
  caption,
  banglaCaption,
  className = "",
}: PlaceholderImageProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: paletteGradient[palette] }}
      role="img"
      aria-label={caption ?? "Placeholder image"}
    >
      <Alpona className="absolute -right-10 -top-10 h-48 w-48 text-white/20" />
      <Alpona className="absolute -bottom-14 -left-14 h-56 w-56 text-white/10" />
      {(caption || banglaCaption) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-4 pt-10">
          {banglaCaption && (
            <div className="text-lg font-semibold leading-tight text-white">
              {banglaCaption}
            </div>
          )}
          {caption && (
            <div className="text-xs uppercase tracking-widest text-white/80">
              {caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

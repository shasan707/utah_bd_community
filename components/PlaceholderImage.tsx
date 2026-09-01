import Alpona from "@/components/Alpona";
import { paletteGradient, type Palette } from "@/lib/palette";

type PlaceholderImageProps = {
  palette: Palette;
  caption?: string;
  banglaCaption?: string;
  className?: string;
  /** Real photo URL. When set, the photo is shown instead of the gradient. */
  src?: string;
};

/** Photo tile: shows the real image when a URL is given, otherwise a branded gradient placeholder. */
export default function PlaceholderImage({
  palette,
  caption,
  banglaCaption,
  className = "",
  src,
}: PlaceholderImageProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: paletteGradient[palette] }}
      role="img"
      aria-label={banglaCaption ?? caption ?? "Photo"}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={banglaCaption ?? caption ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <>
          <Alpona className="absolute -right-10 -top-10 h-48 w-48 text-white/20" />
          <Alpona className="absolute -bottom-14 -left-14 h-56 w-56 text-white/10" />
        </>
      )}
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

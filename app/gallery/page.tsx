import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import GalleryGrid from "@/components/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery — Utha USA",
  description: "Photo memories from Utha USA community celebrations.",
};

export default function GalleryPage() {
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Memories"
          title="Gallery"
          subtitle="Placeholder tiles for now — your real event photos will live here. Click any tile to preview the lightbox."
        />
        <div className="mt-12">
          <GalleryGrid />
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import GalleryGrid from "@/components/GalleryGrid";
import { getGallery } from "@/lib/content";

export const metadata: Metadata = {
  title: "Gallery | Utha USA",
  description: "Photo memories from Utha USA community celebrations.",
};

export const revalidate = 60;

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Memories"
          title="Gallery"
          subtitle="Placeholder tiles for now. Your real event photos will live here. Click any tile to preview the lightbox."
        />
        <div className="mt-12">
          <GalleryGrid items={items} />
        </div>
      </section>
    </div>
  );
}

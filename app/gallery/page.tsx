import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import GalleryGrid from "@/components/GalleryGrid";
import { getGallery } from "@/lib/content";
import { gallery as sampleGallery } from "@/data/gallery";

export const metadata: Metadata = {
  title: "Gallery | Utha USA",
  description: "Photos and videos from Utha USA community celebrations.",
};

export const revalidate = 60;

export default async function GalleryPage() {
  const items = await getGallery();
  const sample = items === sampleGallery;
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Memories"
          title="Gallery"
          subtitle={
            sample
              ? "Photos and videos from our celebrations. These are placeholder tiles until the first real ones are uploaded."
              : "Photos and videos from our celebrations. Click a tile to open it."
          }
        />
        <div className="mt-12">
          <GalleryGrid items={items} />
        </div>
      </section>
    </div>
  );
}

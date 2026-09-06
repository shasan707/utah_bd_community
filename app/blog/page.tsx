import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import PostCard from "@/components/PostCard";
import SectionHeading from "@/components/SectionHeading";
import { getPosts } from "@/lib/content";
import { posts as samplePosts } from "@/data/posts";

export const metadata: Metadata = {
  title: "Blog | Bangladeshi Association of Utah",
  description:
    "Stories from the Bangladeshi community of Salt Lake City: event recaps, recipes, committee notes, and voices from the next generation.",
};

export const revalidate = 60;

export default async function BlogPage() {
  const list = await getPosts();
  const sample = list === samplePosts;

  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Stories"
          title="Utah Blog"
          subtitle={
            sample
              ? "Event recaps, recipes, committee notes, and voices from the next generation. These are sample posts until the committee publishes the first real one."
              : "Event recaps, recipes, committee notes, and voices from the next generation."
          }
        />
        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 0.1}>
              <PostCard post={p} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

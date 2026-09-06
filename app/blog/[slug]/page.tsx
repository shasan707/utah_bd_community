import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Alpona from "@/components/Alpona";
import PostCard from "@/components/PostCard";
import Reveal from "@/components/Reveal";
import { getPostBySlug, getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { Markdown, firstParagraph } from "@/lib/markdown";
import { paletteGradient } from "@/lib/palette";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found | Utha USA" };
  return {
    title: `${post.title} | Utha USA`,
    description: post.excerpt || firstParagraph(post.body),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const more = (await getPosts()).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div>
      <section
        className="relative overflow-hidden pb-16 pt-40 text-white"
        style={{ background: paletteGradient[post.palette] }}
      >
        <Alpona className="absolute -right-20 -top-20 h-80 w-80 text-white/15" />
        <Alpona className="drift-slow absolute -bottom-24 -left-16 h-72 w-72 text-white/10" />
        <div className="relative mx-auto max-w-3xl px-5">
          <Reveal>
            <Link href="/blog" className="text-sm font-semibold text-white/75 hover:text-white">
              ← All posts
            </Link>
            <div className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-white/80">
              ✦ {post.tag ?? "Utha blog"}
            </div>
            <h1 className="mt-1 text-4xl font-black leading-tight md:text-5xl">{post.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
              <span>{post.author}</span>
              <span>{formatDate(post.publishedAt)}</span>
            </div>
          </Reveal>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-5 py-14">
        {post.coverUrl && (
          <Reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverUrl}
              alt={post.title}
              className="mb-10 w-full rounded-3xl border border-sand object-cover shadow-sm"
            />
          </Reveal>
        )}
        <Reveal delay={0.1}>
          <Markdown text={post.body} />
        </Reveal>
      </article>

      {more.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <Reveal>
            <h2 className="text-2xl font-bold text-forest-ink">More stories</h2>
          </Reveal>
          <div className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p, i) => (
              <Reveal key={p.slug} delay={0.1 + i * 0.08}>
                <PostCard post={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import TiltCard from "@/components/TiltCard";
import PlaceholderImage from "@/components/PlaceholderImage";
import { formatDateShort } from "@/lib/format";
import type { BlogPost } from "@/data/posts";

export default function PostCard({ post }: { post: BlogPost }) {
  return (
    <TiltCard className="h-full">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-sand bg-white shadow-sm transition-shadow hover:shadow-xl"
      >
        <PlaceholderImage
          palette={post.palette}
          banglaCaption={post.coverUrl ? undefined : post.tag ?? "Utha blog"}
          src={post.coverUrl}
          className="h-44"
        />
        <div className="flex flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-forest">
            <span>{formatDateShort(post.publishedAt)}</span>
            {post.tag && (
              <span className="ml-auto rounded-full bg-forest/10 px-2.5 py-1 normal-case tracking-normal text-forest">
                {post.tag}
              </span>
            )}
          </div>
          <h3 className="mt-3 text-xl font-bold text-forest-ink group-hover:text-forest">
            {post.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-forest-ink/60">
            {post.excerpt}
          </p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-forest-ink/50">{post.author}</span>
            <span className="font-semibold text-bengal-red">Read →</span>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inputCls } from "@/components/admin/AdminShell";
import { Markdown } from "@/lib/markdown";

type Row = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  tag: string | null;
  palette: string;
  cover_url: string | null;
  published: boolean;
  published_at: string;
};

const empty = {
  id: 0,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  author: "Utha USA",
  tag: "",
  palette: "green",
  published: false,
  published_at: "",
};

type Form = typeof empty;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function AdminBlog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("posts")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError("");
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const edit = (r: Row) => {
    setForm({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt ?? "",
      body: r.body ?? "",
      author: r.author ?? "Utha USA",
      tag: r.tag ?? "",
      palette: r.palette,
      published: r.published,
      published_at: toInputValue(r.published_at),
    });
    setPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let coverUrl: string | undefined;
      if (file) coverUrl = await uploadPhoto(file, "blog");
      const record = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        excerpt: form.excerpt.trim(),
        body: form.body,
        author: form.author.trim() || "Utha USA",
        tag: form.tag.trim() || null,
        palette: form.palette,
        published: form.published,
        published_at: form.published_at
          ? new Date(form.published_at).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(coverUrl ? { cover_url: coverUrl } : {}),
      };
      const supabase = getSupabase();
      const { error } = form.id
        ? await supabase.from("posts").update(record).eq("id", form.id)
        : await supabase.from("posts").insert(record);
      if (error) throw new Error(error.message);
      setForm(empty);
      setFile(null);
      setMessage(
        record.published
          ? "Post saved and published. It shows on /blog within a minute."
          : "Draft saved. Tick Published when it is ready."
      );
      await load();
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : err}`);
    }
    setBusy(false);
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete the post "${r.title}"?`)) return;
    await getSupabase().from("posts").delete().eq("id", r.id);
    await load();
  };

  const togglePublished = async (r: Row) => {
    await getSupabase()
      .from("posts")
      .update({ published: !r.published, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-ink">
        {form.id ? `Editing: ${form.title}` : "Write a post"}
      </h1>
      <p className="mt-1 text-sm text-forest-ink/60">
        Plain writing works. For structure use # for a heading, a blank line
        between paragraphs, - for a list, 1. for numbered steps, **bold**,
        *italic*, [link text](https://...), and ![photo](https://...) on its own
        line for a picture.
      </p>

      {loadError && (
        <div className="mt-6 rounded-3xl border border-sand bg-white p-6">
          <p className="font-semibold text-forest-ink">The blog table could not be read.</p>
          <p className="mt-1 text-sm text-forest-ink/70">
            If this is a fresh setup, run supabase/blog.sql in the Supabase SQL editor,
            then reload this page.
          </p>
          <p className="mt-3 text-xs text-forest-ink/50">{loadError}</p>
        </div>
      )}

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        <input
          required
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            set({
              title: e.target.value,
              slug: form.id ? form.slug : slugify(e.target.value),
            })
          }
          className={`${inputCls} sm:col-span-2`}
        />
        <input
          placeholder="Web address ending, e.g. pitha-night-recap"
          value={form.slug}
          onChange={(e) => set({ slug: slugify(e.target.value) })}
          className={inputCls}
        />
        <input
          placeholder="Tag, e.g. Recap, Recipe, Announcement"
          value={form.tag}
          onChange={(e) => set({ tag: e.target.value })}
          className={inputCls}
        />
        <input
          placeholder="Author"
          value={form.author}
          onChange={(e) => set({ author: e.target.value })}
          className={inputCls}
        />
        <select
          value={form.palette}
          onChange={(e) => set({ palette: e.target.value })}
          className={inputCls}
        >
          <option value="green">Green card</option>
          <option value="red">Red card</option>
          <option value="gold">Gold card</option>
          <option value="teal">Teal card</option>
        </select>
        <textarea
          rows={2}
          placeholder="Short summary shown on the blog cards (one or two sentences)"
          value={form.excerpt}
          onChange={(e) => set({ excerpt: e.target.value })}
          className={`${inputCls} resize-y sm:col-span-2`}
        />
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-forest-ink">Post</span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="rounded-full border border-sand px-3 py-1 text-xs font-semibold text-forest-ink/70 hover:border-forest"
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="rounded-xl border border-sand bg-cream p-5">
              {form.body.trim() ? (
                <Markdown text={form.body} />
              ) : (
                <p className="text-sm text-forest-ink/50">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <textarea
              rows={16}
              placeholder="Write the post here."
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
              className={`${inputCls} resize-y font-mono text-sm`}
            />
          )}
        </div>
        <label className="text-sm font-semibold text-forest-ink">
          Publish date
          <input
            type="datetime-local"
            value={form.published_at}
            onChange={(e) => set({ published_at: e.target.value })}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold text-forest-ink">
          Cover photo
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-forest-ink/80 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set({ published: e.target.checked })}
          />
          Published (visible on the website)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-forest py-3 font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Saving..." : form.id ? "Save changes" : form.published ? "Publish post" : "Save draft"}
        </button>
        {form.id ? (
          <button
            type="button"
            onClick={() => {
              setForm(empty);
              setFile(null);
              setPreview(false);
            }}
            className="rounded-full border border-sand py-3 font-semibold text-forest-ink/70"
          >
            Cancel editing
          </button>
        ) : (
          <div />
        )}
        {message && (
          <p className="text-sm font-medium text-forest sm:col-span-2">{message}</p>
        )}
      </form>

      <div className="mt-8 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-sand bg-white px-5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-forest-ink">{r.title}</div>
              <div className="text-xs text-forest-ink/50">
                {new Date(r.published_at).toLocaleDateString("en-US")} · {r.author}
                {r.tag ? ` · ${r.tag}` : ""}
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                r.published ? "bg-forest/10 text-forest" : "bg-amber-100 text-amber-800"
              }`}
            >
              {r.published ? "Published" : "Draft"}
            </span>
            {r.published && (
              <a
                href={`/blog/${r.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-forest hover:underline"
              >
                View
              </a>
            )}
            <button
              onClick={() => togglePublished(r)}
              className="text-sm font-semibold text-forest hover:underline"
            >
              {r.published ? "Unpublish" : "Publish"}
            </button>
            <button onClick={() => edit(r)} className="text-sm font-semibold text-forest hover:underline">
              Edit
            </button>
            <button
              onClick={() => remove(r)}
              className="text-sm font-semibold text-bengal-red hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
        {rows.length === 0 && !loadError && (
          <p className="text-sm text-forest-ink/50">
            No posts yet. The public blog shows three sample posts until you publish the
            first real one.
          </p>
        )}
      </div>
    </div>
  );
}

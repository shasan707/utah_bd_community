"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inputCls } from "@/components/admin/AdminShell";

type Row = {
  id: number;
  slug: string;
  title: string;
  short_name: string | null;
  date: string;
  end_time: string | null;
  venue: string | null;
  city: string;
  tag: string | null;
  free: boolean;
  blurb: string | null;
  description: string[];
  palette: string;
  image_url: string | null;
};

const empty = {
  id: 0,
  title: "",
  short_name: "",
  slug: "",
  date: "",
  end_time: "",
  venue: "",
  city: "Salt Lake City, UT",
  tag: "Festival",
  free: true,
  blurb: "",
  descriptionText: "",
  palette: "green",
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

export default function AdminEvents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("events")
      .select("*")
      .order("date", { ascending: true });
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
      short_name: r.short_name ?? "",
      slug: r.slug,
      date: toInputValue(r.date),
      end_time: r.end_time ?? "",
      venue: r.venue ?? "",
      city: r.city,
      tag: r.tag ?? "",
      free: r.free,
      blurb: r.blurb ?? "",
      descriptionText: (r.description ?? []).join("\n\n"),
      palette: r.palette,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let imageUrl: string | undefined;
      if (file) imageUrl = await uploadPhoto(file, "events");
      const record = {
        title: form.title,
        short_name: form.short_name || null,
        slug: form.slug || slugify(form.title),
        date: new Date(form.date).toISOString(),
        end_time: form.end_time || null,
        venue: form.venue || null,
        city: form.city,
        tag: form.tag || null,
        free: form.free,
        blurb: form.blurb || null,
        description: form.descriptionText
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
        palette: form.palette,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const supabase = getSupabase();
      const { error } = form.id
        ? await supabase.from("events").update(record).eq("id", form.id)
        : await supabase.from("events").insert(record);
      if (error) throw new Error(error.message);
      setForm(empty);
      setFile(null);
      setMessage("Event saved.");
      await load();
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : err}`);
    }
    setBusy(false);
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete event "${r.title}"?`)) return;
    await getSupabase().from("events").delete().eq("id", r.id);
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-ink">
        {form.id ? `Editing: ${form.title}` : "Add an event"}
      </h1>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        <input
          required
          placeholder="Event title"
          value={form.title}
          onChange={(e) =>
            set({
              title: e.target.value,
              slug: form.id ? form.slug : slugify(e.target.value),
            })
          }
          className={inputCls}
        />
        <input
          placeholder="Short display name (big text on cards)"
          value={form.short_name}
          onChange={(e) => set({ short_name: e.target.value })}
          className={inputCls}
        />
        <input
          required
          type="datetime-local"
          value={form.date}
          onChange={(e) => set({ date: e.target.value })}
          className={inputCls}
        />
        <input
          placeholder="End time, e.g. 10:00 PM (optional)"
          value={form.end_time}
          onChange={(e) => set({ end_time: e.target.value })}
          className={inputCls}
        />
        <input
          placeholder="Venue"
          value={form.venue}
          onChange={(e) => set({ venue: e.target.value })}
          className={inputCls}
        />
        <input
          placeholder="City"
          value={form.city}
          onChange={(e) => set({ city: e.target.value })}
          className={inputCls}
        />
        <input
          placeholder="Tag, e.g. Festival, Mela, Picnic"
          value={form.tag}
          onChange={(e) => set({ tag: e.target.value })}
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
        <input
          placeholder="One-line summary (shown on cards)"
          value={form.blurb}
          onChange={(e) => set({ blurb: e.target.value })}
          className={`${inputCls} sm:col-span-2`}
        />
        <textarea
          rows={6}
          placeholder="Full description. Separate paragraphs with an empty line."
          value={form.descriptionText}
          onChange={(e) => set({ descriptionText: e.target.value })}
          className={`${inputCls} resize-y sm:col-span-2`}
        />
        <label className="flex items-center gap-2 text-sm text-forest-ink/70">
          <input
            type="checkbox"
            checked={form.free}
            onChange={(e) => set({ free: e.target.checked })}
          />
          Free entry
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-forest py-3 font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Saving..." : form.id ? "Save changes" : "Publish event"}
        </button>
        {form.id ? (
          <button
            type="button"
            onClick={() => {
              setForm(empty);
              setFile(null);
            }}
            className="rounded-full border border-sand py-3 font-semibold text-forest-ink/70"
          >
            Cancel editing
          </button>
        ) : (
          <div />
        )}
        {message && (
          <p className="text-sm font-medium text-forest sm:col-span-2">
            {message}
          </p>
        )}
      </form>

      <div className="mt-8 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-sand bg-white px-5 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-forest-ink">
                {r.title}
              </div>
              <div className="text-xs text-forest-ink/50">
                {new Date(r.date).toLocaleString("en-US")} · {r.venue ?? "TBA"}
              </div>
            </div>
            <button
              onClick={() => edit(r)}
              className="text-sm font-semibold text-forest hover:underline"
            >
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
        {rows.length === 0 && (
          <p className="text-sm text-forest-ink/50">
            No real events yet. The public site is showing the six sample
            events until you publish the first one.
          </p>
        )}
      </div>
    </div>
  );
}

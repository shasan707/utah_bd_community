"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inputCls } from "@/components/admin/AdminShell";

type Row = {
  id: number;
  title: string;
  caption: string | null;
  image_url: string;
  palette: string;
  tall: boolean;
};

export default function AdminPhotos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tall, setTall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("gallery_items")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const url = await uploadPhoto(file, "gallery");
      const { error } = await getSupabase().from("gallery_items").insert({
        title: title || file.name,
        caption: caption || null,
        image_url: url,
        tall,
      });
      if (error) throw new Error(error.message);
      setTitle("");
      setCaption("");
      setTall(false);
      setFile(null);
      (document.getElementById("photo-file") as HTMLInputElement).value = "";
      setMessage("Photo published.");
      await load();
    } catch (err) {
      setMessage(`Upload failed: ${err instanceof Error ? err.message : err}`);
    }
    setBusy(false);
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    await getSupabase().from("gallery_items").delete().eq("id", row.id);
    const path = row.image_url.split("/photos/")[1];
    if (path) await getSupabase().storage.from("photos").remove([path]);
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-ink">Gallery photos</h1>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <input
            id="photo-file"
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={inputCls}
          />
        </div>
        <input
          placeholder="Title (shown on the photo)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
        />
        <input
          placeholder="Small caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm text-forest-ink/70">
          <input
            type="checkbox"
            checked={tall}
            onChange={(e) => setTall(e.target.checked)}
          />
          Tall tile (portrait photo)
        </label>
        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-full bg-forest py-3 font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Uploading..." : "Upload photo"}
        </button>
        {message && (
          <p className="text-sm font-medium text-forest sm:col-span-2">
            {message}
          </p>
        )}
      </form>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.id}
            className="overflow-hidden rounded-2xl border border-sand bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.image_url}
              alt={r.title}
              className="h-32 w-full object-cover"
            />
            <div className="p-3">
              <div className="truncate text-sm font-semibold text-forest-ink">
                {r.title}
              </div>
              <button
                onClick={() => remove(r)}
                className="mt-2 text-xs font-semibold text-bengal-red hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="col-span-full text-sm text-forest-ink/50">
            No photos yet. The public gallery is showing sample tiles until you
            upload the first one.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inputCls } from "@/components/admin/AdminShell";
import { parseVideo, videoThumbnail } from "@/lib/video";

type Row = {
  id: number;
  title: string;
  caption: string | null;
  image_url: string | null;
  palette: string;
  tall: boolean;
  media_type: "photo" | "video" | null;
  video_url: string | null;
};

const MAX_VIDEO_MB = 50;

export default function AdminGallery() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState<"photo" | "video">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tall, setTall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsSql, setNeedsSql] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("gallery_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(`Could not load: ${error.message}`);
      return;
    }
    const list = (data as Row[]) ?? [];
    setRows(list);
    setNeedsSql(list.length > 0 && !("media_type" in list[0]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setCaption("");
    setTall(false);
    setFile(null);
    setCover(null);
    setVideoUrl("");
    for (const id of ["media-file", "cover-file"]) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let record: Record<string, unknown>;
      if (kind === "photo") {
        if (!file) throw new Error("Choose a photo first.");
        const url = await uploadPhoto(file, "gallery");
        record = {
          title: title || file.name,
          caption: caption || null,
          image_url: url,
          tall,
          media_type: "photo",
          video_url: null,
        };
      } else {
        let link = videoUrl.trim();
        if (!link && !file) throw new Error("Paste a video link or choose a video file.");
        if (file) {
          if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
            throw new Error(
              `That video is over ${MAX_VIDEO_MB} MB. Upload it to YouTube and paste the link instead.`
            );
          }
          link = await uploadPhoto(file, "gallery-video");
        }
        const coverUrl = cover ? await uploadPhoto(cover, "gallery") : null;
        record = {
          title: title || "Video",
          caption: caption || null,
          image_url: coverUrl,
          tall,
          media_type: "video",
          video_url: link,
        };
      }
      const { error } = await getSupabase().from("gallery_items").insert(record);
      if (error) {
        if (/media_type|video_url/i.test(error.message)) {
          throw new Error(
            "The gallery table does not have the video columns yet. Run supabase/gallery_video.sql in the Supabase SQL editor, then try again."
          );
        }
        throw new Error(error.message);
      }
      resetForm();
      setMessage(kind === "photo" ? "Photo published." : "Video published.");
      await load();
    } catch (err) {
      setMessage(`Upload failed: ${err instanceof Error ? err.message : err}`);
    }
    setBusy(false);
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    await getSupabase().from("gallery_items").delete().eq("id", row.id);
    const paths = [row.image_url, row.video_url]
      .map((u) => (u ? u.split("/photos/")[1] : undefined))
      .filter((p): p is string => Boolean(p));
    if (paths.length) await getSupabase().storage.from("photos").remove(paths);
    await load();
  };

  const thumbOf = (r: Row): string | undefined =>
    r.image_url || (r.video_url ? videoThumbnail(r.video_url) : undefined);

  const kindBtn = (k: "photo" | "video", label: string) => (
    <button
      type="button"
      onClick={() => {
        setKind(k);
        setFile(null);
        const el = document.getElementById("media-file") as HTMLInputElement | null;
        if (el) el.value = "";
      }}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        kind === k ? "bg-forest text-cream" : "bg-cream-dim text-forest-ink/70 hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-ink">Gallery</h1>
      <p className="mt-1 text-sm text-forest-ink/60">
        Photos and videos. For videos, the easiest way is to paste a YouTube, Vimeo,
        or Facebook link; a file up to {MAX_VIDEO_MB} MB can be uploaded instead.
      </p>

      {needsSql && (
        <p className="mt-4 rounded-2xl bg-amber-100 px-5 py-3 text-sm text-amber-800">
          Videos need two new columns. Run supabase/gallery_video.sql in the Supabase
          SQL editor once. Photos keep working meanwhile.
        </p>
      )}

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        <div className="flex gap-2 sm:col-span-2">
          {kindBtn("photo", "Photo")}
          {kindBtn("video", "Video")}
        </div>

        {kind === "photo" ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-forest-ink">Photo</label>
            <input
              id="media-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputCls}
            />
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-forest-ink">
                Video link (YouTube, Vimeo, or Facebook)
              </label>
              <input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className={inputCls}
              />
              {videoUrl.trim() && (
                <p className="mt-1 text-xs text-forest-ink/50">
                  {(() => {
                    const v = parseVideo(videoUrl);
                    return v.type === "link"
                      ? "Not a known video site: the tile will open this address in a new tab."
                      : `Recognised as ${v.type === "file" ? "a video file" : v.type}.`;
                  })()}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-forest-ink">
                Or upload a video file (up to {MAX_VIDEO_MB} MB)
              </label>
              <input
                id="media-file"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-forest-ink">
                Cover picture (optional)
              </label>
              <input
                id="cover-file"
                type="file"
                accept="image/*"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-forest-ink/50">
                YouTube links get a thumbnail by themselves.
              </p>
            </div>
          </>
        )}

        <input
          placeholder="Title (shown on the tile)"
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
          <input type="checkbox" checked={tall} onChange={(e) => setTall(e.target.checked)} />
          Tall tile (portrait)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-forest py-3 font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Uploading..." : kind === "photo" ? "Upload photo" : "Add video"}
        </button>
        {message && (
          <p className="text-sm font-medium text-forest sm:col-span-2">{message}</p>
        )}
      </form>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {rows.map((r) => {
          const video = r.media_type === "video";
          const thumb = thumbOf(r);
          return (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
              <div className="relative h-32 w-full bg-forest-ink/80">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={r.title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs font-semibold uppercase tracking-widest text-white/70">
                    {video ? "Video" : "No picture"}
                  </div>
                )}
                {video && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Video
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-semibold text-forest-ink">{r.title}</div>
                <div className="mt-2 flex gap-3">
                  {video && r.video_url && (
                    <a
                      href={r.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-forest hover:underline"
                    >
                      Open
                    </a>
                  )}
                  <button
                    onClick={() => remove(r)}
                    className="text-xs font-semibold text-bengal-red hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="col-span-full text-sm text-forest-ink/50">
            Nothing yet. The public gallery shows sample tiles until you add the first
            photo or video.
          </p>
        )}
      </div>
    </div>
  );
}

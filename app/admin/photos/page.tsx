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
  event_slug: string | null;
};

type EventOption = { slug: string; title: string };

const MAX_VIDEO_MB = 50;

/** The value of the "no particular event" choice in the dropdowns. */
const GENERAL = "";

/**
 * The path inside the photos bucket for a public storage address, or nothing
 * when the address points somewhere else, such as a YouTube link.
 */
function storagePath(url: string | null): string | undefined {
  return url ? url.split("/photos/")[1] : undefined;
}

/** What is already saved against the picture being edited. */
type Existing = { imageUrl: string | null; videoUrl: string | null };

export default function AdminGallery() {
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventSlug, setEventSlug] = useState<string>(GENERAL);
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
  const [needsEventSql, setNeedsEventSql] = useState(false);
  // Which picture the form is changing, if any. Null means the form adds a
  // new one, which is how the page behaved before editing existed.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [existing, setExisting] = useState<Existing | null>(null);

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
    setNeedsEventSql(list.length > 0 && !("event_slug" in list[0]));
  }, []);

  const loadEvents = useCallback(async () => {
    const { data } = await getSupabase()
      .from("events")
      .select("slug,title")
      .order("date", { ascending: false });
    setEvents((data as EventOption[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    loadEvents();
  }, [load, loadEvents]);

  const resetForm = () => {
    setTitle("");
    setCaption("");
    setTall(false);
    setFile(null);
    setCover(null);
    setVideoUrl("");
    setEditingId(null);
    setEditingLabel("");
    setExisting(null);
    for (const id of ["media-file", "cover-file"]) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = "";
    }
  };

  /** Load one picture into the form above, the way the blog page does. */
  const beginEdit = (row: Row) => {
    setEditingId(row.id);
    setEditingLabel(row.title);
    setExisting({ imageUrl: row.image_url, videoUrl: row.video_url });
    setKind(row.media_type === "video" ? "video" : "photo");
    setTitle(row.title);
    setCaption(row.caption ?? "");
    setTall(row.tall);
    setEventSlug(row.event_slug ?? GENERAL);
    setVideoUrl(row.video_url ?? "");
    setFile(null);
    setCover(null);
    setMessage("");
    for (const id of ["media-file", "cover-file"]) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const editing = editingId !== null;
    // Files the picture used to point at, dropped only after the row has been
    // saved. Deleting them earlier would leave a broken tile if the save fails.
    const replaced: string[] = [];
    try {
      let record: Record<string, unknown>;
      if (kind === "photo") {
        if (!file && !editing) throw new Error("Choose a photo first.");
        let url = existing?.imageUrl ?? null;
        if (file) {
          const fresh = await uploadPhoto(file, "gallery");
          if (url && url !== fresh) replaced.push(url);
          url = fresh;
        }
        if (!url) throw new Error("Choose a photo first.");
        record = {
          title: title.trim() || file?.name || editingLabel || "Photo",
          caption: caption || null,
          image_url: url,
          tall,
          media_type: "photo",
          video_url: null,
          event_slug: eventSlug || null,
        };
        // Switching a video over to a photo leaves its old video file behind.
        if (editing && existing?.videoUrl) replaced.push(existing.videoUrl);
      } else {
        let link = videoUrl.trim();
        if (!link && !file && !editing) {
          throw new Error("Paste a video link or choose a video file.");
        }
        if (file) {
          if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
            throw new Error(
              `That video is over ${MAX_VIDEO_MB} MB. Upload it to YouTube and paste the link instead.`
            );
          }
          const fresh = await uploadPhoto(file, "gallery-video");
          if (existing?.videoUrl && existing.videoUrl !== fresh) {
            replaced.push(existing.videoUrl);
          }
          link = fresh;
        }
        if (!link) throw new Error("Paste a video link or choose a video file.");
        let coverUrl = existing?.imageUrl ?? null;
        if (cover) {
          const fresh = await uploadPhoto(cover, "gallery");
          if (coverUrl && coverUrl !== fresh) replaced.push(coverUrl);
          coverUrl = fresh;
        }
        record = {
          title: title.trim() || editingLabel || "Video",
          caption: caption || null,
          image_url: coverUrl,
          tall,
          media_type: "video",
          video_url: link,
          event_slug: eventSlug || null,
        };
      }
      const supabase = getSupabase();
      const { error } = editing
        ? await supabase.from("gallery_items").update(record).eq("id", editingId)
        : await supabase.from("gallery_items").insert(record);
      if (error) {
        if (/event_slug/i.test(error.message)) {
          throw new Error(
            "The gallery table does not have the event column yet. Run supabase/gallery_event.sql in the Supabase SQL editor, then try again."
          );
        }
        if (/media_type|video_url/i.test(error.message)) {
          throw new Error(
            "The gallery table does not have the video columns yet. Run supabase/gallery_video.sql in the Supabase SQL editor, then try again."
          );
        }
        throw new Error(error.message);
      }
      const dropped = replaced
        .map(storagePath)
        .filter((p): p is string => Boolean(p));
      if (dropped.length) await supabase.storage.from("photos").remove(dropped);
      resetForm();
      setMessage(
        editing
          ? "Changes saved. The website updates within a minute."
          : kind === "photo"
            ? "Photo published."
            : "Video published."
      );
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
      .map(storagePath)
      .filter((p): p is string => Boolean(p));
    if (paths.length) await getSupabase().storage.from("photos").remove(paths);
    if (editingId === row.id) resetForm();
    await load();
  };

  /** Move an existing picture to another event, or back to the general mix. */
  const assign = async (row: Row, slug: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, event_slug: slug || null } : r))
    );
    const { error } = await getSupabase()
      .from("gallery_items")
      .update({ event_slug: slug || null })
      .eq("id", row.id);
    if (error) {
      setMessage(`Could not change the event: ${error.message}`);
      await load();
    }
  };

  /** The event choices, shared by the upload form and each picture card. */
  const eventOptions = (
    <>
      <option value={GENERAL}>General — all events</option>
      {events.map((e) => (
        <option key={e.slug} value={e.slug}>
          {e.title}
        </option>
      ))}
    </>
  );

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
        Press Edit on any tile below to change its title, caption, event, or the
        picture itself.
      </p>

      {needsSql && (
        <p className="mt-4 rounded-2xl bg-amber-100 px-5 py-3 text-sm text-amber-800">
          Videos need two new columns. Run supabase/gallery_video.sql in the Supabase
          SQL editor once. Photos keep working meanwhile.
        </p>
      )}

      {needsEventSql && (
        <p className="mt-4 rounded-2xl bg-amber-100 px-5 py-3 text-sm text-amber-800">
          Tagging a picture to an event needs one new column. Run
          supabase/gallery_event.sql in the Supabase SQL editor once. Everything else
          keeps working meanwhile.
        </p>
      )}

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        {editingId !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-forest/10 px-4 py-3 sm:col-span-2">
            <span className="text-sm font-semibold text-forest">
              Editing &ldquo;{editingLabel}&rdquo;
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-forest/30 px-4 py-1.5 text-xs font-semibold text-forest hover:bg-white"
            >
              Cancel editing
            </button>
          </div>
        )}

        <div className="flex gap-2 sm:col-span-2">
          {kindBtn("photo", "Photo")}
          {kindBtn("video", "Video")}
        </div>

        {kind === "photo" ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-forest-ink">
              {editingId !== null ? "Replace photo (optional)" : "Photo"}
            </label>
            <input
              id="media-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputCls}
            />
            {editingId !== null && (
              <p className="mt-1 text-xs text-forest-ink/50">
                Leave this empty to keep the picture that is already there.
              </p>
            )}
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
                {editingId !== null
                  ? "Replace cover picture (optional)"
                  : "Cover picture (optional)"}
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

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-forest-ink">
            Event
          </label>
          <select
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
            className={inputCls}
          >
            {eventOptions}
          </select>
          <p className="mt-1 text-xs text-forest-ink/50">
            An event page shows its own pictures first, and the general ones when it
            has none of its own. This choice stays put between uploads.
          </p>
        </div>

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
          {busy
            ? editingId !== null
              ? "Saving..."
              : "Uploading..."
            : editingId !== null
              ? "Save changes"
              : kind === "photo"
                ? "Upload photo"
                : "Add video"}
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
            <div
              key={r.id}
              className={`overflow-hidden rounded-2xl border bg-white ${
                editingId === r.id
                  ? "border-forest ring-2 ring-forest/30"
                  : "border-sand"
              }`}
            >
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
                <select
                  value={r.event_slug ?? GENERAL}
                  onChange={(e) => assign(r, e.target.value)}
                  aria-label={`Event for ${r.title}`}
                  className="mt-2 w-full rounded-lg border border-sand bg-cream-dim px-2 py-1 text-xs text-forest-ink"
                >
                  {eventOptions}
                </select>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    onClick={() => beginEdit(r)}
                    className="text-xs font-semibold text-forest hover:underline"
                  >
                    Edit
                  </button>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/upload";
import { inputCls } from "@/components/admin/AdminShell";

type Row = {
  id: number;
  name: string;
  role: string;
  photo_url: string | null;
  sort_order: number;
};

export default function AdminCommittee() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("committee_members")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let photoUrl: string | null = null;
      if (file) photoUrl = await uploadPhoto(file, "committee");
      const { error } = await getSupabase().from("committee_members").insert({
        name,
        role,
        photo_url: photoUrl,
        sort_order: rows.length,
      });
      if (error) throw new Error(error.message);
      setName("");
      setRole("");
      setFile(null);
      (document.getElementById("member-photo") as HTMLInputElement).value = "";
      setMessage("Member added.");
      await load();
    } catch (err) {
      setMessage(`Save failed: ${err instanceof Error ? err.message : err}`);
    }
    setBusy(false);
  };

  const remove = async (r: Row) => {
    if (!confirm(`Remove ${r.name}?`)) return;
    await getSupabase().from("committee_members").delete().eq("id", r.id);
    await load();
  };

  const move = async (r: Row, dir: -1 | 1) => {
    const idx = rows.findIndex((x) => x.id === r.id);
    const other = rows[idx + dir];
    if (!other) return;
    const supabase = getSupabase();
    await supabase
      .from("committee_members")
      .update({ sort_order: other.sort_order })
      .eq("id", r.id);
    await supabase
      .from("committee_members")
      .update({ sort_order: r.sort_order })
      .eq("id", other.id);
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-ink">Committee members</h1>

      <form
        onSubmit={submit}
        className="mt-6 grid gap-4 rounded-3xl border border-sand bg-white p-6 sm:grid-cols-2"
      >
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <input
          required
          placeholder="Role, e.g. President, Treasurer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputCls}
        />
        <input
          id="member-photo"
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
          {busy ? "Saving..." : "Add member"}
        </button>
        {message && (
          <p className="text-sm font-medium text-forest sm:col-span-2">
            {message}
          </p>
        )}
      </form>

      <div className="mt-8 space-y-3">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-4 rounded-2xl border border-sand bg-white px-5 py-3"
          >
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.photo_url}
                alt={r.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 text-sm font-bold text-forest">
                {r.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-forest-ink">
                {r.name}
              </div>
              <div className="text-xs text-forest-ink/50">{r.role}</div>
            </div>
            <button
              onClick={() => move(r, -1)}
              disabled={i === 0}
              className="text-sm font-bold text-forest disabled:opacity-30"
              aria-label="Move up"
            >
              Up
            </button>
            <button
              onClick={() => move(r, 1)}
              disabled={i === rows.length - 1}
              className="text-sm font-bold text-forest disabled:opacity-30"
              aria-label="Move down"
            >
              Down
            </button>
            <button
              onClick={() => remove(r)}
              className="text-sm font-semibold text-bengal-red hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-forest-ink/50">
            No members yet. The public About page is showing sample names until
            you add the real committee.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "@/lib/admin-api";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Result = {
  outcome: "checked_in" | "already" | "not_paid" | "unknown" | "invalid" | "undone";
  message: string;
};

/**
 * Shown on the public ticket page only to someone signed in as an admin, so a
 * volunteer who scans a QR with the phone's own camera can check the person
 * in right there. Members never see it.
 */
export default function CheckInButton({ code, token }: { code: string; token: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)))
      .catch(() => setSignedIn(false));
  }, []);

  if (!signedIn) return null;

  const run = async (action?: "undo") => {
    setBusy(true);
    setError("");
    try {
      const res = await adminRequest<Result>("/api/admin/checkin", {
        code,
        token,
        ...(action ? { action } : {}),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
    setBusy(false);
  };

  const tone =
    result?.outcome === "checked_in"
      ? "bg-forest text-cream"
      : result?.outcome === "already"
        ? "bg-amber-100 text-amber-900"
        : result?.outcome === "undone"
          ? "bg-stone-200 text-stone-800"
          : "bg-bengal-red/10 text-bengal-red";

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-forest/40 p-4 text-left">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest">Volunteer</div>
      {result && (
        <p className={`mt-2 rounded-xl px-4 py-3 text-sm font-semibold ${tone}`}>{result.message}</p>
      )}
      {error && <p className="mt-2 text-sm font-medium text-bengal-red">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run()}
          className="rounded-full bg-forest px-6 py-2.5 text-sm font-bold text-cream disabled:opacity-60"
        >
          {busy ? "Working..." : "Check in"}
        </button>
        {(result?.outcome === "checked_in" || result?.outcome === "already") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run("undo")}
            className="rounded-full border border-sand px-6 py-2.5 text-sm font-semibold text-forest-ink/80"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import RegistrationTracker from "@/components/RegistrationTracker";

const inputCls =
  "w-full rounded-xl border border-sand bg-ivory px-4 py-3 text-forest-ink outline-none transition-colors placeholder:text-muted-ink/60 focus:border-forest focus:bg-white";

/** Code plus email form that opens the live tracker. */
export default function StatusLookup({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState<{ code: string; email: string } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const m = email.trim().toLowerCase();
    if (!c || !m) return;
    setQuery({ code: c, email: m });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form
        onSubmit={submit}
        className="rounded-3xl border border-sand bg-white p-6 shadow-sm md:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div>
            <label htmlFor="track-code" className="mb-1.5 block text-sm font-semibold text-forest-ink">
              Your code
            </label>
            <input
              id="track-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputCls} font-heading font-bold uppercase tracking-widest`}
              placeholder="R-XXXX"
            />
          </div>
          <div>
            <label htmlFor="track-email" className="mb-1.5 block text-sm font-semibold text-forest-ink">
              Email you registered with
            </label>
            <input
              id="track-email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-forest px-6 py-3 font-semibold text-ivory transition-colors hover:bg-forest-deep"
          >
            Check
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-ink">
          The code is in the email we sent you and on the screen after you registered.
        </p>
      </form>

      {query && (
        <RegistrationTracker key={`${query.code}:${query.email}`} code={query.code} email={query.email} />
      )}
    </div>
  );
}

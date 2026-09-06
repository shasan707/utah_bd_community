"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export const inputCls =
  "w-full rounded-xl border border-sand bg-white px-4 py-2.5 text-forest-ink outline-none transition-colors focus:border-forest";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/committee", label: "Committee" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/payments", label: "Payments" },
];

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError("Wrong email or password.");
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-forest-ink">Admin sign in</h1>
      <p className="mt-1 text-sm text-forest-ink/60">
        Use the admin account created in Supabase.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm font-medium text-bengal-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-forest py-3 font-semibold text-cream transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-5 pb-24 pt-32">
      {!supabaseConfigured ? (
        <p className="text-forest-ink/70">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart.
        </p>
      ) : loading ? (
        <p className="text-forest-ink/50">Loading...</p>
      ) : !session ? (
        <LoginForm />
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-center gap-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  pathname === n.href
                    ? "bg-forest text-cream"
                    : "bg-forest/10 text-forest hover:bg-forest/20"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <button
              onClick={() => getSupabase().auth.signOut()}
              className="ml-auto rounded-full border border-bengal-red px-4 py-2 text-sm font-semibold text-bengal-red hover:bg-bengal-red hover:text-white"
            >
              Sign out
            </button>
          </div>
          {children}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { PAYMENT_ADMIN_URL } from "@/lib/links";

type Counts = { photos: number; events: number; committee: number };

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const count = async (table: string) => {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    };
    Promise.all([
      count("gallery_items"),
      count("events"),
      count("committee_members"),
    ]).then(([photos, events, committee]) =>
      setCounts({ photos, events, committee })
    );
  }, []);

  const cards = [
    { href: "/admin/photos", label: "Gallery photos", value: counts?.photos },
    { href: "/admin/events", label: "Events", value: counts?.events },
    { href: "/admin/committee", label: "Committee members", value: counts?.committee },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-forest-ink">Utha USA Admin</h1>
      <p className="mt-1 text-forest-ink/60">
        What you change here appears on the public website within a minute.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-3xl border border-sand bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
          >
            <div className="text-4xl font-black text-forest">
              {c.value ?? "..."}
            </div>
            <div className="mt-1 text-sm font-semibold text-forest-ink/70">
              {c.label}
            </div>
            <div className="mt-3 text-sm font-semibold text-bengal-red">
              Manage
            </div>
          </Link>
        ))}
      </div>
      <a
        href={PAYMENT_ADMIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 block rounded-3xl border border-forest bg-forest p-6 text-cream shadow-sm transition-shadow hover:shadow-lg"
      >
        <div className="text-xl font-bold">Payment System</div>
        <p className="mt-1 text-sm text-cream/80">
          Registrations, Zelle payments, receipts, and the audit log. Opens the
          BPAU payment admin in a new tab (sign in with an approved Google
          account).
        </p>
        <div className="mt-3 text-sm font-semibold text-bengal-red">
          Open payment admin
        </div>
      </a>

      <p className="mt-8 text-sm text-forest-ink/50">
        Tip: as long as a section is empty, the public site shows its sample
        placeholder content. The moment you add the first real item, the real
        content takes over.
      </p>
    </div>
  );
}

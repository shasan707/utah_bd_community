"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type Counts = {
  photos: number;
  events: number;
  committee: number;
  pending: number;
  paid: number;
  collected: number;
  paymentsReady: boolean;
};

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
    const payments = async () => {
      const pending = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING");
      const paid = await supabase
        .from("registrations")
        .select("amount_received")
        .eq("status", "PAID");
      if (pending.error || paid.error) {
        return { pending: 0, paid: 0, collected: 0, paymentsReady: false };
      }
      const rows = paid.data ?? [];
      const collected = rows.reduce(
        (sum, r) => sum + (Number(r.amount_received) || 0),
        0
      );
      return {
        pending: pending.count ?? 0,
        paid: rows.length,
        collected,
        paymentsReady: true,
      };
    };
    Promise.all([
      count("gallery_items"),
      count("events"),
      count("committee_members"),
      payments(),
    ]).then(([photos, events, committee, pay]) =>
      setCounts({ photos, events, committee, ...pay })
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
      <Link
        href="/admin/payments"
        className="mt-5 block rounded-3xl border border-forest bg-forest p-6 text-cream shadow-sm transition-shadow hover:shadow-lg"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-xl font-bold">Payment System</div>
          {counts && counts.paymentsReady && (
            <div className="text-sm text-cream/80">
              <b className="text-cream">{counts.pending}</b> waiting for payment
              {" · "}
              <b className="text-cream">{counts.paid}</b> paid
              {" · "}
              <b className="text-cream">${counts.collected.toFixed(2)}</b>{" "}
              collected
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-cream/80">
          Registrations, Zelle payments, receipts, settings, and the audit log.
        </p>
        {counts && !counts.paymentsReady && (
          <p className="mt-2 text-sm text-cream/70">
            The payment tables are not set up yet. Run supabase/payments.sql in
            the Supabase SQL editor.
          </p>
        )}
        <div className="mt-3 text-sm font-semibold text-bengal-red">
          Open payments
        </div>
      </Link>

      <p className="mt-8 text-sm text-forest-ink/50">
        Tip: as long as a section is empty, the public site shows its sample
        placeholder content. The moment you add the first real item, the real
        content takes over.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Alpona from "@/components/Alpona";
import CheckInButton from "@/components/CheckInButton";
import { CODE_PATTERN, normalizeCode } from "@/lib/payments/codes";
import { formatDateOnly, formatInEventZone } from "@/lib/payments/dates";
import { money } from "@/lib/payments/pricing";
import { getSettings } from "@/lib/payments/settings";
import { qrImageUrl, verifyTicketToken } from "@/lib/payments/ticket";
import { parseRegistration } from "@/lib/payments/types";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your ticket | Bangladeshi Association of Utah",
  description: "Your admission ticket with the QR code scanned at the door.",
  robots: { index: false, follow: false },
};

/**
 * The page the ticket QR opens. Only a correctly signed link shows anything,
 * so the code alone reveals nothing. Members see their ticket large enough to
 * scan; a signed-in volunteer also gets a Check in button.
 */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code: rawCode } = await params;
  const { t } = await searchParams;
  const code = normalizeCode(decodeURIComponent(rawCode || ""));
  const token = String(t || "");
  if (!CODE_PATTERN.test(code) || !verifyTicketToken(code, token)) notFound();

  const [{ data, error }, s] = await Promise.all([
    getServiceClient().from("registrations").select("*").eq("code", code).maybeSingle(),
    getSettings(),
  ]);
  if (error || !data) notFound();
  const row = parseRegistration(data);

  const paid = row.status === "PAID";
  const people = row.adults + row.children;
  const admits =
    people > 0
      ? `${row.adults} adult${row.adults === 1 ? "" : "s"}${
          row.children ? `, ${row.children} child${row.children === 1 ? "" : "ren"}` : ""
        }`
      : "No seats (coupons or donation only)";

  const state = !paid
    ? {
        label: `Payment not confirmed yet (${row.status})`,
        cls: "bg-amber-100 text-amber-900",
      }
    : row.checked_in_at
      ? {
          label: `Checked in ${formatInEventZone(new Date(row.checked_in_at))}`,
          cls: "bg-stone-200 text-stone-800",
        }
      : { label: "Valid ticket", cls: "bg-forest text-cream" };

  return (
    <div>
      <section className="emerald-panel relative overflow-hidden pb-12 pt-36 text-ivory md:pt-40">
        <Alpona className="floral-soft absolute -right-24 -top-24 h-96 w-96" />
        <div className="relative mx-auto max-w-6xl px-5">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-mint">
            ✦ Admission ticket
          </span>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">{s.event_name}</h1>
          <p className="mt-3 text-lg text-ivory-dim">
            {formatDateOnly(s.event_date)}
            {s.event_time ? `, ${s.event_time}` : ""}
            {s.event_venue ? ` · ${s.event_venue}` : ""}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-5 py-12">
        <div className="rounded-3xl border border-sand bg-white p-7 text-center shadow-sm">
          <div className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${state.cls}`}>
            {state.label}
          </div>

          {paid ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImageUrl(code)}
              width={280}
              height={280}
              alt={`QR code for ticket ${code}`}
              className="mx-auto mt-6 h-[280px] w-[280px] rounded-2xl border border-sand"
            />
          ) : (
            <p className="mt-6 text-sm text-forest-ink/70">
              The QR code appears here once the payment is confirmed.{" "}
              <Link
                href={`/register/status?code=${encodeURIComponent(code)}`}
                className="font-semibold text-forest underline"
              >
                Track your registration
              </Link>
              .
            </p>
          )}

          <div className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-forest-ink/50">
            Ticket number
          </div>
          <div className="font-heading mt-1 text-4xl font-black tracking-[0.15em] text-forest">
            {code}
          </div>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
            <dt className="text-forest-ink/60">Ticket holder</dt>
            <dd className="font-semibold text-forest-ink">{row.name}</dd>
            <dt className="text-forest-ink/60">Admits</dt>
            <dd className="font-semibold text-forest-ink">{admits}</dd>
            {row.coupons_qty > 0 && (
              <>
                <dt className="text-forest-ink/60">Food coupons</dt>
                <dd className="font-semibold text-forest-ink">{row.coupons_qty}</dd>
              </>
            )}
            {paid && (
              <>
                <dt className="text-forest-ink/60">Paid</dt>
                <dd className="font-semibold text-forest-ink">
                  {money(row.amount_received ?? row.amount_due)}
                  {row.payment_method ? ` via ${row.payment_method}` : ""}
                </dd>
              </>
            )}
          </dl>

          <p className="mt-6 text-sm text-forest-ink/70">
            Show this screen at the check-in desk, or just give your name.
          </p>

          <CheckInButton code={code} token={token} />
        </div>
      </section>
    </div>
  );
}

/**
 * Pricing math shared by the public form (live estimate in the browser) and
 * the server (the amount that is actually charged). Keep this file free of
 * server imports so both sides can use it.
 */

export type PriceTable = {
  price_adult: number;
  price_child: number;
  price_student: number;
  coupon_single: number;
  coupon_bundle_qty: number;
  coupon_bundle_price: number;
};

/** What the public pages are allowed to see. */
export type Pricing = PriceTable & {
  event_name: string;
  event_date: string;
  event_time: string;
  event_venue: string;
  registration_closes: string;
  zelle_recipient: string;
  zelle_recipient_name: string;
  contact_email: string;
};

/**
 * The student ticket is no longer offered: it is gone from the registration
 * form, from the admin settings, and from every price list. The type and the
 * student price stay because the database still accepts the value, and a
 * registration taken before this change must still price and print correctly.
 * Nothing new can be created as a student.
 */
export type TicketType = "professional" | "student";

export type LineItems = {
  adults: number;
  children: number;
  ticket_type: TicketType;
  coupons_qty: number;
  donation: number;
};

export function money(n: number): string {
  return "$" + Number(n).toFixed(2);
}

/** Like money(), but a price of zero reads as "Free". */
export function priceLabel(n: number): string {
  return Number(n) > 0 ? money(n) : "Free";
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** How many coupons come in one bundle. Never zero, so the maths stays safe. */
export function bundleSize(p: PriceTable): number {
  return p.coupon_bundle_qty > 0 ? p.coupon_bundle_qty : 10;
}

/** Bundles of coupon_bundle_qty at the bundle price, the rest at single price. */
export function couponCost(qty: number, p: PriceTable): number {
  const size = bundleSize(p);
  return (
    Math.floor(qty / size) * p.coupon_bundle_price + (qty % size) * p.coupon_single
  );
}

/** "23 raffle draw coupons (2 bundles of 10 + 3 single)" */
export function couponSummary(qty: number, p: PriceTable): string {
  const size = bundleSize(p);
  const bundles = Math.floor(qty / size);
  const singles = qty % size;
  const head = `${qty} raffle draw coupon${qty > 1 ? "s" : ""}`;
  if (bundles === 0) return head;
  const parts = [`${bundles} bundle${bundles > 1 ? "s" : ""} of ${size}`];
  if (singles > 0) parts.push(`${singles} single`);
  return `${head} (${parts.join(" + ")})`;
}

export function perAdultPrice(ticket: TicketType, p: PriceTable): number {
  return ticket === "student" ? p.price_student : p.price_adult;
}

export function computeAmount(items: LineItems, p: PriceTable): number {
  return roundCents(
    items.adults * perAdultPrice(items.ticket_type, p) +
      items.children * p.price_child +
      couponCost(items.coupons_qty, p) +
      items.donation
  );
}

/** Human-readable lines, e.g. "2 adults @ $25.00 = $50.00". */
export function breakdownLines(items: LineItems, p: PriceTable): string[] {
  const lines: string[] = [];
  const adultPrice = perAdultPrice(items.ticket_type, p);
  const label = items.ticket_type === "student" ? "student" : "adult";
  if (items.adults > 0) {
    lines.push(
      `${items.adults} ${label}${items.adults > 1 ? "s" : ""} @ ${money(
        adultPrice
      )} = ${money(items.adults * adultPrice)}`
    );
  }
  if (items.children > 0) {
    const kids = `${items.children} child${items.children > 1 ? "ren" : ""}`;
    lines.push(
      p.price_child > 0
        ? `${kids} @ ${money(p.price_child)} = ${money(
            items.children * p.price_child
          )}`
        : `${kids} under 10 = free`
    );
  }
  if (items.coupons_qty > 0) {
    lines.push(
      `${couponSummary(items.coupons_qty, p)} = ${money(
        couponCost(items.coupons_qty, p)
      )}`
    );
  }
  if (items.donation > 0) lines.push(`Donation = ${money(items.donation)}`);
  return lines;
}

/** The three entry fees, for the pages that show what the event costs. */
export function feeItems(p: PriceTable): { label: string; value: string }[] {
  return [
    { label: "Adult", value: priceLabel(p.price_adult) },
    { label: "Under 10", value: priceLabel(p.price_child) },
  ];
}

/** One code per payment, prefixed by what the payment is mostly for. */
export function codePrefix(items: LineItems): "R" | "C" | "D" {
  if (items.adults + items.children > 0) return "R";
  return items.coupons_qty > 0 ? "C" : "D";
}

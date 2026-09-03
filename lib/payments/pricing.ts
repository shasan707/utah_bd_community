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
  registration_closes: string;
  zelle_recipient: string;
  zelle_recipient_name: string;
  contact_email: string;
};

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

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Bundles of coupon_bundle_qty at the bundle price, the rest at single price. */
export function couponCost(qty: number, p: PriceTable): number {
  const bundleQty = p.coupon_bundle_qty > 0 ? p.coupon_bundle_qty : 10;
  const bundles = Math.floor(qty / bundleQty);
  const singles = qty % bundleQty;
  return bundles * p.coupon_bundle_price + singles * p.coupon_single;
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
    lines.push(
      `${items.children} child${items.children > 1 ? "ren" : ""} @ ${money(
        p.price_child
      )} = ${money(items.children * p.price_child)}`
    );
  }
  if (items.coupons_qty > 0) {
    lines.push(
      `${items.coupons_qty} coupons = ${money(couponCost(items.coupons_qty, p))}`
    );
  }
  if (items.donation > 0) lines.push(`Donation = ${money(items.donation)}`);
  return lines;
}

/** One code per payment, prefixed by what the payment is mostly for. */
export function codePrefix(items: LineItems): "R" | "C" | "D" {
  if (items.adults + items.children > 0) return "R";
  return items.coupons_qty > 0 ? "C" : "D";
}

/**
 * Pricing math shared by the public form (live estimate in the browser) and
 * the server (the amount that is actually charged). Keep this file free of
 * server imports so both sides can use it.
 */

export type PriceTable = {
  /** 16 and over. */
  price_adult: number;
  /** Under 10. Free at the moment. */
  price_child: number;
  /** 10 to 16. */
  price_youth: number;
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
 * The student ticket is no longer offered, and the seats are priced by age
 * instead. The type stays only because the database column does, and a row
 * written before the change still has to read back; nothing sets it now.
 */
export type TicketType = "professional" | "student";

/**
 * Who is coming, by age band. The bands do not overlap: someone is an adult
 * at 16, youth from 10 to 16, a child below that.
 */
export type LineItems = {
  /** 16 and over. */
  adults: number;
  /** 10 to 16. */
  youth: number;
  /** Under 10. */
  children: number;
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

export function computeAmount(items: LineItems, p: PriceTable): number {
  return roundCents(
    items.adults * p.price_adult +
      items.youth * p.price_youth +
      items.children * p.price_child +
      couponCost(items.coupons_qty, p) +
      items.donation
  );
}

/** How many people a registration admits. */
export function headcount(items: {
  adults: number;
  youth: number;
  children: number;
}): number {
  return items.adults + items.youth + items.children;
}

/**
 * "2 adults, 1 youth, 3 children", for tickets, receipts and the admin.
 * Written once here so the three bands cannot be listed differently in the
 * four places that show them.
 */
export function partySummary(items: {
  adults: number;
  youth: number;
  children: number;
}): string {
  const parts: string[] = [];
  if (items.adults > 0) {
    parts.push(`${items.adults} adult${items.adults === 1 ? "" : "s"}`);
  }
  if (items.youth > 0) parts.push(`${items.youth} youth`);
  if (items.children > 0) {
    parts.push(`${items.children} child${items.children === 1 ? "" : "ren"}`);
  }
  return parts.join(", ");
}

/** Human-readable lines, e.g. "2 adults @ $25.00 = $50.00". */
export function breakdownLines(items: LineItems, p: PriceTable): string[] {
  const lines: string[] = [];
  if (items.adults > 0) {
    lines.push(
      `${items.adults} adult${items.adults > 1 ? "s" : ""} @ ${money(
        p.price_adult
      )} = ${money(items.adults * p.price_adult)}`
    );
  }
  if (items.youth > 0) {
    lines.push(
      `${items.youth} youth (10 to 16) @ ${money(p.price_youth)} = ${money(
        items.youth * p.price_youth
      )}`
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

/** The entry fees by age band, for the pages that show what the event costs. */
export function feeItems(p: PriceTable): { label: string; value: string }[] {
  return [
    { label: "Adult (16+)", value: priceLabel(p.price_adult) },
    { label: "Youth (10 to 16)", value: priceLabel(p.price_youth) },
    { label: "Child (under 10)", value: priceLabel(p.price_child) },
  ];
}

/** One code per payment, prefixed by what the payment is mostly for. */
export function codePrefix(items: LineItems): "R" | "C" | "D" {
  if (headcount(items) > 0) return "R";
  return items.coupons_qty > 0 ? "C" : "D";
}

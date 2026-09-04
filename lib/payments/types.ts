import type { TicketType } from "./pricing";

export type { TicketType };

export const STATUSES = [
  "PENDING",
  "PAID",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type Status = (typeof STATUSES)[number];

export const METHODS = ["zelle", "cash", "venmo", "check", "comp"] as const;
export type PaymentMethod = (typeof METHODS)[number];

export function isMethod(v: unknown): v is PaymentMethod {
  return METHODS.includes(v as PaymentMethod);
}

export type RegistrationRow = {
  code: string;
  created_at: string;
  name: string;
  phone: string;
  email: string;
  adults: number;
  children: number;
  ticket_type: TicketType;
  coupons_qty: number;
  donation: number;
  comment: string;
  amount_due: number;
  status: Status;
  payment_method: PaymentMethod | null;
  amount_received: number | null;
  paid_at: string | null;
  zelle_confirmation_id: string | null;
  zelle_sender_name: string | null;
  receipt_sent_at: string | null;
  pending_email_sent_at: string | null;
  email_error: string | null;
  created_by: string;
  announcements_opt_in: boolean;
  notes: string;
  client_ip: string | null;
};

export const MATCH_STATUSES = [
  "UNMATCHED",
  "MATCHED",
  "AMOUNT_MISMATCH",
  "DUPLICATE",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export type PaymentSource = "admin" | "email" | "import";

/** One Zelle transaction as seen by the treasurer or relayed from the bank email. */
export type PaymentRow = {
  id: number;
  confirmation_id: string;
  received_at: string;
  sender_name: string;
  amount: number;
  memo_raw: string;
  memo_normalized: string;
  extracted_code: string;
  match_status: MatchStatus;
  linked_code: string | null;
  suggested_code: string | null;
  processed_at: string | null;
  source: PaymentSource;
  message_id: string | null;
  created_at: string;
};

export function parsePayment(raw: Record<string, unknown>): PaymentRow {
  return {
    id: num(raw.id),
    confirmation_id: str(raw.confirmation_id),
    received_at: str(raw.received_at),
    sender_name: str(raw.sender_name),
    amount: num(raw.amount),
    memo_raw: str(raw.memo_raw),
    memo_normalized: str(raw.memo_normalized),
    extracted_code: str(raw.extracted_code),
    match_status: MATCH_STATUSES.includes(raw.match_status as MatchStatus)
      ? (raw.match_status as MatchStatus)
      : "UNMATCHED",
    linked_code: strOrNull(raw.linked_code),
    suggested_code: strOrNull(raw.suggested_code),
    processed_at: strOrNull(raw.processed_at),
    source:
      raw.source === "email" || raw.source === "import" ? raw.source : "admin",
    message_id: strOrNull(raw.message_id),
    created_at: str(raw.created_at),
  };
}

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity_code: string | null;
  before: unknown;
  after: unknown;
  note: string;
};

export type SettingsRow = {
  key: string;
  value: string;
  updated_at: string;
};

/** Column order of the CSV export, same as the old Registrations sheet. */
export const EXPORT_COLUMNS: (keyof RegistrationRow)[] = [
  "code",
  "created_at",
  "name",
  "phone",
  "email",
  "adults",
  "children",
  "ticket_type",
  "coupons_qty",
  "donation",
  "comment",
  "amount_due",
  "status",
  "payment_method",
  "amount_received",
  "paid_at",
  "zelle_confirmation_id",
  "zelle_sender_name",
  "receipt_sent_at",
  "created_by",
  "announcements_opt_in",
  "notes",
];

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : num(v);
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function strOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

/**
 * Converts a raw PostgREST row into a typed row. PostgREST sends numeric
 * columns as strings, so every number is converted here and nowhere else.
 */
export function parseRegistration(raw: Record<string, unknown>): RegistrationRow {
  return {
    code: str(raw.code),
    created_at: str(raw.created_at),
    name: str(raw.name),
    phone: str(raw.phone),
    email: str(raw.email),
    adults: num(raw.adults),
    children: num(raw.children),
    ticket_type: raw.ticket_type === "student" ? "student" : "professional",
    coupons_qty: num(raw.coupons_qty),
    donation: num(raw.donation),
    comment: str(raw.comment),
    amount_due: num(raw.amount_due),
    status: STATUSES.includes(raw.status as Status)
      ? (raw.status as Status)
      : "PENDING",
    payment_method: isMethod(raw.payment_method) ? raw.payment_method : null,
    amount_received: numOrNull(raw.amount_received),
    paid_at: strOrNull(raw.paid_at),
    zelle_confirmation_id: strOrNull(raw.zelle_confirmation_id),
    zelle_sender_name: strOrNull(raw.zelle_sender_name),
    receipt_sent_at: strOrNull(raw.receipt_sent_at),
    pending_email_sent_at: strOrNull(raw.pending_email_sent_at),
    email_error: strOrNull(raw.email_error),
    created_by: str(raw.created_by) || "web",
    announcements_opt_in: Boolean(raw.announcements_opt_in),
    notes: str(raw.notes),
    client_ip: strOrNull(raw.client_ip),
  };
}

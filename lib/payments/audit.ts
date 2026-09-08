import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";

export type AuditAction =
  | "REGISTRATION_CREATED"
  | "AUTO_CONFIRMED"
  | "AUTO_EXPIRED"
  | "MARK_PAID"
  | "LINK_PAYMENT"
  | "MISMATCH_ACCEPTED"
  | "MISMATCH_NOTED"
  | "ADMIN_CREATED"
  | "ADJUST_AMOUNT"
  | "CANCELLED"
  | "REFUNDED"
  | "RESEND_RECEIPT"
  | "MERGE"
  | "PAYMENT_IGNORED"
  | "CHECK_IN"
  | "CHECK_IN_UNDO";

/**
 * Writes one audit row. Called after every change to money. If the log
 * cannot be written the caller's request fails loudly rather than leaving a
 * silent gap; the change itself is already saved and a retry gets a clear
 * "already done" answer from the status guards.
 */
export async function audit(
  actor: string,
  action: AuditAction,
  entityCode: string | null,
  before: unknown,
  after: unknown,
  note = ""
): Promise<void> {
  const { error } = await getServiceClient().from("audit_log").insert({
    actor: actor || "system",
    action,
    entity_code: entityCode,
    before: before ?? null,
    after: after ?? null,
    note: note || "",
  });
  if (error) {
    throw new ApiError(
      500,
      `The change was saved but the audit log could not be written: ${error.message}`
    );
  }
}

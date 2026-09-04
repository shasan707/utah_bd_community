import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { senderName } from "@/lib/email";
import { noteEmailDelivered, noteEmailFailed } from "./registrations";

/**
 * The email outbox behind EMAIL_PROVIDER=relay. The website queues emails
 * (lib/email.ts); the script in the BPAU Gmail claims them here, sends them
 * with MailApp, and reports back so the registration rows show "code emailed"
 * and "receipt sent" just as they do with a direct provider.
 */

const TABLE = "email_outbox";
const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 15;

export type OutboxMessage = {
  id: number;
  to: string;
  subject: string;
  text: string;
  reply_to: string;
  from_name: string;
};

export type OutboxReport = {
  id: number;
  ok: boolean;
  error?: string;
  /** True when the failure is temporary (daily quota), so it never counts as an attempt. */
  retry?: boolean;
};

type OutboxRow = {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  reply_to: string;
  kind: string;
  code: string | null;
  status: string;
  attempts: number;
};

function readError(where: string, message: string): ApiError {
  return new ApiError(500, `Could not ${where} the email outbox: ${message}`);
}

/**
 * Hands out queued emails, oldest first, and marks them "sending". A message
 * that was handed out but never reported (the script died) is handed out
 * again after the lease runs out.
 */
export async function claimQueued(limit: number): Promise<OutboxMessage[]> {
  const db = getServiceClient();
  const staleBefore = new Date(Date.now() - LEASE_MINUTES * 60_000).toISOString();
  const [fresh, stale] = await Promise.all([
    db.from(TABLE).select("*").eq("status", "queued").order("created_at").limit(limit),
    db
      .from(TABLE)
      .select("*")
      .eq("status", "sending")
      .lt("leased_at", staleBefore)
      .order("created_at")
      .limit(limit),
  ]);
  if (fresh.error) throw readError("read", fresh.error.message);
  if (stale.error) throw readError("read", stale.error.message);

  const rows = [...(fresh.data ?? []), ...(stale.data ?? [])].slice(0, limit) as OutboxRow[];
  const now = new Date().toISOString();
  const fromName = senderName();
  const claimed: OutboxMessage[] = [];
  for (const row of rows) {
    // The status filter means two overlapping claims never hand out the same row.
    const { data, error } = await db
      .from(TABLE)
      .update({ status: "sending", leased_at: now, attempts: row.attempts + 1 })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (error) throw readError("update", error.message);
    if (!data) continue;
    claimed.push({
      id: row.id,
      to: row.to_email,
      subject: row.subject,
      text: row.body,
      reply_to: row.reply_to,
      from_name: fromName,
    });
  }
  return claimed;
}

/** Open (queued or sending) emails still waiting for one registration. */
async function openCountFor(code: string): Promise<number> {
  const { count, error } = await getServiceClient()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("code", code)
    .in("status", ["queued", "sending"]);
  if (error) return 1; // unknown: leave the "queued" mark alone
  return count ?? 0;
}

export type ReportSummary = { sent: number; retry: number; failed: number; unknown: number };

/** Records what the script did with each claimed email and updates the registrations. */
export async function reportResults(results: OutboxReport[]): Promise<ReportSummary> {
  const db = getServiceClient();
  const summary: ReportSummary = { sent: 0, retry: 0, failed: 0, unknown: 0 };

  for (const r of results) {
    const { data, error } = await db.from(TABLE).select("*").eq("id", r.id).maybeSingle();
    if (error) throw readError("read", error.message);
    if (!data) {
      summary.unknown++;
      continue;
    }
    const row = data as OutboxRow;
    if (row.status === "sent") continue; // reported twice; nothing to do
    const now = new Date().toISOString();
    const forRegistration =
      Boolean(row.code) && (row.kind === "pending" || row.kind === "receipt");

    if (r.ok) {
      const { error: upErr } = await db
        .from(TABLE)
        .update({ status: "sent", sent_at: now, error: "", leased_at: null })
        .eq("id", r.id);
      if (upErr) throw readError("update", upErr.message);
      summary.sent++;
      if (forRegistration) {
        const stillOpen = await openCountFor(row.code as string);
        await noteEmailDelivered(
          row.code as string,
          row.kind as "pending" | "receipt",
          now,
          stillOpen === 0
        );
      }
      continue;
    }

    const detail = String(r.error || "send failed").slice(0, 300);
    const giveUp = !r.retry && row.attempts >= MAX_ATTEMPTS;
    const { error: upErr } = await db
      .from(TABLE)
      .update({ status: giveUp ? "failed" : "queued", error: detail, leased_at: null })
      .eq("id", r.id);
    if (upErr) throw readError("update", upErr.message);
    if (giveUp) {
      summary.failed++;
      if (forRegistration) await noteEmailFailed(row.code as string, `relay ${detail}`);
    } else {
      summary.retry++;
    }
  }
  return summary;
}

import {
  ApiError,
  jsonError,
  jsonOk,
  readJsonBody,
  secretMatches,
} from "@/lib/supabase-server";
import { ingestEmails, type InboundMessage } from "@/lib/payments/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 50;

/**
 * Receives bank alert emails from the Gmail relay (apps-script/Zelle.gs).
 * Auth: "Authorization: Bearer <ZELLE_INBOUND_SECRET>". Idempotent: a message
 * id that was seen before is skipped, so the relay can safely resend.
 */
export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!secretMatches(token, process.env.ZELLE_INBOUND_SECRET)) {
      throw new ApiError(401, "Not authorized.");
    }

    const body = await readJsonBody(req, 2_500_000);
    const list = Array.isArray(body.messages) ? body.messages : [];
    if (list.length === 0) throw new ApiError(400, "No messages.");
    if (list.length > MAX_MESSAGES) {
      throw new ApiError(400, `Send at most ${MAX_MESSAGES} messages per call.`);
    }

    const messages: InboundMessage[] = list.map((m: unknown) => {
      const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
      const id = String(o.message_id ?? "").trim();
      if (!id) throw new ApiError(400, "Every message needs a message_id.");
      return {
        message_id: id.slice(0, 200),
        received_at: String(o.received_at ?? ""),
        subject: String(o.subject ?? ""),
        body: String(o.body ?? ""),
      };
    });

    return jsonOk(await ingestEmails(messages));
  } catch (err) {
    return jsonError(err);
  }
}

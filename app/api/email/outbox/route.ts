import {
  ApiError,
  jsonError,
  jsonOk,
  readJsonBody,
  secretMatches,
} from "@/lib/supabase-server";
import { emailProvider } from "@/lib/email";
import {
  claimQueued,
  reportResults,
  type OutboxReport,
} from "@/lib/payments/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_CALL = 50;

/**
 * The email outbox for the Gmail relay (apps-script/Zelle.gs, sendQueuedEmails).
 * Auth: "Authorization: Bearer <ZELLE_INBOUND_SECRET>", the same secret the
 * Zelle relay uses.
 *
 *   GET  ?limit=N   claims up to N queued emails and returns them to send.
 *   POST {results}  reports what happened to each one: {id, ok, error?, retry?}.
 */

function authorize(req: Request): void {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!secretMatches(token, process.env.ZELLE_INBOUND_SECRET)) {
    throw new ApiError(401, "Not authorized.");
  }
}

export async function GET(req: Request) {
  try {
    authorize(req);
    const raw = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(MAX_PER_CALL, Math.floor(raw)) : 20;
    const messages = await claimQueued(limit);
    return jsonOk({ provider: emailProvider(), messages });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    authorize(req);
    const body = await readJsonBody(req, 200_000);
    const list = Array.isArray(body.results) ? body.results : [];
    if (list.length === 0) throw new ApiError(400, "No results.");
    if (list.length > MAX_PER_CALL) {
      throw new ApiError(400, `Send at most ${MAX_PER_CALL} results per call.`);
    }

    const results: OutboxReport[] = list.map((r: unknown) => {
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const id = Number(o.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ApiError(400, "Every result needs the id it was given.");
      }
      return {
        id,
        ok: o.ok === true,
        error: o.error ? String(o.error).slice(0, 300) : undefined,
        retry: o.retry === true,
      };
    });

    return jsonOk(await reportResults(results));
  } catch (err) {
    return jsonError(err);
  }
}

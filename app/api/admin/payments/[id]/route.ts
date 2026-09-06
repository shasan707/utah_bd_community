import {
  ApiError,
  jsonError,
  jsonOk,
  readJsonBody,
  requireAdmin,
} from "@/lib/supabase-server";
import { CODE_PATTERN, normalizeCode } from "@/lib/payments/codes";
import { ignorePayment, linkPayment, resolveMismatch } from "@/lib/payments/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Link an unmatched payment to a code, or settle an amount mismatch. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ApiError(400, "Bad payment id.");
    }
    const body = await readJsonBody(req);

    switch (body.action) {
      case "link": {
        const code = normalizeCode(String(body.code ?? ""));
        if (!CODE_PATTERN.test(code)) {
          throw new ApiError(400, "That does not look like a registration code.");
        }
        return jsonOk(await linkPayment(id, code, admin.email));
      }
      case "accept_mismatch":
        return jsonOk(await resolveMismatch(id, "accept", body.note, admin.email));
      case "note_mismatch":
        return jsonOk(await resolveMismatch(id, "note", body.note, admin.email));
      case "ignore":
        return jsonOk(await ignorePayment(id, body.note, admin.email));
      default:
        throw new ApiError(400, "Unknown action.");
    }
  } catch (err) {
    return jsonError(err);
  }
}

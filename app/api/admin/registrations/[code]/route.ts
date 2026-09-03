import {
  ApiError,
  jsonError,
  jsonOk,
  readJsonBody,
  requireAdmin,
} from "@/lib/supabase-server";
import { CODE_PATTERN, normalizeCode } from "@/lib/payments/codes";
import {
  adjustAmount,
  markPaid,
  mergeInto,
  resendReceipt,
  voidRegistration,
  type ActionResult,
} from "@/lib/payments/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCode(raw: string): string {
  const code = normalizeCode(decodeURIComponent(raw));
  if (!CODE_PATTERN.test(code)) {
    throw new ApiError(400, "That does not look like a registration code.");
  }
  return code;
}

/**
 * One endpoint per registration; the body says which action to take.
 * Every action writes the audit log with the signed-in admin's email.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { code: raw } = await ctx.params;
    const code = parseCode(raw);
    const body = await readJsonBody(req);

    let result: ActionResult;
    switch (body.action) {
      case "mark_paid":
        result = await markPaid(
          code,
          { method: body.method, amount: body.amount, note: body.note },
          admin.email
        );
        break;
      case "adjust_amount":
        result = await adjustAmount(code, body.amount, body.note, admin.email);
        break;
      case "void":
        result = await voidRegistration(code, body.reason, admin.email);
        break;
      case "resend_receipt":
        result = await resendReceipt(code, admin.email);
        break;
      case "merge_into": {
        const keep = parseCode(String(body.keep_code ?? ""));
        result = await mergeInto(keep, code, admin.email);
        break;
      }
      default:
        throw new ApiError(400, "Unknown action.");
    }
    return jsonOk({ message: result.message, registration: result.row });
  } catch (err) {
    return jsonError(err);
  }
}

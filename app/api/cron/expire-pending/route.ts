import {
  jsonError,
  jsonOk,
  requireAdmin,
  secretMatches,
} from "@/lib/supabase-server";
import { getSettings } from "@/lib/payments/settings";
import { expirePending } from "@/lib/payments/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json): unpaid PENDING codes older than
 * pending_expiry_hours become EXPIRED. Vercel calls it with
 * "Authorization: Bearer <CRON_SECRET>"; a signed-in admin can also run it
 * from the Payments page.
 */
export async function GET(req: Request) {
  try {
    const header = req.headers.get("authorization") || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    let actor = "cron";
    if (!secretMatches(token, process.env.CRON_SECRET)) {
      const admin = await requireAdmin(req);
      actor = admin.email;
    }

    const settings = await getSettings();
    const expired = await expirePending(settings.pending_expiry_hours, actor);
    return jsonOk({ expired, hours: settings.pending_expiry_hours });
  } catch (err) {
    return jsonError(err);
  }
}

import {
  jsonError,
  jsonOk,
  readJsonBody,
  requireAdmin,
} from "@/lib/supabase-server";
import { recordManualPayment } from "@/lib/payments/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A Zelle transaction typed in by the treasurer from the bank app. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const result = await recordManualPayment(body, admin.email);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

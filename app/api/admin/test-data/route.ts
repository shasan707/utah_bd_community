import { jsonError, jsonOk, requireAdmin } from "@/lib/supabase-server";
import { deleteTestData } from "@/lib/payments/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Removes every rehearsal row. Only rows flagged is_test are touched; the
 * function refuses to key any delete on anything else, so a member's row
 * cannot be reached from here however the request is shaped.
 */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const r = await deleteTestData(admin.email);
    return jsonOk({
      ...r,
      message:
        r.registrations === 0
          ? "No test data to remove."
          : `Removed ${r.registrations} test registration${r.registrations === 1 ? "" : "s"} and ${r.payments} test payment${r.payments === 1 ? "" : "s"}.`,
    });
  } catch (err) {
    return jsonError(err);
  }
}

import { jsonOk } from "@/lib/supabase-server";
import { getRegistrationStatus } from "@/lib/payments/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public pricing snapshot plus whether registration is open right now. */
export async function GET() {
  const status = await getRegistrationStatus();
  return jsonOk({
    registration_open: status.open,
    reason: status.reason,
    pricing: status.pricing,
  });
}

import { jsonError, jsonOk, requireAdmin, serviceConfigured } from "@/lib/supabase-server";
import { emailProvider } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the server has configured, for the header of the Payments page. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    return jsonOk({
      admin_email: admin.email,
      service_configured: serviceConfigured,
      email_provider: emailProvider(),
      cron_secret_set: Boolean(process.env.CRON_SECRET),
      inbound_secret_set: Boolean(process.env.ZELLE_INBOUND_SECRET),
    });
  } catch (err) {
    return jsonError(err);
  }
}

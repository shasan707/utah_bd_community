import { redirect } from "next/navigation";
import { getEvents, next } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * /event always goes to the current event's page. It exists so the navbar,
 * the texts and the emails can carry one short, permanent address that
 * needs no editing when the event changes: bdutah.jotillabs.com/event.
 */
export async function GET() {
  const current = next(await getEvents());
  redirect(`/events/${encodeURIComponent(current.slug)}`);
}

import "server-only";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * How many people are coming: seats on paid registrations that are not
 * rehearsals. Shown on the event page and the home ribbon as one plain
 * aggregate, never a name.
 *
 * Paid only, because "coming" means the money landed; a pending code may
 * never be paid. Read on the server with the service key, so the number
 * reaches the browser and the table never does. The pages that show it
 * refresh every 60 seconds, so it stays within a minute of true.
 *
 * Under the floor it reports zero, and the pages show nothing: "3 people are
 * coming" empties a room rather than filling it.
 */
export const ATTENDANCE_FLOOR = 10;

export type Attendance = { people: number; families: number };

export async function attendance(): Promise<Attendance> {
  try {
    const { data, error } = await getServiceClient()
      .from("registrations")
      .select("adults,youth,children")
      .eq("status", "PAID")
      .eq("is_test", false);
    if (error || !data) return { people: 0, families: 0 };
    const people = data.reduce(
      (n, r) => n + Number(r.adults ?? 0) + Number(r.youth ?? 0) + Number(r.children ?? 0),
      0
    );
    if (people < ATTENDANCE_FLOOR) return { people: 0, families: 0 };
    return { people, families: data.length };
  } catch {
    // A count is decoration. A page must never fail for want of it.
    return { people: 0, families: 0 };
  }
}

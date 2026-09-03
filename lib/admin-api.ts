import { getSupabase } from "@/lib/supabase";

/**
 * Browser helper for the admin API routes. Sends the signed-in admin's
 * Supabase access token so the server can verify who is acting.
 */

type Envelope<T> = { ok: true; result: T } | { ok: false; error: string };

export async function adminRequest<T = unknown>(
  path: string,
  body?: unknown,
  method: "GET" | "POST" | "PATCH" = "POST"
): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");

  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsed: Envelope<T>;
  try {
    parsed = (await res.json()) as Envelope<T>;
  } catch {
    throw new Error(`Server answered ${res.status} without details.`);
  }
  if (!parsed.ok) throw new Error(parsed.error || "Request failed.");
  return parsed.result;
}

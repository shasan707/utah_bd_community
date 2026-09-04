import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase access and small helpers shared by the API routes.
 *
 * The service role key bypasses row level security, so it must only ever be
 * read here, inside route handlers and server components. The "server-only"
 * import above makes the build fail if a client component imports this file.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const serviceConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

/** Supabase client with the service role. Never expose it to the browser. */
export function getServiceClient(): SupabaseClient {
  if (!client) {
    if (!url || !serviceKey) {
      throw new ApiError(
        500,
        "The payment system is not configured on the server."
      );
    }
    client = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** An error that carries the HTTP status the API should answer with. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AdminIdentity = { id: string; email: string };

/**
 * Checks the "Authorization: Bearer <access token>" header against Supabase
 * Auth. Any signed-in user of this project is an admin, matching the site's
 * existing admin pages. Throws a 401 when the token is missing or invalid.
 */
export async function requireAdmin(req: Request): Promise<AdminIdentity> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new ApiError(401, "Not signed in.");
  const { data, error } = await getServiceClient().auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "Not signed in.");
  return { id: data.user.id, email: data.user.email || data.user.id };
}

/** Reads a small JSON body. Rejects oversized or malformed payloads. */
export async function readJsonBody(
  req: Request,
  maxBytes = 8 * 1024
): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Request is too large.");
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(415, "Expected a JSON body.");
  }
}

export function jsonOk(result: unknown, status = 200): Response {
  return Response.json({ ok: true, result }, { status });
}

export function jsonError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  return Response.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

/** Compares a presented token with a configured secret without leaking timing. */
export function secretMatches(token: string, secret: string | undefined): boolean {
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Client IP as seen through Vercel's proxy, for the registration throttle. */
export function clientIpOf(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get("x-real-ip");
  return real ? real.slice(0, 64) : null;
}

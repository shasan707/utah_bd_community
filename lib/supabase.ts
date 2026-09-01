import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Shared Supabase client. Call only when supabaseConfigured is true. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error("Supabase environment variables are not set");
    }
    client = createClient(url, anonKey);
  }
  return client;
}

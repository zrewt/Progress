import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

export function isSupabaseConfigured() {
  return Boolean(
    url &&
      publicKey &&
      /^https?:\/\//.test(url) &&
      !url.includes("your-project") &&
      publicKey.length > 20,
  );
}

let client: SupabaseClient | null = null;

/** Lazily create the browser client so SSR never touches localStorage. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, publicKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

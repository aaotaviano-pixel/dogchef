import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

function publicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("seu-projeto") || key.includes("substitua")) return null;
  return { url, key };
}

export function hasGoogleSignIn() {
  return Boolean(publicConfiguration());
}

export function getBrowserSupabase() {
  const configuration = publicConfiguration();
  if (!configuration) return null;
  if (!browserClient) {
    browserClient = createClient(configuration.url, configuration.key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: true,
        persistSession: false,
      },
    });
  }
  return browserClient;
}

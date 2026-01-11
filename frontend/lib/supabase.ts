import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fwqoutllbbwyhrucsvly.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key-for-build";

// Create client - will work for realtime if key is set, otherwise gracefully degrade
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Helper to check if realtime is properly configured
export const isRealtimeConfigured = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return key && key !== "placeholder-key-for-build" && key.length > 10;
};

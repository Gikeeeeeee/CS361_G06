import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hjqmwgaztqytjfuzrago.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client, will fallback to mock service:', err);
  }
}

export { supabase };
export const isSupabaseConfigured = (): boolean => Boolean(supabase);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both secrets are present and the client is usable. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Use placeholders so createClient doesn't throw at startup.
// All network calls will fail gracefully when the real vars are missing.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);

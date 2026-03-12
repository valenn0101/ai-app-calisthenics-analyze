import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side only client (service role — never expose to browser)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

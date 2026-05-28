import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing! Check your .env file.')
}

// Main Supabase client (manages current session)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Secondary client specifically for enrolling workers.
// The persistSession: false configuration prevents this client from overwriting
// the admin's session in localStorage when creating a worker.
export const supabaseSecondary = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

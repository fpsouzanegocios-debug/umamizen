import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sgpfsyuxtinpahxvrdxz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGZzeXV4dGlucGFoeHZyZHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDMzNjgsImV4cCI6MjEwNDM3OTM2OH0.Q6a5UwrzRQDboiEgS7IVr68O8GmeU9Np5Q03OdVtfeQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

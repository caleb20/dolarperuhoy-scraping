import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';

export const supabase = createClient(
  requireEnv('SCRAPER_SUPABASE_URL'),
  requireEnv('SCRAPER_SUPABASE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
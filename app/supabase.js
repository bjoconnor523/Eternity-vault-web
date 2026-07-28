// Supabase client for the Eternity Vault web app.
//
// This is the SAME project the mobile app uses — the web is just a second
// front door onto the one shared "brain." The key below is the PUBLISHABLE
// client key: it is designed to ship in client code. It does NOT grant broad
// access on its own — Row-Level Security in the database decides who can read
// or change each row, exactly as it does for the phone app. The secret
// (service_role) key must never appear here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://djmbnmombrjryoctvjjc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MYp8HkpadTsVPZ37ip11RA_ACpf4K66';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // On the web we DO want Supabase to read the token out of the URL after an
    // email-confirmation / password-recovery redirect.
    detectSessionInUrl: true,
  },
});

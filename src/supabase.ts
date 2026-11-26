import { createClient } from '@supabase/supabase-js';
// Public publishable key only. Never expose a service-role key in client apps.
export const SUPABASE_URL='https://oochtzrlpylesoqvtikg.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_0l4I1Ypz8cVOL6d-GP0O5Q_airms5jD';
export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'manihub-auth-v1'},global:{headers:{'X-Client-Info':'manihub-shared-app/1.0.0'}}});
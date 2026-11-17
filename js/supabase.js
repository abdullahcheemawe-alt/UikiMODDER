"use strict";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const SUPABASE_URL = "https://netztjoroixlbqntbnxi.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0-_r-gxKmsraV_ew5uXG_w_UdkuX7tv";
export const SUPABASE_BUCKET = "uikimodder-files";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        headers: { "X-Client-Info": "uikimodder-web" }
    }
});

window.supabaseClient = supabase;

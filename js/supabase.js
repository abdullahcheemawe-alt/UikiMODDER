"use strict";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://netztjoroixlbqntbnxi.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_0-_r-gxKmsraV_ew5uXG_w_UdkuX7tv";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log("Supabase client initialized successfully.");

window.supabaseClient = supabase;

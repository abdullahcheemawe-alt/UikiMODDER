"use strict";

import {
createClient
} from "https://esm.sh/@supabase/supabase-js@2";

// Supabase Configuration
const SUPABASE_URL = "https://netztjoroixlbqntbnxi.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_0-_r-gxKmsraV_ew5uXG_W_UdkuX7tv";

// Initialize Supabase with Firebase Authentication
export const supabase = createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY,
{
accessToken: async () => {
const user = window.firebaseAuth?.currentUser;

        if (!user) {
            return null;
        }

        return await user.getIdToken();
    }
}

);

console.log("Supabase client initialized successfully.");

window.supabaseClient = supabase;

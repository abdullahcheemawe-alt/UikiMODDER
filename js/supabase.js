"use strict";

// ========================================
// SUPABASE SDK
// ========================================

import {
    createClient
} from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL =
    "https://netztjoroixlbqntbnxi.supabase.co";

// Apni Dashboard wali exact Publishable Key paste karo
const SUPABASE_PUBLISHABLE_KEY =
    "PASTE_YOUR_EXACT_PUBLISHABLE_KEY_HERE";

// ========================================
// FIREBASE AUTHENTICATION CONNECTION
// ========================================

export const supabase = createClient(

    SUPABASE_URL,

    SUPABASE_PUBLISHABLE_KEY,

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

// ========================================
// GLOBAL SUPABASE CLIENT
// ========================================

window.supabaseClient = supabase;

console.log("Supabase client initialized.");

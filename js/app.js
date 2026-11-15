"use strict";

// ========================================
// FIREBASE SDK IMPORTS
// ========================================

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// ========================================
// SUPABASE IMPORT
// ========================================

import { supabase } from "./supabase.js";

// ========================================
// FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",
    authDomain: "uikimodder-65617.firebaseapp.com",
    projectId: "uikimodder-65617",
    storageBucket: "uikimodder-65617.firebasestorage.app",
    messagingSenderId: "597231043468",
    appId: "1:597231043468:web:380a56d46e741cd45b8ca9"
};

// ========================================
// INITIALIZE FIREBASE
// ========================================

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

// ========================================
// FIREBASE SERVICES
// ========================================

const auth = getAuth(app);

const db = getFirestore(app);

// ========================================
// GLOBAL CONNECTIONS
// ========================================

window.firebaseApp = app;

window.firebaseAuth = auth;

window.firebaseDB = db;

window.supabaseClient = supabase;

// ========================================
// WEBSITE INITIALIZATION
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("UIKIMODDER initialized.");

    initializeWebsite();

});

function initializeWebsite() {

    initializeNavigation();

    initializeAppStatus();

}

function initializeNavigation() {

    const menuButton = document.querySelector("#menuButton");

    const navigation = document.querySelector("#navigation");

    if (!menuButton || !navigation) return;

    menuButton.addEventListener("click", () => {

        navigation.classList.toggle("active");

    });

}

function initializeAppStatus() {

    document.documentElement.dataset.app = "ready";

}

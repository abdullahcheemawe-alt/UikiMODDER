"use strict";

// ==========================================
// FIREBASE SDK IMPORTS
// ==========================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


// ==========================================
// SUPABASE IMPORT
// ==========================================

import { supabase } from "./supabase.js";


// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",
    authDomain: "uikimodder-65617.firebaseapp.com",
    projectId: "uikimodder-65617",
    storageBucket: "uikimodder-65617.firebasestorage.app",
    messagingSenderId: "597231043468",
    appId: "1:597231043468:web:380a56d46e741cd45b8ca9"
};


// ==========================================
// INITIALIZE FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);


// ==========================================
// INITIALIZE AUTHENTICATION
// ==========================================

const auth = getAuth(app);


// ==========================================
// INITIALIZE FIRESTORE
// ==========================================

const db = getFirestore(app);


// ==========================================
// WEBSITE INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("UIKIMODDER initialized successfully!");

    console.log("Firebase connected!");

    console.log("Authentication initialized!");

    console.log("Firestore initialized!");

    console.log("Supabase client initialized!");

    initializeWebsite();

});


// ==========================================
// INITIALIZE WEBSITE
// ==========================================

function initializeWebsite() {

    initializeNavigation();

    initializeAppStatus();

}


// ==========================================
// NAVIGATION SYSTEM
// ==========================================

function initializeNavigation() {

    const menuButton = document.querySelector("#menuButton");

    const navigation = document.querySelector("#navigation");

    if (!menuButton || !navigation) return;

    menuButton.addEventListener("click", () => {

        navigation.classList.toggle("active");

    });

}


// ==========================================
// APP STATUS
// ==========================================

function initializeAppStatus() {

    document.documentElement.dataset.app = "ready";

}


// ==========================================
// GLOBAL FIREBASE INSTANCES
// ==========================================

window.firebaseApp = app;

window.firebaseAuth = auth;

window.firebaseDB = db;


// ==========================================
// GLOBAL SUPABASE CLIENT
// ==========================================

window.supabaseClient = supabase;


// ==========================================
// STEP 13 COMPLETED
// ==========================================

console.log("Firebase + Supabase integration loaded!");

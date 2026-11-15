"use strict";

// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// Supabase Import
import { supabase } from "./supabase.js";

// Firebase Configuration
const firebaseConfig = {
apiKey: "AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",
authDomain: "uikimodder-65617.firebaseapp.com",
projectId: "uikimodder-65617",
storageBucket: "uikimodder-65617.firebasestorage.app",
messagingSenderId: "597231043468",
appId: "1:597231043468:web:380a56d46e741cd45b8ca9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Website Initialization
document.addEventListener("DOMContentLoaded", () => {
console.log("UIKIMODDER initialized successfully!");
console.log("Firebase connected!");
console.log("Authentication initialized!");
console.log("Firestore initialized!");

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

// Firebase instances
window.firebaseAuth = auth;
window.firebaseDB = db;

// Supabase instance
window.supabaseClient = supabase;

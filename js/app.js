"use strict";

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",
    authDomain: "uikimodder-65617.firebaseapp.com",
    projectId: "uikimodder-65617",
    storageBucket: "uikimodder-65617.firebasestorage.app",
    messagingSenderId: "597231043468",
    appId: "1:597231043468:web:380a56d46e741cd45b8ca9"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;

// Supabase is optional for these page controls. A missing key or network issue
// must not prevent Firebase sign-in, account creation, or Explore from working.
window.supabaseClient = null;
try {
    const { supabase } = await import("./supabase.js");
    window.supabaseClient = supabase;
} catch (error) {
    console.warn("Supabase could not be initialized. Firebase features remain available.", error);
}

const $ = (selector) => document.querySelector(selector);

function setStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#ff7b91" : "#00f5ff";
}

function openAuthModal(mode = "signin") {
    const modal = $("#authModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    setAuthMode(mode);
    setStatus($("#authStatus"), "");
}

function closeAuthModal() {
    $("#authModal")?.classList.add("hidden");
}

function setAuthMode(mode) {
    const isSignup = mode === "signup";
    $("#nameField")?.classList.toggle("hidden", !isSignup);
    $("#displayName")?.toggleAttribute("required", isSignup);

    document.querySelectorAll(".auth-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.mode === mode);
    });

    const heading = $("#authHeading");
    if (heading) {
        heading.innerHTML = isSignup
            ? 'Create Your Account<br><span class="gradient-text">Join the Universe.</span>'
            : 'Your Adventure<br><span class="gradient-text">Starts Here.</span>';
    }

    const submit = $("#authSubmit");
    if (submit) submit.textContent = isSignup ? "CREATE ACCOUNT →" : "SIGN IN →";

    const password = $("#password");
    if (password) password.autocomplete = isSignup ? "new-password" : "current-password";

    const form = $("#authForm");
    if (form) form.dataset.mode = mode;
    setStatus($("#authStatus"), "");
}

function showStore() {
    const hero = $(".hero-section");
    const store = $("#storeSection");
    const admin = $("#adminSection");

    hero?.classList.add("hidden");
    admin?.classList.add("hidden");
    store?.classList.remove("hidden");

    if (store) {
        store.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function initializeNavigation() {
    $("#loginOpen")?.addEventListener("click", () => openAuthModal("signin"));
    $("#signupOpen")?.addEventListener("click", () => openAuthModal("signup"));
    $("#exploreBtn")?.addEventListener("click", showStore);
    $("#closeModal")?.addEventListener("click", closeAuthModal);
    $(".modal-overlay")?.addEventListener("click", closeAuthModal);

    document.querySelectorAll(".auth-tab").forEach((tab) => {
        tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
    });

    $("#logoutBtn")?.addEventListener("click", async () => {
        try {
            await signOut(auth);
            setStatus($("#authStatus"), "");
            closeAuthModal();
        } catch (error) {
            console.error("Sign-out failed:", error);
            alert("Sign out nahi ho saka. Dobara koshish karein.");
        }
    });

    document.querySelectorAll('.nav-links a[href="#home"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            $("#storeSection")?.classList.add("hidden");
            $(".hero-section")?.classList.remove("hidden");
            $(".hero-section")?.scrollIntoView({ behavior: "smooth" });
        });
    });

    document.querySelectorAll('.nav-links a[href="#discover"], .nav-links a[href="#categories"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            showStore();
            if (link.getAttribute("href") === "#categories") {
                $("#categories")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    });
}

function initializeAuthentication() {
    $("#authForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const mode = form.dataset.mode || "signin";
        const email = $("#email")?.value.trim();
        const password = $("#password")?.value ?? "";
        const displayName = $("#displayName")?.value.trim();
        const submit = $("#authSubmit");
        const status = $("#authStatus");

        if (!email || !password) {
            setStatus(status, "Email aur password enter karein.", true);
            return;
        }

        if (mode === "signup" && !displayName) {
            setStatus(status, "Apna naam enter karein.", true);
            return;
        }

        submit.disabled = true;
        setStatus(status, mode === "signup" ? "Account create ho raha hai..." : "Sign in ho raha hai...");

        try {
            if (mode === "signup") {
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(credential.user, { displayName });
                setStatus(status, "Account successfully create ho gaya!");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                setStatus(status, "Successfully sign in ho gaye!");
            }

            form.reset();
            window.setTimeout(closeAuthModal, 700);
        } catch (error) {
            console.error("Firebase authentication error:", error);
            const messages = {
                "auth/email-already-in-use": "Is email par pehle se account mojood hai. Sign In karein.",
                "auth/invalid-email": "Email address durust nahi hai.",
                "auth/weak-password": "Password kam az kam 6 characters ka hona chahiye.",
                "auth/user-not-found": "Is email ka account nahi mila. Pehle account create karein.",
                "auth/wrong-password": "Password ghalat hai.",
                "auth/invalid-credential": "Email ya password ghalat hai.",
                "auth/too-many-requests": "Bohat zyada attempts hue. Kuch dair baad dobara koshish karein.",
                "auth/network-request-failed": "Internet connection check karein."
            };
            setStatus(status, messages[error.code] || error.message || "Authentication fail ho gayi.", true);
        } finally {
            submit.disabled = false;
        }
    });

    onAuthStateChanged(auth, (user) => {
        const loggedIn = Boolean(user);
        $("#loginOpen")?.classList.toggle("hidden", loggedIn);
        $("#signupOpen")?.classList.toggle("hidden", loggedIn);
        $("#logoutBtn")?.classList.toggle("hidden", !loggedIn);

        if (user) {
            console.log("Signed in:", user.email);
            document.documentElement.dataset.auth = "signed-in";
        } else {
            document.documentElement.dataset.auth = "signed-out";
        }
    });
}

function initializeWebsite() {
    initializeNavigation();
    initializeAuthentication();

    const year = $("#currentYear");
    if (year) year.textContent = new Date().getFullYear();

    document.documentElement.dataset.app = "ready";
    console.log("UIKIMODDER initialized successfully.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeWebsite, { once: true });
} else {
    initializeWebsite();
}

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
    getFirestore,
    collection,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import { supabase } from "./supabase.js";
import { Upload as TusUpload } from "https://esm.sh/tus-js-client@4.3.1";

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

window.supabaseClient = supabase;

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

let allGames = [];
let activeCategory = "All";


function getSafeExternalUrl(value = "") {
    try {
        const url = new URL(String(value).trim());
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}
function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function setActiveBottomTab(view) {
    document.querySelectorAll(".bottom-nav-item").forEach((button) => {
        button.classList.toggle("active", button.dataset.view === view || (view === "search" && button.dataset.view === "games"));
    });
}

function hideMainViews() {
    $(".hero-section")?.classList.add("hidden");
    $("#storeSection")?.classList.add("hidden");
    $("#appsSection")?.classList.add("hidden");
    $("#profileSection")?.classList.add("hidden");
    $("#adminSection")?.classList.add("hidden");
}

function showStore(scroll = true) {
    hideMainViews();
    $("#storeSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");
    setActiveBottomTab("games");
    if (scroll) $("#storeSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    loadGames();
}

function showApps() {
    hideMainViews();
    $("#appsSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");
    setActiveBottomTab("apps");
    renderApps();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderApps() {
    const container = $("#appsContainer");
    const empty = $("#appsEmptyState");
    if (!container || !empty) return;

    const apps = allGames.filter((item) =>
        String(item.type || "game").toLowerCase() === "app"
        && item.active !== false && item.published !== false
    );

    container.innerHTML = apps.map((item) => {
        const name = item.name || item.title || "Untitled App";
        const description = item.description || "Explore this app.";
        const image = item.imageUrl || item.iconUrl || item.thumbnail || item.image || "";
        const download = item.downloadUrl || item.fileUrl || item.url || item.downloadURL || "";
        const safeDownload = getSafeExternalUrl(download);
        const art = image
            ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
            : '<span aria-hidden="true">▦</span>';
        const action = safeDownload
            ? '<a class="download-link" href="' + escapeHTML(safeDownload) + '" target="_blank" rel="noopener noreferrer">DOWNLOAD ↗</a>'
            : '<span class="category">Coming Soon</span>';
        return '<article class="game-card"><div class="game-art">' + art + '</div><div class="game-info"><h3>'
            + escapeHTML(name) + '</h3><p>' + escapeHTML(description)
            + '</p><div class="game-bottom"><span class="category">App</span>' + action
            + '</div></div></article>';
    }).join("");

    empty.classList.toggle("hidden", apps.length !== 0);
}

function showAdminUpload() {
    if ((auth.currentUser?.email || "").toLowerCase() !== "abdullahcheemakv@gmail.com") return;
    hideMainViews();
    $("#adminSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");
    setActiveBottomTab("upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showProfile(user = auth.currentUser) {
    if (!user) return openAuthModal("signin");
    hideMainViews();
    $("#profileSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");
    setActiveBottomTab("profile");
    const display = user.displayName || user.email?.split("@")[0] || "Gamer";
    $("#profileName").textContent = display;
    $("#profileEmail").textContent = user.email || "Email not available";
    $("#profileInitial").textContent = display.trim().charAt(0).toUpperCase() || "G";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function performSignOut() {
    try {
        await signOut(auth);
        setStatus($("#authStatus"), "");
        closeAuthModal();
    } catch (error) {
        console.error("Sign-out failed:", error);
        alert("Unable to sign out. Please try again.");
    }
}

function renderGames() {
    const container = $("#gamesContainer");
    const empty = $("#emptyState");
    const count = $("#gameCount");
    if (!container || !empty) return;

    const term = ($("#searchInput")?.value || "").trim().toLowerCase();
    const filtered = allGames.filter((game) => {
        const name = String(game.name || game.title || game.gameName || "").toLowerCase();
        const description = String(game.description || "").toLowerCase();
        const category = String(game.category || "Other");
        const isGame = String(game.type || "game").toLowerCase() === "game";
        return isGame
            && (activeCategory === "All" || category.toLowerCase() === activeCategory.toLowerCase())
            && (!term || name.includes(term) || description.includes(term));
    });

    if (count) count.textContent = filtered.length + (filtered.length === 1 ? " Game" : " Games");
    container.innerHTML = filtered.map((game) => {
        const name = game.name || game.title || game.gameName || "Untitled Game";
        const description = game.description || "Get ready for your next adventure.";
        const category = game.category || "Other";
        const image = game.imageUrl || game.iconUrl || game.thumbnail || game.image || "";
        const download = game.downloadUrl || game.fileUrl || game.url || game.downloadURL || "";
        const safeDownload = getSafeExternalUrl(download);
        const art = image
            ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
            : '<span aria-hidden="true">🎮</span>';
        const action = safeDownload
            ? '<a class="download-link" href="' + escapeHTML(safeDownload) + '" target="_blank" rel="noopener noreferrer">DOWNLOAD ↗</a>'
            : '<span class="category">Coming Soon</span>';
        return '<article class="game-card"><div class="game-art">' + art + '</div><div class="game-info"><h3>' +
            escapeHTML(name) + '</h3><p>' + escapeHTML(description) +
            '</p><div class="game-bottom"><span class="category">' + escapeHTML(category) +
            '</span>' + action + '</div></div></article>';
    }).join("");

    $("#retryGamesBtn")?.remove();
    empty.classList.toggle("hidden", filtered.length !== 0);
    if (!filtered.length) {
        const title = $("#emptyState h3");
        const message = $("#emptyState p");
        if (title) title.textContent = allGames.length ? "No Games Found" : "No Games Available Yet";
        if (message) message.textContent = allGames.length
            ? "Try another search or choose a different category."
            : "Our gaming collection is getting ready. Please check back soon!";
    }
}

async function loadGames() {
    const container = $("#gamesContainer");
    if (!container || container.dataset.loading === "true") return;
    container.dataset.loading = "true";
    container.innerHTML = '<div class="games-loading"><span class="loading-spinner"></span><p>Loading your game collection...</p></div>';
    $("#emptyState")?.classList.add("hidden");

    try {
        const snapshot = await getDocs(collection(db, "games"));
        allGames = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
            .filter((game) => game.active !== false && game.published !== false);
        renderGames();
        renderApps();
    } catch (error) {
        console.error("Could not load games from Firestore:", error);
        container.innerHTML = "";
        allGames = [];
        const empty = $("#emptyState");
        empty?.classList.remove("hidden");
        if ($("#emptyState h3")) $("#emptyState h3").textContent =
            error.code === "permission-denied" ? "Game Library Access Blocked" : "Games Could Not Load";
        if ($("#emptyState p")) $("#emptyState p").textContent =
            error.code === "permission-denied"
                ? "Firebase Firestore rules are blocking this account from reading the games collection. The library needs public or signed-in read permission."
                : "Connection to the game library failed. Please try again.";
        if (!$("#retryGamesBtn")) {
            const retry = document.createElement("button");
            retry.id = "retryGamesBtn";
            retry.className = "retry-games-btn";
            retry.type = "button";
            retry.textContent = "TRY AGAIN";
            retry.addEventListener("click", () => {
                container.dataset.loading = "false";
                loadGames();
            });
            $("#emptyState")?.append(retry);
        }
    } finally {
        container.dataset.loading = "false";
    }
}

function initializeGameControls() {
    $("#searchInput")?.addEventListener("input", renderGames);
    document.querySelectorAll(".category-btn").forEach((button) => {
        button.addEventListener("click", () => {
            activeCategory = button.dataset.category || "All";
            document.querySelectorAll(".category-btn").forEach((item) =>
                item.classList.toggle("active", item === button));
            renderGames();
        });
    });
}



async function makeUploadOptimizedIcon(file) {
    if (!("createImageBitmap" in window)) return file;
    const bitmap = await createImageBitmap(file);
    try {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.72));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
            type: "image/webp",
            lastModified: Date.now()
        });
    } finally {
        bitmap.close?.();
    }
}

async function createSignedUploadBatch(files) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again before uploading.");
    const token = await user.getIdToken();
    const { data, error } = await supabase.functions.invoke("create-game-upload", {
        body: { files },
        headers: { Authorization: "Bearer " + token }
    });
    if (error) {
        const detail = error.context?.body?.error || error.message;
        throw new Error(detail || "Could not prepare the secure upload.");
    }
    if (!data?.ok || !Array.isArray(data.uploads)) {
        throw new Error(data?.error || "The upload service returned an invalid response.");
    }
    return data;
}

function uploadFileWithProgress(file, signedUpload, label, onProgress) {
    return new Promise((resolve, reject) => {
        const upload = new TusUpload(file, {
            endpoint: "https://netztjoroixlbqntbnxi.storage.supabase.co/storage/v1/upload/resumable",
            retryDelays: [0, 1000, 3000, 5000, 10000],
            headers: {
                apikey: "sb_publishable_0-_r-gxKmsraV_ew5uXG_W_UdkuX7tv",
                "x-signature": signedUpload.token
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: 6 * 1024 * 1024,
            metadata: {
                bucketName: "uikimodder-files",
                objectName: signedUpload.path,
                contentType: file.type || "application/octet-stream",
                cacheControl: "3600"
            },
            onError(error) {
                reject(new Error(label + " upload failed: " + (error?.message || "Storage rejected the upload.")));
            },
            onProgress(bytesUploaded, bytesTotal) {
                if (onProgress) onProgress(bytesUploaded, bytesTotal);
            },
            onSuccess() {
                resolve(signedUpload.publicUrl);
            }
        });
        upload.findPreviousUploads().then((previous) => {
            if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
            upload.start();
        }).catch(reject);
    });
}

async function cleanupSupabaseUploads(paths) {
    if (!paths?.length || !auth.currentUser) return;
    try {
        const token = await auth.currentUser.getIdToken();
        await supabase.functions.invoke("create-game-upload", {
            body: { action: "cleanup", paths },
            headers: { Authorization: "Bearer " + token }
        });
    } catch (error) {
        console.warn("Could not clean up incomplete upload objects:", error);
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

    $("#logoutBtn")?.addEventListener("click", performSignOut);
    $("#profileSignout")?.addEventListener("click", performSignOut);

    $("#gameIcon")?.addEventListener("change", (event) => {
        const selected = event.currentTarget.files?.[0];
        const preview = $("#gameIconPreview");
        const image = $("#gameIconPreviewImage");
        const fileName = $("#gameIconFileName");
        if (!selected || !selected.type.startsWith("image/")) {
            preview?.classList.add("hidden");
            if (event.currentTarget.files?.length) event.currentTarget.value = "";
            return;
        }
        if (selected.size > 10 * 1024 * 1024) {
            setStatus($("#uploadStatus"), "The game icon image must be 10 MB or smaller.", true);
            event.currentTarget.value = "";
            preview?.classList.add("hidden");
            return;
        }
        if (image) image.src = URL.createObjectURL(selected);
        if (fileName) fileName.textContent = selected.name;
        preview?.classList.remove("hidden");
    });

    $("#uploadForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const user = auth.currentUser;
        if ((user?.email || "").toLowerCase() !== "abdullahcheemakv@gmail.com") {
            setStatus($("#uploadStatus"), "Admin permission required.", true);
            return;
        }

        const name = $("#gameName")?.value.trim();
        const description = $("#gameDescription")?.value.trim();
        const category = $("#gameCategory")?.value;
        const itemType = $("#itemType")?.value || "game";
        const iconFile = $("#gameIcon")?.files?.[0];
        const file = $("#gameFile")?.files?.[0];
        const downloadLinkInput = $("#gameDownloadUrl")?.value.trim() || "";
        const externalDownloadUrl = downloadLinkInput ? getSafeExternalUrl(downloadLinkInput) : "";
        if (!name || !description || !category || !iconFile) {
            setStatus($("#uploadStatus"), "Please complete the game details and select a game icon.", true);
            return;
        }
        if (downloadLinkInput && !externalDownloadUrl) {
            setStatus($("#uploadStatus"), "Please enter a valid download URL starting with https:// or http://.", true);
            return;
        }
        if (!file && !externalDownloadUrl) {
            setStatus($("#uploadStatus"), "Choose a package file or enter an external download link.", true);
            return;
        }
        if (file && externalDownloadUrl) {
            setStatus($("#uploadStatus"), "Use either a package file or an external download link, not both.", true);
            return;
        }
        if (!iconFile.type.startsWith("image/")) {
            setStatus($("#uploadStatus"), "Please select an image file for the game icon.", true);
            return;
        }
        if (iconFile.size > 10 * 1024 * 1024) {
            setStatus($("#uploadStatus"), "The game icon image must be 10 MB or smaller.", true);
            return;
        }
        if (file && file.size > 50 * 1024 * 1024) {
            setStatus($("#uploadStatus"), "Supabase Free storage supports files up to 50 MB. Use an external download link for larger packages.", true);
            return;
        }

        const button = $("#uploadBtn");
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = "UPLOADING...";
        $("#uploadProgress")?.classList.remove("hidden");
        if ($("#uploadProgressFill")) $("#uploadProgressFill").style.width = "0%";
        if ($("#uploadProgressText")) $("#uploadProgressText").textContent = "0%";
        setStatus($("#uploadStatus"), "Preparing your game files...");
        let createdPaths = [];
        try {
            const optimizedIcon = await makeUploadOptimizedIcon(iconFile);
            const uploadFiles = [{ kind: "icon", name: optimizedIcon.name, size: optimizedIcon.size }];
            if (file) uploadFiles.push({ kind: "package", name: file.name, size: file.size });

            setStatus($("#uploadStatus"), "Preparing secure Supabase upload...");
            const signedBatch = await createSignedUploadBatch(uploadFiles);
            createdPaths = signedBatch.uploads.map((item) => item.path);
            const iconUpload = signedBatch.uploads.find((item) => item.kind === "icon");
            const packageUpload = signedBatch.uploads.find((item) => item.kind === "package");
            if (!iconUpload || (file && !packageUpload)) {
                throw new Error("The upload service did not return all required upload permissions.");
            }

            let iconProgress = 0;
            let packageProgress = 0;
            const totalBytes = optimizedIcon.size + (file ? file.size : 0);
            const progressFill = $("#uploadProgressFill");
            const progressText = $("#uploadProgressText");
            const updateCombinedProgress = () => {
                const transferred = iconProgress + packageProgress;
                const percent = totalBytes ? Math.min(100, Math.round((transferred / totalBytes) * 100)) : 0;
                if (progressFill) progressFill.style.width = percent + "%";
                if (progressText) progressText.textContent = percent + "%";
                setStatus($("#uploadStatus"), "Uploading to Supabase — " + percent + "% complete.");
            };

            setStatus($("#uploadStatus"), file
                ? "Uploading game icon and package to Supabase in parallel..."
                : "Uploading game icon to Supabase...");
            const uploadTasks = [
                uploadFileWithProgress(optimizedIcon, iconUpload, "Game icon", (bytes) => {
                    iconProgress = bytes;
                    updateCombinedProgress();
                })
            ];
            if (file && packageUpload) {
                uploadTasks.push(uploadFileWithProgress(file, packageUpload, "Game package", (bytes) => {
                    packageProgress = bytes;
                    updateCombinedProgress();
                }));
            }
            const uploadedUrls = await Promise.all(uploadTasks);
            const iconUrl = uploadedUrls[0];
            const packageDownloadUrl = file ? uploadedUrls[1] : externalDownloadUrl;

            if (progressFill) progressFill.style.width = "100%";
            if (progressText) progressText.textContent = "100%";
            setStatus($("#uploadStatus"), "Saving game details to the library...");
            const itemId = signedBatch.itemId;
            await addDoc(collection(db, "games"), {
                name, description, category, type: itemType,
                downloadUrl: packageDownloadUrl,
                packageStorageUrl: file ? packageDownloadUrl : "",
                storageProvider: file ? "supabase" : "external",
                storageBucket: file ? "uikimodder-files" : "",
                storagePath: packageUpload?.path || "",
                imageUrl: iconUrl,
                iconFileName: iconFile.name,
                fileName: file?.name || "",
                fileSize: file?.size || 0,
                active: true, published: true, createdBy: user.uid,
                createdAt: serverTimestamp()
            });
            $("#uploadForm").reset();
            $("#gameIconPreview")?.classList.add("hidden");
            if ($("#uploadProgressFill")) $("#uploadProgressFill").style.width = "100%";
            if ($("#uploadProgressText")) $("#uploadProgressText").textContent = "100%";
            setStatus($("#uploadStatus"), "Published successfully! The download button is ready on UIKIMODDER.");
            await loadGames();
            renderApps();
        } catch (error) {
            await cleanupSupabaseUploads(createdPaths);
            console.error("Game upload failed:", error);
            const reason = error.message || error.code || "Unknown error";
            setStatus($("#uploadStatus"), "Upload failed: " + reason, true);
        } finally {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.textContent = "UPLOAD GAME +";
        }
    });

    document.querySelectorAll(".bottom-nav-item").forEach((button) => {
        button.addEventListener("click", () => {
            const view = button.dataset.view;
            if (view === "games") showStore();
            if (view === "apps") showApps();
            if (view === "profile") showProfile();
            if (view === "upload") showAdminUpload();
            if (view === "search") {
                showStore();
                window.setTimeout(() => $("#searchInput")?.focus(), 250);
            }
        });
    });

    document.querySelectorAll('.nav-links a[href="#home"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            hideMainViews();
            $("#bottomNav")?.classList.add("hidden");
            $(".hero-section")?.classList.remove("hidden");
            $(".hero-section")?.scrollIntoView({ behavior: "smooth" });
        });
    });

    document.querySelectorAll('.nav-links a[href="#storeSection"], .nav-links a[href="#categories"]').forEach((link) => {
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
            setStatus(status, "Please enter your email address and password.", true);
            return;
        }

        if (mode === "signup" && !displayName) {
            setStatus(status, "Please enter your name.", true);
            return;
        }

        submit.disabled = true;
        submit.setAttribute("aria-busy", "true");
        submit.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>' +
            (mode === "signup" ? "ACCOUNT CREATING..." : "SIGNING IN..."); 
        status?.classList.add("status-loading");
        setStatus(status, mode === "signup" ? "Account creating... Please wait." : "Signing in securely...");

        try {
            if (mode === "signup") {
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(credential.user, { displayName });
                setStatus(status, "Account created successfully! Welcome to UIKIMODDER.");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                setStatus(status, "Signed in successfully. Welcome back!");
            }

            form.reset();
            window.setTimeout(closeAuthModal, 700);
        } catch (error) {
            console.error("Firebase authentication error:", error);
            const messages = {
                "auth/email-already-in-use": "An account with this email already exists. Please sign in instead.",
                "auth/invalid-email": "Please enter a valid email address.",
                "auth/weak-password": "Your password must be at least 6 characters long.",
                "auth/user-not-found": "No account was found with this email address. Please create an account first.",
                "auth/wrong-password": "The password is incorrect.",
                "auth/invalid-credential": "The email address or password is incorrect.",
                "auth/too-many-requests": "Too many attempts. Please try again later.",
                "auth/network-request-failed": "Please check your internet connection."
            };
            setStatus(status, messages[error.code] || error.message || "Authentication failed. Please try again.", true);
        } finally {
            submit.disabled = false;
            submit.removeAttribute("aria-busy");
            submit.textContent = mode === "signup" ? "CREATE ACCOUNT →" : "SIGN IN →";
            status?.classList.remove("status-loading");
        }
    });

    onAuthStateChanged(auth, (user) => {
        const loggedIn = Boolean(user);
        $("#loginOpen")?.classList.toggle("hidden", loggedIn);
        $("#signupOpen")?.classList.toggle("hidden", loggedIn);
        $("#logoutBtn")?.classList.toggle("hidden", true);
        $("#bottomNav")?.classList.toggle("hidden", !loggedIn);
        $("#accountWelcome")?.classList.toggle("hidden", !loggedIn);
        const isSuperAdmin = (user?.email || "").toLowerCase() === "abdullahcheemakv@gmail.com";
        const bottomNav = $("#bottomNav");
        $("#adminUploadNav")?.classList.toggle("hidden", !isSuperAdmin);
        bottomNav?.classList.toggle("admin-mode", isSuperAdmin);

        if (user) {
            console.log("Signed in:", user.email);
            document.documentElement.dataset.auth = "signed-in";
            const label = $("#accountWelcome");
            if (label) label.textContent = "Welcome back, " + (user.displayName || user.email?.split("@")[0] || "Gamer");
            showStore(false);
        } else {
            bottomNav?.classList.remove("admin-mode");
            document.documentElement.dataset.auth = "signed-out";
            allGames = [];
            hideMainViews();
            $("#bottomNav")?.classList.add("hidden");
            $(".hero-section")?.classList.remove("hidden");
        }
    });
}

function initializeWebsite() {
    initializeNavigation();
    initializeAuthentication();
    initializeGameControls();

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

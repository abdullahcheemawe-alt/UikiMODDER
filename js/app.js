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
    setDoc,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import { supabase, SUPABASE_PUBLISHABLE_KEY } from "./supabase.js?v=3";


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
let pendingGameRecord = null;
let supportPostsUnsubscribe = null;
let supportReplyUnsubscribers = [];
let supportRepliesByPost = {};
let currentUserIsAdmin = false;
let dmInboxUnsubscribe = null;
let dmConversationUnsubscribe = null;
let dmMessagesUnsubscribe = null;
let dmActiveConversationId = null;
let dmConversations = [];

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

const GAME_CACHE_KEY = "uikimodder-public-games-v1";
let allGames = [];
let hasLoadedGames = false;
try {
    const cachedGames = localStorage.getItem(GAME_CACHE_KEY);
    if (cachedGames) {
        const parsedGames = JSON.parse(cachedGames);
        if (Array.isArray(parsedGames)) {
            allGames = parsedGames;
            hasLoadedGames = true;
        }
    }
} catch (error) {
    console.warn("UIKIMODDER game cache could not be read:", error);
}
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
    if (typeof stopDirectMessageListeners === "function") stopDirectMessageListeners();
    if (supportPostsUnsubscribe) {
        supportPostsUnsubscribe();
        supportPostsUnsubscribe = null;
    }
    supportReplyUnsubscribers.forEach((unsubscribe) => unsubscribe());
    supportReplyUnsubscribers = [];
    supportRepliesByPost = {};
    $(".hero-section")?.classList.add("hidden");
    $("#storeSection")?.classList.add("hidden");
    $("#appsSection")?.classList.add("hidden");
    $("#profileSection")?.classList.add("hidden");
    $("#adminSection")?.classList.add("hidden");
    $("#itemDetailSection")?.classList.add("hidden");
    $("#supportSection")?.classList.add("hidden");
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

    container.innerHTML = apps.map((item) => renderItemCard(item, "APP")).join("");
    empty.classList.toggle("hidden", apps.length !== 0);
}

let detailReturnView = "games";

function formatPackageSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "Not listed";
    if (size < 1024 * 1024) return (size / 1024).toFixed(0) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function showItemDetails(itemId) {
    const item = allGames.find((entry) => String(entry.id) === String(itemId));
    if (!item) return;

    detailReturnView = $("#appsSection")?.classList.contains("hidden") ? "games" : "apps";
    hideMainViews();
    $("#itemDetailSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");

    const name = item.name || item.title || item.gameName || "Untitled";
    const image = item.imageUrl || item.iconUrl || item.thumbnail || item.image || "";
    const description = item.description || "More information about this item will be added soon.";
    const type = String(item.type || "game").toLowerCase() === "app" ? "APP" : "GAME";
    const category = type === "APP" ? "Application" : (item.category || "Other");
    const packageName = item.fileName || item.iconFileName || "Download package";
    const download = getSafeExternalUrl(item.downloadUrl || item.packageStorageUrl || item.fileUrl || item.url || item.downloadURL || "");

    $("#detailName").textContent = name;
    $("#detailTypeBadge").textContent = type;
    $("#detailCategory").textContent = category;
    $("#detailFileSize").textContent = formatPackageSize(item.fileSize);
    $("#detailFileType").textContent = packageName.length > 24 ? packageName.slice(0, 21) + "…" : packageName;
    $("#detailDescription").textContent = description;

    const cover = $("#detailCoverImage");
    const icon = $("#detailAppIcon");
    if (image) {
        cover.src = image;
        cover.alt = name + " artwork";
        cover.classList.remove("hidden");
        icon.innerHTML = '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(name) + ' icon">';
    } else {
        cover.removeAttribute("src");
        cover.classList.add("hidden");
        icon.innerHTML = "<span>" + (type === "APP" ? "▦" : "🎮") + "</span>";
    }

    const downloadButton = $("#detailDownloadBtn");
    const downloadNote = $("#detailDownloadNote");
    if (download) {
        downloadButton.href = download;
        downloadButton.classList.remove("is-disabled");
        downloadButton.removeAttribute("aria-disabled");
        downloadButton.setAttribute("download", item.fileName || "");
        downloadButton.innerHTML = "<span>⬇</span> DOWNLOAD";
        downloadNote.textContent = "Your download is ready. The package will open or download through your browser.";
    } else {
        downloadButton.href = "#";
        downloadButton.classList.add("is-disabled");
        downloadButton.setAttribute("aria-disabled", "true");
        downloadButton.removeAttribute("download");
        downloadButton.innerHTML = "<span>⌛</span> COMING SOON";
        downloadNote.textContent = "The download package is not available yet.";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnFromItemDetails() {
    if (detailReturnView === "apps") showApps();
    else showStore();
}

function showAdminUpload() {
    if ((auth.currentUser?.email || "").toLowerCase() !== "abdullahcheemakv@gmail.com") return;
    hideMainViews();
    $("#adminSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.remove("hidden");
    setActiveBottomTab("upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopDirectMessageListeners() {
    if (dmInboxUnsubscribe) dmInboxUnsubscribe();
    if (dmConversationUnsubscribe) dmConversationUnsubscribe();
    if (dmMessagesUnsubscribe) dmMessagesUnsubscribe();
    dmInboxUnsubscribe = null;
    dmConversationUnsubscribe = null;
    dmMessagesUnsubscribe = null;
    dmActiveConversationId = null;
}

function getSupportAuthorName(user) {
    const rawName = String(user?.displayName || user?.email?.split("@")[0] || "UIKIMODDER Member").trim();
    return rawName.slice(0, 40) || "UIKIMODDER Member";
}

async function checkCurrentUserAdmin(user) {
    if (!user) return false;
    const email = String(user.email || "").toLowerCase();
    if (email === "abdullahcheemakv@gmail.com") return true;
    try {
        const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
        return adminSnapshot.exists() && adminSnapshot.data()?.active === true;
    } catch (error) {
        console.warn("Admin role could not be verified:", error);
        return false;
    }
}

function showSupportBoard() {
    hideMainViews();
    $("#supportSection")?.classList.remove("hidden");
    $("#bottomNav")?.classList.add("hidden");
    const user = auth.currentUser;
    $("#dmSignInPanel")?.classList.toggle("hidden", Boolean(user));
    $("#dmAdminInbox")?.classList.toggle("hidden", !(user && currentUserIsAdmin));
    $("#dmUserChat")?.classList.toggle("hidden", !(user && !currentUserIsAdmin));
    if (!user) {
        stopDirectMessageListeners();
    } else if (currentUserIsAdmin) {
        loadOwnerInbox();
    } else {
        loadUserConversation(user);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDMDate(value) {
    if (!value) return "";
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function dmSafeText(value) {
    return escapeHTML(String(value || "")).replace(/\n/g, "<br>");
}

function renderDMMessages(container, snapshot, isOwnerView, pinned) {
    if (!container) return;
    if (snapshot.empty) {
        container.innerHTML = '<div class="dm-chat-empty"><strong>How can we help?</strong><span>Send a private message to the UIKIMODDER owner. Only you and authorized admins can read this conversation.</span></div>';
        return;
    }
    container.innerHTML = snapshot.docs.map((entry) => {
        const msg = entry.data();
        const own = isOwnerView ? msg.role === "admin" : msg.authorUid === auth.currentUser?.uid;
        const pinnedMark = pinned?.messageId === entry.id ? '<span class="dm-message-pin-label">PINNED</span>' : "";
        const pinButton = isOwnerView
            ? '<button type="button" class="dm-pin-btn" data-dm-pin="' + escapeHTML(entry.id) + '" data-dm-text="' + escapeHTML(String(msg.text || "").slice(0, 220)) + '">' + (pinned?.messageId === entry.id ? "Pinned" : "Pin") + '</button>'
            : "";
        return '<article class="dm-message-row ' + (own ? "is-own" : "") + '" data-message-id="' + escapeHTML(entry.id) + '">' +
            '<div class="dm-message-bubble">' +
            '<div class="dm-message-meta"><strong>' + (msg.role === "admin" ? "UIKIMODDER Owner" : escapeHTML(msg.authorName || "Member")) + '</strong><time>' + escapeHTML(formatDMDate(msg.createdAt)) + '</time></div>' +
            '<p>' + dmSafeText(msg.text) + '</p>' + pinnedMark + pinButton +
            '</div></article>';
    }).join("");
    container.scrollTop = container.scrollHeight;
}

function watchDMConversation(conversationId, isOwnerView) {
    if (dmMessagesUnsubscribe) dmMessagesUnsubscribe();
    dmActiveConversationId = conversationId;
    const messageContainer = isOwnerView ? $("#dmAdminMessages") : $("#dmUserMessages");
    const pinnedContainer = isOwnerView ? $("#dmAdminPinned") : $("#dmUserPinned");
    const conversationRef = doc(db, "privateConversations", conversationId);

    if (dmConversationUnsubscribe) dmConversationUnsubscribe();
    dmConversationUnsubscribe = onSnapshot(conversationRef, (conversationSnap) => {
        const data = conversationSnap.exists() ? conversationSnap.data() : {};
        const pinned = data.pinnedMessageId ? {
            messageId: data.pinnedMessageId,
            text: data.pinnedText || ""
        } : null;
        if (pinnedContainer) {
            pinnedContainer.classList.toggle("hidden", !pinned);
            pinnedContainer.textContent = pinned ? "PINNED MESSAGE  ·  " + pinned.text : "";
        }
        if (isOwnerView) {
            const name = data.userName || "UIKIMODDER Member";
            const email = data.userEmail || "";
            $("#dmAdminChatHeader").innerHTML = '<div class="dm-avatar">' + escapeHTML(name.charAt(0).toUpperCase()) + '</div><div><strong>' + escapeHTML(name) + '</strong><span>' + escapeHTML(email) + ' · Private conversation</span></div>';
        }
        const messagesQuery = query(collection(db, "privateConversations", conversationId, "messages"), orderBy("createdAt", "asc"), limit(200));
        if (dmMessagesUnsubscribe) dmMessagesUnsubscribe();
        dmMessagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            renderDMMessages(messageContainer, snapshot, isOwnerView, pinned);
        }, (error) => {
            console.error("Private messages could not load:", error);
            if (messageContainer) messageContainer.innerHTML = '<div class="dm-chat-empty">Messages could not load. Check Firestore rules.</div>';
        });
    }, (error) => {
        console.error("Private conversation could not load:", error);
    });
}

async function loadUserConversation(user) {
    stopDirectMessageListeners();
    const conversationRef = doc(db, "privateConversations", user.uid);
    dmConversationUnsubscribe = onSnapshot(conversationRef, (snapshot) => {
        if (!snapshot.exists()) {
            const box = $("#dmUserMessages");
            if (box) box.innerHTML = '<div class="dm-chat-empty"><strong>Welcome to Contact Owner.</strong><span>Send your first private message below. Our team will reply here.</span></div>';
            $("#dmUserPinned")?.classList.add("hidden");
            return;
        }
        watchDMConversation(user.uid, false);
    }, (error) => {
        console.error("Could not open private conversation:", error);
        $("#dmUserMessages").innerHTML = '<div class="dm-chat-empty">Your private inbox could not load. Please check Firestore rules.</div>';
    });
}

function loadOwnerInbox() {
    const previouslySelected = dmActiveConversationId;
    stopDirectMessageListeners();
    dmActiveConversationId = previouslySelected;
    const list = $("#dmConversationList");
    if (list) list.innerHTML = '<div class="dm-list-empty">Loading private messages…</div>';
    const inboxQuery = query(collection(db, "privateConversations"), orderBy("lastMessageAt", "desc"), limit(100));
    dmInboxUnsubscribe = onSnapshot(inboxQuery, (snapshot) => {
        dmConversations = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        $("#dmInboxCount").textContent = String(dmConversations.length);
        if (!dmConversations.length) {
            list.innerHTML = '<div class="dm-list-empty">No messages yet. New user conversations will appear here.</div>';
            return;
        }
        list.innerHTML = dmConversations.map((item) => {
            const active = item.id === dmActiveConversationId;
            return '<button type="button" class="dm-conversation-item ' + (active ? "is-active" : "") + '" data-dm-conversation="' + escapeHTML(item.id) + '">' +
                '<span class="dm-list-avatar">' + escapeHTML(String(item.userName || "U").charAt(0).toUpperCase()) + '</span>' +
                '<span class="dm-list-copy"><strong>' + escapeHTML(item.userName || "UIKIMODDER User") + '</strong><small>' + escapeHTML(item.lastMessage || "New conversation") + '</small></span>' +
                '<time>' + escapeHTML(formatDMDate(item.lastMessageAt)) + '</time>' +
                (item.pinnedMessageId ? '<span class="dm-list-pin">PIN</span>' : '') +
                '</button>';
        }).join("");
        if (dmActiveConversationId) {
            const activeItem = dmConversations.find((item) => item.id === dmActiveConversationId);
            if (activeItem) watchDMConversation(activeItem.id, true);
        }
    }, (error) => {
        console.error("Owner inbox could not load:", error);
        list.innerHTML = '<div class="dm-list-empty">Inbox unavailable. Check admin access and Firestore rules.</div>';
    });
}

async function sendDMMessage(conversationId, user, text, isAdmin) {
    const clean = String(text || "").trim();
    if (!clean || clean.length > 1500) throw new Error("Message must be between 1 and 1500 characters.");
    const conversationRef = doc(db, "privateConversations", conversationId);
    const conversationSnap = await getDoc(conversationRef);
    const authorName = getSupportAuthorName(user);
    const messageData = {
        text: clean,
        authorUid: user.uid,
        authorName: isAdmin ? "UIKIMODDER Owner" : authorName,
        role: isAdmin ? "admin" : "member",
        createdAt: serverTimestamp()
    };
    if (!conversationSnap.exists()) {
        if (isAdmin) throw new Error("This conversation no longer exists.");
        await setDoc(conversationRef, {
            ownerUid: user.uid,
            userName: authorName,
            userEmail: user.email || "",
            createdAt: serverTimestamp(),
            lastMessage: clean.slice(0, 140),
            lastMessageAt: serverTimestamp()
        });
    }
    await addDoc(collection(db, "privateConversations", conversationId, "messages"), messageData);
    await updateDoc(conversationRef, {
        lastMessage: (isAdmin ? "Owner: " : "") + clean.slice(0, 140),
        lastMessageAt: serverTimestamp()
    });
}

function initializeSupportBoard() {
    $("#supportOpen")?.addEventListener("click", showSupportBoard);
    $("#supportBackBtn")?.addEventListener("click", () => {
        stopDirectMessageListeners();
        if (auth.currentUser) showStore();
        else {
            $("#supportSection")?.classList.add("hidden");
            $(".hero-section")?.classList.remove("hidden");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
    $("#dmSignInBtn")?.addEventListener("click", () => openAuthModal("signin"));

    $("#dmUserMessageForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) return openAuthModal("signin");
        const input = $("#dmUserMessageInput");
        const button = event.currentTarget.querySelector("button");
        const value = input.value.trim();
        if (!value) return;
        button.disabled = true;
        button.textContent = "Sending…";
        try {
            await sendDMMessage(user.uid, user, value, false);
            input.value = "";
            $("#dmUserStatus").textContent = "Message sent privately.";
        } catch (error) {
            console.error("Private message failed:", error);
            $("#dmUserStatus").textContent = "Message could not be sent. Please try again.";
        } finally {
            button.disabled = false;
            button.textContent = "Send";
        }
    });

    $("#dmAdminReplyForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const user = auth.currentUser;
        const conversationId = dmActiveConversationId;
        const input = $("#dmAdminReplyInput");
        const button = event.currentTarget.querySelector("button");
        const value = input.value.trim();
        if (!user || !currentUserIsAdmin || !conversationId || !value) return;
        button.disabled = true;
        try {
            await sendDMMessage(conversationId, user, value, true);
            input.value = "";
        } catch (error) {
            console.error("Owner reply failed:", error);
            alert("Reply could not be sent. Check the private messaging Firestore rules.");
        } finally {
            button.disabled = false;
        }
    });

    $("#dmConversationList")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-dm-conversation]");
        if (!button || !currentUserIsAdmin) return;
        dmActiveConversationId = button.dataset.dmConversation;
        $("#dmAdminReplyForm")?.classList.remove("hidden");
        loadOwnerInbox();
        watchDMConversation(dmActiveConversationId, true);
    });

    $("#dmAdminMessages")?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-dm-pin]");
        if (!button || !currentUserIsAdmin || !dmActiveConversationId) return;
        button.disabled = true;
        try {
            await updateDoc(doc(db, "privateConversations", dmActiveConversationId), {
                pinnedMessageId: button.dataset.dmPin,
                pinnedText: button.dataset.dmText || "",
                pinnedAt: serverTimestamp(),
                pinnedBy: auth.currentUser.uid
            });
        } catch (error) {
            console.error("Pin message failed:", error);
            alert("Only an authorized admin can pin a message.");
        } finally {
            button.disabled = false;
        }
    });
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

function renderItemCard(item, typeLabel) {
    const id = String(item.id || "");
    const name = item.name || item.title || item.gameName || "Untitled";
    const description = item.description || "Explore this item on UIKIMODDER.";
    const image = item.imageUrl || item.iconUrl || item.thumbnail || item.image || "";
    const category = typeLabel === "APP" ? "App" : (item.category || "Other");
    const art = image
        ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(name) + '" loading="eager" decoding="async" fetchpriority="low" onerror="this.style.display=\'none\'">'
        : '<span aria-hidden="true">' + (typeLabel === "APP" ? "▦" : "🎮") + '</span>';

    return '<button type="button" class="game-card game-list-card" data-item-id="' +
        escapeHTML(id) + '" aria-label="View details for ' + escapeHTML(name) + '">' +
        '<span class="game-art">' + art + '</span>' +
        '<span class="game-info"><span class="game-card-heading"><strong>' + escapeHTML(name) +
        '</strong><span class="game-card-arrow" aria-hidden="true">↗</span></span>' +
        '<span class="game-card-description">' + escapeHTML(description) + '</span>' +
        '<span class="game-bottom"><span class="category">' + escapeHTML(category) +
        '</span><span class="details-hint">VIEW DETAILS&nbsp; ›</span></span></span></button>';
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
    container.innerHTML = filtered.map((game) => renderItemCard(game, "GAME")).join("");

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
    const hasUsableContent = hasLoadedGames || allGames.length > 0;
    if (hasUsableContent) {
        // Keep the already-rendered collection visible while Firestore refreshes.
        renderGames();
        renderApps();
    } else {
        container.innerHTML = '<div class="games-loading"><span class="loading-spinner"></span><p>Loading your game collection...</p></div>';
        $("#emptyState")?.classList.add("hidden");
    }

    try {
        const snapshot = await getDocs(collection(db, "games"));
        allGames = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
            .filter((game) => game.active !== false && game.published !== false);
        hasLoadedGames = true;

        try {
            // Cache only public listing fields so the library can paint instantly next visit.
            const cacheSafeGames = allGames.map((game) => ({
                id: game.id,
                name: game.name || game.title || game.gameName || "Untitled",
                title: game.title || "",
                gameName: game.gameName || "",
                description: game.description || "",
                category: game.category || "Other",
                type: game.type || "game",
                imageUrl: game.imageUrl || "",
                iconUrl: game.iconUrl || "",
                thumbnail: game.thumbnail || "",
                image: game.image || "",
                downloadUrl: game.downloadUrl || "",
                packageStorageUrl: game.packageStorageUrl || "",
                fileName: game.fileName || "",
                fileSize: Number(game.fileSize || 0),
                active: game.active !== false,
                published: game.published !== false
            }));
            localStorage.setItem(GAME_CACHE_KEY, JSON.stringify(cacheSafeGames));
        } catch (cacheError) {
            console.warn("UIKIMODDER game cache could not be saved:", cacheError);
        }

        renderGames();
        renderApps();
    } catch (error) {
        console.error("Could not load games from Firestore:", error);
        if (!hasUsableContent) {
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
        }
    } finally {
        container.dataset.loading = "false";
    }
}

function initializeGameControls() {
    ["#gamesContainer", "#appsContainer"].forEach((selector) => {
        const container = $(selector);
        container?.addEventListener("click", (event) => {
            const card = event.target.closest("[data-item-id]");
            if (card) showItemDetails(card.dataset.itemId);
        });
    });
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
        let detail = "";
        try {
            const response = error.context;
            if (response && typeof response.clone === "function") {
                const payload = await response.clone().json();
                detail = payload?.error || payload?.message || "";
            }
        } catch {
            // Keep the SDK error as a fallback when the response is not JSON.
        }
        throw new Error(detail || error.message || "Could not prepare the secure upload.");
    }
    if (!data?.ok || !Array.isArray(data.uploads)) {
        throw new Error(data?.error || "The upload service returned an invalid response.");
    }
    return data;
}

function uploadFileWithProgress(file, signedUpload, label, onProgress) {
    return new Promise((resolve, reject) => {
        // Use the documented Storage REST signed-upload endpoint directly.
        // This avoids SDK FileBody/Buffer adapters that can fail on Android.
        const encodedPath = signedUpload.path.split("/").map(encodeURIComponent).join("/");
        const endpoint = "https://netztjoroixlbqntbnxi.supabase.co/storage/v1/object/upload/sign/" +
            "uikimodder-files/" + encodedPath +
            "?token=" + encodeURIComponent(signedUpload.token);

        const request = new XMLHttpRequest();
        request.open("PUT", endpoint, true);
        request.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
        request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        request.setRequestHeader("x-upsert", "false");
        request.timeout = 180000;

        request.upload.addEventListener("progress", (event) => {
            if (onProgress && event.lengthComputable) {
                onProgress(event.loaded, event.total);
            }
        });

        request.addEventListener("load", () => {
            if (request.status >= 200 && request.status < 300) {
                if (onProgress) onProgress(file.size, file.size);
                resolve(signedUpload.publicUrl);
                return;
            }

            let detail = request.responseText || "Storage rejected the upload.";
            try {
                const payload = JSON.parse(detail);
                detail = payload.message || payload.error || payload.msg || detail;
            } catch {
                // Keep the plain-text server response.
            }
            reject(new Error(label + " upload failed (" + request.status + "): " + detail));
        });

        request.addEventListener("error", () => {
            reject(new Error(label + " upload failed: Network or CORS error while sending the file."));
        });
        request.addEventListener("timeout", () => {
            reject(new Error(label + " upload failed: Upload timed out. Check the connection and try again."));
        });
        request.addEventListener("abort", () => {
            reject(new Error(label + " upload failed: Upload was cancelled."));
        });

        // Send the actual browser File bytes; do not convert to Buffer, Readable,
        // FormData, or a Node stream.
        request.send(file);
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
    $("#retryPublishBtn")?.addEventListener("click", async () => {
        if (!pendingGameRecord) {
            setStatus($("#uploadStatus"), "There is no pending game record to publish.", true);
            return;
        }
        const retryButton = $("#retryPublishBtn");
        retryButton.disabled = true;
        retryButton.textContent = "SAVING...";
        try {
            await addDoc(collection(db, "games"), pendingGameRecord);
            pendingGameRecord = null;
            retryButton.classList.add("hidden");
            $("#uploadForm")?.reset();
            $("#gameIconPreview")?.classList.add("hidden");
            setStatus($("#uploadStatus"), "Published successfully! Your game is now in the UIKIMODDER library.");
            await loadGames();
            renderApps();
        } catch (error) {
            console.error("Retry Firestore publish failed:", error);
            setStatus($("#uploadStatus"),
                "Firestore still rejected the record (" + (error.code || error.message) +
                "). Check that the latest Firestore rules are published.",
                true
            );
        } finally {
            retryButton.disabled = false;
            retryButton.textContent = "RETRY PUBLISH";
        }
    });

    $("#detailBackBtn")?.addEventListener("click", returnFromItemDetails);
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
        if (!name || !description || !category || !iconFile) {
            setStatus($("#uploadStatus"), "Please complete the game details and select a game icon.", true);
            return;
        }
        if (!file) {
            setStatus($("#uploadStatus"), "Please select a game package file.", true);
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
        let filesUploaded = false;
        try {
            const optimizedIcon = await makeUploadOptimizedIcon(iconFile);
            const uploadFiles = [{ kind: "icon", name: optimizedIcon.name, size: optimizedIcon.size }];
            uploadFiles.push({ kind: "package", name: file.name, size: file.size });

            setStatus($("#uploadStatus"), "Preparing secure Supabase upload...");
            const signedBatch = await createSignedUploadBatch(uploadFiles);
            createdPaths = signedBatch.uploads.map((item) => item.path);
            const iconUpload = signedBatch.uploads.find((item) => item.kind === "icon");
            const packageUpload = signedBatch.uploads.find((item) => item.kind === "package");
            if (!iconUpload || !packageUpload) {
                throw new Error("The upload service did not return all required upload permissions.");
            }

            let iconProgress = 0;
            let packageProgress = 0;
            const totalBytes = optimizedIcon.size + file.size;
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
            if (packageUpload) {
                uploadTasks.push(uploadFileWithProgress(file, packageUpload, "Game package", (bytes) => {
                    packageProgress = bytes;
                    updateCombinedProgress();
                }));
            }
            const uploadedUrls = await Promise.all(uploadTasks);
            const iconUrl = uploadedUrls[0];
            const packageDownloadUrl = uploadedUrls[1];
            filesUploaded = true;

            if (progressFill) progressFill.style.width = "100%";
            if (progressText) progressText.textContent = "100%";
            setStatus($("#uploadStatus"), "Saving game details to the library...");
            const itemId = signedBatch.itemId;
            pendingGameRecord = {
                name, description, category, type: itemType,
                downloadUrl: packageDownloadUrl,
                packageStorageUrl: packageDownloadUrl,
                storageProvider: "supabase",
                storageBucket: "uikimodder-files",
                storagePath: packageUpload.path,
                imageUrl: iconUrl,
                iconFileName: iconFile.name,
                fileName: file.name,
                fileSize: file.size,
                active: true, published: true, createdBy: user.uid,
                createdAt: serverTimestamp()
            };
            await addDoc(collection(db, "games"), pendingGameRecord);
            pendingGameRecord = null;
            $("#retryPublishBtn")?.classList.add("hidden");
            $("#uploadForm").reset();
            $("#gameIconPreview")?.classList.add("hidden");
            if ($("#uploadProgressFill")) $("#uploadProgressFill").style.width = "100%";
            if ($("#uploadProgressText")) $("#uploadProgressText").textContent = "100%";
            setStatus($("#uploadStatus"), "Published successfully! The download button is ready on UIKIMODDER.");
            await loadGames();
            renderApps();
        } catch (error) {
            console.error("Game upload failed:", error);
            const reason = error.message || error.code || "Unknown error";
            if (pendingGameRecord && filesUploaded) {
                // Storage upload succeeded. Keep the objects and allow a metadata-only retry
                // after the Firebase Firestore rules have been published.
                $("#retryPublishBtn")?.classList.remove("hidden");
                setStatus($("#uploadStatus"),
                    "Files uploaded successfully, but Firestore blocked the game record (" +
                    (error.code || reason) +
                    "). Publish the latest firestore.rules, then tap RETRY PUBLISH. Your files are محفوظ and will not be uploaded again.",
                    true
                );
            } else {
                await cleanupSupabaseUploads(createdPaths);
                setStatus($("#uploadStatus"), "Upload failed: " + reason, true);
            }
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
            $("#supportSection")?.classList.add("hidden");
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

    onAuthStateChanged(auth, async (user) => {
        const supportIsOpen = !$("#supportSection")?.classList.contains("hidden");
        const loggedIn = Boolean(user);

        $("#loginOpen")?.classList.toggle("hidden", loggedIn);
        $("#signupOpen")?.classList.toggle("hidden", loggedIn);
        $("#logoutBtn")?.classList.toggle("hidden", true);
        $("#bottomNav")?.classList.toggle("hidden", !loggedIn || supportIsOpen);
        $("#accountWelcome")?.classList.toggle("hidden", !loggedIn);

        currentUserIsAdmin = await checkCurrentUserAdmin(user);
        const isSuperAdmin = (user?.email || "").toLowerCase() === "abdullahcheemakv@gmail.com";
        const bottomNav = $("#bottomNav");
        $("#adminUploadNav")?.classList.toggle("hidden", !isSuperAdmin);
        bottomNav?.classList.toggle("admin-mode", isSuperAdmin);

        if (user) {
            console.log("Signed in:", user.email);
            document.documentElement.dataset.auth = "signed-in";
            const label = $("#accountWelcome");
            if (label) label.textContent = "Welcome back, " + (user.displayName || user.email?.split("@")[0] || "Gamer");
            if (supportIsOpen) showSupportBoard();
            else showStore(false);
        } else {
            bottomNav?.classList.remove("admin-mode");
            document.documentElement.dataset.auth = "signed-out";
            allGames = [];
            if (supportIsOpen) {
                showSupportBoard();
            } else {
                hideMainViews();
                $("#bottomNav")?.classList.add("hidden");
                $(".hero-section")?.classList.remove("hidden");
            }
        }
    });
}

function initializeWebsite() {
    initializeNavigation();
    initializeSupportBoard();
    initializeAuthentication();
    initializeGameControls();

    // Warm the public game library while the visitor is still on the home screen.
    loadGames();

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

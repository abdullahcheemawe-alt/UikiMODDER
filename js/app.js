"use strict";

/* =====================================
   UIKIMODDER - Main JavaScript
   ===================================== */

document.addEventListener("DOMContentLoaded", () => {
    console.log("UIKIMODDER website initialized.");

    initializeWebsite();
});

/**
 * Initialize website components.
 */
function initializeWebsite() {
    initializeNavigation();
    initializeAppStatus();
}

/**
 * Initialize navigation.
 */
function initializeNavigation() {
    const menuButton = document.querySelector("#menuButton");
    const navigation = document.querySelector("#navigation");

    if (!menuButton || !navigation) return;

    menuButton.addEventListener("click", () => {
        navigation.classList.toggle("active");
    });
}

/**
 * Initialize application status.
 */
function initializeAppStatus() {
    document.documentElement.dataset.app = "ready";

    console.log("UIKIMODDER is ready.");
}

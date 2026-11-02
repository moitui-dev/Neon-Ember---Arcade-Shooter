// Authentication & User Session Manager for Omni Gaming Network
// (Configured for Supabase or local session fallback)

const AUTH_STORAGE_KEY = 'omni_current_user';

// Check current session state on page load
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
});

function checkUserSession() {
    const user = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    const navLinks = document.querySelector('.nav-links');

    if (user) {
        // Replace Sign In button with user profile display & logout option
        navLinks.innerHTML = `
            <span style="font-size: 0.9rem; color: var(--text-muted);">👤 ${user.username}</span>
            <button class="nav-btn" onclick="handleSignOut()">Sign Out</button>
            <button class="nav-btn primary" onclick="alert('Check CONTRIBUTING.md to submit your own game via GitHub PR or URL!')">Submit Game</button>
        `;
    }
}

// Simple modal or prompt-based login for testing (can be swapped with Supabase Auth UI later)
function promptSignIn() {
    const username = prompt("Enter your player username:");
    if (username && username.trim() !== "") {
        const user = { username: username.trim(), joined: new Date().toISOString() };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        checkUserSession();
        window.location.reload();
    }
}

function handleSignOut() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    checkUserSession();
    window.location.reload();
}
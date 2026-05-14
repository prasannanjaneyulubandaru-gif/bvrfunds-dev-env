// Logout Handler Module

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://bvrfunds.top';

async function logout() {
    try {
        const userId = sessionStorage.getItem('user_id');
        console.log('Logging out...');
        if (userId) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId }
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    console.log('Logout successful:', data.message);
                } else {
                    console.warn('Logout warning:', data.error);
                }
            } catch (error) {
                console.error('Logout API error:', error);
            }
        }
        sessionStorage.clear();
        console.log('Session cleared');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}

function setupLogoutListeners() {
    const logoutButtons = document.querySelectorAll('[id*="logout"], [class*="logout-btn"]');
    logoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
    console.log(`Attached logout listeners to ${logoutButtons.length} buttons`);
}

document.addEventListener('DOMContentLoaded', () => {
    setupLogoutListeners();
});

function startSessionValidation() {
    setInterval(async () => {
        const userId = sessionStorage.getItem('user_id');
        if (!userId) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/check-session`, {
                headers: { 'X-User-ID': userId }
            });
            // Only logout on a confirmed invalid session (200 OK with valid=false)
            // Never logout on network errors or non-200 responses — that kills the
            // session if the backend is briefly unreachable (restart, blip, etc.)
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.valid === false) {
                    console.warn('Session confirmed invalid by backend — logging out');
                    await logout();
                }
            }
            // Non-OK (5xx, network error caught below): silently skip this tick
        } catch (error) {
            // Network error — backend unreachable, do NOT logout
            console.warn('Session validation network error (skipping tick):', error.message);
        }
    }, 60000);
}
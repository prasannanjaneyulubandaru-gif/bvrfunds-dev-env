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
            const data = await response.json();
            if (!response.ok || !data.valid) {
                console.warn('Session invalid, logging out...');
                await logout();
            }
        } catch (error) {
            console.error('Session validation error:', error);
        }
    }, 60000);
}

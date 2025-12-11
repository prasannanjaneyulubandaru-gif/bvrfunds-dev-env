// =========================================================
// AUTHENTICATION MODULE
// Handles login, session management, and logout
// Requires: shared_config.js
// =========================================================

/**
 * Initialize authentication on page load
 */
function initAuth() {
    console.log('Initializing authentication...');
    checkAuthStatus();
    setupAuthListeners();
}

/**
 * Check authentication status and handle URL parameters
 */
function checkAuthStatus() {
    console.log('Checking auth status...');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('request_token');
    const status = urlParams.get('status');
    const action = urlParams.get('action');

    if (token && status === 'success' && action === 'login') {
        const storedApiKey = sessionStorage.getItem('api_key');
        const storedApiSecret = sessionStorage.getItem('api_secret');

        if (storedApiKey && storedApiSecret) {
            state.apiKey = storedApiKey;
            state.apiSecret = storedApiSecret;
            const displayToken = document.getElementById('displayToken');
            if (displayToken) {
                displayToken.textContent = token.substring(0, 20) + '...';
            }
            showPage('token');
            setTimeout(() => completeLogin(token), 1000);
        } else {
            showError('Session expired. Please login again.');
            showPage('login');
        }
    } else {
        const accessToken = sessionStorage.getItem('access_token');
        if (accessToken) {
            state.accessToken = accessToken;
            state.userId = sessionStorage.getItem('user_id');
            loadProfile();
            showPage('dashboard');
        } else {
            showPage('login');
        }
    }
}

/**
 * Complete login process with request token
 */
async function completeLogin(requestToken) {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/generate-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: state.apiKey,
                api_secret: state.apiSecret,
                request_token: requestToken
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('user_id', data.user_id);
            state.accessToken = data.access_token;
            state.userId = data.user_id;

            await loadProfile();
            window.history.replaceState({}, document.title, window.location.pathname);
            showPage('dashboard');
        } else {
            throw new Error(data.error || 'Failed to generate session');
        }
    } catch (error) {
        console.error('Login error:', error);
        simulateDemoMode();
    }
}

/**
 * Load user profile from backend
 */
async function loadProfile() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/profile`, {
            headers: { 'X-User-ID': state.userId }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateProfile(data.profile);
            }
        }
    } catch (error) {
        console.error('Profile fetch error:', error);
    }
}

/**
 * Simulate demo mode for testing
 */
function simulateDemoMode() {
    const demoProfile = {
        user_id: 'DEMO123',
        user_name: 'Demo User',
        email: 'demo@bvrfunds.com',
        user_type: 'individual',
        broker: 'Zerodha',
        products: ['CNC', 'MIS', 'NRML']
    };
    updateProfile(demoProfile);
    setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        showPage('dashboard');
    }, 2000);
}

/**
 * Handle credentials form submission
 */
function handleCredentialsSubmit(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();

    if (!apiKey || !apiSecret) {
        showError('Please enter both API Key and API Secret');
        return;
    }

    state.apiKey = apiKey;
    state.apiSecret = apiSecret;

    sessionStorage.setItem('api_key', apiKey);
    sessionStorage.setItem('api_secret', apiSecret);

    const kiteAuthUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;
    window.location.href = kiteAuthUrl;
}

/**
 * Handle logout
 */
function handleLogout() {
    sessionStorage.clear();
    state = {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        userId: '',
        profile: null,
        currentPage: 'dashboard',
        orderBasket: [],
        placedOrders: [],
        selectedPosition: null,
        monitorInterval: null,
        monitorRunning: false,
        autoTrailInterval: null
    };
    if (state.monitorInterval) {
        clearInterval(state.monitorInterval);
    }
    if (state.autoTrailInterval) {
        clearInterval(state.autoTrailInterval);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    showPage('login');
}

/**
 * Setup authentication event listeners
 */
function setupAuthListeners() {
    // Credentials form
    const credentialsForm = document.getElementById('credentialsForm');
    if (credentialsForm) {
        credentialsForm.addEventListener('submit', handleCredentialsSubmit);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Profile dropdown
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    
    if (profileBtn && profileMenu) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('hidden');
        });
        
        document.addEventListener('click', () => {
            profileMenu.classList.add('hidden');
        });
    }
}

// Auto-initialize on load if this is the main script
if (typeof window !== 'undefined') {
    window.addEventListener('load', initAuth);
}

// Export functions to global scope
window.initAuth = initAuth;
window.checkAuthStatus = checkAuthStatus;
window.handleLogout = handleLogout;

// Configuration
const CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds.top'
};

// State management
let state = {
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    userId: '',
    profile: null,
    currentPage: 'dashboard'
};

// Initialize on page load
window.addEventListener('load', () => {
    console.log('Page loaded - initializing app');
    checkAuthStatus();
    setupEventListeners();
});

// ===========================================
// EVENT LISTENERS SETUP
// ===========================================

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            showPage(page);
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// ===========================================
// VIEW MANAGEMENT
// ===========================================

function showView(view) {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('tokenPage').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    
    switch(view) {
        case 'login':
            document.getElementById('loginPage').classList.remove('hidden');
            break;
        case 'token':
            document.getElementById('tokenPage').classList.remove('hidden');
            break;
        case 'app':
            document.getElementById('mainApp').classList.remove('hidden');
            break;
    }
}

function showPage(page) {
    console.log('Showing page:', page);

    const allPageIds = [
        'dashboardPage',
        'chartMonitorPage',
        'managePositionsPage',
        'optionSpreadsPage',
        'futureSpreadsPage',
        'shortStraddlePage',
        'tradingPage'
    ];

    allPageIds.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.classList.add('hidden');
    });

    const pageMap = {
        'dashboard':        'dashboardPage',
        'chart-monitor':    'chartMonitorPage',
        'manage-positions': 'managePositionsPage',
        'option-spreads':   'optionSpreadsPage',
        'future-spreads':   'futureSpreadsPage',
        'short-straddle':   'shortStraddlePage',
        'trading':          'tradingPage'
    };

    const targetId = pageMap[page];
    if (targetId) {
        const el = document.getElementById(targetId);
        if (el) el.classList.remove('hidden');
        else console.error('Page element not found:', targetId);
    } else {
        console.error('Unknown page:', page);
    }

    if (page === 'chart-monitor' && typeof initializeChartMonitor === 'function') {
        initializeChartMonitor();
    }

    if (page === 'manage-positions' && typeof loadPositions === 'function') {
        setTimeout(() => loadPositions(), 100);
    }

    if (page === 'dashboard') {
        if (typeof window.DashboardModule !== 'undefined' && typeof window.DashboardModule.initialize === 'function') {
            setTimeout(() => {
                if (window.DashboardModule) window.DashboardModule.initialize();
            }, 100);
        }
    }

    if (page === 'trading' && window.TradingPage) {
        window.TradingPage.init();
    }

    updateActiveMenuItem(page);
    state.currentPage = page;
}

function updateActiveMenuItem(page) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
}

window.navigateToPage = function(page) {
    showPage(page);
};

// ===========================================
// AUTHENTICATION & SESSION MANAGEMENT
// ===========================================

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
            showView('token');
            document.getElementById('displayToken').textContent = token.substring(0, 20) + '...';
            setTimeout(() => completeLogin(token), 1000);
        } else {
            showError('Session expired. Please login again.');
            showView('login');
        }
    } else {
        const accessToken = sessionStorage.getItem('access_token');
        const userId = sessionStorage.getItem('user_id');
        
        if (accessToken && userId) {
            console.log('Found existing session:', { userId, accessToken: accessToken.substring(0, 10) + '...' });
            
            verifySessionWithBackend(userId).then(isValid => {
                if (isValid) {
                    state.accessToken = accessToken;
                    state.userId = userId;
                    loadProfile();
                    showView('app');
                    showPage('dashboard');
                } else {
                    console.log('Session invalid on backend - showing login');
                    sessionStorage.clear();
                    showView('login');
                }
            }).catch(error => {
                // Network error — retry once after 2s before giving up
                console.warn('Session check failed, retrying...', error);
                setTimeout(() => {
                    verifySessionWithBackend(userId).then(isValid => {
                        if (isValid) {
                            state.accessToken = accessToken;
                            state.userId = userId;
                            loadProfile();
                            showView('app');
                            showPage('dashboard');
                        } else {
                            console.log('Session invalid after retry — clearing');
                            sessionStorage.clear();
                            showView('login');
                        }
                    }).catch(() => {
                        console.error('Backend unreachable — clearing session');
                        sessionStorage.clear();
                        showView('login');
                    });
                }, 2000);
            });
        } else {
            console.log('No session found - showing login');
            showView('login');
        }
    }
}

async function verifySessionWithBackend(userId) {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/check-session`, {
            method: 'GET',
            headers: { 'X-User-ID': userId }
        });
        if (response.ok) {
            const data = await response.json();
            return data.success && data.valid;
        }
        return false;
    } catch (error) {
        console.error('Session verification error:', error);
        throw error;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();
    
    if (!apiKey || !apiSecret) {
        showError('Please enter both API Key and Secret');
        return;
    }
    
    sessionStorage.setItem('api_key', apiKey);
    sessionStorage.setItem('api_secret', apiSecret);
    state.apiKey = apiKey;
    state.apiSecret = apiSecret;
    
    const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;
    window.location.href = loginUrl;
}

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
            
            console.log('Login successful:', { userId: data.user_id });
            
            await loadProfile();
            window.history.replaceState({}, document.title, window.location.pathname);
            showView('app');
            showPage('dashboard');
        } else {
            throw new Error(data.error || 'Failed to generate session');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed: ' + error.message);
        setTimeout(() => { showView('login'); }, 2000);
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        const userId = sessionStorage.getItem('user_id');
        if (userId) {
            fetch(`${CONFIG.backendUrl}/api/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-ID': userId 
                }
            }).catch(error => console.error('Logout error:', error));
        }
        sessionStorage.clear();
        window.location.reload();
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.querySelector('p').textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => { errorElement.classList.add('hidden'); }, 5000);
    }
}

// ===========================================
// PROFILE MANAGEMENT
// ===========================================

async function loadProfile() {
    // state.userId may be empty if called before verifySessionWithBackend resolves,
    // so always fall back to sessionStorage as the source of truth
    const userId = state.userId || sessionStorage.getItem('user_id');
    if (!userId) {
        console.warn('loadProfile: no userId available, skipping');
        return;
    }
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/profile`, {
            headers: { 'X-User-ID': userId }
        });
        if (response.status === 401) {
            console.warn('Profile: session expired');
            sessionStorage.clear();
            window.location.reload();
            return;
        }
        if (response.ok) {
            const data = await response.json();
            if (data.success) updateProfile(data.profile);
            else console.error('Profile error from server:', data.error);
        } else {
            console.error('Profile fetch failed, status:', response.status);
        }
    } catch (error) {
        console.error('Profile fetch error:', error);
        // Show a minimal placeholder so the sidebar isn't blank
        updateProfile({
            user_id: userId,
            user_name: 'User',
            email: '',
            user_type: 'individual',
            broker: 'Zerodha',
            products: []
        });
    }
}

function updateProfile(profile) {
    state.profile = profile;
    
    const nameParts = profile.user_name.split(' ');
    const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileInitials = document.getElementById('profileInitials');
    if (profileName) profileName.textContent = profile.user_name;
    if (profileEmail) profileEmail.textContent = profile.email;
    if (profileInitials) profileInitials.textContent = initials;
    
    const menuUserName = document.getElementById('menuUserName');
    const menuUserId = document.getElementById('menuUserId');
    const menuEmail = document.getElementById('menuEmail');
    if (menuUserName) menuUserName.textContent = profile.user_name;
    if (menuUserId) menuUserId.textContent = profile.user_id;
    if (menuEmail) menuEmail.textContent = profile.email;
    
    const dashboardUserId = document.getElementById('dashboardUserId');
    if (dashboardUserId) dashboardUserId.textContent = `User ID: ${profile.user_id}`;
    
    const productsContainer = document.getElementById('menuProducts');
    if (productsContainer) {
        productsContainer.innerHTML = '';
        if (profile.products && profile.products.length > 0) {
            profile.products.forEach(product => {
                const badge = document.createElement('span');
                badge.className = 'px-2 py-1 bg-[#FE4A03] bg-opacity-10 text-[#FE4A03] text-xs font-semibold rounded';
                badge.textContent = product.toUpperCase();
                productsContainer.appendChild(badge);
            });
        }
    }
}
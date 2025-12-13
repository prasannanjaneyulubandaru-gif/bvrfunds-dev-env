// Configuration
const CONFIG = {
    redirectUrl: window.location.origin + window.location.pathname.replace(/\/+$/, ''),
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
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
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            showPage(page);
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// ===========================================
// VIEW MANAGEMENT
// ===========================================

function showView(view) {
    // Hide all main views
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('tokenPage').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    
    // Show requested view
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
    
    // Convert page name to camelCase for element ID
    // 'chart-monitor' -> 'chartMonitor'
    const pageId = page.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    console.log('Converted to pageId:', pageId);
    
    // Hide all pages inside mainApp
    const pages = ['dashboardPage', 'chartMonitorPage'];
    pages.forEach(p => {
        const element = document.getElementById(p);
        if (element) {
            element.classList.add('hidden');
            console.log('Hiding:', p);
        }
    });
    
    // Show requested page
    const pageElement = document.getElementById(pageId + 'Page');
    console.log('Looking for element:', pageId + 'Page', 'Found:', !!pageElement);
    
    if (pageElement) {
        pageElement.classList.remove('hidden');
        console.log('Showing:', pageId + 'Page');
    } else {
        console.error('Page element not found:', pageId + 'Page');
    }
    
    // Initialize chart monitor if navigating to it
    if (page === 'chart-monitor' && typeof initializeChartMonitor === 'function') {
        console.log('Initializing chart monitor');
        initializeChartMonitor();
    }
    
    // Update active menu item
    updateActiveMenuItem(page);
    
    // Update state
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

// Helper function for navigation
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

    // Check if returning from Kite login
    if (token && status === 'success' && action === 'login') {
        const storedApiKey = sessionStorage.getItem('api_key');
        const storedApiSecret = sessionStorage.getItem('api_secret');

        if (storedApiKey && storedApiSecret) {
            state.apiKey = storedApiKey;
            state.apiSecret = storedApiSecret;
            
            // Show token page
            showView('token');
            document.getElementById('displayToken').textContent = token.substring(0, 20) + '...';
            
            // Complete login
            setTimeout(() => completeLogin(token), 1000);
        } else {
            showError('Session expired. Please login again.');
            showView('login');
        }
    } else {
        // Check if already logged in
        const accessToken = sessionStorage.getItem('access_token');
        if (accessToken) {
            // Load dashboard
            state.accessToken = accessToken;
            state.userId = sessionStorage.getItem('user_id');
            loadProfile();
            showView('app');
            showPage('dashboard');
        } else {
            // Show login
            showView('login');
        }
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
    
    // Store credentials
    sessionStorage.setItem('api_key', apiKey);
    sessionStorage.setItem('api_secret', apiSecret);
    state.apiKey = apiKey;
    state.apiSecret = apiSecret;
    
    // Redirect to Kite login
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
            // Store session - IMPORTANT: Store as 'userid' for manage_positions.js compatibility
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('user_id', data.user_id);
            sessionStorage.setItem('userid', data.user_id); // For manage_positions.js
            sessionStorage.setItem('api_key', state.apiKey); // Store for future use
            
            state.accessToken = data.access_token;
            state.userId = data.user_id;
            
            // Load profile and show dashboard
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
        
        // Show login page again
        setTimeout(() => {
            showView('login');
        }, 2000);
    }
}

function handleLogout() {
    showLogoutConfirm('Are you sure you want to logout?');
}

function showLogoutConfirm(message) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-md shadow-2xl">
            <h3 class="text-lg font-bold text-gray-900 mb-4">⚠️ Confirm Logout</h3>
            <p class="text-gray-700 mb-6">${message}</p>
            <div class="flex gap-3 justify-end">
                <button id="logoutNo" class="px-6 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button id="logoutYes" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                    Logout
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('logoutYes').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.reload();
    });
    
    document.getElementById('logoutNo').addEventListener('click', () => {
        overlay.remove();
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.querySelector('p').textContent = message;
        errorElement.classList.remove('hidden');
        
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}

// ===========================================
// PROFILE MANAGEMENT
// ===========================================

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
        // Use fallback profile
        updateProfile({
            user_id: state.userId,
            user_name: 'User',
            email: 'user@bvrfunds.com',
            user_type: 'individual',
            broker: 'Zerodha',
            products: ['CNC', 'MIS']
        });
    }
}

function updateProfile(profile) {
    state.profile = profile;
    
    // Generate initials
    const nameParts = profile.user_name.split(' ');
    const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    // Update TOP BAR (Main Profile Display)
    const topBarUserName = document.getElementById('topBarUserName');
    const topBarUserId = document.getElementById('topBarUserId');
    const profileInitials = document.getElementById('profileInitials');
    
    if (topBarUserName) topBarUserName.textContent = profile.user_name;
    if (topBarUserId) topBarUserId.textContent = `ID: ${profile.user_id}`;
    if (profileInitials) profileInitials.textContent = initials;
    
    // Update DROPDOWN MENU
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserId = document.getElementById('dropdownUserId');
    const dropdownEmail = document.getElementById('dropdownEmail');
    const dropdownProducts = document.getElementById('dropdownProducts');
    
    if (dropdownUserName) dropdownUserName.textContent = profile.user_name;
    if (dropdownUserId) dropdownUserId.textContent = profile.user_id;
    if (dropdownEmail) dropdownEmail.textContent = profile.email;
    
    if (dropdownProducts && profile.products) {
        dropdownProducts.innerHTML = '';
        profile.products.forEach(product => {
            const badge = document.createElement('span');
            badge.className = 'px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded';
            badge.textContent = product;
            dropdownProducts.appendChild(badge);
        });
    }
    
    // Update DASHBOARD
    const dashboardUserId = document.getElementById('dashboardUserId');
    if (dashboardUserId) dashboardUserId.textContent = `User ID: ${profile.user_id}`;
}

// User dropdown toggle
window.toggleUserDropdown = function() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const avatar = document.querySelector('[onclick="toggleUserDropdown()"]');
    if (dropdown && avatar && !dropdown.contains(e.target) && !avatar.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

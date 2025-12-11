// =========================================================
// SHARED CONFIGURATION AND UTILITIES
// This file contains shared config, state, and utility functions
// Include this file first before any page-specific JS files
// =========================================================

// Configuration
const CONFIG = {
    redirectUrl: window.location.origin + window.location.pathname.replace(/\/+$/, ''),
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// Global state management
let state = {
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

// =========================================================
// UTILITY FUNCTIONS
// =========================================================

/**
 * Update profile information in the UI
 */
function updateProfile(profile) {
    state.profile = profile;
    const nameParts = profile.user_name.split(' ');
    const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    const elements = {
        profileName: profile.user_name,
        profileEmail: profile.email,
        profileInitials: initials,
        menuUserName: profile.user_name,
        menuUserId: profile.user_id,
        menuEmail: profile.email,
        menuUserType: profile.user_type || 'individual',
        menuBroker: profile.broker || 'Zerodha'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    const productsContainer = document.getElementById('menuProducts');
    if (productsContainer && profile.products && profile.products.length > 0) {
        productsContainer.innerHTML = '';
        profile.products.forEach(product => {
            const badge = document.createElement('span');
            badge.className = 'px-2 py-1 bg-[#FE4A03] bg-opacity-10 text-[#FE4A03] text-xs font-semibold rounded';
            badge.textContent = product.toUpperCase();
            productsContainer.appendChild(badge);
        });
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        const messageP = errorElement.querySelector('p');
        if (messageP) messageP.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

/**
 * Show page navigation
 */
function showPage(page) {
    // Hide all pages
    const pages = ['loginPage', 'tokenPage', 'dashboardPage', 'placeOrdersPage', 
                   'strategiesPage', 'managePositionsPage', 'chartMonitorPage'];
    
    pages.forEach(pageId => {
        const element = document.getElementById(pageId);
        if (element) element.classList.add('hidden');
    });
    
    const sidebar = document.getElementById('sidebar');
    const profileSection = document.getElementById('profileSection');
    
    if (sidebar) sidebar.classList.add('hidden');
    if (profileSection) profileSection.classList.add('hidden');

    switch(page) {
        case 'login':
            const loginPage = document.getElementById('loginPage');
            if (loginPage) loginPage.classList.remove('hidden');
            break;
        case 'token':
            const tokenPage = document.getElementById('tokenPage');
            if (tokenPage) tokenPage.classList.remove('hidden');
            break;
        case 'dashboard':
        case 'place-orders':
        case 'strategies':
        case 'manage-positions':
        case 'chart-monitor':
            const pageMap = {
                'dashboard': 'dashboardPage',
                'place-orders': 'placeOrdersPage',
                'strategies': 'strategiesPage',
                'manage-positions': 'managePositionsPage',
                'chart-monitor': 'chartMonitorPage'
            };
            const targetPage = document.getElementById(pageMap[page]);
            if (targetPage) {
                targetPage.classList.remove('hidden');
                if (sidebar) sidebar.classList.remove('hidden');
                if (profileSection) profileSection.classList.remove('hidden');
                state.currentPage = page;
                updateActiveMenuItem(page);
                
                // Special page initialization
                if (page === 'manage-positions' && typeof loadPositions === 'function') {
                    loadPositions();
                }
            }
            break;
    }
}

/**
 * Update active menu item
 */
function updateActiveMenuItem(page) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
}

/**
 * Get instrument token for a symbol
 */
async function getInstrumentToken(exchange, tradingsymbol) {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/get-instrument-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                exchange: exchange,
                tradingsymbol: tradingsymbol
            })
        });
        
        const data = await response.json();
        return data.success ? data.instrument_token : null;
    } catch (error) {
        console.error('Error getting instrument token:', error);
        return null;
    }
}

/**
 * Setup symbol autocomplete (placeholder - implement if needed)
 */
function setupSymbolAutocomplete() {
    // Implement symbol autocomplete functionality here
    // This would typically connect to an API that provides symbol suggestions
    console.log('Symbol autocomplete initialized');
}

// Export to global scope
window.CONFIG = CONFIG;
window.state = state;
window.updateProfile = updateProfile;
window.showError = showError;
window.showPage = showPage;
window.updateActiveMenuItem = updateActiveMenuItem;
window.getInstrumentToken = getInstrumentToken;
window.setupSymbolAutocomplete = setupSymbolAutocomplete;

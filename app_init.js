// =========================================================
// MASTER APP INITIALIZATION
// Coordinates all page modules and navigation
// Include this file last, after all other modules
// =========================================================

/**
 * Initialize the entire application
 */
function initializeApp() {
    console.log('🚀 Initializing BVR Funds Trading Platform...');
    
    // Setup global navigation
    setupNavigation();
    
    // Initialize authentication (this will check status and show appropriate page)
    if (typeof initAuth === 'function') {
        initAuth();
    } else {
        console.warn('Auth module not loaded');
    }
}

/**
 * Setup navigation and menu items
 */
function setupNavigation() {
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });
}

/**
 * Navigate to a specific page
 */
function navigateToPage(page) {
    showPage(page);
    
    // Initialize page-specific functionality
    switch(page) {
        case 'place-orders':
            if (typeof initPlaceOrders === 'function') {
                initPlaceOrders();
            }
            break;
        case 'manage-positions':
            if (typeof initManagePositions === 'function') {
                initManagePositions();
            }
            break;
        case 'chart-monitor':
            if (typeof initChartMonitor === 'function') {
                initChartMonitor();
            }
            break;
        case 'strategies':
            if (typeof setupStrategiesListeners === 'function') {
                setupStrategiesListeners();
            }
            break;
    }
}

/**
 * Check if all required modules are loaded
 */
function checkDependencies() {
    const required = [
        'CONFIG',
        'state',
        'showPage',
        'updateProfile'
    ];
    
    const missing = required.filter(dep => typeof window[dep] === 'undefined');
    
    if (missing.length > 0) {
        console.error('❌ Missing dependencies:', missing);
        console.error('Make sure shared_config.js is loaded first!');
        return false;
    }
    
    return true;
}

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // You could send this to a logging service
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (checkDependencies()) {
            initializeApp();
        }
    });
} else {
    // DOM already loaded
    if (checkDependencies()) {
        initializeApp();
    }
}

// Export functions
window.initializeApp = initializeApp;
window.navigateToPage = navigateToPage;

console.log('✅ App initialization module loaded');

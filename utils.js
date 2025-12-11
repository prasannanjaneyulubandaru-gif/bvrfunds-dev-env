// =========================================================
// SHARED UTILITIES
// Common functions used across multiple modules
// Requires: shared_config.js
// =========================================================

/**
 * API Wrapper - Centralized fetch logic with error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/orders')
 * @param {Object|null} data - Request payload
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @returns {Promise<Object>} API response data
 */
async function apiCall(endpoint, data = null, method = 'POST') {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${CONFIG.backendUrl}${endpoint}`, options);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Request failed');
        }
        
        return result;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

/**
 * UI State Manager - Handle loading states, show/hide elements
 */
class UIStateManager {
    /**
     * Toggle loading state on a button
     * @param {string} elementId - Button element ID
     * @param {boolean} isLoading - Loading state
     * @param {string} loadingText - Text to show while loading
     */
    static toggleLoading(elementId, isLoading, loadingText = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (isLoading) {
            element.dataset.originalContent = element.innerHTML;
            element.disabled = true;
            element.innerHTML = `
                <div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ${loadingText}
            `;
        } else {
            element.disabled = false;
            element.innerHTML = element.dataset.originalContent || element.innerHTML;
            delete element.dataset.originalContent;
        }
    }
    
    /**
     * Show or hide an element
     * @param {string} elementId - Element ID
     * @param {boolean} show - Whether to show (true) or hide (false)
     */
    static showElement(elementId, show = true) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }
    
    /**
     * Show or hide multiple elements
     * @param {string[]} elementIds - Array of element IDs
     * @param {boolean} show - Whether to show or hide
     */
    static showElements(elementIds, show = true) {
        elementIds.forEach(id => this.showElement(id, show));
    }
    
    /**
     * Set text content safely
     * @param {string} elementId - Element ID
     * @param {string} text - Text to set
     */
    static setText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
}

/**
 * Display results in a standardized format
 * @param {string} containerId - Container element ID
 * @param {Array} results - Array of result objects
 * @param {Object} options - Display options
 */
function displayResults(containerId, results, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const { 
        emptyMessage = 'No results',
        successColor = 'green',
        errorColor = 'red',
        showOrderId = true,
        showIcon = true
    } = options;
    
    if (!results || results.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-8">${emptyMessage}</div>`;
        return;
    }
    
    let html = '<div class="space-y-2">';
    
    results.forEach(result => {
        const isSuccess = result.success !== false && !result.error;
        const color = isSuccess ? successColor : errorColor;
        const icon = isSuccess ? '✅' : '❌';
        
        html += `
            <div class="p-3 bg-${color}-50 border-2 border-${color}-200 rounded-lg">
                <div class="flex items-center gap-2">
                    ${showIcon ? `<span>${icon}</span>` : ''}
                    <span class="font-semibold">${result.symbol || result.tradingsymbol || 'Order'}</span>
                    ${showOrderId && result.order_id ? `<span class="text-sm text-gray-600">ID: ${result.order_id}</span>` : ''}
                    ${result.error ? `<span class="text-sm text-${errorColor}-600">${result.error}</span>` : ''}
                    ${result.message ? `<span class="text-sm text-gray-600">${result.message}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Display order status with detailed information
 * @param {string} containerId - Container element ID
 * @param {Array} statuses - Array of order status objects
 */
function displayOrderStatus(containerId, statuses) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!statuses || statuses.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">No orders to display</div>';
        return;
    }
    
    let html = '<h3 class="font-bold text-gray-900 mb-3">Order Status</h3><div class="space-y-2">';
    
    statuses.forEach(status => {
        if (status.error) {
            html += `
                <div class="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div class="text-sm">
                        <span class="font-semibold">Order ${status.order_id}</span>
                        <span class="text-red-600"> - Error: ${status.error}</span>
                    </div>
                </div>
            `;
            return;
        }
        
        let statusColor = 'gray';
        let statusIcon = '❓';
        
        if (status.status === 'COMPLETE') {
            statusColor = 'green';
            statusIcon = '✅';
        } else if (status.status === 'REJECTED') {
            statusColor = 'red';
            statusIcon = '❌';
        } else if (status.status === 'CANCELLED') {
            statusColor = 'orange';
            statusIcon = '🚫';
        } else if (status.status === 'OPEN' || status.status === 'TRIGGER PENDING') {
            statusColor = 'blue';
            statusIcon = '⏳';
        }
        
        html += `
            <div class="p-3 bg-${statusColor}-50 border-2 border-${statusColor}-200 rounded-lg">
                <div class="text-sm">
                    <span>${statusIcon}</span>
                    <span class="font-semibold ml-2">${status.tradingsymbol}</span>
                    <span class="text-gray-600"> (${status.order_id})</span>
                    <span class="ml-2 font-semibold text-${statusColor}-600">${status.status}</span>
                    ${status.status_message ? `<span class="text-gray-600"> - ${status.status_message}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Display margin check results
 * @param {string} containerId - Container element ID
 * @param {Object} marginData - Margin data from API
 * @param {string} color - Color theme ('green', 'blue', etc.)
 */
function displayMarginResults(containerId, marginData, color = 'blue') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const sufficient = marginData.available_balance >= marginData.total_required;
    
    let html = `
        <div class="p-4 bg-${color}-50 border-2 border-${color}-200 rounded-lg">
            <h4 class="font-bold text-${color}-900 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Margin Check Results
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                <div class="bg-white rounded-lg p-3 border border-${color}-200">
                    <span class="text-gray-600 block mb-1">Available Balance</span>
                    <span class="font-bold text-lg">₹${marginData.available_balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="bg-white rounded-lg p-3 border border-${color}-200">
                    <span class="text-gray-600 block mb-1">Required Margin</span>
                    <span class="font-bold text-lg">₹${marginData.total_required.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="bg-white rounded-lg p-3 border border-${color}-200">
                    <span class="text-gray-600 block mb-1">Remaining</span>
                    <span class="font-bold text-lg">₹${(marginData.available_balance - marginData.total_required).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
            <div class="font-bold text-${color}-700 text-center py-2">
                ${sufficient ? '✅ Sufficient funds available' : '⚠️ Insufficient funds - need ₹' + (marginData.total_required - marginData.available_balance).toLocaleString('en-IN', {minimumFractionDigits: 2}) + ' more'}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.classList.remove('hidden');
}

/**
 * Show error message
 * @param {string} message - Error message
 * @param {Object} options - Display options
 */
function showErrorMessage(message, options = {}) {
    const {
        containerId = 'errorMessage',
        duration = 5000,
        autoHide = false
    } = options;
    
    const container = document.getElementById(containerId);
    if (!container) {
        // Fallback to alert if container not found
        alert(message);
        return;
    }
    
    const messageP = container.querySelector('p');
    if (messageP) {
        messageP.textContent = message;
    } else {
        container.innerHTML = `<p class="text-red-600 font-semibold">${message}</p>`;
    }
    
    container.classList.remove('hidden');
    
    if (autoHide && duration > 0) {
        setTimeout(() => {
            container.classList.add('hidden');
        }, duration);
    }
}

/**
 * Format currency in Indian format
 * @param {number} amount - Amount to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, decimals = 2) {
    return '₹' + amount.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Create a badge element
 * @param {string} text - Badge text
 * @param {string} type - Badge type ('buy', 'sell', 'info', etc.)
 * @returns {string} HTML string for badge
 */
function createBadge(text, type = 'info') {
    const typeClasses = {
        'buy': 'badge-buy',
        'sell': 'badge-sell',
        'info': 'badge-info',
        'success': 'badge-success',
        'warning': 'badge-warning',
        'error': 'badge-error'
    };
    
    const className = typeClasses[type] || 'badge-info';
    return `<span class="badge ${className}">${text}</span>`;
}

/**
 * Debounce function to limit rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export to global scope
window.apiCall = apiCall;
window.UIStateManager = UIStateManager;
window.displayResults = displayResults;
window.displayOrderStatus = displayOrderStatus;
window.displayMarginResults = displayMarginResults;
window.showErrorMessage = showErrorMessage;
window.formatCurrency = formatCurrency;
window.createBadge = createBadge;
window.debounce = debounce;

console.log('✅ Shared utilities module loaded');

// =========================================================
// MARGIN UTILITIES - SHARED MODULE
// Common margin checking functionality used across the app
// =========================================================

/**
 * Check margin for a basket of orders
 * @param {Array} basket - Array of order objects
 * @param {string} endpoint - API endpoint to call ('/api/basket-margin' or '/api/strategy/check-basket-margin')
 * @param {string} userId - User ID for authentication
 * @param {string} backendUrl - Backend URL
 * @returns {Promise<Object>} Margin check result
 */
async function checkMarginForBasket(basket, endpoint, userId, backendUrl) {
    if (!basket || basket.length === 0) {
        throw new Error('Basket is empty');
    }
    
    const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
        },
        body: JSON.stringify({ orders: basket })
    });
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'Failed to check margin');
    }
    
    return data;
}

/**
 * Display margin check results in a formatted HTML div
 * @param {Object} marginData - Margin data from API
 * @param {string} containerId - ID of container element to update
 * @param {string} styleType - 'simple' or 'detailed' (optional, defaults to 'detailed')
 */
function displayMarginResults(marginData, containerId, styleType = 'detailed') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    
    const sufficient = marginData.sufficient;
    const color = sufficient ? 'green' : 'red';
    const remaining = marginData.available_balance - marginData.total_required;
    
    if (styleType === 'simple') {
        // Simple layout for Place Orders page
        container.innerHTML = `
            <div class="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <h3 class="font-bold text-gray-900 mb-2">Margin Check</h3>
                <div class="space-y-1 text-sm">
                    <div class="flex justify-between">
                        <span>Available Balance:</span>
                        <span class="font-semibold">₹${marginData.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Required Margin:</span>
                        <span class="font-semibold">₹${marginData.total_required.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="flex justify-between pt-2 border-t">
                        <span>Status:</span>
                        <span class="font-bold ${sufficient ? 'text-green-600' : 'text-red-600'}">
                            ${sufficient ? '✅ Sufficient Funds' : '⚠️ Insufficient Funds'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Detailed layout for Strategy Deployment modal
        container.innerHTML = `
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
                        <span class="font-bold text-lg">₹${remaining.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
                <div class="font-bold text-${color}-700 text-center py-2">
                    ${sufficient 
                        ? '✅ Sufficient funds available' 
                        : `⚠️ Insufficient funds - need ₹${Math.abs(remaining).toLocaleString('en-IN', {minimumFractionDigits: 2})} more`
                    }
                </div>
            </div>
        `;
    }
    
    container.classList.remove('hidden');
}

/**
 * Display loading state for margin check
 * @param {string} containerId - ID of container element
 */
function showMarginLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="inline-block w-6 h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p class="text-sm text-gray-600 mt-2">Checking margin...</p>
        </div>
    `;
    container.classList.remove('hidden');
}

/**
 * Display error for margin check
 * @param {string} containerId - ID of container element
 * @param {string} errorMessage - Error message to display
 */
function showMarginError(containerId, errorMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <p class="text-red-700">❌ Error checking margin: ${errorMessage}</p>
        </div>
    `;
    container.classList.remove('hidden');
}

// Export functions for use in other modules
window.MarginUtils = {
    checkMarginForBasket,
    displayMarginResults,
    showMarginLoading,
    showMarginError
};

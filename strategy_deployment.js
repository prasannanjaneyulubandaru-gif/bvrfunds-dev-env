// =========================================================
// ENHANCED STRATEGY DEPLOYMENT WITH BASKET SYSTEM
// Replace the existing strategy_deployment.js with this version
// =========================================================

// Store selected strategy data
let selectedStrategyData = {
    bullish: null,
    bearish: null
};

// Store basket orders
let strategyBasket = [];

/**
 * Update executeBullishStrategy to show Deploy button after finding instruments
 */
async function executeBullishStrategy() {
    const button = document.getElementById('executeBullishBtn');
    const deployBtn = document.getElementById('deployBullishBtn');
    const loading = document.getElementById('bullishLoading');
    const results = document.getElementById('bullishResults');
    
    const lowerPremium = parseFloat(document.getElementById('lowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('upperPremium').value);
    
    if (lowerPremium >= upperPremium) {
        alert('Lower premium must be less than upper premium');
        return;
    }
    
    button.classList.add('hidden');
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    if (deployBtn) deployBtn.classList.add('hidden');
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/strategy/bullish-future-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                lower_premium: lowerPremium,
                upper_premium: upperPremium
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            selectedStrategyData.bullish = data;
            displayBullishResults(data);
            
            if (deployBtn) {
                deployBtn.classList.remove('hidden');
            }
            
            console.log('=== BULLISH FUTURE SPREAD ===');
            console.log('Future:', data.future);
            console.log('Hedge:', data.hedge);
            console.log('============================');
        } else {
            throw new Error(data.error || 'Failed to execute strategy');
        }
        
    } catch (error) {
        console.error('Strategy error:', error);
        alert('Error executing strategy: ' + error.message);
    } finally {
        button.classList.remove('hidden');
        loading.classList.add('hidden');
    }
}

/**
 * Update executeBearishStrategy similarly
 */
async function executeBearishStrategy() {
    const button = document.getElementById('executeBearishBtn');
    const deployBtn = document.getElementById('deployBearishBtn');
    const loading = document.getElementById('bearishLoading');
    const results = document.getElementById('bearishResults');
    
    const lowerPremium = parseFloat(document.getElementById('lowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('upperPremium').value);
    
    if (lowerPremium >= upperPremium) {
        alert('Lower premium must be less than upper premium');
        return;
    }
    
    button.classList.add('hidden');
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    if (deployBtn) deployBtn.classList.add('hidden');
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/strategy/bearish-future-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                lower_premium: lowerPremium,
                upper_premium: upperPremium
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            selectedStrategyData.bearish = data;
            displayBearishResults(data);
            
            if (deployBtn) {
                deployBtn.classList.remove('hidden');
            }
            
            console.log('=== BEARISH FUTURE SPREAD ===');
            console.log('Future:', data.future);
            console.log('Hedge:', data.hedge);
            console.log('=============================');
        } else {
            throw new Error(data.error || 'Failed to execute strategy');
        }
        
    } catch (error) {
        console.error('Strategy error:', error);
        alert('Error executing strategy: ' + error.message);
    } finally {
        button.classList.remove('hidden');
        loading.classList.add('hidden');
    }
}

/**
 * Open deployment modal for Bullish strategy
 */
function openBullishDeployment() {
    const data = selectedStrategyData.bullish;
    if (!data || !data.future || !data.hedge) {
        alert('Please find instruments first');
        return;
    }
    
    // Clear basket when opening new deployment
    strategyBasket = [];
    showDeploymentModal('bullish', data);
}

/**
 * Open deployment modal for Bearish strategy
 */
function openBearishDeployment() {
    const data = selectedStrategyData.bearish;
    if (!data || !data.future || !data.hedge) {
        alert('Please find instruments first');
        return;
    }
    
    strategyBasket = [];
    showDeploymentModal('bearish', data);
}

/**
 * Show deployment modal with order panels and basket
 */
function showDeploymentModal(strategyType, data) {
    const modal = document.createElement('div');
    modal.id = 'deploymentModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.style.animation = 'fadeIn 0.3s ease-out';
    
    const futureTransactionType = strategyType === 'bullish' ? 'BUY' : 'SELL';
    const hedgeTransactionType = 'BUY';
    
    const strategyTitle = strategyType === 'bullish' ? 'Bullish Future Spread' : 'Bearish Future Spread';
    const strategyColor = strategyType === 'bullish' ? 'green' : 'red';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <!-- Header -->
            <div class="bg-gradient-to-r from-${strategyColor}-50 to-${strategyColor}-100 p-6 border-b-2 border-gray-200 sticky top-0 z-10">
                <div class="flex items-center justify-between">
                    <h2 class="text-2xl font-bold text-gray-900">🚀 Deploy ${strategyTitle}</h2>
                    <button onclick="closeDeploymentModal()" class="text-gray-600 hover:text-gray-900 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="p-6">
                <!-- Order Panels -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    
                    <!-- Future Order Panel -->
                    <div class="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
                        <h3 class="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                            Future Order
                        </h3>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Symbol</label>
                            <div class="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm">
                                ${data.future.symbol}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Transaction Type</label>
                            <div class="bg-${futureTransactionType === 'BUY' ? 'green' : 'red'}-100 border-2 border-${futureTransactionType === 'BUY' ? 'green' : 'red'}-300 rounded-lg px-3 py-2 font-bold text-${futureTransactionType === 'BUY' ? 'green' : 'red'}-700">
                                ${futureTransactionType}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Lots</label>
                            <input type="number" id="futureLots" value="1" min="1" 
                                   class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500">
                            <p class="text-xs text-gray-500 mt-1">Lot size will be auto-calculated</p>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Order Type</label>
                            <select id="futureOrderType" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500">
                                <option value="MARKET">MARKET</option>
                                <option value="LIMIT">LIMIT</option>
                                <option value="SL">SL</option>
                                <option value="SL-M">SL-M</option>
                            </select>
                        </div>
                        
                        <div id="futurePriceFields" class="hidden">
                            <div id="futureLimitPriceField" class="mb-3 hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Price</label>
                                <input type="number" id="futurePrice" step="0.05" placeholder="0.00"
                                       class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500">
                            </div>
                            <div id="futureTriggerPriceField" class="mb-3 hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Trigger Price</label>
                                <input type="number" id="futureTriggerPrice" step="0.05" placeholder="0.00"
                                       class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500">
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Product</label>
                            <select id="futureProduct" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500">
                                <option value="MIS">MIS</option>
                                <option value="NRML">NRML</option>
                                <option value="CNC">CNC</option>
                            </select>
                        </div>
                        
                        <!-- Add to Basket Button -->
                        <button onclick="addFutureToBasket('${strategyType}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                            Add Future to Basket
                        </button>
                    </div>
                    
                    <!-- Hedge Order Panel -->
                    <div class="border-2 border-${strategyColor}-200 rounded-xl p-4 bg-${strategyColor}-50">
                        <h3 class="text-lg font-bold text-${strategyColor}-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                            </svg>
                            Hedge Order (${strategyType === 'bullish' ? 'PUT' : 'CALL'})
                        </h3>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Symbol</label>
                            <div class="bg-white border-2 border-gray-300 rounded-lg px-3 py-2 font-mono text-sm">
                                ${data.hedge.symbol}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Transaction Type</label>
                            <div class="bg-green-100 border-2 border-green-300 rounded-lg px-3 py-2 font-bold text-green-700">
                                BUY
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Lots</label>
                            <input type="number" id="hedgeLots" value="1" min="1" 
                                   class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-${strategyColor}-500">
                            <p class="text-xs text-gray-500 mt-1">Lot size will be auto-calculated</p>
                        </div>
                        
                        <div class="mb-3">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Order Type</label>
                            <select id="hedgeOrderType" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-${strategyColor}-500">
                                <option value="MARKET">MARKET</option>
                                <option value="LIMIT">LIMIT</option>
                                <option value="SL">SL</option>
                                <option value="SL-M">SL-M</option>
                            </select>
                        </div>
                        
                        <div id="hedgePriceFields" class="hidden">
                            <div id="hedgeLimitPriceField" class="mb-3 hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Price</label>
                                <input type="number" id="hedgePrice" step="0.05" placeholder="0.00"
                                       class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-${strategyColor}-500">
                            </div>
                            <div id="hedgeTriggerPriceField" class="mb-3 hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Trigger Price</label>
                                <input type="number" id="hedgeTriggerPrice" step="0.05" placeholder="0.00"
                                       class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-${strategyColor}-500">
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Product</label>
                            <select id="hedgeProduct" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-${strategyColor}-500">
                                <option value="MIS">MIS</option>
                                <option value="NRML">NRML</option>
                                <option value="CNC">CNC</option>
                            </select>
                        </div>
                        
                        <!-- Add to Basket Button -->
                        <button onclick="addHedgeToBasket('${strategyType}')" class="w-full bg-${strategyColor}-600 hover:bg-${strategyColor}-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                            Add Hedge to Basket
                        </button>
                    </div>
                </div>
                
                <!-- Order Basket Display -->
                <div id="orderBasketDisplay" class="mb-6 hidden">
                    <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-lg font-bold text-orange-900 flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                                </svg>
                                Order Basket
                                <span id="basketCount" class="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">0</span>
                            </h3>
                            <button onclick="clearBasket()" class="text-red-600 hover:text-red-700 font-semibold text-sm flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                                Clear All
                            </button>
                        </div>
                        <div id="basketItems" class="space-y-2">
                            <!-- Basket items will be inserted here -->
                        </div>
                    </div>
                </div>
                
                <!-- Margin Check Result -->
                <div id="marginCheckResult" class="mb-6 hidden"></div>
                
                <!-- Action Buttons -->
                <div class="flex gap-4">
                    <button onclick="checkBasketMargin()" class="flex-1 border-2 border-blue-500 text-blue-600 font-semibold py-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Check Margin
                    </button>
                    <button onclick="deployBasket()" class="flex-1 bg-${strategyColor}-600 hover:bg-${strategyColor}-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        Deploy Orders
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setupOrderTypeDependencies('future');
    setupOrderTypeDependencies('hedge');
}

/**
 * Setup order type dependencies
 */
function setupOrderTypeDependencies(prefix) {
    const orderTypeSelect = document.getElementById(`${prefix}OrderType`);
    const priceFields = document.getElementById(`${prefix}PriceFields`);
    const limitPriceField = document.getElementById(`${prefix}LimitPriceField`);
    const triggerPriceField = document.getElementById(`${prefix}TriggerPriceField`);
    
    if (!orderTypeSelect) return;
    
    orderTypeSelect.addEventListener('change', (e) => {
        const orderType = e.target.value;
        
        if (orderType === 'MARKET') {
            priceFields.classList.add('hidden');
            limitPriceField.classList.add('hidden');
            triggerPriceField.classList.add('hidden');
        } else if (orderType === 'LIMIT') {
            priceFields.classList.remove('hidden');
            limitPriceField.classList.remove('hidden');
            triggerPriceField.classList.add('hidden');
        } else if (orderType === 'SL') {
            priceFields.classList.remove('hidden');
            limitPriceField.classList.remove('hidden');
            triggerPriceField.classList.remove('hidden');
        } else if (orderType === 'SL-M') {
            priceFields.classList.remove('hidden');
            limitPriceField.classList.add('hidden');
            triggerPriceField.classList.remove('hidden');
        }
    });
}

/**
 * Add future order to basket
 */
function addFutureToBasket(strategyType) {
    const data = selectedStrategyData[strategyType];
    const futureTransactionType = strategyType === 'bullish' ? 'BUY' : 'SELL';
    
    const order = {
        type: 'future',
        exchange: 'NFO',
        tradingsymbol: data.future.symbol,
        transaction_type: futureTransactionType,
        lots: parseInt(document.getElementById('futureLots').value),
        order_type: document.getElementById('futureOrderType').value,
        product: document.getElementById('futureProduct').value,
        variety: 'regular'
    };
    
    if (order.order_type === 'LIMIT' || order.order_type === 'SL') {
        const price = parseFloat(document.getElementById('futurePrice').value);
        if (price) order.price = price;
    }
    
    if (order.order_type === 'SL' || order.order_type === 'SL-M') {
        const triggerPrice = parseFloat(document.getElementById('futureTriggerPrice').value);
        if (triggerPrice) order.trigger_price = triggerPrice;
    }
    
    strategyBasket.push(order);
    updateBasketDisplay();
    
    console.log('Added to basket:', order);
}

/**
 * Add hedge order to basket
 */
function addHedgeToBasket(strategyType) {
    const data = selectedStrategyData[strategyType];
    
    const order = {
        type: 'hedge',
        exchange: 'NFO',
        tradingsymbol: data.hedge.symbol,
        transaction_type: 'BUY',
        lots: parseInt(document.getElementById('hedgeLots').value),
        order_type: document.getElementById('hedgeOrderType').value,
        product: document.getElementById('hedgeProduct').value,
        variety: 'regular'
    };
    
    if (order.order_type === 'LIMIT' || order.order_type === 'SL') {
        const price = parseFloat(document.getElementById('hedgePrice').value);
        if (price) order.price = price;
    }
    
    if (order.order_type === 'SL' || order.order_type === 'SL-M') {
        const triggerPrice = parseFloat(document.getElementById('hedgeTriggerPrice').value);
        if (triggerPrice) order.trigger_price = triggerPrice;
    }
    
    strategyBasket.push(order);
    updateBasketDisplay();
    
    console.log('Added to basket:', order);
}

/**
 * Update basket display
 */
function updateBasketDisplay() {
    const basketDisplay = document.getElementById('orderBasketDisplay');
    const basketItems = document.getElementById('basketItems');
    const basketCount = document.getElementById('basketCount');
    
    if (strategyBasket.length === 0) {
        basketDisplay.classList.add('hidden');
        return;
    }
    
    basketDisplay.classList.remove('hidden');
    basketCount.textContent = strategyBasket.length;
    
    basketItems.innerHTML = strategyBasket.map((order, index) => {
        const sideColor = order.transaction_type === 'BUY' ? 'green' : 'red';
        const typeColor = order.type === 'future' ? 'blue' : 'purple';
        
        let priceInfo = '';
        if (order.price) priceInfo += ` @ ₹${order.price.toFixed(2)}`;
        if (order.trigger_price) priceInfo += ` (Trigger: ₹${order.trigger_price.toFixed(2)})`;
        
        return `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-1 bg-${typeColor}-100 text-${typeColor}-700 text-xs font-bold rounded">
                        ${order.type.toUpperCase()}
                    </span>
                    <span class="font-mono text-sm font-semibold">${order.tradingsymbol}</span>
                    <span class="px-2 py-1 bg-${sideColor}-100 text-${sideColor}-700 text-xs font-bold rounded">
                        ${order.transaction_type}
                    </span>
                    <span class="text-sm text-gray-600">${order.lots} lots</span>
                    <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${order.order_type}</span>
                    <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${order.product}</span>
                    ${priceInfo ? `<span class="text-xs text-gray-600">${priceInfo}</span>` : ''}
                </div>
                <button onclick="removeFromBasket(${index})" class="text-red-600 hover:text-red-700 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Remove order from basket
 */
function removeFromBasket(index) {
    strategyBasket.splice(index, 1);
    updateBasketDisplay();
    
    // Clear margin result when basket changes
    const marginResult = document.getElementById('marginCheckResult');
    if (marginResult) {
        marginResult.classList.add('hidden');
    }
}

/**
 * Clear all orders from basket
 */
function clearBasket() {
    if (strategyBasket.length === 0) return;
    
    if (confirm('Clear all orders from basket?')) {
        strategyBasket = [];
        updateBasketDisplay();
        
        const marginResult = document.getElementById('marginCheckResult');
        if (marginResult) {
            marginResult.classList.add('hidden');
        }
    }
}

/**
 * Check margin for basket
 */
async function checkBasketMargin() {
    if (strategyBasket.length === 0) {
        alert('Basket is empty! Add orders first.');
        return;
    }
    
    const resultDiv = document.getElementById('marginCheckResult');
    resultDiv.innerHTML = '<div class="text-center py-4"><div class="inline-block w-6 h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div></div>';
    resultDiv.classList.remove('hidden');
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({ orders: strategyBasket })
        });
        
        const marginData = await response.json();
        
        if (marginData.success) {
            const sufficient = marginData.sufficient;
            const color = sufficient ? 'green' : 'red';
            
            resultDiv.innerHTML = `
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
            
            console.log('Margin Check:', marginData);
        } else {
            throw new Error(marginData.error);
        }
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p class="text-red-700">❌ Error checking margin: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Deploy basket orders - NO CONFIRMATION POPUP
 */
async function deployBasket() {
    if (strategyBasket.length === 0) {
        showDeploymentStatus('error', 'Basket is empty! Add orders first.');
        return;
    }
    
    // Show loading state
    const deployBtn = document.querySelector('button[onclick="deployBasket()"]');
    const originalHTML = deployBtn.innerHTML;
    deployBtn.disabled = true;
    deployBtn.innerHTML = `
        <div class="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Deploying...</span>
    `;
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/strategy/deploy-basket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({ orders: strategyBasket })
        });
        
        const result = await response.json();
        
        if (result.success) {
            let successCount = result.results.filter(r => r.success).length;
            let failCount = result.results.filter(r => !r.success).length;
            
            // Build success message
            let successHTML = `<h4 class="font-bold text-green-900 mb-3">✅ Deployment Complete!</h4>`;
            successHTML += `<div class="mb-3"><span class="text-green-700 font-semibold">Success: ${successCount} orders</span>`;
            if (failCount > 0) {
                successHTML += ` <span class="text-red-700 font-semibold">| Failed: ${failCount} orders</span>`;
            }
            successHTML += `</div><div class="space-y-2">`;
            
            result.results.forEach(r => {
                if (r.success) {
                    successHTML += `
                        <div class="flex items-center justify-between p-2 bg-green-100 rounded text-sm">
                            <span>✓ ${r.symbol}: ${r.lots} lots (${r.quantity} qty)</span>
                            <span class="font-mono text-xs text-green-700">ID: ${r.order_id}</span>
                        </div>
                    `;
                } else {
                    successHTML += `
                        <div class="p-2 bg-red-100 rounded text-sm text-red-700">
                            ✗ ${r.symbol}: ${r.error}
                        </div>
                    `;
                }
            });
            successHTML += `</div>`;
            
            showDeploymentStatus('success', successHTML);
            
            // Clear basket after successful deployment
            strategyBasket = [];
            updateBasketDisplay();
            
            // Re-enable deploy button so user can deploy more
            deployBtn.disabled = false;
            deployBtn.innerHTML = originalHTML;
            
            console.log('✅ Deployment completed:', result.results);
            
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        showDeploymentStatus('error', `Error deploying orders: ${error.message}`);
        
        // Re-enable button on error
        deployBtn.disabled = false;
        deployBtn.innerHTML = originalHTML;
        
        console.error('❌ Deployment error:', error);
    }
}

/**
 * Show deployment status inline (no popup)
 */
function showDeploymentStatus(type, message) {
    const marginResult = document.getElementById('marginCheckResult');
    
    if (type === 'success') {
        marginResult.innerHTML = `
            <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                ${message}
                <div class="flex gap-3 mt-4">
                    <button onclick="clearDeploymentStatus()" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        👍 Got It - Deploy More
                    </button>
                    <button onclick="closeDeploymentModal()" class="flex-1 border-2 border-green-600 text-green-600 hover:bg-green-50 font-semibold py-2 px-4 rounded-lg transition-colors">
                        ✕ Close Window
                    </button>
                </div>
            </div>
        `;
    } else if (type === 'error') {
        marginResult.innerHTML = `
            <div class="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p class="text-red-700 font-semibold mb-3">${message}</p>
                <button onclick="clearDeploymentStatus()" class="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    Try Again
                </button>
            </div>
        `;
    }
    
    marginResult.classList.remove('hidden');
    
    // Scroll to result
    marginResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Clear deployment status and allow new deployment
 */
function clearDeploymentStatus() {
    const marginResult = document.getElementById('marginCheckResult');
    if (marginResult) {
        marginResult.classList.add('hidden');
        marginResult.innerHTML = '';
    }
}

/**
 * Close deployment modal
 */
function closeDeploymentModal() {
    const modal = document.getElementById('deploymentModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => modal.remove(), 300);
    }
}

// Update setup function
function setupStrategiesListeners() {
    document.getElementById('executeBullishBtn')?.addEventListener('click', executeBullishStrategy);
    document.getElementById('executeBearishBtn')?.addEventListener('click', executeBearishStrategy);
    document.getElementById('deployBullishBtn')?.addEventListener('click', openBullishDeployment);
    document.getElementById('deployBearishBtn')?.addEventListener('click', openBearishDeployment);
}

// Make functions available globally
window.closeDeploymentModal = closeDeploymentModal;
window.addFutureToBasket = addFutureToBasket;
window.addHedgeToBasket = addHedgeToBasket;
window.removeFromBasket = removeFromBasket;
window.clearBasket = clearBasket;
window.checkBasketMargin = checkBasketMargin;
window.deployBasket = deployBasket;
window.showDeploymentStatus = showDeploymentStatus;
window.clearDeploymentStatus = clearDeploymentStatus;

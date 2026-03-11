// Basket Manager Module
// Reusable basket management for all strategies

const BASKET_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// Global basket state
let basketState = {
    orders: [],
    marginRequired: 0,
    availableBalance: 0,
    deploymentResults: [],
    isDeploying: false
};

// Store modal orders for trail config access after deploy
let _modalOrders = [];

// ===========================================
// BASKET MANAGEMENT
// ===========================================

function addOrderToBasket(order) {
    console.log('Adding order to basket:', order);
    
    if (!order.tradingsymbol || !order.transaction_type || !order.lots) {
        console.error('Invalid order:', order);
        return false;
    }
    
    const existingIndex = basketState.orders.findIndex(
        o => o.tradingsymbol === order.tradingsymbol && o.transaction_type === order.transaction_type
    );
    
    if (existingIndex >= 0) {
        basketState.orders[existingIndex] = order;
        console.log('Updated existing order in basket');
    } else {
        basketState.orders.push(order);
        console.log('Added new order to basket');
    }
    
    return true;
}

function removeOrderFromBasket(tradingsymbol, transactionType) {
    const initialLength = basketState.orders.length;
    basketState.orders = basketState.orders.filter(
        o => !(o.tradingsymbol === tradingsymbol && o.transaction_type === transactionType)
    );
    const removed = basketState.orders.length < initialLength;
    if (removed) console.log('Removed order from basket:', tradingsymbol, transactionType);
    return removed;
}

function clearBasket() {
    basketState.orders = [];
    basketState.marginRequired = 0;
    basketState.deploymentResults = [];
    console.log('Basket cleared');
}

function getBasketOrders() { return [...basketState.orders]; }
function getBasketCount() { return basketState.orders.length; }

// ===========================================
// DEPLOY MODAL
// ===========================================

function showDeployModal(orders, strategyName) {
    _modalOrders = orders; // store for post-deploy use
    const modal = document.getElementById('deployModal') || createDeployModal();
    const content = document.getElementById('deployModalContent');

    let html = `
        <div class="p-6 border-b-2 border-gray-200">
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold text-gray-900">${strategyName || 'Deploy Strategy'}</h2>
                <button onclick="closeDeployModal()" class="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
        </div>
        <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    `;

    orders.forEach((order, index) => {
        const bgColor = order.transaction_type === 'BUY' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        const badgeColor = order.transaction_type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        const ltp = order.last_price || null;

        html += `
            <div class="border-2 ${bgColor} rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-bold text-gray-900">${order.label || order.symbol}</h4>
                    <span id="txnBadge_${index}" class="px-2 py-1 ${badgeColor} text-xs font-semibold rounded">${order.transaction_type}</span>
                </div>

                <div class="space-y-3 text-sm">
                    <!-- Symbol -->
                    <div>
                        <label class="block text-gray-600 mb-1">Symbol</label>
                        <div class="font-mono font-semibold text-gray-900">${order.symbol}</div>
                        <input type="hidden" id="symbol_${index}" value="${order.symbol}" />
                        <input type="hidden" id="token_${index}" value="${order.token || ''}" />
                        <input type="hidden" id="ltp_${index}" value="${ltp || ''}" />
                    </div>

                    <!-- Transaction Type DROPDOWN (change 1) -->
                    <div>
                        <label class="block text-gray-600 mb-1">Transaction Type</label>
                        <select id="txnType_${index}"
                                onchange="onTxnTypeChange(${index})"
                                class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-semibold">
                            <option value="BUY" ${order.transaction_type === 'BUY' ? 'selected' : ''}>BUY</option>
                            <option value="SELL" ${order.transaction_type === 'SELL' ? 'selected' : ''}>SELL</option>
                        </select>
                    </div>

                    <!-- Lots -->
                    <div>
                        <label class="block text-gray-600 mb-1">Lots</label>
                        <input type="number"
                               id="lots_${index}"
                               value="${order.lots}"
                               min="1"
                               data-symbol="${order.symbol}"
                               class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                        <p class="text-xs text-gray-500 mt-1">Lot size will be auto-calculated</p>
                    </div>

                    <!-- Order Type (change 2: MARKET default, LIMIT shows LTP price box) -->
                    <div>
                        <label class="block text-gray-600 mb-1">Order Type</label>
                        <select id="orderType_${index}"
                                onchange="onOrderTypeChange(${index})"
                                class="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                            <option value="MARKET" selected>MARKET</option>
                            <option value="LIMIT">LIMIT</option>
                        </select>
                    </div>

                    <!-- LIMIT price box (hidden until LIMIT selected) -->
                    <div id="limitPriceBox_${index}" class="hidden">
                        <label class="block text-gray-600 mb-1">
                            Limit Price
                            <span class="text-xs text-gray-400 ml-1">(LTP pre-filled)</span>
                        </label>
                        <div class="flex gap-2">
                            <input type="number"
                                   id="limitPrice_${index}"
                                   value="${ltp || ''}"
                                   step="0.05"
                                   class="flex-1 px-3 py-2 border-2 border-blue-300 rounded text-sm font-semibold" />
                            <button onclick="refetchLTP(${index})"
                                    class="px-3 py-2 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 whitespace-nowrap">
                                ↻ LTP
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Edit price or click ↻ LTP to refresh</p>
                    </div>

                    <!-- Product -->
                    <div>
                        <label class="block text-gray-600 mb-1">Product</label>
                        <select id="product_${index}"
                                class="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                            <option value="MIS" selected>MIS</option>
                            <option value="NRML">NRML</option>
                            <option value="CNC">CNC</option>
                        </select>
                    </div>

                    <!-- ===== TRAIL CONFIG SECTION (change 3 & 5) ===== -->
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div class="flex items-center justify-between mb-2">
                            <label class="text-sm font-semibold text-gray-700">Trailing Stop Loss</label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox"
                                       id="trailEnabled_${index}"
                                       onchange="onTrailToggle(${index})"
                                       class="w-4 h-4 accent-orange-500" />
                                <span class="text-xs text-gray-600">Enable after deploy</span>
                            </label>
                        </div>

                        <div id="trailConfig_${index}" class="hidden space-y-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <!-- Trail Mode — explicit toggle buttons, default AUTO -->
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Trail Mode</label>
                                <div class="flex gap-2">
                                    <button type="button"
                                            id="trailBtnManual_${index}"
                                            onclick="selectTrailMode(${index},'manual')"
                                            class="flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-gray-300 bg-white text-gray-400">
                                        🎯 Manual
                                    </button>
                                    <button type="button"
                                            id="trailBtnAuto_${index}"
                                            onclick="selectTrailMode(${index},'auto')"
                                            class="flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-orange-500 bg-orange-500 text-white shadow-md">
                                        🤖 Auto Trail ✓
                                    </button>
                                </div>
                                <input type="hidden" id="trailModeValue_${index}" value="auto" />
                                <p class="text-xs mt-1" id="trailModeDesc_${index}">
                                    <span class="text-orange-600 font-semibold">🤖 Auto Trail active</span> — SL moves automatically via WebSocket as price moves in your favor
                                </p>
                            </div>

                            <!-- Trail Points -->
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Trail Points</label>
                                <input type="number"
                                       id="trailPoints_${index}"
                                       value="10"
                                       step="0.5"
                                       min="0.5"
                                       class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                                <p class="text-xs text-gray-500 mt-1">Initial distance from entry to place SL</p>
                            </div>

                            <!-- Trail Step % -->
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Trail Step (%)</label>
                                <input type="number"
                                       id="trailStep_${index}"
                                       value="50"
                                       min="10"
                                       max="200"
                                       step="5"
                                       class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                                <p class="text-xs text-gray-500 mt-1">How much price must move to trail SL. Lower = tighter.</p>
                            </div>

                            <!-- Limit Buffer % -->
                            <div>
                                <label class="block text-xs font-semibold text-gray-700 mb-1">Limit Price Buffer (%)</label>
                                <input type="number"
                                       id="trailBuffer_${index}"
                                       value="0.5"
                                       min="0.2"
                                       max="5"
                                       step="0.1"
                                       class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                                <p class="text-xs text-gray-500 mt-1">Distance from trigger to limit price. 0.5%–2% for F&O.</p>
                            </div>
                        </div>
                    </div>
                    <!-- ===== END TRAIL CONFIG ===== -->

                </div>

                <!-- Add to Basket button per leg -->
                <div class="mt-4">
                    <button onclick="addSingleToBasketFromModal(${index})"
                            class="${order.transaction_type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold py-2 rounded-lg w-full transition-all text-sm"
                            id="addBtn_${index}">
                        + Add ${order.label || order.symbol} to Basket
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="flex gap-3 mt-2">
                <button onclick="addAllToBasketFromModal()"
                        class="flex-1 btn-primary text-white font-semibold py-3 rounded-lg">
                    + Add All to Basket
                </button>
                <button onclick="closeDeployModal()"
                        class="flex-1 border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
            </div>
        </div>
    `;

    content.innerHTML = html;
    modal.classList.add('show');

    // Initialise trail mode buttons to AUTO (default)
    orders.forEach((_, index) => {
        selectTrailMode(index, 'auto');
    });
}

// Trail mode toggle — called from onclick on the two buttons
function selectTrailMode(index, mode) {
    const manualBtn = document.getElementById(`trailBtnManual_${index}`);
    const autoBtn = document.getElementById(`trailBtnAuto_${index}`);
    const hiddenVal = document.getElementById(`trailModeValue_${index}`);
    const descEl = document.getElementById(`trailModeDesc_${index}`);
    if (!manualBtn || !autoBtn || !hiddenVal) return;

    if (mode === 'auto') {
        // Auto = highlighted orange, Manual = dim grey
        autoBtn.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-orange-500 bg-orange-500 text-white shadow-md';
        manualBtn.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-gray-300 bg-white text-gray-400';
        hiddenVal.value = 'auto';
        if (descEl) descEl.innerHTML = '<span class="text-orange-600 font-semibold">🤖 Auto Trail active</span> — SL moves automatically via WebSocket as price moves in your favor';
    } else {
        // Manual = highlighted green, Auto = dim grey
        manualBtn.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-green-600 bg-green-600 text-white shadow-md';
        autoBtn.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold transition-all border-gray-300 bg-white text-gray-400';
        hiddenVal.value = 'manual';
        if (descEl) descEl.innerHTML = '<span class="text-green-700 font-semibold">🎯 Manual Trail active</span> — SL order placed at entry, use +/- buttons in Manage Positions to adjust';
    }
}
window.selectTrailMode = selectTrailMode;

// Handle transaction type dropdown change — update badge color
function onTxnTypeChange(index) {
    const txnType = document.getElementById(`txnType_${index}`).value;
    const badge = document.getElementById(`txnBadge_${index}`);
    const addBtn = document.getElementById(`addBtn_${index}`);
    if (badge) {
        badge.className = txnType === 'BUY'
            ? 'px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded'
            : 'px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded';
        badge.textContent = txnType;
    }
    if (addBtn) {
        addBtn.className = `${txnType === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold py-2 rounded-lg w-full transition-all text-sm`;
    }
}

// Handle order type change — show/hide LIMIT price box and pre-fill LTP
function onOrderTypeChange(index) {
    const orderType = document.getElementById(`orderType_${index}`).value;
    const limitBox = document.getElementById(`limitPriceBox_${index}`);
    if (!limitBox) return;

    if (orderType === 'LIMIT') {
        limitBox.classList.remove('hidden');
        // Pre-fill with stored LTP if available
        const storedLtp = document.getElementById(`ltp_${index}`)?.value;
        const limitInput = document.getElementById(`limitPrice_${index}`);
        if (limitInput && storedLtp && !limitInput.value) {
            limitInput.value = storedLtp;
        }
        // If no LTP stored, auto-fetch
        if (!storedLtp) {
            refetchLTP(index);
        }
    } else {
        limitBox.classList.add('hidden');
    }
}

// Fetch LTP from backend for a specific order index
async function refetchLTP(index) {
    const symbol = document.getElementById(`symbol_${index}`)?.value;
    const limitInput = document.getElementById(`limitPrice_${index}`);
    if (!symbol || !limitInput) return;

    limitInput.value = '...';
    limitInput.disabled = true;

    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/get-ltp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ exchange: 'NFO', tradingsymbol: symbol })
        });
        const data = await response.json();
        if (data.success && data.last_price) {
            limitInput.value = data.last_price;
            const ltpHidden = document.getElementById(`ltp_${index}`);
            if (ltpHidden) ltpHidden.value = data.last_price;
        } else {
            limitInput.value = '';
            showToast('Could not fetch LTP for ' + symbol, 'error');
        }
    } catch (e) {
        limitInput.value = '';
        showToast('LTP fetch error: ' + e.message, 'error');
    } finally {
        limitInput.disabled = false;
    }
}

// Toggle trail config section visibility
function onTrailToggle(index) {
    const enabled = document.getElementById(`trailEnabled_${index}`)?.checked;
    const configDiv = document.getElementById(`trailConfig_${index}`);
    if (!configDiv) return;
    if (enabled) {
        configDiv.classList.remove('hidden');
    } else {
        configDiv.classList.add('hidden');
    }
}

function createDeployModal() {
    const modal = document.createElement('div');
    modal.id = 'deployModal';
    modal.className = 'modal';
    modal.innerHTML = `<div id="deployModalContent" class="modal-content"></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeDeployModal();
    });
    return modal;
}

function closeDeployModal() {
    const modal = document.getElementById('deployModal');
    if (modal) modal.classList.remove('show');
}

// Read trail config for a given index from modal
function _readTrailConfig(index) {
    const enabled = document.getElementById(`trailEnabled_${index}`)?.checked;
    if (!enabled) return null;

    const modeHidden = document.getElementById(`trailModeValue_${index}`);
    const mode = (modeHidden && modeHidden.value === 'manual') ? 'manual' : 'auto';
    const trailPoints = parseFloat(document.getElementById(`trailPoints_${index}`)?.value || '10');
    const trailStep = parseFloat(document.getElementById(`trailStep_${index}`)?.value || '50');
    const trailBuffer = parseFloat(document.getElementById(`trailBuffer_${index}`)?.value || '0.5');

    return { mode, trailPoints, trailStep, trailBuffer };
}

// Build an order object from modal for a given index
function _buildOrderFromModal(index) {
    const symbol = document.getElementById(`symbol_${index}`)?.value;
    const txnType = document.getElementById(`txnType_${index}`)?.value;
    const lots = parseInt(document.getElementById(`lots_${index}`)?.value || '1');
    const orderType = document.getElementById(`orderType_${index}`)?.value;
    const product = document.getElementById(`product_${index}`)?.value;
    const trailConfig = _readTrailConfig(index);

    if (!symbol) return null;

    const order = {
        exchange: 'NFO',
        tradingsymbol: symbol,
        transaction_type: txnType,
        lots: lots,
        product: product,
        order_type: orderType,
        variety: 'regular',
        _trailConfig: trailConfig,
        _index: index
    };

    if (orderType === 'LIMIT') {
        const limitPrice = parseFloat(document.getElementById(`limitPrice_${index}`)?.value || '0');
        if (limitPrice > 0) order.price = limitPrice;
    }

    return order;
}

function addSingleToBasketFromModal(orderIndex) {
    const order = _buildOrderFromModal(orderIndex);
    if (!order) { showToast('Error reading order details', 'error'); return; }

    addOrderToBasket(order);
    updateBasketCountDisplay();
    showToast(`${order.tradingsymbol} (${order.transaction_type}) added to basket`, 'success');
}

function addAllToBasketFromModal() {
    let count = 0;
    _modalOrders.forEach((_, index) => {
        const order = _buildOrderFromModal(index);
        if (order) { addOrderToBasket(order); count++; }
    });
    updateBasketCountDisplay();
    closeDeployModal();
    showToast(`${count} order(s) added to basket`, 'success');
}

// Legacy compat
function addToBasketFromModal(orders) {
    addAllToBasketFromModal();
}

// ===========================================
// TOAST NOTIFICATION
// ===========================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50`;
    const bgColors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    toast.classList.add(bgColors[type] || bgColors.info);
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===========================================
// MARGIN CHECKING
// ===========================================

async function checkBasketMargin(onSuccess, onError) {
    if (basketState.orders.length === 0) {
        if (onError) onError('No orders in basket');
        return null;
    }
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders: basketState.orders })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            basketState.marginRequired = data.total_required;
            basketState.availableBalance = data.available_balance;
            const marginInfo = {
                available: data.available_balance,
                required: data.total_required,
                sufficient: data.sufficient,
                details: data.margin_details
            };
            if (onSuccess) onSuccess(marginInfo);
            return marginInfo;
        } else {
            throw new Error(data.error || 'Failed to check margin');
        }
    } catch (error) {
        console.error('Margin check error:', error);
        if (onError) onError(error.message);
        return null;
    }
}

// ===========================================
// ORDER DEPLOYMENT  (change 4: post-deploy trail start)
// ===========================================

async function deployBasket(onProgress, onComplete, onError) {
    if (basketState.orders.length === 0) {
        if (onError) onError('No orders in basket');
        return null;
    }
    if (basketState.isDeploying) {
        if (onError) onError('Deployment already in progress');
        return null;
    }

    basketState.isDeploying = true;
    basketState.deploymentResults = [];

    try {
        const userId = sessionStorage.getItem('user_id');
        if (onProgress) onProgress('Deploying orders...', 0);

        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/deploy-basket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders: basketState.orders })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            basketState.deploymentResults = data.results;

            const summary = {
                total: data.total_orders,
                successful: data.successful,
                failed: data.failed,
                results: data.results
            };

            // Start trail for successfully deployed orders that have trail config
            const ordersWithTrail = basketState.orders.filter(o => o._trailConfig);
            let trailResults = { autoStarted: [], manualStarted: [] };
            if (ordersWithTrail.length > 0 && data.results) {
                if (onProgress) onProgress('Starting trailing stop loss...', 80);
                trailResults = await _startTrailForDeployedOrders(userId, basketState.orders, data.results);
            }

            // Attach trail info to summary for the caller (index.html) to render
            summary.trailResults = trailResults;

            if (onComplete) onComplete(summary);

            clearBasket();
            return summary;
        } else {
            throw new Error(data.error || 'Failed to deploy orders');
        }
    } catch (error) {
        console.error('Deployment error:', error);
        if (onError) onError(error.message);
        return null;
    } finally {
        basketState.isDeploying = false;
    }
}

// Start trailing for each order that was successfully deployed and has trail config.
// Returns { autoStarted: [{positionKey, trigger, limit}], manualStarted: [{symbol, trigger}] }
async function _startTrailForDeployedOrders(userId, orders, results) {
    const autoStarted = [];
    const manualStarted = [];

    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const trailConfig = order._trailConfig;
        if (!trailConfig) continue;

        // Find matching result (by symbol)
        const result = results.find(r => r.symbol === order.tradingsymbol && r.success);
        if (!result) {
            console.warn(`Trail skipped for ${order.tradingsymbol} — order was not successful`);
            showToast(`Trail skipped for ${order.tradingsymbol} (order failed)`, 'error');
            continue;
        }

        // For MARKET orders the average_price may still be 0 just after placement.
        // Fetch it from order history if needed.
        let avgPrice = result.average_price || 0;
        if (!avgPrice || avgPrice === 0) {
            try {
                const ltpRes = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/get-ltp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify({ exchange: order.exchange, tradingsymbol: order.tradingsymbol })
                });
                const ltpData = await ltpRes.json();
                if (ltpData.success) avgPrice = ltpData.last_price;
                console.log(`Using LTP as avg_price for ${order.tradingsymbol}: ${avgPrice}`);
            } catch(e) {
                console.warn(`Could not fetch LTP fallback for ${order.tradingsymbol}`);
            }
        }

        const quantity = result.quantity || order.lots;
        const isLong = order.transaction_type === 'BUY';

        const payload = {
            exchange: order.exchange,
            tradingsymbol: order.tradingsymbol,
            quantity: isLong ? Math.abs(quantity) : -Math.abs(quantity),
            average_price: avgPrice,
            product: order.product,
            trail_points: trailConfig.trailPoints,
            buffer_percent: trailConfig.trailBuffer / 100,
            trail_step_percent: trailConfig.trailStep
        };

        try {
            if (trailConfig.mode === 'auto') {
                const res = await fetch(`${BASKET_CONFIG.backendUrl}/api/start-auto-trail`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify(payload)
                });
                const d = await res.json();
                if (d.success) {
                    showToast(`🤖 Auto trail started: ${order.tradingsymbol}`, 'success');
                    autoStarted.push({
                        positionKey: d.position_key,
                        trigger: d.trigger_price,
                        limit: d.limit_price,
                        symbol: order.tradingsymbol
                    });
                } else {
                    showToast(`Auto trail failed for ${order.tradingsymbol}: ${d.error}`, 'error');
                }
            } else {
                // Manual trail: place the SL order
                const bufferDecimal = trailConfig.trailBuffer / 100;
                let triggerPrice = isLong
                    ? avgPrice - trailConfig.trailPoints
                    : avgPrice + trailConfig.trailPoints;
                triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;

                let limitPrice = isLong
                    ? triggerPrice * (1 - bufferDecimal)
                    : triggerPrice * (1 + bufferDecimal);
                limitPrice = Math.round(limitPrice / 0.05) * 0.05;

                const txnType = isLong ? 'SELL' : 'BUY';
                const res = await fetch(`${BASKET_CONFIG.backendUrl}/api/place-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify({
                        exchange: order.exchange,
                        tradingsymbol: order.tradingsymbol,
                        transaction_type: txnType,
                        quantity: Math.abs(quantity),
                        product: order.product,
                        order_type: 'SL',
                        trigger_price: triggerPrice,
                        price: limitPrice,
                        variety: 'regular'
                    })
                });
                const d = await res.json();
                if (d.success) {
                    showToast(`🎯 Manual SL placed: ${order.tradingsymbol} @ ₹${triggerPrice}`, 'success');
                    manualStarted.push({ symbol: order.tradingsymbol, orderId: d.order_id, triggerPrice, limitPrice });
                } else {
                    showToast(`Manual SL failed for ${order.tradingsymbol}: ${d.error}`, 'error');
                }
            }
        } catch (e) {
            showToast(`Trail error for ${order.tradingsymbol}: ${e.message}`, 'error');
        }
    }

    return { autoStarted, manualStarted };
}

// ===========================================
// ORDER STATUS
// ===========================================

async function getOrderStatus(orderId, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/order-status/${orderId}`, {
            headers: { 'X-User-ID': userId }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data);
            return data;
        } else {
            throw new Error(data.error || 'Failed to get order status');
        }
    } catch (error) {
        if (onError) onError(error.message);
        return null;
    }
}

async function getBatchOrderStatus(orderIds, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/orders-status/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ order_ids: orderIds })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data.results);
            return data.results;
        } else {
            throw new Error(data.error || 'Failed to get batch order status');
        }
    } catch (error) {
        if (onError) onError(error.message);
        return null;
    }
}

// ===========================================
// UI HELPERS
// ===========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(amount);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

function getStatusBadgeClass(status) {
    const statusMap = {
        'COMPLETE': 'bg-green-100 text-green-800 border-green-300',
        'REJECTED': 'bg-red-100 text-red-800 border-red-300',
        'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-300',
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        'OPEN': 'bg-blue-100 text-blue-800 border-blue-300',
        'TRIGGER PENDING': 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
}

function getStatusIcon(status) {
    const iconMap = {
        'COMPLETE': '✓', 'REJECTED': '✗', 'CANCELLED': '⊘',
        'PENDING': '⏱', 'OPEN': '◷', 'TRIGGER PENDING': '⚡'
    };
    return iconMap[status] || '•';
}

// Expose globally for onclick handlers in index.html
window.onTxnTypeChange = onTxnTypeChange;
window.onOrderTypeChange = onOrderTypeChange;
window.onTrailToggle = onTrailToggle;
window.refetchLTP = refetchLTP;
window.addSingleToBasketFromModal = addSingleToBasketFromModal;
window.addAllToBasketFromModal = addAllToBasketFromModal;
window.addToBasketFromModal = addToBasketFromModal;
window.closeDeployModal = closeDeployModal;

// Export module API
window.BasketManager = {
    addOrder: addOrderToBasket,
    removeOrder: removeOrderFromBasket,
    clearBasket: clearBasket,
    getOrders: getBasketOrders,
    getCount: getBasketCount,
    checkMargin: checkBasketMargin,
    deploy: deployBasket,
    getOrderStatus: getOrderStatus,
    getBatchOrderStatus: getBatchOrderStatus,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    getStatusBadgeClass: getStatusBadgeClass,
    getStatusIcon: getStatusIcon,
    showDeployModal: showDeployModal,
    showToast: showToast,
    state: basketState
};

console.log('Basket Manager initialized');

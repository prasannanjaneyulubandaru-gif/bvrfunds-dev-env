// =========================================================
// PLACE ORDERS PAGE MODULE
// Handles order basket, margin checks, and order placement
// Requires: shared_config.js
// =========================================================

/**
 * Initialize Place Orders page
 */
function initPlaceOrders() {
    console.log('Initializing Place Orders page...');
    setupPlaceOrdersListeners();
}

/**
 * Setup event listeners for Place Orders page
 */
function setupPlaceOrdersListeners() {
    // Buy/Sell buttons
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    let selectedSide = 'BUY';
    
    if (buyBtn && sellBtn) {
        buyBtn.addEventListener('click', () => {
            selectedSide = 'BUY';
            buyBtn.classList.add('bg-green-500', 'text-white');
            buyBtn.classList.remove('bg-white', 'text-gray-700');
            sellBtn.classList.remove('bg-red-500', 'text-white');
            sellBtn.classList.add('bg-white', 'text-gray-700');
        });
        
        sellBtn.addEventListener('click', () => {
            selectedSide = 'SELL';
            sellBtn.classList.add('bg-red-500', 'text-white');
            sellBtn.classList.remove('bg-white', 'text-gray-700');
            buyBtn.classList.remove('bg-green-500', 'text-white');
            buyBtn.classList.add('bg-white', 'text-gray-700');
        });
        
        // Store selectedSide in a way that's accessible
        buyBtn.dataset.selectedSide = 'BUY';
        sellBtn.dataset.selectedSide = 'SELL';
    }
    
    setupSymbolAutocomplete();
    
    // Order type change - show/hide price fields
    const orderTypeSelect = document.getElementById('orderType');
    if (orderTypeSelect) {
        orderTypeSelect.addEventListener('change', (e) => {
            const orderType = e.target.value;
            const priceFields = document.getElementById('priceFields');
            const limitPriceField = document.getElementById('limitPriceField');
            const triggerPriceField = document.getElementById('triggerPriceField');
            
            if (orderType === 'MARKET') {
                priceFields?.classList.add('hidden');
                limitPriceField?.classList.add('hidden');
                triggerPriceField?.classList.add('hidden');
            } else if (orderType === 'LIMIT') {
                priceFields?.classList.remove('hidden');
                limitPriceField?.classList.remove('hidden');
                triggerPriceField?.classList.add('hidden');
            } else if (orderType === 'SL') {
                priceFields?.classList.remove('hidden');
                limitPriceField?.classList.remove('hidden');
                triggerPriceField?.classList.remove('hidden');
            } else if (orderType === 'SL-M') {
                priceFields?.classList.remove('hidden');
                limitPriceField?.classList.add('hidden');
                triggerPriceField?.classList.remove('hidden');
            }
        });
    }
    
    // Add to basket
    const addOrderBtn = document.getElementById('addOrderBtn');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', addOrderToBasket);
    }
    
    // Clear basket
    const clearBasketBtn = document.getElementById('clearBasketBtn');
    if (clearBasketBtn) {
        clearBasketBtn.addEventListener('click', () => {
            state.orderBasket = [];
            state.placedOrders = [];
            displayOrderBasket();
            const statusOutput = document.getElementById('orderStatusOutput');
            const summaryOutput = document.getElementById('orderSummaryOutput');
            if (statusOutput) statusOutput.innerHTML = '';
            if (summaryOutput) summaryOutput.innerHTML = '';
        });
    }
    
    // Check margin
    const checkMarginBtn = document.getElementById('checkMarginBtn');
    if (checkMarginBtn) {
        checkMarginBtn.addEventListener('click', checkBasketMargin);
    }
    
    // Place all orders
    const placeAllOrdersBtn = document.getElementById('placeAllOrdersBtn');
    if (placeAllOrdersBtn) {
        placeAllOrdersBtn.addEventListener('click', placeAllOrders);
    }
    
    // Refresh order status
    const refreshOrderStatusBtn = document.getElementById('refreshOrderStatusBtn');
    if (refreshOrderStatusBtn) {
        refreshOrderStatusBtn.addEventListener('click', refreshOrderStatus);
    }
}

/**
 * Get selected transaction type (BUY/SELL)
 */
function getSelectedSide() {
    const buyBtn = document.getElementById('buyBtn');
    if (buyBtn && buyBtn.classList.contains('bg-green-500')) {
        return 'BUY';
    }
    return 'SELL';
}

/**
 * Add order to basket
 */
function addOrderToBasket() {
    const order = {
        tradingsymbol: document.getElementById('orderSymbol')?.value.trim().toUpperCase() || '',
        exchange: document.getElementById('orderExchange')?.value || 'NSE',
        quantity: parseInt(document.getElementById('orderQuantity')?.value || 0),
        transaction_type: getSelectedSide(),
        order_type: document.getElementById('orderType')?.value || 'MARKET',
        product: document.getElementById('orderProduct')?.value || 'MIS',
        variety: 'regular'
    };
    
    if (!order.tradingsymbol) {
        alert('Please enter a trading symbol');
        return;
    }
    
    if (order.order_type === 'LIMIT' || order.order_type === 'SL') {
        const priceInput = document.getElementById('orderPrice');
        const price = parseFloat(priceInput?.value || 0);
        if (price) order.price = price;
    }
    
    if (order.order_type === 'SL' || order.order_type === 'SL-M') {
        const triggerPriceInput = document.getElementById('orderTriggerPrice');
        const triggerPrice = parseFloat(triggerPriceInput?.value || 0);
        if (triggerPrice) order.trigger_price = triggerPrice;
    }
    
    state.orderBasket.push(order);
    displayOrderBasket();
    
    // Clear symbol input
    const symbolInput = document.getElementById('orderSymbol');
    if (symbolInput) symbolInput.value = '';
}

/**
 * Display order basket
 */
function displayOrderBasket() {
    const basketDiv = document.getElementById('orderBasket');
    
    if (!basketDiv) return;
    
    if (state.orderBasket.length === 0) {
        basketDiv.innerHTML = '<div class="text-center text-gray-500 py-8">No orders in basket</div>';
        return;
    }
    
    basketDiv.innerHTML = '';
    
    state.orderBasket.forEach((order, index) => {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-basket-item';
        
        const sideClass = order.transaction_type === 'BUY' ? 'badge-buy' : 'badge-sell';
        
        let priceInfo = '';
        if (order.price) priceInfo += ` @ ₹${order.price.toFixed(2)}`;
        if (order.trigger_price) priceInfo += ` (Trigger: ₹${order.trigger_price.toFixed(2)})`;
        
        orderDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="badge badge-info">${order.exchange}</span>
                    <span class="font-semibold mono">${order.tradingsymbol}</span>
                    <span class="badge ${sideClass}">${order.transaction_type}</span>
                    <span class="badge badge-info">${order.quantity}</span>
                    <span class="badge badge-info">${order.order_type}</span>
                    <span class="badge badge-info">${order.product}</span>
                    ${priceInfo ? `<span class="text-sm text-gray-600">${priceInfo}</span>` : ''}
                </div>
                <button onclick="removeFromBasket(${index})" class="text-red-600 hover:text-red-700 font-semibold">
                    Remove
                </button>
            </div>
        `;
        
        basketDiv.appendChild(orderDiv);
    });
}

/**
 * Remove order from basket
 */
function removeFromBasket(index) {
    state.orderBasket.splice(index, 1);
    displayOrderBasket();
}

/**
 * Check basket margin requirements
 */
async function checkBasketMargin() {
    if (state.orderBasket.length === 0) {
        alert('No orders in basket');
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/basket-margin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({ orders: state.orderBasket })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const statusDiv = document.getElementById('orderStatusOutput');
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <h3 class="font-bold text-gray-900 mb-2">Margin Check</h3>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between">
                                <span>Available Balance:</span>
                                <span class="font-semibold">₹${data.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Required Margin:</span>
                                <span class="font-semibold">₹${data.total_required.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="flex justify-between pt-2 border-t">
                                <span>Status:</span>
                                <span class="font-bold ${data.sufficient ? 'text-green-600' : 'text-red-600'}">
                                    ${data.sufficient ? '✅ Sufficient Funds' : '⚠️ Insufficient Funds'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            alert('Error checking margin: ' + data.error);
        }
    } catch (error) {
        alert('Error checking margin: ' + error.message);
    }
}

/**
 * Place all orders in basket
 */
async function placeAllOrders() {
    if (state.orderBasket.length === 0) {
        alert('No orders in basket');
        return;
    }
    
    const statusDiv = document.getElementById('orderStatusOutput');
    if (statusDiv) {
        statusDiv.innerHTML = '<div class="p-4 bg-blue-50 rounded-lg">🚀 Placing orders...</div>';
    }
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/place-basket-orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({ orders: state.orderBasket })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.placedOrders = data.results;
            displayOrderResults(data.results);
            
            // Wait then refresh status
            setTimeout(refreshOrderStatus, 2000);
        } else {
            alert('Error placing orders: ' + data.error);
        }
    } catch (error) {
        alert('Error placing orders: ' + error.message);
    }
}

/**
 * Display order placement results
 */
function displayOrderResults(results) {
    const statusDiv = document.getElementById('orderStatusOutput');
    if (!statusDiv) return;
    
    let html = '<div class="space-y-2">';
    
    results.forEach(result => {
        if (result.success) {
            html += `
                <div class="p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="flex items-center gap-2">
                        <span class="text-green-600">✅</span>
                        <span class="font-semibold">${result.symbol}</span>
                        <span class="text-sm text-gray-600">Order ID: ${result.order_id}</span>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div class="flex items-center gap-2">
                        <span class="text-red-600">❌</span>
                        <span class="font-semibold">${result.symbol}</span>
                        <span class="text-sm text-gray-600">${result.error}</span>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    statusDiv.innerHTML = html;
}

/**
 * Refresh order status
 */
async function refreshOrderStatus() {
    if (state.placedOrders.length === 0) {
        return;
    }
    
    const orderIds = state.placedOrders.filter(o => o.order_id).map(o => o.order_id);
    
    if (orderIds.length === 0) return;
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/order-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({ order_ids: orderIds })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayOrderStatus(data.statuses);
            generateExecutionSummary(data.statuses);
        }
    } catch (error) {
        console.error('Error refreshing status:', error);
    }
}

/**
 * Display order status
 */
function displayOrderStatus(statuses) {
    const statusDiv = document.getElementById('orderStatusOutput');
    if (!statusDiv) return;
    
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
    statusDiv.innerHTML = html;
}

/**
 * Generate execution summary
 */
function generateExecutionSummary(statuses) {
    const summaryDiv = document.getElementById('orderSummaryOutput');
    if (!summaryDiv) return;
    
    // Group by symbol
    const symbolData = {};
    
    statuses.forEach(status => {
        if (status.error) return;
        
        const symbol = status.tradingsymbol;
        if (!symbolData[symbol]) {
            symbolData[symbol] = {
                filled_qty: 0,
                total_amount: 0,
                orders: 0
            };
        }
        
        symbolData[symbol].filled_qty += status.filled_quantity || 0;
        if (status.filled_quantity && status.average_price) {
            symbolData[symbol].total_amount += status.filled_quantity * status.average_price;
        }
        symbolData[symbol].orders += 1;
    });
    
    let html = '<h3 class="font-bold text-gray-900 mb-3">Execution Summary</h3><div class="space-y-3">';
    
    for (const [symbol, data] of Object.entries(symbolData)) {
        const avgPrice = data.filled_qty > 0 ? data.total_amount / data.filled_qty : 0;
        
        html += `
            <div class="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <h4 class="font-bold text-gray-900 mb-2">${symbol}</h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>Executed Qty: <span class="font-semibold">${data.filled_qty}</span></div>
                    <div>Avg Price: <span class="font-semibold">₹${avgPrice.toFixed(2)}</span></div>
                    <div>Total Amount: <span class="font-semibold">₹${data.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    <div>Orders: <span class="font-semibold">${data.orders}</span></div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    summaryDiv.innerHTML = html;
}

// Auto-initialize if page element exists
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const placeOrdersPage = document.getElementById('placeOrdersPage');
        if (placeOrdersPage && !placeOrdersPage.classList.contains('hidden')) {
            initPlaceOrders();
        }
    });
}

// Export functions to global scope
window.initPlaceOrders = initPlaceOrders;
window.removeFromBasket = removeFromBasket;
window.checkBasketMargin = checkBasketMargin;
window.addOrderToBasket = addOrderToBasket;

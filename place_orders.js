// =========================================================
// PLACE ORDERS PAGE MODULE (OPTIMIZED)
// Handles order basket, margin checks, and order placement
// Requires: shared_config.js, utils.js, basket_manager.js
// =========================================================

/**
 * Initialize Place Orders page
 */
function initPlaceOrders() {
    console.log('Initializing Place Orders page...');
    
    // Set basket display container
    basketManager.setDisplayContainer('orderBasket');
    
    setupPlaceOrdersListeners();
}

/**
 * Setup event listeners for Place Orders page
 */
function setupPlaceOrdersListeners() {
    // Buy/Sell toggle buttons
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    
    if (buyBtn && sellBtn) {
        buyBtn.addEventListener('click', () => toggleTransactionSide('BUY', buyBtn, sellBtn));
        sellBtn.addEventListener('click', () => toggleTransactionSide('SELL', buyBtn, sellBtn));
    }
    
    // Symbol autocomplete
    setupSymbolAutocomplete();
    
    // Order type change - show/hide price fields
    const orderTypeSelect = document.getElementById('orderType');
    if (orderTypeSelect) {
        orderTypeSelect.addEventListener('change', handleOrderTypeChange);
    }
    
    // Add to basket
    const addOrderBtn = document.getElementById('addOrderBtn');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', addOrderToBasket);
    }
    
    // Clear basket
    const clearBasketBtn = document.getElementById('clearBasketBtn');
    if (clearBasketBtn) {
        clearBasketBtn.addEventListener('click', clearBasket);
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
 * Toggle transaction side (BUY/SELL)
 */
function toggleTransactionSide(side, buyBtn, sellBtn) {
    if (side === 'BUY') {
        buyBtn.classList.add('bg-green-500', 'text-white');
        buyBtn.classList.remove('bg-white', 'text-gray-700');
        sellBtn.classList.remove('bg-red-500', 'text-white');
        sellBtn.classList.add('bg-white', 'text-gray-700');
    } else {
        sellBtn.classList.add('bg-red-500', 'text-white');
        sellBtn.classList.remove('bg-white', 'text-gray-700');
        buyBtn.classList.remove('bg-green-500', 'text-white');
        buyBtn.classList.add('bg-white', 'text-gray-700');
    }
}

/**
 * Get selected transaction type (BUY/SELL)
 */
function getSelectedSide() {
    const buyBtn = document.getElementById('buyBtn');
    return buyBtn && buyBtn.classList.contains('bg-green-500') ? 'BUY' : 'SELL';
}

/**
 * Handle order type change
 */
function handleOrderTypeChange(e) {
    const orderType = e.target.value;
    const priceFields = document.getElementById('priceFields');
    const limitPriceField = document.getElementById('limitPriceField');
    const triggerPriceField = document.getElementById('triggerPriceField');
    
    if (orderType === 'MARKET') {
        UIStateManager.showElements(['priceFields', 'limitPriceField', 'triggerPriceField'], false);
    } else if (orderType === 'LIMIT') {
        UIStateManager.showElement('priceFields', true);
        UIStateManager.showElement('limitPriceField', true);
        UIStateManager.showElement('triggerPriceField', false);
    } else if (orderType === 'SL') {
        UIStateManager.showElements(['priceFields', 'limitPriceField', 'triggerPriceField'], true);
    } else if (orderType === 'SL-M') {
        UIStateManager.showElement('priceFields', true);
        UIStateManager.showElement('limitPriceField', false);
        UIStateManager.showElement('triggerPriceField', true);
    }
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
    
    // Validation
    if (!order.tradingsymbol) {
        showErrorMessage('Please enter a trading symbol');
        return;
    }
    
    if (order.quantity <= 0) {
        showErrorMessage('Please enter a valid quantity');
        return;
    }
    
    // Add price fields if needed
    if (order.order_type === 'LIMIT' || order.order_type === 'SL') {
        const price = parseFloat(document.getElementById('orderPrice')?.value || 0);
        if (price > 0) order.price = price;
        else {
            showErrorMessage('Please enter a valid price');
            return;
        }
    }
    
    if (order.order_type === 'SL' || order.order_type === 'SL-M') {
        const triggerPrice = parseFloat(document.getElementById('orderTriggerPrice')?.value || 0);
        if (triggerPrice > 0) order.trigger_price = triggerPrice;
        else {
            showErrorMessage('Please enter a valid trigger price');
            return;
        }
    }
    
    // Add to basket
    basketManager.add(order);
    
    // Clear symbol input
    const symbolInput = document.getElementById('orderSymbol');
    if (symbolInput) symbolInput.value = '';
}

/**
 * Clear basket
 */
function clearBasket() {
    basketManager.clear();
    state.placedOrders = [];
    
    // Clear status outputs
    const statusOutput = document.getElementById('orderStatusOutput');
    const summaryOutput = document.getElementById('orderSummaryOutput');
    if (statusOutput) statusOutput.innerHTML = '';
    if (summaryOutput) summaryOutput.innerHTML = '';
}

/**
 * Check basket margin requirements
 */
async function checkBasketMargin() {
    if (basketManager.isEmpty()) {
        showErrorMessage('No orders in basket');
        return;
    }
    
    const resultDiv = document.getElementById('marginResult');
    if (!resultDiv) return;
    
    UIStateManager.showElement('marginResult', false);
    UIStateManager.toggleLoading('checkMarginBtn', true, 'Checking...');
    
    try {
        const data = await basketManager.checkMargin();
        displayMarginResults('marginResult', data, 'blue');
    } catch (error) {
        showErrorMessage(`Error checking margin: ${error.message}`);
    } finally {
        UIStateManager.toggleLoading('checkMarginBtn', false);
    }
}

/**
 * Place all orders in basket
 */
async function placeAllOrders() {
    if (basketManager.isEmpty()) {
        showErrorMessage('No orders in basket');
        return;
    }
    
    const statusDiv = document.getElementById('orderStatusOutput');
    if (statusDiv) {
        statusDiv.innerHTML = '<div class="p-4 bg-blue-50 rounded-lg">🚀 Placing orders...</div>';
    }
    
    UIStateManager.toggleLoading('placeAllOrdersBtn', true, 'Placing Orders...');
    
    try {
        const data = await basketManager.placeOrders();
        
        state.placedOrders = data.results;
        displayResults('orderStatusOutput', data.results, {
            successColor: 'green',
            errorColor: 'red',
            showOrderId: true
        });
        
        // Wait then refresh status
        setTimeout(refreshOrderStatus, 2000);
        
    } catch (error) {
        showErrorMessage(`Error placing orders: ${error.message}`);
    } finally {
        UIStateManager.toggleLoading('placeAllOrdersBtn', false);
    }
}

/**
 * Refresh order status
 */
async function refreshOrderStatus() {
    if (state.placedOrders.length === 0) return;
    
    const orderIds = state.placedOrders
        .filter(o => o.success && o.order_id)
        .map(o => o.order_id);
    
    if (orderIds.length === 0) return;
    
    try {
        const data = await apiCall('/api/order-status', { order_ids: orderIds });
        
        displayOrderStatus('orderStatusOutput', data.statuses);
        generateExecutionSummary(data.statuses);
        
    } catch (error) {
        console.error('Error refreshing status:', error);
    }
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
                    <div>Avg Price: <span class="font-semibold">${formatCurrency(avgPrice)}</span></div>
                    <div>Total Amount: <span class="font-semibold">${formatCurrency(data.total_amount)}</span></div>
                    <div>Orders: <span class="font-semibold">${data.orders}</span></div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    summaryDiv.innerHTML = html;
}

// Export functions to global scope
window.initPlaceOrders = initPlaceOrders;
window.addOrderToBasket = addOrderToBasket;
window.checkBasketMargin = checkBasketMargin;

console.log('✅ Place Orders module loaded (optimized)');

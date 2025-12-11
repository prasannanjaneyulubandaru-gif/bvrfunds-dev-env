// =========================================================
// PLACE ORDERS MODULE - FIXED VERSION
// Handles order basket management and placement
// =========================================================

// Initialize when page becomes visible
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.state !== 'undefined') {
        initializePlaceOrders();
    }
});

function initializePlaceOrders() {
    // Button event listeners
    const addOrderBtn = document.getElementById('addOrderBtn');
    const checkMarginBtn = document.getElementById('checkBasketMargin');
    const placeAllOrdersBtn = document.getElementById('placeAllOrdersBtn');
    
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', addOrderToBasket);
    }
    
    if (checkMarginBtn) {
        checkMarginBtn.addEventListener('click', checkPlaceOrdersMargin);  // RENAMED
    }
    
    if (placeAllOrdersBtn) {
        placeAllOrdersBtn.addEventListener('click', placeAllOrders);
    }
    
    // Instrument search
    const instrumentSearch = document.getElementById('instrumentSearch');
    if (instrumentSearch) {
        instrumentSearch.addEventListener('input', searchInstruments);
    }
    
    // Initialize basket display
    displayOrderBasket();
}

// =========================================================
// ORDER BASKET MANAGEMENT
// =========================================================

function addOrderToBasket() {
    const exchange = document.getElementById('exchange').value;
    const tradingsymbol = document.getElementById('tradingsymbol').value;
    const transactionType = document.getElementById('transactionType').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const orderType = document.getElementById('orderType').value;
    const product = document.getElementById('product').value;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const triggerPrice = parseFloat(document.getElementById('triggerPrice').value) || 0;

    // Validation
    if (!tradingsymbol || !quantity || quantity <= 0) {
        alert('Please enter valid symbol and quantity');
        return;
    }

    if (orderType === 'LIMIT' && (!price || price <= 0)) {
        alert('Please enter a valid price for LIMIT order');
        return;
    }

    if (orderType === 'SL' && (!price || !triggerPrice || price <= 0 || triggerPrice <= 0)) {
        alert('Please enter valid price and trigger price for SL order');
        return;
    }

    if (orderType === 'SL-M' && (!triggerPrice || triggerPrice <= 0)) {
        alert('Please enter a valid trigger price for SL-M order');
        return;
    }

    // Create order object
    const order = {
        exchange: exchange,
        tradingsymbol: tradingsymbol.toUpperCase(),
        transaction_type: transactionType,
        quantity: quantity,
        order_type: orderType,
        product: product,
        price: price,
        trigger_price: triggerPrice,
        variety: 'regular',
        validity: 'DAY'
    };

    // Add to basket
    window.state.orderBasket.push(order);
    
    // Display basket
    displayOrderBasket();
    
    // Clear form
    document.getElementById('tradingsymbol').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('price').value = '';
    document.getElementById('triggerPrice').value = '';
    
    // Show success message
    showMessage('Order added to basket', 'success');
}

function displayOrderBasket() {
    const basketBody = document.getElementById('basketBody');
    if (!basketBody) return;

    basketBody.innerHTML = '';

    if (window.state.orderBasket.length === 0) {
        basketBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                    <div class="text-4xl mb-2">📭</div>
                    <p>Your order basket is empty</p>
                    <p class="text-sm mt-1">Add orders using the form above</p>
                </td>
            </tr>
        `;
        return;
    }

    window.state.orderBasket.forEach((order, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-4 py-3 text-sm">
                <div class="font-medium">${order.tradingsymbol}</div>
                <div class="text-xs text-gray-500">${order.exchange}</div>
            </td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded text-xs font-medium ${
                    order.transaction_type === 'BUY' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                }">
                    ${order.transaction_type}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">${order.quantity}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    ${order.order_type}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">${order.product}</td>
            <td class="px-4 py-3 text-sm">
                ${order.price > 0 ? '₹' + order.price.toFixed(2) : '-'}
            </td>
            <td class="px-4 py-3 text-sm">
                ${order.trigger_price > 0 ? '₹' + order.trigger_price.toFixed(2) : '-'}
            </td>
            <td class="px-4 py-3 text-sm">
                <button 
                    onclick="removeFromBasket(${index})"
                    class="text-red-600 hover:text-red-800 font-medium"
                >
                    Remove
                </button>
            </td>
        `;
        basketBody.appendChild(row);
    });

    // Update basket count
    const basketCount = document.getElementById('basketCount');
    if (basketCount) {
        basketCount.textContent = window.state.orderBasket.length;
    }
}

function removeFromBasket(index) {
    window.state.orderBasket.splice(index, 1);
    displayOrderBasket();
    showMessage('Order removed from basket', 'info');
}

// =========================================================
// MARGIN CALCULATION - RENAMED TO AVOID CONFLICTS
// =========================================================

async function checkPlaceOrdersMargin() {
    const marginResult = document.getElementById('marginResult');
    
    if (!marginResult) return;

    // Check if basket is empty
    if (!window.state.orderBasket || window.state.orderBasket.length === 0) {
        marginResult.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p class="text-yellow-800 font-medium">⚠️ Basket is Empty</p>
                <p class="text-yellow-700 text-sm mt-1">Please add orders to the basket first</p>
            </div>
        `;
        return;
    }

    marginResult.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-blue-800 font-medium">🔄 Calculating margin...</p>
        </div>
    `;

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/basket-margin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                orders: window.state.orderBasket
            })
        });

        const data = await response.json();

        if (data.success) {
            const margin = data.margin;
            marginResult.innerHTML = `
                <div class="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">💰 Margin Requirements</h4>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-blue-50 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-1">Span</p>
                            <p class="text-xl font-bold text-blue-600">₹${margin.span.toFixed(2)}</p>
                        </div>
                        <div class="bg-purple-50 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-1">Exposure</p>
                            <p class="text-xl font-bold text-purple-600">₹${margin.exposure.toFixed(2)}</p>
                        </div>
                        <div class="bg-green-50 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-1">Premium</p>
                            <p class="text-xl font-bold text-green-600">₹${margin.option_premium.toFixed(2)}</p>
                        </div>
                        <div class="bg-orange-50 rounded-lg p-4">
                            <p class="text-sm text-gray-600 mb-1">Additional</p>
                            <p class="text-xl font-bold text-orange-600">₹${margin.additional.toFixed(2)}</p>
                        </div>
                    </div>
                    
                    <div class="border-t pt-4 mt-4">
                        <div class="flex justify-between items-center bg-gradient-to-r from-[#FE4A03] to-[#FF6B35] text-white rounded-lg p-4">
                            <span class="text-lg font-semibold">Total Required</span>
                            <span class="text-2xl font-bold">₹${margin.total.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="text-xs text-gray-500 mt-2">
                        <p>• Charges: ₹${margin.charges?.total?.toFixed(2) || '0.00'}</p>
                        <p>• Orders in basket: ${window.state.orderBasket.length}</p>
                    </div>
                </div>
            `;
        } else {
            marginResult.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 font-medium">❌ Error</p>
                    <p class="text-red-700 text-sm mt-1">${data.message || 'Failed to calculate margin'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Margin calculation error:', error);
        marginResult.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-800 font-medium">❌ Error</p>
                <p class="text-red-700 text-sm mt-1">Failed to connect to server</p>
            </div>
        `;
    }
}

// =========================================================
// ORDER PLACEMENT
// =========================================================

async function placeAllOrders() {
    if (window.state.orderBasket.length === 0) {
        alert('Please add orders to basket first');
        return;
    }

    const confirmPlacement = confirm(`Place ${window.state.orderBasket.length} orders?`);
    if (!confirmPlacement) return;

    // Clear previous results
    const executionSummary = document.getElementById('executionSummary');
    if (executionSummary) {
        executionSummary.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p class="text-blue-800 font-medium">🔄 Placing orders...</p>
            </div>
        `;
    }

    // Place orders
    const results = [];
    for (let i = 0; i < window.state.orderBasket.length; i++) {
        const order = window.state.orderBasket[i];
        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/place-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': window.state.userId
                },
                body: JSON.stringify(order)
            });

            const data = await response.json();
            results.push({
                order: order,
                success: data.success,
                order_id: data.order_id,
                message: data.message
            });

            if (data.success) {
                window.state.placedOrders.push({
                    ...order,
                    order_id: data.order_id,
                    status: 'PENDING',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            results.push({
                order: order,
                success: false,
                message: error.message
            });
        }
    }

    // Display results
    displayOrderStatus(results);
    
    // Clear basket if all successful
    const allSuccessful = results.every(r => r.success);
    if (allSuccessful) {
        window.state.orderBasket = [];
        displayOrderBasket();
    }
}

function displayOrderStatus(results) {
    const executionSummary = document.getElementById('executionSummary');
    if (!executionSummary) return;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    let summaryHTML = `
        <div class="space-y-4">
            <div class="bg-white border border-gray-200 rounded-lg p-6">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">📊 Execution Summary</h4>
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="text-center">
                        <p class="text-3xl font-bold text-gray-900">${results.length}</p>
                        <p class="text-sm text-gray-600">Total</p>
                    </div>
                    <div class="text-center">
                        <p class="text-3xl font-bold text-green-600">${successful}</p>
                        <p class="text-sm text-gray-600">Successful</p>
                    </div>
                    <div class="text-center">
                        <p class="text-3xl font-bold text-red-600">${failed}</p>
                        <p class="text-sm text-gray-600">Failed</p>
                    </div>
                </div>
                
                <div class="space-y-2">
    `;

    results.forEach((result, index) => {
        const statusClass = result.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800';
        const icon = result.success ? '✅' : '❌';

        summaryHTML += `
            <div class="border ${statusClass} rounded-lg p-3">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="font-medium">
                            ${icon} ${result.order.tradingsymbol} - 
                            ${result.order.transaction_type} ${result.order.quantity}
                        </p>
                        <p class="text-sm mt-1">${result.message || 'No message'}</p>
                        ${result.order_id ? `<p class="text-xs mt-1">Order ID: ${result.order_id}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    summaryHTML += `
                </div>
            </div>
        </div>
    `;

    executionSummary.innerHTML = summaryHTML;

    // Auto-refresh order status after 2 seconds
    setTimeout(() => {
        refreshOrderStatus();
    }, 2000);
}

async function refreshOrderStatus() {
    if (window.state.placedOrders.length === 0) return;

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/order-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                order_ids: window.state.placedOrders.map(o => o.order_id)
            })
        });

        const data = await response.json();
        if (data.success) {
            // Update order statuses
            window.state.placedOrders.forEach(order => {
                const status = data.orders.find(o => o.order_id === order.order_id);
                if (status) {
                    order.status = status.status;
                }
            });
        }
    } catch (error) {
        console.error('Error refreshing order status:', error);
    }
}

// =========================================================
// INSTRUMENT SEARCH
// =========================================================

let searchTimeout;
async function searchInstruments() {
    const searchInput = document.getElementById('instrumentSearch');
    const resultsDiv = document.getElementById('searchResults');
    
    if (!searchInput || !resultsDiv) return;

    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/search-instruments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': window.state.userId
                },
                body: JSON.stringify({ query: query })
            });

            const data = await response.json();
            
            if (data.success && data.instruments.length > 0) {
                resultsDiv.innerHTML = data.instruments.slice(0, 10).map(inst => `
                    <div class="px-4 py-2 hover:bg-gray-100 cursor-pointer" 
                         onclick="selectInstrument('${inst.tradingsymbol}', '${inst.exchange}')">
                        <div class="font-medium">${inst.tradingsymbol}</div>
                        <div class="text-sm text-gray-500">${inst.name} - ${inst.exchange}</div>
                    </div>
                `).join('');
                resultsDiv.classList.remove('hidden');
            } else {
                resultsDiv.innerHTML = `
                    <div class="px-4 py-2 text-gray-500 text-sm">
                        No instruments found
                    </div>
                `;
                resultsDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }, 300);
}

function selectInstrument(symbol, exchange) {
    document.getElementById('tradingsymbol').value = symbol;
    document.getElementById('exchange').value = exchange;
    document.getElementById('searchResults').classList.add('hidden');
}

// =========================================================
// UTILITY FUNCTIONS
// =========================================================

function showMessage(message, type = 'info') {
    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    };

    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 ${colors[type]} border rounded-lg p-4 shadow-lg z-50`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Export functions to global scope
window.addOrderToBasket = addOrderToBasket;
window.removeFromBasket = removeFromBasket;
window.checkPlaceOrdersMargin = checkPlaceOrdersMargin;  // EXPORTED WITH NEW NAME
window.placeAllOrders = placeAllOrders;
window.selectInstrument = selectInstrument;
window.displayOrderBasket = displayOrderBasket;
window.refreshOrderStatus = refreshOrderStatus;

console.log('✅ Place Orders module loaded');

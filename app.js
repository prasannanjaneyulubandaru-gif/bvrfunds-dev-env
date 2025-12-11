// Configuration
const CONFIG = {
    redirectUrl: window.location.origin + window.location.pathname.replace(/\/+$/, ''),
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://shark-app-hyd9r.ondigitalocean.app'
};

// State management
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
    autoTrailInterval: null  // For polling auto trail status
};

// Initialize
window.addEventListener('load', () => {
    console.log('Page loaded');
    checkAuthStatus();
    setupEventListeners();
});

// ===========================================
// AUTHENTICATION & SESSION MANAGEMENT
// ===========================================

function checkAuthStatus() {
    console.log('Checking auth status...');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('request_token');
    const status = urlParams.get('status');
    const action = urlParams.get('action');

    if (token && status === 'success' && action === 'login') {
        const storedApiKey = sessionStorage.getItem('api_key');
        const storedApiSecret = sessionStorage.getItem('api_secret');

        if (storedApiKey && storedApiSecret) {
            state.apiKey = storedApiKey;
            state.apiSecret = storedApiSecret;
            document.getElementById('displayToken').textContent = token.substring(0, 20) + '...';
            showPage('token');
            setTimeout(() => completeLogin(token), 1000);
        } else {
            showError('Session expired. Please login again.');
            showPage('login');
        }
    } else {
        const accessToken = sessionStorage.getItem('access_token');
        if (accessToken) {
            state.accessToken = accessToken;
            state.userId = sessionStorage.getItem('user_id');
            loadProfile();
            showPage('dashboard');
        } else {
            showPage('login');
        }
    }
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
            sessionStorage.setItem('access_token', data.access_token);
            sessionStorage.setItem('user_id', data.user_id);
            state.accessToken = data.access_token;
            state.userId = data.user_id;

            await loadProfile();
            window.history.replaceState({}, document.title, window.location.pathname);
            showPage('dashboard');
        } else {
            throw new Error(data.error || 'Failed to generate session');
        }
    } catch (error) {
        console.error('Login error:', error);
        simulateDemoMode();
    }
}

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
    }
}

function updateProfile(profile) {
    state.profile = profile;
    const nameParts = profile.user_name.split(' ');
    const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    document.getElementById('profileName').textContent = profile.user_name;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('menuUserName').textContent = profile.user_name;
    document.getElementById('menuUserId').textContent = profile.user_id;
    document.getElementById('menuEmail').textContent = profile.email;
    document.getElementById('menuUserType').textContent = profile.user_type || 'individual';
    document.getElementById('menuBroker').textContent = profile.broker || 'Zerodha';
    
    const productsContainer = document.getElementById('menuProducts');
    productsContainer.innerHTML = '';
    if (profile.products && profile.products.length > 0) {
        profile.products.forEach(product => {
            const badge = document.createElement('span');
            badge.className = 'px-2 py-1 bg-[#FE4A03] bg-opacity-10 text-[#FE4A03] text-xs font-semibold rounded';
            badge.textContent = product.toUpperCase();
            productsContainer.appendChild(badge);
        });
    }
}

function simulateDemoMode() {
    const demoProfile = {
        user_id: 'DEMO123',
        user_name: 'Demo User',
        email: 'demo@bvrfunds.com',
        user_type: 'individual',
        broker: 'Zerodha',
        products: ['CNC', 'MIS', 'NRML']
    };
    updateProfile(demoProfile);
    setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        showPage('dashboard');
    }, 2000);
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.querySelector('p').textContent = message;
    errorElement.classList.remove('hidden');
}

// ===========================================
// PAGE NAVIGATION
// ===========================================

function showPage(page) {
    // Hide all pages
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('tokenPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('placeOrdersPage').classList.add('hidden');
    document.getElementById('strategiesPage').classList.add('hidden');
    document.getElementById('managePositionsPage').classList.add('hidden');
    document.getElementById('chartMonitorPage').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');

    switch(page) {
        case 'login':
            document.getElementById('loginPage').classList.remove('hidden');
            break;
        case 'token':
            document.getElementById('tokenPage').classList.remove('hidden');
            break;
        case 'dashboard':
            document.getElementById('dashboardPage').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            state.currentPage = 'dashboard';
            updateActiveMenuItem('dashboard');
            break;
        case 'place-orders':
            document.getElementById('placeOrdersPage').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            state.currentPage = 'place-orders';
            updateActiveMenuItem('place-orders');
            break;
        case 'strategies':
            document.getElementById('strategiesPage').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            state.currentPage = 'strategies';
            updateActiveMenuItem('strategies');
            break;
        case 'manage-positions':
            document.getElementById('managePositionsPage').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            state.currentPage = 'manage-positions';
            updateActiveMenuItem('manage-positions');
            loadPositions();
            break;
        case 'chart-monitor':
            document.getElementById('chartMonitorPage').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            state.currentPage = 'chart-monitor';
            updateActiveMenuItem('chart-monitor');
            break;
    }
}

function updateActiveMenuItem(page) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
}

// ===========================================
// EVENT LISTENERS SETUP
// ===========================================

function setupEventListeners() {
    // Credentials form
    document.getElementById('credentialsForm').addEventListener('submit', handleCredentialsSubmit);
    
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => showPage(item.dataset.page));
    });
    
    // Profile dropdown
    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    
    profileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', () => {
        profileMenu?.classList.add('hidden');
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Place Orders page
    setupPlaceOrdersListeners();
    
    // Manage Positions page
    setupManagePositionsListeners();
    
    // Chart Monitor page
    setupChartMonitorListeners();
    
    // Strike Selection Page
     setupStrategiesListeners();
}

function handleCredentialsSubmit(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();

    if (!apiKey || !apiSecret) {
        showError('Please enter both API Key and API Secret');
        return;
    }

    state.apiKey = apiKey;
    state.apiSecret = apiSecret;

    sessionStorage.setItem('api_key', apiKey);
    sessionStorage.setItem('api_secret', apiSecret);

    const kiteAuthUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;
    window.location.href = kiteAuthUrl;
}

function handleLogout() {
    sessionStorage.clear();
    state = {
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
        monitorRunning: false
    };
    if (state.monitorInterval) {
        clearInterval(state.monitorInterval);
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    showPage('login');
}

// ===========================================
// PLACE ORDERS PAGE
// ===========================================

function setupPlaceOrdersListeners() {
    // Buy/Sell buttons
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');
    let selectedSide = 'BUY';
    
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
    setupSymbolAutocomplete();
    
    // Order type change - show/hide price fields
    document.getElementById('orderType').addEventListener('change', (e) => {
        const orderType = e.target.value;
        const priceFields = document.getElementById('priceFields');
        const limitPriceField = document.getElementById('limitPriceField');
        const triggerPriceField = document.getElementById('triggerPriceField');
        
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
    
    // Add to basket
    document.getElementById('addOrderBtn').addEventListener('click', () => {
        const order = {
            tradingsymbol: document.getElementById('orderSymbol').value.trim().toUpperCase(),
            exchange: document.getElementById('orderExchange').value,
            quantity: parseInt(document.getElementById('orderQuantity').value),
            transaction_type: selectedSide,
            order_type: document.getElementById('orderType').value,
            product: document.getElementById('orderProduct').value,
            variety: 'regular'
        };
        
        if (!order.tradingsymbol) {
            alert('Please enter a trading symbol');
            return;
        }
        
        if (order.order_type === 'LIMIT' || order.order_type === 'SL') {
            const price = parseFloat(document.getElementById('orderPrice').value);
            if (price) order.price = price;
        }
        
        if (order.order_type === 'SL' || order.order_type === 'SL-M') {
            const triggerPrice = parseFloat(document.getElementById('orderTriggerPrice').value);
            if (triggerPrice) order.trigger_price = triggerPrice;
        }
        
        state.orderBasket.push(order);
        displayOrderBasket();
        
        // Clear form
        document.getElementById('orderSymbol').value = '';
    });
    
    // Clear basket
    document.getElementById('clearBasketBtn').addEventListener('click', () => {
        state.orderBasket = [];
        state.placedOrders = [];
        displayOrderBasket();
        document.getElementById('orderStatusOutput').innerHTML = '';
        document.getElementById('orderSummaryOutput').innerHTML = '';
    });
    
    // Check margin
    document.getElementById('checkMarginBtn').addEventListener('click', checkBasketMargin);
    
    // Place all orders
    document.getElementById('placeAllOrdersBtn').addEventListener('click', placeAllOrders);
    
    // Refresh order status
    document.getElementById('refreshOrderStatusBtn').addEventListener('click', refreshOrderStatus);
}

function displayOrderBasket() {
    const basketDiv = document.getElementById('orderBasket');
    
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

function removeFromBasket(index) {
    state.orderBasket.splice(index, 1);
    displayOrderBasket();
}

async function checkBasketMargin() {
    if (state.orderBasket.length === 0) {
        alert('No orders in basket');
        return;
    }
    
    try {
        // Use shared margin utility
        const data = await window.MarginUtils.checkMarginForBasket(
            state.orderBasket,
            '/api/basket-margin',
            state.userId,
            CONFIG.backendUrl
        );
        
        // Display results using shared utility with 'simple' style
        window.MarginUtils.displayMarginResults(data, 'orderStatusOutput', 'simple');
        
    } catch (error) {
        window.MarginUtils.showMarginError('orderStatusOutput', error.message);
    }
}

async function placeAllOrders() {
    if (state.orderBasket.length === 0) {
        alert('No orders in basket');
        return;
    }
    
    const statusDiv = document.getElementById('orderStatusOutput');
    statusDiv.innerHTML = '<div class="p-4 bg-blue-50 rounded-lg">🚀 Placing orders...</div>';
    
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
            
            // Wait a bit then refresh status
            setTimeout(refreshOrderStatus, 2000);
        } else {
            alert('Error placing orders: ' + data.error);
        }
    } catch (error) {
        alert('Error placing orders: ' + error.message);
    }
}

function displayOrderResults(results) {
    const statusDiv = document.getElementById('orderStatusOutput');
    
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

function displayOrderStatus(statuses) {
    const statusDiv = document.getElementById('orderStatusOutput');
    
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

function generateExecutionSummary(statuses) {
    const summaryDiv = document.getElementById('orderSummaryOutput');
    
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

// =========================================================
// STRATEGIES PAGE FUNCTIONALITY
// Add this code to your app.js file
// =========================================================

/**
 * Setup event listeners for strategies page
 * Call this from your main setup function
 */
function setupStrategiesListeners() {
    document.getElementById('executeBullishBtn')?.addEventListener('click', executeBullishStrategy);
    document.getElementById('executeBearishBtn')?.addEventListener('click', executeBearishStrategy);
}

/**
 * Execute Bullish Future Spread Strategy
 */
async function executeBullishStrategy() {
    const button = document.getElementById('executeBullishBtn');
    const loading = document.getElementById('bullishLoading');
    const results = document.getElementById('bullishResults');
    
    const lowerPremium = parseFloat(document.getElementById('lowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('upperPremium').value);
    
    // Validation
    if (lowerPremium >= upperPremium) {
        alert('Lower premium must be less than upper premium');
        return;
    }
    
    // Show loading
    button.classList.add('hidden');
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    
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
            displayBullishResults(data);
            
            // Log to console for debugging
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
 * Execute Bearish Future Spread Strategy
 */
async function executeBearishStrategy() {
    const button = document.getElementById('executeBearishBtn');
    const loading = document.getElementById('bearishLoading');
    const results = document.getElementById('bearishResults');
    
    const lowerPremium = parseFloat(document.getElementById('lowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('upperPremium').value);
    
    // Validation
    if (lowerPremium >= upperPremium) {
        alert('Lower premium must be less than upper premium');
        return;
    }
    
    // Show loading
    button.classList.add('hidden');
    loading.classList.remove('hidden');
    results.classList.add('hidden');
    
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
            displayBearishResults(data);
            
            // Log to console for debugging
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
 * Display Bullish Strategy Results
 */
function displayBullishResults(data) {
    const results = document.getElementById('bullishResults');
    
    // Update Future details
    if (data.future) {
        document.getElementById('bullishFutureSymbol').textContent = data.future.symbol;
        document.getElementById('bullishFutureToken').textContent = data.future.token;
        document.getElementById('bullishFuturePrice').textContent = data.future.last_price ? 
            data.future.last_price.toFixed(2) : '-';
    }
    
    // Update Hedge details
    if (data.hedge) {
        document.getElementById('bullishHedgeSymbol').textContent = data.hedge.symbol;
        document.getElementById('bullishHedgeToken').textContent = data.hedge.token;
        document.getElementById('bullishHedgePrice').textContent = data.hedge.last_price ? 
            data.hedge.last_price.toFixed(2) : '-';
    }
    
    // Show results
    results.classList.remove('hidden');
    
    // Add animation
    results.style.animation = 'fadeIn 0.5s ease-out';
}

/**
 * Display Bearish Strategy Results
 */
function displayBearishResults(data) {
    const results = document.getElementById('bearishResults');
    
    // Update Future details
    if (data.future) {
        document.getElementById('bearishFutureSymbol').textContent = data.future.symbol;
        document.getElementById('bearishFutureToken').textContent = data.future.token;
        document.getElementById('bearishFuturePrice').textContent = data.future.last_price ? 
            data.future.last_price.toFixed(2) : '-';
    }
    
    // Update Hedge details
    if (data.hedge) {
        document.getElementById('bearishHedgeSymbol').textContent = data.hedge.symbol;
        document.getElementById('bearishHedgeToken').textContent = data.hedge.token;
        document.getElementById('bearishHedgePrice').textContent = data.hedge.last_price ? 
            data.hedge.last_price.toFixed(2) : '-';
    }
    
    // Show results
    results.classList.remove('hidden');
    
    // Add animation
    results.style.animation = 'fadeIn 0.5s ease-out';
}

// =========================================================
// IMPORTANT: Call this in your setupEventListeners() function
// Add this line:
// setupStrategiesListeners();
// =========================================================

// ===========================================
// MANAGE POSITIONS PAGE
// ===========================================

function setupManagePositionsListeners() {
    document.getElementById('refreshPositionsBtn').addEventListener('click', loadPositions);
    document.getElementById('trailSlBtn')?.addEventListener('click', showTrailSlConfig);
    document.getElementById('exitImmediatelyBtn')?.addEventListener('click', exitPositionImmediately);
}

async function loadPositions() {
    const positionsList = document.getElementById('positionsList');
    positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Loading positions...</div>';
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/positions`, {
            headers: { 'X-User-ID': state.userId }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPositions(data.positions);
        } else {
            positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Error loading positions</div>';
        }
    } catch (error) {
        positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Error loading positions</div>';
    }
}

function displayPositions(positions) {
    const positionsList = document.getElementById('positionsList');
    
    if (positions.length === 0) {
        positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">No open positions</div>';
        return;
    }
    
    positionsList.innerHTML = '';
    
    positions.forEach(position => {
        const positionCard = document.createElement('div');
        positionCard.className = 'position-card';
        
        const isLong = position.quantity > 0;
        const sideColor = isLong ? 'text-green-600' : 'text-red-600';
        const side = isLong ? 'LONG' : 'SHORT';
        
        positionCard.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <div class="font-bold text-lg">
                        <span class="mono">${position.exchange}:${position.tradingsymbol}</span>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        <span class="${sideColor} font-semibold">${side} ${Math.abs(position.quantity)}</span>
                        <span class="mx-2">@</span>
                        <span>₹${position.average_price.toFixed(2)}</span>
                        <span class="ml-3 badge badge-info">${position.product}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600">P&L</div>
                    <div class="font-bold text-lg ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${position.pnl >= 0 ? '+' : ''}₹${position.pnl.toFixed(2)}
                    </div>
                </div>
            </div>
        `;
        
        positionCard.addEventListener('click', () => selectPosition(position));
        
        positionsList.appendChild(positionCard);
    });
}

function selectPosition(position) {
    state.selectedPosition = position;
    
    // Update UI
    document.querySelectorAll('.position-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show actions panel
    const actionsPanel = document.getElementById('positionActionsPanel');
    actionsPanel.classList.remove('hidden');
    
    const isLong = position.quantity > 0;
    const sideColor = isLong ? 'text-green-600' : 'text-red-600';
    const side = isLong ? 'LONG' : 'SHORT';
    
    const selectedInfo = document.getElementById('selectedPositionInfo');
    selectedInfo.innerHTML = `
        <div class="p-4 bg-yellow-50 rounded-lg">
            <div class="font-bold text-lg">
                ${position.exchange}:${position.tradingsymbol}
            </div>
            <div class="mt-2 text-sm">
                <span class="${sideColor} font-semibold">${side} ${Math.abs(position.quantity)}</span>
                <span class="mx-2">@</span>
                <span>₹${position.average_price.toFixed(2)}</span>
                <span class="ml-3 badge badge-info">${position.product}</span>
            </div>
        </div>
    `;
    
    // Hide trailing config
    document.getElementById('trailSlConfig').classList.add('hidden');
    document.getElementById('trailStatus').classList.add('hidden');
}

function showTrailSlConfig() {
    if (!state.selectedPosition) return;
    
    const configDiv = document.getElementById('trailSlConfig');
    const contentDiv = document.getElementById('trailConfigContent');
    
    const isLong = state.selectedPosition.quantity > 0;
    const avgPrice = state.selectedPosition.average_price;
    
    contentDiv.innerHTML = `
        <div class="mb-4">
            <p class="text-sm text-gray-600 mb-2">
                Set trailing stop loss from average price (₹${avgPrice.toFixed(2)})
            </p>
            <div class="mb-4">
                <label class="block text-sm font-semibold text-gray-900 mb-2">Trail Points</label>
                <input
                    type="number"
                    id="trailPoints"
                    value="10"
                    step="0.5"
                    class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-gray-900 text-sm"
                />
            </div>
            <div class="grid grid-cols-2 gap-4">
                <button id="startTrailBtn" class="btn-success text-white font-semibold px-6 py-3 rounded-lg">
                    🎯 Manual Trail
                </button>
                <button id="startAutoTrailBtn" class="btn-primary text-white font-semibold px-6 py-3 rounded-lg">
                    🤖 Auto Trail
                </button>
            </div>
        </div>
        <div class="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>ℹ️ Choose Trailing Mode:</strong>
            <ul class="mt-2 space-y-1 ml-4">
                <li><strong>Manual Trail:</strong> Place SL and use +/- buttons to adjust manually</li>
                <li><strong>Auto Trail:</strong> Automatically moves SL in real-time as price moves in your favor (WebSocket)</li>
            </ul>
            <p class="mt-2 text-xs">
                Both use SL (Stop Loss Limit) orders ${isLong ? 'below' : 'above'} your average price with a 5% limit buffer for F&O compatibility.
            </p>
        </div>
    `;
    
    configDiv.classList.remove('hidden');
    
    // Add event listeners
    document.getElementById('startTrailBtn').addEventListener('click', startTrailing);
    document.getElementById('startAutoTrailBtn').addEventListener('click', startAutoTrailing);
}

async function startTrailing() {
    if (!state.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const position = state.selectedPosition;
    const isLong = position.quantity > 0;
    const avgPrice = position.average_price;
    
    // Calculate initial trigger price
    let triggerPrice = isLong ? avgPrice - trailPoints : avgPrice + trailPoints;
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05; // Round to tick size
    
    // Calculate limit price with 5% buffer from trigger (wide range for F&O)
    // This gives enough room for order to execute before we flip to MARKET
    const bufferPercent = 0.05; // 5% buffer
    let limitPrice;
    if (isLong) {
        // LONG position - SELL order - limit price below trigger
        limitPrice = triggerPrice * (1 - bufferPercent);
    } else {
        // SHORT position - BUY order - limit price above trigger
        limitPrice = triggerPrice * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05; // Round to tick size
    
    try {
        // Place SL order (not SL-M) with trigger and limit price
        const response = await fetch(`${CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: isLong ? 'SELL' : 'BUY',
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'SL', // SL (Stop Loss Limit)
                trigger_price: triggerPrice,
                price: limitPrice // Wide limit price for protection
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show success message
            const messagesDiv = document.getElementById('positionMessages');
            
            messagesDiv.innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Manual Trailing Stop Loss Activated</div>
                    <div class="text-sm text-green-700">
                        <div>Order ID: ${data.order_id}</div>
                        <div>Order Type: SL (Stop Loss Limit)</div>
                        <div>Trigger Price: ₹${triggerPrice.toFixed(2)}</div>
                        <div>Limit Price: ₹${limitPrice.toFixed(2)} (5% buffer)</div>
                        <div>Trail Points: ${trailPoints}</div>
                    </div>
                    <div class="mt-2 text-xs text-gray-600">
                        💡 Use +/- buttons below to adjust manually
                    </div>
                </div>
            `;
            
            // Show manual adjustment controls
            showManualTrailControls(data.order_id, triggerPrice, limitPrice, trailPoints);
        } else {
            alert('Error placing SL order: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function startAutoTrailing() {
    if (!state.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const position = state.selectedPosition;
    const isLong = position.quantity > 0;
    const avgPrice = position.average_price;
    
    // Calculate initial trigger price
    let triggerPrice = isLong ? avgPrice - trailPoints : avgPrice + trailPoints;
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
    
    // Calculate limit price
    let limitPrice;
    if (isLong) {
        limitPrice = triggerPrice - trailPoints;
    } else {
        limitPrice = triggerPrice + trailPoints;
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        // First, place the initial SL order
        const placeResponse = await fetch(`${CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: isLong ? 'SELL' : 'BUY',
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'SL',
                trigger_price: triggerPrice,
                price: limitPrice
            })
        });
        
        const placeData = await placeResponse.json();
        
        if (!placeData.success) {
            alert('Error placing SL order: ' + placeData.error);
            return;
        }
        
        // Get instrument token
        const instrumentToken = await getInstrumentToken(position.exchange, position.tradingsymbol);
        
        if (!instrumentToken) {
            alert('Could not find instrument token');
            return;
        }
        
        // Start automated trailing
        const trailResponse = await fetch(`${CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                symbol: position.tradingsymbol,
                exchange: position.exchange,
                instrument_token: instrumentToken,
                order_id: placeData.order_id,
                trigger_price: triggerPrice,
                limit_price: limitPrice,
                trail_points: trailPoints,
                exit_type: isLong ? 'SELL' : 'BUY',
                quantity: Math.abs(position.quantity),
                product: position.product,
                variety: 'regular',
                avg_price: avgPrice
            })
        });
        
        const trailData = await trailResponse.json();
        
        if (trailData.success) {
            const messagesDiv = document.getElementById('positionMessages');
            messagesDiv.innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">🤖 Automated Trailing Activated!</div>
                    <div class="text-sm text-green-700">
                        <div>Order ID: ${placeData.order_id}</div>
                        <div>Initial Trigger: ₹${triggerPrice.toFixed(2)}</div>
                        <div>Initial Limit: ₹${limitPrice.toFixed(2)}</div>
                        <div>Trail Points: ${trailPoints}</div>
                        <div class="mt-2 font-semibold">🔄 Real-time WebSocket trailing active</div>
                    </div>
                </div>
            `;
            
            // Show stop button
            showAutoTrailControls(trailData.position_key, triggerPrice, limitPrice);
        } else {
            alert('Error starting auto trail: ' + trailData.error);
        }
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function getInstrumentToken(exchange, tradingsymbol) {
    // For now, return a placeholder - in production, you'd fetch from instruments API
    // This is a simplified version
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

function showAutoTrailControls(positionKey, trigger, limit) {
    const statusDiv = document.getElementById('trailStatus');
    const contentDiv = document.getElementById('trailStatusContent');
    
    contentDiv.innerHTML = `
        <div class="space-y-4">
            <div class="p-4 bg-green-50 rounded-lg border-2 border-green-500">
                <div class="font-bold text-green-800 mb-2 flex items-center gap-2">
                    <div class="animate-pulse w-3 h-3 bg-green-600 rounded-full"></div>
                    Real-Time Automated Trailing Active
                </div>
                <div class="text-sm text-green-700">
                    <div>Initial Trigger: ₹${trigger.toFixed(2)}</div>
                    <div>Initial Limit: ₹${limit.toFixed(2)}</div>
                    <div class="mt-2 text-xs">System will automatically move SL as price moves in your favor</div>
                </div>
            </div>
            
            <!-- Real-time status updates panel -->
            <div class="p-4 bg-gray-900 rounded-lg text-green-400 font-mono text-xs" style="max-height: 300px; overflow-y: auto;">
                <div class="font-bold text-green-300 mb-2">📊 Real-Time Trail Status</div>
                <div id="autoTrailLog" class="space-y-1">
                    <div class="text-gray-500">Waiting for updates...</div>
                </div>
            </div>
            
            <button onclick="stopAutoTrailing('${positionKey}')" class="w-full btn-danger text-white font-semibold px-6 py-3 rounded-lg">
                ⏹️ Stop Auto Trail & Cancel SL
            </button>
        </div>
    `;
    
    statusDiv.classList.remove('hidden');
    
    // Start polling for status updates every 2 seconds
    if (state.autoTrailInterval) {
        clearInterval(state.autoTrailInterval);
    }
    
    state.autoTrailInterval = setInterval(() => {
        fetchAutoTrailStatus();
    }, 2000); // Update every 2 seconds
}

async function fetchAutoTrailStatus() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/get-trail-status`, {
            method: 'GET',
            headers: {
                'X-User-ID': state.userId
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.positions) {
            updateAutoTrailLog(data.positions, data.logs || []);
        }
    } catch (error) {
        console.error('Error fetching trail status:', error);
    }
}

function updateAutoTrailLog(positions, logs) {
    const logDiv = document.getElementById('autoTrailLog');
    if (!logDiv) return;
    
    let html = '';
    
    // Show position summaries first
    for (const [posKey, details] of Object.entries(positions)) {
        const currentPrice = details.current_price || 0;
        const trigger = details.trigger_price;
        const limit = details.limit_price;
        const pnl = details.pnl || 0;
        const updateCount = details.update_count || 0;
        const distance = Math.abs(currentPrice - trigger);
        const side = details.exit_type === 'SELL' ? 'LONG' : 'SHORT';
        
        const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
        const sideColor = side === 'LONG' ? 'text-blue-400' : 'text-orange-400';
        
        html += `
            <div class="border-l-2 border-green-600 pl-2 py-1 mb-2">
                <div class="flex items-center gap-2">
                    <span class="${sideColor} font-bold">${side}</span>
                    <span class="text-white">${details.symbol}</span>
                    <span class="text-gray-500">#${updateCount}</span>
                </div>
                <div class="text-xs">
                    LTP: <span class="text-white">₹${currentPrice.toFixed(2)}</span> | 
                    SL: <span class="text-yellow-400">₹${trigger.toFixed(2)}</span> | 
                    Limit: <span class="text-blue-400">₹${limit.toFixed(2)}</span>
                </div>
                <div class="text-xs">
                    Distance: <span class="text-white">${distance.toFixed(2)}</span> | 
                    P&L: <span class="${pnlColor}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span> pts
                </div>
            </div>
        `;
    }
    
    // Show recent log entries
    if (logs && logs.length > 0) {
        html += '<div class="border-t border-gray-700 my-2 pt-2">';
        html += '<div class="text-gray-400 text-xs mb-1">Recent Updates:</div>';
        
        // Show last 10 logs
        const recentLogs = logs.slice(-10);
        for (const log of recentLogs) {
            const time = new Date(log.time * 1000).toLocaleTimeString();
            html += `<div class="text-xs text-gray-300">[${time}] ${log.msg}</div>`;
        }
        
        html += '</div>';
    }
    
    if (html === '') {
        html = '<div class="text-gray-500">No active trailing positions</div>';
    }
    
    logDiv.innerHTML = html;
    
    // Auto-scroll to bottom
    logDiv.parentElement.scrollTop = logDiv.parentElement.scrollHeight;
}

async function stopAutoTrailing(positionKey) {
    try {
        // Stop the polling interval
        if (state.autoTrailInterval) {
            clearInterval(state.autoTrailInterval);
            state.autoTrailInterval = null;
        }
        
        const response = await fetch(`${CONFIG.backendUrl}/api/stop-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                position_key: positionKey
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailStatus').classList.add('hidden');
            const messagesDiv = document.getElementById('positionMessages');
            messagesDiv.innerHTML = `
                <div class="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                    ⏹️ Automated trailing stopped. Don't forget to cancel the SL order manually if needed.
                </div>
            `;
        } else {
            alert('Error stopping auto trail: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function showManualTrailControls(orderId, currentTrigger, currentLimit, trailPoints) {
    const statusDiv = document.getElementById('trailStatus');
    const contentDiv = document.getElementById('trailStatusContent');
    
    contentDiv.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-green-50 rounded-lg">
                    <div class="text-sm text-gray-600 mb-1">Trigger Price</div>
                    <div class="text-2xl font-bold text-green-600">₹<span id="currentTrigger">${currentTrigger.toFixed(2)}</span></div>
                </div>
                <div class="p-4 bg-blue-50 rounded-lg">
                    <div class="text-sm text-gray-600 mb-1">Limit Price (5%)</div>
                    <div class="text-xl font-bold text-blue-600">₹<span id="currentLimit">${currentLimit.toFixed(2)}</span></div>
                </div>
            </div>
            <div>
                <label class="block text-sm font-semibold text-gray-900 mb-2">Adjust Trigger</label>
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="adjustTrigger(-2)" class="border-2 border-gray-300 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-50">
                        -2 pts
                    </button>
                    <button onclick="adjustTrigger(-1)" class="border-2 border-gray-300 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-50">
                        -1 pt
                    </button>
                    <button onclick="adjustTrigger(1)" class="border-2 border-gray-300 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-50">
                        +1 pt
                    </button>
                    <button onclick="adjustTrigger(2)" class="border-2 border-gray-300 text-gray-700 font-semibold px-4 py-3 rounded-lg hover:bg-gray-50">
                        +2 pts
                    </button>
                </div>
            </div>
            <button onclick="stopTrailing('${orderId}')" class="w-full btn-danger text-white font-semibold px-6 py-3 rounded-lg">
                Stop & Cancel SL
            </button>
        </div>
    `;
    
    statusDiv.classList.remove('hidden');
    statusDiv.dataset.orderId = orderId;
    statusDiv.dataset.currentTrigger = currentTrigger;
    statusDiv.dataset.currentLimit = currentLimit;
}

async function adjustTrigger(points) {
    const statusDiv = document.getElementById('trailStatus');
    const orderId = statusDiv.dataset.orderId;
    let currentTrigger = parseFloat(statusDiv.dataset.currentTrigger);
    
    const oldTrigger = currentTrigger;
    currentTrigger += points;
    currentTrigger = Math.round(currentTrigger / 0.05) * 0.05;
    
    // Recalculate limit price with 5% buffer
    const position = state.selectedPosition;
    const isLong = position.quantity > 0;
    const bufferPercent = 0.05; // 5% buffer
    
    let limitPrice;
    if (isLong) {
        // LONG position - SELL order - limit below trigger
        limitPrice = currentTrigger * (1 - bufferPercent);
    } else {
        // SHORT position - BUY order - limit above trigger
        limitPrice = currentTrigger * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/modify-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular',
                trigger_price: currentTrigger,
                price: limitPrice,
                order_type: 'SL',
                quantity: Math.abs(state.selectedPosition.quantity)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.dataset.orderId = data.order_id;
            statusDiv.dataset.currentTrigger = currentTrigger;
            statusDiv.dataset.currentLimit = limitPrice;
            document.getElementById('currentTrigger').textContent = currentTrigger.toFixed(2);
            document.getElementById('currentLimit').textContent = limitPrice.toFixed(2);
            
            // Show success feedback with detailed log
            const messagesDiv = document.getElementById('positionMessages');
            const timestamp = new Date().toLocaleTimeString();
            const direction = points > 0 ? '⬆️ RAISED' : '⬇️ LOWERED';
            const symbol = state.selectedPosition.tradingsymbol;
            const exchange = state.selectedPosition.exchange;
            
            messagesDiv.innerHTML = `
                <div class="p-3 bg-green-50 border-2 border-green-200 rounded-lg text-sm">
                    <div class="font-bold text-green-800 mb-1">✅ Manual Adjustment</div>
                    <div class="font-mono text-xs space-y-1">
                        <div>[${timestamp}] ${direction} ${exchange}:${symbol}</div>
                        <div>Old Trigger: ₹${oldTrigger.toFixed(2)} → New: ₹${currentTrigger.toFixed(2)} (${points > 0 ? '+' : ''}${points} pts)</div>
                        <div>New Limit: ₹${limitPrice.toFixed(2)}</div>
                        <div>New Order ID: ${data.order_id}</div>
                    </div>
                </div>
            `;
        } else {
            alert('Error modifying order: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function stopTrailing(orderId) {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/cancel-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailStatus').classList.add('hidden');
            document.getElementById('positionMessages').innerHTML = `
                <div class="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                    ⏹️ Trailing stopped and SL order cancelled
                </div>
            `;
        } else {
            alert('Error cancelling order: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function exitPositionImmediately() {
    if (!state.selectedPosition) return;
    
    if (!confirm('Are you sure you want to exit this position immediately at market price?')) {
        return;
    }
    
    const position = state.selectedPosition;
    const isLong = position.quantity > 0;
    
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: isLong ? 'SELL' : 'BUY',
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'MARKET'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const messagesDiv = document.getElementById('positionMessages');
            messagesDiv.innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Exit Order Placed</div>
                    <div class="text-sm text-green-700">
                        Order ID: ${data.order_id}
                    </div>
                </div>
            `;
            
            // Refresh positions after a delay
            setTimeout(loadPositions, 2000);
        } else {
            alert('Error placing exit order: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ===========================================
// CHART MONITOR PAGE
// ===========================================

function setupChartMonitorListeners() {
    document.getElementById('startMonitorBtn').addEventListener('click', startChartMonitor);
    document.getElementById('stopMonitorBtn').addEventListener('click', stopChartMonitor);
    document.getElementById('checkNowBtn').addEventListener('click', checkCandleNow);
    document.getElementById('testEmailBtn').addEventListener('click', testEmail);
}

function addLogEntry(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="text-xs text-gray-500">${timestamp}</span> - ${message}`;
    
    const activityLog = document.getElementById('activityLog');
    activityLog.insertBefore(entry, activityLog.firstChild);
    
    // Keep only last 50 entries
    while (activityLog.children.length > 50) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

async function startChartMonitor() {
    const instrumentToken = document.getElementById('instrumentToken').value;
    const interval = document.getElementById('intervalSelect').value;
    const threshold = document.getElementById('thresholdPercent').value;
    const frequency = parseInt(document.getElementById('checkFrequency').value);

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/start-monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                instrument_token: instrumentToken,
                interval: interval,
                threshold: threshold,
                frequency: frequency
            })
        });

        const data = await response.json();

        if (data.success) {
            state.monitorRunning = true;
            const monitorStatus = document.getElementById('monitorStatus');
            monitorStatus.className = 'monitor-status active';
            monitorStatus.innerHTML = '<div class="pulse bg-green-600"></div><span>Running</span>';
            document.getElementById('startMonitorBtn').classList.add('hidden');
            document.getElementById('stopMonitorBtn').classList.remove('hidden');
            addLogEntry('✅ Monitor started successfully', 'success');
            addLogEntry(`Checking every ${frequency / 60} minutes for candles with body > ${threshold}%`, 'info');
        } else {
            throw new Error(data.error || 'Failed to start monitor');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

async function stopChartMonitor() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/stop-monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            }
        });

        const data = await response.json();

        if (data.success) {
            state.monitorRunning = false;
            const monitorStatus = document.getElementById('monitorStatus');
            monitorStatus.className = 'monitor-status inactive';
            monitorStatus.innerHTML = '<div class="pulse bg-red-600"></div><span>Stopped</span>';
            document.getElementById('startMonitorBtn').classList.remove('hidden');
            document.getElementById('stopMonitorBtn').classList.add('hidden');
            addLogEntry('🛑 Monitor stopped', 'warning');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

async function testEmail() {
    addLogEntry('📧 Sending test email...', 'info');
    const testEmailBtn = document.getElementById('testEmailBtn');
    testEmailBtn.disabled = true;
    testEmailBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            }
        });

        const data = await response.json();

        if (data.success) {
            addLogEntry('✅ Test email sent! Check your inbox', 'success');
        } else {
            throw new Error(data.error || 'Failed to send test email');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    } finally {
        testEmailBtn.disabled = false;
        testEmailBtn.textContent = 'Test Email';
    }
}

async function checkCandleNow() {
    const instrumentToken = document.getElementById('instrumentToken').value;
    const interval = document.getElementById('intervalSelect').value;
    const threshold = document.getElementById('thresholdPercent').value;

    addLogEntry('🔍 Checking candle strength...', 'info');

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/check-candle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                instrument_token: instrumentToken,
                interval: interval,
                threshold: threshold
            })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.result;
            addLogEntry(
                `Body: ${result.body_percent.toFixed(2)}% | ${result.message}`,
                result.alert_sent ? 'success' : 'info'
            );
            if (result.alert_sent) {
                addLogEntry(`📧 Alert email sent`, 'success');
            }
        } else {
            throw new Error(data.error || 'Failed to check candle');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

// Make functions available globally for onclick handlers
window.removeFromBasket = removeFromBasket;
window.adjustTrigger = adjustTrigger;
window.stopTrailing = stopTrailing;
window.stopAutoTrailing = stopAutoTrailing;

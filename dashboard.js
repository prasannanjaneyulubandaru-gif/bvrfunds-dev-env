// Dashboard Module - dashboard.js (Privacy Mode - Clean Version)

const DASHBOARD_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app',
    positionsRefreshInterval: 10000, // 10 seconds
    ordersRefreshInterval: 15000,    // 15 seconds
    pnlRefreshInterval: 3000         // 3 seconds
};

let dashboardState = {
    positionsInterval: null,
    ordersInterval: null,
    pnlInterval: null,
    isInitialized: false,
    privacyMode: false,
    originalData: {
        pnl: null,
        positions: null,
        orders: null
    }
};

function initializeDashboard() {
    console.log('✅ Initializing Dashboard module');
    
    const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
    console.log('User ID:', userId);
    
    if (!userId) {
        console.warn('⚠️ User ID not found in sessionStorage!');
        showDashboardError('Please login to view dashboard');
        return;
    }
    
    const savedPrivacyMode = localStorage.getItem('dashboardPrivacyMode');
    if (savedPrivacyMode === 'true') {
        dashboardState.privacyMode = true;
        updatePrivacyButtonUI();
    }
    
    loadPnlSummary();
    loadDashboardPositions();
    loadDashboardOrders();
    
    startAutoRefresh();
    
    dashboardState.isInitialized = true;
}

function togglePrivacyMode() {
    dashboardState.privacyMode = !dashboardState.privacyMode;
    localStorage.setItem('dashboardPrivacyMode', dashboardState.privacyMode);
    updatePrivacyButtonUI();
    
    if (dashboardState.originalData.pnl) {
        displayPnlSummary(dashboardState.originalData.pnl);
    }
    if (dashboardState.originalData.positions) {
        displayDashboardPositions(
            dashboardState.originalData.positions.net,
            dashboardState.originalData.positions.day
        );
    }
    if (dashboardState.originalData.orders) {
        displayDashboardOrders(dashboardState.originalData.orders);
    }
    
    console.log(`🔐 Privacy mode ${dashboardState.privacyMode ? 'enabled' : 'disabled'}`);
}

function updatePrivacyButtonUI() {
    const toggleBtn = document.getElementById('privacyToggleBtn');
    const icon = document.getElementById('privacyIcon');
    const text = document.getElementById('privacyText');
    
    if (!toggleBtn || !icon || !text) return;
    
    if (dashboardState.privacyMode) {
        toggleBtn.className = 'px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-all hover:scale-105 bg-blue-600 text-white hover:bg-blue-700';
        icon.textContent = '🔒';
        text.textContent = 'Private Mode ON';
    } else {
        toggleBtn.className = 'px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-all hover:scale-105 bg-gray-200 text-gray-700 hover:bg-gray-300';
        icon.textContent = '👁️';
        text.textContent = 'Private Mode OFF';
    }
}

function maskValue(value, type = 'currency') {
    if (!dashboardState.privacyMode) return value;
    
    if (type === 'currency') {
        return '₹***.**';
    } else if (type === 'number') {
        return '****';
    } else if (type === 'symbol') {
        if (!value) return '****';
        return value.charAt(0) + '*'.repeat(Math.max(value.length - 1, 3));
    }
    
    return '****';
}

function startAutoRefresh() {
    if (dashboardState.positionsInterval) clearInterval(dashboardState.positionsInterval);
    if (dashboardState.ordersInterval) clearInterval(dashboardState.ordersInterval);
    if (dashboardState.pnlInterval) clearInterval(dashboardState.pnlInterval);
    
    dashboardState.pnlInterval = setInterval(() => loadPnlSummary(), DASHBOARD_CONFIG.pnlRefreshInterval);
    dashboardState.positionsInterval = setInterval(() => loadDashboardPositions(), DASHBOARD_CONFIG.positionsRefreshInterval);
    dashboardState.ordersInterval = setInterval(() => loadDashboardOrders(), DASHBOARD_CONFIG.ordersRefreshInterval);
    
    console.log('🔄 Auto-refresh started');
}

function stopAutoRefresh() {
    if (dashboardState.positionsInterval) clearInterval(dashboardState.positionsInterval);
    if (dashboardState.ordersInterval) clearInterval(dashboardState.ordersInterval);
    if (dashboardState.pnlInterval) clearInterval(dashboardState.pnlInterval);
    dashboardState.positionsInterval = null;
    dashboardState.ordersInterval = null;
    dashboardState.pnlInterval = null;
    console.log('⏹️ Auto-refresh stopped');
}

async function loadPnlSummary() {
    try {
        const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        
        if (!userId) {
            showPnlError('User session not found');
            return;
        }
        
        const response = await fetch(`${DASHBOARD_CONFIG.backendUrl}/api/dashboard/pnl-summary`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            dashboardState.originalData.pnl = data;
            displayPnlSummary(data);
        } else {
            showPnlError(data.error || 'Failed to load P&L data');
        }
    } catch (error) {
        console.error('❌ P&L Error:', error);
        showPnlError(error.message || 'Network error');
    }
}

function displayPnlSummary(data) {
    const pnlContainer = document.getElementById('dashboardPnlCards');
    if (!pnlContainer) return;
    
    const netPnlColor = data.net_pnl >= 0 ? 'text-green-600' : 'text-red-600';
    const netPnlSign = data.net_pnl >= 0 ? '+' : '';
    const roiColor = data.days_roi >= 0 ? 'text-green-600' : 'text-red-600';
    const roiSign = data.days_roi >= 0 ? '+' : '';
    
    const displayNetPnl = dashboardState.privacyMode ? maskValue(data.net_pnl, 'currency') : `${netPnlSign}₹${data.net_pnl.toFixed(2)}`;
    const displayRoi = `${roiSign}${data.days_roi.toFixed(2)}%`;
    const displayOpeningBalance = dashboardState.privacyMode ? maskValue(data.opening_balance, 'currency') : `₹${data.opening_balance.toFixed(2)}`;
    const displayGrossPnl = dashboardState.privacyMode ? maskValue(data.gross_profit, 'currency') : `₹${data.gross_profit.toFixed(2)}`;
    const displayUnrealisedPnl = dashboardState.privacyMode ? maskValue(data.unrealised_pnl, 'currency') : `₹${data.unrealised_pnl.toFixed(2)}`;
    const displayBrokerage = dashboardState.privacyMode ? maskValue(data.total_brokerage, 'currency') : `₹${data.total_brokerage.toFixed(2)}`;
    const displayOtherCharges = dashboardState.privacyMode ? maskValue(data.other_charges, 'currency') : `₹${data.other_charges.toFixed(2)}`;
    const displayTotalCharges = dashboardState.privacyMode ? maskValue(data.total_charges, 'currency') : `₹${data.total_charges.toFixed(2)}`;
    
    pnlContainer.innerHTML = `
        <div class="bg-white border-2 ${data.net_pnl >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Net P&L</div>
            <div class="text-2xl font-bold ${netPnlColor}">${displayNetPnl}</div>
        </div>
        <div class="bg-white border-2 ${data.days_roi >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Day's ROI</div>
            <div class="text-2xl font-bold ${roiColor}">${displayRoi}</div>
        </div>
        <div class="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Opening Balance</div>
            <div class="text-xl font-bold text-gray-900">${displayOpeningBalance}</div>
        </div>
        <div class="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Gross P&L</div>
            <div class="text-xl font-bold ${data.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}">${displayGrossPnl}</div>
        </div>
        <div class="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Unrealised P&L</div>
            <div class="text-xl font-bold ${data.unrealised_pnl >= 0 ? 'text-blue-600' : 'text-orange-600'}">${displayUnrealisedPnl}</div>
        </div>
        <div class="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Brokerage</div>
            <div class="text-xl font-bold text-red-600">${displayBrokerage}</div>
        </div>
        <div class="bg-white border-2 border-gray-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Other Charges</div>
            <div class="text-xl font-bold text-red-600">${displayOtherCharges}</div>
        </div>
        <div class="bg-white border-2 border-red-200 rounded-lg p-3">
            <div class="text-xs text-gray-600 mb-1">Total Charges</div>
            <div class="text-xl font-bold text-red-700">${displayTotalCharges}</div>
        </div>
    `;
}

function showPnlError(message) {
    const pnlContainer = document.getElementById('dashboardPnlCards');
    if (pnlContainer) {
        pnlContainer.innerHTML = `<p class="text-center text-red-600 py-6 text-sm col-span-full">Error: ${message}</p>`;
    }
}

async function loadDashboardPositions() {
    try {
        const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        if (!userId) return;
        
        const response = await fetch(`${DASHBOARD_CONFIG.backendUrl}/api/dashboard/positions`, {
            method: 'GET',
            headers: { 'X-User-ID': userId, 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            dashboardState.originalData.positions = { net: data.net_positions, day: data.day_positions };
            displayDashboardPositions(data.net_positions, data.day_positions);
        } else {
            showPositionsError(data.error);
        }
    } catch (error) {
        console.error('❌ Positions Error:', error);
        showPositionsError(error.message);
    }
}

function displayDashboardPositions(netPositions, dayPositions) {
    const container = document.getElementById('dashboardPositionsContainer');
    if (!container) return;
    
    let html = '';
    
    if (netPositions && netPositions.length > 0) {
        html += '<div class="mb-4"><h3 class="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>Active Positions</h3>';
        
        netPositions.forEach(pos => {
            const pnlColor = pos.pnl >= 0 ? 'text-green-600' : 'text-red-600';
            const pnlBg = pos.pnl >= 0 ? 'bg-green-50' : 'bg-red-50';
            const pnlBorder = pos.pnl >= 0 ? 'border-green-200' : 'border-red-200';
            const qtyType = pos.quantity > 0 ? 'LONG' : 'SHORT';
            const qtyBadge = pos.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            
            html += `
                <div class="border ${pnlBorder} ${pnlBg} rounded-lg p-2 mb-1.5 hover:shadow-sm transition-all">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-1.5 flex-1 min-w-0">
                            <span class="px-1.5 py-0.5 ${qtyBadge} text-xs font-bold rounded">${qtyType}</span>
                            <span class="font-mono text-xs font-semibold text-gray-900 truncate">${dashboardState.privacyMode ? maskValue(pos.tradingsymbol, 'symbol') : pos.tradingsymbol}</span>
                        </div>
                        <div class="font-bold text-sm ${pnlColor}">${dashboardState.privacyMode ? maskValue(pos.pnl, 'currency') : '₹'+pos.pnl.toFixed(2)}</div>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-600">
                        <div class="flex items-center gap-2">
                            <span><span class="text-gray-500">Qty:</span> <span class="font-semibold">${dashboardState.privacyMode ? maskValue(Math.abs(pos.quantity), 'number') : Math.abs(pos.quantity)}</span></span>
                            <span class="text-gray-400">•</span>
                            <span>${pos.product}</span>
                        </div>
                        <div class="font-mono text-gray-700">${dashboardState.privacyMode ? maskValue(pos.last_price, 'currency') : '₹'+pos.last_price.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (dayPositions && dayPositions.length > 0) {
        html += '<div><h3 class="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1"><span class="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Closed Today</h3>';
        dayPositions.forEach(pos => {
            html += `
                <div class="border border-gray-200 bg-gray-50 rounded-lg p-2 mb-1.5 opacity-60">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="font-mono text-xs font-semibold text-gray-600">${dashboardState.privacyMode ? maskValue(pos.tradingsymbol, 'symbol') : pos.tradingsymbol}</div>
                            <div class="text-xs text-gray-500">${pos.product}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-sm text-gray-600">${dashboardState.privacyMode ? maskValue(pos.pnl, 'currency') : '₹'+pos.pnl.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (netPositions.length === 0 && dayPositions.length === 0) {
        html = '<p class="text-center text-gray-500 py-6 text-sm">No positions found</p>';
    }
    
    container.innerHTML = html;
}

function showPositionsError(error) {
    const container = document.getElementById('dashboardPositionsContainer');
    if (container) container.innerHTML = `<p class="text-center text-red-600 py-6 text-sm">Error: ${error}</p>`;
}

async function loadDashboardOrders() {
    try {
        const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        if (!userId) return;
        
        const response = await fetch(`${DASHBOARD_CONFIG.backendUrl}/api/dashboard/orders`, {
            method: 'GET',
            headers: { 'X-User-ID': userId, 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            dashboardState.originalData.orders = data.orders;
            displayDashboardOrders(data.orders);
        } else {
            showOrdersError(data.error);
        }
    } catch (error) {
        console.error('❌ Orders Error:', error);
        showOrdersError(error.message);
    }
}

function displayDashboardOrders(orders) {
    const container = document.getElementById('dashboardOrdersContainer');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-6 text-sm">No orders found</p>';
        return;
    }
    
    let html = '';
    orders.forEach(order => {
        const statusColor = getOrderStatusColor(order.status);
        const typeColor = order.transaction_type === 'BUY' ? 'text-green-600' : 'text-red-600';
        const typeBg = order.transaction_type === 'BUY' ? 'bg-green-50' : 'bg-red-50';
        
        let timeStr = 'N/A';
        if (order.order_timestamp) {
            try {
                timeStr = new Date(order.order_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            } catch (e) { timeStr = order.order_timestamp; }
        }
        
        html += `
            <div class="border border-gray-200 rounded-lg p-2 mb-1.5 hover:shadow-sm transition-all">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <div class="flex items-center gap-1.5 flex-1 min-w-0">
                        <span class="px-1.5 py-0.5 ${typeBg} ${typeColor} text-xs font-bold rounded">${order.transaction_type === 'BUY' ? 'B' : 'S'}</span>
                        <span class="font-mono text-xs font-bold text-gray-900 truncate">${dashboardState.privacyMode ? maskValue(order.display_symbol, 'symbol') : order.display_symbol}</span>
                    </div>
                    <span class="px-1.5 py-0.5 text-xs font-bold rounded ${statusColor}">${order.status}</span>
                </div>
                <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <div class="flex items-center gap-2">
                        <span><span class="text-gray-500">Qty:</span> <span class="font-semibold">${dashboardState.privacyMode ? maskValue(order.quantity, 'number') : order.quantity || 0}</span></span>
                        <span class="text-gray-400">•</span>
                        <span class="text-green-600 font-semibold">${dashboardState.privacyMode ? maskValue(order.filled_quantity, 'number') : order.filled_quantity || 0}</span>
                    </div>
                    <div class="font-mono text-gray-700">${dashboardState.privacyMode ? maskValue(order.average_price || order.price, 'currency') : (order.average_price ? '₹'+order.average_price : order.price ? '₹'+order.price : '-')}</div>
                </div>
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>${order.product} • ${order.order_type}</span>
                    <span>🕐 ${timeStr}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getOrderStatusColor(status) {
    const colors = {
        'COMPLETE': 'bg-green-100 text-green-700',
        'OPEN': 'bg-blue-100 text-blue-700',
        'PENDING': 'bg-yellow-100 text-yellow-700',
        'CANCELLED': 'bg-gray-100 text-gray-700',
        'REJECTED': 'bg-red-100 text-red-700',
        'TRIGGER PENDING': 'bg-orange-100 text-orange-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
}

function showOrdersError(error) {
    const container = document.getElementById('dashboardOrdersContainer');
    if (container) container.innerHTML = `<p class="text-center text-red-600 py-6 text-sm">Error: ${error}</p>`;
}

function showDashboardError(message) {
    showPnlError(message);
    showPositionsError(message);
    showOrdersError(message);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded');
    
    if (document.getElementById('dashboardPage')) {
        const isDashboardVisible = !document.getElementById('dashboardPage').classList.contains('hidden');
        if (isDashboardVisible) initializeDashboard();
    }
    
    const privacyBtn = document.getElementById('privacyToggleBtn');
    if (privacyBtn) privacyBtn.addEventListener('click', togglePrivacyMode);
});

document.addEventListener('click', function(e) {
    const menuItem = e.target.closest('[data-page="dashboard"]');
    if (menuItem) {
        setTimeout(() => {
            if (!dashboardState.isInitialized) initializeDashboard();
        }, 100);
    }
});

function cleanupDashboard() {
    stopAutoRefresh();
    dashboardState.isInitialized = false;
    console.log('🧹 Dashboard cleaned up');
}

window.DashboardModule = {
    initialize: initializeDashboard,
    cleanup: cleanupDashboard,
    togglePrivacy: togglePrivacyMode,
    refresh: { pnl: loadPnlSummary, positions: loadDashboardPositions, orders: loadDashboardOrders }
};

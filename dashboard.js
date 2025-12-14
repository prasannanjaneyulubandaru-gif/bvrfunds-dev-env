// Dashboard Module - dashboard.js

const DASHBOARD_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app',
    positionsRefreshInterval: 5000, // 5 seconds
    ordersRefreshInterval: 15000    // 15 seconds
};

let dashboardState = {
    positionsInterval: null,
    ordersInterval: null,
    isInitialized: false
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
    
    // Initial load
    loadDashboardPositions();
    loadDashboardOrders();
    
    // Start auto-refresh intervals
    startAutoRefresh();
    
    dashboardState.isInitialized = true;
}

function startAutoRefresh() {
    // Clear existing intervals if any
    if (dashboardState.positionsInterval) {
        clearInterval(dashboardState.positionsInterval);
    }
    if (dashboardState.ordersInterval) {
        clearInterval(dashboardState.ordersInterval);
    }
    
    // Start positions refresh (every 5 seconds)
    dashboardState.positionsInterval = setInterval(() => {
        loadDashboardPositions();
    }, DASHBOARD_CONFIG.positionsRefreshInterval);
    
    // Start orders refresh (every 15 seconds)
    dashboardState.ordersInterval = setInterval(() => {
        loadDashboardOrders();
    }, DASHBOARD_CONFIG.ordersRefreshInterval);
    
    console.log('🔄 Auto-refresh started: Positions (5s), Orders (15s)');
}

function stopAutoRefresh() {
    if (dashboardState.positionsInterval) {
        clearInterval(dashboardState.positionsInterval);
        dashboardState.positionsInterval = null;
    }
    if (dashboardState.ordersInterval) {
        clearInterval(dashboardState.ordersInterval);
        dashboardState.ordersInterval = null;
    }
    console.log('⏹️ Auto-refresh stopped');
}

async function loadDashboardPositions() {
    try {
        const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        
        if (!userId) {
            console.error('❌ userId is null/undefined');
            return;
        }
        
        const response = await fetch(`${DASHBOARD_CONFIG.backendUrl}/api/dashboard/positions`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayDashboardPositions(data.net_positions, data.day_positions, data.total_pnl);
        } else {
            console.error('❌ API Error:', data.error);
            showPositionsError(data.error);
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error);
        showPositionsError(error.message);
    }
}

function displayDashboardPositions(netPositions, dayPositions, totalPnl) {
    const positionsContainer = document.getElementById('dashboardPositionsContainer');
    const totalPnlElement = document.getElementById('dashboardTotalPnl');
    
    if (!positionsContainer || !totalPnlElement) return;
    
    let html = '';
    
    // Display NET positions (active - dark/glowing)
    if (netPositions && netPositions.length > 0) {
        html += '<div class="mb-4"><h3 class="text-sm font-bold text-gray-700 mb-2">Active Positions</h3>';
        
        netPositions.forEach(position => {
            const pnlColor = position.pnl >= 0 ? 'text-green-600' : 'text-red-600';
            const bgColor = position.pnl >= 0 ? 'bg-green-50' : 'bg-red-50';
            const borderColor = position.pnl >= 0 ? 'border-green-200' : 'border-red-200';
            const glowClass = position.pnl >= 0 ? 'shadow-green-glow' : 'shadow-red-glow';
            
            html += `
                <div class="position-card-active border-2 ${borderColor} ${bgColor} ${glowClass} rounded-lg p-3 mb-2 transition-all hover:scale-102">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="font-mono text-sm font-bold text-gray-900">${position.display_symbol}</div>
                            <div class="text-xs text-gray-600 mt-1">
                                <span class="badge badge-sm badge-primary">${position.product}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">P&L</div>
                            <div class="font-bold text-lg ${pnlColor}">₹${position.pnl.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    // Display DAY positions (inactive - grey)
    if (dayPositions && dayPositions.length > 0) {
        html += '<div><h3 class="text-sm font-bold text-gray-400 mb-2">Day Positions (Closed)</h3>';
        
        dayPositions.forEach(position => {
            const pnlColor = position.pnl >= 0 ? 'text-gray-500' : 'text-gray-600';
            
            html += `
                <div class="border-2 border-gray-200 bg-gray-50 rounded-lg p-3 mb-2 opacity-60">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="font-mono text-sm font-semibold text-gray-500">${position.display_symbol}</div>
                            <div class="text-xs text-gray-400 mt-1">
                                <span class="badge badge-sm badge-secondary">${position.product}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-400">P&L</div>
                            <div class="font-bold ${pnlColor}">₹${position.pnl.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    if (netPositions.length === 0 && dayPositions.length === 0) {
        html = '<p class="text-center text-gray-500 py-8">No positions found</p>';
    }
    
    positionsContainer.innerHTML = html;
    
    // Update total PnL in top right corner
    const pnlColor = totalPnl >= 0 ? 'text-green-600' : 'text-red-600';
    const pnlSign = totalPnl >= 0 ? '+' : '';
    totalPnlElement.innerHTML = `
        <div class="text-right">
            <div class="text-xs text-gray-500 mb-1">Total P&L</div>
            <div class="text-2xl font-bold ${pnlColor}">${pnlSign}₹${totalPnl.toFixed(2)}</div>
        </div>
    `;
}

function showPositionsError(error) {
    const positionsContainer = document.getElementById('dashboardPositionsContainer');
    if (positionsContainer) {
        positionsContainer.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${error}</p>`;
    }
}

async function loadDashboardOrders() {
    try {
        const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        
        if (!userId) {
            console.error('❌ userId is null/undefined');
            return;
        }
        
        const response = await fetch(`${DASHBOARD_CONFIG.backendUrl}/api/dashboard/orders`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayDashboardOrders(data.orders);
        } else {
            console.error('❌ API Error:', data.error);
            showOrdersError(data.error);
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error);
        showOrdersError(error.message);
    }
}

function displayDashboardOrders(orders) {
    const ordersContainer = document.getElementById('dashboardOrdersContainer');
    
    if (!ordersContainer) return;
    
    if (!orders || orders.length === 0) {
        ordersContainer.innerHTML = '<p class="text-center text-gray-500 py-8">No orders found</p>';
        return;
    }
    
    let html = '';
    
    orders.forEach(order => {
        const statusColor = getOrderStatusColor(order.status);
        const typeColor = order.transaction_type === 'BUY' ? 'text-green-600' : 'text-red-600';
        const typeBg = order.transaction_type === 'BUY' ? 'bg-green-50' : 'bg-red-50';
        
        // Format timestamp
        let timeStr = 'N/A';
        if (order.order_timestamp) {
            try {
                const date = new Date(order.order_timestamp);
                timeStr = date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (e) {
                timeStr = order.order_timestamp;
            }
        }
        
        html += `
            <div class="border-2 border-gray-200 rounded-lg p-3 mb-2 hover:shadow-md transition-all">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 ${typeBg} ${typeColor} text-xs font-bold rounded">${order.transaction_type}</span>
                            <span class="font-mono text-sm font-bold text-gray-900">${order.display_symbol}</span>
                        </div>
                        <div class="text-xs text-gray-600">
                            <span class="badge badge-sm badge-info">${order.product}</span>
                            <span class="mx-1">•</span>
                            <span>${order.variety}</span>
                            <span class="mx-1">•</span>
                            <span>${order.order_type}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="inline-block px-2 py-1 text-xs font-bold rounded ${statusColor}">${order.status}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                    <div>
                        <span class="text-gray-500">Qty:</span> 
                        <span class="font-semibold">${order.quantity || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Filled:</span> 
                        <span class="font-semibold text-green-600">${order.filled_quantity || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Pending:</span> 
                        <span class="font-semibold text-orange-600">${order.pending_quantity || 0}</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-2">
                    ${order.price ? `<div><span class="text-gray-500">Price:</span> <span class="font-mono">₹${order.price}</span></div>` : '<div></div>'}
                    ${order.trigger_price ? `<div><span class="text-gray-500">Trigger:</span> <span class="font-mono">₹${order.trigger_price}</span></div>` : '<div></div>'}
                    ${order.average_price ? `<div><span class="text-gray-500">Avg:</span> <span class="font-mono">₹${order.average_price}</span></div>` : '<div></div>'}
                </div>
                
                <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <span>🕐 ${timeStr}</span>
                    <span class="font-mono">#${order.order_id}</span>
                </div>
            </div>
        `;
    });
    
    ordersContainer.innerHTML = html;
}

function getOrderStatusColor(status) {
    const statusColors = {
        'COMPLETE': 'bg-green-100 text-green-700',
        'OPEN': 'bg-blue-100 text-blue-700',
        'PENDING': 'bg-yellow-100 text-yellow-700',
        'CANCELLED': 'bg-gray-100 text-gray-700',
        'REJECTED': 'bg-red-100 text-red-700',
        'TRIGGER PENDING': 'bg-orange-100 text-orange-700'
    };
    
    return statusColors[status] || 'bg-gray-100 text-gray-700';
}

function showOrdersError(error) {
    const ordersContainer = document.getElementById('dashboardOrdersContainer');
    if (ordersContainer) {
        ordersContainer.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${error}</p>`;
    }
}

function showDashboardError(message) {
    const positionsContainer = document.getElementById('dashboardPositionsContainer');
    const ordersContainer = document.getElementById('dashboardOrdersContainer');
    
    const errorHtml = `<p class="text-center text-red-600 py-8">${message}</p>`;
    
    if (positionsContainer) positionsContainer.innerHTML = errorHtml;
    if (ordersContainer) ordersContainer.innerHTML = errorHtml;
}

// Initialize when dashboard page becomes visible
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded');
    
    // Check if dashboard page exists
    if (document.getElementById('dashboardPage')) {
        console.log('✅ Dashboard page detected');
        
        // Initialize immediately if already on dashboard
        const isDashboardVisible = !document.getElementById('dashboardPage').classList.contains('hidden');
        if (isDashboardVisible) {
            initializeDashboard();
        }
    }
});

// Listen for page navigation to dashboard
document.addEventListener('click', function(e) {
    const menuItem = e.target.closest('[data-page="dashboard"]');
    if (menuItem) {
        // Small delay to ensure page is visible
        setTimeout(() => {
            if (!dashboardState.isInitialized) {
                initializeDashboard();
            }
        }, 100);
    }
});

// Clean up intervals when leaving dashboard
function cleanupDashboard() {
    stopAutoRefresh();
    dashboardState.isInitialized = false;
    console.log('🧹 Dashboard cleaned up');
}

// Export for external use if needed
window.DashboardModule = {
    initialize: initializeDashboard,
    cleanup: cleanupDashboard,
    refresh: {
        positions: loadDashboardPositions,
        orders: loadDashboardOrders
    }
};

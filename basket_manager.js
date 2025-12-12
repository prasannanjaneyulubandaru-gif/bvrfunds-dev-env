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

// ===========================================
// BASKET MANAGEMENT
// ===========================================

function addOrderToBasket(order) {
    console.log('Adding order to basket:', order);
    
    // Validate order
    if (!order.tradingsymbol || !order.transaction_type || !order.lots) {
        console.error('Invalid order:', order);
        return false;
    }
    
    // Check if order already exists
    const existingIndex = basketState.orders.findIndex(
        o => o.tradingsymbol === order.tradingsymbol && o.transaction_type === order.transaction_type
    );
    
    if (existingIndex >= 0) {
        // Update existing order
        basketState.orders[existingIndex] = order;
        console.log('Updated existing order in basket');
    } else {
        // Add new order
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
    if (removed) {
        console.log('Removed order from basket:', tradingsymbol, transactionType);
    }
    return removed;
}

function clearBasket() {
    basketState.orders = [];
    basketState.marginRequired = 0;
    basketState.deploymentResults = [];
    console.log('Basket cleared');
}

function getBasketOrders() {
    return [...basketState.orders];
}

function getBasketCount() {
    return basketState.orders.length;
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
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                orders: basketState.orders
            })
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
            
            console.log('Margin check result:', marginInfo);
            
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
// ORDER DEPLOYMENT
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
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                orders: basketState.orders
            })
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
            
            console.log('Deployment complete:', summary);
            
            if (onComplete) onComplete(summary);
            
            // Clear basket after successful deployment
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

// ===========================================
// ORDER STATUS
// ===========================================

async function getOrderStatus(orderId, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/order-status/${orderId}`, {
            headers: {
                'X-User-ID': userId
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data);
            return data;
        } else {
            throw new Error(data.error || 'Failed to get order status');
        }
    } catch (error) {
        console.error('Order status error:', error);
        if (onError) onError(error.message);
        return null;
    }
}

async function getBatchOrderStatus(orderIds, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/orders-status/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                order_ids: orderIds
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data.results);
            return data.results;
        } else {
            throw new Error(data.error || 'Failed to get batch order status');
        }
    } catch (error) {
        console.error('Batch order status error:', error);
        if (onError) onError(error.message);
        return null;
    }
}

// ===========================================
// UI HELPERS
// ===========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
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
        'COMPLETE': '✓',
        'REJECTED': '✗',
        'CANCELLED': '⊘',
        'PENDING': '⏱',
        'OPEN': '◷',
        'TRIGGER PENDING': '⚡'
    };
    
    return iconMap[status] || '•';
}

// Export functions for use in other modules
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
    state: basketState
};

console.log('Basket Manager initialized');

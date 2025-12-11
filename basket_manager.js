// =========================================================
// UNIFIED BASKET MANAGER
// Centralized order basket management for both manual orders and strategies
// Requires: shared_config.js, utils.js
// =========================================================

/**
 * Unified Basket Manager Class
 * Handles order basket for both Place Orders and Strategy Deployment
 */
class BasketManager {
    constructor(displayContainerId = null) {
        this.orders = [];
        this.displayContainerId = displayContainerId;
    }
    
    /**
     * Set the container where basket should be displayed
     * @param {string} containerId - Container element ID
     */
    setDisplayContainer(containerId) {
        this.displayContainerId = containerId;
    }
    
    /**
     * Add order to basket
     * @param {Object} order - Order object
     */
    add(order) {
        this.orders.push(order);
        this.display();
        return this.orders.length - 1; // Return index
    }
    
    /**
     * Remove order from basket by index
     * @param {number} index - Order index
     */
    remove(index) {
        if (index >= 0 && index < this.orders.length) {
            this.orders.splice(index, 1);
            this.display();
        }
    }
    
    /**
     * Clear all orders from basket
     */
    clear() {
        this.orders = [];
        this.display();
    }
    
    /**
     * Get all orders in basket
     * @returns {Array} Array of order objects
     */
    getOrders() {
        return [...this.orders];
    }
    
    /**
     * Check if basket is empty
     * @returns {boolean} True if empty
     */
    isEmpty() {
        return this.orders.length === 0;
    }
    
    /**
     * Get basket size
     * @returns {number} Number of orders
     */
    size() {
        return this.orders.length;
    }
    
    /**
     * Display basket in UI
     */
    display() {
        if (!this.displayContainerId) {
            console.warn('Basket display container not set');
            return;
        }
        
        const container = document.getElementById(this.displayContainerId);
        if (!container) {
            console.error(`Basket container "${this.displayContainerId}" not found`);
            return;
        }
        
        if (this.isEmpty()) {
            container.innerHTML = '<div class="text-center text-gray-500 py-8">Basket is empty</div>';
            return;
        }
        
        let html = '<div class="space-y-2">';
        
        this.orders.forEach((order, index) => {
            html += this.renderOrderItem(order, index);
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * Render a single order item
     * @param {Object} order - Order object
     * @param {number} index - Order index
     * @returns {string} HTML string
     */
    renderOrderItem(order, index) {
        const sideClass = order.transaction_type === 'BUY' ? 'badge-buy' : 'badge-sell';
        
        let priceInfo = '';
        if (order.price) priceInfo += ` @ ₹${order.price.toFixed(2)}`;
        if (order.trigger_price) priceInfo += ` (Trigger: ₹${order.trigger_price.toFixed(2)})`;
        
        // For strategy orders, show lots instead of quantity
        const qtyDisplay = order.lots 
            ? `${order.lots} lot${order.lots > 1 ? 's' : ''} (${order.quantity} qty)`
            : order.quantity;
        
        return `
            <div class="order-basket-item">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="badge badge-info">${order.exchange}</span>
                        <span class="font-semibold mono">${order.tradingsymbol}</span>
                        <span class="badge ${sideClass}">${order.transaction_type}</span>
                        <span class="badge badge-info">${qtyDisplay}</span>
                        ${order.order_type ? `<span class="badge badge-info">${order.order_type}</span>` : ''}
                        ${order.product ? `<span class="badge badge-info">${order.product}</span>` : ''}
                        ${priceInfo ? `<span class="text-sm text-gray-600">${priceInfo}</span>` : ''}
                    </div>
                    <button onclick="basketManager.remove(${index})" class="text-red-600 hover:text-red-700 font-semibold text-sm px-3 py-1">
                        Remove
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Check margin for basket orders
     * @returns {Promise<Object>} Margin data from API
     */
    async checkMargin() {
        if (this.isEmpty()) {
            throw new Error('Basket is empty');
        }
        
        return await apiCall('/api/basket-margin', { orders: this.orders }, 'POST');
    }
    
    /**
     * Place all orders in basket
     * @returns {Promise<Object>} Placement results
     */
    async placeOrders() {
        if (this.isEmpty()) {
            throw new Error('Basket is empty');
        }
        
        return await apiCall('/api/place-basket-orders', { orders: this.orders }, 'POST');
    }
    
    /**
     * Deploy basket for strategy (alternative endpoint)
     * @returns {Promise<Object>} Deployment results
     */
    async deployStrategy() {
        if (this.isEmpty()) {
            throw new Error('Basket is empty');
        }
        
        return await apiCall('/api/strategy/deploy-basket', { orders: this.orders }, 'POST');
    }
    
    /**
     * Export basket as JSON
     * @returns {string} JSON string
     */
    exportJSON() {
        return JSON.stringify(this.orders, null, 2);
    }
    
    /**
     * Import basket from JSON
     * @param {string} jsonString - JSON string
     */
    importJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (Array.isArray(imported)) {
                this.orders = imported;
                this.display();
            } else {
                throw new Error('Invalid JSON format');
            }
        } catch (error) {
            console.error('Error importing basket:', error);
            throw error;
        }
    }
}

// Create global basket manager instance
const basketManager = new BasketManager();

// For backward compatibility, also create strategyBasket variable
let strategyBasket = {
    _manager: new BasketManager(),
    
    get length() {
        return this._manager.size();
    },
    
    push(order) {
        return this._manager.add(order);
    },
    
    splice(index, count) {
        if (count === 1) {
            this._manager.remove(index);
        }
    },
    
    // Expose manager methods
    clear() {
        this._manager.clear();
    },
    
    getOrders() {
        return this._manager.getOrders();
    }
};

// Export to global scope
window.BasketManager = BasketManager;
window.basketManager = basketManager;
window.strategyBasket = strategyBasket;

console.log('✅ Unified basket manager loaded');

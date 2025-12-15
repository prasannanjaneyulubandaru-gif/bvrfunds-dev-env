// FIXED Manage Positions Module - manage_positions.js

// Use the global CONFIG object (defined in login.js)
const MANAGE_POSITIONS_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupManagePositionsListeners();
});

// ===========================================
// MANAGE POSITIONS PAGE
// ===========================================

function setupManagePositionsListeners() {
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    const trailSlBtn = document.getElementById('trailSlBtn');
    const exitBtn = document.getElementById('exitImmediatelyBtn');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPositions);
    }
    if (trailSlBtn) {
        trailSlBtn.addEventListener('click', showTrailSlConfig);
    }
    if (exitBtn) {
        exitBtn.addEventListener('click', exitPositionImmediately);
    }
    
    console.log('Manage Positions listeners setup complete');
}

async function loadPositions() {
    const positionsList = document.getElementById('positionsList');
    if (!positionsList) return;
    
    positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Loading positions...</div>';
    
    try {
        // Use the global state object
        if (!window.state || !window.state.userId) {
            positionsList.innerHTML = '<div class="text-center text-red-500 py-8">Please login first</div>';
            return;
        }
        
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            headers: { 'X-User-ID': window.state.userId }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPositions(data.positions);
        } else {
            positionsList.innerHTML = `<div class="text-center text-red-500 py-8">Error: ${data.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading positions:', error);
        positionsList.innerHTML = '<div class="text-center text-red-500 py-8">Error loading positions</div>';
    }
}

function displayPositions(positions) {
    const positionsList = document.getElementById('positionsList');
    if (!positionsList) return;
    
    if (positions.length === 0) {
        positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">No open positions</div>';
        return;
    }
    
    positionsList.innerHTML = '';
    
    positions.forEach(position => {
        const positionCard = document.createElement('div');
        positionCard.className = 'border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-orange-500 transition-all';
        positionCard.dataset.position = JSON.stringify(position);
        
        const isLong = position.quantity > 0;
        const sideColor = isLong ? 'text-green-600' : 'text-red-600';
        const side = isLong ? 'LONG' : 'SHORT';
        
        positionCard.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <div class="font-bold text-lg">
                        <span class="font-mono">${position.exchange}:${position.tradingsymbol}</span>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        <span class="${sideColor} font-semibold">${side} ${Math.abs(position.quantity)}</span>
                        <span class="mx-2">@</span>
                        <span>₹${position.averageprice.toFixed(2)}</span>
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
        
        positionCard.addEventListener('click', () => selectPosition(position, positionCard));
        
        positionsList.appendChild(positionCard);
    });
}

function selectPosition(position, cardElement) {
    // Store in global state
    if (!window.state) {
        window.state = {};
    }
    window.state.selectedPosition = position;
    
    // Update UI - remove selection from all cards
    document.querySelectorAll('#positionsList > div').forEach(card => {
        card.classList.remove('border-orange-500', 'bg-orange-50');
    });
    
    // Add selection to clicked card
    cardElement.classList.add('border-orange-500', 'bg-orange-50');
    
    // Show actions panel
    const actionsPanel = document.getElementById('positionActionsPanel');
    if (actionsPanel) {
        actionsPanel.classList.remove('hidden');
    }
    
    const isLong = position.quantity > 0;
    const sideColor = isLong ? 'text-green-600' : 'text-red-600';
    const side = isLong ? 'LONG' : 'SHORT';
    
    const selectedInfo = document.getElementById('selectedPositionInfo');
    if (selectedInfo) {
        selectedInfo.innerHTML = `
            <div class="p-4 bg-yellow-50 rounded-lg">
                <div class="font-bold text-lg">
                    ${position.exchange}:${position.tradingsymbol}
                </div>
                <div class="mt-2 text-sm">
                    <span class="${sideColor} font-semibold">${side} ${Math.abs(position.quantity)}</span>
                    <span class="mx-2">@</span>
                    <span>₹${position.averageprice.toFixed(2)}</span>
                    <span class="ml-3 badge badge-info">${position.product}</span>
                </div>
            </div>
        `;
    }
    
    // Hide trailing config
    const trailConfig = document.getElementById('trailSlConfig');
    const trailStatus = document.getElementById('trailStatus');
    if (trailConfig) trailConfig.classList.add('hidden');
    if (trailStatus) trailStatus.classList.add('hidden');
}

function showTrailSlConfig() {
    if (!window.state || !window.state.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    const configDiv = document.getElementById('trailSlConfig');
    const contentDiv = document.getElementById('trailConfigContent');
    
    if (!configDiv || !contentDiv) return;
    
    const isLong = window.state.selectedPosition.quantity > 0;
    const avgPrice = window.state.selectedPosition.averageprice;
    
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
                <button id="startTrailBtn" class="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg">
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
    
    // Add event listeners for the buttons
    setTimeout(() => {
        const startTrailBtn = document.getElementById('startTrailBtn');
        const startAutoTrailBtn = document.getElementById('startAutoTrailBtn');
        
        if (startTrailBtn) {
            startTrailBtn.addEventListener('click', startTrailing);
        }
        if (startAutoTrailBtn) {
            startAutoTrailBtn.addEventListener('click', startAutoTrailing);
        }
    }, 100);
}

async function startTrailing() {
    if (!window.state || !window.state.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const position = window.state.selectedPosition;
    const isLong = position.quantity > 0;
    const avgPrice = position.averageprice;
    
    // Calculate initial trigger price
    let triggerPrice = isLong ? avgPrice - trailPoints : avgPrice + trailPoints;
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
    
    // Calculate limit price with 5% buffer
    const bufferPercent = 0.05;
    let limitPrice;
    if (isLong) {
        limitPrice = triggerPrice * (1 - bufferPercent);
    } else {
        limitPrice = triggerPrice * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
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
        
        const data = await response.json();
        
        if (data.success) {
            const messagesDiv = document.getElementById('positionMessages');
            if (messagesDiv) {
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
            }
            
            showManualTrailControls(data.order_id, triggerPrice, limitPrice, trailPoints);
        } else {
            alert('Error placing SL order: ' + data.error);
        }
    } catch (error) {
        console.error('Error starting trail:', error);
        alert('Error: ' + error.message);
    }
}

async function startAutoTrailing() {
    alert('Auto trailing functionality requires WebSocket setup. Please implement the WebSocket connection first.');
}

function showManualTrailControls(orderId, currentTrigger, currentLimit, trailPoints) {
    const statusDiv = document.getElementById('trailStatus');
    const contentDiv = document.getElementById('trailStatusContent');
    
    if (!statusDiv || !contentDiv) return;
    
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
    if (!statusDiv) return;
    
    const orderId = statusDiv.dataset.orderId;
    let currentTrigger = parseFloat(statusDiv.dataset.currentTrigger);
    
    const oldTrigger = currentTrigger;
    currentTrigger += points;
    currentTrigger = Math.round(currentTrigger / 0.05) * 0.05;
    
    const position = window.state.selectedPosition;
    const isLong = position.quantity > 0;
    const bufferPercent = 0.05;
    
    let limitPrice;
    if (isLong) {
        limitPrice = currentTrigger * (1 - bufferPercent);
    } else {
        limitPrice = currentTrigger * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/modify-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular',
                trigger_price: currentTrigger,
                price: limitPrice,
                order_type: 'SL',
                quantity: Math.abs(position.quantity)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.dataset.orderId = data.order_id;
            statusDiv.dataset.currentTrigger = currentTrigger;
            statusDiv.dataset.currentLimit = limitPrice;
            
            const triggerEl = document.getElementById('currentTrigger');
            const limitEl = document.getElementById('currentLimit');
            if (triggerEl) triggerEl.textContent = currentTrigger.toFixed(2);
            if (limitEl) limitEl.textContent = limitPrice.toFixed(2);
            
            const messagesDiv = document.getElementById('positionMessages');
            if (messagesDiv) {
                const timestamp = new Date().toLocaleTimeString();
                const direction = points > 0 ? '⬆️ RAISED' : '⬇️ LOWERED';
                
                messagesDiv.innerHTML = `
                    <div class="p-3 bg-green-50 border-2 border-green-200 rounded-lg text-sm">
                        <div class="font-bold text-green-800 mb-1">✅ Manual Adjustment</div>
                        <div class="font-mono text-xs space-y-1">
                            <div>[${timestamp}] ${direction} ${position.exchange}:${position.tradingsymbol}</div>
                            <div>Old Trigger: ₹${oldTrigger.toFixed(2)} → New: ₹${currentTrigger.toFixed(2)} (${points > 0 ? '+' : ''}${points} pts)</div>
                            <div>New Limit: ₹${limitPrice.toFixed(2)}</div>
                            <div>New Order ID: ${data.order_id}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            alert('Error modifying order: ' + data.error);
        }
    } catch (error) {
        console.error('Error adjusting trigger:', error);
        alert('Error: ' + error.message);
    }
}

async function stopTrailing(orderId) {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/cancel-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const trailStatus = document.getElementById('trailStatus');
            if (trailStatus) {
                trailStatus.classList.add('hidden');
            }
            
            const messagesDiv = document.getElementById('positionMessages');
            if (messagesDiv) {
                messagesDiv.innerHTML = `
                    <div class="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                        ℹ️ Trailing stopped and SL order cancelled
                    </div>
                `;
            }
        } else {
            alert('Error cancelling order: ' + data.error);
        }
    } catch (error) {
        console.error('Error stopping trail:', error);
        alert('Error: ' + error.message);
    }
}

async function exitPositionImmediately() {
    if (!window.state || !window.state.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    if (!confirm('Are you sure you want to exit this position immediately at market price?')) {
        return;
    }
    
    const position = window.state.selectedPosition;
    const isLong = position.quantity > 0;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
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
            if (messagesDiv) {
                messagesDiv.innerHTML = `
                    <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                        <div class="font-bold text-green-800 mb-2">✅ Exit Order Placed</div>
                        <div class="text-sm text-green-700">
                            Order ID: ${data.order_id}
                        </div>
                    </div>
                `;
            }
            
            // Refresh positions after a delay
            setTimeout(loadPositions, 2000);
        } else {
            alert('Error placing exit order: ' + data.error);
        }
    } catch (error) {
        console.error('Error exiting position:', error);
        alert('Error: ' + error.message);
    }
}

// Make functions globally accessible
window.adjustTrigger = adjustTrigger;
window.stopTrailing = stopTrailing;

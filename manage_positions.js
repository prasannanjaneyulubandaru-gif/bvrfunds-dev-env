// FIXED Manage Positions Module - manage_positions.js

const MANAGE_POSITIONS_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// State management
const positionsState = {
    userId: null,
    selectedPosition: null,
    autoTrailInterval: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    positionsState.userId = sessionStorage.getItem('user_id');
    setupManagePositionsListeners();
    loadPositions();
});

// ===========================================
// MANAGE POSITIONS PAGE
// ===========================================

function setupManagePositionsListeners() {
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    const trailBtn = document.getElementById('trailSlBtn');
    const exitBtn = document.getElementById('exitImmediatelyBtn');
    
    if (refreshBtn) refreshBtn.addEventListener('click', loadPositions);
    if (trailBtn) trailBtn.addEventListener('click', showTrailSlConfig);
    if (exitBtn) exitBtn.addEventListener('click', exitPositionImmediately);
}

async function loadPositions() {
    const positionsList = document.getElementById('positionsList');
    positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Loading positions...</div>';
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            headers: { 'X-User-ID': positionsState.userId }
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayPositions(data.positions);
        } else {
            positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Error loading positions</div>';
        }
    } catch (error) {
        console.error('Error loading positions:', error);
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
        
        positionCard.addEventListener('click', () => selectPosition(position, positionCard));
        
        positionsList.appendChild(positionCard);
    });
}

function selectPosition(position, cardElement) {
    positionsState.selectedPosition = position;
    
    // Update UI
    document.querySelectorAll('.position-card').forEach(card => {
        card.classList.remove('selected');
    });
    cardElement.classList.add('selected');
    
    // Show actions panel
    const actionsPanel = document.getElementById('positionActionsPanel');
    actionsPanel.classList.remove('hidden');
    
    // Hide no selection message
    const noSelectionMsg = document.getElementById('noSelectionMessage');
    if (noSelectionMsg) {
        noSelectionMsg.classList.add('hidden');
    }
    
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
    
    // Hide trailing config and status
    document.getElementById('trailSlConfig').classList.add('hidden');
    document.getElementById('trailStatus').classList.add('hidden');
    document.getElementById('positionMessages').innerHTML = '';
}

function showTrailSlConfig() {
    if (!positionsState.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    const configDiv = document.getElementById('trailSlConfig');
    const contentDiv = document.getElementById('trailConfigContent');
    
    const isLong = positionsState.selectedPosition.quantity > 0;
    const avgPrice = positionsState.selectedPosition.average_price;
    
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
                <button id="startAutoTrailBtn" class="btn-primary text-white font-semibold px-8 py-3 rounded-lg">
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
    setTimeout(() => {
        const startBtn = document.getElementById('startTrailBtn');
        const autoBtn = document.getElementById('startAutoTrailBtn');
        if (startBtn) startBtn.addEventListener('click', startTrailing);
        if (autoBtn) autoBtn.addEventListener('click', startAutoTrailing);
    }, 100);
}

async function startTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    
    if (isNaN(trailPoints) || trailPoints <= 0) {
        alert('Please enter a valid trail points value');
        return;
    }
    
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    
    let triggerPrice;
    if (isLong) {
        triggerPrice = position.average_price - trailPoints;
    } else {
        triggerPrice = position.average_price + trailPoints;
    }
    
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
    
    const bufferPercent = 0.05;
    let limitPrice;
    if (isLong) {
        limitPrice = triggerPrice * (1 - bufferPercent);
    } else {
        limitPrice = triggerPrice * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    const transactionType = isLong ? 'SELL' : 'BUY';
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: transactionType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'SL',
                trigger_price: triggerPrice,
                price: limitPrice,
                variety: 'regular'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailSlConfig').classList.add('hidden');
            showManualTrailControls(data.order_id, triggerPrice, limitPrice, trailPoints);
            
            const messagesDiv = document.getElementById('positionMessages');
            messagesDiv.innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Manual Trail SL Placed</div>
                    <div class="text-sm space-y-1">
                        <div>Order ID: ${data.order_id}</div>
                        <div>Trigger: ₹${triggerPrice.toFixed(2)}</div>
                        <div>Limit: ₹${limitPrice.toFixed(2)}</div>
                        <div>Trail Points: ${trailPoints}</div>
                    </div>
                </div>
            `;
        } else {
            alert('Error placing order: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function startAutoTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    
    if (isNaN(trailPoints) || trailPoints <= 0) {
        alert('Please enter a valid trail points value');
        return;
    }
    
    const position = positionsState.selectedPosition;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                quantity: position.quantity,
                average_price: position.average_price,
                product: position.product,
                trail_points: trailPoints
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailSlConfig').classList.add('hidden');
            showAutoTrailStatus(data);
            startAutoTrailPolling();
        } else {
            alert('Error starting auto trail: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function showAutoTrailStatus(data) {
    const statusDiv = document.getElementById('trailStatus');
    const contentDiv = document.getElementById('trailStatusContent');
    
    const positionKey = `${data.position.exchange}:${data.position.tradingsymbol}`;
    
    contentDiv.innerHTML = `
        <div class="space-y-4">
            <div class="p-4 bg-green-50 rounded-lg">
                <div class="text-sm text-gray-600 mb-1">Status</div>
                <div class="text-lg font-bold text-green-600">🤖 Auto Trailing Active</div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-blue-50 rounded-lg">
                    <div class="text-sm text-gray-600 mb-1">Current LTP</div>
                    <div class="text-xl font-bold text-blue-600" id="autoTrailLTP">₹${data.current_ltp.toFixed(2)}</div>
                </div>
                <div class="p-4 bg-yellow-50 rounded-lg">
                    <div class="text-sm text-gray-600 mb-1">Highest/Lowest</div>
                    <div class="text-xl font-bold text-yellow-600" id="autoTrailPeak">₹${data.peak_price.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="p-4 bg-purple-50 rounded-lg">
                <div class="text-sm text-gray-600 mb-1">Current SL Trigger</div>
                <div class="text-2xl font-bold text-purple-600" id="autoTrailTrigger">₹${data.trigger_price.toFixed(2)}</div>
            </div>
            
            <button onclick="stopAutoTrailing('${positionKey}')" class="w-full btn-danger text-white font-semibold px-6 py-3 rounded-lg">
                ⏹️ Stop Auto Trailing
            </button>
            
            <div id="autoTrailLogs" class="mt-4 p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto font-mono text-xs">
                <div class="text-gray-500">Monitoring...</div>
            </div>
        </div>
    `;
    
    statusDiv.classList.remove('hidden');
}

function startAutoTrailPolling() {
    if (positionsState.autoTrailInterval) {
        clearInterval(positionsState.autoTrailInterval);
    }
    
    positionsState.autoTrailInterval = setInterval(async () => {
        await updateAutoTrailStatus();
    }, 2000);
}

async function updateAutoTrailStatus() {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/auto-trail-status`, {
            headers: { 'X-User-ID': positionsState.userId }
        });
        
        const data = await response.json();
        
        if (data.success && data.status) {
            const ltpEl = document.getElementById('autoTrailLTP');
            const peakEl = document.getElementById('autoTrailPeak');
            const triggerEl = document.getElementById('autoTrailTrigger');
            const logsEl = document.getElementById('autoTrailLogs');
            
            if (ltpEl) ltpEl.textContent = `₹${data.status.current_ltp.toFixed(2)}`;
            if (peakEl) peakEl.textContent = `₹${data.status.peak_price.toFixed(2)}`;
            if (triggerEl) triggerEl.textContent = `₹${data.status.trigger_price.toFixed(2)}`;
            
            if (logsEl && data.logs && data.logs.length > 0) {
                updateTrailLogs(data);
            }
        }
    } catch (error) {
        console.error('Error updating auto trail status:', error);
    }
}

function updateTrailLogs(data) {
    const logDiv = document.getElementById('autoTrailLogs');
    if (!logDiv) return;
    
    let html = '';
    
    if (data.logs && data.logs.length > 0) {
        html = '<div class="space-y-1">';
        for (const log of data.logs.slice(-10)) {
            const time = new Date(log.timestamp).toLocaleTimeString();
            html += `<div class="text-xs text-gray-300">[${time}] ${log.msg}</div>`;
        }
        html += '</div>';
    }
    
    if (html === '') {
        html = '<div class="text-gray-500">No active trailing positions</div>';
    }
    
    logDiv.innerHTML = html;
    logDiv.parentElement.scrollTop = logDiv.parentElement.scrollHeight;
}

async function stopAutoTrailing(positionKey) {
    try {
        if (positionsState.autoTrailInterval) {
            clearInterval(positionsState.autoTrailInterval);
            positionsState.autoTrailInterval = null;
        }
        
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/stop-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
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
        console.error('Error:', error);
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
    
    const position = positionsState.selectedPosition;
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
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular',
                trigger_price: currentTrigger,
                price: limitPrice,
                order_type: 'SL',
                quantity: Math.abs(positionsState.selectedPosition.quantity)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.dataset.orderId = data.order_id;
            statusDiv.dataset.currentTrigger = currentTrigger;
            statusDiv.dataset.currentLimit = limitPrice;
            document.getElementById('currentTrigger').textContent = currentTrigger.toFixed(2);
            document.getElementById('currentLimit').textContent = limitPrice.toFixed(2);
            
            const messagesDiv = document.getElementById('positionMessages');
            const timestamp = new Date().toLocaleTimeString();
            const direction = points > 0 ? '⬆️ RAISED' : '⬇️ LOWERED';
            const symbol = positionsState.selectedPosition.tradingsymbol;
            const exchange = positionsState.selectedPosition.exchange;
            
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
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function stopTrailing(orderId) {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/cancel-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
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
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function exitPositionImmediately() {
    if (!positionsState.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    const position = positionsState.selectedPosition;
    const confirmation = confirm(`Exit ${position.tradingsymbol} immediately at market price?`);
    
    if (!confirmation) return;
    
    const transactionType = position.quantity > 0 ? 'SELL' : 'BUY';
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: transactionType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'MARKET',
                variety: 'regular'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('positionMessages').innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Position Exited</div>
                    <div class="text-sm">
                        Order ID: ${data.order_id}<br>
                        ${position.tradingsymbol} exited at market price
                    </div>
                </div>
            `;
            
            // Refresh positions after 2 seconds
            setTimeout(() => {
                loadPositions();
            }, 2000);
        } else {
            alert('Error exiting position: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

// Make functions globally available
window.adjustTrigger = adjustTrigger;
window.stopTrailing = stopTrailing;
window.stopAutoTrailing = stopAutoTrailing;

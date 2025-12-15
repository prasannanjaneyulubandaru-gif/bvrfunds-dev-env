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
    positionsState.selectedPosition = position;
    
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
    if (!positionsState.selectedPosition) return;
    
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
    document.getElementById('startTrailBtn').addEventListener('click', startTrailing);
    document.getElementById('startAutoTrailBtn').addEventListener('click', startAutoTrailing);
}

async function startTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    const avgPrice = position.average_price;
    
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
                'X-User-ID': positionsState.userId
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
            
            showManualTrailControls(data.order_id, triggerPrice, limitPrice, trailPoints);
        } else {
            alert('Error placing SL order: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function startAutoTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    const avgPrice = position.average_price;
    
    let triggerPrice = isLong ? avgPrice - trailPoints : avgPrice + trailPoints;
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
    
    let limitPrice;
    if (isLong) {
        limitPrice = triggerPrice - trailPoints;
    } else {
        limitPrice = triggerPrice + trailPoints;
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        const placeResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
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
        
        const instrumentToken = await getInstrumentToken(position.exchange, position.tradingsymbol);
        
        if (!instrumentToken) {
            alert('Could not find instrument token');
            return;
        }
        
        const trailResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
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
            
            showAutoTrailControls(trailData.position_key, triggerPrice, limitPrice);
        } else {
            alert('Error starting auto trail: ' + trailData.error);
        }
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function getInstrumentToken(exchange, tradingsymbol) {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/get-instrument-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
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
    
    if (positionsState.autoTrailInterval) {
        clearInterval(positionsState.autoTrailInterval);
    }
    
    positionsState.autoTrailInterval = setInterval(() => {
        fetchAutoTrailStatus();
    }, 2000);
}

async function fetchAutoTrailStatus() {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/get-trail-status`, {
            method: 'GET',
            headers: {
                'X-User-ID': positionsState.userId
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
    
    if (logs && logs.length > 0) {
        html += '<div class="border-t border-gray-700 my-2 pt-2">';
        html += '<div class="text-gray-400 text-xs mb-1">Recent Updates:</div>';
        
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
        alert('Error: ' + error.message);

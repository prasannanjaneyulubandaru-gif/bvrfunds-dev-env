// Complete Manage Positions Module - manage_positions.js
// Copy this entire file and save as manage_positions.js in your project root

const MANAGE_POSITIONS_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

let managePositionsState = {
    selectedPosition: null,
    autoTrailInterval: null,
    trailingPositions: {},
    isAutoTrailing: false,
    allPositions: []
};

function initializeManagePositions() {
    console.log('Initializing Manage Positions module');
    setupManagePositionsListeners();
}

function setupManagePositionsListeners() {
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPositions);
    }

    const positionSelect = document.getElementById('positionSelect');
    if (positionSelect) {
        positionSelect.addEventListener('change', (e) => {
            const selectedSymbol = e.target.value;
            if (selectedSymbol) {
                const positions = document.querySelectorAll('.position-card');
                positions.forEach(card => {
                    if (card.dataset.symbol === selectedSymbol) {
                        selectPosition(card);
                    }
                });
            }
        });
    }

    const setupTrailingBtn = document.getElementById('setupTrailingBtn');
    if (setupTrailingBtn) {
        setupTrailingBtn.addEventListener('click', showTrailingOptions);
    }

    const exitPositionBtn = document.getElementById('exitPositionBtn');
    if (exitPositionBtn) {
        exitPositionBtn.addEventListener('click', exitPositionImmediately);
    }

    const reversePositionBtn = document.getElementById('reversePositionBtn');
    if (reversePositionBtn) {
        reversePositionBtn.addEventListener('click', reversePosition);
    }

    const stopTrailingBtn = document.getElementById('stopTrailingBtn');
    if (stopTrailingBtn) {
        stopTrailingBtn.addEventListener('click', stopAutoTrailing);
    }

    loadPositions();
}

async function loadPositions() {
    try {
        const positionsList = document.getElementById('positionsList');
        positionsList.innerHTML = '<p class="text-center text-gray-500 py-8">Loading positions...</p>';

        const userId = sessionStorage.getItem('userid');
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            headers: {
                'X-User-ID': userId
            }
        });

        const data = await response.json();

        if (data.success) {
            managePositionsState.allPositions = data.positions;
            displayPositions(data.positions);
            updatePositionSelect(data.positions);
        } else {
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error loading positions: ${data.error}</p>`;
        }
    } catch (error) {
        console.error('Error loading positions:', error);
        document.getElementById('positionsList').innerHTML = 
            `<p class="text-center text-red-600 py-8">Error loading positions</p>`;
    }
}

function displayPositions(positions) {
    const positionsList = document.getElementById('positionsList');
    
    if (!positions || positions.length === 0) {
        positionsList.innerHTML = '<p class="text-center text-gray-500 py-8">No open positions</p>';
        return;
    }

    positionsList.innerHTML = '';

    positions.forEach(position => {
        const isLong = position.quantity > 0;
        const side = isLong ? 'LONG' : 'SHORT';
        const sideColor = isLong ? 'text-green-600' : 'text-red-600';
        const sideClass = isLong ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        
        const card = document.createElement('div');
        card.className = `position-card border-2 ${sideClass} rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all`;
        card.dataset.symbol = position.tradingsymbol;
        card.dataset.exchange = position.exchange;
        card.dataset.quantity = position.quantity;
        card.dataset.averageprice = position.averageprice;
        card.dataset.product = position.product;
        
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <div class="font-bold text-lg">
                        <span class="font-mono">${position.exchange}:${position.tradingsymbol}</span>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">
                        <span class="${sideColor} font-semibold">${side}</span>
                        <span class="mx-2">|</span>
                        <span>Qty: ${Math.abs(position.quantity)}</span>
                        <span class="ml-3">Avg: ₹${position.averageprice.toFixed(2)}</span>
                        <span class="ml-3 badge badge-info">${position.product}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600">P&L</div>
                    <div class="font-bold text-lg ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ₹${position.pnl.toFixed(2)}
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => selectPosition(card));
        positionsList.appendChild(card);
    });
}

function updatePositionSelect(positions) {
    const select = document.getElementById('positionSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select a position to manage</option>';
    positions.forEach(position => {
        const option = document.createElement('option');
        const side = position.quantity > 0 ? 'LONG' : 'SHORT';
        option.value = `${position.exchange}:${position.tradingsymbol}`;
        option.textContent = `${position.exchange}:${position.traditionsymbol} - ${side} ${Math.abs(position.quantity)}`;
        select.appendChild(option);
    });
}

function selectPosition(card) {
    document.querySelectorAll('.position-card').forEach(c => {
        c.classList.remove('ring-2', 'ring-FE4A03');
    });
    card.classList.add('ring-2', 'ring-FE4A03');

    const symbol = card.dataset.symbol;
    const exchange = card.dataset.exchange;
    const quantity = parseInt(card.dataset.quantity);
    const averageprice = parseFloat(card.dataset.averageprice);
    const product = card.dataset.product;
    
    managePositionsState.selectedPosition = {
        symbol: symbol,
        exchange: exchange,
        quantity: quantity,
        averageprice: averageprice,
        product: product
    };

    showTrailingConfig();

    const select = document.getElementById('positionSelect');
    if (select) {
        select.value = `${exchange}:${symbol}`;
    }
}

function showTrailingOptions() {
    if (!managePositionsState.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    showTrailingConfig();
}

function showTrailingConfig() {
    const configPanel = document.getElementById('trailingConfigPanel');
    if (configPanel) {
        configPanel.classList.remove('hidden');
    }

    const infoBox = document.getElementById('trailingInfo');
    if (infoBox) {
        infoBox.classList.remove('hidden');
    }
}

async function startAutoTrailing() {
    if (!managePositionsState.selectedPosition) {
        alert('Please select a position');
        return;
    }

    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    
    if (!trailPoints || trailPoints <= 0) {
        alert('Please enter valid trail points');
        return;
    }

    try {
        const userId = sessionStorage.getItem('userid');
        const position = managePositionsState.selectedPosition;
        
        // Determine exit_type based on quantity
        // If quantity is negative (SHORT), exit_type is BUY
        // If quantity is positive (LONG), exit_type is SELL
        const exitType = position.quantity < 0 ? 'BUY' : 'SELL';
        
        // Calculate initial trigger price
        let triggerPrice;
        if (position.quantity > 0) {
            // LONG: trigger below average price
            triggerPrice = position.averageprice - trailPoints;
        } else {
            // SHORT: trigger above average price
            triggerPrice = position.averageprice + trailPoints;
        }
        
        // Round to tick size (0.05)
        triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
        
        // Calculate limit price with 5% buffer
        let limitPrice;
        const bufferPercent = 0.05;
        if (position.quantity > 0) {
            // LONG: limit below trigger
            limitPrice = triggerPrice * (1 - bufferPercent);
        } else {
            // SHORT: limit above trigger
            limitPrice = triggerPrice * (1 + bufferPercent);
        }
        limitPrice = Math.round(limitPrice / 0.05) * 0.05;

        // First place the SL order
        const orderResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                traditionsymbol: position.symbol,
                transactiontype: exitType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                ordertype: 'SL',
                trigger_price: triggerPrice,
                price: limitPrice
            })
        });

        const orderData = await orderResponse.json();
        
        if (!orderData.success) {
            alert('Error placing order: ' + orderData.error);
            return;
        }

        // Then start auto-trailing
        const trailResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                symbol: position.symbol,
                exchange: position.exchange,
                instrument_token: 256265, // Placeholder - will be handled by backend
                order_id: orderData.order_id,
                trigger_price: triggerPrice,
                limit_price: limitPrice,
                trail_points: trailPoints,
                quantity: position.quantity,  // Send with sign for exit_type calculation
                product: position.product,
                variety: 'regular',
                avg_price: position.averageprice
            })
        });

        const trailData = await trailResponse.json();
        
        if (trailData.success) {
            managePositionsState.isAutoTrailing = true;
            managePositionsState.trailingPositions[trailData.position_key] = {
                orderId: orderData.order_id,
                trailPoints: trailPoints
            };

            startTrailingStatusPolling();
            showSuccessMessage('Automated trailing started', orderData.order_id);
        } else {
            alert('Error: ' + trailData.error);
        }
    } catch (error) {
        console.error('Error starting auto trailing:', error);
        alert('Error starting auto trailing');
    }
}

function startTrailingStatusPolling() {
    if (managePositionsState.autoTrailInterval) {
        clearInterval(managePositionsState.autoTrailInterval);
    }

    managePositionsState.autoTrailInterval = setInterval(async () => {
        try {
            const userId = sessionStorage.getItem('userid');
            const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/get-trail-status`, {
                headers: {
                    'X-User-ID': userId
                }
            });

            const data = await response.json();
            
            if (data.success) {
                updateTrailingStatus(data.positions, data.logs);
            }
        } catch (error) {
            console.error('Error fetching trail status:', error);
        }
    }, 2000);
}

function updateTrailingStatus(positions, logs) {
    const statusDiv = document.getElementById('trailingStatus');
    if (!statusDiv) return;

    let html = '<div class="space-y-3">';
    
    if (Object.keys(positions).length === 0) {
        html = '<p class="text-gray-500">No active trailing positions</p>';
    } else {
        for (const [key, details] of Object.entries(positions)) {
            const distance = Math.abs(details.current_price - details.trigger_price);
            const pnlColor = details.pnl >= 0 ? 'text-green-600' : 'text-red-600';

            html += `
                <div class="border-2 border-green-200 bg-green-50 rounded-lg p-3">
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-bold">${details.symbol}</div>
                        <div class="text-sm text-gray-600">Trail #${details.update_count}</div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>LTP: <span class="font-mono">₹${details.current_price.toFixed(2)}</span></div>
                        <div>SL: <span class="font-mono">₹${details.trigger_price.toFixed(2)}</span></div>
                        <div>Limit: <span class="font-mono">₹${details.limit_price.toFixed(2)}</span></div>
                        <div class="${pnlColor} font-semibold">P&L: ₹${details.pnl.toFixed(2)}</div>
                    </div>
                    <div class="text-xs text-gray-600 mt-2">
                        Distance to SL: ${distance.toFixed(2)} points
                    </div>
                </div>
            `;
        }

        if (logs && logs.length > 0) {
            html += `
                <div class="border-2 border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div class="text-xs font-bold mb-2">Recent Updates</div>
            `;
            
            logs.slice(-10).forEach(log => {
                html += `
                    <div class="text-xs text-gray-600 py-1 border-b">
                        ${new Date(log.time * 1000).toLocaleTimeString()}: ${log.msg}
                    </div>
                `;
            });

            html += '</div>';
        }
    }

    html += '</div>';
    statusDiv.innerHTML = html;

    const stopBtn = document.getElementById('stopTrailingBtn');
    if (stopBtn && managePositionsState.isAutoTrailing && Object.keys(positions).length > 0) {
        stopBtn.style.display = 'block';
    }
}

async function stopAutoTrailing() {
    if (!managePositionsState.selectedPosition) return;

    try {
        const userId = sessionStorage.getItem('userid');
        const position = managePositionsState.selectedPosition;
        const positionKey = `${position.exchange}:${position.symbol}`;

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/stop-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                position_key: positionKey
            })
        });

        const data = await response.json();
        
        if (data.success) {
            managePositionsState.isAutoTrailing = false;
            if (managePositionsState.autoTrailInterval) {
                clearInterval(managePositionsState.autoTrailInterval);
            }

            const stopBtn = document.getElementById('stopTrailingBtn');
            if (stopBtn) {
                stopBtn.style.display = 'none';
            }

            showSuccessMessage('Automated trailing stopped');
            loadPositions();
        }
    } catch (error) {
        console.error('Error stopping trailing:', error);
        alert('Error stopping trailing');
    }
}

async function exitPositionImmediately() {
    if (!managePositionsState.selectedPosition) {
        alert('Please select a position');
        return;
    }

    if (!confirm('Are you sure you want to exit this position at market price?')) {
        return;
    }

    try {
        const userId = sessionStorage.getItem('userid');
        const position = managePositionsState.selectedPosition;
        
        // Determine transaction type: BUY if SHORT, SELL if LONG
        const transactionType = position.quantity < 0 ? 'BUY' : 'SELL';

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                traditionsymbol: position.symbol,
                transactiontype: transactionType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                ordertype: 'MARKET'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('Position exited', data.order_id);
            setTimeout(loadPositions, 1000);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error exiting position:', error);
        alert('Error exiting position');
    }
}

async function reversePosition() {
    if (!managePositionsState.selectedPosition) {
        alert('Please select a position');
        return;
    }

    if (!confirm('Are you sure you want to reverse this position?')) {
        return;
    }

    try {
        const userId = sessionStorage.getItem('userid');
        const position = managePositionsState.selectedPosition;
        
        // Reverse logic: if LONG (qty > 0), place BUY order for double quantity
        // if SHORT (qty < 0), place SELL order for double quantity
        const transactionType = position.quantity < 0 ? 'SELL' : 'BUY';

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                traditionsymbol: position.symbol,
                transactiontype: transactionType,
                quantity: Math.abs(position.quantity) * 2,  // Double to reverse and go opposite
                product: position.product,
                ordertype: 'MARKET'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('Position reversed', data.order_id);
            setTimeout(loadPositions, 1000);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error reversing position:', error);
        alert('Error reversing position');
    }
}

function showSuccessMessage(message, orderId = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'fixed top-4 right-4 bg-green-50 border-2 border-green-200 rounded-lg p-4 max-w-md z-50';
    msgDiv.innerHTML = `
        <div class="font-bold text-green-800 mb-1">${message}</div>
        ${orderId ? `<div class="text-sm text-green-700">Order ID: ${orderId}</div>` : ''}
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('managePositionsPage')) {
        initializeManagePositions();
    }
});

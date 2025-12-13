// Fixed Manage Positions Module - manage_positions.js
// FIXED: Proper userId retrieval and logging

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
    // Debug: Check if userId is available
    const userId = sessionStorage.getItem('userid');
    console.log('User ID from sessionStorage:', userId);
    if (!userId) {
        console.warn('⚠️ User ID not found in sessionStorage!');
        console.warn('Available sessionStorage keys:', Object.keys(sessionStorage));
    }
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

        // Get userId - check multiple possible keys
        let userId = sessionStorage.getItem('userid');
        
        // If not found, check alternative keys
        if (!userId) {
            userId = sessionStorage.getItem('userId');
        }
        if (!userId) {
            userId = sessionStorage.getItem('user_id');
        }

        console.log('Attempting API call with userId:', userId);

        if (!userId) {
            console.error('ERROR: userId is null/undefined');
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: User not logged in. Please refresh and login again.</p>`;
            return;
        }

        const headers = {
            'X-User-ID': userId,
            'Content-Type': 'application/json'
        };

        console.log('Request headers:', headers);
        console.log('Backend URL:', MANAGE_POSITIONS_CONFIG.backendUrl + '/api/positions');

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            method: 'GET',
            headers: headers
        });

        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            managePositionsState.allPositions = data.positions;
            displayPositions(data.positions);
            updatePositionSelect(data.positions);
        } else {
            const errorMsg = data.error || 'Unknown error';
            console.error('API Error:', errorMsg);
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${errorMsg}</p>`;
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        document.getElementById('positionsList').innerHTML = 
            `<p class="text-center text-red-600 py-8">Error: ${error.message}</p>`;
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
        option.value = `${position.exchange}:${position.traditionsymbol}`;
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

    console.log('Selected position:', managePositionsState.selectedPosition);

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
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
        const exitType = position.quantity < 0 ? 'BUY' : 'SELL';
        
        let triggerPrice;
        if (position.quantity > 0) {
            triggerPrice = position.averageprice - trailPoints;
        } else {
            triggerPrice = position.averageprice + trailPoints;
        }
        
        triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
        
        let limitPrice;
        const bufferPercent = 0.05;
        if (position.quantity > 0) {
            limitPrice = triggerPrice * (1 - bufferPercent);
        } else {
            limitPrice = triggerPrice * (1 + bufferPercent);
        }
        limitPrice = Math.round(limitPrice / 0.05) * 0.05;

        console.log('Placing order with:', {
            exchange: position.exchange,
            symbol: position.symbol,
            quantity: Math.abs(position.quantity),
            exitType: exitType,
            triggerPrice: triggerPrice,
            limitPrice: limitPrice
        });

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
        console.log('Order response:', orderData);
        
        if (!orderData.success) {
            alert('Error placing order: ' + (orderData.error || 'Unknown error'));
            return;
        }

        const trailResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                symbol: position.symbol,
                exchange: position.exchange,
                instrument_token: 256265,
                order_id: orderData.order_id,
                trigger_price: triggerPrice,
                limit_price: limitPrice,
                trail_points: trailPoints,
                quantity: position.quantity,
                product: position.product,
                variety: 'regular',
                avg_price: position.averageprice
            })
        });

        const trailData = await trailResponse.json();
        console.log('Trail response:', trailData);
        
        if (trailData.success) {
            managePositionsState.isAutoTrailing = true;
            managePositionsState.trailingPositions[trailData.position_key] = {
                orderId: orderData.order_id,
                trailPoints: trailPoints
            };

            startTrailingStatusPolling();
            showSuccessMessage('Automated trailing started', orderData.order_id);
        } else {
            alert('Error: ' + (trailData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error starting auto trailing:', error);
        alert('Error starting auto trailing: ' + error.message);
    }
}

function startTrailingStatusPolling() {
    if (managePositionsState.autoTrailInterval) {
        clearInterval(managePositionsState.autoTrailInterval);
    }

    managePositionsState.autoTrailInterval = setInterval(async () => {
        try {
            let userId = sessionStorage.getItem('userid');
            if (!userId) userId = sessionStorage.getItem('userId');
            if (!userId) userId = sessionStorage.getItem('user_id');

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
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

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
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
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
            alert('Error: ' + (data.error || 'Unknown error'));
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
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
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
                quantity: Math.abs(position.quantity) * 2,
                product: position.product,
                ordertype: 'MARKET'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('Position reversed', data.order_id);
            setTimeout(loadPositions, 1000);
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
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

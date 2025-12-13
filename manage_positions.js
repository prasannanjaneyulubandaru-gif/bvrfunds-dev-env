// Manage Positions Module - FIXED VERSION 3
// Fixes: userId loading, position selection, button responsiveness

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
    console.log('🚀 Initializing Manage Positions module');
    
    // Give sessionStorage a moment to be ready
    setTimeout(() => {
        const userId = sessionStorage.getItem('userid');
        console.log('✓ User ID from sessionStorage:', userId);
        
        if (!userId) {
            console.warn('⚠️ User ID not found in sessionStorage!');
            console.warn('Available keys:', Object.keys(sessionStorage));
            
            // Retry after 1 second
            setTimeout(initializeManagePositions, 1000);
            return;
        }
        
        setupManagePositionsListeners();
        loadPositions(); // Load positions after listeners are setup
    }, 500);
}

function setupManagePositionsListeners() {
    console.log('📌 Setting up event listeners');
    
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('🔄 Refresh clicked');
            loadPositions();
        });
    }

    const positionSelect = document.getElementById('positionSelect');
    if (positionSelect) {
        positionSelect.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            console.log('📋 Position select changed:', selectedValue);
            
            if (selectedValue) {
                const positions = document.querySelectorAll('.position-card');
                positions.forEach(card => {
                    const cardSymbol = card.dataset.symbol;
                    const cardExchange = card.dataset.exchange;
                    const cardFull = `${cardExchange}:${cardSymbol}`;
                    
                    if (cardFull === selectedValue) {
                        selectPosition(card);
                    }
                });
            }
        });
    }

    const exitPositionBtn = document.getElementById('exitPositionBtn');
    if (exitPositionBtn) {
        exitPositionBtn.addEventListener('click', exitPositionImmediately);
    }

    const reversePositionBtn = document.getElementById('reversePositionBtn');
    if (reversePositionBtn) {
        reversePositionBtn.addEventListener('click', reversePosition);
    }

    const startTrailingBtn = document.getElementById('startTrailingBtn');
    if (startTrailingBtn) {
        startTrailingBtn.addEventListener('click', startAutoTrailing);
    }

    const stopTrailingBtn = document.getElementById('stopTrailingBtn');
    if (stopTrailingBtn) {
        stopTrailingBtn.addEventListener('click', stopAutoTrailing);
    }
}

async function loadPositions() {
    try {
        const positionsList = document.getElementById('positionsList');
        if (!positionsList) {
            console.error('❌ positionsList element not found');
            return;
        }
        
        positionsList.innerHTML = '<p class="text-center text-gray-500 py-8">Loading positions...</p>';

        // Get userId
        let userId = sessionStorage.getItem('userid');
        
        if (!userId) {
            userId = sessionStorage.getItem('userId');
        }
        if (!userId) {
            userId = sessionStorage.getItem('user_id');
        }

        console.log('📡 API call with userId:', userId);

        if (!userId) {
            console.error('❌ ERROR: userId is null/undefined');
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: User not logged in. Please refresh and login again.</p>`;
            return;
        }

        const headers = {
            'X-User-ID': userId,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            method: 'GET',
            headers: headers
        });

        console.log('📥 Response status:', response.status);

        const data = await response.json();
        console.log('✓ Response data:', data);

        if (data.success) {
            managePositionsState.allPositions = data.positions;
            displayPositions(data.positions);
            updatePositionSelect(data.positions);
        } else {
            const errorMsg = data.error || 'Unknown error';
            console.error('❌ API Error:', errorMsg);
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${errorMsg}</p>`;
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error);
        const positionsList = document.getElementById('positionsList');
        if (positionsList) {
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${error.message}</p>`;
        }
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
        
        // Store ALL data as strings in data attributes
        card.setAttribute('data-symbol', position.tradingsymbol);
        card.setAttribute('data-exchange', position.exchange);
        card.setAttribute('data-quantity', position.quantity.toString());
        card.setAttribute('data-averageprice', position.averageprice.toString());
        card.setAttribute('data-product', position.product);
        card.setAttribute('data-pnl', position.pnl.toString());
        
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
        const optionValue = `${position.exchange}:${position.tradingsymbol}`;
        option.value = optionValue;
        option.textContent = `${optionValue} - ${side} ${Math.abs(position.quantity)}`;
        select.appendChild(option);
    });
}

function selectPosition(card) {
    console.log('👆 Position card clicked');
    
    // Remove previous selection
    document.querySelectorAll('.position-card').forEach(c => {
        c.classList.remove('ring-2', 'ring-red-600');
    });
    
    // Add selection to this card
    card.classList.add('ring-2', 'ring-red-600');

    // Get data from attributes
    const symbol = card.getAttribute('data-symbol');
    const exchange = card.getAttribute('data-exchange');
    const quantity = parseInt(card.getAttribute('data-quantity'));
    const averageprice = parseFloat(card.getAttribute('data-averageprice'));
    const product = card.getAttribute('data-product');
    const pnl = parseFloat(card.getAttribute('data-pnl'));
    
    console.log('📍 Selected position data:', {
        symbol, exchange, quantity, averageprice, product, pnl
    });
    
    // Store selected position
    managePositionsState.selectedPosition = {
        symbol: symbol,
        exchange: exchange,
        quantity: quantity,
        averageprice: averageprice,
        product: product,
        pnl: pnl
    };

    // Update select dropdown
    const select = document.getElementById('positionSelect');
    if (select) {
        select.value = `${exchange}:${symbol}`;
    }

    // Update position info display
    updateSelectedPositionDisplay();

    // Show trailing config
    showTrailingConfig();
}

function updateSelectedPositionDisplay() {
    const infoDiv = document.getElementById('selectedPositionInfo');
    if (!infoDiv) return;

    const pos = managePositionsState.selectedPosition;
    if (!pos) {
        infoDiv.innerHTML = '<p class="text-gray-500">No position selected</p>';
        return;
    }

    const side = pos.quantity > 0 ? 'LONG' : 'SHORT';
    const sideColor = pos.quantity > 0 ? 'text-green-600' : 'text-red-600';

    infoDiv.innerHTML = `
        <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div class="font-bold text-lg mb-2">
                <span class="font-mono">${pos.exchange}:${pos.symbol}</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <div class="text-gray-600">Side</div>
                    <div class="font-bold ${sideColor}">${side}</div>
                </div>
                <div>
                    <div class="text-gray-600">Quantity</div>
                    <div class="font-bold">${Math.abs(pos.quantity)}</div>
                </div>
                <div>
                    <div class="text-gray-600">Avg Price</div>
                    <div class="font-mono">₹${pos.averageprice.toFixed(2)}</div>
                </div>
                <div>
                    <div class="text-gray-600">Product</div>
                    <div class="font-mono">${pos.product}</div>
                </div>
            </div>
        </div>
    `;
}

function showTrailingConfig() {
    const configPanel = document.getElementById('trailingConfigPanel');
    if (configPanel) {
        configPanel.classList.remove('hidden');
    }

    const trailingInfo = document.getElementById('trailingInfo');
    if (trailingInfo) {
        trailingInfo.classList.remove('hidden');
    }

    // Show buttons
    const exitBtn = document.getElementById('exitPositionBtn');
    if (exitBtn) {
        exitBtn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
        exitBtn.disabled = false;
    }

    const reverseBtn = document.getElementById('reversePositionBtn');
    if (reverseBtn) {
        reverseBtn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
        reverseBtn.disabled = false;
    }

    const startTrailBtn = document.getElementById('startTrailingBtn');
    if (startTrailBtn) {
        startTrailBtn.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed', 'bg-gray-400');
        startTrailBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        startTrailBtn.disabled = false;
    }
}

async function startAutoTrailing() {
    if (!managePositionsState.selectedPosition) {
        alert('❌ Please select a position first');
        return;
    }

    const trailPointsInput = document.getElementById('trailPoints');
    if (!trailPointsInput) {
        alert('❌ Trail points input not found');
        return;
    }

    const trailPoints = parseFloat(trailPointsInput.value);
    
    if (!trailPoints || trailPoints <= 0) {
        alert('❌ Please enter valid trail points (> 0)');
        return;
    }

    try {
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
        // Calculate exit type based on position direction
        const exitType = position.quantity < 0 ? 'BUY' : 'SELL';
        
        // Calculate trigger price
        let triggerPrice;
        if (position.quantity > 0) {
            // LONG: SL below entry (subtract points)
            triggerPrice = position.averageprice - trailPoints;
        } else {
            // SHORT: SL above entry (add points)
            triggerPrice = position.averageprice + trailPoints;
        }
        
        // Round to nearest 0.05
        triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
        
        // Calculate limit price with buffer
        let limitPrice;
        const bufferPercent = 0.05; // 5%
        if (position.quantity > 0) {
            limitPrice = triggerPrice * (1 - bufferPercent);
        } else {
            limitPrice = triggerPrice * (1 + bufferPercent);
        }
        limitPrice = Math.round(limitPrice / 0.05) * 0.05;

        console.log('📤 Placing SL order with:', {
            exchange: position.exchange,
            symbol: position.symbol,
            quantity: Math.abs(position.quantity),
            exitType: exitType,
            triggerPrice: triggerPrice,
            limitPrice: limitPrice
        });

        // Step 1: Place order
        const orderResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                variety: 'regular',
                exchange: position.exchange,
                traditionsymbol: position.symbol,  // Note: typo is intentional (matches backend)
                transactiontype: exitType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                ordertype: 'SL',
                trigger_price: triggerPrice,
                price: limitPrice
            })
        });

        const orderData = await orderResponse.json();
        console.log('✓ Order response:', orderData);
        
        if (!orderData.success) {
            alert('❌ Error placing order: ' + (orderData.error || 'Unknown error'));
            return;
        }

        // Step 2: Start trailing
        const trailResponse = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                symbol: position.symbol,
                exchange: position.exchange,
                instrument_token: 256265,  // Placeholder - should be fetched from actual data
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
        console.log('✓ Trail response:', trailData);
        
        if (trailData.success) {
            managePositionsState.isAutoTrailing = true;
            managePositionsState.trailingPositions[trailData.position_key] = {
                orderId: orderData.order_id,
                trailPoints: trailPoints
            };

            startTrailingStatusPolling();
            showSuccessMessage('✅ Automated trailing started!', orderData.order_id);
            
            // Disable start button, show stop button
            const startBtn = document.getElementById('startTrailingBtn');
            const stopBtn = document.getElementById('stopTrailingBtn');
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.style.display = 'block';
        } else {
            alert('❌ Error: ' + (trailData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error starting auto trailing:', error);
        alert('❌ Error starting auto trailing: ' + error.message);
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
            console.error('❌ Error fetching trail status:', error);
        }
    }, 2000);
}

function updateTrailingStatus(positions, logs) {
    const statusDiv = document.getElementById('trailingStatus');
    if (!statusDiv) return;

    let html = '<div class="space-y-3">';
    
    if (!positions || Object.keys(positions).length === 0) {
        html = '<p class="text-gray-500 text-center py-4">No active trailing positions</p>';
    } else {
        for (const [key, details] of Object.entries(positions)) {
            const distance = Math.abs(details.current_price - details.trigger_price);
            const pnlColor = details.pnl >= 0 ? 'text-green-600' : 'text-red-600';

            html += `
                <div class="border-2 border-green-200 bg-green-50 rounded-lg p-3">
                    <div class="flex justify-between items-center mb-2">
                        <div class="font-bold">${details.symbol}</div>
                        <div class="text-sm text-gray-600">Trail #${details.update_count || 0}</div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>LTP: <span class="font-mono font-bold">₹${details.current_price.toFixed(2)}</span></div>
                        <div>SL: <span class="font-mono font-bold">₹${details.trigger_price.toFixed(2)}</span></div>
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
                <div class="border-2 border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div class="text-xs font-bold mb-2 text-gray-700">Recent Updates</div>
            `;
            
            logs.slice(-10).reverse().forEach(log => {
                html += `
                    <div class="text-xs text-gray-600 py-1 border-b last:border-b-0">
                        ${new Date(log.time * 1000).toLocaleTimeString()}: <span class="font-mono">${log.msg}</span>
                    </div>
                `;
            });

            html += '</div>';
        }
    }

    html += '</div>';
    statusDiv.innerHTML = html;
}

async function stopAutoTrailing() {
    if (!managePositionsState.selectedPosition) {
        alert('❌ Please select a position first');
        return;
    }

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

            // Hide stop button, enable start button
            const stopBtn = document.getElementById('stopTrailingBtn');
            const startBtn = document.getElementById('startTrailingBtn');
            if (stopBtn) stopBtn.style.display = 'none';
            if (startBtn) startBtn.disabled = false;

            showSuccessMessage('✅ Automated trailing stopped');
            
            // Reload positions
            setTimeout(loadPositions, 500);
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error stopping trailing:', error);
        alert('❌ Error stopping trailing: ' + error.message);
    }
}

async function exitPositionImmediately() {
    if (!managePositionsState.selectedPosition) {
        alert('❌ Please select a position first');
        return;
    }

    if (!confirm('⚠️ Exit this position at MARKET price?')) {
        return;
    }

    try {
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
        // Exit type: opposite of entry
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
            showSuccessMessage('✅ Position exited!', data.order_id);
            setTimeout(loadPositions, 1000);
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error exiting position:', error);
        alert('❌ Error exiting position: ' + error.message);
    }
}

async function reversePosition() {
    if (!managePositionsState.selectedPosition) {
        alert('❌ Please select a position first');
        return;
    }

    if (!confirm('⚠️ Reverse this position? (2x quantity will be executed)')) {
        return;
    }

    try {
        let userId = sessionStorage.getItem('userid');
        if (!userId) userId = sessionStorage.getItem('userId');
        if (!userId) userId = sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        
        // Reverse: opposite direction
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
                quantity: Math.abs(position.quantity) * 2,  // 2x quantity to reverse
                product: position.product,
                ordertype: 'MARKET'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('✅ Position reversed!', data.order_id);
            setTimeout(loadPositions, 1000);
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error reversing position:', error);
        alert('❌ Error reversing position: ' + error.message);
    }
}

function showSuccessMessage(message, orderId = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'fixed top-4 right-4 bg-green-50 border-2 border-green-200 rounded-lg p-4 max-w-md z-50 shadow-lg';
    msgDiv.innerHTML = `
        <div class="font-bold text-green-800 mb-1">${message}</div>
        ${orderId ? `<div class="text-sm text-green-700">Order ID: ${orderId}</div>` : ''}
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 5000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 DOMContentLoaded event fired');
    
    if (document.getElementById('managePositionsPage')) {
        console.log('✓ managePositionsPage element found');
        initializeManagePositions();
    } else {
        console.warn('⚠️ managePositionsPage element not found');
    }
});

// Also initialize if page becomes visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && document.getElementById('managePositionsPage')) {
        console.log('📱 Page became visible, reinitializing');
        if (!managePositionsState.allPositions || managePositionsState.allPositions.length === 0) {
            initializeManagePositions();
        }
    }
});

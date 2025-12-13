// FIXED Manage Positions Module - manage_positions.js

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
    console.log('✅ Initializing Manage Positions module');
    const userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
    console.log('User ID:', userId);
    
    if (!userId) {
        console.warn('⚠️ User ID not found in sessionStorage!');
    }
    
    setupManagePositionsListeners();
    loadPositions();
}

function setupManagePositionsListeners() {
    console.log('✅ Setting up event listeners');
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('🔄 Refresh button clicked');
            loadPositions();
        });
    } else {
        console.error('❌ refreshPositionsBtn not found');
    }

    // Position dropdown
    const positionSelect = document.getElementById('positionSelect');
    if (positionSelect) {
        positionSelect.addEventListener('change', (e) => {
            const positionKey = e.target.value;
            console.log('📍 Dropdown changed to:', positionKey);
            
            if (positionKey && positionKey !== 'Select a position to manage') {
                const selectedOption = e.target.options[e.target.selectedIndex];
                
                managePositionsState.selectedPosition = {
                    symbol: selectedOption.dataset.symbol,
                    exchange: selectedOption.dataset.exchange,
                    quantity: parseInt(selectedOption.dataset.quantity),
                    averageprice: parseFloat(selectedOption.dataset.averageprice),
                    product: selectedOption.dataset.product,
                    positionKey: positionKey
                };
                
                console.log('✅ Position selected:', managePositionsState.selectedPosition);
                
                // Show trailing config
                showTrailingConfig();
                
                // Highlight card
                document.querySelectorAll('.position-card').forEach(card => {
                    if (card.dataset.symbol === selectedOption.dataset.symbol && 
                        card.dataset.exchange === selectedOption.dataset.exchange) {
                        card.classList.add('ring-2', 'ring-FE4A03');
                    } else {
                        card.classList.remove('ring-2', 'ring-FE4A03');
                    }
                });
            } else {
                managePositionsState.selectedPosition = null;
                hideTrailingConfig();
            }
        });
    } else {
        console.error('❌ positionSelect not found');
    }

    // Exit position button
    const exitPositionBtn = document.getElementById('exitPositionBtn');
    if (exitPositionBtn) {
        exitPositionBtn.addEventListener('click', () => {
            console.log('🚪 Exit position clicked');
            exitPositionImmediately();
        });
    }

    // Reverse position button
    const reversePositionBtn = document.getElementById('reversePositionBtn');
    if (reversePositionBtn) {
        reversePositionBtn.addEventListener('click', () => {
            console.log('🔄 Reverse position clicked');
            reversePosition();
        });
    }

    // Stop trailing button
    const stopTrailingBtn = document.getElementById('stopTrailingBtn');
    if (stopTrailingBtn) {
        stopTrailingBtn.addEventListener('click', () => {
            console.log('⏹️ Stop trailing clicked');
            stopAutoTrailing();
        });
    }
}

async function loadPositions() {
    try {
        console.log('📥 Loading positions...');
        const positionsList = document.getElementById('positionsList');
        positionsList.innerHTML = '<p class="text-center text-gray-500 py-8">Loading positions...</p>';

        let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');

        if (!userId) {
            console.error('❌ userId is null/undefined');
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: User not logged in. Please refresh and login again.</p>`;
            return;
        }

        console.log('📡 Fetching positions for user:', userId);

        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Response status:', response.status);

        const data = await response.json();
        console.log('📦 Response data:', data);

        if (data.success) {
            managePositionsState.allPositions = data.positions;
            displayPositions(data.positions);
            updatePositionSelect(data.positions);
        } else {
            console.error('❌ API Error:', data.error);
            positionsList.innerHTML = `<p class="text-center text-red-600 py-8">Error: ${data.error}</p>`;
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error);
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

        card.addEventListener('click', () => selectPositionFromCard(card));
        positionsList.appendChild(card);
    });
}

function updatePositionSelect(positions) {
    const select = document.getElementById('positionSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a position to manage</option>';
    
    positions.forEach(position => {
        const positionKey = `${position.exchange}:${position.tradingsymbol}`;
        const side = position.quantity > 0 ? 'LONG' : 'SHORT';
        
        const option = document.createElement('option');
        option.value = positionKey;
        option.textContent = `${positionKey} - ${side} ${Math.abs(position.quantity)}`;
        option.dataset.symbol = position.tradingsymbol;
        option.dataset.exchange = position.exchange;
        option.dataset.quantity = position.quantity;
        option.dataset.averageprice = position.averageprice;
        option.dataset.product = position.product;
        
        select.appendChild(option);
    });
}

function selectPositionFromCard(card) {
    console.log('🎯 Card clicked');
    
    // Remove highlight from all cards
    document.querySelectorAll('.position-card').forEach(c => {
        c.classList.remove('ring-2', 'ring-FE4A03');
    });
    
    // Highlight selected card
    card.classList.add('ring-2', 'ring-FE4A03');
    
    const positionKey = `${card.dataset.exchange}:${card.dataset.symbol}`;
    
    managePositionsState.selectedPosition = {
        symbol: card.dataset.symbol,
        exchange: card.dataset.exchange,
        quantity: parseInt(card.dataset.quantity),
        averageprice: parseFloat(card.dataset.averageprice),
        product: card.dataset.product,
        positionKey: positionKey
    };
    
    console.log('✅ Position selected from card:', managePositionsState.selectedPosition);
    
    // Sync dropdown
    const select = document.getElementById('positionSelect');
    if (select) {
        select.value = positionKey;
    }
    
    // Show trailing config
    showTrailingConfig();
}

function showTrailingConfig() {
    console.log('👁️ Showing trailing config');
    const configPanel = document.getElementById('trailingConfigPanel');
    const infoBox = document.getElementById('trailingInfo');
    
    if (configPanel) {
        configPanel.classList.remove('hidden');
    } else {
        console.error('❌ trailingConfigPanel not found');
    }
    
    if (infoBox) {
        infoBox.classList.remove('hidden');
    }
}

function hideTrailingConfig() {
    console.log('🙈 Hiding trailing config');
    const configPanel = document.getElementById('trailingConfigPanel');
    if (configPanel) {
        configPanel.classList.add('hidden');
    }
}

// Make this function globally accessible
window.startAutoTrailing = async function() {
    console.log('🚀 startAutoTrailing called');
    
    if (!managePositionsState.selectedPosition) {
        showErrorMessage('Please select a position first');
        console.error('❌ No position selected');
        return;
    }

    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    
    if (!trailPoints || trailPoints <= 0) {
        showErrorMessage('Please enter valid trail points');
        console.error('❌ Invalid trail points:', trailPoints);
        return;
    }

    console.log('📊 Trail points:', trailPoints);
    console.log('📍 Selected position:', managePositionsState.selectedPosition);

    try {
        let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');

        const position = managePositionsState.selectedPosition;
        const exitType = position.quantity < 0 ? 'BUY' : 'SELL';
        
        let triggerPrice;
        if (position.quantity > 0) {
            triggerPrice = position.averageprice - trailPoints;
        } else {
            triggerPrice = position.averageprice + trailPoints;
        }
        triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
        
        const bufferPercent = parseFloat(document.getElementById('limitBuffer').value) / 100 || 0.05;
        let limitPrice;
        if (position.quantity > 0) {
            limitPrice = triggerPrice * (1 - bufferPercent);
        } else {
            limitPrice = triggerPrice * (1 + bufferPercent);
        }
        limitPrice = Math.round(limitPrice / 0.05) * 0.05;

        console.log('📤 Placing SL order:', {
            symbol: position.symbol,
            exchange: position.exchange,
            exitType: exitType,
            triggerPrice: triggerPrice,
            limitPrice: limitPrice
        });

        // Place initial SL order
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
        console.log('📬 Order response:', orderData);
        
        if (!orderData.success) {
            showErrorMessage('Error placing order: ' + (orderData.error || 'Unknown error'));
            return;
        }

        console.log('✅ Order placed successfully, order_id:', orderData.order_id);

        // Start auto-trailing
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
        console.log('📬 Trail response:', trailData);
        
        if (trailData.success) {
            managePositionsState.isAutoTrailing = true;
            startTrailingStatusPolling();
            showSuccessMessage('Automated trailing started', orderData.order_id);
            
            // Show stop button
            const stopBtn = document.getElementById('stopTrailingBtn');
            if (stopBtn) {
                stopBtn.classList.remove('hidden');
            }
        } else {
            showErrorMessage('Error: ' + (trailData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error starting auto trailing:', error);
        showErrorMessage('Error starting auto trailing: ' + error.message);
    }
};

function startTrailingStatusPolling() {
    console.log('🔄 Starting status polling');
    
    if (managePositionsState.autoTrailInterval) {
        clearInterval(managePositionsState.autoTrailInterval);
    }

    managePositionsState.autoTrailInterval = setInterval(async () => {
        try {
            let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');

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
}

async function stopAutoTrailing() {
    if (!managePositionsState.selectedPosition) return;

    try {
        let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
        const position = managePositionsState.selectedPosition;
        const positionKey = position.positionKey;

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
                stopBtn.classList.add('hidden');
            }

            showSuccessMessage('Automated trailing stopped');
            loadPositions();
        }
    } catch (error) {
        console.error('❌ Error stopping trailing:', error);
        alert('Error stopping trailing');
    }
}

async function exitPositionImmediately() {
    if (!managePositionsState.selectedPosition) {
        showErrorMessage('Please select a position');
        return;
    }

    // Show custom confirmation dialog
    if (!await showConfirmDialog('Are you sure you want to exit this position at market price?')) {
        return;
    }

    try {
        let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
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
            showErrorMessage('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error exiting position:', error);
        showErrorMessage('Error exiting position: ' + error.message);
    }
}

async function reversePosition() {
    if (!managePositionsState.selectedPosition) {
        showErrorMessage('Please select a position');
        return;
    }

    if (!await showConfirmDialog('Are you sure you want to reverse this position?')) {
        return;
    }

    try {
        let userId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || sessionStorage.getItem('user_id');
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
            showErrorMessage('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('❌ Error reversing position:', error);
        showErrorMessage('Error reversing position: ' + error.message);
    }
}

function showSuccessMessage(message, orderId = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'fixed top-4 right-4 bg-green-50 border-2 border-green-200 rounded-lg p-4 max-w-md z-50 shadow-lg';
    msgDiv.innerHTML = `
        <div class="flex items-start justify-between">
            <div>
                <div class="font-bold text-green-800 mb-1">✅ ${message}</div>
                ${orderId ? `<div class="text-sm text-green-700">Order ID: ${orderId}</div>` : ''}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-green-600 hover:text-green-800 font-bold text-xl ml-4">×</button>
        </div>
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        if (msgDiv.parentElement) {
            msgDiv.remove();
        }
    }, 5000);
}

function showErrorMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'fixed top-4 right-4 bg-red-50 border-2 border-red-200 rounded-lg p-4 max-w-md z-50 shadow-lg';
    msgDiv.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="font-bold text-red-800">❌ ${message}</div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-600 hover:text-red-800 font-bold text-xl ml-4">×</button>
        </div>
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        if (msgDiv.parentElement) {
            msgDiv.remove();
        }
    }, 5000);
}

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-xl p-6 max-w-md shadow-2xl">
                <h3 class="text-lg font-bold text-gray-900 mb-4">⚠️ Confirm Action</h3>
                <p class="text-gray-700 mb-6">${message}</p>
                <div class="flex gap-3 justify-end">
                    <button id="confirmNo" class="px-6 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button id="confirmYes" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                        Confirm
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('confirmYes').addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });
        
        document.getElementById('confirmNo').addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded');
    if (document.getElementById('managePositionsPage')) {
        console.log('✅ Manage Positions page detected');
        initializeManagePositions();
    } else {
        console.log('⚠️ Manage Positions page NOT detected');
    }
});

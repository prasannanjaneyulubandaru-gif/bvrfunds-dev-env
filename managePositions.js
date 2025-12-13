// managePositions.js - Manage Positions Page
(function() {
    'use strict';

    // API Configuration
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app';

    // State management
    let positions = [];
    let selectedPositions = [];
    let trailingStatus = null;
    let statusInterval = null;

    // Initialize the page
    function init() {
        console.log('Manage Positions page initialized');
        setupEventListeners();
        loadPositions();
        startStatusPolling();
    }

    // Setup event listeners
    function setupEventListeners() {
        const exitAllBtn = document.getElementById('exitAllPositions');
        const autoTrailBtn = document.getElementById('autoTrailBtn');
        const manualTrailBtn = document.getElementById('manualTrailBtn');
        const refreshBtn = document.getElementById('refreshPositions');

        if (exitAllBtn) {
            exitAllBtn.addEventListener('click', exitAllPositions);
        }

        if (autoTrailBtn) {
            autoTrailBtn.addEventListener('click', startAutoTrail);
        }

        if (manualTrailBtn) {
            manualTrailBtn.addEventListener('click', startManualTrail);
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadPositions);
        }
    }

    // Load current positions
    async function loadPositions() {
        const container = document.getElementById('positionsContainer');
        const selectedInfo = document.getElementById('selectedPositionsInfo');
        
        if (!container) return;

        container.innerHTML = '<div class="text-center py-8 text-gray-600">Loading positions...</div>';
        
        try {
            const userId = sessionStorage.getItem('user_id');
            const response = await fetch(`${API_BASE_URL}/api/positions`, {
                method: 'GET',
                headers: {
                    'X-User-ID': userId
                }
            });

            const data = await response.json();

            if (data.success && data.positions) {
                positions = data.positions;
                selectedPositions = [];
                renderPositions();
                updateSelectedInfo();
            } else {
                throw new Error(data.error || 'Failed to load positions');
            }

        } catch (error) {
            console.error('Error loading positions:', error);
            container.innerHTML = `<div class="text-center py-8 text-red-600">Error: ${error.message}</div>`;
        }
    }

    // Render positions list
    function renderPositions() {
        const container = document.getElementById('positionsContainer');
        
        if (positions.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-600">No open positions</div>';
            return;
        }

        let html = '';

        positions.forEach((position, index) => {
            const isLong = position.quantity > 0;
            const bgColor = isLong ? 'bg-green-50' : 'bg-red-50';
            const borderColor = isLong ? 'border-green-200' : 'border-red-200';
            const textColor = isLong ? 'text-green-700' : 'text-red-700';
            const pnl = position.pnl || 0;
            const pnlClass = pnl >= 0 ? 'text-green-600' : 'text-red-600';
            
            const isSelected = selectedPositions.some(p => 
                p.tradingsymbol === position.tradingsymbol && 
                p.exchange === position.exchange
            );

            html += `
                <div class="border-2 ${borderColor} ${bgColor} rounded-lg p-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-start gap-3 flex-1">
                            <input 
                                type="checkbox" 
                                id="pos-${index}" 
                                class="mt-1 h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
                                ${isSelected ? 'checked' : ''}
                                onchange="window.ManagePositions.togglePosition(${index})"
                            />
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="px-2 py-1 ${bgColor} ${textColor} text-xs font-semibold rounded">
                                        ${isLong ? 'LONG' : 'SHORT'}
                                    </span>
                                    <span class="font-mono font-bold text-gray-900 text-lg">
                                        ${position.tradingsymbol}
                                    </span>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span class="text-gray-600">Exchange:</span>
                                        <span class="font-semibold ml-1">${position.exchange}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-600">Product:</span>
                                        <span class="font-semibold ml-1">${position.product}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-600">Quantity:</span>
                                        <span class="font-semibold ml-1">${Math.abs(position.quantity)}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-600">Avg Price:</span>
                                        <span class="font-semibold ml-1">₹${position.average_price.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-600">LTP:</span>
                                        <span class="font-semibold ml-1">₹${position.last_price.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-600">P&L:</span>
                                        <span class="font-semibold ml-1 ${pnlClass}">₹${pnl.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Toggle position selection
    function togglePosition(index) {
        const position = positions[index];
        const existingIndex = selectedPositions.findIndex(p => 
            p.tradingsymbol === position.tradingsymbol && 
            p.exchange === position.exchange
        );

        if (existingIndex >= 0) {
            selectedPositions.splice(existingIndex, 1);
        } else {
            selectedPositions.push(position);
        }

        updateSelectedInfo();
    }

    // Update selected positions info
    function updateSelectedInfo() {
        const container = document.getElementById('selectedPositionsInfo');
        const autoTrailBtn = document.getElementById('autoTrailBtn');
        const manualTrailBtn = document.getElementById('manualTrailBtn');

        if (!container) return;

        const count = selectedPositions.length;
        
        if (count === 0) {
            container.innerHTML = '<p class="text-gray-600">No positions selected</p>';
            if (autoTrailBtn) autoTrailBtn.disabled = true;
            if (manualTrailBtn) manualTrailBtn.disabled = true;
        } else {
            container.innerHTML = `<p class="text-green-600 font-semibold">${count} position(s) selected</p>`;
            if (autoTrailBtn) autoTrailBtn.disabled = false;
            if (manualTrailBtn) manualTrailBtn.disabled = false;
        }
    }

    // Exit all positions
    async function exitAllPositions() {
        if (!confirm('Are you sure you want to exit ALL positions immediately? This will place MARKET orders.')) {
            return;
        }

        const resultDiv = document.getElementById('trailResult');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<div class="text-center py-4">Exiting all positions...</div>';

        try {
            const userId = sessionStorage.getItem('user_id');
            const response = await fetch(`${API_BASE_URL}/api/exit-all-positions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                }
            });

            const data = await response.json();

            if (data.success) {
                displayExitResults(data);
                setTimeout(() => loadPositions(), 2000);
            } else {
                throw new Error(data.error || 'Failed to exit positions');
            }

        } catch (error) {
            console.error('Error exiting positions:', error);
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
        }
    }

    // Display exit results
    function displayExitResults(data) {
        const resultDiv = document.getElementById('trailResult');
        
        let html = `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
                <h3 class="font-bold text-lg mb-4">Exit All Positions - Results</h3>
                <div class="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div>
                        <div class="text-2xl font-bold text-gray-900">${data.total}</div>
                        <div class="text-xs text-gray-600">Total</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-green-600">${data.successful}</div>
                        <div class="text-xs text-gray-600">Success</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-red-600">${data.failed}</div>
                        <div class="text-xs text-gray-600">Failed</div>
                    </div>
                </div>
                <div class="space-y-2 max-h-64 overflow-y-auto">
        `;

        data.results.forEach(result => {
            const statusClass = result.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700';
            html += `
                <div class="border-2 ${statusClass} rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-mono font-semibold text-sm">${result.symbol}</span>
                        <span class="text-xs font-bold">${result.success ? '✓ SUCCESS' : '✗ FAILED'}</span>
                    </div>
                    ${result.success ? `
                        <div class="text-xs">
                            Order ID: ${result.order_id} • Qty: ${result.quantity}
                        </div>
                    ` : `
                        <div class="text-xs">${result.error}</div>
                    `}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
    }

    // Start auto trail
    async function startAutoTrail() {
        if (selectedPositions.length === 0) {
            alert('Please select positions first');
            return;
        }

        const trailPoints = parseFloat(document.getElementById('trailPoints').value);
        
        if (!trailPoints || trailPoints <= 0) {
            alert('Please enter valid trail points');
            return;
        }

        if (!confirm(`Start AUTO trailing stop loss for ${selectedPositions.length} position(s) with ${trailPoints} points?`)) {
            return;
        }

        const resultDiv = document.getElementById('trailResult');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<div class="text-center py-4">Starting auto trail...</div>';

        try {
            const userId = sessionStorage.getItem('user_id');
            const response = await fetch(`${API_BASE_URL}/api/start-trail`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                },
                body: JSON.stringify({
                    positions: selectedPositions,
                    trail_points: trailPoints
                })
            });

            const data = await response.json();

            if (data.success) {
                displayTrailResults(data, 'Auto Trail Started');
                selectedPositions = [];
                renderPositions();
                updateSelectedInfo();
            } else {
                throw new Error(data.error || 'Failed to start auto trail');
            }

        } catch (error) {
            console.error('Error starting auto trail:', error);
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
        }
    }

    // Start manual trail
    async function startManualTrail() {
        if (selectedPositions.length === 0) {
            alert('Please select positions first');
            return;
        }

        const trailPoints = parseFloat(document.getElementById('trailPoints').value);
        
        if (!trailPoints || trailPoints <= 0) {
            alert('Please enter valid trail points');
            return;
        }

        if (!confirm(`Place MANUAL stop loss orders for ${selectedPositions.length} position(s) with ${trailPoints} points? You will need to modify these manually.`)) {
            return;
        }

        const resultDiv = document.getElementById('trailResult');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<div class="text-center py-4">Placing manual trail orders...</div>';

        try {
            const userId = sessionStorage.getItem('user_id');
            const response = await fetch(`${API_BASE_URL}/api/manual-trail`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                },
                body: JSON.stringify({
                    positions: selectedPositions,
                    trail_points: trailPoints
                })
            });

            const data = await response.json();

            if (data.success) {
                displayTrailResults(data, 'Manual Trail Orders Placed');
                selectedPositions = [];
                renderPositions();
                updateSelectedInfo();
            } else {
                throw new Error(data.error || 'Failed to place manual trail orders');
            }

        } catch (error) {
            console.error('Error placing manual trail:', error);
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
        }
    }

    // Display trail results
    function displayTrailResults(data, title) {
        const resultDiv = document.getElementById('trailResult');
        
        let html = `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
                <h3 class="font-bold text-lg mb-4">${title}</h3>
                <div class="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div>
                        <div class="text-2xl font-bold text-gray-900">${data.total}</div>
                        <div class="text-xs text-gray-600">Total</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-green-600">${data.successful}</div>
                        <div class="text-xs text-gray-600">Success</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-red-600">${data.failed}</div>
                        <div class="text-xs text-gray-600">Failed</div>
                    </div>
                </div>
                <div class="space-y-2 max-h-64 overflow-y-auto">
        `;

        data.results.forEach(result => {
            const statusClass = result.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700';
            html += `
                <div class="border-2 ${statusClass} rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-mono font-semibold text-sm">${result.symbol}</span>
                        <span class="text-xs font-bold">${result.success ? '✓ SUCCESS' : '✗ FAILED'}</span>
                    </div>
                    ${result.success ? `
                        <div class="text-xs">
                            Order ID: ${result.order_id} • 
                            Trigger: ₹${result.trigger_price.toFixed(2)} • 
                            Limit: ₹${result.limit_price.toFixed(2)}
                        </div>
                    ` : `
                        <div class="text-xs">${result.error}</div>
                    `}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
    }

    // Start status polling
    function startStatusPolling() {
        // Poll every 3 seconds
        statusInterval = setInterval(loadTrailingStatus, 3000);
        loadTrailingStatus(); // Initial load
    }

    // Load trailing status
    async function loadTrailingStatus() {
        try {
            const userId = sessionStorage.getItem('user_id');
            const response = await fetch(`${API_BASE_URL}/api/trailing-status`, {
                method: 'GET',
                headers: {
                    'X-User-ID': userId
                }
            });

            const data = await response.json();

            if (data.success) {
                trailingStatus = data;
                updateTrailingStatusDisplay();
                updateLogsDisplay();
            }

        } catch (error) {
            console.error('Error loading trailing status:', error);
        }
    }

    // Update trailing status display
    function updateTrailingStatusDisplay() {
        const container = document.getElementById('activeTrailsContainer');
        const statusBadge = document.getElementById('tickerStatus');

        if (!container) return;

        // Update ticker status
        if (statusBadge) {
            if (trailingStatus.ticker_connected) {
                statusBadge.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700';
                statusBadge.textContent = '● WebSocket Connected';
            } else {
                statusBadge.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700';
                statusBadge.textContent = '● WebSocket Disconnected';
            }
        }

        const activeTrails = trailingStatus.active_trails || [];

        if (activeTrails.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-gray-600">No active trailing positions</div>';
            return;
        }

        let html = '<div class="space-y-3">';

        activeTrails.forEach(trail => {
            const pnl = trail.pnl || 0;
            const pnlClass = pnl >= 0 ? 'text-green-600' : 'text-red-600';

            html += `
                <div class="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-mono font-bold text-lg">${trail.exchange}:${trail.symbol}</span>
                        <span class="text-xs text-gray-600">Updates: ${trail.update_count}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span class="text-gray-600">LTP:</span>
                            <span class="font-semibold ml-1">₹${trail.current_price.toFixed(2)}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Trigger SL:</span>
                            <span class="font-semibold ml-1">₹${trail.trigger_price.toFixed(2)}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">Limit Price:</span>
                            <span class="font-semibold ml-1">₹${trail.limit_price.toFixed(2)}</span>
                        </div>
                        <div>
                            <span class="text-gray-600">P&L:</span>
                            <span class="font-semibold ml-1 ${pnlClass}">₹${pnl.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Update logs display
    function updateLogsDisplay() {
        const container = document.getElementById('trailingLogs');
        
        if (!container) return;

        const logs = trailingStatus.logs || [];

        if (logs.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-gray-600">No logs yet</div>';
            return;
        }

        let html = '<div class="space-y-2">';

        // Show most recent logs first
        const recentLogs = logs.slice().reverse().slice(0, 20);

        recentLogs.forEach(log => {
            const time = new Date(log.time * 1000).toLocaleTimeString();
            html += `
                <div class="text-xs bg-gray-50 border border-gray-200 rounded p-2 font-mono">
                    <span class="text-gray-500">[${time}]</span> ${log.msg}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Auto-scroll to top (latest logs)
        container.scrollTop = 0;
    }

    // Cleanup on page unload
    function cleanup() {
        if (statusInterval) {
            clearInterval(statusInterval);
        }
    }

    // Expose public API
    window.ManagePositions = {
        init,
        togglePosition,
        cleanup
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

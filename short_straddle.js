// Short Straddle Module - IMPROVED ERROR HANDLING
// Automated straddle strategy with intelligent trailing stop loss


const STRADDLE_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://shark-app-hyd9r.ondigitalocean.app'
};

// State management
let currentStraddleStrategy = null;
let straddleStatusInterval = null;

// ===========================================
// FETCH STRADDLE STRATEGY (UNCHANGED)
// ===========================================

async function fetchShortStraddle() {
    const skipStrikes = parseInt(document.getElementById('straddleSkipStrikes').value);
    const expiry = parseInt(document.getElementById('straddleExpiry').value);
    const lots = parseInt(document.getElementById('straddleLots').value);
    const initialSlPercent = parseFloat(document.getElementById('straddleInitialSL').value);
    
    const resultDiv = document.getElementById('straddleResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Loading straddle strategy...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${STRADDLE_CONFIG.backendUrl}/api/straddle/fetch-short-straddle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                skip_strikes: skipStrikes,
                expiry_days: expiry
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentStraddleStrategy = { 
                ...data, 
                lots,
                initialSlPercent,
                trailPoints: 6,
                stepSize: 0.5
            };
            displayStraddleResult(data, lots, initialSlPercent);
        } else {
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to fetch strategy'}</div>`;
        }
    } catch (error) {
        console.error('Straddle fetch error:', error);
        resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

function displayStraddleResult(data, lots, initialSlPercent) {
    const resultDiv = document.getElementById('straddleResult');
    
    const atmCall = data.atm_call;
    const atmPut = data.atm_put;
    const hedgeCall = data.hedge_call;
    const hedgePut = data.hedge_put;
    
    const totalPremium = (atmCall.last_price + atmPut.last_price) * lots * atmCall.lot_size;
    const ceSlPrice = atmCall.last_price * (1 + initialSlPercent / 100);
    const peSlPrice = atmPut.last_price * (1 + initialSlPercent / 100);
    
    let html = `
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
            <div class="text-center">
                <div class="text-sm text-gray-600 mb-1">NIFTY 50</div>
                <div class="text-3xl font-bold text-gray-900">₹${data.nifty_price.toFixed(2)}</div>
                <div class="text-xs text-gray-500 mt-1">ATM Strike: ${data.atm_strike}</div>
            </div>
        </div>
        
        <div class="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-bold text-gray-900">Strategy Summary</h4>
                <span class="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">SHORT STRADDLE</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-600">Total Premium:</span>
                    <span class="font-bold text-green-600 ml-2">₹${totalPremium.toFixed(2)}</span>
                </div>
                <div>
                    <span class="text-gray-600">Initial SL:</span>
                    <span class="font-bold text-red-600 ml-2">${initialSlPercent}%</span>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">ATM CALL (Sell)</h4>
                    <span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">SELL</span>
                </div>
                <div class="space-y-2 text-sm">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${atmCall.symbol}</span></div>
                    <div><span class="text-gray-600">Strike:</span> <span class="font-bold">${atmCall.strike}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${atmCall.last_price.toFixed(2)}</span></div>
                    <div><span class="text-gray-600">Initial SL:</span> <span class="font-bold text-red-600">₹${ceSlPrice.toFixed(2)}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
            </div>
            
            <div class="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">ATM PUT (Sell)</h4>
                    <span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">SELL</span>
                </div>
                <div class="space-y-2 text-sm">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${atmPut.symbol}</span></div>
                    <div><span class="text-gray-600">Strike:</span> <span class="font-bold">${atmPut.strike}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${atmPut.last_price.toFixed(2)}</span></div>
                    <div><span class="text-gray-600">Initial SL:</span> <span class="font-bold text-red-600">₹${peSlPrice.toFixed(2)}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
            </div>
        </div>
        
        <div class="mb-4">
            <h4 class="font-bold text-gray-700 mb-2 text-sm">Hedge Positions</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-gray-700">Hedge CALL (Buy)</span>
                        <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                    </div>
                    <div class="text-xs space-y-1">
                        <div><span class="text-gray-600">Strike:</span> <span class="font-bold">${hedgeCall.strike}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedgeCall.last_price.toFixed(2)}</span></div>
                    </div>
                </div>
                
                <div class="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-semibold text-gray-700">Hedge PUT (Buy)</span>
                        <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                    </div>
                    <div class="text-xs space-y-1">
                        <div><span class="text-gray-600">Strike:</span> <span class="font-bold">${hedgePut.strike}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedgePut.last_price.toFixed(2)}</span></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="flex flex-wrap gap-3 justify-center">
            <button onclick="checkStraddleMargin()" 
                    class="border-2 border-blue-500 text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-all">
                Check Margin
            </button>
            <button onclick="deployStraddle()" 
                    class="btn-primary text-white font-semibold px-8 py-3 rounded-lg">
                Deploy Straddle
            </button>
        </div>
        
        <div id="straddleMarginResult" class="hidden mt-4"></div>
    `;
    
    resultDiv.innerHTML = html;
}

// ===========================================
// MARGIN CHECK (UNCHANGED - WORKING)
// ===========================================

async function checkStraddleMargin() {
    if (!currentStraddleStrategy) return;
    
    const marginDiv = document.getElementById('straddleMarginResult');
    marginDiv.innerHTML = '<p class="text-center py-4 text-gray-600">Checking margin...</p>';
    marginDiv.classList.remove('hidden');
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const orders = [
            {
                exchange: 'NFO',
                tradingsymbol: currentStraddleStrategy.hedge_call.symbol,
                transaction_type: 'BUY',
                lots: currentStraddleStrategy.lots,
                product: 'MIS',
                order_type: 'MARKET',
                price: 0
            },
            {
                exchange: 'NFO',
                tradingsymbol: currentStraddleStrategy.hedge_put.symbol,
                transaction_type: 'BUY',
                lots: currentStraddleStrategy.lots,
                product: 'MIS',
                order_type: 'MARKET',
                price: 0
            },
            {
                exchange: 'NFO',
                tradingsymbol: currentStraddleStrategy.atm_call.symbol,
                transaction_type: 'SELL',
                lots: currentStraddleStrategy.lots,
                product: 'MIS',
                order_type: 'MARKET',
                price: 0
            },
            {
                exchange: 'NFO',
                tradingsymbol: currentStraddleStrategy.atm_put.symbol,
                transaction_type: 'SELL',
                lots: currentStraddleStrategy.lots,
                product: 'MIS',
                order_type: 'MARKET',
                price: 0
            }
        ];
        
        const response = await fetch(`${STRADDLE_CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({ orders })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const html = `
                <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
                    <h4 class="font-bold text-gray-900 mb-3">Margin Requirement</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between text-sm">
                            <span class="font-semibold">Available Balance:</span>
                            <span class="font-bold text-green-600">₹${data.available_balance.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="font-semibold">Required Margin:</span>
                            <span class="font-bold text-blue-600">₹${data.total_required.toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between text-sm pt-2 border-t-2 border-gray-300">
                            <span class="font-semibold">Status:</span>
                            <span class="font-bold ${data.sufficient ? 'text-green-600' : 'text-red-600'}">
                                ${data.sufficient ? '✓ Sufficient' : '✗ Insufficient'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            marginDiv.innerHTML = html;
        } else {
            marginDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to check margin'}</div>`;
        }
    } catch (error) {
        console.error('Margin check error:', error);
        marginDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

// ===========================================
// DEPLOY STRADDLE (IMPROVED WITH BETTER ERROR HANDLING)
// ===========================================

async function deployStraddle() {
    if (!currentStraddleStrategy) {
        showToast('Please fetch straddle strategy first', 'error');
        return;
    }
    
    if (!confirm('Deploy Short Straddle with automated trailing stop loss?')) return;
    
    const resultDiv = document.getElementById('straddleResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Deploying straddle strategy...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        if (!userId) {
            throw new Error('No user session found. Please login again.');
        }
        
        const lots = currentStraddleStrategy.lots;
        const lotSize = currentStraddleStrategy.atm_call.lot_size;
        
        // Prepare orders - Hedges first to reduce margin
        const orders = [
            {
                tradingsymbol: currentStraddleStrategy.hedge_call.symbol,
                token: currentStraddleStrategy.hedge_call.token,
                transaction_type: 'BUY',
                quantity: lots * lotSize,
                product: 'MIS',
                label: 'Hedge CE (Buy)'
            },
            {
                tradingsymbol: currentStraddleStrategy.hedge_put.symbol,
                token: currentStraddleStrategy.hedge_put.token,
                transaction_type: 'BUY',
                quantity: lots * lotSize,
                product: 'MIS',
                label: 'Hedge PE (Buy)'
            },
            {
                tradingsymbol: currentStraddleStrategy.atm_call.symbol,
                token: currentStraddleStrategy.atm_call.token,
                transaction_type: 'SELL',
                quantity: lots * lotSize,
                product: 'MIS',
                label: 'ATM CE (Sell)'
            },
            {
                tradingsymbol: currentStraddleStrategy.atm_put.symbol,
                token: currentStraddleStrategy.atm_put.token,
                transaction_type: 'SELL',
                quantity: lots * lotSize,
                product: 'MIS',
                label: 'ATM PE (Sell)'
            }
        ];
        
        const requestPayload = {
            orders: orders,
            initial_sl_percent: currentStraddleStrategy.initialSlPercent,
            trail_points: 6,
            step_size: 0.5
        };
        
        console.log('=== DEPLOYMENT DEBUG ===');
        console.log('Backend URL:', STRADDLE_CONFIG.backendUrl);
        console.log('Full URL:', `${STRADDLE_CONFIG.backendUrl}/api/straddle/deploy-straddle`);
        console.log('User ID:', userId);
        console.log('Request Payload:', JSON.stringify(requestPayload, null, 2));
        console.log('Orders:', orders);
        console.log('======================');
        
        const response = await fetch(`${STRADDLE_CONFIG.backendUrl}/api/straddle/deploy-straddle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify(requestPayload),
            mode: 'cors',
            credentials: 'same-origin'
        });
        
        console.log('Response status:', response.status);
        console.log('Response OK:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            displayDeploymentResult(data);
            
            if (data.all_completed) {
                showToast('✅ Straddle deployed successfully!', 'success');
                setTimeout(() => startStraddleMonitoring(), 1000);
            } else {
                showToast('⚠️ Orders placed but some are pending', 'warning');
            }
        } else {
            throw new Error(data.error || 'Deployment failed');
        }
        
    } catch (error) {
        console.error('=== DEPLOYMENT ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=======================');
        
        let errorMessage = 'Deployment failed: ';
        
        if (error.message === 'Failed to fetch') {
            errorMessage += 'Cannot connect to server. Please check:\n';
            errorMessage += '1. Is the server running?\n';
            errorMessage += '2. Backend URL: ' + STRADDLE_CONFIG.backendUrl + '\n';
            errorMessage += '3. Check browser console for CORS errors';
        } else {
            errorMessage += error.message;
        }
        
        resultDiv.innerHTML = `
            <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <h4 class="font-bold text-red-800 mb-2">❌ Deployment Error</h4>
                <pre class="text-xs text-red-700 whitespace-pre-wrap">${errorMessage}</pre>
                <div class="mt-3 text-xs text-red-600">
                    <p>Debug info:</p>
                    <p>• Backend: ${STRADDLE_CONFIG.backendUrl}</p>
                    <p>• Endpoint: /api/straddle/deploy-straddle</p>
                    <p>• Check browser console (F12) for more details</p>
                </div>
            </div>
        `;
        
        showToast('❌ ' + error.message, 'error');
    }
}

function displayDeploymentResult(data) {
    const resultDiv = document.getElementById('straddleResult');
    
    let html = `
        <div class="bg-white rounded-lg p-6 space-y-4">
            <div class="flex items-center justify-between pb-4 border-b-2 border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">Deployment Result</h3>
                <span class="px-4 py-2 ${data.all_completed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'} text-sm font-semibold rounded-full">
                    ${data.all_completed ? '✓ COMPLETED' : '⏳ PENDING'}
                </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    `;
    
    if (data.order_results) {
        data.order_results.forEach(result => {
            const isSuccess = result.success;
            const isComplete = result.status === 'COMPLETE';
            const borderColor = isComplete ? 'border-green-300' : isSuccess ? 'border-orange-300' : 'border-red-300';
            const bgColor = isComplete ? 'bg-green-50' : isSuccess ? 'bg-orange-50' : 'bg-red-50';
            const statusBadge = isComplete ? 'bg-green-100 text-green-700' : isSuccess ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
            
            html += `
                <div class="border-2 ${borderColor} ${bgColor} rounded-lg p-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-bold">${result.label || result.symbol}</span>
                        <span class="px-2 py-1 ${statusBadge} text-xs font-semibold rounded">
                            ${result.status || (isSuccess ? 'PLACED' : 'FAILED')}
                        </span>
                    </div>
                    <div class="text-xs space-y-1">
                        ${result.order_id ? `<div>Order ID: ${result.order_id}</div>` : ''}
                        ${result.average_price ? `<div>Avg Price: ₹${result.average_price.toFixed(2)}</div>` : ''}
                        ${result.filled_quantity ? `<div>Filled: ${result.filled_quantity}</div>` : ''}
                        ${result.error ? `<div class="text-red-600">Error: ${result.error}</div>` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    
    if (data.all_completed) {
        html += `
            <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex items-start">
                    <svg class="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    <div class="text-sm text-green-800">
                        <strong>All Orders Executed!</strong>
                        <p class="mt-1">Automated trailing monitoring is now active.</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    resultDiv.innerHTML = html;
}

// ===========================================
// MONITORING (UNCHANGED)
// ===========================================

function startStraddleMonitoring() {
    if (straddleStatusInterval) clearInterval(straddleStatusInterval);
    document.getElementById('straddleMonitor').classList.remove('hidden');
    updateStraddleStatus();
    straddleStatusInterval = setInterval(updateStraddleStatus, 3000);
}

async function updateStraddleStatus() {
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${STRADDLE_CONFIG.backendUrl}/api/straddle/straddle-status`, {
            headers: { 'X-User-ID': userId }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            displayStraddleStatus(data);
        }
    } catch (error) {
        console.error('Status update error:', error);
    }
}

function displayStraddleStatus(data) {
    const statusDiv = document.getElementById('straddleStatusContent');
    const logsDiv = document.getElementById('straddleLogsContent');
    
    if (data.active_straddles && data.active_straddles.length > 0) {
        let html = '<div class="space-y-3">';
        data.active_straddles.forEach(straddle => {
            const statusColor = straddle.status === 'active' ? 'green' : 
                                straddle.status === 'completed' ? 'gray' : 'orange';
            html += `
                <div class="border-2 border-${statusColor}-200 bg-${statusColor}-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                        <span class="font-mono text-sm font-bold">${straddle.straddle_id}</span>
                        <span class="px-3 py-1 bg-${statusColor}-100 text-${statusColor}-700 text-xs font-semibold rounded-full">
                            ${straddle.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div class="text-gray-600 text-xs mb-1">CE Status</div>
                            <div class="font-bold ${straddle.ce_sl_hit ? 'text-red-600' : 'text-green-600'}">
                                ${straddle.ce_sl_hit ? '✗ SL Hit' : '✓ Active'}
                            </div>
                            ${straddle.ce_current_sl ? `<div class="text-xs text-gray-600 mt-1">SL: ₹${straddle.ce_current_sl.toFixed(2)}</div>` : ''}
                        </div>
                        <div>
                            <div class="text-gray-600 text-xs mb-1">PE Status</div>
                            <div class="font-bold ${straddle.pe_sl_hit ? 'text-red-600' : 'text-green-600'}">
                                ${straddle.pe_sl_hit ? '✗ SL Hit' : '✓ Active'}
                            </div>
                            ${straddle.pe_current_sl ? `<div class="text-xs text-gray-600 mt-1">SL: ₹${straddle.pe_current_sl.toFixed(2)}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        statusDiv.innerHTML = html;
    } else {
        statusDiv.innerHTML = '<div class="text-center text-gray-500 py-8">No active straddles</div>';
    }
    
    if (data.logs && data.logs.length > 0) {
        let logsHtml = '<div class="space-y-2">';
        data.logs.reverse().forEach(log => {
            let logClass = 'log-entry info';
            if (log.message.includes('✅') || log.message.includes('✓')) logClass = 'log-entry success';
            else if (log.message.includes('❌') || log.message.includes('⚠️')) logClass = 'log-entry error';
            logsHtml += `
                <div class="${logClass}">
                    <div class="flex items-start justify-between">
                        <span class="text-xs flex-1">${log.message}</span>
                        <span class="text-xs text-gray-500 ml-2 whitespace-nowrap">${log.timestamp}</span>
                    </div>
                </div>
            `;
        });
        logsHtml += '</div>';
        logsDiv.innerHTML = logsHtml;
    } else {
        logsDiv.innerHTML = '<div class="text-center text-gray-500 py-4 text-sm">No logs yet</div>';
    }
}

function stopStraddleMonitoring() {
    if (straddleStatusInterval) {
        clearInterval(straddleStatusInterval);
        straddleStatusInterval = null;
    }
    document.getElementById('straddleMonitor').classList.add('hidden');
}

// ===========================================
// TOAST NOTIFICATION
// ===========================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 
                    type === 'error' ? 'bg-red-500' : 
                    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
    
    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => document.body.removeChild(toast), 3000);
}

// ===========================================
// EVENT LISTENERS
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    const fetchBtn = document.getElementById('fetchStraddleBtn');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchShortStraddle);
    }
    
    // Test backend connection
    console.log('Short Straddle Module Loaded');
    console.log('Backend URL:', STRADDLE_CONFIG.backendUrl);
    console.log('Current hostname:', window.location.hostname);
});

console.log('Short Straddle module initialized');

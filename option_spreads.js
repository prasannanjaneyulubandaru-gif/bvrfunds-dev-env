// Option Spreads Module
// Handles Put and Call Option Spread strategies

const OPTION_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// ===========================================
// PUT OPTION SPREAD
// ===========================================

async function fetchPutOptionSpread() {
    const skipStrikes = parseInt(document.getElementById('putSkipStrikes').value);
    const expiry = parseInt(document.getElementById('putExpiry').value);
    const lots = parseInt(document.getElementById('putLots').value);
    
    const resultDiv = document.getElementById('putSpreadResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Loading...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${OPTION_CONFIG.backendUrl}/api/strategy/put-option-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                skip_strikes: skipStrikes,
                expiry: expiry
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayPutSpreadResult(data, lots);
        } else {
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to fetch strategy'}</div>`;
        }
    } catch (error) {
        console.error('Put spread error:', error);
        resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

function displayPutSpreadResult(data, lots) {
    const resultDiv = document.getElementById('putSpreadResult');
    
    const atm = data.atm;
    const hedge = data.hedge;
    
    let html = `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- ATM PUT -->
                <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-gray-900">ATM PUT (Sell)</h4>
                        <span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">SELL</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${atm.symbol}</span></div>
                        <div><span class="text-gray-600">Token:</span> <span class="font-mono">${atm.token}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${atm.last_price?.toFixed(2) || 'N/A'}</span></div>
                        <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                    </div>
                </div>
                
                <!-- HEDGE PUT -->
                <div class="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-gray-900">PUT Hedge (Buy)</h4>
                        <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${hedge.symbol}</span></div>
                        <div><span class="text-gray-600">Token:</span> <span class="font-mono">${hedge.token}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedge.last_price?.toFixed(2) || 'N/A'}</span></div>
                        <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-3 justify-center">
                <button onclick="addPutSpreadToBasket(${JSON.stringify(atm).replace(/"/g, '&quot;')}, ${JSON.stringify(hedge).replace(/"/g, '&quot;')}, ${lots})" 
                        class="btn-primary text-white font-semibold px-6 py-3 rounded-lg">
                    Add to Basket
                </button>
                <button onclick="showBasketModal()" 
                        class="border-2 border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50">
                    View Basket (${window.BasketManager.getCount()})
                </button>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

function addPutSpreadToBasket(atm, hedge, lots) {
    // Add ATM PUT (Sell)
    window.BasketManager.addOrder({
        exchange: 'NFO',
        tradingsymbol: atm.symbol,
        transaction_type: 'SELL',
        lots: lots,
        product: 'MIS',
        order_type: 'MARKET',
        variety: 'regular'
    });
    
    // Add Hedge PUT (Buy)
    window.BasketManager.addOrder({
        exchange: 'NFO',
        tradingsymbol: hedge.symbol,
        transaction_type: 'BUY',
        lots: lots,
        product: 'MIS',
        order_type: 'MARKET',
        variety: 'regular'
    });
    
    alert('✓ Put Option Spread added to basket!');
    updateBasketCountDisplay();
}

// ===========================================
// CALL OPTION SPREAD
// ===========================================

async function fetchCallOptionSpread() {
    const skipStrikes = parseInt(document.getElementById('callSkipStrikes').value);
    const expiry = parseInt(document.getElementById('callExpiry').value);
    const lots = parseInt(document.getElementById('callLots').value);
    
    const resultDiv = document.getElementById('callSpreadResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Loading...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${OPTION_CONFIG.backendUrl}/api/strategy/call-option-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                skip_strikes: skipStrikes,
                expiry: expiry
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayCallSpreadResult(data, lots);
        } else {
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to fetch strategy'}</div>`;
        }
    } catch (error) {
        console.error('Call spread error:', error);
        resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

function displayCallSpreadResult(data, lots) {
    const resultDiv = document.getElementById('callSpreadResult');
    
    const atm = data.atm;
    const hedge = data.hedge;
    
    let html = `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- ATM CALL -->
                <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-gray-900">ATM CALL (Sell)</h4>
                        <span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">SELL</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${atm.symbol}</span></div>
                        <div><span class="text-gray-600">Token:</span> <span class="font-mono">${atm.token}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${atm.last_price?.toFixed(2) || 'N/A'}</span></div>
                        <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                    </div>
                </div>
                
                <!-- HEDGE CALL -->
                <div class="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-gray-900">CALL Hedge (Buy)</h4>
                        <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${hedge.symbol}</span></div>
                        <div><span class="text-gray-600">Token:</span> <span class="font-mono">${hedge.token}</span></div>
                        <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedge.last_price?.toFixed(2) || 'N/A'}</span></div>
                        <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-3 justify-center">
                <button onclick="addCallSpreadToBasket(${JSON.stringify(atm).replace(/"/g, '&quot;')}, ${JSON.stringify(hedge).replace(/"/g, '&quot;')}, ${lots})" 
                        class="btn-primary text-white font-semibold px-6 py-3 rounded-lg">
                    Add to Basket
                </button>
                <button onclick="showBasketModal()" 
                        class="border-2 border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50">
                    View Basket (${window.BasketManager.getCount()})
                </button>
            </div>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

function addCallSpreadToBasket(atm, hedge, lots) {
    // Add ATM CALL (Sell)
    window.BasketManager.addOrder({
        exchange: 'NFO',
        tradingsymbol: atm.symbol,
        transaction_type: 'SELL',
        lots: lots,
        product: 'MIS',
        order_type: 'MARKET',
        variety: 'regular'
    });
    
    // Add Hedge CALL (Buy)
    window.BasketManager.addOrder({
        exchange: 'NFO',
        tradingsymbol: hedge.symbol,
        transaction_type: 'BUY',
        lots: lots,
        product: 'MIS',
        order_type: 'MARKET',
        variety: 'regular'
    });
    
    alert('✓ Call Option Spread added to basket!');
    updateBasketCountDisplay();
}

// ===========================================
// EVENT LISTENERS
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    // Put Option Spread
    const fetchPutBtn = document.getElementById('fetchPutSpreadBtn');
    if (fetchPutBtn) {
        fetchPutBtn.addEventListener('click', fetchPutOptionSpread);
    }
    
    // Call Option Spread
    const fetchCallBtn = document.getElementById('fetchCallSpreadBtn');
    if (fetchCallBtn) {
        fetchCallBtn.addEventListener('click', fetchCallOptionSpread);
    }
});

console.log('Option Spreads module initialized');

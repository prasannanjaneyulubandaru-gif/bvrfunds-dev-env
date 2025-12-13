// Future Spreads Module
// Handles Bullish and Bearish Future Spread strategies

const FUTURE_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// ===========================================
// BULLISH FUTURE SPREAD
// ===========================================

async function fetchBullishFutureSpread() {
    const lowerPremium = parseFloat(document.getElementById('bullishLowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('bullishUpperPremium').value);
    const days = parseInt(document.getElementById('bullishDays').value);
    const lots = parseInt(document.getElementById('bullishLots').value);
    
    const resultDiv = document.getElementById('bullishSpreadResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Loading...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${FUTURE_CONFIG.backendUrl}/api/strategy/bullish-future-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                lower_premium: lowerPremium,
                upper_premium: upperPremium,
                days: days
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayBullishSpreadResult(data, lots);
        } else {
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to fetch strategy'}</div>`;
        }
    } catch (error) {
        console.error('Bullish spread error:', error);
        resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

function displayBullishSpreadResult(data, lots) {
    const resultDiv = document.getElementById('bullishSpreadResult');
    
    const future = data.future;
    const hedge = data.hedge;
    
    let html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- FUTURE -->
            <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">NIFTY Future (Buy)</h4>
                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                </div>
                <div class="space-y-2 text-sm mb-4">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${future.symbol}</span></div>
                    <div><span class="text-gray-600">Token:</span> <span class="font-mono">${future.token}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${future.last_price?.toFixed(2) || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
                <button onclick="addSingleOrderToBasket('${future.symbol}', ${future.token}, 'BUY', ${lots})" 
                        class="w-full btn-primary text-white font-semibold py-2 rounded-lg text-sm">
                    Add to Basket
                </button>
            </div>
            
            <!-- PUT HEDGE -->
            ${hedge ? `
            <div class="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">PUT Hedge (Buy)</h4>
                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                </div>
                <div class="space-y-2 text-sm mb-4">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${hedge.symbol}</span></div>
                    <div><span class="text-gray-600">Token:</span> <span class="font-mono">${hedge.token}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedge.last_price?.toFixed(2) || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
                <button onclick="addSingleOrderToBasket('${hedge.symbol}', ${hedge.token}, 'BUY', ${lots})" 
                        class="w-full btn-primary text-white font-semibold py-2 rounded-lg text-sm">
                    Add to Basket
                </button>
            </div>
            ` : `
            <div class="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <div class="text-center py-4">
                    <p class="text-yellow-700 font-semibold">⚠️ No PUT hedge found</p>
                    <p class="text-sm text-yellow-600 mt-2">Try adjusting premium range</p>
                </div>
            </div>
            `}
        </div>
        
        <div class="flex gap-3 justify-center">
            <button onclick="showBasketModal()" 
                    class="border-2 border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50">
                View Basket (${window.BasketManager.getCount()})
            </button>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// ===========================================
// BEARISH FUTURE SPREAD
// ===========================================

async function fetchBearishFutureSpread() {
    const lowerPremium = parseFloat(document.getElementById('bearishLowerPremium').value);
    const upperPremium = parseFloat(document.getElementById('bearishUpperPremium').value);
    const days = parseInt(document.getElementById('bearishDays').value);
    const lots = parseInt(document.getElementById('bearishLots').value);
    
    const resultDiv = document.getElementById('bearishSpreadResult');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Loading...</div>';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        
        const response = await fetch(`${FUTURE_CONFIG.backendUrl}/api/strategy/bearish-future-spread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                lower_premium: lowerPremium,
                upper_premium: upperPremium,
                days: days
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayBearishSpreadResult(data, lots);
        } else {
            resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${data.error || 'Failed to fetch strategy'}</div>`;
        }
    } catch (error) {
        console.error('Bearish spread error:', error);
        resultDiv.innerHTML = `<div class="text-center py-4 text-red-600">Error: ${error.message}</div>`;
    }
}

function displayBearishSpreadResult(data, lots) {
    const resultDiv = document.getElementById('bearishSpreadResult');
    
    const future = data.future;
    const hedge = data.hedge;
    
    let html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- FUTURE -->
            <div class="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">NIFTY Future (Sell)</h4>
                    <span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">SELL</span>
                </div>
                <div class="space-y-2 text-sm mb-4">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${future.symbol}</span></div>
                    <div><span class="text-gray-600">Token:</span> <span class="font-mono">${future.token}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${future.last_price?.toFixed(2) || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
                <button onclick="addSingleOrderToBasket('${future.symbol}', ${future.token}, 'SELL', ${lots})" 
                        class="w-full btn-primary text-white font-semibold py-2 rounded-lg text-sm">
                    Add to Basket
                </button>
            </div>
            
            <!-- CALL HEDGE -->
            ${hedge ? `
            <div class="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-bold text-gray-900">CALL Hedge (Buy)</h4>
                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">BUY</span>
                </div>
                <div class="space-y-2 text-sm mb-4">
                    <div><span class="text-gray-600">Symbol:</span> <span class="font-mono font-semibold">${hedge.symbol}</span></div>
                    <div><span class="text-gray-600">Token:</span> <span class="font-mono">${hedge.token}</span></div>
                    <div><span class="text-gray-600">LTP:</span> <span class="font-bold text-green-600">₹${hedge.last_price?.toFixed(2) || 'N/A'}</span></div>
                    <div><span class="text-gray-600">Lots:</span> <span class="font-bold">${lots}</span></div>
                </div>
                <button onclick="addSingleOrderToBasket('${hedge.symbol}', ${hedge.token}, 'BUY', ${lots})" 
                        class="w-full btn-primary text-white font-semibold py-2 rounded-lg text-sm">
                    Add to Basket
                </button>
            </div>
            ` : `
            <div class="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <div class="text-center py-4">
                    <p class="text-yellow-700 font-semibold">⚠️ No CALL hedge found</p>
                    <p class="text-sm text-yellow-600 mt-2">Try adjusting premium range</p>
                </div>
            </div>
            `}
        </div>
        
        <div class="flex gap-3 justify-center">
            <button onclick="showBasketModal()" 
                    class="border-2 border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50">
                View Basket (${window.BasketManager.getCount()})
            </button>
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

// ===========================================
// SHARED FUNCTION - ADD SINGLE ORDER
// ===========================================

function addSingleOrderToBasket(symbol, token, transactionType, lots) {
    window.BasketManager.addOrder({
        exchange: 'NFO',
        tradingsymbol: symbol,
        transaction_type: transactionType,
        lots: lots,
        product: 'MIS',
        order_type: 'MARKET',
        variety: 'regular'
    });
    
    alert(`✓ ${symbol} (${transactionType}) added to basket!`);
    updateBasketCountDisplay();
}

// ===========================================
// EVENT LISTENERS
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    // Bullish Future Spread
    const fetchBullishBtn = document.getElementById('fetchBullishSpreadBtn');
    if (fetchBullishBtn) {
        fetchBullishBtn.addEventListener('click', fetchBullishFutureSpread);
    }
    
    // Bearish Future Spread
    const fetchBearishBtn = document.getElementById('fetchBearishSpreadBtn');
    if (fetchBearishBtn) {
        fetchBearishBtn.addEventListener('click', fetchBearishFutureSpread);
    }
});

console.log('Future Spreads module initialized');

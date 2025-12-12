// Future Spreads Module
// Handles Bullish and Bearish Future Spread strategies

const FUTURE_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://shark-app-hyd9r.ondigitalocean.app'
};

// State for future spreads
let futureSpreadState = {
    currentStrategy: null, // 'bullish' or 'bearish'
    instrumentsFound: false,
    futureData: null,
    hedgeData: null,
    deployModalOpen: false
};

// Initialize when page loads
let futureSpreadInitialized = false;

function initializeFutureSpreads() {
    if (futureSpreadInitialized) return;
    
    console.log('Initializing Future Spreads...');
    setupFutureSpreadListeners();
    futureSpreadInitialized = true;
}

// Auto-initialize
window.addEventListener('load', () => {
    setTimeout(() => {
        if (document.getElementById('futureSpreadsPage')) {
            initializeFutureSpreads();
        }
    }, 500);
});

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupFutureSpreadListeners() {
    // Find Instruments buttons
    const bullishFindBtn = document.getElementById('bullishFutureFindBtn');
    const bearishFindBtn = document.getElementById('bearishFutureFindBtn');
    
    if (bullishFindBtn) {
        bullishFindBtn.addEventListener('click', () => findFutureSpread('bullish'));
    }
    
    if (bearishFindBtn) {
        bearishFindBtn.addEventListener('click', () => findFutureSpread('bearish'));
    }
    
    // Deploy buttons
    const bullishDeployBtn = document.getElementById('bullishFutureDeployBtn');
    const bearishDeployBtn = document.getElementById('bearishFutureDeployBtn');
    
    if (bullishDeployBtn) {
        bullishDeployBtn.addEventListener('click', () => openDeployModal('bullish'));
    }
    
    if (bearishDeployBtn) {
        bearishDeployBtn.addEventListener('click', () => openDeployModal('bearish'));
    }
    
    // Modal buttons
    const closeModalBtn = document.getElementById('closeFutureDeployModal');
    const addFutureToBasketBtn = document.getElementById('addFutureToBasket');
    const addHedgeToBasketBtn = document.getElementById('addHedgeToBasket');
    const checkMarginBtn = document.getElementById('checkFutureMargin');
    const deployOrdersBtn = document.getElementById('deployFutureOrders');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDeployModal);
    }
    
    if (addFutureToBasketBtn) {
        addFutureToBasketBtn.addEventListener('click', () => addToBasket('future'));
    }
    
    if (addHedgeToBasketBtn) {
        addHedgeToBasketBtn.addEventListener('click', () => addToBasket('hedge'));
    }
    
    if (checkMarginBtn) {
        checkMarginBtn.addEventListener('click', checkMargin);
    }
    
    if (deployOrdersBtn) {
        deployOrdersBtn.addEventListener('click', deployOrders);
    }
    
    console.log('Future Spread listeners setup complete');
}

// ===========================================
// FIND INSTRUMENTS
// ===========================================

async function findFutureSpread(strategy) {
    console.log('Finding', strategy, 'future spread...');
    
    futureSpreadState.currentStrategy = strategy;
    
    const resultsDiv = document.getElementById(`${strategy}FutureResults`);
    const findBtn = document.getElementById(`${strategy}FutureFindBtn`);
    const deployBtn = document.getElementById(`${strategy}FutureDeployBtn`);
    
    // Show loading
    resultsDiv.innerHTML = '<div class="text-center py-8"><div class="text-gray-600">Finding instruments...</div></div>';
    findBtn.disabled = true;
    findBtn.textContent = 'Searching...';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        const endpoint = strategy === 'bullish' 
            ? '/api/strategy/bullish-future-spread'
            : '/api/strategy/bearish-future-spread';
        
        const response = await fetch(`${FUTURE_CONFIG.backendUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                lower_premium: 40,
                upper_premium: 60
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            futureSpreadState.instrumentsFound = true;
            futureSpreadState.futureData = data.future;
            futureSpreadState.hedgeData = data.hedge;
            
            displayInstruments(strategy, data);
            deployBtn.classList.remove('hidden');
        } else {
            throw new Error(data.error || 'Failed to find instruments');
        }
    } catch (error) {
        console.error('Find instruments error:', error);
        resultsDiv.innerHTML = `
            <div class="text-center py-8">
                <div class="text-red-600 font-semibold mb-2">Error</div>
                <div class="text-sm text-gray-600">${error.message}</div>
            </div>
        `;
    } finally {
        findBtn.disabled = false;
        findBtn.innerHTML = '<span class="mr-2">🔍</span> Find Instruments';
    }
}

function displayInstruments(strategy, data) {
    const resultsDiv = document.getElementById(`${strategy}FutureResults`);
    const isBullish = strategy === 'bullish';
    
    const futureColor = isBullish ? 'blue' : 'red';
    const hedgeColor = isBullish ? 'green' : 'orange';
    const hedgeType = isBullish ? 'PUT HEDGE' : 'CALL HEDGE';
    
    resultsDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Future -->
            <div class="bg-${futureColor}-50 border-2 border-${futureColor}-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-${futureColor}-700 bg-${futureColor}-100 px-2 py-1 rounded">FUTURE</span>
                    <span class="text-xs font-bold text-${futureColor}-700 bg-white px-2 py-1 rounded border border-${futureColor}-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.future.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.future.token}</div>
                <div class="text-2xl font-bold text-${futureColor}-700">${BasketManager.formatCurrency(data.future.last_price)}</div>
            </div>
            
            <!-- Hedge -->
            <div class="bg-${hedgeColor}-50 border-2 border-${hedgeColor}-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-${hedgeColor}-700 bg-${hedgeColor}-100 px-2 py-1 rounded">${hedgeType}</span>
                    <span class="text-xs font-bold text-${hedgeColor}-700 bg-white px-2 py-1 rounded border border-${hedgeColor}-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.hedge.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.hedge.token}</div>
                <div class="text-2xl font-bold text-${hedgeColor}-700">${BasketManager.formatCurrency(data.hedge.last_price)}</div>
            </div>
        </div>
    `;
}

// ===========================================
// DEPLOY MODAL
// ===========================================

function openDeployModal(strategy) {
    if (!futureSpreadState.instrumentsFound) {
        alert('Please find instruments first');
        return;
    }
    
    futureSpreadState.currentStrategy = strategy;
    futureSpreadState.deployModalOpen = true;
    
    const modal = document.getElementById('futureDeployModal');
    const modalTitle = document.getElementById('futureModalTitle');
    
    modalTitle.textContent = `Deploy ${strategy === 'bullish' ? 'Bullish' : 'Bearish'} Future Spread`;
    
    // Set default values
    document.getElementById('futureTransactionType').value = strategy === 'bullish' ? 'BUY' : 'SELL';
    document.getElementById('futureLots').value = '1';
    document.getElementById('futureOrderType').value = 'MARKET';
    document.getElementById('futureProduct').value = 'MIS';
    
    document.getElementById('hedgeTransactionType').value = 'BUY';
    document.getElementById('hedgeLots').value = '1';
    document.getElementById('hedgeOrderType').value = 'MARKET';
    document.getElementById('hedgeProduct').value = 'MIS';
    
    // Update labels
    document.getElementById('futureLabel').textContent = futureSpreadState.futureData.symbol;
    document.getElementById('hedgeLabel').textContent = futureSpreadState.hedgeData.symbol;
    
    // Clear previous results
    document.getElementById('futureMarginResult').classList.add('hidden');
    document.getElementById('futureDeployResult').classList.add('hidden');
    
    // Clear basket
    BasketManager.clearBasket();
    updateBasketUI();
    
    modal.classList.remove('hidden');
}

function closeDeployModal() {
    const modal = document.getElementById('futureDeployModal');
    modal.classList.add('hidden');
    futureSpreadState.deployModalOpen = false;
}

// ===========================================
// BASKET OPERATIONS
// ===========================================

function addToBasket(leg) {
    const isFuture = leg === 'future';
    const prefix = isFuture ? 'future' : 'hedge';
    
    const transactionType = document.getElementById(`${prefix}TransactionType`).value;
    const lots = parseInt(document.getElementById(`${prefix}Lots`).value);
    const orderType = document.getElementById(`${prefix}OrderType`).value;
    const product = document.getElementById(`${prefix}Product`).value;
    
    if (!lots || lots < 1) {
        alert('Please enter valid lots');
        return;
    }
    
    const instrumentData = isFuture ? futureSpreadState.futureData : futureSpreadState.hedgeData;
    
    const order = {
        exchange: 'NFO',
        tradingsymbol: instrumentData.symbol,
        transaction_type: transactionType,
        lots: lots,
        order_type: orderType,
        product: product,
        variety: 'regular'
    };
    
    BasketManager.addOrder(order);
    updateBasketUI();
    
    // Show success feedback
    const btn = document.getElementById(isFuture ? 'addFutureToBasket' : 'addHedgeToBasket');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="mr-2">✓</span> Added!';
    btn.classList.add('bg-green-600');
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('bg-green-600');
    }, 1500);
}

function updateBasketUI() {
    const orders = BasketManager.getOrders();
    const count = orders.length;
    
    const checkMarginBtn = document.getElementById('checkFutureMargin');
    const deployOrdersBtn = document.getElementById('deployFutureOrders');
    
    checkMarginBtn.disabled = count === 0;
    deployOrdersBtn.disabled = count === 0;
    
    // Update button text
    checkMarginBtn.textContent = `Check Margin ${count > 0 ? `(${count})` : ''}`;
    deployOrdersBtn.textContent = `Deploy Orders ${count > 0 ? `(${count})` : ''}`;
}

// ===========================================
// MARGIN CHECK
// ===========================================

async function checkMargin() {
    const resultDiv = document.getElementById('futureMarginResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Checking margin...</div>';
    
    await BasketManager.checkMargin(
        (marginInfo) => {
            const sufficient = marginInfo.sufficient;
            const colorClass = sufficient ? 'green' : 'red';
            
            resultDiv.innerHTML = `
                <div class="bg-${colorClass}-50 border-2 border-${colorClass}-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                        <span class="font-bold text-${colorClass}-900">Margin Check</span>
                        <span class="text-2xl">${sufficient ? '✓' : '⚠'}</span>
                    </div>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-700">Available Balance:</span>
                            <span class="font-bold text-gray-900">${BasketManager.formatCurrency(marginInfo.available)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-700">Required Margin:</span>
                            <span class="font-bold text-gray-900">${BasketManager.formatCurrency(marginInfo.required)}</span>
                        </div>
                        <div class="flex justify-between pt-2 border-t border-${colorClass}-200">
                            <span class="font-bold text-gray-900">Status:</span>
                            <span class="font-bold text-${colorClass}-700">${sufficient ? 'Sufficient' : 'Insufficient'}</span>
                        </div>
                    </div>
                </div>
            `;
        },
        (error) => {
            resultDiv.innerHTML = `
                <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <div class="font-bold text-red-900 mb-2">Error</div>
                    <div class="text-sm text-red-700">${error}</div>
                </div>
            `;
        }
    );
}

// ===========================================
// DEPLOY ORDERS
// ===========================================

async function deployOrders() {
    const resultDiv = document.getElementById('futureDeployResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Deploying orders...</div>';
    
    await BasketManager.deploy(
        (progress, percent) => {
            resultDiv.innerHTML = `<div class="text-center py-4 text-gray-600">${progress}</div>`;
        },
        (summary) => {
            displayDeploymentResults(summary);
        },
        (error) => {
            resultDiv.innerHTML = `
                <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <div class="font-bold text-red-900 mb-2">Deployment Failed</div>
                    <div class="text-sm text-red-700">${error}</div>
                </div>
            `;
        }
    );
}

function displayDeploymentResults(summary) {
    const resultDiv = document.getElementById('futureDeployResult');
    
    let html = `
        <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-4">
                <span class="font-bold text-gray-900">Deployment Complete</span>
                <span class="text-sm text-gray-600">${summary.successful}/${summary.total} successful</span>
            </div>
            <div class="space-y-2">
    `;
    
    summary.results.forEach(result => {
        const isSuccess = result.success && result.status !== 'REJECTED';
        const statusClass = BasketManager.getStatusBadgeClass(result.status || 'UNKNOWN');
        const statusIcon = BasketManager.getStatusIcon(result.status || 'UNKNOWN');
        
        html += `
            <div class="border-2 ${isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold text-sm text-gray-900">${result.symbol}</span>
                    <span class="text-xs px-2 py-1 border-2 rounded ${statusClass}">
                        ${statusIcon} ${result.status || 'UNKNOWN'}
                    </span>
                </div>
                <div class="text-xs text-gray-600 space-y-1">
                    ${result.order_id ? `<div>Order ID: ${result.order_id}</div>` : ''}
                    ${result.quantity ? `<div>Quantity: ${result.quantity} (${result.lots} lots × ${result.lot_size})</div>` : ''}
                    ${result.average_price ? `<div>Price: ${BasketManager.formatCurrency(result.average_price)}</div>` : ''}
                    ${result.status_message ? `<div class="text-gray-500">${result.status_message}</div>` : ''}
                    ${!result.success && result.error ? `<div class="text-red-600 font-semibold">${result.error}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div></div>';
    resultDiv.innerHTML = html;
    
    // Update basket UI
    updateBasketUI();
}

// Export for external access
window.FutureSpreads = {
    initialize: initializeFutureSpreads,
    findSpread: findFutureSpread,
    openModal: openDeployModal,
    closeModal: closeDeployModal
};

console.log('Future Spreads module loaded');

// Option Spreads Module
// Handles Put and Call Option Spread strategies

const OPTION_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// State for option spreads
let optionSpreadState = {
    currentStrategy: null, // 'put' or 'call'
    instrumentsFound: false,
    atmData: null,
    hedgeData: null,
    deployModalOpen: false
};

// Initialize when page loads
let optionSpreadInitialized = false;

function initializeOptionSpreads() {
    if (optionSpreadInitialized) return;
    
    console.log('Initializing Option Spreads...');
    setupOptionSpreadListeners();
    optionSpreadInitialized = true;
}

// Auto-initialize
window.addEventListener('load', () => {
    setTimeout(() => {
        if (document.getElementById('optionSpreadsPage')) {
            initializeOptionSpreads();
        }
    }, 500);
});

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupOptionSpreadListeners() {
    // Find Instruments buttons
    const putFindBtn = document.getElementById('putOptionFindBtn');
    const callFindBtn = document.getElementById('callOptionFindBtn');
    
    if (putFindBtn) {
        putFindBtn.addEventListener('click', () => findOptionSpread('put'));
    }
    
    if (callFindBtn) {
        callFindBtn.addEventListener('click', () => findOptionSpread('call'));
    }
    
    // Deploy buttons
    const putDeployBtn = document.getElementById('putOptionDeployBtn');
    const callDeployBtn = document.getElementById('callOptionDeployBtn');
    
    if (putDeployBtn) {
        putDeployBtn.addEventListener('click', () => openDeployModal('put'));
    }
    
    if (callDeployBtn) {
        callDeployBtn.addEventListener('click', () => openDeployModal('call'));
    }
    
    // Modal buttons
    const closeModalBtn = document.getElementById('closeOptionDeployModal');
    const addAtmToBasketBtn = document.getElementById('addAtmToBasket');
    const addOptionHedgeToBasketBtn = document.getElementById('addOptionHedgeToBasket');
    const checkMarginBtn = document.getElementById('checkOptionMargin');
    const deployOrdersBtn = document.getElementById('deployOptionOrders');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDeployModal);
    }
    
    if (addAtmToBasketBtn) {
        addAtmToBasketBtn.addEventListener('click', () => addToBasket('atm'));
    }
    
    if (addOptionHedgeToBasketBtn) {
        addOptionHedgeToBasketBtn.addEventListener('click', () => addToBasket('hedge'));
    }
    
    if (checkMarginBtn) {
        checkMarginBtn.addEventListener('click', checkMargin);
    }
    
    if (deployOrdersBtn) {
        deployOrdersBtn.addEventListener('click', deployOrders);
    }
    
    console.log('Option Spread listeners setup complete');
}

// ===========================================
// FIND INSTRUMENTS
// ===========================================

async function findOptionSpread(strategy) {
    console.log('=== Finding', strategy, 'option spread ===');
    
    optionSpreadState.currentStrategy = strategy;
    
    const resultsDiv = document.getElementById(`${strategy}OptionResults`);
    const findBtn = document.getElementById(`${strategy}OptionFindBtn`);
    const deployBtn = document.getElementById(`${strategy}OptionDeployBtn`);
    
    // Get parameters from UI
    const skipStrikes = parseInt(document.getElementById(`${strategy}SkipStrikes`).value);
    const expiry = parseInt(document.getElementById(`${strategy}Expiry`).value);
    
    console.log('Parameters:', { skipStrikes, expiry });
    
    // Show loading
    resultsDiv.innerHTML = '<div class="text-center py-8"><div class="text-gray-600">Finding instruments...</div></div>';
    findBtn.disabled = true;
    findBtn.textContent = 'Searching...';
    
    try {
        const userId = sessionStorage.getItem('user_id');
        const endpoint = strategy === 'put' 
            ? '/api/strategy/put-option-spread'
            : '/api/strategy/call-option-spread';
        
        console.log('Calling:', `${OPTION_CONFIG.backendUrl}${endpoint}`);
        
        const response = await fetch(`${OPTION_CONFIG.backendUrl}${endpoint}`, {
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
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));
        
        if (response.ok && data.success) {
            // Validate data structure
            if (!data.atm) {
                console.error('Missing ATM data');
                throw new Error('ATM data is missing from response');
            }
            if (!data.hedge) {
                console.error('Missing hedge data');
                throw new Error('Hedge data is missing from response');
            }
            if (!data.atm.symbol) {
                console.error('ATM symbol missing:', data.atm);
                throw new Error('ATM symbol is missing');
            }
            if (!data.hedge.symbol) {
                console.error('Hedge symbol missing:', data.hedge);
                throw new Error('Hedge symbol is missing');
            }
            
            optionSpreadState.instrumentsFound = true;
            optionSpreadState.atmData = data.atm;
            optionSpreadState.hedgeData = data.hedge;
            
            console.log('✓ Instruments stored successfully');
            
            displayInstruments(strategy, data);
            deployBtn.classList.remove('hidden');
        } else {
            throw new Error(data.error || 'Failed to find instruments');
        }
    } catch (error) {
        console.error('=== Error finding instruments ===');
        console.error(error);
        resultsDiv.innerHTML = `
            <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div class="text-red-600 font-semibold mb-2">Error</div>
                <div class="text-sm text-red-700">${error.message}</div>
                <div class="text-xs text-gray-600 mt-2">Check browser console (F12) for details</div>
            </div>
        `;
    } finally {
        findBtn.disabled = false;
        findBtn.innerHTML = '<span class="mr-2">🔍</span> Find Instruments';
    }
}

function displayInstruments(strategy, data) {
    const resultsDiv = document.getElementById(`${strategy}OptionResults`);
    const isPut = strategy === 'put';
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    
    if (isPut) {
        html += `
            <div class="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded">ATM PUT</span>
                    <span class="text-xs font-bold text-red-700 bg-white px-2 py-1 rounded border border-red-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.atm.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.atm.token}</div>
                <div class="text-2xl font-bold text-red-700">${BasketManager.formatCurrency(data.atm.last_price)}</div>
            </div>
            
            <div class="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded">PUT HEDGE</span>
                    <span class="text-xs font-bold text-orange-700 bg-white px-2 py-1 rounded border border-orange-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.hedge.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.hedge.token}</div>
                <div class="text-2xl font-bold text-orange-700">${BasketManager.formatCurrency(data.hedge.last_price)}</div>
            </div>
        `;
    } else {
        html += `
            <div class="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">ATM CALL</span>
                    <span class="text-xs font-bold text-green-700 bg-white px-2 py-1 rounded border border-green-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.atm.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.atm.token}</div>
                <div class="text-2xl font-bold text-green-700">${BasketManager.formatCurrency(data.atm.last_price)}</div>
            </div>
            
            <div class="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">CALL HEDGE</span>
                    <span class="text-xs font-bold text-blue-700 bg-white px-2 py-1 rounded border border-blue-200">NFO</span>
                </div>
                <div class="font-bold text-lg text-gray-900 mb-2">${data.hedge.symbol}</div>
                <div class="text-sm text-gray-600 mb-1">Token: ${data.hedge.token}</div>
                <div class="text-2xl font-bold text-blue-700">${BasketManager.formatCurrency(data.hedge.last_price)}</div>
            </div>
        `;
    }
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}

// ===========================================
// DEPLOY MODAL
// ===========================================

function openDeployModal(strategy) {
    if (!optionSpreadState.instrumentsFound) {
        alert('Please find instruments first');
        return;
    }
    
    optionSpreadState.currentStrategy = strategy;
    optionSpreadState.deployModalOpen = true;
    
    const modal = document.getElementById('optionDeployModal');
    const modalTitle = document.getElementById('optionModalTitle');
    
    const isPut = strategy === 'put';
    modalTitle.textContent = `Deploy ${isPut ? 'Put' : 'Call'} Option Spread`;
    
    // Set default values
    document.getElementById('atmTransactionType').value = 'SELL';
    document.getElementById('atmLots').value = '1';
    document.getElementById('atmOrderType').value = 'MARKET';
    document.getElementById('atmProduct').value = 'MIS';
    
    document.getElementById('optionHedgeTransactionType').value = 'BUY';
    document.getElementById('optionHedgeLots').value = '1';
    document.getElementById('optionHedgeOrderType').value = 'MARKET';
    document.getElementById('optionHedgeProduct').value = 'MIS';
    
    // Update labels
    const atmLabel = isPut ? 'ATM PUT' : 'ATM CALL';
    const hedgeLabel = isPut ? 'PUT HEDGE' : 'CALL HEDGE';
    
    document.getElementById('atmLabel').textContent = `${atmLabel}: ${optionSpreadState.atmData.symbol}`;
    document.getElementById('optionHedgeLabel').textContent = `${hedgeLabel}: ${optionSpreadState.hedgeData.symbol}`;
    
    // Clear previous results
    document.getElementById('optionMarginResult').classList.add('hidden');
    document.getElementById('optionDeployResult').classList.add('hidden');
    
    // Clear basket
    BasketManager.clearBasket();
    updateBasketUI();
    
    modal.classList.remove('hidden');
}

function closeDeployModal() {
    const modal = document.getElementById('optionDeployModal');
    modal.classList.add('hidden');
    optionSpreadState.deployModalOpen = false;
}

// ===========================================
// BASKET OPERATIONS
// ===========================================

function addToBasket(leg) {
    const isAtm = leg === 'atm';
    const prefix = isAtm ? 'atm' : 'optionHedge';
    
    const transactionType = document.getElementById(`${prefix}TransactionType`).value;
    const lots = parseInt(document.getElementById(`${prefix}Lots`).value);
    const orderType = document.getElementById(`${prefix}OrderType`).value;
    const product = document.getElementById(`${prefix}Product`).value;
    
    if (!lots || lots < 1) {
        alert('Please enter valid lots');
        return;
    }
    
    const instrumentData = isAtm ? optionSpreadState.atmData : optionSpreadState.hedgeData;
    
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
    const btn = document.getElementById(isAtm ? 'addAtmToBasket' : 'addOptionHedgeToBasket');
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
    
    const checkMarginBtn = document.getElementById('checkOptionMargin');
    const deployOrdersBtn = document.getElementById('deployOptionOrders');
    
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
    const resultDiv = document.getElementById('optionMarginResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<div class="text-center py-4 text-gray-600">Checking margin...</div>';
    
    await BasketManager.checkMargin(
        (marginInfo) => {
            const sufficient = marginInfo.sufficient;
            
            if (sufficient) {
                resultDiv.innerHTML = `
                    <div class="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <span class="font-bold text-green-900">Margin Check</span>
                            <span class="text-2xl">✓</span>
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
                            <div class="flex justify-between pt-2 border-t border-green-200">
                                <span class="font-bold text-gray-900">Status:</span>
                                <span class="font-bold text-green-700">Sufficient</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <span class="font-bold text-red-900">Margin Check</span>
                            <span class="text-2xl">⚠</span>
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
                            <div class="flex justify-between pt-2 border-t border-red-200">
                                <span class="font-bold text-gray-900">Status:</span>
                                <span class="font-bold text-red-700">Insufficient</span>
                            </div>
                        </div>
                    </div>
                `;
            }
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
    const resultDiv = document.getElementById('optionDeployResult');
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
    const resultDiv = document.getElementById('optionDeployResult');
    
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
window.OptionSpreads = {
    initialize: initializeOptionSpreads,
    findSpread: findOptionSpread,
    openModal: openDeployModal,
    closeModal: closeDeployModal
};

console.log('Option Spreads module loaded');

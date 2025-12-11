// =========================================================
// STRATEGY DEPLOYMENT MODULE - FIXED VERSION
// Handles bullish and bearish future spread strategies
// =========================================================

// Initialize when page becomes visible
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.state !== 'undefined') {
        initializeStrategyDeployment();
    }
});

function initializeStrategyDeployment() {
    // Strategy buttons
    const bullishBtn = document.getElementById('bullishBtn');
    const bearishBtn = document.getElementById('bearishBtn');
    
    if (bullishBtn) {
        bullishBtn.addEventListener('click', () => executeStrategy('bullish'));
    }
    
    if (bearishBtn) {
        bearishBtn.addEventListener('click', () => executeStrategy('bearish'));
    }
    
    // Deploy basket button
    const deployBasketBtn = document.getElementById('deployBasketBtn');
    if (deployBasketBtn) {
        deployBasketBtn.addEventListener('click', deployStrategyBasket);
    }
    
    // Close modal button
    const closeModalBtn = document.getElementById('closeDeployModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDeployModal);
    }
}

// =========================================================
// STRATEGY EXECUTION
// =========================================================

async function executeStrategy(strategyType) {
    const symbol = document.getElementById('strategySymbol')?.value.trim().toUpperCase();
    const lotSize = parseInt(document.getElementById('lotSize')?.value) || 1;
    
    if (!symbol) {
        alert('Please enter a symbol');
        return;
    }

    // Show loading
    const resultsDiv = document.getElementById('strategyResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE4A03] mx-auto mb-4"></div>
                <p class="text-blue-800 font-medium">Searching for ${strategyType} opportunities...</p>
            </div>
        `;
    }

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/strategy/${strategyType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                symbol: symbol,
                lot_size: lotSize
            })
        });

        const data = await response.json();

        if (data.success) {
            if (strategyType === 'bullish') {
                displayStrategyResults(data.strategies, 'bullish');  // FIXED FUNCTION NAME
            } else {
                displayStrategyResults(data.strategies, 'bearish');  // FIXED FUNCTION NAME
            }
        } else {
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                        <p class="text-red-800 font-medium">❌ Error</p>
                        <p class="text-red-700 text-sm mt-2">${data.message || 'Failed to execute strategy'}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Strategy execution error:', error);
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                    <p class="text-red-800 font-medium">❌ Error</p>
                    <p class="text-red-700 text-sm mt-2">Failed to connect to server</p>
                    <p class="text-red-600 text-xs mt-1">${error.message}</p>
                </div>
            `;
        }
    }
}

// =========================================================
// DISPLAY RESULTS - RENAMED FROM displayBullishResults/displayBearishResults
// =========================================================

function displayStrategyResults(strategies, type) {
    const resultsDiv = document.getElementById('strategyResults');
    if (!resultsDiv) return;

    if (!strategies || strategies.length === 0) {
        resultsDiv.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p class="text-yellow-800 font-medium">⚠️ No ${type} opportunities found</p>
                <p class="text-yellow-700 text-sm mt-2">Try a different symbol or check market conditions</p>
            </div>
        `;
        return;
    }

    const titleText = type === 'bullish' ? '📈 Bullish Strategies' : '📉 Bearish Strategies';
    const colorClass = type === 'bullish' ? 'text-green-600' : 'text-red-600';

    let html = `
        <div class="space-y-4">
            <h3 class="text-xl font-bold ${colorClass} mb-4">${titleText}</h3>
            <p class="text-sm text-gray-600 mb-4">Found ${strategies.length} potential spread opportunities</p>
    `;

    strategies.forEach((strategy, index) => {
        const profitColor = strategy.max_profit > 0 ? 'text-green-600' : 'text-red-600';
        const lossColor = 'text-red-600';

        html += `
            <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-900">Strategy ${index + 1}</h4>
                        <p class="text-sm text-gray-600 mt-1">
                            ${type === 'bullish' ? 'Buy' : 'Sell'} ${strategy.near_contract} & 
                            ${type === 'bullish' ? 'Sell' : 'Buy'} ${strategy.far_contract}
                        </p>
                    </div>
                    <button 
                        onclick="addStrategyToBasket(${index}, '${type}')"
                        class="px-4 py-2 bg-[#FE4A03] text-white rounded-lg hover:bg-[#E63E00] transition-colors font-medium"
                    >
                        Add to Basket
                    </button>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Near Price</p>
                        <p class="text-lg font-bold text-gray-900">₹${strategy.near_price.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Far Price</p>
                        <p class="text-lg font-bold text-gray-900">₹${strategy.far_price.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Spread</p>
                        <p class="text-lg font-bold text-gray-900">₹${strategy.spread.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Quantity</p>
                        <p class="text-lg font-bold text-gray-900">${strategy.quantity}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-green-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Max Profit</p>
                        <p class="text-xl font-bold ${profitColor}">₹${strategy.max_profit.toFixed(2)}</p>
                    </div>
                    <div class="bg-red-50 rounded-lg p-3">
                        <p class="text-xs text-gray-600 mb-1">Max Loss</p>
                        <p class="text-xl font-bold ${lossColor}">₹${Math.abs(strategy.max_loss).toFixed(2)}</p>
                    </div>
                </div>

                <div class="border-t pt-4">
                    <p class="text-sm text-gray-600 mb-2">Margin Requirements:</p>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <p class="text-xs text-gray-500">Total Margin</p>
                            <p class="text-lg font-bold text-blue-600">₹${strategy.margin.total.toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Span</p>
                            <p class="text-sm font-semibold text-gray-700">₹${strategy.margin.span.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div class="mt-4 text-xs text-gray-500">
                    <p>Days to Near Expiry: ${strategy.days_to_near_expiry}</p>
                    <p>Days to Far Expiry: ${strategy.days_to_far_expiry}</p>
                </div>
            </div>
        `;
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
}

// =========================================================
// BASKET MANAGEMENT
// =========================================================

let strategyBasket = [];

function addStrategyToBasket(strategyIndex, strategyType) {
    // Get the strategy from the displayed results
    const resultsDiv = document.getElementById('strategyResults');
    if (!resultsDiv) return;

    // We need to store strategies globally to access them
    if (!window.displayedStrategies || !window.displayedStrategies[strategyIndex]) {
        alert('Strategy not found');
        return;
    }

    const strategy = window.displayedStrategies[strategyIndex];
    strategy.type = strategyType;

    // Check if already in basket
    const exists = strategyBasket.some(s => 
        s.near_contract === strategy.near_contract && 
        s.far_contract === strategy.far_contract
    );

    if (exists) {
        alert('This strategy is already in the basket');
        return;
    }

    strategyBasket.push(strategy);
    updateBasketDisplay();
    showDeployModal();
}

function updateBasketDisplay() {
    const basketList = document.getElementById('basketList');
    const basketCount = document.getElementById('strategyBasketCount');
    
    if (basketCount) {
        basketCount.textContent = strategyBasket.length;
    }

    if (!basketList) return;

    if (strategyBasket.length === 0) {
        basketList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No strategies in basket</p>
            </div>
        `;
        return;
    }

    basketList.innerHTML = strategyBasket.map((strategy, index) => `
        <div class="border border-gray-200 rounded-lg p-4 bg-white">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h5 class="font-semibold text-gray-900">${strategy.type.toUpperCase()} Spread</h5>
                    <p class="text-sm text-gray-600">
                        ${strategy.near_contract} / ${strategy.far_contract}
                    </p>
                </div>
                <button 
                    onclick="removeFromStrategyBasket(${index})"
                    class="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                    Remove
                </button>
            </div>
            <div class="grid grid-cols-3 gap-2 text-sm">
                <div>
                    <p class="text-xs text-gray-500">Max Profit</p>
                    <p class="font-semibold text-green-600">₹${strategy.max_profit.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Max Loss</p>
                    <p class="font-semibold text-red-600">₹${Math.abs(strategy.max_loss).toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Margin</p>
                    <p class="font-semibold text-blue-600">₹${strategy.margin.total.toFixed(2)}</p>
                </div>
            </div>
        </div>
    `).join('');

    // Update total margin
    const totalMargin = strategyBasket.reduce((sum, s) => sum + s.margin.total, 0);
    const totalMarginElement = document.getElementById('totalBasketMargin');
    if (totalMarginElement) {
        totalMarginElement.textContent = `₹${totalMargin.toFixed(2)}`;
    }
}

function removeFromStrategyBasket(index) {
    strategyBasket.splice(index, 1);
    updateBasketDisplay();
}

// =========================================================
// MODAL MANAGEMENT
// =========================================================

function showDeployModal() {
    const modal = document.getElementById('deployModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateBasketDisplay();
    }
}

function closeDeployModal() {
    const modal = document.getElementById('deployModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// =========================================================
// STRATEGY DEPLOYMENT - RENAMED FUNCTION
// =========================================================

async function deployStrategyBasket() {
    if (strategyBasket.length === 0) {
        alert('Basket is empty');
        return;
    }

    const confirmDeploy = confirm(`Deploy ${strategyBasket.length} strategies?`);
    if (!confirmDeploy) return;

    const statusDiv = document.getElementById('deploymentStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p class="text-blue-800 font-medium">🔄 Deploying strategies...</p>
            </div>
        `;
    }

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/deploy-strategies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': window.state.userId
            },
            body: JSON.stringify({
                strategies: strategyBasket
            })
        });

        const data = await response.json();

        if (data.success) {
            displayDeploymentResults(data.results);
            
            // Clear basket if all successful
            if (data.results.every(r => r.success)) {
                strategyBasket = [];
                updateBasketDisplay();
            }
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-800 font-medium">❌ Deployment Failed</p>
                        <p class="text-red-700 text-sm mt-2">${data.message}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Deployment error:', error);
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 font-medium">❌ Error</p>
                    <p class="text-red-700 text-sm mt-2">Failed to deploy strategies</p>
                </div>
            `;
        }
    }
}

function displayDeploymentResults(results) {
    const statusDiv = document.getElementById('deploymentStatus');
    if (!statusDiv) return;

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    let html = `
        <div class="space-y-4">
            <div class="bg-white border border-gray-200 rounded-lg p-6">
                <h4 class="text-lg font-semibold text-gray-900 mb-4">📊 Deployment Summary</h4>
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="text-center">
                        <p class="text-3xl font-bold text-gray-900">${results.length}</p>
                        <p class="text-sm text-gray-600">Total</p>
                    </div>
                    <div class="text-center">
                        <p class="text-3xl font-bold text-green-600">${successful}</p>
                        <p class="text-sm text-gray-600">Successful</p>
                    </div>
                    <div class="text-center">
                        <p class="text-3xl font-bold text-red-600">${failed}</p>
                        <p class="text-sm text-gray-600">Failed</p>
                    </div>
                </div>
                
                <div class="space-y-2">
    `;

    results.forEach((result, index) => {
        const statusClass = result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200';
        const icon = result.success ? '✅' : '❌';

        html += `
            <div class="border ${statusClass} rounded-lg p-3">
                <p class="font-medium text-gray-900">
                    ${icon} Strategy ${index + 1}: ${result.strategy?.type || 'Unknown'} Spread
                </p>
                <p class="text-sm text-gray-600 mt-1">
                    ${result.message || 'No details available'}
                </p>
                ${result.order_ids ? `
                    <p class="text-xs text-gray-500 mt-1">
                        Order IDs: ${result.order_ids.join(', ')}
                    </p>
                ` : ''}
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    statusDiv.innerHTML = html;
}

// =========================================================
// STORE STRATEGIES GLOBALLY
// =========================================================

// Override the displayStrategyResults to store strategies globally
const originalDisplayStrategyResults = displayStrategyResults;
window.displayStrategyResults = function(strategies, type) {
    window.displayedStrategies = strategies;
    originalDisplayStrategyResults(strategies, type);
};

// Export functions to global scope
window.executeStrategy = executeStrategy;
window.addStrategyToBasket = addStrategyToBasket;
window.removeFromStrategyBasket = removeFromStrategyBasket;
window.deployStrategyBasket = deployStrategyBasket;
window.showDeployModal = showDeployModal;
window.closeDeployModal = closeDeployModal;

console.log('✅ Strategy Deployment module loaded');

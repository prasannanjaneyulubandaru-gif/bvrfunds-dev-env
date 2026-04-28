/**
 * BVR Funds — Trading Page V2
 * Combined: Option Chain  |  Futures Panel  |  Basket Manager
 *
 * Global state lives in TradingState.
 * All three panels react to instrument / bias / lots changes.
 */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const TRADING_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────
const TradingState = {
    instrument: 'NIFTY',         // 'NIFTY' | 'BANKNIFTY'
    bias: 'BULLISH',              // 'BULLISH' | 'BEARISH'
    lots: 1,
    expiryIndex: 0,               // 0 = nearest expiry
    optionChainData: null,
    futuresPanelData: null,
    basket: [],                   // [{symbol, token, exchange, transaction_type, lots, ltp, label}]
    marginTimer: null,
    chainRefreshTimer: null,
    futuresRefreshTimer: null,
    ws: null,                     // WebSocket (Kite ticker handled server-side; polling used here)
};

// Instrument tokens for chart monitor auto-population
const INDEX_TOKENS = {
    NIFTY: 256265,
    BANKNIFTY: 260105
};

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
function initTradingPage() {
    console.log('[TradingPage] Initializing...');
    bindTopBarControls();
    renderBasket();
    fetchFuturesPanel();
    fetchOptionChain();
    startAutoRefresh();
    fetchMargins();
}

// ─────────────────────────────────────────────────────────────
// TOP BAR CONTROLS
// ─────────────────────────────────────────────────────────────
function bindTopBarControls() {
    // Instrument toggle — NIFTY / BANKNIFTY
    document.querySelectorAll('[data-instrument]').forEach(btn => {
        btn.addEventListener('click', () => {
            TradingState.instrument = btn.dataset.instrument;
            document.querySelectorAll('[data-instrument]').forEach(b =>
                b.classList.toggle('tp-toggle-active', b === btn)
            );
            onStateChange();
        });
    });

    // Bias toggle — BULLISH / BEARISH
    document.querySelectorAll('[data-bias]').forEach(btn => {
        btn.addEventListener('click', () => {
            TradingState.bias = btn.dataset.bias;
            document.querySelectorAll('[data-bias]').forEach(b =>
                b.classList.toggle('tp-toggle-active', b === btn)
            );
            onStateChange();
        });
    });

    // Lots input
    const lotsInput = document.getElementById('tp-lots-input');
    if (lotsInput) {
        lotsInput.value = TradingState.lots;
        lotsInput.addEventListener('change', () => {
            TradingState.lots = Math.max(1, parseInt(lotsInput.value) || 1);
        });
    }

    // Expiry selector
    const expirySelect = document.getElementById('tp-expiry-select');
    if (expirySelect) {
        expirySelect.addEventListener('change', () => {
            TradingState.expiryIndex = parseInt(expirySelect.value) || 0;
            fetchOptionChain();
        });
    }

    // Chart monitor — populate instrument token automatically
    const instTokenInput = document.getElementById('instrumentToken');
    if (instTokenInput) {
        instTokenInput.value = INDEX_TOKENS[TradingState.instrument];
    }
}

function onStateChange() {
    // Update chart monitor token
    const instTokenInput = document.getElementById('instrumentToken');
    if (instTokenInput) {
        instTokenInput.value = INDEX_TOKENS[TradingState.instrument];
    }
    fetchOptionChain();
    fetchFuturesPanel();
}

// ─────────────────────────────────────────────────────────────
// OPTION CHAIN PANEL
// ─────────────────────────────────────────────────────────────
async function fetchOptionChain() {
    const panel = document.getElementById('tp-option-chain-body');
    if (!panel) return;
    panel.innerHTML = '<tr><td colspan="4" class="tp-loading">Loading option chain…</td></tr>';

    const optionType = TradingState.bias === 'BULLISH' ? 'PE' : 'CE';

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/option-chain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({
                instrument: TradingState.instrument,
                option_type: optionType,
                expiry_index: TradingState.expiryIndex,
                num_strikes: 15
            })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);

        TradingState.optionChainData = data;

        // Update expiry selector
        updateExpirySelector(data.available_expiries, data.expiry);

        // Update spot price display
        updateSpotDisplay(data.spot, data.instrument);

        renderOptionChain(data);
    } catch (err) {
        panel.innerHTML = `<tr><td colspan="4" class="tp-error">Error: ${err.message}</td></tr>`;
    }
}

function updateExpirySelector(expiries, currentExpiry) {
    const sel = document.getElementById('tp-expiry-select');
    if (!sel) return;
    sel.innerHTML = '';
    expiries.forEach((exp, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = formatExpiry(exp);
        if (exp === currentExpiry) opt.selected = true;
        sel.appendChild(opt);
    });
}

function formatExpiry(dateStr) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
}

function updateSpotDisplay(spot, instrument) {
    const el = document.getElementById('tp-spot-price');
    if (el) el.textContent = `${instrument} ${formatPrice(spot)}`;
}

function renderOptionChain(data) {
    const panel = document.getElementById('tp-option-chain-body');
    if (!panel) return;

    const rows = data.rows;
    const atmStrike = data.atm_strike;
    const optionType = data.option_type;

    let html = '';
    rows.forEach(row => {
        const atmClass = row.is_atm ? 'tp-row-atm' : '';
        const itmClass = row.is_itm ? 'tp-row-itm' : 'tp-row-otm';
        const ltpClass = row.ltp > 0 ? 'tp-ltp-value' : 'tp-ltp-zero';

        html += `
            <tr class="tp-chain-row ${atmClass} ${itmClass}"
                data-symbol="${row.symbol}"
                data-token="${row.token}"
                data-exchange="${row.exchange}"
                data-strike="${row.strike}"
                data-ltp="${row.ltp}"
                onclick="toggleChainRowAction(this)">
                <td class="tp-td-strike">
                    ${row.is_atm ? '<span class="tp-atm-badge">ATM</span>' : ''}
                    <span class="tp-strike-val">${row.strike.toLocaleString('en-IN')}</span>
                </td>
                <td class="tp-td-type">${optionType}</td>
                <td class="tp-td-ltp ${ltpClass}">₹${formatPrice(row.ltp)}</td>
                <td class="tp-td-action" id="action-${row.token}"></td>
            </tr>`;
    });

    panel.innerHTML = html || '<tr><td colspan="4" class="tp-empty">No strikes found</td></tr>';
}

let _openActionToken = null;

function toggleChainRowAction(rowEl) {
    const token = parseInt(rowEl.dataset.token);
    const symbol = rowEl.dataset.symbol;
    const exchange = rowEl.dataset.exchange;
    const ltp = parseFloat(rowEl.dataset.ltp);
    const strike = rowEl.dataset.strike;

    // Close previously open action bar
    if (_openActionToken !== null && _openActionToken !== token) {
        const prev = document.getElementById(`action-${_openActionToken}`);
        if (prev) prev.innerHTML = '';
    }

    const actionCell = document.getElementById(`action-${token}`);
    if (!actionCell) return;

    // Toggle: if already open, close it
    if (_openActionToken === token) {
        actionCell.innerHTML = '';
        _openActionToken = null;
        return;
    }

    _openActionToken = token;

    actionCell.innerHTML = `
        <div class="tp-action-bar">
            <button class="tp-btn-buy" onclick="event.stopPropagation(); addToBasket('${symbol}', ${token}, '${exchange}', 'BUY', ${ltp}, '${strike} ${symbol.slice(-2)}')">
                B
            </button>
            <button class="tp-btn-sell" onclick="event.stopPropagation(); addToBasket('${symbol}', ${token}, '${exchange}', 'SELL', ${ltp}, '${strike} ${symbol.slice(-2)}')">
                S
            </button>
        </div>`;
}

// ─────────────────────────────────────────────────────────────
// FUTURES PANEL
// ─────────────────────────────────────────────────────────────
async function fetchFuturesPanel() {
    const panel = document.getElementById('tp-futures-body');
    if (!panel) return;
    panel.innerHTML = '<div class="tp-loading">Loading futures…</div>';

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/futures-panel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ instrument: TradingState.instrument })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);
        TradingState.futuresPanelData = data;
        renderFuturesPanel(data);
    } catch (err) {
        panel.innerHTML = `<div class="tp-error">Error: ${err.message}</div>`;
    }
}

function renderFuturesPanel(data) {
    const panel = document.getElementById('tp-futures-body');
    if (!panel) return;

    const isBullish = TradingState.bias === 'BULLISH';
    const defaultTxn = isBullish ? 'BUY' : 'SELL';
    const defaultClass = isBullish ? 'tp-btn-buy' : 'tp-btn-sell';
    const optionHedgeType = isBullish ? 'PE' : 'CE';

    // Spot card
    let html = `
        <div class="tp-spot-card">
            <div class="tp-spot-label">${data.instrument} Spot</div>
            <div class="tp-spot-value">₹${formatPrice(data.spot)}</div>
        </div>`;

    // Future cards
    data.futures.forEach(fut => {
        html += `
            <div class="tp-future-card">
                <div class="tp-future-label">${fut.label}</div>
                <div class="tp-future-symbol">${fut.symbol}</div>
                <div class="tp-future-ltp">₹${formatPrice(fut.ltp)}</div>
                <div class="tp-future-expiry">${formatExpiry(fut.expiry)}</div>
                <div class="tp-future-actions">
                    <button class="${defaultClass} tp-fut-default-btn"
                        onclick="addToBasket('${fut.symbol}', ${fut.token}, '${fut.exchange}', '${defaultTxn}', ${fut.ltp}, '${fut.label}')">
                        ${defaultTxn}
                    </button>
                    <button class="${isBullish ? 'tp-btn-sell' : 'tp-btn-buy'} tp-fut-alt-btn"
                        onclick="addToBasket('${fut.symbol}', ${fut.token}, '${fut.exchange}', '${isBullish ? 'SELL' : 'BUY'}', ${fut.ltp}, '${fut.label}')">
                        ${isBullish ? 'SELL' : 'BUY'}
                    </button>
                </div>
            </div>`;
    });

    // Hedge selector block
    html += `
        <div class="tp-hedge-block">
            <div class="tp-hedge-title">${optionHedgeType} Hedge</div>
            <div class="tp-hedge-params">
                <div class="tp-param-row">
                    <label>Premium range</label>
                    <div class="tp-range-inputs">
                        <input id="tp-hedge-lower" type="number" value="40" min="1" class="tp-input-sm" placeholder="Low"/>
                        <span>–</span>
                        <input id="tp-hedge-upper" type="number" value="60" min="1" class="tp-input-sm" placeholder="High"/>
                    </div>
                </div>
                <div class="tp-param-row">
                    <label>Days to expiry ≥</label>
                    <input id="tp-hedge-days" type="number" value="1" min="0" class="tp-input-sm" style="width:60px"/>
                </div>
            </div>
            <button class="tp-btn-fetch" onclick="fetchHedge()">Find Hedge</button>
            <div id="tp-hedge-result"></div>
        </div>

        <div class="tp-trail-block">
            <div class="tp-hedge-title">Trail Settings</div>
            <div class="tp-param-row">
                <label>Mode</label>
                <select id="tp-trail-mode" class="tp-input-sm">
                    <option value="auto">Auto Trail</option>
                    <option value="manual">Manual</option>
                </select>
            </div>
            <div class="tp-param-row">
                <label>Trail points</label>
                <input id="tp-trail-points" type="number" value="50" min="1" class="tp-input-sm" style="width:70px"/>
            </div>
            <div class="tp-param-row">
                <label>Step %</label>
                <input id="tp-trail-step" type="number" value="50" min="1" max="100" class="tp-input-sm" style="width:60px"/>
            </div>
        </div>`;

    panel.innerHTML = html;
}

async function fetchHedge() {
    const resultDiv = document.getElementById('tp-hedge-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<span class="tp-loading-inline">Searching…</span>';

    const lower = parseFloat(document.getElementById('tp-hedge-lower')?.value || 40);
    const upper = parseFloat(document.getElementById('tp-hedge-upper')?.value || 60);
    const days = parseInt(document.getElementById('tp-hedge-days')?.value || 1);
    const isBullish = TradingState.bias === 'BULLISH';
    const endpoint = isBullish ? 'bullish-future-spread' : 'bearish-future-spread';

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({
                instrument: TradingState.instrument,
                lower_premium: lower,
                upper_premium: upper,
                days
            })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);

        if (data.hedge) {
            const hedgeType = isBullish ? 'PE' : 'CE';
            resultDiv.innerHTML = `
                <div class="tp-hedge-found">
                    <div class="tp-hedge-symbol">${data.hedge.symbol}</div>
                    <div class="tp-hedge-ltp">₹${formatPrice(data.hedge.last_price)}</div>
                    <button class="tp-btn-buy" onclick="addToBasket('${data.hedge.symbol}', ${data.hedge.token}, 'NFO', 'BUY', ${data.hedge.last_price}, '${hedgeType} Hedge')">
                        + Basket
                    </button>
                </div>`;
        } else {
            resultDiv.innerHTML = `<span class="tp-warn">No hedge found in ₹${lower}–₹${upper} range</span>`;
        }
    } catch (err) {
        resultDiv.innerHTML = `<span class="tp-error-inline">${err.message}</span>`;
    }
}

// ─────────────────────────────────────────────────────────────
// BASKET MANAGER
// ─────────────────────────────────────────────────────────────
function addToBasket(symbol, token, exchange, txnType, ltp, label) {
    // Close any open action bar
    if (_openActionToken !== null) {
        const prev = document.getElementById(`action-${_openActionToken}`);
        if (prev) prev.innerHTML = '';
        _openActionToken = null;
    }

    TradingState.basket.push({
        id: Date.now() + Math.random(), // unique per-entry id
        symbol,
        token,
        exchange,
        transaction_type: txnType,
        lots: TradingState.lots,
        ltp,
        label
    });

    renderBasket();
    scheduleMarginRefresh();
    showBasketFlash(`${symbol} added (${txnType})`);
}

function removeFromBasket(id) {
    TradingState.basket = TradingState.basket.filter(item => item.id !== id);
    renderBasket();
    scheduleMarginRefresh();
}

function clearBasket() {
    TradingState.basket = [];
    renderBasket();
    clearMarginDisplay();
}

function renderBasket() {
    const container = document.getElementById('tp-basket-items');
    const emptyMsg = document.getElementById('tp-basket-empty');
    const deployBtn = document.getElementById('tp-deploy-btn');
    const clearBtn = document.getElementById('tp-clear-basket-btn');

    if (!container) return;

    if (TradingState.basket.length === 0) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        if (deployBtn) deployBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
        return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (deployBtn) deployBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;

    container.innerHTML = TradingState.basket.map(item => `
        <div class="tp-basket-item" data-id="${item.id}">
            <div class="tp-basket-item-top">
                <span class="tp-basket-symbol">${item.symbol}</span>
                <span class="tp-basket-txn ${item.transaction_type === 'BUY' ? 'tp-badge-buy' : 'tp-badge-sell'}">
                    ${item.transaction_type}
                </span>
                <button class="tp-basket-remove" onclick="removeFromBasket(${item.id})" title="Remove">✕</button>
            </div>
            <div class="tp-basket-item-meta">
                <div class="tp-basket-edit-row">
                    <label>Lots</label>
                    <input type="number" value="${item.lots}" min="1"
                        class="tp-input-xs"
                        onchange="updateBasketLots(${item.id}, this.value)"/>
                </div>
                <div class="tp-basket-ltp">LTP ₹${formatPrice(item.ltp)}</div>
            </div>
            <div class="tp-basket-label">${item.label}</div>
        </div>`
    ).join('');
}

function updateBasketLots(id, value) {
    const item = TradingState.basket.find(i => i.id === id);
    if (item) {
        item.lots = Math.max(1, parseInt(value) || 1);
        scheduleMarginRefresh();
    }
}

function showBasketFlash(msg) {
    const flash = document.getElementById('tp-basket-flash');
    if (!flash) return;
    flash.textContent = msg;
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 2000);
}

// ─────────────────────────────────────────────────────────────
// MARGIN AUTO-REFRESH
// ─────────────────────────────────────────────────────────────
function scheduleMarginRefresh() {
    clearTimeout(TradingState.marginTimer);
    TradingState.marginTimer = setTimeout(fetchBasketMargin, 600);
}

async function fetchBasketMargin() {
    if (TradingState.basket.length === 0) {
        clearMarginDisplay();
        return;
    }

    const marginEl = document.getElementById('tp-margin-required');
    const availEl = document.getElementById('tp-margin-available');
    const statusEl = document.getElementById('tp-margin-status');
    if (marginEl) marginEl.textContent = '…';

    try {
        const userId = sessionStorage.getItem('user_id');
        const orders = TradingState.basket.map(item => ({
            exchange: item.exchange,
            tradingsymbol: item.symbol,
            transaction_type: item.transaction_type,
            lots: item.lots,
            product: 'MIS',
            order_type: 'MARKET'
        }));

        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders })
        });
        const data = await resp.json();

        if (data.success) {
            if (marginEl) marginEl.textContent = `₹${formatPrice(data.total_required)}`;
            if (availEl) availEl.textContent = `₹${formatPrice(data.available_balance)}`;
            if (statusEl) {
                statusEl.textContent = data.sufficient ? '✓ Sufficient' : '✗ Insufficient';
                statusEl.className = `tp-margin-status ${data.sufficient ? 'tp-margin-ok' : 'tp-margin-nok'}`;
            }
        }
    } catch (err) {
        if (marginEl) marginEl.textContent = 'Error';
        console.error('[Margin]', err);
    }
}

async function fetchMargins() {
    const availEl = document.getElementById('tp-margin-available');
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/margins`, {
            headers: { 'X-User-ID': userId }
        });
        const data = await resp.json();
        if (data.success && availEl) {
            availEl.textContent = `₹${formatPrice(data.available)}`;
        }
    } catch (err) {
        console.error('[Margins]', err);
    }
}

function clearMarginDisplay() {
    const marginEl = document.getElementById('tp-margin-required');
    const statusEl = document.getElementById('tp-margin-status');
    if (marginEl) marginEl.textContent = '—';
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tp-margin-status'; }
}

// ─────────────────────────────────────────────────────────────
// DEPLOY BASKET
// ─────────────────────────────────────────────────────────────
async function deployBasket() {
    if (TradingState.basket.length === 0) return;

    const btn = document.getElementById('tp-deploy-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Deploying…'; }

    try {
        const userId = sessionStorage.getItem('user_id');
        const orders = TradingState.basket.map(item => ({
            exchange: item.exchange,
            tradingsymbol: item.symbol,
            transaction_type: item.transaction_type,
            lots: item.lots,
            product: 'MIS',
            order_type: 'MARKET',
            variety: 'regular'
        }));

        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/deploy-basket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders })
        });
        const data = await resp.json();

        showDeployResult(data);

        if (data.success && data.failed === 0) {
            clearBasket();
        }
    } catch (err) {
        showDeployResult({ success: false, error: err.message });
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Deploy All'; }
    }
}

function showDeployResult(data) {
    const panel = document.getElementById('tp-deploy-result');
    if (!panel) return;

    if (!data.success) {
        panel.innerHTML = `<div class="tp-deploy-error">Deploy failed: ${data.error}</div>`;
        setTimeout(() => panel.innerHTML = '', 5000);
        return;
    }

    const rows = (data.results || []).map(r => `
        <div class="tp-result-row ${r.success ? 'tp-result-ok' : 'tp-result-fail'}">
            <span>${r.symbol}</span>
            <span>${r.status}</span>
            ${r.order_id ? `<span class="tp-order-id">#${r.order_id}</span>` : ''}
            ${r.error ? `<span class="tp-result-err">${r.error}</span>` : ''}
        </div>`).join('');

    panel.innerHTML = `
        <div class="tp-deploy-summary">
            <span>✓ ${data.successful} placed</span>
            ${data.failed > 0 ? `<span class="tp-fail-count">✗ ${data.failed} failed</span>` : ''}
        </div>
        ${rows}`;

    setTimeout(() => panel.innerHTML = '', 8000);
}

// ─────────────────────────────────────────────────────────────
// AUTO-REFRESH (LTP polling — replaces WebSocket for simplicity)
// ─────────────────────────────────────────────────────────────
function startAutoRefresh() {
    // Refresh option chain LTP every 15 seconds
    TradingState.chainRefreshTimer = setInterval(() => {
        if (TradingState.optionChainData) fetchOptionChain();
    }, 15000);

    // Refresh futures panel every 10 seconds
    TradingState.futuresRefreshTimer = setInterval(() => {
        fetchFuturesPanel();
    }, 10000);

    // Refresh available margin every 30 seconds
    setInterval(fetchMargins, 30000);
}

function stopAutoRefresh() {
    clearInterval(TradingState.chainRefreshTimer);
    clearInterval(TradingState.futuresRefreshTimer);
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function formatPrice(val) {
    if (val === null || val === undefined || val === 0) return '0.00';
    return parseFloat(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ─────────────────────────────────────────────────────────────
// EXPOSE TO WINDOW (called from index.html)
// ─────────────────────────────────────────────────────────────
window.TradingPage = {
    init: initTradingPage,
    destroy: stopAutoRefresh,
    addToBasket,
    removeFromBasket,
    clearBasket,
    deployBasket,
    fetchOptionChain,
    fetchFuturesPanel,
    fetchHedge,
    updateBasketLots,
    toggleChainRowAction
};

console.log('[TradingPage] Module loaded');

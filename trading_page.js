/**
 * BVR Funds — Trading Page V2.1
 * Fixes:
 *  1. Equal 3-column layout (each 33.33%) — zoom proportional
 *  2. BUY/SELL opens basket_manager showDeployModal (order params + trail config)
 *  3. Options trail default OFF, Futures trail default ON (auto)
 *  4. LTP via server-side KiteTicker poll (/api/get-ltp-ws), REST fallback every 15s
 *  5. Max 6 expiry dates
 */

const TRADING_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://bvrfunds-dev-ulhe9.ondigitalocean.app'
};

const TradingState = {
    instrument: 'NIFTY',
    bias: 'BULLISH',
    lots: 1,
    expiryIndex: 0,
    optionChainData: null,
    futuresPanelData: null,
    chainRefreshTimer: null,
    futuresRefreshTimer: null,
    ltpPollTimer: null,
    ltpMap: {},
    subscribedTokens: [],
    _initialized: false,
};

const INDEX_TOKENS = { NIFTY: 256265, BANKNIFTY: 260105 };
const MAX_EXPIRIES = 6;

// ─── INIT ─────────────────────────────────────────────────────
function initTradingPage() {
    if (TradingState._initialized) {
        fetchFuturesPanel();
        fetchOptionChain();
        fetchMargins();
        return;
    }
    TradingState._initialized = true;
    console.log('[TradingPage] Init');
    bindTopBarControls();
    renderBasket();
    fetchFuturesPanel();
    fetchOptionChain();
    fetchMargins();
    startAutoRefresh();
}

function destroyTradingPage() {
    stopAutoRefresh();
    // Release trading-page subscriptions (trailing positions keep theirs)
    if (TradingState.subscribedTokens.length) {
        const userId = sessionStorage.getItem('user_id');
        navigator.sendBeacon
            ? navigator.sendBeacon(
                `${TRADING_CONFIG.backendUrl}/api/trading/unsubscribe-tokens`,
                JSON.stringify({ tokens: TradingState.subscribedTokens })
              )
            : fetch(`${TRADING_CONFIG.backendUrl}/api/trading/unsubscribe-tokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                body: JSON.stringify({ tokens: TradingState.subscribedTokens }),
                keepalive: true
              }).catch(() => {});
        TradingState.subscribedTokens = [];
    }
    TradingState._initialized = false;
}

// ─── TOP BAR ──────────────────────────────────────────────────
function bindTopBarControls() {
    document.querySelectorAll('[data-instrument]').forEach(btn => {
        btn.addEventListener('click', () => {
            TradingState.instrument = btn.dataset.instrument;
            document.querySelectorAll('[data-instrument]').forEach(b =>
                b.classList.toggle('tp-toggle-active', b === btn));
            syncChartMonitorToken();
            onStateChange();
        });
    });

    document.querySelectorAll('[data-bias]').forEach(btn => {
        btn.addEventListener('click', () => {
            TradingState.bias = btn.dataset.bias;
            document.querySelectorAll('[data-bias]').forEach(b =>
                b.classList.toggle('tp-toggle-active', b === btn));
            onStateChange();
        });
    });

    const lotsInput = document.getElementById('tp-lots-input');
    if (lotsInput) {
        lotsInput.value = TradingState.lots;
        lotsInput.addEventListener('change', () => {
            TradingState.lots = Math.max(1, parseInt(lotsInput.value) || 1);
        });
    }

    const expirySelect = document.getElementById('tp-expiry-select');
    if (expirySelect) {
        expirySelect.addEventListener('change', () => {
            TradingState.expiryIndex = parseInt(expirySelect.value) || 0;
            fetchOptionChain();
        });
    }

    syncChartMonitorToken();
}

function syncChartMonitorToken() {
    const el = document.getElementById('instrumentToken');
    if (el) el.value = INDEX_TOKENS[TradingState.instrument];
}

function onStateChange() {
    TradingState.expiryIndex = 0;
    fetchOptionChain();
    fetchFuturesPanel();
}

// ─── LTP — SERVER-SIDE KITE TICKER POLL ───────────────────────
/**
 * After collecting tokens from a loaded chain/futures panel, tell the backend
 * to subscribe them on the shared KiteTicker.  This is cheap and idempotent —
 * the backend only subscribes genuinely new tokens.
 */
async function subscribeTokens(tokens) {
    if (!tokens || !tokens.length) return;
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/subscribe-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ tokens })
        });
        if (!resp.ok) return;
        const data = await resp.json();
        _updateTickerDot(data.ticker_status);
    } catch (_) { /* silent */ }
}

function _updateTickerDot(status) {
    const dot = document.getElementById('tp-ticker-dot');
    if (!dot) return;
    dot.className = 'tp-ticker-dot';
    if (status === 'connected') dot.classList.add('connected');
    else if (status === 'error') dot.classList.add('error');
}

async function pollLTP() {
    const tokens = TradingState.subscribedTokens;
    if (!tokens.length) return;
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/ltp-ws`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ tokens })
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.success || !data.ltp) return;
        Object.assign(TradingState.ltpMap, data.ltp);
        _patchChainLTP();
        _patchFuturesLTP();
        const spotToken = INDEX_TOKENS[TradingState.instrument];
        if (TradingState.ltpMap[spotToken]) {
            updateSpotDisplay(TradingState.ltpMap[spotToken], TradingState.instrument);
        }
        if (data.ticker_status) _updateTickerDot(data.ticker_status);
    } catch (_) { /* silent — REST handles it */ }
}

function _patchChainLTP() {
    document.querySelectorAll('.tp-chain-row').forEach(row => {
        const token = parseInt(row.dataset.token);
        const ltp = TradingState.ltpMap[token];
        if (ltp == null) return;
        const span = row.querySelector('.tp-ltp-val');
        if (span) span.textContent = `₹${formatPrice(ltp)}`;
        row.dataset.ltp = ltp;
    });
}

function _patchFuturesLTP() {
    document.querySelectorAll('.tp-future-card[data-token]').forEach(card => {
        const token = parseInt(card.dataset.token);
        const ltp = TradingState.ltpMap[token];
        if (ltp == null) return;
        const el = card.querySelector('.tp-future-ltp');
        if (el) el.textContent = `₹${formatPrice(ltp)}`;
        card.dataset.ltp = ltp;
    });
}

function _collectTokens() {
    const tokens = new Set([INDEX_TOKENS[TradingState.instrument]]);
    if (TradingState.optionChainData) TradingState.optionChainData.rows.forEach(r => tokens.add(r.token));
    if (TradingState.futuresPanelData) TradingState.futuresPanelData.futures.forEach(f => tokens.add(f.token));
    TradingState.subscribedTokens = [...tokens];
    // Tell the backend to subscribe these on the shared ticker
    subscribeTokens(TradingState.subscribedTokens);
}

// ─── OPTION CHAIN ─────────────────────────────────────────────
async function fetchOptionChain() {
    const panel = document.getElementById('tp-option-chain-body');
    if (!panel) return;
    panel.innerHTML = '<tr><td colspan="4" class="tp-loading">Loading chain…</td></tr>';

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/option-chain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({
                instrument: TradingState.instrument,
                option_type: TradingState.bias === 'BULLISH' ? 'PE' : 'CE',
                expiry_index: TradingState.expiryIndex,
                num_strikes: 15
            })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);
        TradingState.optionChainData = data;
        updateExpirySelector(data.available_expiries, data.expiry);
        updateSpotDisplay(data.spot, data.instrument);
        renderOptionChain(data);
        _collectTokens();
    } catch (err) {
        panel.innerHTML = `<tr><td colspan="4" class="tp-error">Error: ${err.message}</td></tr>`;
    }
}

function updateExpirySelector(expiries, currentExpiry) {
    const sel = document.getElementById('tp-expiry-select');
    if (!sel) return;
    sel.innerHTML = '';
    expiries.slice(0, MAX_EXPIRIES).forEach((exp, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = formatExpiry(exp);
        if (exp === currentExpiry) opt.selected = true;
        sel.appendChild(opt);
    });
}

function formatExpiry(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return dateStr; }
}

function updateSpotDisplay(spot, instrument) {
    const el = document.getElementById('tp-spot-price');
    if (el) el.textContent = `${instrument} ₹${formatPrice(spot)}`;
}

function renderOptionChain(data) {
    const panel = document.getElementById('tp-option-chain-body');
    if (!panel) return;
    panel.innerHTML = data.rows.map(row => {
        const ltp = TradingState.ltpMap[row.token] ?? row.ltp;
        return `
        <tr class="tp-chain-row ${row.is_atm ? 'tp-row-atm' : ''} ${row.is_itm ? 'tp-row-itm' : 'tp-row-otm'}"
            data-symbol="${row.symbol}" data-token="${row.token}"
            data-exchange="${row.exchange}" data-strike="${row.strike}" data-ltp="${ltp}"
            onclick="toggleChainRowAction(this)">
            <td class="tp-td-strike">
                ${row.is_atm ? '<span class="tp-atm-badge">ATM</span>' : ''}
                <span class="tp-strike-val">${row.strike.toLocaleString('en-IN')}</span>
            </td>
            <td class="tp-td-type">${data.option_type}</td>
            <td class="tp-td-ltp"><span class="tp-ltp-val ${ltp > 0 ? 'tp-ltp-value' : 'tp-ltp-zero'}">₹${formatPrice(ltp)}</span></td>
            <td class="tp-td-action" id="action-${row.token}"></td>
        </tr>`;
    }).join('') || '<tr><td colspan="4" class="tp-empty">No strikes found</td></tr>';
}

let _openActionToken = null;

function toggleChainRowAction(rowEl) {
    const token = parseInt(rowEl.dataset.token);
    const symbol = rowEl.dataset.symbol;
    const exchange = rowEl.dataset.exchange;
    const ltp = parseFloat(rowEl.dataset.ltp) || 0;
    const strike = rowEl.dataset.strike;
    const optionType = TradingState.bias === 'BULLISH' ? 'PE' : 'CE';

    if (_openActionToken !== null && _openActionToken !== token) {
        const prev = document.getElementById(`action-${_openActionToken}`);
        if (prev) prev.innerHTML = '';
    }
    const actionCell = document.getElementById(`action-${token}`);
    if (!actionCell) return;

    if (_openActionToken === token) {
        actionCell.innerHTML = '';
        _openActionToken = null;
        return;
    }
    _openActionToken = token;

    // trailDefaultOn = false for options
    actionCell.innerHTML = `
        <div class="tp-action-bar">
            <button class="tp-btn-buy"
                onclick="event.stopPropagation(); openOrderModal('${symbol}',${token},'${exchange}','BUY',${ltp},'${strike} ${optionType}',false)">B</button>
            <button class="tp-btn-sell"
                onclick="event.stopPropagation(); openOrderModal('${symbol}',${token},'${exchange}','SELL',${ltp},'${strike} ${optionType}',false)">S</button>
        </div>`;
}

// ─── ORDER PARAMS MODAL ───────────────────────────────────────
function openOrderModal(symbol, token, exchange, txnType, ltp, label, trailDefaultOn) {
    // Close inline action bar
    if (_openActionToken !== null) {
        const prev = document.getElementById(`action-${_openActionToken}`);
        if (prev) prev.innerHTML = '';
        _openActionToken = null;
    }

    if (!window.BasketManager || !window.BasketManager.showDeployModal) {
        console.warn('[TradingPage] BasketManager not ready');
        return;
    }

    window.BasketManager.showDeployModal([{
        symbol,
        token,
        exchange,
        transaction_type: txnType,
        lots: TradingState.lots,
        last_price: ltp,
        label,
    }], label);

    // Apply trail defaults after modal DOM renders
    setTimeout(() => _applyTrailDefaults(0, trailDefaultOn), 100);
}

function _applyTrailDefaults(index, defaultOn) {
    const checkbox = document.getElementById(`trailEnabled_${index}`);
    if (!checkbox) return;
    checkbox.checked = defaultOn;
    // Trigger the onchange handler defined in basket_manager.js
    checkbox.dispatchEvent(new Event('change'));
    if (defaultOn && window.selectTrailMode) {
        selectTrailMode(index, 'auto');
    }
}

// ─── FUTURES PANEL ────────────────────────────────────────────
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
        _collectTokens();
    } catch (err) {
        panel.innerHTML = `<div class="tp-error">Error: ${err.message}</div>`;
    }
}

function renderFuturesPanel(data) {
    const panel = document.getElementById('tp-futures-body');
    if (!panel) return;
    const isBullish = TradingState.bias === 'BULLISH';
    const defaultTxn = isBullish ? 'BUY' : 'SELL';
    const altTxn    = isBullish ? 'SELL' : 'BUY';
    const hedgeType = isBullish ? 'PE' : 'CE';

    let html = `
        <div class="tp-spot-card">
            <div class="tp-spot-label">${data.instrument} Spot</div>
            <div class="tp-spot-value">₹${formatPrice(data.spot)}</div>
        </div>`;

    data.futures.forEach(fut => {
        const ltp = TradingState.ltpMap[fut.token] ?? fut.ltp;
        html += `
        <div class="tp-future-card" data-token="${fut.token}" data-ltp="${ltp}">
            <div class="tp-future-label">${fut.label}</div>
            <div class="tp-future-symbol">${fut.symbol}</div>
            <div class="tp-future-ltp">₹${formatPrice(ltp)}</div>
            <div class="tp-future-expiry">${formatExpiry(fut.expiry)}</div>
            <div class="tp-future-actions">
                <button class="${isBullish ? 'tp-btn-buy' : 'tp-btn-sell'} tp-fut-default-btn"
                    onclick="openOrderModal('${fut.symbol}',${fut.token},'${fut.exchange}','${defaultTxn}',${ltp},'${fut.label}',true)">
                    ${defaultTxn}
                </button>
                <button class="${isBullish ? 'tp-btn-sell' : 'tp-btn-buy'} tp-fut-alt-btn"
                    onclick="openOrderModal('${fut.symbol}',${fut.token},'${fut.exchange}','${altTxn}',${ltp},'${fut.label}',true)">
                    ${altTxn}
                </button>
            </div>
        </div>`;
    });

    html += `
        <div class="tp-hedge-block">
            <div class="tp-hedge-title">${hedgeType} Hedge</div>
            <div class="tp-hedge-params">
                <div class="tp-param-row">
                    <label>Premium range</label>
                    <div class="tp-range-inputs">
                        <input id="tp-hedge-lower" type="number" value="40" min="1" class="tp-input-sm"/>
                        <span>–</span>
                        <input id="tp-hedge-upper" type="number" value="60" min="1" class="tp-input-sm"/>
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
            <div class="tp-hedge-title">Default trail (futures)</div>
            <div class="tp-param-row"><label>Mode</label>
                <select id="tp-trail-mode" class="tp-input-sm">
                    <option value="auto" selected>Auto Trail</option>
                    <option value="manual">Manual</option>
                </select>
            </div>
            <div class="tp-param-row"><label>Trail points</label>
                <input id="tp-trail-points" type="number" value="10" min="0.5" step="0.5" class="tp-input-sm" style="width:70px"/>
            </div>
            <div class="tp-param-row"><label>Trail step %</label>
                <input id="tp-trail-step" type="number" value="50" min="10" max="200" class="tp-input-sm" style="width:60px"/>
            </div>
            <div class="tp-param-row"><label>Limit buffer %</label>
                <input id="tp-trail-buffer" type="number" value="0.5" min="0.2" max="5" step="0.1" class="tp-input-sm" style="width:60px"/>
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
    const days  = parseInt(document.getElementById('tp-hedge-days')?.value || 1);
    const isBullish = TradingState.bias === 'BULLISH';

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/${isBullish ? 'bullish' : 'bearish'}-future-spread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ instrument: TradingState.instrument, lower_premium: lower, upper_premium: upper, days })
        });
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);

        if (data.hedge) {
            const hType = isBullish ? 'PE' : 'CE';
            resultDiv.innerHTML = `
                <div class="tp-hedge-found">
                    <div class="tp-hedge-symbol">${data.hedge.symbol}</div>
                    <div class="tp-hedge-ltp">₹${formatPrice(data.hedge.last_price)}</div>
                    <button class="tp-btn-buy"
                        onclick="openOrderModal('${data.hedge.symbol}',${data.hedge.token},'NFO','BUY',${data.hedge.last_price},'${hType} Hedge',false)">
                        + Add
                    </button>
                </div>`;
        } else {
            resultDiv.innerHTML = `<span class="tp-warn">No hedge in ₹${lower}–₹${upper} range</span>`;
        }
    } catch (err) {
        resultDiv.innerHTML = `<span class="tp-error-inline">${err.message}</span>`;
    }
}

// ─── BASKET RIGHT PANEL ───────────────────────────────────────
// Mirrors BasketManager state — synced every 500ms
function renderBasket() {
    const container = document.getElementById('tp-basket-items');
    const emptyMsg  = document.getElementById('tp-basket-empty');
    const deployBtn = document.getElementById('tp-deploy-btn');
    const clearBtn  = document.getElementById('tp-clear-basket-btn');
    if (!container) return;

    const orders = window.BasketManager ? window.BasketManager.getOrders() : [];

    if (!orders.length) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        if (deployBtn) deployBtn.disabled = true;
        if (clearBtn)  clearBtn.disabled  = true;
        clearMarginDisplay();
        return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (deployBtn) deployBtn.disabled = false;
    if (clearBtn)  clearBtn.disabled  = false;

    container.innerHTML = orders.map(item => `
        <div class="tp-basket-item">
            <div class="tp-basket-item-top">
                <span class="tp-basket-symbol" title="${item.tradingsymbol}">${item.tradingsymbol}</span>
                <span class="tp-basket-txn ${item.transaction_type === 'BUY' ? 'tp-badge-buy' : 'tp-badge-sell'}">
                    ${item.transaction_type}
                </span>
                <button class="tp-basket-remove"
                    onclick="tpRemoveBasketItem('${item.tradingsymbol}','${item.transaction_type}')">✕</button>
            </div>
            <div class="tp-basket-item-meta">
                <div class="tp-basket-edit-row">
                    <label>Lots</label>
                    <span style="margin-left:4px;font-family:var(--tp-font)">${item.lots}</span>
                </div>
                <div class="tp-basket-ltp">${item.product} · ${item.order_type}</div>
            </div>
            ${item._trailConfig ? `<div class="tp-basket-label">🎯 ${item._trailConfig.mode} · ${item._trailConfig.trailPoints}pts</div>` : ''}
        </div>`
    ).join('');

    scheduleMarginRefresh();
}

function tpRemoveBasketItem(symbol, txnType) {
    if (window.BasketManager) window.BasketManager.removeOrder(symbol, txnType);
    renderBasket(); updateBasketCountDisplay();
}

function tpClearBasket() {
    if (window.BasketManager) window.BasketManager.clearBasket();
    renderBasket(); updateBasketCountDisplay();
}

function _startBasketSync() {
    setInterval(() => {
        const newCount = window.BasketManager ? window.BasketManager.getCount() : 0;
        const displayed = document.querySelectorAll('#tp-basket-items .tp-basket-item').length;
        if (newCount !== displayed) { renderBasket(); updateBasketCountDisplay(); }
    }, 500);
}

// ─── MARGIN ───────────────────────────────────────────────────
let _marginTimer = null;
function scheduleMarginRefresh() {
    clearTimeout(_marginTimer);
    _marginTimer = setTimeout(fetchBasketMargin, 700);
}

async function fetchBasketMargin() {
    const orders = window.BasketManager ? window.BasketManager.getOrders() : [];
    if (!orders.length) { clearMarginDisplay(); return; }
    const marginEl = document.getElementById('tp-margin-required');
    const availEl  = document.getElementById('tp-margin-available');
    const statusEl = document.getElementById('tp-margin-status');
    if (marginEl) marginEl.textContent = '…';
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders })
        });
        const data = await resp.json();
        if (data.success) {
            if (marginEl) marginEl.textContent = `₹${formatPrice(data.total_required)}`;
            if (availEl)  availEl.textContent  = `₹${formatPrice(data.available_balance)}`;
            if (statusEl) {
                statusEl.textContent  = data.sufficient ? '✓ Sufficient' : '✗ Insufficient';
                statusEl.className    = `tp-margin-status ${data.sufficient ? 'tp-margin-ok' : 'tp-margin-nok'}`;
            }
        }
    } catch (_) { if (marginEl) marginEl.textContent = 'Error'; }
}

async function fetchMargins() {
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/margins`, {
            headers: { 'X-User-ID': userId }
        });
        const data = await resp.json();
        const availEl = document.getElementById('tp-margin-available');
        if (data.success && availEl) availEl.textContent = `₹${formatPrice(data.available)}`;
    } catch (_) {}
}

function clearMarginDisplay() {
    const marginEl = document.getElementById('tp-margin-required');
    const statusEl = document.getElementById('tp-margin-status');
    if (marginEl) marginEl.textContent = '—';
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tp-margin-status'; }
}

// ─── DEPLOY ───────────────────────────────────────────────────
async function tpDeployBasket() {
    const orders = window.BasketManager ? window.BasketManager.getOrders() : [];
    if (!orders.length) return;
    const btn   = document.getElementById('tp-deploy-btn');
    const panel = document.getElementById('tp-deploy-result');
    if (btn) { btn.disabled = true; btn.textContent = 'Deploying…'; }
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/strategy/deploy-basket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders })
        });
        const data = await resp.json();
        if (data.success) {
            if (panel) {
                panel.innerHTML = `
                    <div class="tp-deploy-summary">
                        <span>✓ ${data.successful} placed</span>
                        ${data.failed > 0 ? `<span class="tp-fail-count">✗ ${data.failed} failed</span>` : ''}
                    </div>
                    ${(data.results || []).map(r => `
                        <div class="tp-result-row ${r.success ? 'tp-result-ok' : 'tp-result-fail'}">
                            <span>${r.symbol}</span><span>${r.status}</span>
                            ${r.order_id ? `<span class="tp-order-id">#${r.order_id}</span>` : ''}
                            ${r.error ? `<span>${r.error}</span>` : ''}
                        </div>`).join('')}`;
                setTimeout(() => { if (panel) panel.innerHTML = ''; }, 8000);
            }
            if (data.failed === 0) {
                if (window.BasketManager) window.BasketManager.clearBasket();
                renderBasket(); updateBasketCountDisplay();
            }
        } else {
            if (panel) panel.innerHTML = `<div class="tp-deploy-error">Failed: ${data.error}</div>`;
        }
    } catch (err) {
        if (panel) panel.innerHTML = `<div class="tp-deploy-error">${err.message}</div>`;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Deploy All'; }
    }
}

// ─── AUTO-REFRESH ─────────────────────────────────────────────
function startAutoRefresh() {
    _startBasketSync();
    TradingState.ltpPollTimer      = setInterval(pollLTP, 1500);
    TradingState.chainRefreshTimer  = setInterval(() => { if (TradingState.optionChainData) fetchOptionChain(); }, 15000);
    TradingState.futuresRefreshTimer = setInterval(fetchFuturesPanel, 10000);
    setInterval(fetchMargins, 30000);
}

function stopAutoRefresh() {
    clearInterval(TradingState.ltpPollTimer);
    clearInterval(TradingState.chainRefreshTimer);
    clearInterval(TradingState.futuresRefreshTimer);
}

// ─── HELPERS ──────────────────────────────────────────────────
function formatPrice(val) {
    if (val == null || val === 0) return '0.00';
    return parseFloat(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── EXPOSE ───────────────────────────────────────────────────
window.TradingPage          = { init: initTradingPage, destroy: destroyTradingPage };
window.toggleChainRowAction = toggleChainRowAction;
window.openOrderModal       = openOrderModal;
window.tpRemoveBasketItem   = tpRemoveBasketItem;
window.tpClearBasket        = tpClearBasket;
window.tpDeployBasket       = tpDeployBasket;
window.fetchHedge           = fetchHedge;

console.log('[TradingPage] v2.1 loaded');

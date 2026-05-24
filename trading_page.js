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
        : 'https://bvrfunds.top'
};

const TradingState = {
    instrument: 'NIFTY',
    bias: 'BULLISH',
    play: 'THETA',   // THETA = sell mode (futures+hedge), DELTA = buy mode (pure option buy)
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
    _sessionDead: false,   // circuit breaker — stops all polling on 401
};

/** Called on any 401 from trading APIs. Kills all timers and redirects to login. */
function _handleSessionExpired() {
    if (TradingState._sessionDead) return;
    TradingState._sessionDead = true;
    console.warn('[TradingPage] 401 received — stopping all polling, clearing session');
    stopAutoRefresh();
    sessionStorage.clear();
    setTimeout(() => window.location.reload(), 500);
}

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
    _syncFuturesPanelVisibility();
    renderBasket();
    fetchFuturesPanel();
    fetchOptionChain();
    fetchMargins();
    startAutoRefresh();
}

// Navigating away — stop JS timers only.
// KiteTicker stays alive server-side until logout.
function destroyTradingPage() {
    stopAutoRefresh();
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

    document.querySelectorAll('[data-play]').forEach(btn => {
        btn.addEventListener('click', () => {
            TradingState.play = btn.dataset.play;
            document.querySelectorAll('[data-play]').forEach(b =>
                b.classList.toggle('tp-toggle-active', b === btn));
            _syncFuturesPanelVisibility();
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
            TradingState._prevChainLoaded = false; // force re-center on next render
            if (window._resetChainScroll) window._resetChainScroll(); // re-center on expiry change
            fetchOptionChain();
        });
    }

    syncChartMonitorToken();
}

function syncChartMonitorToken() {
    const el = document.getElementById('instrumentToken');
    if (el) el.value = INDEX_TOKENS[TradingState.instrument];
}

/** Both THETA and DELTA always show all 3 panels */
function _syncFuturesPanelVisibility() {
    const futuresCol = document.querySelector('#tradingPage .tp-panel:nth-child(2)');
    const tpMain = document.querySelector('#tradingPage .tp-main');
    if (!futuresCol || !tpMain) return;
    futuresCol.style.display = '';
    tpMain.style.gridTemplateColumns = '1fr 1fr 1fr';
}

function onStateChange() {
    TradingState.expiryIndex = 0;
    // Clear stale data so background fetches show loading spinner for the new instrument
    TradingState.optionChainData = null;
    TradingState.futuresPanelData = null;
    TradingState._prevChainLoaded = false; // force re-center on next render
    if (window._resetChainScroll) window._resetChainScroll(); // re-center on next render
    fetchOptionChain();
    fetchFuturesPanel();
}

// ─── LTP — SERVER-SIDE KITE TICKER ───────────────────────────

/** Tell the backend to subscribe these tokens on the shared KiteTicker.
 *  Starts the ticker if not running. Idempotent. */
async function subscribeTokens(tokens) {
    if (!tokens || !tokens.length) return;
    if (TradingState._sessionDead) return;  // circuit breaker
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/subscribe-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ tokens })
        });
        if (resp.status === 401) { _handleSessionExpired(); return; }
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.ticker_status) _updateTickerDot(data.ticker_status);
    } catch (_) { /* silent */ }
}

function _updateTickerDot(status) {
    const dot = document.getElementById('tp-ticker-dot');
    if (!dot) return;
    dot.className = 'tp-ticker-dot';
    if (status === 'connected') dot.classList.add('connected');
    else if (status === 'connecting') dot.classList.add('connecting');
    else if (status === 'error') dot.classList.add('error');
}

async function pollLTP() {
    if (TradingState._sessionDead) return;  // circuit breaker
    const tokens = TradingState.subscribedTokens;
    if (!tokens.length) return;
    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/ltp-ws`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ tokens })
        });
        if (resp.status === 401) { _handleSessionExpired(); return; }
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.success) return;
        if (data.ticker_status) _updateTickerDot(data.ticker_status);
        // If ticker dropped (e.g. server restart), re-subscribe to reconnect
        if (data.ticker_status === 'disconnected') {
            subscribeTokens(tokens);
            return;
        }
        if (!data.ltp) return;
        Object.assign(TradingState.ltpMap, data.ltp);
        _patchChainLTP();
        _patchFuturesLTP();
        const spotToken = INDEX_TOKENS[TradingState.instrument];
        if (TradingState.ltpMap[spotToken]) {
            updateSpotDisplay(TradingState.ltpMap[spotToken], TradingState.instrument);
        }
    } catch (_) { /* silent */ }
}

function _patchChainLTP() {
    document.querySelectorAll('.tp-chain-row').forEach(row => {
        const token = parseInt(row.dataset.token);
        const ltp = TradingState.ltpMap[token];
        if (ltp == null) return;
        const span = row.querySelector('.tp-ltp-val');
        const newText = `₹${formatPrice(ltp)}`;
        if (span && span.textContent !== newText) span.textContent = newText;
        row.dataset.ltp = ltp;
    });
}

function _patchFuturesLTP() {
    document.querySelectorAll('.tp-future-card[data-token]').forEach(card => {
        const token = parseInt(card.dataset.token);
        const ltp = TradingState.ltpMap[token];
        if (ltp == null) return;
        const el = card.querySelector('.tp-future-ltp');
        const newText = `₹${formatPrice(ltp)}`;
        if (el && el.textContent !== newText) el.textContent = newText;
        card.dataset.ltp = ltp;
    });
}

function _collectTokens() {
    const tokens = new Set([INDEX_TOKENS[TradingState.instrument]]);
    if (TradingState.optionChainData) TradingState.optionChainData.rows.forEach(r => tokens.add(r.token));
    if (TradingState.futuresPanelData) TradingState.futuresPanelData.futures.forEach(f => tokens.add(f.token));
    TradingState.subscribedTokens = [...tokens];
    // Register with shared server-side KiteTicker — starts it if needed, idempotent
    subscribeTokens(TradingState.subscribedTokens);
}

// ─── OPTION CHAIN ─────────────────────────────────────────────
async function fetchOptionChain() {
    if (TradingState._sessionDead) return;  // circuit breaker
    const panel = document.getElementById('tp-option-chain-body');
    if (!panel) return;
    // Only show loading placeholder on first load — not on background refresh
    if (!TradingState.optionChainData) {
        panel.innerHTML = '<tr><td colspan="4" class="tp-loading">Loading chain…</td></tr>';
    }

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/option-chain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({
                instrument: TradingState.instrument,
                // THETA (sell): Bullish→PE, Bearish→CE  |  DELTA (buy): Bullish→CE, Bearish→PE
                option_type: (TradingState.play === 'DELTA')
                    ? (TradingState.bias === 'BULLISH' ? 'CE' : 'PE')
                    : (TradingState.bias === 'BULLISH' ? 'PE' : 'CE'),
                expiry_index: TradingState.expiryIndex,
                num_strikes: 20
            })
        });
        if (resp.status === 401) { _handleSessionExpired(); return; }
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);
        TradingState.optionChainData = data;
        updateExpirySelector(data.available_expiries, data.expiry);
        updateSpotDisplay(data.spot, data.instrument);
        renderOptionChain(data);
        _collectTokens();
    } catch (err) {
        // Only replace content with error if there's nothing displayed yet
        if (!TradingState.optionChainData) {
            panel.innerHTML = `<tr><td colspan="4" class="tp-error">Error: ${err.message}</td></tr>`;
        }
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
    const optionType = data.option_type;
    panel.innerHTML = data.rows.map(row => {
        const ltp = TradingState.ltpMap[row.token] ?? row.ltp;
        return `
        <tr class="tp-chain-row ${row.is_atm ? 'tp-row-atm' : ''} ${row.is_itm ? 'tp-row-itm' : 'tp-row-otm'}"
            data-symbol="${row.symbol}" data-token="${row.token}"
            data-exchange="${row.exchange}" data-strike="${row.strike}" data-ltp="${ltp}">
            <td class="tp-td-strike">
                ${row.is_atm ? '<span class="tp-atm-badge">ATM</span>' : ''}
                <span class="tp-strike-val">${row.strike.toLocaleString('en-IN')}</span>
            </td>
            <td class="tp-td-type">${optionType}</td>
            <td class="tp-td-ltp"><span class="tp-ltp-val ${ltp > 0 ? 'tp-ltp-value' : 'tp-ltp-zero'}">` +
            `\u20b9${formatPrice(ltp)}</span></td>
            <td class="tp-td-action">
                <div class="tp-action-bar">
                    <button class="tp-btn-buy"
                        onclick="openOrderModal('${row.symbol}',${row.token},'${row.exchange}','BUY',${ltp},'${row.strike} ${optionType}',false)">B</button>
                    <button class="tp-btn-sell"
                        onclick="openOrderModal('${row.symbol}',${row.token},'${row.exchange}','SELL',${ltp},'${row.strike} ${optionType}',true)">S</button>
                </div>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="4" class="tp-empty">No strikes found</td></tr>';

    // Scroll ATM row to vertical centre of the chain panel.
    // Desktop: always re-center after every render.
    // Mobile: only re-center when warranted (state change / tab switch / expiry change)
    //         not on background 15s refreshes while user is browsing strikes.
    const tableWrapper = panel.closest('.tp-panel-scroll');
    const atmRow = panel.querySelector('.tp-row-atm');
    if (atmRow && tableWrapper) {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            // Desktop — always re-center
            setTimeout(() => {
                const scrollTarget = atmRow.offsetTop - tableWrapper.clientHeight / 2 + atmRow.offsetHeight / 2;
                tableWrapper.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }, 60);
        } else {
            // Mobile — delegate to index.html's _mobileAtmCenter.
            // isBackgroundRefresh = true when optionChainData already existed before
            // this render (i.e. a 15s background refresh, not a state change).
            // forceRecenter = !isBackgroundRefresh so state changes always re-center.
            const isBackgroundRefresh = !!TradingState._prevChainLoaded;
            if (window._mobileAtmCenter) window._mobileAtmCenter(!isBackgroundRefresh);
        }
        TradingState._prevChainLoaded = true;
    }
}
// toggleChainRowAction removed — B/S buttons are now always visible inline

// ─── ORDER PARAMS MODAL ───────────────────────────────────────
function openOrderModal(symbol, token, exchange, txnType, ltp, label, trailDefaultOn) {
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
    if (TradingState._sessionDead) return;  // circuit breaker
    const panel = document.getElementById('tp-futures-body');
    if (!panel) return;
    if (!TradingState.futuresPanelData) {
        panel.innerHTML = '<div class="tp-loading">Loading futures…</div>';
    }

    try {
        const userId = sessionStorage.getItem('user_id');
        const resp = await fetch(`${TRADING_CONFIG.backendUrl}/api/trading/futures-panel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ instrument: TradingState.instrument })
        });
        if (resp.status === 401) { _handleSessionExpired(); return; }
        const data = await resp.json();
        if (!data.success) throw new Error(data.error);
        TradingState.futuresPanelData = data;
        renderFuturesPanel(data);
        _collectTokens();
    } catch (err) {
        if (!TradingState.futuresPanelData) {
            panel.innerHTML = `<div class="tp-error">Error: ${err.message}</div>`;
        }
    }
}

function renderFuturesPanel(data) {
    const panel = document.getElementById('tp-futures-body');
    if (!panel) return;
    const isBullish = TradingState.bias === 'BULLISH';
    const defaultTxn = isBullish ? 'BUY' : 'SELL';
    const altTxn    = isBullish ? 'SELL' : 'BUY';
    const hedgeType = isBullish ? 'PE' : 'CE';

    let html = ``;

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
            </div>
        </div>`;
    });

    panel.innerHTML = html;
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
    if (!window.BasketManager) return;
    const orders = window.BasketManager.getOrders();
    if (!orders.length) return;

    const btn   = document.getElementById('tp-deploy-btn');
    const panel = document.getElementById('tp-deploy-result');
    if (btn) { btn.disabled = true; btn.textContent = 'Deploying…'; }

    // Delegate entirely to BasketManager.deploy() so that _trailConfig on each
    // order is read and auto/manual trailing is started after placement.
    // The old raw fetch bypassed this and ignored all trail settings.
    await window.BasketManager.deploy(
        // onProgress
        (msg) => {
            if (panel) panel.innerHTML = `<div class="tp-deploy-summary">${msg}</div>`;
        },
        // onComplete
        (summary) => {
            if (panel) {
                panel.innerHTML = `
                    <div class="tp-deploy-summary">
                        <span>✓ ${summary.successful} placed</span>
                        ${summary.failed > 0 ? `<span class="tp-fail-count">✗ ${summary.failed} failed</span>` : ''}
                        ${summary.trailResults && summary.trailResults.autoStarted.length > 0
                            ? `<span class="tp-trail-ok">🤖 ${summary.trailResults.autoStarted.length} auto-trail started</span>`
                            : ''}
                        ${summary.trailResults && summary.trailResults.manualStarted.length > 0
                            ? `<span class="tp-trail-ok">🎯 ${summary.trailResults.manualStarted.length} manual SL placed</span>`
                            : ''}
                    </div>
                    ${(summary.results || []).map(r => `
                        <div class="tp-result-row ${r.success ? 'tp-result-ok' : 'tp-result-fail'}">
                            <span>${r.symbol}</span><span>${r.status}</span>
                            ${r.order_id ? `<span class="tp-order-id">#${r.order_id}</span>` : ''}
                            ${r.error ? `<span>${r.error}</span>` : ''}
                        </div>`).join('')}`;
                setTimeout(() => { if (panel) panel.innerHTML = ''; }, 8000);
            }
            // BasketManager.deploy() clears the basket internally — just re-render
            renderBasket();
            updateBasketCountDisplay();
        },
        // onError
        (errMsg) => {
            if (panel) panel.innerHTML = `<div class="tp-deploy-error">${errMsg}</div>`;
        }
    );

    if (btn) { btn.disabled = false; btn.textContent = 'Deploy All'; }
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
window.openOrderModal       = openOrderModal;
window.tpRemoveBasketItem   = tpRemoveBasketItem;
window.tpClearBasket        = tpClearBasket;
window.tpDeployBasket       = tpDeployBasket;

console.log('[TradingPage] v2.1 loaded');
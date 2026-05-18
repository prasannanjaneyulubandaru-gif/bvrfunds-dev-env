// Basket Manager Module
// Reusable basket management for all strategies

const BASKET_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000'
        : 'https://bvrfunds.top'
};

// Global basket state
let basketState = {
    orders: [],
    marginRequired: 0,
    availableBalance: 0,
    deploymentResults: [],
    isDeploying: false
};

// Store modal orders for trail config access after deploy
let _modalOrders = [];

// ===========================================
// BASKET MANAGEMENT
// ===========================================

function addOrderToBasket(order) {
    console.log('Adding order to basket:', order);
    
    if (!order.tradingsymbol || !order.transaction_type || !order.lots) {
        console.error('Invalid order:', order);
        return false;
    }
    
    const existingIndex = basketState.orders.findIndex(
        o => o.tradingsymbol === order.tradingsymbol && o.transaction_type === order.transaction_type
    );
    
    if (existingIndex >= 0) {
        basketState.orders[existingIndex] = order;
        console.log('Updated existing order in basket');
    } else {
        basketState.orders.push(order);
        console.log('Added new order to basket');
    }
    
    return true;
}

function removeOrderFromBasket(tradingsymbol, transactionType) {
    const initialLength = basketState.orders.length;
    basketState.orders = basketState.orders.filter(
        o => !(o.tradingsymbol === tradingsymbol && o.transaction_type === transactionType)
    );
    const removed = basketState.orders.length < initialLength;
    if (removed) console.log('Removed order from basket:', tradingsymbol, transactionType);
    return removed;
}

function clearBasket() {
    basketState.orders = [];
    basketState.marginRequired = 0;
    basketState.deploymentResults = [];
    console.log('Basket cleared');
}

function getBasketOrders() { return [...basketState.orders]; }
function getBasketCount() { return basketState.orders.length; }

// ===========================================
// DEPLOY MODAL
// ===========================================

function showDeployModal(orders, strategyName) {
    _modalOrders = orders; // store for post-deploy use
    const modal = document.getElementById('deployModal') || createDeployModal();
    const content = document.getElementById('deployModalContent');

    const T = window.T || {};
    const tBg     = T.cardBg     ? T.cardBg()     : '#fff';
    const tBorder = T.cardBorder ? T.cardBorder() : '#e5e7eb';
    const tText   = T.textPrimary   ? T.textPrimary()   : '#111827';
    const tSub    = T.textSecondary ? T.textSecondary() : '#4b5563';
    const tMuted  = T.textMuted  ? T.textMuted()  : '#9ca3af';
    const tInput  = T.inputBg    ? `background:${T.inputBg()};border-color:${T.borderStrong ? T.borderStrong() : '#d1d5db'};color:${tText};` : '';
    const tBorderStr = `border:1px solid ${tBorder};`;

    let html = `
        <div style="padding:10px 16px 8px;border-bottom:1px solid ${tBorder};">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <h2 style="font-size:13px;font-weight:700;color:${tText};">${strategyName || 'Deploy Strategy'}</h2>
                <button onclick="closeDeployModal()" style="color:${tMuted};font-size:18px;line-height:1;background:none;border:none;cursor:pointer;">×</button>
            </div>
        </div>
        <div style="padding:12px;">
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:10px;">
    `;

    orders.forEach((order, index) => {
        const isBuy    = order.transaction_type === 'BUY';
        const accentBg = isBuy ? (T.profitBg ? T.profitBg() : '#f0fdf4') : (T.lossBg ? T.lossBg() : '#fef2f2');
        const accentBorder = isBuy ? (T.profitBorder ? T.profitBorder() : '#bbf7d0') : (T.lossBorder ? T.lossBorder() : '#fecaca');
        const accentText   = isBuy ? (T.profitText ? T.profitText() : '#16a34a') : (T.lossText ? T.lossText() : '#dc2626');
        const badgeBg   = isBuy ? (T.profitBg ? T.profitBg() : '#dcfce7') : (T.lossBg ? T.lossBg() : '#fee2e2');
        const ltp = order.last_price || null;

        html += `
            <div style="border:1px solid ${accentBorder};background:${accentBg};border-radius:8px;padding:10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <h4 style="font-size:11px;font-weight:700;color:${tText};">${order.label || order.symbol}</h4>
                    <span id="txnBadge_${index}" style="padding:1px 6px;background:${badgeBg};color:${accentText};font-size:10px;font-weight:700;border-radius:4px;">${order.transaction_type}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11px;">
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <div>
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Symbol</label>
                            <div style="font-family:monospace;font-weight:600;color:${tText};font-size:11px;">${order.symbol}</div>
                            <input type="hidden" id="symbol_${index}" value="${order.symbol}" />
                            <input type="hidden" id="token_${index}" value="${order.token || ''}" />
                            <input type="hidden" id="ltp_${index}" value="${ltp || ''}" />
                        </div>
                        <div>
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Transaction Type</label>
                            <select id="txnType_${index}" onchange="onTxnTypeChange(${index})"
                                style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;font-weight:600;${tInput}">
                                <option value="BUY" ${isBuy ? 'selected' : ''}>BUY</option>
                                <option value="SELL" ${!isBuy ? 'selected' : ''}>SELL</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Lots</label>
                            <input type="number" id="lots_${index}" value="${order.lots}" min="1" data-symbol="${order.symbol}"
                                style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}" />
                        </div>
                        <div>
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Order Type</label>
                            <select id="orderType_${index}" onchange="onOrderTypeChange(${index})"
                                style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}">
                                <option value="MARKET" selected>MARKET</option>
                                <option value="LIMIT">LIMIT</option>
                            </select>
                        </div>
                        <div id="limitPriceBox_${index}" class="hidden">
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Limit Price</label>
                            <div style="display:flex;gap:4px;">
                                <input type="number" id="limitPrice_${index}" value="${ltp || ''}" step="0.05"
                                    style="flex:1;padding:4px 6px;border:1px solid #60a5fa;border-radius:4px;font-size:11px;font-weight:600;${tInput}" />
                                <button onclick="refetchLTP(${index})" style="padding:4px 8px;background:#3b82f6;color:#fff;font-size:10px;border:none;border-radius:4px;cursor:pointer;">↻</button>
                            </div>
                        </div>
                        <div id="marketProtectionBox_${index}" class="hidden">
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Market Protection % <span style="color:${tMuted};">(-1=default)</span></label>
                            <input type="number" id="marketProtection_${index}" value="-1" min="-1" max="100" step="1"
                                style="width:100%;padding:4px 6px;border:1px solid #f59e0b;border-radius:4px;font-size:11px;font-weight:600;${tInput}" />
                        </div>
                        <div>
                            <label style="display:block;color:${tMuted};font-size:9px;margin-bottom:2px;">Product</label>
                            <select id="product_${index}"
                                style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}">
                                <option value="MIS" selected>MIS</option>
                                <option value="NRML">NRML</option>
                                <option value="CNC">CNC</option>
                            </select>
                        </div>
                        <div>
                            <button onclick="addSingleToBasketFromModal(${index})" id="addBtn_${index}"
                                style="width:100%;padding:6px 0;background:${accentText};color:#fff;font-weight:600;font-size:11px;border:none;border-radius:6px;cursor:pointer;">
                                + Add ${order.label || order.symbol} to Basket
                            </button>
                        </div>
                    </div>
                    <div style="border-left:1px solid ${tBorder};padding-left:10px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                            <span style="font-size:9px;font-weight:700;color:${tSub};">Trailing Stop Loss</span>
                            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                                <input type="checkbox" id="trailEnabled_${index}" onchange="onTrailToggle(${index})" style="width:12px;height:12px;accent-color:#f97316;" />
                                <span style="font-size:9px;color:${tMuted};">Enable after deploy</span>
                            </label>
                        </div>
                        <div id="trailConfig_${index}" style="display:none;flex-direction:column;gap:6px;">
                            <div>
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">Trail Mode</label>
                                <div style="display:flex;gap:4px;">
                                    <button type="button" id="trailBtnManual_${index}" onclick="selectTrailMode(${index},'manual')"
                                        style="flex:1;padding:4px 0;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:10px;font-weight:700;background:${tBg};color:${tMuted};cursor:pointer;">Manual</button>
                                    <button type="button" id="trailBtnAuto_${index}" onclick="selectTrailMode(${index},'auto')"
                                        style="flex:1;padding:4px 0;border:1px solid #f97316;border-radius:4px;font-size:10px;font-weight:700;background:#f97316;color:#fff;cursor:pointer;">Auto ✓</button>
                                </div>
                                <input type="hidden" id="trailModeValue_${index}" value="auto" />
                                <p style="font-size:9px;color:${tMuted};margin-top:3px;" id="trailModeDesc_${index}"><span style="color:#f97316;font-weight:600;">Auto Trail active</span> — SL moves automatically</p>
                            </div>
                            <div>
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">SL Order Type</label>
                                <div style="display:flex;gap:4px;">
                                    <button type="button" id="trailSlBtnSLL_${index}" onclick="selectTrailSlType(${index},'SL')"
                                        style="flex:1;padding:4px 0;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:10px;font-weight:700;background:${tBg};color:${tMuted};cursor:pointer;">SL-L</button>
                                    <button type="button" id="trailSlBtnSLM_${index}" onclick="selectTrailSlType(${index},'SL-M')"
                                        style="flex:1;padding:4px 0;border:1px solid #f97316;border-radius:4px;font-size:10px;font-weight:700;background:#f97316;color:#fff;cursor:pointer;">SL-M ✓</button>
                                </div>
                                <input type="hidden" id="trailSlTypeValue_${index}" value="SL-M" />
                            </div>
                            <div>
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">Trail Points</label>
                                <input type="number" id="trailPoints_${index}" value="15" step="0.5" min="0.5"
                                    style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}" />
                            </div>
                            <div>
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">Trail Step (%)</label>
                                <input type="number" id="trailStep_${index}" value="50" min="10" max="200" step="5"
                                    style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}" />
                            </div>
                            <div id="trailMpBox_${index}">
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">Market Protection % <span style="color:${tMuted};">(-1=default)</span></label>
                                <input type="number" id="trailMp_${index}" value="-1" min="-1" max="100" step="1"
                                    style="width:100%;padding:4px 6px;border:1px solid #f59e0b;border-radius:4px;font-size:11px;font-weight:600;${tInput}" />
                            </div>
                            <div id="trailBufferBox_${index}" class="hidden">
                                <label style="display:block;font-size:9px;font-weight:700;color:${tSub};margin-bottom:3px;">Limit Price Buffer (%)</label>
                                <input type="number" id="trailBuffer_${index}" value="0.5" min="0.2" max="5" step="0.1"
                                    style="width:100%;padding:4px 6px;border:1px solid ${T.borderStrong ? T.borderStrong() : '#d1d5db'};border-radius:4px;font-size:11px;${tInput}" />
                            </div>
                        </div>
                        <div id="trailPlaceholder_${index}" style="display:flex;align-items:center;justify-content:center;height:60px;border:1px dashed ${tBorder};border-radius:6px;">
                            <p style="font-size:10px;color:${tMuted};text-align:center;">Enable trailing stop loss<br/>to configure SL settings</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button onclick="addAllToBasketFromModal()"
                        style="flex:1;background:var(--primary,#FE4A03);color:#fff;font-weight:600;padding:8px 0;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
                    + Add All to Basket
                </button>
                <button onclick="closeDeployModal()"
                        style="flex:1;background:none;border:1px solid ${tBorder};color:${tSub};font-weight:600;padding:8px 0;border-radius:6px;font-size:12px;cursor:pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    content.innerHTML = html;
    modal.classList.add('show');

    // Initialise trail mode → AUTO; SL order type → SL-M; order type box visibility
    orders.forEach((_, index) => {
        selectTrailMode(index, 'auto');
        selectTrailSlType(index, 'SL-M');
        const otEl = document.getElementById(`orderType_${index}`);
        if (otEl) onOrderTypeChange(index);
    });
}

// Trail mode toggle — called from onclick on the two buttons
function selectTrailMode(index, mode) {
    const manualBtn = document.getElementById(`trailBtnManual_${index}`);
    const autoBtn   = document.getElementById(`trailBtnAuto_${index}`);
    const hiddenVal = document.getElementById(`trailModeValue_${index}`);
    const descEl    = document.getElementById(`trailModeDesc_${index}`);
    if (!manualBtn || !autoBtn || !hiddenVal) return;
    const tBg  = window.T && window.T.cardBg     ? window.T.cardBg()     : '#ffffff';
    const tMut = window.T && window.T.textMuted   ? window.T.textMuted()  : '#9ca3af';
    const tBrd = window.T && window.T.borderStrong ? window.T.borderStrong() : '#d1d5db';
    const dimStyle  = `flex:1;padding:4px 0;border:1px solid ${tBrd};border-radius:4px;font-size:10px;font-weight:700;background:${tBg};color:${tMut};cursor:pointer;`;
    if (mode === 'auto') {
        autoBtn.style.cssText   = `flex:1;padding:4px 0;border:1px solid #f97316;border-radius:4px;font-size:10px;font-weight:700;background:#f97316;color:#fff;cursor:pointer;`;
        manualBtn.style.cssText = dimStyle;
        hiddenVal.value = 'auto';
        if (descEl) descEl.innerHTML = '<span style="color:#f97316;font-weight:600;">Auto Trail active</span> — SL moves automatically';
    } else {
        manualBtn.style.cssText = `flex:1;padding:4px 0;border:1px solid #16a34a;border-radius:4px;font-size:10px;font-weight:700;background:#16a34a;color:#fff;cursor:pointer;`;
        autoBtn.style.cssText   = dimStyle;
        hiddenVal.value = 'manual';
        if (descEl) descEl.innerHTML = '<span style="color:#16a34a;font-weight:600;">Manual Trail active</span> — SL placed at entry, adjust via +/- buttons';
    }
}
window.selectTrailMode = selectTrailMode;

// SL order type toggle inside trail config (SL-L vs SL-M)
function selectTrailSlType(index, slType) {
    const btnSLL = document.getElementById(`trailSlBtnSLL_${index}`);
    const btnSLM = document.getElementById(`trailSlBtnSLM_${index}`);
    const hidden = document.getElementById(`trailSlTypeValue_${index}`);
    const mpBox  = document.getElementById(`trailMpBox_${index}`);
    const bufBox = document.getElementById(`trailBufferBox_${index}`);
    if (!btnSLL || !btnSLM || !hidden) return;
    const tBg  = window.T && window.T.cardBg     ? window.T.cardBg()     : '#ffffff';
    const tMut = window.T && window.T.textMuted   ? window.T.textMuted()  : '#9ca3af';
    const tBrd = window.T && window.T.borderStrong ? window.T.borderStrong() : '#d1d5db';
    const dimStyle = `flex:1;padding:4px 0;border:1px solid ${tBrd};border-radius:4px;font-size:10px;font-weight:700;background:${tBg};color:${tMut};cursor:pointer;`;
    hidden.value = slType;
    if (slType === 'SL-M') {
        btnSLM.style.cssText = `flex:1;padding:4px 0;border:1px solid #f97316;border-radius:4px;font-size:10px;font-weight:700;background:#f97316;color:#fff;cursor:pointer;`;
        btnSLL.style.cssText = dimStyle;
        if (mpBox)  mpBox.classList.remove('hidden');
        if (bufBox) bufBox.classList.add('hidden');
    } else {
        btnSLL.style.cssText = `flex:1;padding:4px 0;border:1px solid #3b82f6;border-radius:4px;font-size:10px;font-weight:700;background:#3b82f6;color:#fff;cursor:pointer;`;
        btnSLM.style.cssText = dimStyle;
        if (mpBox)  mpBox.classList.add('hidden');
        if (bufBox) bufBox.classList.remove('hidden');
    }
}
window.selectTrailSlType = selectTrailSlType;

// Handle transaction type dropdown change — update badge color
function onTxnTypeChange(index) {
    const txnType = document.getElementById(`txnType_${index}`).value;
    const badge = document.getElementById(`txnBadge_${index}`);
    const addBtn = document.getElementById(`addBtn_${index}`);
    if (badge) {
        badge.className = txnType === 'BUY'
            ? 'px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded'
            : 'px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded';
        badge.textContent = txnType;
    }
    if (addBtn) {
        addBtn.className = `${txnType === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-semibold py-2 rounded-lg w-full transition-all text-sm`;
    }
}

// Handle order type change — show/hide LIMIT price box, market protection box
function onOrderTypeChange(index) {
    const orderType = document.getElementById(`orderType_${index}`).value;
    const limitBox = document.getElementById(`limitPriceBox_${index}`);
    const mpBox = document.getElementById(`marketProtectionBox_${index}`);

    if (orderType === 'LIMIT' || orderType === 'SL') {
        if (limitBox) limitBox.classList.remove('hidden');
        // Pre-fill with stored LTP if available
        const storedLtp = document.getElementById(`ltp_${index}`)?.value;
        const limitInput = document.getElementById(`limitPrice_${index}`);
        if (limitInput && storedLtp && !limitInput.value) {
            limitInput.value = storedLtp;
        }
        if (!storedLtp) refetchLTP(index);
    } else {
        if (limitBox) limitBox.classList.add('hidden');
    }

    // Market protection only for MARKET and SL-M
    if (mpBox) {
        if (orderType === 'MARKET' || orderType === 'SL-M') {
            mpBox.classList.remove('hidden');
        } else {
            mpBox.classList.add('hidden');
        }
    }
}

// Fetch LTP from backend for a specific order index
async function refetchLTP(index) {
    const symbol = document.getElementById(`symbol_${index}`)?.value;
    const limitInput = document.getElementById(`limitPrice_${index}`);
    if (!symbol || !limitInput) return;

    limitInput.value = '...';
    limitInput.disabled = true;

    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/get-ltp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ exchange: 'NFO', tradingsymbol: symbol })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        const data = await response.json();
        if (data.success && data.last_price) {
            limitInput.value = data.last_price;
            const ltpHidden = document.getElementById(`ltp_${index}`);
            if (ltpHidden) ltpHidden.value = data.last_price;
        } else {
            limitInput.value = '';
            showToast('Could not fetch LTP for ' + symbol, 'error');
        }
    } catch (e) {
        limitInput.value = '';
        showToast('LTP fetch error: ' + e.message, 'error');
    } finally {
        limitInput.disabled = false;
    }
}

// Toggle trail config section visibility
function onTrailToggle(index) {
    const checkbox = document.getElementById(`trailEnabled_${index}`);
    const configDiv = document.getElementById(`trailConfig_${index}`);
    const placeholder = document.getElementById(`trailPlaceholder_${index}`);
    if (!configDiv || !checkbox) return;
    configDiv.style.display = checkbox.checked ? 'flex' : 'none';
    if (placeholder) placeholder.style.display = checkbox.checked ? 'none' : 'flex';
}

function createDeployModal() {
    const modal = document.createElement('div');
    modal.id = 'deployModal';
    modal.className = 'modal';
    modal.innerHTML = `<div id="deployModalContent" class="modal-content"></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeDeployModal();
    });
    return modal;
}

function closeDeployModal() {
    const modal = document.getElementById('deployModal');
    if (modal) modal.classList.remove('show');
}

// Read trail config for a given index from modal
function _readTrailConfig(index) {
    const enabled = document.getElementById(`trailEnabled_${index}`)?.checked;
    if (!enabled) return null;

    const modeHidden = document.getElementById(`trailModeValue_${index}`);
    const mode = (modeHidden && modeHidden.value === 'manual') ? 'manual' : 'auto';
    const trailPoints = parseFloat(document.getElementById(`trailPoints_${index}`)?.value || '10');
    const trailStep = parseFloat(document.getElementById(`trailStep_${index}`)?.value || '50');

    const slTypeHidden = document.getElementById(`trailSlTypeValue_${index}`);
    const slOrderType = (slTypeHidden && slTypeHidden.value === 'SL') ? 'SL' : 'SL-M';

    // SL-L: read limit buffer; SL-M: read market protection
    const trailBuffer = parseFloat(document.getElementById(`trailBuffer_${index}`)?.value || '0.5');
    const mpRaw = parseInt(document.getElementById(`trailMp_${index}`)?.value ?? '-1', 10);
    const trailMp = (mpRaw === -1 || (mpRaw >= 1 && mpRaw <= 100)) ? mpRaw : -1;

    return { mode, trailPoints, trailStep, slOrderType, trailBuffer, trailMp };
}

// Build an order object from modal for a given index
function _buildOrderFromModal(index) {
    const symbol = document.getElementById(`symbol_${index}`)?.value;
    const txnType = document.getElementById(`txnType_${index}`)?.value;
    const lots = parseInt(document.getElementById(`lots_${index}`)?.value || '1');
    const orderType = document.getElementById(`orderType_${index}`)?.value;
    const product = document.getElementById(`product_${index}`)?.value;
    const trailConfig = _readTrailConfig(index);

    if (!symbol) return null;

    const order = {
        exchange: 'NFO',
        tradingsymbol: symbol,
        transaction_type: txnType,
        lots: lots,
        product: product,
        order_type: orderType,
        variety: 'regular',
        _trailConfig: trailConfig,
        _index: index
    };

    if (orderType === 'LIMIT' || orderType === 'SL') {
        const limitPrice = parseFloat(document.getElementById(`limitPrice_${index}`)?.value || '0');
        if (limitPrice > 0) order.price = limitPrice;
    }

    // market_protection — must always be sent for MARKET and SL-M.
    // -1 = Zerodha applies their default slippage. 1–100 = explicit override.
    if (orderType === 'MARKET' || orderType === 'SL-M') {
        const mpRaw = parseInt(document.getElementById(`marketProtection_${index}`)?.value ?? '-1', 10);
        // Valid values: -1 or 1–100. Anything else falls back to -1.
        order.market_protection = (mpRaw === -1 || (mpRaw >= 1 && mpRaw <= 100)) ? mpRaw : -1;
    }

    return order;
}

function addSingleToBasketFromModal(orderIndex) {
    const order = _buildOrderFromModal(orderIndex);
    if (!order) { showToast('Error reading order details', 'error'); return; }

    addOrderToBasket(order);
    updateBasketCountDisplay();
    showToast(`${order.tradingsymbol} (${order.transaction_type}) added to basket`, 'success');
}

function addAllToBasketFromModal() {
    let count = 0;
    _modalOrders.forEach((_, index) => {
        const order = _buildOrderFromModal(index);
        if (order) { addOrderToBasket(order); count++; }
    });
    updateBasketCountDisplay();
    closeDeployModal();
    showToast(`${count} order(s) added to basket`, 'success');
}

// Legacy compat
function addToBasketFromModal(orders) {
    addAllToBasketFromModal();
}

// ===========================================
// TOAST NOTIFICATION
// ===========================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50`;
    const bgColors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    toast.classList.add(bgColors[type] || bgColors.info);
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===========================================
// MARGIN CHECKING
// ===========================================

async function checkBasketMargin(onSuccess, onError) {
    if (basketState.orders.length === 0) {
        if (onError) onError('No orders in basket');
        return null;
    }
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/check-basket-margin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders: basketState.orders })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        const data = await response.json();
        if (response.ok && data.success) {
            basketState.marginRequired = data.total_required;
            basketState.availableBalance = data.available_balance;
            const marginInfo = {
                available: data.available_balance,
                required: data.total_required,
                sufficient: data.sufficient,
                details: data.margin_details
            };
            if (onSuccess) onSuccess(marginInfo);
            return marginInfo;
        } else {
            throw new Error(data.error || 'Failed to check margin');
        }
    } catch (error) {
        console.error('Margin check error:', error);
        if (onError) onError(error.message);
        return null;
    }
}

// ===========================================
// ORDER DEPLOYMENT
// ===========================================

async function deployBasket(onProgress, onComplete, onError) {
    if (basketState.orders.length === 0) {
        if (onError) onError('No orders in basket');
        return null;
    }
    if (basketState.isDeploying) {
        if (onError) onError('Deployment already in progress');
        return null;
    }

    basketState.isDeploying = true;
    basketState.deploymentResults = [];

    try {
        const userId = sessionStorage.getItem('user_id');
        if (onProgress) onProgress('Deploying orders...', 0);

        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/deploy-basket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ orders: basketState.orders })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }

        const data = await response.json();

        if (response.ok && data.success) {
            basketState.deploymentResults = data.results;

            const summary = {
                total: data.total_orders,
                successful: data.successful,
                failed: data.failed,
                results: data.results
            };

            // Start trail for successfully deployed orders that have trail config
            const ordersWithTrail = basketState.orders.filter(o => o._trailConfig);
            let trailResults = { autoStarted: [], manualStarted: [] };
            if (ordersWithTrail.length > 0 && data.results) {
                if (onProgress) onProgress('Starting trailing stop loss...', 80);
                trailResults = await _startTrailForDeployedOrders(userId, basketState.orders, data.results);
            }

            summary.trailResults = trailResults;

            // If any auto trails were started, kick off the manage-positions
            // polling loop so the Real-Time Trailing Status panel updates
            // immediately — even if the user hasn't navigated there yet.
            if (trailResults.autoStarted.length > 0 && typeof window._ensureTrailPolling === 'function') {
                window._ensureTrailPolling();
            }

            if (onComplete) onComplete(summary);

            clearBasket();
            return summary;
        } else {
            throw new Error(data.error || 'Failed to deploy orders');
        }
    } catch (error) {
        console.error('[BasketManager] deployBasket error:', error);
        if (onError) onError(error.message);
        return null;
    } finally {
        basketState.isDeploying = false;
    }
}

// Start trailing for each order that was successfully deployed and has trail config.
// Returns { autoStarted: [{positionKey, trigger, limit}], manualStarted: [{symbol, trigger}] }
async function _startTrailForDeployedOrders(userId, orders, results) {
    const autoStarted = [];
    const manualStarted = [];

    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const trailConfig = order._trailConfig;
        if (!trailConfig) continue;

        const result = results.find(r => r.symbol === order.tradingsymbol && r.success);
        if (!result) {
            console.warn(`[BasketManager] Trail skipped for ${order.tradingsymbol} — order not successful`);
            showToast(`Trail skipped for ${order.tradingsymbol} (order failed)`, 'error');
            continue;
        }

        let avgPrice = result.average_price || 0;
        if (!avgPrice || avgPrice === 0) {
            try {
                const ltpRes = await fetch(`${BASKET_CONFIG.backendUrl}/api/strategy/get-ltp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify({ exchange: order.exchange, tradingsymbol: order.tradingsymbol })
                });
                if (ltpRes.status === 401) { throw new Error('Session expired — please login again'); }
                const ltpData = await ltpRes.json();
                if (ltpData.success) avgPrice = ltpData.last_price;
                console.log(`[BasketManager] LTP fallback for ${order.tradingsymbol}: ${avgPrice}`);
            } catch(e) {
                console.warn(`[BasketManager] LTP fallback failed for ${order.tradingsymbol}:`, e.message);
            }
        }

        const quantity = result.quantity || order.lots;
        const isLong = order.transaction_type === 'BUY';
        const _trailSlType = trailConfig.slOrderType || 'SL-M';

        const payload = {
            exchange: order.exchange,
            tradingsymbol: order.tradingsymbol,
            quantity: isLong ? Math.abs(quantity) : -Math.abs(quantity),
            average_price: avgPrice,
            product: order.product,
            trail_points: trailConfig.trailPoints,
            trail_step_percent: trailConfig.trailStep,
            sl_order_type: _trailSlType,
            buffer_percent: trailConfig.trailBuffer / 100,
            market_protection: trailConfig.trailMp ?? -1
        };

        try {
            if (trailConfig.mode === 'auto') {
                const res = await fetch(`${BASKET_CONFIG.backendUrl}/api/start-auto-trail`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify(payload)
                });
                if (res.status === 401) { throw new Error('Session expired — please login again'); }
                const d = await res.json();
                if (d.success) {
                    showToast(`🤖 Auto trail started: ${order.tradingsymbol}`, 'success');
                    autoStarted.push({
                        positionKey: d.position_key,
                        trigger: d.trigger_price,
                        limit: d.limit_price,
                        symbol: order.tradingsymbol
                    });
                } else {
                    console.error(`[BasketManager] Auto trail failed for ${order.tradingsymbol}:`, d.error);
                    showToast(`Auto trail failed for ${order.tradingsymbol}: ${d.error}`, 'error');
                }
            } else {
                // Manual trail: place the SL order
                const _manualSlType = trailConfig.slOrderType || 'SL-M';
                let triggerPrice = isLong
                    ? avgPrice - trailConfig.trailPoints
                    : avgPrice + trailConfig.trailPoints;
                triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;

                const txnType = isLong ? 'SELL' : 'BUY';
                const manualOrderBody = {
                    exchange: order.exchange,
                    tradingsymbol: order.tradingsymbol,
                    transaction_type: txnType,
                    quantity: Math.abs(quantity),
                    product: order.product,
                    order_type: _manualSlType,
                    trigger_price: triggerPrice,
                    variety: 'regular'
                };

                if (_manualSlType === 'SL') {
                    const bufferDecimal = trailConfig.trailBuffer / 100;
                    let limitPrice = isLong
                        ? triggerPrice * (1 - bufferDecimal)
                        : triggerPrice * (1 + bufferDecimal);
                    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
                    manualOrderBody.price = limitPrice;
                } else {
                    manualOrderBody.market_protection = trailConfig.trailMp ?? -1;
                }

                const res = await fetch(`${BASKET_CONFIG.backendUrl}/api/place-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
                    body: JSON.stringify(manualOrderBody)
                });
                if (res.status === 401) { throw new Error('Session expired — please login again'); }
                const d = await res.json();
                if (d.success) {
                    showToast(`🎯 Manual SL placed: ${order.tradingsymbol} @ ₹${triggerPrice} (${_manualSlType})`, 'success');
                    manualStarted.push({ symbol: order.tradingsymbol, orderId: d.order_id, triggerPrice });
                } else {
                    console.error(`[BasketManager] Manual SL failed for ${order.tradingsymbol}:`, d.error);
                    showToast(`Manual SL failed for ${order.tradingsymbol}: ${d.error}`, 'error');
                }
            }
        } catch (e) {
            console.error(`[BasketManager] Trail exception for ${order.tradingsymbol}:`, e);
            showToast(`Trail error for ${order.tradingsymbol}: ${e.message}`, 'error');
        }
    }

    return { autoStarted, manualStarted };
}

// ===========================================
// ORDER STATUS
// ===========================================

async function getOrderStatus(orderId, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/order-status/${orderId}`, {
            headers: { 'X-User-ID': userId }
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        const data = await response.json();
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data);
            return data;
        } else {
            throw new Error(data.error || 'Failed to get order status');
        }
    } catch (error) {
        if (onError) onError(error.message);
        return null;
    }
}

async function getBatchOrderStatus(orderIds, onSuccess, onError) {
    try {
        const userId = sessionStorage.getItem('user_id');
        const response = await fetch(`${BASKET_CONFIG.backendUrl}/api/orders-status/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({ order_ids: orderIds })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        const data = await response.json();
        if (response.ok && data.success) {
            if (onSuccess) onSuccess(data.results);
            return data.results;
        } else {
            throw new Error(data.error || 'Failed to get batch order status');
        }
    } catch (error) {
        if (onError) onError(error.message);
        return null;
    }
}

// ===========================================
// UI HELPERS
// ===========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(amount);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

function getStatusBadgeClass(status) {
    const statusMap = {
        'COMPLETE': 'bg-green-100 text-green-800 border-green-300',
        'REJECTED': 'bg-red-100 text-red-800 border-red-300',
        'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-300',
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-300',
        'OPEN': 'bg-blue-100 text-blue-800 border-blue-300',
        'TRIGGER PENDING': 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
}

function getStatusIcon(status) {
    const iconMap = {
        'COMPLETE': '✓', 'REJECTED': '✗', 'CANCELLED': '⊘',
        'PENDING': '⏱', 'OPEN': '◷', 'TRIGGER PENDING': '⚡'
    };
    return iconMap[status] || '•';
}

// Expose globally for onclick handlers in index.html
window.onTxnTypeChange = onTxnTypeChange;
window.onOrderTypeChange = onOrderTypeChange;
window.onTrailToggle = onTrailToggle;
window.refetchLTP = refetchLTP;
window.addSingleToBasketFromModal = addSingleToBasketFromModal;
window.addAllToBasketFromModal = addAllToBasketFromModal;
window.addToBasketFromModal = addToBasketFromModal;
window.closeDeployModal = closeDeployModal;

// Export module API
window.BasketManager = {
    addOrder: addOrderToBasket,
    removeOrder: removeOrderFromBasket,
    clearBasket: clearBasket,
    getOrders: getBasketOrders,
    getCount: getBasketCount,
    checkMargin: checkBasketMargin,
    deploy: deployBasket,
    getOrderStatus: getOrderStatus,
    getBatchOrderStatus: getBatchOrderStatus,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    getStatusBadgeClass: getStatusBadgeClass,
    getStatusIcon: getStatusIcon,
    showDeployModal: showDeployModal,
    showToast: showToast,
    state: basketState
};

console.log('Basket Manager initialized');
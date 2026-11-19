// FIXED Manage Positions Module - manage_positions.js
// Fixed authentication, error handling, and API response parsing

const MANAGE_POSITIONS_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5050' 
        : 'https://bvrfunds.top'
};

// State management
const positionsState = {
    userId: null,
    selectedPosition: null,
    autoTrailInterval: null,
    positions: [],          // last loaded open positions (full Kite objects)
    livePrices: {},         // instrument_token -> LTP from the shared price feed
    posLiveTimer: null,
    posLiveTick: 0,
    subscribedKey: ''
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Manage Positions module - DOM loaded');
    setupManagePositionsListeners();
});

// ===========================================
// MANAGE POSITIONS PAGE
// ===========================================

function setupManagePositionsListeners() {
    const refreshBtn = document.getElementById('refreshPositionsBtn');
    const trailBtn = document.getElementById('trailSlBtn');
    const exitBtn = document.getElementById('exitImmediatelyBtn');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPositions);
        console.log('✓ Refresh button listener attached');
    }
    if (trailBtn) {
        trailBtn.addEventListener('click', showTrailSlConfig);
        console.log('✓ Trail SL button listener attached');
    }
    if (exitBtn) {
        exitBtn.addEventListener('click', exitPositionImmediately);
        console.log('✓ Exit button listener attached');
    }

    // Start trail monitor polling immediately — it will show "no active trails"
    // if nothing is running, or show live data if sessions were already started
    positionsState.userId = sessionStorage.getItem('user_id');
    if (positionsState.userId) {
        _ensureTrailPolling();
    }
}

async function loadPositions(silent = false) {
    if (silent && typeof silent !== 'boolean') silent = false;   // click event guard
    const positionsList = document.getElementById('positionsList');
    
    // Always get fresh userId from sessionStorage
    positionsState.userId = sessionStorage.getItem('user_id');
    // Start the live trail monitor here too: after a fresh login the user_id
    // arrives after page load, so the DOMContentLoaded start never fires.
    if (positionsState.userId) _ensureTrailPolling();
    
    // Check user_id
    if (!positionsState.userId) {
        console.error('No user_id found in sessionStorage');
        positionsList.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <div class="mb-2">⚠️ Not Logged In</div>
                <div class="text-sm mb-4">Please log in to view your positions</div>
                <button onclick="navigateToPage('dashboard')" class="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold">
                    Go to Dashboard
                </button>
            </div>
        `;
        return;
    }
    
    if (!silent || !positionsState.positions.length) {
        positionsList.innerHTML = '<div class="text-center text-gray-500 py-8">Loading positions...</div>';
    }
    
    console.log('Loading positions for user:', positionsState.userId);
    
    try {
        const url = `${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions`;
        console.log('Fetching from:', url);
        console.log('With headers:', { 'X-User-ID': positionsState.userId });
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'X-User-ID': positionsState.userId
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.status === 401) {
            // Session expired or invalid
            positionsList.innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <div class="mb-2">🔒 Session Expired</div>
                    <div class="text-sm mb-4">Your session has expired or is invalid.</div>
                    <div class="text-xs text-gray-600 mb-4">This usually happens after the server restarts or your session times out.</div>
                    <button onclick="handleLogout()" class="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold">
                        Logout & Re-login
                    </button>
                </div>
            `;
            return;
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Positions data received:', data);
        
        if (data.success) {
            // Fix key names from backend response
            // Keep the full Kite position (instrument_token, buy/sell value,
            // multiplier) so P&L can be recomputed live from the price feed.
            const positions = data.positions.map(p => ({
                ...p,
                average_price: p.averageprice || p.average_price || 0, // Handle both key formats
                pnl: p.pnl || 0
            }));
            
            displayPositions(positions);
        } else {
            positionsList.innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <div class="mb-2">❌ Error</div>
                    <div class="text-sm">${data.error || 'Failed to load positions'}</div>
                    <button onclick="loadPositions()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
                        Retry
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading positions:', error);
        positionsList.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <div class="mb-2">❌ Connection Error</div>
                <div class="text-sm mb-2">${error.message}</div>
                <div class="text-xs text-gray-600 mb-4">
                    Make sure the backend server is running and accessible.
                </div>
                <button onclick="loadPositions()" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">
                    Retry
                </button>
            </div>
        `;
    }
}

// ===========================================
// OPEN POSITIONS — grouped (Derivatives: CE / PE / Futures, Stocks), live P&L
// ===========================================

const DERIV_EXCHANGES = ['NFO', 'BFO', 'MCX', 'CDS', 'BCD'];

function _posGroup(p) {
    if (!DERIV_EXCHANGES.includes(p.exchange)) return 'STK';
    if (/CE$/.test(p.tradingsymbol)) return 'CE';
    if (/PE$/.test(p.tradingsymbol)) return 'PE';
    return 'FUT';
}

// Same formula Kite uses: realised + unrealised at the latest price
function _livePnl(p) {
    const ltp = positionsState.livePrices[p.instrument_token];
    if (ltp === undefined || p.buy_value === undefined || p.sell_value === undefined) return p.pnl || 0;
    const mult = p.multiplier || 1;
    return (p.sell_value - p.buy_value) + (p.quantity * ltp * mult);
}

function _fmtPnl(v) {
    return `${v >= 0 ? '+' : '-'}₹${Math.abs(v).toFixed(2)}`;
}

function _setPnl(el, v) {
    if (!el) return;
    el.textContent = _fmtPnl(v);
    el.classList.toggle('text-green-600', v >= 0);
    el.classList.toggle('text-red-600', v < 0);
}

function _positionCardHtml(position, idx) {
    const isLong = position.quantity > 0;
    const sideColor = isLong ? 'text-green-600' : 'text-red-600';
    const side = isLong ? 'LONG' : 'SHORT';
    const pnl = _livePnl(position);
    return `
        <div class="flex items-center justify-between">
            <div>
                <div class="font-semibold text-xs">
                    <span class="mono">${position.exchange}:${position.tradingsymbol}</span>
                </div>
                <div class="text-xs text-gray-600 mt-0.5">
                    <span class="${sideColor} font-semibold">${side} ${Math.abs(position.quantity)}</span>
                    <span class="mx-1">@</span>
                    <span>₹${Number(position.average_price).toFixed(2)}</span>
                    <span class="ml-2 badge badge-info">${position.product}</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500">LTP <span id="posltp-${idx}" class="mono">${Number(positionsState.livePrices[position.instrument_token] ?? position.last_price ?? 0).toFixed(2)}</span></div>
                <div id="pospnl-${idx}" class="font-bold text-sm pos-pnl-flash ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}">${_fmtPnl(pnl)}</div>
            </div>
        </div>`;
}

function _groupHtml(key, title, items, withExit) {
    const body = items.length
        ? items.map(({ idx }) => `<div class="position-card" data-pos-idx="${idx}" id="poscard-${idx}"></div>`).join('')
        : `<div class="text-xs text-gray-500 py-2 text-center">No ${title} positions</div>`;
    const exitBtn = (withExit && items.length)
        ? `<button type="button" class="pos-group-exit" onclick="openGroupExitModal('${key}')">Exit all ${key}</button>`
        : '';
    return `
        <div class="pos-group">
            <div class="pos-group-head">
                <div class="pos-group-title">${title} <span class="text-gray-500 font-normal">(${items.length})</span>
                    <span id="grppnl-${key}" class="ml-2 mono text-xs font-bold"></span></div>
                ${exitBtn}
            </div>
            ${body}
        </div>`;
}

function displayPositions(positions) {
    const positionsList = document.getElementById('positionsList');
    positionsState.positions = positions || [];

    if (!positions || positions.length === 0) {
        positionsList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <div class="text-4xl mb-2">📊</div>
                <div class="font-semibold mb-1">No Open Positions</div>
                <div class="text-sm">You don't have any open positions right now</div>
            </div>
        `;
        _setPnl(document.getElementById('posTotalPnl'), 0);
        return;
    }

    const groups = { CE: [], PE: [], FUT: [], STK: [] };
    positions.forEach((p, idx) => groups[_posGroup(p)].push({ p, idx }));
    const hasDeriv = groups.CE.length + groups.PE.length + groups.FUT.length > 0;

    let html = `<div class="pos-section-title">Derivatives</div>`;
    if (hasDeriv) {
        html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    ${_groupHtml('CE', 'CE options', groups.CE, true)}
                    ${_groupHtml('PE', 'PE options', groups.PE, true)}
                 </div>`;
        if (groups.FUT.length) html += `<div class="mt-2">${_groupHtml('FUT', 'Futures & others', groups.FUT, false)}</div>`;
    } else {
        html += `<div class="text-xs text-gray-500 py-2 px-1">No derivative positions</div>`;
    }
    html += `<div class="pos-section-title mt-2">Stocks</div>`;
    html += groups.STK.length ? _groupHtml('STK', 'Stocks', groups.STK, false)
                              : `<div class="text-xs text-gray-500 py-2 px-1">No stock positions</div>`;
    positionsList.innerHTML = html;

    positions.forEach((p, idx) => {
        const card = document.getElementById(`poscard-${idx}`);
        if (!card) return;
        card.innerHTML = _positionCardHtml(p, idx);
        card.addEventListener('click', () => selectPosition(p, card));
    });

    _updateLivePnl();
    _subscribePositionTokens();
    _startPositionsLive();
}

function _updateLivePnl() {
    const totals = { CE: 0, PE: 0, FUT: 0, STK: 0 };
    let total = 0;
    positionsState.positions.forEach((p, idx) => {
        const v = _livePnl(p);
        totals[_posGroup(p)] += v;
        total += v;
        _setPnl(document.getElementById(`pospnl-${idx}`), v);
        const ltp = positionsState.livePrices[p.instrument_token];
        const ltpEl = document.getElementById(`posltp-${idx}`);
        if (ltpEl && ltp !== undefined) ltpEl.textContent = Number(ltp).toFixed(2);
    });
    Object.keys(totals).forEach(k => _setPnl(document.getElementById(`grppnl-${k}`), totals[k]));
    _setPnl(document.getElementById('posTotalPnl'), total);
}

async function _subscribePositionTokens(force = false) {
    const tokens = [...new Set(positionsState.positions.map(p => p.instrument_token).filter(Boolean))];
    const key = tokens.sort().join(',');
    if (!tokens.length || (!force && key === positionsState.subscribedKey)) return;
    try {
        await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/trading/subscribe-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': positionsState.userId },
            body: JSON.stringify({ tokens })
        });
        positionsState.subscribedKey = key;
    } catch (e) { console.warn('position token subscribe failed', e); }
}

function _managePageVisible() {
    const pg = document.getElementById('managePositionsPage');
    return pg && !pg.classList.contains('hidden') && !document.hidden;
}

// Every 2 s: read LTPs from the shared price feed (no Kite REST calls).
// Every 30 s: quietly reload the position list (new fills / exits) and re-subscribe.
function _startPositionsLive() {
    if (positionsState.posLiveTimer) return;
    positionsState.posLiveTimer = setInterval(async () => {
        if (!_managePageVisible() || !positionsState.userId) return;
        positionsState.posLiveTick++;
        if (positionsState.posLiveTick % 15 === 0) {
            loadPositions(true);
            _subscribePositionTokens(true);
            return;
        }
        const tokens = [...new Set(positionsState.positions.map(p => p.instrument_token).filter(Boolean))];
        if (!tokens.length) return;
        try {
            const r = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/trading/ltp-ws`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': positionsState.userId },
                body: JSON.stringify({ tokens })
            });
            if (!r.ok) return;
            const d = await r.json();
            if (d.success && d.ltp) {
                Object.entries(d.ltp).forEach(([t, v]) => { positionsState.livePrices[t] = v; });
                _updateLivePnl();
            }
        } catch (e) { /* network blip — keep last values */ }
    }, 2000);
}

// ===========================================
// SELECTED POSITION — pop-up card
// ===========================================

function openPositionModal() {
    const m = document.getElementById('positionModal');
    if (m) {
        m.style.display = 'block';
        m.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function closePositionModal() {
    const m = document.getElementById('positionModal');
    if (m) m.style.display = 'none';
    positionsState.selectedPosition = null;
    document.querySelectorAll('.position-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('positionActionsPanel')?.classList.add('hidden');
    document.getElementById('trailSlConfig')?.classList.add('hidden');
}
window.closePositionModal = closePositionModal;

document.addEventListener('keydown', e => {
    const m = document.getElementById('positionModal');
    if (e.key === 'Escape' && m && m.style.display !== 'none') closePositionModal();
});
document.addEventListener('click', e => {
    if (e.target && e.target.id === 'positionModal') closePositionModal();
});

function selectPosition(position, cardElement) {
    positionsState.selectedPosition = position;

    document.querySelectorAll('.position-card').forEach(card => card.classList.remove('selected'));
    cardElement.classList.add('selected');

    document.getElementById('positionActionsPanel').classList.remove('hidden');

    const isLong = position.quantity > 0;
    const side = isLong ? 'LONG' : 'SHORT';
    const sideColor = isLong ? '#4ade80' : '#fb923c';
    const pnl = _livePnl(position);

    document.getElementById('selectedPositionInfo').innerHTML = `
        <div class="pm-info">
            <div style="font-size:13px; font-weight:700; color:#f1f5f9;">
                <span style="color:#22c55e;">●</span>
                <span style="color:${sideColor};">${side}</span>
                ${position.tradingsymbol}
                <span style="color:#64748b; font-weight:400;">${position.exchange}</span>
            </div>
            <div style="font-size:12px; color:#a3e635; margin-top:6px;">
                Qty: ${Math.abs(position.quantity)} &nbsp;|&nbsp; Avg: ₹${Number(position.average_price).toFixed(2)}
                &nbsp;|&nbsp; ${position.product}
                &nbsp;|&nbsp; P&amp;L: <span style="color:${pnl >= 0 ? '#4ade80' : '#f87171'};">${_fmtPnl(pnl)}</span>
            </div>
        </div>
    `;

    document.getElementById('trailSlConfig').classList.add('hidden');
    document.getElementById('positionMessages').innerHTML = '';
    openPositionModal();
}

// ===========================================
// EXIT ALL CE / PE — same style of pop-up as the trailing "Stop" button
// ===========================================

function openGroupExitModal(opt) {
    const items = positionsState.positions.filter(p => _posGroup(p) === opt);
    if (!items.length) return;
    document.getElementById('groupExitModal')?.remove();

    const list = items.map(p =>
        `${p.quantity > 0 ? 'LONG ' : 'SHORT'} ${Math.abs(p.quantity)} ${p.tradingsymbol}`).join('<br>');

    const modal = document.createElement('div');
    modal.id = 'groupExitModal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center; z-index:9999;`;
    modal.innerHTML = `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px;
                    padding:24px; width:360px; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="font-size:15px; font-weight:700; color:#f1f5f9; margin-bottom:6px;">
                ⏹ All ${opt} options (${items.length})
            </div>
            <div style="font-size:12px; color:#94a3b8; margin-bottom:20px; font-family:monospace; line-height:1.6;">
                ${list}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="gem-cancel-only"
                    style="padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;
                           background:#92400e; color:#fef3c7; border:1px solid #b45309; cursor:pointer;">
                    ⏹ Cancel SLs Only
                    <div style="font-size:11px; font-weight:400; opacity:0.8; margin-top:2px;">
                        Stop trailing and cancel pending orders on all ${opt} — positions stay open
                    </div>
                </button>
                <button id="gem-cancel-exit"
                    style="padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;
                           background:#7f1d1d; color:#fee2e2; border:1px solid #b91c1c; cursor:pointer;">
                    🚪 Cancel SLs + Exit All ${opt}
                    <div style="font-size:11px; font-weight:400; opacity:0.8; margin-top:2px;">
                        Cancel SLs and exit every ${opt} position at MARKET (shorts first)
                    </div>
                </button>
                <button id="gem-dismiss"
                    style="padding:8px 16px; border-radius:8px; font-size:13px;
                           background:transparent; color:#64748b; border:1px solid #334155; cursor:pointer;">
                    Never mind
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('gem-dismiss').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('gem-cancel-only').onclick = () => { close(); _executeGroupExit(opt, 'cancel_sl'); };
    document.getElementById('gem-cancel-exit').onclick = () => { close(); _executeGroupExit(opt, 'exit'); };
}
window.openGroupExitModal = openGroupExitModal;

async function _executeGroupExit(opt, mode) {
    const msg = document.getElementById('positionsGroupMsg');
    clearTimeout(positionsState.groupMsgTimer);
    const show = (html, cls, hideAfterMs) => {
        if (!msg) return;
        msg.innerHTML = `<div class="p-2 mb-2 rounded-lg text-xs border ${cls} flex items-start justify-between gap-2">
            <div>${html}</div>
            <button type="button" onclick="document.getElementById('positionsGroupMsg').innerHTML=''"
                class="text-gray-400 hover:text-white px-1" title="Dismiss">✕</button></div>`;
        if (hideAfterMs) positionsState.groupMsgTimer = setTimeout(() => { msg.innerHTML = ''; }, hideAfterMs);
    };
    show(`⏳ Working on all ${opt}…`, 'border-gray-600 text-gray-400');
    try {
        const r = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/positions/exit-group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': positionsState.userId },
            body: JSON.stringify({ option_type: opt, mode })
        });
        if (r.status === 401) throw new Error('Session expired — please login again');
        const d = await r.json();
        if (!d.success) throw new Error(d.error || 'Failed');
        const fails = [...(d.cancel_failed || []), ...(d.exit_failed || [])];
        let html = `<b>${mode === 'exit' ? '🚪 Exit' : '⏹ Cancel SLs'} — all ${opt}</b>: `
                 + `${(d.stopped_trails || []).length} trail(s) stopped, `
                 + `${(d.cancelled_orders || []).length} order(s) cancelled`
                 + (mode === 'exit' ? `, ${(d.exited || []).length} exit order(s) placed` : '');
        if (d.message) html += ` — ${d.message}`;
        if (fails.length) html += `<br><span style="color:#f87171;">❌ ${fails.length} failed: `
                                + fails.map(f => `${f.tradingsymbol}: ${f.error}`).join(' | ') + `</span>`;
        // Success fades after 15 s; failures stay up to 60 s (or until ✕)
        show(html, fails.length ? 'border-red-700 text-red-300' : 'border-green-700 text-green-300',
             fails.length ? 60000 : 15000);
    } catch (e) {
        show(`❌ ${e.message}`, 'border-red-700 text-red-300', 60000);
    }
    setTimeout(() => { loadPositions(true); fetchAutoTrailStatus(); }, 1500);
}

function showTrailSlConfig() {
    if (!positionsState.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    const configDiv = document.getElementById('trailSlConfig');
    const contentDiv = document.getElementById('trailConfigContent');
    
    const isLong = positionsState.selectedPosition.quantity > 0;
    const avgPrice = positionsState.selectedPosition.average_price;
    
    contentDiv.innerHTML = `
        <div class="text-xs text-gray-500 mb-2">From average price ₹${avgPrice.toFixed(2)}</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
            <div>
                <label class="block text-xs font-semibold text-gray-900 mb-1">SL Type</label>
                <div class="flex gap-1">
                    <button type="button" id="mpSlBtnSLL" onclick="selectMpSlType('SL')"
                        class="flex-1 py-1.5 rounded border-2 text-xs font-bold border-gray-300 bg-white text-gray-500">SL-L</button>
                    <button type="button" id="mpSlBtnSLM" onclick="selectMpSlType('SL-M')"
                        class="flex-1 py-1.5 rounded border-2 text-xs font-bold border-orange-500 bg-orange-500 text-white">SL-M ✓</button>
                </div>
                <input type="hidden" id="mpSlTypeValue" value="SL-M" />
            </div>
            <div title="Initial distance from entry price to place the SL">
                <label class="block text-xs font-semibold text-gray-900 mb-1">Trail Points</label>
                <input type="number" id="trailPoints" value="40" step="0.5" class="w-full px-2 py-1.5 border border-gray-200 rounded text-gray-900 text-sm" />
            </div>
            <div title="How far price must move (as % of trail points) before the SL trails. 50% with 10 pts = moves every 15 pts. Lower = tighter.">
                <label class="block text-xs font-semibold text-gray-900 mb-1">Trail Step %</label>
                <input type="number" id="trailStepPercent" value="50" min="10" max="200" step="5" class="w-full px-2 py-1.5 border border-gray-200 rounded text-gray-900 text-sm" />
            </div>
            <div id="mpMarketProtBox" title="Market protection % for the SL-M order (-1 = Kite default)">
                <label class="block text-xs font-semibold text-gray-900 mb-1">Market Prot. %</label>
                <input type="number" id="mpMarketProt" value="-1" min="-1" max="100" step="1" class="w-full px-2 py-1.5 border border-gray-200 rounded text-gray-900 text-sm font-semibold" />
            </div>
            <div id="mpBufferBox" class="hidden" title="Gap between trigger and limit price for SL-L (0.5–2% for F&O)">
                <label class="block text-xs font-semibold text-gray-900 mb-1">Limit Buffer %</label>
                <input type="number" id="bufferPercent" value="0.5" min="0.2" max="5" step="0.1" class="w-full px-2 py-1.5 border border-gray-200 rounded text-gray-900 text-sm" />
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
            <button id="startTrailBtn" class="btn-success text-white font-semibold px-3 py-2 rounded-lg text-sm"
                title="Place the SL and adjust it yourself with +/- buttons">🎯 Manual Trail</button>
            <button id="startAutoTrailBtn" class="btn-primary text-white font-semibold px-3 py-2 rounded-lg text-sm"
                title="SL moves automatically as price moves in your favour">🤖 Auto Trail</button>
        </div>
        <div class="text-xs text-gray-500 mt-1.5">
            Manual = you move the SL with +/− · Auto = moves on its own · SL-L buffer is ${isLong ? 'below' : 'above'} the trigger. Hover a field for help.
        </div>
    `;
    
    configDiv.classList.remove('hidden');
    
    // Add event listeners
    setTimeout(() => {
        const startBtn = document.getElementById('startTrailBtn');
        const autoBtn = document.getElementById('startAutoTrailBtn');
        if (startBtn) startBtn.addEventListener('click', startTrailing);
        if (autoBtn) autoBtn.addEventListener('click', startAutoTrailing);
    }, 100);
}

// SL order type toggle for the Manage page config panel
function selectMpSlType(slType) {
    const btnSLL = document.getElementById('mpSlBtnSLL');
    const btnSLM = document.getElementById('mpSlBtnSLM');
    const hidden  = document.getElementById('mpSlTypeValue');
    const mpBox   = document.getElementById('mpMarketProtBox');
    const bufBox  = document.getElementById('mpBufferBox');
    if (!btnSLL || !btnSLM || !hidden) return;
    hidden.value = slType;
    if (slType === 'SL-M') {
        btnSLM.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold border-orange-500 bg-orange-500 text-white';
        btnSLL.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold border-gray-300 bg-white text-gray-500';
        if (mpBox)  mpBox.classList.remove('hidden');
        if (bufBox) bufBox.classList.add('hidden');
    } else {
        btnSLL.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold border-blue-500 bg-blue-500 text-white';
        btnSLM.className = 'flex-1 py-2 px-3 rounded border-2 text-xs font-bold border-gray-300 bg-white text-gray-500';
        if (mpBox)  mpBox.classList.add('hidden');
        if (bufBox) bufBox.classList.remove('hidden');
    }
}
window.selectMpSlType = selectMpSlType;

async function startTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const trailStepPercent = parseFloat(document.getElementById('trailStepPercent').value);
    const slOrderType = document.getElementById('mpSlTypeValue')?.value || 'SL-M';

    if (isNaN(trailPoints) || trailPoints <= 0) {
        alert('Please enter a valid trail points value');
        return;
    }
    
    if (isNaN(trailStepPercent) || trailStepPercent < 10 || trailStepPercent > 200) {
        alert('Trail Step percent must be between 10% and 200%');
        return;
    }

    // Validate the type-specific field
    let bufferPercent = null;
    let marketProtection = null;

    if (slOrderType === 'SL') {
        const bufferPercentInput = parseFloat(document.getElementById('bufferPercent').value);
        if (isNaN(bufferPercentInput) || bufferPercentInput < 0.2 || bufferPercentInput > 5) {
            alert('Buffer percent must be between 0.2% and 5%');
            return;
        }
        bufferPercent = bufferPercentInput / 100;  // Convert to decimal
    } else {
        const mpRaw = parseInt(document.getElementById('mpMarketProt')?.value ?? '-1', 10);
        marketProtection = (mpRaw === -1 || (mpRaw >= 1 && mpRaw <= 100)) ? mpRaw : -1;
    }
    
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    
    let triggerPrice = isLong
        ? position.average_price - trailPoints
        : position.average_price + trailPoints;
    triggerPrice = Math.round(triggerPrice / 0.05) * 0.05;
    
    const transactionType = isLong ? 'SELL' : 'BUY';

    // Build the order body based on SL type
    const orderBody = {
        exchange: position.exchange,
        tradingsymbol: position.tradingsymbol,
        transaction_type: transactionType,
        quantity: Math.abs(position.quantity),
        product: position.product,
        order_type: slOrderType,   // 'SL' for SL-L, 'SL-M' for SL-M
        trigger_price: triggerPrice,
        variety: 'regular'
    };

    let limitPrice = null;
    if (slOrderType === 'SL') {
        // SL-L: attach limit price
        limitPrice = isLong
            ? triggerPrice * (1 - bufferPercent)
            : triggerPrice * (1 + bufferPercent);
        limitPrice = Math.round(limitPrice / 0.05) * 0.05;
        orderBody.price = limitPrice;
    } else {
        // SL-M: attach market_protection
        orderBody.market_protection = marketProtection;
    }
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify(orderBody)
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailSlConfig').classList.add('hidden');

            // Manual trail controls only work with SL-L (we need a limit price to display/adjust).
            // For SL-M manual trail, show a simpler confirmation panel instead.
            if (slOrderType === 'SL') {
                showManualTrailControls(data.order_id, triggerPrice, limitPrice, trailPoints);
            }

            const messagesDiv = document.getElementById('positionMessages');
            messagesDiv.innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Manual Trail SL Placed</div>
                    <div class="text-sm space-y-1">
                        <div>Order ID: ${data.order_id}</div>
                        <div>Type: ${slOrderType}</div>
                        <div>Trigger: ₹${triggerPrice.toFixed(2)}</div>
                        ${slOrderType === 'SL' ? `<div>Limit: ₹${limitPrice.toFixed(2)}</div>` : `<div>Market Protection: ${marketProtection === -1 ? 'Default' : marketProtection + '%'}</div>`}
                        <div>Trail Points: ${trailPoints}</div>
                        <div>Trail Step: ${trailStepPercent}%</div>
                    </div>
                </div>
            `;
        } else {
            alert('Error placing order: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function startAutoTrailing() {
    if (!positionsState.selectedPosition) return;
    
    const trailPoints = parseFloat(document.getElementById('trailPoints').value);
    const trailStepPercent = parseFloat(document.getElementById('trailStepPercent').value);
    const slOrderType = document.getElementById('mpSlTypeValue')?.value || 'SL-M';

    if (isNaN(trailPoints) || trailPoints <= 0) {
        alert('Please enter a valid trail points value');
        return;
    }
    
    if (isNaN(trailStepPercent) || trailStepPercent < 10 || trailStepPercent > 200) {
        alert('Trail Step percent must be between 10% and 200%');
        return;
    }

    // Validate and read the type-specific field
    let bufferPercent = 0.005; // default fallback for SL-M (ignored by backend)
    let marketProtection = -1;

    if (slOrderType === 'SL') {
        const bufferPercentInput = parseFloat(document.getElementById('bufferPercent').value);
        if (isNaN(bufferPercentInput) || bufferPercentInput < 0.2 || bufferPercentInput > 5) {
            alert('Buffer percent must be between 0.2% and 5%');
            return;
        }
        bufferPercent = bufferPercentInput / 100;
    } else {
        const mpRaw = parseInt(document.getElementById('mpMarketProt')?.value ?? '-1', 10);
        marketProtection = (mpRaw === -1 || (mpRaw >= 1 && mpRaw <= 100)) ? mpRaw : -1;
    }
    
    const position = positionsState.selectedPosition;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/start-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                quantity: position.quantity,
                average_price: position.average_price,
                product: position.product,
                trail_points: trailPoints,
                buffer_percent: bufferPercent,
                trail_step_percent: trailStepPercent,
                sl_order_type: slOrderType,        // NEW — 'SL' or 'SL-M'
                market_protection: marketProtection // NEW — for SL-M
            })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('trailSlConfig').classList.add('hidden');
            showAutoTrailControls(data.position_key, data.trigger_price, data.limit_price);
        } else {
            alert('Error starting auto trail: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function showAutoTrailControls(positionKey, trigger, limit) {
    // NOTE: This function intentionally does NOT wipe the log panel.
    // The monitor panel is always visible and shows ALL active trailing positions.
    // We just ensure the polling loop is running.
    _ensureTrailPolling();
}

// Start the polling loop if not already running
function _ensureTrailPolling() {
    if (positionsState.autoTrailInterval) return; // already polling
    // Immediately clean any stale positions before starting to poll
    cleanupStaleTrails(false);
    positionsState.autoTrailInterval = setInterval(() => {
        fetchAutoTrailStatus();
    }, 2000);
    // First tick immediately
    fetchAutoTrailStatus();
}
window._ensureTrailPolling = _ensureTrailPolling;

async function fetchAutoTrailStatus() {
    try {
        const userId = positionsState.userId || sessionStorage.getItem('user_id');
        if (!userId) return;
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/get-trail-status`, {
            method: 'GET',
            headers: { 'X-User-ID': userId }
        });
        if (response.status === 401) {
            // Session expired — stop the polling interval immediately, clear and redirect
            if (positionsState.autoTrailInterval) {
                clearInterval(positionsState.autoTrailInterval);
                positionsState.autoTrailInterval = null;
            }
            sessionStorage.clear();
            window.location.reload();
            return;
        }
        const data = await response.json();
        if (data.success && data.positions) {
            updateAutoTrailLog(data.positions, data.logs || []);
        }
    } catch (error) {
        console.error('Error fetching trail status:', error);
    }
}

async function cleanupStaleTrails(showFeedback = false) {
    try {
        const userId = positionsState.userId || sessionStorage.getItem('user_id');
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/cleanup-stale-trails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId }
        });
        const data = await response.json();
        if (data.success && showFeedback) {
            const cleaned = data.cleaned || [];
            if (cleaned.length > 0) {
                alert(`Cleaned up ${cleaned.length} stale trail(s):\n${cleaned.join('\n')}`);
            } else {
                alert('No stale trails found — all monitored positions have active SL orders.');
            }
        }
        return data;
    } catch (e) {
        console.error('cleanupStaleTrails error:', e);
    }
}
window.cleanupStaleTrails = cleanupStaleTrails;

function updateAutoTrailLog(positions, logs) {
    const posDiv = document.getElementById('autoTrailPositions');
    const logDiv = document.getElementById('autoTrailLog');
    const tickDiv = document.getElementById('autoTrailTicks');
    const panels = document.getElementById('autoTrailPanels');
    if (!posDiv || !logDiv) return;

    const posEntries = Object.entries(positions || {});

    // ── Position cards: rewrite freely — no scroll here ──
    if (posEntries.length === 0) {
        posDiv.innerHTML = '<div class="text-gray-500 text-sm mb-3">No active trailing positions</div>';
    } else {
        let posHtml = '';
        for (const [posKey, details] of posEntries) {
            const currentPrice = details.current_price || 0;
            const trigger = details.trigger_price;
            const limit = details.limit_price;
            const pnl = details.pnl || 0;
            const updateCount = details.update_count || 0;
            const distance = Math.abs(currentPrice - trigger);
            const side = details.exit_type === 'SELL' ? 'LONG' : 'SHORT';
            const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
            const sideColor = side === 'LONG' ? 'text-blue-400' : 'text-orange-400';

            posHtml += `
                <div class="border border-green-800 rounded px-3 py-2 mb-2 bg-gray-800">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span class="${sideColor} font-bold text-sm">${side}</span>
                            <span class="text-white font-mono text-sm">${details.symbol}</span>
                            <span class="text-gray-500 text-xs">#${updateCount}</span>
                        </div>
                        <button onclick="stopAutoTrailing('${posKey}')"
                                class="text-xs px-2 py-1 rounded border border-red-500 text-red-400 hover:bg-red-900 transition whitespace-nowrap">
                            ⏹ Stop
                        </button>
                    </div>
                    <div class="text-xs font-mono">
                        LTP: <span class="text-white">₹${currentPrice.toFixed(2)}</span> &nbsp;|&nbsp;
                        SL: <span class="text-yellow-400">₹${trigger.toFixed(2)}</span> &nbsp;|&nbsp;
                        Limit: <span class="text-blue-400">₹${limit !== null && limit !== undefined ? limit.toFixed(2) : 'N/A (SL-M)'}</span>
                    </div>
                    <div class="text-xs font-mono">
                        Dist: <span class="text-white">${distance.toFixed(2)}</span> &nbsp;|&nbsp;
                        P&L: <span class="${pnlColor}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} pts</span>
                    </div>
                </div>
            `;
        }
        posDiv.innerHTML = posHtml;
    }

    // ── Live ticks: one line per position each time its tick count moves.
    //    Built from the live position data on screen only — never sent to logs.
    if (tickDiv) {
        window._atlSeenCounts = window._atlSeenCounts || {};
        const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
        let added = false;
        for (const [posKey, d] of posEntries) {
            const cnt = d.update_count || 0;
            if (window._atlSeenCounts[posKey] === cnt) continue;
            window._atlSeenCounts[posKey] = cnt;
            const ltp = d.current_price || 0, trg = d.trigger_price || 0, pnl = d.pnl || 0;
            const line = document.createElement('div');
            line.className = 'text-xs font-mono ' + (pnl >= 0 ? 'text-green-400' : 'text-red-400');
            line.textContent = `[${now}] ${d.symbol} #${cnt} | LTP ₹${ltp.toFixed(2)} | SL ₹${trg.toFixed(2)} | Dist ${Math.abs(ltp - trg).toFixed(2)} | P&L ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`;
            tickDiv.appendChild(line);
            added = true;
        }
        while (tickDiv.children.length > 200) tickDiv.removeChild(tickDiv.firstChild);
        if (added) tickDiv.scrollTop = tickDiv.scrollHeight;
    }
    if (panels) panels.style.display = (posEntries.length > 0 || logDiv.children.length > 0) ? '' : 'none';

    // ── Log entries: append only lines newer than what's already shown ──
    if (logs && logs.length > 0) {
        if (panels) panels.style.display = '';
        const lastRenderedTime = parseFloat(logDiv.dataset.lastLogTime || '0');
        const newLogs = logs.filter(log => log.time > lastRenderedTime);
        if (newLogs.length > 0) {
            newLogs.forEach(log => {
                const t = new Date(log.time * 1000).toLocaleTimeString();
                const line = document.createElement('div');
                line.className = 'atl-log-line text-xs text-gray-300 font-mono';
                line.textContent = `[${t}] ${log.msg}`;
                logDiv.appendChild(line);
            });
            logDiv.dataset.lastLogTime = newLogs[newLogs.length - 1].time;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    }
}

// ── Stop Trail Modal ────────────────────────────────────────────
function stopAutoTrailing(positionKey) {
    // Build a small inline modal instead of browser confirm()
    const existing = document.getElementById('stopTrailModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'stopTrailModal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center; z-index:9999;`;
    modal.innerHTML = `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px;
                    padding:24px; width:340px; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="font-size:15px; font-weight:700; color:#f1f5f9; margin-bottom:6px;">
                ⏹ Stop Auto Trail
            </div>
            <div style="font-size:12px; color:#94a3b8; margin-bottom:20px; font-family:monospace;">
                ${positionKey}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="stm-cancel-only"
                    style="padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;
                           background:#92400e; color:#fef3c7; border:1px solid #b45309; cursor:pointer;">
                    ⏹ Cancel SL Only
                    <div style="font-size:11px; font-weight:400; opacity:0.8; margin-top:2px;">
                        Stop trailing — SL order cancelled, position stays open
                    </div>
                </button>
                <button id="stm-cancel-exit"
                    style="padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;
                           background:#7f1d1d; color:#fee2e2; border:1px solid #b91c1c; cursor:pointer;">
                    🚪 Cancel SL + Exit Position
                    <div style="font-size:11px; font-weight:400; opacity:0.8; margin-top:2px;">
                        Cancel SL order and exit position at MARKET
                    </div>
                </button>
                <button id="stm-dismiss"
                    style="padding:8px 16px; border-radius:8px; font-size:13px;
                           background:transparent; color:#64748b; border:1px solid #334155; cursor:pointer;">
                    Never mind
                </button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('stm-dismiss').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('stm-cancel-only').onclick = () => {
        close();
        _executeStopTrail(positionKey, false);
    };
    document.getElementById('stm-cancel-exit').onclick = () => {
        close();
        _executeStopTrail(positionKey, true);
    };
}

async function _executeStopTrail(positionKey, exitPosition) {
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/stop-auto-trail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                position_key: positionKey,
                exit_position: exitPosition
            })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }

        const data = await response.json();

        if (data.success) {
            const messagesDiv = document.getElementById('positionMessages');
            if (messagesDiv) {
                const exitNote = exitPosition
                    ? (data.exit_order_id
                        ? `SL cancelled & exit order placed (${data.exit_order_id}).`
                        : `SL cancelled. Exit failed: ${data.exit_error || 'unknown'}`)
                    : `SL order cancelled. Position remains open.`;
                messagesDiv.innerHTML = `
                    <div class="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                        <div class="font-bold text-yellow-800 mb-1">⏹️ Trailing Stopped</div>
                        <div class="text-sm text-yellow-700">${exitNote}</div>
                    </div>`;
            }
            setTimeout(() => fetchAutoTrailStatus(), 300);
        } else {
            alert('Error stopping auto trail: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function showManualTrailControls(orderId, currentTrigger, currentLimit, trailPoints) {
    // Manual trail controls go in the per-position actions area, not the monitor panel
    const statusDiv = document.getElementById('manualTrailPanel');
    const contentDiv = statusDiv;
    
    // Calculate buffer percent from trigger and limit
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    let bufferPercent;
    if (isLong) {
        bufferPercent = (currentTrigger - currentLimit) / currentTrigger;
    } else {
        bufferPercent = (currentLimit - currentTrigger) / currentTrigger;
    }
    const bufferPercentDisplay = (bufferPercent * 100).toFixed(2);
    
    contentDiv.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-4">
                <!-- Price Display -->
                <div class="flex-1 grid grid-cols-2 gap-4">
                    <div class="p-6 bg-green-50 rounded-lg border-2 border-green-200">
                        <div class="text-sm text-gray-600 mb-1">Trigger Price</div>
                        <div class="text-3xl font-bold text-green-600">₹<span id="currentTrigger">${currentTrigger.toFixed(2)}</span></div>
                    </div>
                    <div class="p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <div class="text-sm text-gray-600 mb-1">Limit Price (${bufferPercentDisplay}% buffer)</div>
                        <div class="text-3xl font-bold text-blue-600">₹<span id="currentLimit">${currentLimit.toFixed(2)}</span></div>
                    </div>
                </div>
                
                <!-- Stop Button -->
                <button onclick="stopTrailing('${orderId}')" class="btn-danger text-white font-semibold px-8 py-6 rounded-lg whitespace-nowrap h-full">
                    ⏹️ Stop & Cancel SL
                </button>
            </div>
            
            <!-- Adjustment Controls -->
            <div class="p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                <label class="block text-base font-bold text-gray-900 mb-3">Manual Trigger Adjustment</label>
                <div class="grid grid-cols-4 gap-3">
                    <button onclick="adjustTrigger(-2)" class="border-2 border-gray-300 bg-white text-gray-700 font-semibold px-6 py-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-base">
                        -2 pts
                    </button>
                    <button onclick="adjustTrigger(-1)" class="border-2 border-gray-300 bg-white text-gray-700 font-semibold px-6 py-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-base">
                        -1 pt
                    </button>
                    <button onclick="adjustTrigger(1)" class="border-2 border-gray-300 bg-white text-gray-700 font-semibold px-6 py-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-base">
                        +1 pt
                    </button>
                    <button onclick="adjustTrigger(2)" class="border-2 border-gray-300 bg-white text-gray-700 font-semibold px-6 py-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition text-base">
                        +2 pts
                    </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">Click buttons to manually adjust the trigger price. Limit price will be automatically recalculated.</p>
            </div>
        </div>
    `;
    
    statusDiv.classList.remove('hidden');
    const trailDataStore = document.getElementById('manualTrailPanel');
    trailDataStore.dataset.orderId = orderId;
    trailDataStore.dataset.currentTrigger = currentTrigger;
    trailDataStore.dataset.currentLimit = currentLimit;
    trailDataStore.dataset.bufferPercent = bufferPercent;
}

async function adjustTrigger(points) {
    const statusDiv = document.getElementById('manualTrailPanel');
    const orderId = statusDiv.dataset.orderId;
    let currentTrigger = parseFloat(statusDiv.dataset.currentTrigger);
    const bufferPercent = parseFloat(statusDiv.dataset.bufferPercent) || 0.005;  // Use stored or default to 0.5%
    
    const oldTrigger = currentTrigger;
    currentTrigger += points;
    currentTrigger = Math.round(currentTrigger / 0.05) * 0.05;
    
    const position = positionsState.selectedPosition;
    const isLong = position.quantity > 0;
    
    let limitPrice;
    if (isLong) {
        limitPrice = currentTrigger * (1 - bufferPercent);
    } else {
        limitPrice = currentTrigger * (1 + bufferPercent);
    }
    limitPrice = Math.round(limitPrice / 0.05) * 0.05;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/modify-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular',
                trigger_price: currentTrigger,
                price: limitPrice,
                order_type: 'SL',
                quantity: Math.abs(positionsState.selectedPosition.quantity)
            })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.dataset.orderId = data.order_id;
            statusDiv.dataset.currentTrigger = currentTrigger;
            statusDiv.dataset.currentLimit = limitPrice;
            statusDiv.dataset.bufferPercent = bufferPercent;
            document.getElementById('currentTrigger').textContent = currentTrigger.toFixed(2);
            document.getElementById('currentLimit').textContent = limitPrice.toFixed(2);
            
            const messagesDiv = document.getElementById('positionMessages');
            const timestamp = new Date().toLocaleTimeString();
            const direction = points > 0 ? '⬆️ RAISED' : '⬇️ LOWERED';
            const symbol = positionsState.selectedPosition.tradingsymbol;
            const exchange = positionsState.selectedPosition.exchange;
            
            messagesDiv.innerHTML = `
                <div class="p-3 bg-green-50 border-2 border-green-200 rounded-lg text-sm">
                    <div class="font-bold text-green-800 mb-1">✅ Manual Adjustment</div>
                    <div class="font-mono text-xs space-y-1">
                        <div>[${timestamp}] ${direction} ${exchange}:${symbol}</div>
                        <div>Old Trigger: ₹${oldTrigger.toFixed(2)} → New: ₹${currentTrigger.toFixed(2)} (${points > 0 ? '+' : ''}${points} pts)</div>
                        <div>New Limit: ₹${limitPrice.toFixed(2)}</div>
                        <div>New Order ID: ${data.order_id}</div>
                    </div>
                </div>
            `;
        } else {
            alert('Error modifying order: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function stopTrailing(orderId) {
    if (!confirm('Cancel the stop loss order?')) return;
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/cancel-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                order_id: orderId,
                variety: 'regular'
            })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        
        const data = await response.json();
        
        if (data.success) {
            const mp = document.getElementById('manualTrailPanel');
            if (mp) mp.classList.add('hidden');
            document.getElementById('positionMessages').innerHTML = `
                <div class="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                    <div class="font-bold text-yellow-800 mb-1">⏹️ SL Cancelled</div>
                    <div class="text-sm">Stop loss order cancelled successfully</div>
                </div>
            `;
        } else {
            alert('Error cancelling order: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function exitPositionImmediately() {
    if (!positionsState.selectedPosition) {
        alert('Please select a position first');
        return;
    }
    
    const position = positionsState.selectedPosition;
    const confirmation = confirm(`Exit ${position.tradingsymbol} immediately at market price?`);
    
    if (!confirmation) return;
    
    const transactionType = position.quantity > 0 ? 'SELL' : 'BUY';
    
    try {
        const response = await fetch(`${MANAGE_POSITIONS_CONFIG.backendUrl}/api/place-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': positionsState.userId
            },
            body: JSON.stringify({
                exchange: position.exchange,
                tradingsymbol: position.tradingsymbol,
                transaction_type: transactionType,
                quantity: Math.abs(position.quantity),
                product: position.product,
                order_type: 'MARKET',
                variety: 'regular'
            })
        });
        if (response.status === 401) { throw new Error('Session expired — please login again'); }
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('positionMessages').innerHTML = `
                <div class="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div class="font-bold text-green-800 mb-2">✅ Position Exited</div>
                    <div class="text-sm">
                        Order ID: ${data.order_id}<br>
                        ${position.tradingsymbol} exited at market price
                    </div>
                </div>
            `;
            
            // Refresh positions after 2 seconds
            setTimeout(() => {
                loadPositions();
                // Reset selection
                closePositionModal();
            }, 2000);
        } else {
            alert('Error exiting position: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

// Make functions globally available for onclick handlers
window.adjustTrigger = adjustTrigger;
window.stopTrailing = stopTrailing;
window.stopAutoTrailing = stopAutoTrailing;
window.loadPositions = loadPositions;

// Expose for cross-module access (basket_manager post-deploy trail activation)
window.ManagePositions = {
    showAutoTrailControls: showAutoTrailControls,
    loadPositions: loadPositions,
    state: positionsState
};

console.log('✓ Manage Positions module loaded successfully');

// Strategy presets for the Option Chain page: one click loads the legs into the
// basket (hedges first — lower margin), for the instrument/expiry/lots selected
// at the top of the page. Nothing is placed until you press Deploy All.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const STEP = { NIFTY: 50, BANKNIFTY: 100 };
    const DEF = { NIFTY: { wing: 200, hedge: 300 }, BANKNIFTY: { wing: 500, hedge: 800 } };
    const $ = id => document.getElementById(id);
    const uid = () => sessionStorage.getItem('user_id');
    const inst = () => (typeof TradingState !== 'undefined' && TradingState.instrument) || 'NIFTY';

    const STRATS = {
        short_straddle: { name: 'Short Straddle', sub: 'Sell ATM CE + PE, buy hedges', legs: (a, w, h) => [
            ['BUY', 'CE', a + h], ['BUY', 'PE', a - h], ['SELL', 'CE', a], ['SELL', 'PE', a]] },
        short_strangle: { name: 'Short Strangle', sub: 'Sell OTM CE + PE, buy hedges', legs: (a, w, h) => [
            ['BUY', 'CE', a + w + h], ['BUY', 'PE', a - w - h], ['SELL', 'CE', a + w], ['SELL', 'PE', a - w]] },
        long_straddle: { name: 'Long Straddle', sub: 'Buy ATM CE + PE', legs: a => [['BUY', 'CE', a], ['BUY', 'PE', a]] },
        long_strangle: { name: 'Long Strangle', sub: 'Buy OTM CE + PE', legs: (a, w) => [['BUY', 'CE', a + w], ['BUY', 'PE', a - w]] },
    };

    function params() {
        let p = {};
        try { p = JSON.parse(localStorage.getItem('bvr_strat_' + inst()) || '{}'); } catch (e) { /* */ }
        return { wing: +p.wing || DEF[inst()].wing, hedge: +p.hedge || DEF[inst()].hedge };
    }
    function saveParams() {
        const p = { wing: Math.max(STEP[inst()], +$('stWing').value || 0), hedge: Math.max(STEP[inst()], +$('stHedge').value || 0) };
        try { localStorage.setItem('bvr_strat_' + inst(), JSON.stringify(p)); } catch (e) { /* */ }
        render();
    }

    function render() {
        const box = $('tp-strategies-body');
        if (!box) return;
        if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // don't wipe while typing
        const keepMsg = ($('stMsg') || {}).textContent || '';
        const p = params(), i = inst();
        const exp = (typeof TradingState !== 'undefined' && TradingState.optionChainData && TradingState.optionChainData.expiry) || '—';
        box.innerHTML = `
            <div class="st-ctx">${i} · expiry <b>${exp}</b> · ${(typeof TradingState !== 'undefined' && TradingState.lots) || 1} lot(s) per leg</div>
            <div class="st-params">
                <label>Strangle wings <span>± pts from ATM</span><input id="stWing" type="number" step="${STEP[i]}" min="${STEP[i]}" value="${p.wing}" onchange="stSaveParams()"></label>
                <label>Hedge distance <span>pts beyond the sold strike</span><input id="stHedge" type="number" step="${STEP[i]}" min="${STEP[i]}" value="${p.hedge}" onchange="stSaveParams()"></label>
            </div>
            <div class="st-list">${Object.entries(STRATS).map(([k, s]) => `
                <button class="st-card" onclick="stLoad('${k}')">
                    <div class="st-name">${s.name}</div><div class="st-sub">${s.sub}</div>
                    <div class="st-legs">${preview(k)}</div>
                </button>`).join('')}</div>
            <div id="stMsg" class="st-msg">${keepMsg}</div>`;
    }
    function atm() {
        const d = typeof TradingState !== 'undefined' && TradingState.optionChainData;
        const spot = d && (TradingState.ltpMap[{ NIFTY: 256265, BANKNIFTY: 260105 }[inst()]] || d.spot);
        return spot ? Math.round(spot / STEP[inst()]) * STEP[inst()] : null;
    }
    function preview(k) {
        const a = atm(), p = params();
        if (!a) return '';
        return STRATS[k].legs(a, p.wing, p.hedge).map(([t, ty, k2]) =>
            `<span class="${t === 'BUY' ? 'st-b' : 'st-s'}">${t === 'BUY' ? 'B' : 'S'} ${k2} ${ty}</span>`).join('');
    }

    async function load(key) {
        const msg = t => { const m = $('stMsg'); if (m) m.textContent = t; };
        const d = typeof TradingState !== 'undefined' && TradingState.optionChainData;
        if (!d || !d.expiry) { msg('Option chain not loaded yet'); return; }
        const a = atm(), p = params(), i = inst(), lots = TradingState.lots || 1;
        const legs = STRATS[key].legs(a, p.wing, p.hedge);
        const BM = window.BasketManager;
        if (BM.getCount() && !confirm(`Replace the ${BM.getCount()} leg(s) in the basket with ${STRATS[key].name}?`)) return;
        msg('Loading strikes…');
        try {
            const post = (path, body) => fetch(`${API}/api/simulate/${path}`, { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify(body) }).then(r => r.json());
            const ch = await post('strikes', { instrument: i, expiry: d.expiry });
            if (!ch.success) throw new Error(ch.error);
            const pick = (k, ty) => {   // nearest listed strike
                const ks = ch.strikes.filter(s => ch.symbols[`${s}${ty}`]);
                const best = ks.reduce((b, s) => Math.abs(s - k) < Math.abs(b - k) ? s : b, ks[0]);
                return { strike: best, symbol: ch.symbols[`${best}${ty}`] };
            };
            const rows = legs.map(([txn, ty, k]) => ({ txn, ty, ...pick(k, ty) }));
            const q = await post('quote', { symbols: rows.map(r => r.symbol) });
            const prod = (document.querySelector('.tp-product-btn.active, [data-product].active') || {}).dataset?.product || 'NRML';
            BM.clearBasket ? BM.clearBasket() : BM.getOrders().forEach(o => BM.removeOrder(o.tradingsymbol, o.transaction_type));
            rows.forEach(r => BM.addOrder({
                exchange: 'NFO', tradingsymbol: r.symbol, transaction_type: r.txn, lots, product: prod,
                order_type: 'MARKET', variety: 'regular', market_protection: -1,
                token: ch.tokens ? ch.tokens[r.symbol] : undefined, strike: r.strike,
                last_price: q.legs && q.legs[r.symbol] ? q.legs[r.symbol].ltp : undefined,
            }));
            if (typeof renderBasket === 'function') renderBasket();
            if (typeof _collectTokens === 'function') _collectTokens();
            if (typeof updateBasketCountDisplay === 'function') updateBasketCountDisplay();
            msg(`${STRATS[key].name} loaded — ${rows.length} legs (hedges first). Adjust in the basket, then Deploy.`);
        } catch (e) { msg('Could not load: ' + e.message); }
    }

    window.stLoad = load;
    window.stSaveParams = saveParams;
    window.renderStrategies = render;
})();

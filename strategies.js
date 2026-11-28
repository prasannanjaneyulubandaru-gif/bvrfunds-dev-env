// Strategy presets for the Option Chain page: one click loads the legs into the
// basket (buys/hedges first — lower margin) for the index / expiry / lots chosen
// at the top of the page. Nothing is placed until you press Deploy All.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const STEP = { NIFTY: 50, BANKNIFTY: 100 };
    const IDX_TOKEN = { NIFTY: 256265, BANKNIFTY: 260105 };
    const DEF = { NIFTY: { wing: 200, hedge: 300 }, BANKNIFTY: { wing: 500, hedge: 800 } };
    const $ = id => document.getElementById(id);
    const uid = () => sessionStorage.getItem('user_id');
    const TS = () => (typeof TradingState !== 'undefined' ? TradingState : {});
    const inst = () => TS().instrument || 'NIFTY';
    const post = (path, body) => fetch(`${API}/api/simulate/${path}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify(body) }).then(r => r.json());

    // Leg shorthand for previews: [side, type, strike-expression, qty-multiplier, expiry tag]
    //   type: CE / PE / FUT · expiry tag: 'w' = selected expiry, 'm' = monthly (near future's expiry)
    // dir: up = favours a rise, down = favours a fall, flat = range-bound, move = big move either way
    const STRATS = {
        bull_collar: { uses: ['wing'], name: 'Bull Collar', dir: 'up', tag: 'cost-funded', sub: 'Buy future + ATM put, sell monthly OTM call (wing) to fund the put',
            legs: (a, p) => [['BUY', 'PE', a], ['BUY', 'FUT'], ['SELL', 'CE', a + p.wing, 1, 'm']] },
        bear_collar: { uses: ['wing'], name: 'Bear Collar', dir: 'down', tag: 'cost-funded', sub: 'Sell future + buy ATM call, sell monthly OTM put (wing) to fund the call',
            legs: (a, p) => [['BUY', 'CE', a], ['SELL', 'FUT'], ['SELL', 'PE', a - p.wing, 1, 'm']] },
        call_rocket: { name: 'Call Rocket 1×2', dir: 'up', tag: 'breakout · no downside risk', sub: 'Sell 1 ATM call, buy 2 OTM calls at ~half its premium',
            legs: a => [['BUY', 'CE', 'half', 2], ['SELL', 'CE', a]] },
        put_rocket: { name: 'Put Rocket 1×2', dir: 'down', tag: 'crash · no upside risk', sub: 'Sell 1 ATM put, buy 2 OTM puts at ~half its premium',
            legs: a => [['BUY', 'PE', 'half', 2], ['SELL', 'PE', a]] },
        bull_shield: { name: 'Bull Shield', dir: 'up', tag: 'capped loss', sub: 'Buy future + buy ATM put (synthetic long call)',
            legs: a => [['BUY', 'PE', a], ['BUY', 'FUT']] },
        bear_shield: { name: 'Bear Shield', dir: 'down', tag: 'capped loss', sub: 'Sell future + buy ATM call (synthetic long put)',
            legs: a => [['BUY', 'CE', a], ['SELL', 'FUT']] },
        short_straddle: { uses: ['hedge'], name: 'Short Straddle', dir: 'flat', tag: 'hedged', sub: 'Sell ATM CE + PE, buy hedges beyond',
            legs: (a, p) => [['BUY', 'CE', a + p.hedge], ['BUY', 'PE', a - p.hedge], ['SELL', 'CE', a], ['SELL', 'PE', a]] },
        short_strangle: { uses: ['wing', 'hedge'], name: 'Short Strangle', dir: 'flat', tag: 'hedged', sub: 'Sell OTM CE + PE, buy hedges further out',
            legs: (a, p) => [['BUY', 'CE', a + p.wing + p.hedge], ['BUY', 'PE', a - p.wing - p.hedge], ['SELL', 'CE', a + p.wing], ['SELL', 'PE', a - p.wing]] },
        long_straddle: { name: 'Long Straddle', dir: 'move', tag: 'either way', sub: 'Buy ATM CE + PE', legs: a => [['BUY', 'CE', a], ['BUY', 'PE', a]] },
        long_strangle: { uses: ['wing'], name: 'Long Strangle', dir: 'move', tag: 'either way', sub: 'Buy OTM CE + PE', legs: (a, p) => [['BUY', 'CE', a + p.wing], ['BUY', 'PE', a - p.wing]] },
    };
    const DIR = { up: '▲ Bullish', down: '▼ Bearish', flat: '◆ Neutral', move: '⇕ Big move' };

    // Distances are kept per strategy and per index (e.g. collar wing ≠ strangle wing)
    const LBL = { wing: k => (k.includes('collar') ? 'OTM sell' : 'Wings') + ' ±', hedge: () => 'Hedge +' };
    function params(k) {
        let p = {};
        try { p = JSON.parse(localStorage.getItem(`bvr_strat_${inst()}_${k}`) || '{}'); } catch (e) { /* */ }
        return { wing: +p.wing || DEF[inst()].wing, hedge: +p.hedge || DEF[inst()].hedge };
    }
    function saveParam(k, field, v) {
        const p = params(k);
        p[field] = Math.max(STEP[inst()], Math.round((+v || 0) / STEP[inst()]) * STEP[inst()]);
        try { localStorage.setItem(`bvr_strat_${inst()}_${k}`, JSON.stringify(p)); } catch (e) { /* */ }
        render();
    }
    function spot() { const d = TS().optionChainData; return d && ((TS().ltpMap || {})[IDX_TOKEN[inst()]] || d.spot); }
    function atm() { const s = spot(); return s ? Math.round(s / STEP[inst()]) * STEP[inst()] : null; }
    const nearFut = () => ((TS().futuresPanelData || {}).futures || [])[0];

    function preview(k) {
        const a = atm();
        if (!a) return '';
        return STRATS[k].legs(a, params(k)).map(([t, ty, k2, x, e]) => {
            const what = ty === 'FUT' ? 'FUT' : `${k2 === 'half' ? '½-prem' : k2} ${ty}${e === 'm' ? ' (M)' : ''}`;
            return `<span class="${t === 'BUY' ? 'st-b' : 'st-s'}">${(x || 1) > 1 ? x + '× ' : ''}${t === 'BUY' ? 'B' : 'S'} ${what}</span>`;
        }).join('');
    }

    function render() {
        const box = $('tp-strategies-body');
        if (!box) return;
        if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // don't wipe while typing
        const keepMsg = ($('stMsg') || {}).textContent || '';
        const i = inst(), d = TS().optionChainData;
        box.innerHTML = `
            <div class="st-top">
                <div class="st-ctx">${i} · expiry <b>${(d && d.expiry) || '—'}</b> · ${TS().lots || 1} lot(s) · ATM <b>${atm() || '—'}</b></div>
                <div id="stMsg" class="st-msg">${keepMsg}</div>
            </div>
            <div class="st-list">${Object.entries(STRATS).map(([k, s]) => `
                <div class="st-card st-${s.dir}" role="button" tabindex="0" onclick="stLoad('${k}')" onkeydown="if(event.key==='Enter')stLoad('${k}')">
                    <div class="st-head"><span class="st-name">${s.name}</span><span class="st-dir st-dir-${s.dir}">${DIR[s.dir]}</span></div>
                    <div class="st-tag">${s.tag}</div>
                    <div class="st-sub">${s.sub}</div>
                    <div class="st-legs">${preview(k)}</div>
                    ${(s.uses || []).length ? `<div class="st-opts" onclick="event.stopPropagation()">${s.uses.map(f =>
                        `<label>${LBL[f](k)}<input type="number" step="${STEP[i]}" min="${STEP[i]}" value="${params(k)[f]}"
                            onchange="stSetParam('${k}','${f}',this.value)"> pts</label>`).join('')}</div>` : ''}
                </div>`).join('')}</div>`;
    }

    async function chainFor(expiry) {
        const ch = await post('strikes', { instrument: inst(), expiry });
        if (!ch.success) throw new Error(ch.error);
        if (expiry && ch.expiry !== expiry) throw new Error(`no ${inst()} options for expiry ${expiry}`);
        return ch;
    }
    function pick(ch, k, ty) {   // nearest listed strike
        const ks = ch.strikes.filter(s => ch.symbols[`${s}${ty}`]);
        const best = ks.reduce((b, s) => Math.abs(s - k) < Math.abs(b - k) ? s : b, ks[0]);
        const sym = ch.symbols[`${best}${ty}`];
        return { strike: best, symbol: sym, token: ch.tokens ? ch.tokens[sym] : undefined };
    }

    async function load(key) {
        const msg = t => { const m = $('stMsg'); if (m) m.textContent = t; };
        const d = TS().optionChainData;
        if (!d || !d.expiry) { msg('Option chain not loaded yet'); return; }
        const S = STRATS[key], a = atm(), lots = TS().lots || 1, BM = window.BasketManager;
        const spec = S.legs(a, params(key));
        if (BM.getCount() && !confirm(`Replace the ${BM.getCount()} leg(s) in the basket with ${S.name}?`)) return;
        msg(`Loading ${S.name}…`);
        try {
            const fut = nearFut();
            if (spec.some(l => l[1] === 'FUT') && !fut) throw new Error('futures not loaded yet');
            const chW = await chainFor(d.expiry);
            const chM = spec.some(l => l[4] === 'm') ? await chainFor(fut.expiry) : null;
            const out = [];
            for (const [txn, ty, k, mult, e] of spec) {
                if (ty === 'FUT') { out.push({ txn, symbol: fut.symbol, token: fut.token, strike: null, lots, ltp: fut.ltp }); continue; }
                const ch = e === 'm' ? chM : chW;
                if (k === 'half') {
                    // ratio leg: OTM strike whose premium is closest to half the ATM premium
                    const atmLeg = pick(ch, a, ty);
                    const otm = ch.strikes.filter(s => (ty === 'CE' ? s > a : s < a) && ch.symbols[`${s}${ty}`])
                        .sort((x, y) => Math.abs(x - a) - Math.abs(y - a)).slice(0, 40);
                    const q = await post('quote', { symbols: [atmLeg.symbol, ...otm.map(s => ch.symbols[`${s}${ty}`])] });
                    const atmPx = (q.legs[atmLeg.symbol] || {}).ltp;
                    if (!atmPx) throw new Error('no ATM price');
                    const best = otm.map(s => ({ s, px: (q.legs[ch.symbols[`${s}${ty}`]] || {}).ltp }))
                        .filter(o => o.px > 0).reduce((b, o) => !b || Math.abs(o.px - atmPx / 2) < Math.abs(b.px - atmPx / 2) ? o : b, null);
                    if (!best) throw new Error('no OTM prices');
                    out.push({ txn, ...pick(ch, best.s, ty), lots: lots * (mult || 1), ltp: best.px });
                    continue;
                }
                out.push({ txn, ...pick(ch, k, ty), lots: lots * (mult || 1) });
            }
            const need = out.filter(o => o.ltp == null).map(o => o.symbol);
            if (need.length) {
                const q = await post('quote', { symbols: need });
                out.forEach(o => { if (o.ltp == null && q.legs && q.legs[o.symbol]) o.ltp = q.legs[o.symbol].ltp; });
            }
            out.sort((x, y) => (x.txn === 'BUY' ? 0 : 1) - (y.txn === 'BUY' ? 0 : 1));   // buys first → margin benefit
            const prod = (document.querySelector('#tp-bulk-product button.active') || {}).dataset?.product || 'NRML';
            BM.clearBasket();
            out.forEach(o => BM.addOrder({
                exchange: 'NFO', tradingsymbol: o.symbol, transaction_type: o.txn, lots: o.lots, product: prod,
                order_type: 'MARKET', variety: 'regular', market_protection: -1,
                token: o.token, strike: o.strike ?? undefined, last_price: o.ltp,
            }));
            if (typeof renderBasket === 'function') renderBasket();
            if (typeof _collectTokens === 'function') _collectTokens();
            if (typeof updateBasketCountDisplay === 'function') updateBasketCountDisplay();
            msg(`${S.name} loaded — ${out.length} legs, buys first. Adjust in the basket, then Deploy.`);
        } catch (e) { msg(`Could not load ${S.name}: ${e.message}`); }
    }

    window.stLoad = load;
    window.stSetParam = saveParam;
    window.renderStrategies = render;
})();

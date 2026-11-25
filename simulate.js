// Simulate page — options strategy simulator (NIFTY / BANKNIFTY).
// Black-Scholes pricing in the browser; IV implied from each leg's live price.
// Read-only: never places orders.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const R = 0.065;                         // risk-free rate (approx. Indian T-bill)
    const RANGE = { NIFTY: 0.06, BANKNIFTY: 0.08 };
    const S = { und: 'NIFTY', legs: [], spots: {}, shift: 0, days: 0, ivShift: 0, timer: null, chain: null, hover: null };
    const $ = id => document.getElementById(id);
    const uid = () => sessionStorage.getItem('user_id');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const inr = (v, d = 0) => v == null || !isFinite(v) ? '—' : (v < 0 ? '-₹' : '₹') + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: d });
    const pnlHtml = (v, d = 0) => `<span class="${v >= 0 ? 'sim-pos' : 'sim-neg'}">${v >= 0 ? '+' : ''}${inr(v, d)}</span>`;
    async function post(path, body) {
        const r = await fetch(`${API}/api/simulate/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!j.success) throw new Error(j.error || r.status);
        return j;
    }

    // ── Black-Scholes ────────────────────────────────────────────────
    const N = x => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
    const n = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    function bs(type, s, k, t, v) {
        if (t <= 1e-6 || v <= 0) {
            const iv = type === 'CE' ? Math.max(s - k, 0) : Math.max(k - s, 0);
            return { price: iv, delta: type === 'CE' ? (s > k ? 1 : 0) : (s < k ? -1 : 0), gamma: 0, theta: 0, vega: 0 };
        }
        const sq = Math.sqrt(t), d1 = (Math.log(s / k) + (R + v * v / 2) * t) / (v * sq), d2 = d1 - v * sq, df = Math.exp(-R * t);
        const call = type === 'CE';
        const price = call ? s * N(d1) - k * df * N(d2) : k * df * N(-d2) - s * N(-d1);
        const theta = (-(s * n(d1) * v) / (2 * sq) - (call ? 1 : -1) * R * k * df * N(call ? d2 : -d2)) / 365;
        return { price, delta: call ? N(d1) : N(d1) - 1, gamma: n(d1) / (s * v * sq), theta, vega: s * n(d1) * sq / 100 };
    }
    function impliedVol(type, s, k, t, px) {
        if (!(px > 0) || t <= 1e-6) return null;
        const intr = type === 'CE' ? Math.max(s - k * Math.exp(-R * t), 0) : Math.max(k * Math.exp(-R * t) - s, 0);
        if (px <= intr + 0.05) return null;
        let lo = 0.005, hi = 3;
        for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; (bs(type, s, k, t, m).price > px) ? hi = m : lo = m; }
        return (lo + hi) / 2;
    }
    const expiryMs = e => new Date(e + 'T15:30:00+05:30').getTime();
    // Futures: F = S·e^(carry·T). Carry is implied from the live futures price vs spot,
    // so the basis shrinks naturally towards expiry and moves with the spot slider.
    function futPx(l, s, t) { return s * Math.exp((l.carry ?? R) * t); }
    const yearsTo = (e, atMs) => Math.max(0, (expiryMs(e) - atMs) / (365 * 86400000));

    // ── legs ─────────────────────────────────────────────────────────
    const active = () => S.legs.filter(l => l.on && l.underlying === S.und);
    const nearestExpiry = () => active().map(l => l.expiry).sort()[0];
    function fallbackIv(l) {
        const same = S.legs.filter(x => x.underlying === l.underlying && x.iv);
        return same.length ? same.reduce((a, x) => a + x.iv, 0) / same.length : (l.underlying === 'BANKNIFTY' ? 0.14 : 0.12);
    }
    function refreshIv() {
        const now = Date.now();
        S.legs.forEach(l => {
            const s = S.spots[l.underlying], t = yearsTo(l.expiry, now);
            if (!s || !l.ltp) return;
            if (l.option_type === 'FUT') { if (t > 1e-4) l.carry = Math.log(l.ltp / s) / t; return; }
            l.iv = impliedVol(l.option_type, s, l.strike, t, l.ltp) || l.iv;
        });
        S.legs.forEach(l => { if (!l.iv && l.option_type !== 'FUT') l.ivEst = fallbackIv(l); });
    }
    const legIv = l => Math.max(0.01, (l.iv || l.ivEst || 0.12) + S.ivShift / 100);

    async function addSymbols(rows, source) {
        if (!rows.length) return 0;
        const q = await post('quote', { symbols: rows.map(r => r.symbol), underlyings: ['NIFTY', 'BANKNIFTY'] });
        Object.assign(S.spots, q.spots);
        let added = 0;
        rows.forEach(r => {
            const m = q.legs[r.symbol];
            // basket orders carry lots, not quantity → lots × lot size
            const qty = r.qty || (r.lots ? r.sign * r.lots * (m && m.lot_size || 0) : 0);
            if (!m || !qty) return;
            S.legs.push({ id: Math.random().toString(36).slice(2), symbol: r.symbol, ...m, qty,
                          entry: r.entry ?? m.ltp, source, on: true });
            added++;
        });
        if (added) S.und = S.legs[S.legs.length - 1].underlying;
        if (added) refreshMargin();
        refreshIv();
        return added;
    }

    async function loadPositions() {
        msg('Loading open positions…');
        try {
            const r = await fetch(`${API}/api/positions`, { headers: { 'X-User-ID': uid() } });
            const j = await r.json();
            const rows = (j.positions || []).filter(p => p.quantity && /(CE|PE|FUT)$/.test(p.tradingsymbol) && p.exchange === 'NFO')
                .map(p => ({ symbol: p.tradingsymbol, qty: p.quantity, entry: p.average_price }));
            S.legs = S.legs.filter(l => l.source !== 'positions');
            const k = await addSymbols(rows, 'positions');
            msg(k ? `${k} open position leg(s) loaded` : 'No open NIFTY / BANKNIFTY option positions');
        } catch (e) { msg('Could not load positions: ' + e.message); }
        render();
    }
    async function loadBasket() {
        const orders = window.BasketManager ? window.BasketManager.getOrders() : [];
        const rows = orders.filter(o => /(CE|PE|FUT)$/.test(o.tradingsymbol || ''))
            .map(o => ({ symbol: o.tradingsymbol, sign: o.transaction_type === 'SELL' ? -1 : 1,
                         qty: o.quantity ? (o.transaction_type === 'SELL' ? -1 : 1) * o.quantity : 0, lots: +o.lots || 0 }));
        if (!rows.length) { msg('Basket is empty — add legs on the Option Chain page'); return; }
        try {
            S.legs = S.legs.filter(l => l.source !== 'basket');
            const k = await addSymbols(rows, 'basket');
            msg(`${k} basket leg(s) loaded at current prices`);
        } catch (e) { msg('Could not load basket: ' + e.message); }
        render();
    }
    async function refreshSpot() {
        try { const q = await post('quote', { symbols: [], underlyings: [S.und] }); Object.assign(S.spots, q.spots); } catch (e) { /* keep */ }
    }
    // Funds needed to deploy these legs (same Kite basket-margin check as the Option Chain page)
    let _mTimer = null;
    function refreshMargin() {
        clearTimeout(_mTimer);
        _mTimer = setTimeout(async () => {
            const legs = active();
            if (!legs.length) { S.margin = null; render(); return; }
            const orders = [...legs].sort((a, b) => b.qty - a.qty)      // buys first → hedge benefit
                .map(l => ({ exchange: 'NFO', tradingsymbol: l.symbol, transaction_type: l.qty > 0 ? 'BUY' : 'SELL',
                             lots: Math.abs(l.qty) / (l.lot_size || 1), product: 'NRML', order_type: 'MARKET' }));
            try {
                const r = await fetch(`${API}/api/strategy/check-basket-margin`, { method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify({ orders }) });
                const j = await r.json();
                S.margin = j.success ? j.total_required : null;
            } catch (e) { S.margin = null; }
            render();
        }, 600);
    }
    async function tickPrices() {
        if (!S.legs.length || !visible()) return;
        try {
            const q = await post('quote', { symbols: [...new Set(S.legs.map(l => l.symbol))], underlyings: [S.und] });
            Object.assign(S.spots, q.spots);
            S.legs.forEach(l => { const m = q.legs[l.symbol]; if (m && m.ltp != null) l.ltp = m.ltp; });
            refreshIv();
            render();
        } catch (e) { /* keep last */ }
    }
    const visible = () => { const p = $('simulatePage'); return p && !p.classList.contains('hidden') && !document.hidden; };
    const msg = t => { const el = $('simMsg'); if (el) el.textContent = t || ''; };

    // ── valuation ────────────────────────────────────────────────────
    function legVal(l, spot, atMs) {
        const t = yearsTo(l.expiry, atMs);
        if (l.option_type === 'FUT') {
            const f = futPx(l, spot, t);
            return { price: f, delta: f / spot, gamma: 0, theta: 0, vega: 0 };
        }
        return bs(l.option_type, spot, l.strike, t, legIv(l));
    }
    function value(spot, atMs, legs) {
        let pnl = 0, g = { delta: 0, gamma: 0, theta: 0, vega: 0 };
        legs.forEach(l => {
            const r = legVal(l, spot, atMs);
            pnl += l.qty * (r.price - l.entry);
            g.delta += l.qty * r.delta; g.gamma += l.qty * r.gamma; g.theta += l.qty * r.theta; g.vega += l.qty * r.vega;
        });
        return { pnl, ...g };
    }

    // ── render ───────────────────────────────────────────────────────
    function render() {
        if (!$('simulatePage')) return;
        document.querySelectorAll('.sim-und').forEach(b => b.classList.toggle('active', b.dataset.und === S.und));
        const legs = active();
        const spot = S.spots[S.und];
        const ne = nearestExpiry();
        const maxDays = ne ? Math.max(0, Math.ceil((expiryMs(ne) - Date.now()) / 86400000)) : 0;
        const ds = $('simDays');
        ds.max = maxDays; if (S.days > maxDays) S.days = maxDays; ds.value = S.days;
        const rng = RANGE[S.und] * 100;
        $('simShift').min = -rng; $('simShift').max = rng; $('simShift').value = S.shift;
        S.maxDays = maxDays;
        const atMs = S.days >= maxDays && ne ? expiryMs(ne) : Date.now() + S.days * 86400000;
        const simSpot = spot ? spot * (1 + S.shift / 100) : null;
        if (spot && document.activeElement !== $('simTarget')) $('simTarget').value = simSpot.toFixed(2);
        $('simShiftLbl').textContent = spot ? `${S.shift >= 0 ? '+' : ''}${(+S.shift).toFixed(2)}%` : '';
        $('simShiftLbl').className = 'sim-pct ' + (S.shift > 0 ? 'sim-pos' : S.shift < 0 ? 'sim-neg' : '');
        $('simTargetName').textContent = `${S.und} Target`;
        const left = ne ? Math.max(0, (expiryMs(ne) - atMs) / 86400000) : 0;
        $('simDaysLbl').textContent = ne ? `${Math.round(left)}D to expiry` : '—';
        $('simDateTxt').textContent = ne ? new Date(atMs).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
        $('simDateFrom').textContent = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
        $('simDateTo').textContent = ne ? new Date(expiryMs(ne)).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }) : '';

        $('simSpot').textContent = spot ? `${S.und} spot ${spot.toLocaleString('en-IN')}` : '';

        // legs table
        const now = Date.now();
        $('simLegs').innerHTML = S.legs.length ? `<table class="sim-table"><thead><tr><th></th><th>Contract</th><th>Side</th><th>Qty</th><th>Entry</th><th>LTP</th><th>IV</th>
            <th>Delta</th><th>Theta/day</th><th>Vega/1%</th><th>P&L now</th><th>From</th><th></th></tr></thead><tbody>` +
            S.legs.map(l => {
                const r = legVal(l, S.spots[l.underlying] || l.strike || l.ltp, now);
                const off = l.underlying !== S.und;
                return `<tr class="${off || !l.on ? 'sim-off' : ''}">
                    <td><input type="checkbox" ${l.on ? 'checked' : ''} onchange="simToggle('${l.id}')"></td>
                    <td class="mono">${esc(l.symbol)}<div class="sim-sub">${l.expiry}</div></td>
                    <td class="${l.qty > 0 ? 'sim-pos' : 'sim-neg'}">${l.qty > 0 ? 'BUY' : 'SELL'}</td>
                    <td><input class="sim-qty" type="number" value="${Math.abs(l.qty) / (l.lot_size || 1)}" min="1" onchange="simLots('${l.id}', this.value)"> <span class="sim-sub">× ${l.lot_size}</span></td>
                    <td><input class="sim-qty" style="width:100px" type="number" step="0.05" value="${(+l.entry || 0).toFixed(2)}" onchange="simEntry('${l.id}', this.value)"></td>
                    <td>${l.ltp != null ? (+l.ltp).toFixed(2) : '—'}</td>
                    <td>${l.option_type === 'FUT' ? '<span class="sim-sub">future</span>' : l.iv ? (l.iv * 100).toFixed(1) + '%' : `<span class="sim-sub" title="No usable price — using average IV">~${((l.ivEst || 0) * 100).toFixed(1)}%</span>`}</td>
                    <td>${(l.qty * r.delta).toFixed(1)}</td><td>${inr(l.qty * r.theta)}</td><td>${inr(l.qty * r.vega)}</td>
                    <td>${l.ltp != null ? pnlHtml(l.qty * (l.ltp - l.entry)) : '—'}</td>
                    <td class="sim-sub">${l.source}</td>
                    <td><button class="sim-x" title="Remove" onclick="simRemove('${l.id}')">✕</button></td></tr>`;
            }).join('') + '</tbody></table>'
            : '<div class="sim-empty">Load your open positions or basket, or add a leg below.</div>';

        if (!legs.length || !spot) { $('simChart').innerHTML = '<div class="sim-empty">No legs for ' + S.und + ' — use “Simulate basket” on the Option Chain page or load your positions</div>'; $('simStats').innerHTML = ''; return; }

        // curves
        const lo = spot * (1 - RANGE[S.und]), hi = spot * (1 + RANGE[S.und]), STEPS = 240;
        const xs = Array.from({ length: STEPS + 1 }, (_, i) => lo + (hi - lo) * i / STEPS);
        const expAt = expiryMs(ne);
        const expC = xs.map(x => value(x, expAt, legs).pnl);
        const tgtC = xs.map(x => value(x, atMs, legs).pnl);
        const be = [];
        for (let i = 1; i < xs.length; i++) if ((expC[i - 1] < 0) !== (expC[i] < 0)) be.push(xs[i - 1] + (xs[i] - xs[i - 1]) * (-expC[i - 1]) / (expC[i] - expC[i - 1]));
        const at = value(simSpot, atMs, legs), atExp = value(simSpot, expAt, legs);
        const mx = Math.max(...expC), mn = Math.min(...expC);
        // "Unlimited" only if the payoff keeps moving at the chart edge by ≥ half a unit per point
        // (ignores tiny slopes like a future hedged by a put, where the basis leaves a sliver)
        const k = 10, dx = xs[k] - xs[0];
        const sl = (expC[0] - expC[k]) / dx, sr = (expC[expC.length - 1] - expC[expC.length - 1 - k]) / dx;
        const unlimitedUp = sl > 0.5 || sr > 0.5, unlimitedDn = sl < -0.5 || sr < -0.5;
        const M = S.margin;
        const pct = v => M ? `<span class="sim-sub ${v >= 0 ? 'sim-pos' : 'sim-neg'}">${v >= 0 ? '+' : ''}${(100 * v / M).toFixed(2)}% of funds</span>` : '';
        const big = (k, v, sub = '') => `<div class="sim-stat sim-stat-big"><div class="sim-sub">${k}</div><div class="mono font-bold sim-big">${v}</div>${sub}</div>`;
        const sm = (k, v) => `<div class="sim-stat"><div class="sim-sub">${k}</div><div class="mono font-semibold">${v}</div></div>`;
        $('simStats').innerHTML =
            `<div class="sim-stats-main">` +
            big(`Estimated P&L · ${S.und} ${simSpot.toFixed(0)} · ${$('simDateTxt').textContent}`, pnlHtml(at.pnl), pct(at.pnl)) +
            big(`P&L at expiry (${ne})`, pnlHtml(atExp.pnl), pct(atExp.pnl)) +
            big('Max profit', unlimitedUp ? '<span class="sim-pos">Unlimited</span>' : pnlHtml(mx), unlimitedUp ? '' : pct(mx)) +
            big('Max loss', unlimitedDn ? '<span class="sim-neg">Unlimited</span>' : pnlHtml(mn), unlimitedDn ? '' : pct(mn)) +
            big('Funds required', M ? inr(M) : '<span class="sim-sub">checking…</span>', '<span class="sim-sub">Kite basket margin, NRML</span>') +
            `</div><div class="sim-stats-greeks">` +
            sm('Breakeven (expiry)', be.length ? be.map(b => `${b.toFixed(0)} <span class="sim-sub">(${b >= spot ? '+' : ''}${(100 * (b / spot - 1)).toFixed(1)}%)</span>`).join(', ') : '—') +
            sm('Delta', at.delta.toFixed(1)) + sm('Gamma', at.gamma.toFixed(4)) + sm('Theta / day', pnlHtml(at.theta)) + sm('Vega / 1% IV', inr(at.vega)) +
            `</div>`;
        drawChart(xs, expC, tgtC, spot, simSpot, be, legs, atMs);
    }

    function drawChart(xs, expC, tgtC, spot, simSpot, be, legs, atMs) {
        const W = 1000, H = 360, P = { l: 70, r: 16, t: 14, b: 30 };
        const all = expC.concat(tgtC);
        let yMin = Math.min(0, ...all), yMax = Math.max(0, ...all);
        const pad = (yMax - yMin) * 0.08 || 100; yMin -= pad; yMax += pad;
        const X = x => P.l + (x - xs[0]) / (xs[xs.length - 1] - xs[0]) * (W - P.l - P.r);
        const Y = y => P.t + (yMax - y) / (yMax - yMin) * (H - P.t - P.b);
        const path = c => c.map((y, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(y).toFixed(1)}`).join('');
        const area = (c, pos) => {
            const z = Y(0), pts = c.map((y, i) => `${X(xs[i]).toFixed(1)},${Y(pos ? Math.max(y, 0) : Math.min(y, 0)).toFixed(1)}`);
            return `M${X(xs[0])},${z}L${pts.join('L')}L${X(xs[xs.length - 1])},${z}Z`;
        };
        const ticksY = []; const stepY = niceStep((yMax - yMin) / 6);
        for (let v = Math.ceil(yMin / stepY) * stepY; v <= yMax; v += stepY) ticksY.push(v);
        const ticksX = []; const stepX = niceStep((xs[xs.length - 1] - xs[0]) / 8);
        for (let v = Math.ceil(xs[0] / stepX) * stepX; v <= xs[xs.length - 1]; v += stepX) ticksX.push(v);
        const sd = (() => { const l = legs.find(x => x.option_type !== 'FUT') || legs[0]; const t = yearsTo(nearestExpiry(), Date.now()); return spot * legIv(l) * Math.sqrt(t); })();
        $('simChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" onmousemove="simHover(evt)" onmouseleave="simHover(null)">
            ${[1, 2].map(k => `<rect x="${X(Math.max(xs[0], spot - k * sd))}" y="${P.t}" width="${Math.max(0, X(Math.min(xs[xs.length - 1], spot + k * sd)) - X(Math.max(xs[0], spot - k * sd)))}" height="${H - P.t - P.b}" class="sim-sd${k}"/>`).join('')}
            ${ticksY.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="sim-grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="sim-ax">${fmtK(v)}</text>`).join('')}
            ${ticksX.map(v => `<text x="${X(v)}" y="${H - 10}" text-anchor="middle" class="sim-ax">${v.toFixed(0)}</text>`).join('')}
            <path d="${area(expC, true)}" class="sim-area-pos"/><path d="${area(expC, false)}" class="sim-area-neg"/>
            <line x1="${P.l}" x2="${W - P.r}" y1="${Y(0)}" y2="${Y(0)}" class="sim-zero"/>
            <path d="${path(expC)}" class="sim-exp"/><path d="${path(tgtC)}" class="sim-tgt"/>
            ${be.map(b => `<circle cx="${X(b)}" cy="${Y(0)}" r="4" class="sim-be"/>`).join('')}
            <line x1="${X(spot)}" x2="${X(spot)}" y1="${P.t}" y2="${H - P.b}" class="sim-spot"/>
            <text x="${X(spot) + 4}" y="${P.t + 12}" class="sim-ax">spot</text>
            ${Math.abs(simSpot - spot) > 0.5 ? `<line x1="${X(simSpot)}" x2="${X(simSpot)}" y1="${P.t}" y2="${H - P.b}" class="sim-sim"/>` : ''}
            <g id="simHoverG"></g></svg>
            <div class="sim-legend"><span class="sim-k sim-k-exp"></span>At expiry <span class="sim-k sim-k-tgt"></span>At ${S.days ? 'target date' : 'today'}
                <span class="sim-k sim-k-sd"></span>±1σ / ±2σ (by IV) <span class="sim-k sim-k-be"></span>Breakeven <span class="sim-k" style="background:#fbbf24"></span>Spot <span class="sim-k" style="background:#a78bfa"></span>Target</div>`;
        S.hover = { xs, expC, tgtC, X, Y, P, W, H };
    }
    function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
    function fmtK(v) { const a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k' : a.toFixed(0)); }

    window.simHover = evt => {
        const g = $('simHoverG'); const h = S.hover; if (!g || !h) return;
        if (!evt) { g.innerHTML = ''; return; }
        const svg = evt.currentTarget, pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const frac = (p.x - h.P.l) / (h.W - h.P.l - h.P.r); if (frac < 0 || frac > 1) { g.innerHTML = ''; return; }
        const i = Math.round(frac * (h.xs.length - 1)), x = h.X(h.xs[i]);
        const bx = Math.min(x + 8, h.W - 190);
        g.innerHTML = `<line x1="${x}" x2="${x}" y1="${h.P.t}" y2="${h.H - h.P.b}" class="sim-cross"/>
            <circle cx="${x}" cy="${h.Y(h.expC[i])}" r="3.5" class="sim-dot-exp"/><circle cx="${x}" cy="${h.Y(h.tgtC[i])}" r="3.5" class="sim-dot-tgt"/>
            <rect x="${bx}" y="${h.P.t + 4}" width="180" height="58" rx="6" class="sim-tip"/>
            <text x="${bx + 10}" y="${h.P.t + 22}" class="sim-tip-t">${S.und} ${h.xs[i].toFixed(0)}</text>
            <text x="${bx + 10}" y="${h.P.t + 39}" class="sim-tip-t">Expiry: ${inr(h.expC[i])}</text>
            <text x="${bx + 10}" y="${h.P.t + 55}" class="sim-tip-t">Target: ${inr(h.tgtC[i])}</text>`;
    };

    // ── controls ─────────────────────────────────────────────────────
    window.simSetUnd = async u => { S.und = u; S.shift = 0; await refreshSpot(); refreshMargin(); render(); };
    window.simInput = () => { S.shift = +$('simShift').value; S.days = +$('simDays').value; render(); };
    const STEP = { NIFTY: 50, BANKNIFTY: 100 };
    window.simSpotStep = dir => {
        const spot = S.spots[S.und]; if (!spot) return;
        const cur = spot * (1 + S.shift / 100), st = STEP[S.und];
        const next = dir > 0 ? Math.floor(cur / st + 1e-9) * st + st : Math.ceil(cur / st - 1e-9) * st - st;
        S.shift = Math.max(-RANGE[S.und] * 100, Math.min(RANGE[S.und] * 100, 100 * (next / spot - 1))); render();
    };
    window.simTargetInput = v => { const spot = S.spots[S.und]; if (spot && +v > 0) { S.shift = 100 * (+v / spot - 1); render(); } };
    window.simDayStep = d => { S.days = Math.max(0, Math.min(S.maxDays || 0, S.days + d)); render(); };
    window.simIvStep = d => { S.ivShift = Math.max(-20, Math.min(20, S.ivShift + d)); render(); };
    window.simResetSpot = () => { S.shift = 0; render(); };
    window.simResetDate = () => { S.days = 0; render(); };
    window.simResetIv = () => { S.ivShift = 0; render(); };
    window.simToggle = id => { const l = S.legs.find(x => x.id === id); if (l) l.on = !l.on; refreshMargin(); render(); };
    window.simRemove = id => { S.legs = S.legs.filter(x => x.id !== id); refreshMargin(); render(); };
    window.simClear = () => { S.legs = []; S.margin = null; msg(''); render(); };
    window.simLots = (id, v) => { const l = S.legs.find(x => x.id === id); const k = Math.max(1, parseInt(v) || 1); if (l) l.qty = Math.sign(l.qty) * k * (l.lot_size || 1); refreshMargin(); render(); };
    window.simEntry = (id, v) => { const l = S.legs.find(x => x.id === id); if (l && isFinite(+v)) l.entry = +v; render(); };
    window.simLoadPositions = loadPositions;
    window.simLoadBasket = loadBasket;
    window.loadSimulate = async () => {
        await refreshSpot();
        if (S.fromBasket) { S.fromBasket = false; S.legs = []; await loadBasket(); }
        else if (!S.legs.length) await loadPositions(); else render();
        if (!S.timer) S.timer = setInterval(tickPrices, 3000);
    };
    // "Simulate basket" button on the Option Chain page
    window.simulateBasket = () => { S.fromBasket = true; navigateToPage('simulate'); };
    window._simTest = { bs, impliedVol, S, value };
})();

// Market depth panel for the Buy/Sell window (Kite style).
// The backend switches only this one token to the feed's full mode while the
// window is open and back to LTP mode when it closes. Read-only, places no orders.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const MD = { timer: null, cur: null, box: null };
    const uid = () => sessionStorage.getItem('user_id');
    const n2 = v => v == null || v === '' ? '—' : Number(v).toFixed(2);
    const ni = v => v == null ? '—' : Number(v).toLocaleString('en-IN');

    function ladder(rows, side) {
        const max = Math.max(1, ...rows.map(r => r.qty || 0));
        return rows.map(r => `<tr class="md-r" onclick="mdPick(${r.price})" title="Use ${n2(r.price)} as limit price">
            <td class="md-p md-${side}">${n2(r.price)}</td><td class="md-o md-${side}">${r.orders ?? ''}</td>
            <td class="md-q md-${side}"><span class="md-bar md-bar-${side}" style="width:${Math.round(100 * (r.qty || 0) / max)}%"></span><span>${r.qty ?? ''}</span></td></tr>`).join('');
    }
    function render(d) {
        if (!MD.box) return;
        const o = d.ohlc || {}, lo = o.low, hi = o.high, pc = o.close, lt = d.ltp;
        const chg = pc ? lt - pc : null;
        const pos = (v) => (hi > lo && v != null) ? Math.max(0, Math.min(100, 100 * (v - lo) / (hi - lo))) : 50;
        const pad = rows => rows.concat(Array(Math.max(0, 5 - rows.length)).fill({}));
        MD.box.innerHTML = `
        <div class="md-head"><span class="md-title">Market depth</span>
            <span class="md-ltp ${chg == null ? '' : chg >= 0 ? 'md-up' : 'md-dn'}">${n2(lt)}${chg == null ? '' : ` <small>${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${(100 * chg / pc).toFixed(2)}%)</small>`}</span>
            <span class="md-src ${d.source === 'live' ? 'md-live' : ''}">${d.source === 'live' ? '● live' : 'snapshot'}</span></div>
        <div class="md-grid">
            <table class="md-t"><thead><tr><th>Bid</th><th>Orders</th><th>Qty.</th></tr></thead><tbody>${ladder(pad(d.bids || []), 'b')}</tbody>
                <tfoot><tr><td class="md-b">Total</td><td></td><td class="md-q md-b"><b>${ni(d.total_buy)}</b></td></tr></tfoot></table>
            <table class="md-t"><thead><tr><th>Offer</th><th>Orders</th><th>Qty.</th></tr></thead><tbody>${ladder(pad(d.offers || []), 's')}</tbody>
                <tfoot><tr><td class="md-s">Total</td><td></td><td class="md-q md-s"><b>${ni(d.total_sell)}</b></td></tr></tfoot></table>
        </div>
        <div class="md-ohlc">
            <div class="md-ohlc-row"><span>Open <b>${n2(o.open)}</b></span><span>Prev. Close <b>${n2(pc)}</b></span></div>
            <div class="md-ohlc-row"><span>Low <b>${n2(lo)}</b></span><span>High <b>${n2(hi)}</b></span></div>
            <div class="md-range"><span class="md-range-fill ${chg != null && chg < 0 ? 'md-fill-dn' : 'md-fill-up'}"
                style="left:${Math.min(pos(o.open), pos(lt))}%;width:${Math.abs(pos(lt) - pos(o.open))}%"></span>
                <span class="md-tri" style="left:${pos(o.open)}%" title="Open"></span><span class="md-dot" style="left:${pos(lt)}%" title="LTP"></span></div>
        </div>
        <div class="md-stats">
            <span>Volume</span><b>${ni(d.volume)}</b><span>Avg. price</span><b>${n2(d.avg_price)}</b>
            <span>Lower circuit</span><b>${n2(d.lower_circuit)}</b><span>Upper circuit</span><b>${n2(d.upper_circuit)}</b>
            <span>LTQ</span><b>${ni(d.ltq)}</b><span>LTT</span><b>${d.ltt ? String(d.ltt).replace('T', ' ').slice(11, 19) || d.ltt : '—'}</b>
            <span>OI</span><b>${ni(d.oi)}</b><span></span><b></b>
        </div>`;
    }
    async function poll() {
        if (!MD.cur || document.hidden) return;
        try {
            const r = await fetch(`${API}/api/trading/depth`, { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify(MD.cur) });
            const j = await r.json();
            if (j.success) render(j); else if (MD.box && !MD.box.innerHTML) MD.box.innerHTML = `<div class="md-empty">Depth unavailable: ${j.error || ''}</div>`;
        } catch (e) { /* keep last */ }
    }
    window.MarketDepth = {
        start(boxId, inst) {
            this.stop();
            MD.box = document.getElementById(boxId);
            if (!MD.box || !inst.token) return;
            MD.box.innerHTML = '<div class="md-empty">Loading market depth…</div>';
            MD.cur = { token: inst.token, exchange: inst.exchange || 'NFO', symbol: inst.symbol, index: inst.index ?? 0 };
            poll(); MD.timer = setInterval(poll, 1000);
        },
        stop() {
            clearInterval(MD.timer); MD.timer = null;
            if (MD.cur) {
                fetch(`${API}/api/trading/depth-release`, { method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-ID': uid() }, body: JSON.stringify({ token: MD.cur.token }) }).catch(() => {});
            }
            MD.cur = null; MD.box = null;
        },
    };
    // Click a bid/offer price → LIMIT order at that price
    window.mdPick = price => {
        if (!MD.cur || price == null) return;
        const i = MD.cur.index, ot = document.getElementById(`orderType_${i}`), lp = document.getElementById(`limitPrice_${i}`);
        if (ot) { ot.value = 'LIMIT'; if (window.onOrderTypeChange) window.onOrderTypeChange(i); }
        if (lp) { lp.value = Number(price).toFixed(2); lp.focus(); }
    };
})();

// History page — trades, round trips, SL events and daily summary rebuilt from the
// server's audit trail. Read-only.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const esc = s => String(s ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const H = { data: null, tab: 'days' };
    const $ = id => document.getElementById(id);
    const inr = v => v == null ? '—' : (v < 0 ? '-₹' : '₹') + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const pnl = v => v == null ? '<span class="text-gray-500">—</span>' :
        `<span class="${v >= 0 ? 'text-green-600' : 'text-red-600'} font-semibold">${v >= 0 ? '+' : ''}${inr(v)}</span>`;
    const t = s => s ? s.slice(11, 19) : '—';
    const d = s => s ? s.slice(0, 10) : '—';

    const COLS = {
        days: [['date', 'Date'], ['gross_pnl', 'Gross P&L', pnl], ['round_trips', 'Trips'], ['wins', 'Wins'], ['losses', 'Losses'],
               ['win_rate', 'Win %'], ['trades', 'Fills'], ['orders', 'Orders'], ['rejected', 'Rejected'], ['sl_placed', 'SL placed'],
               ['sl_hit', 'SL hit'], ['exit_all_runs', 'Exit All'], ['basket_deploys', 'Baskets'], ['exit_only', 'Exit-only'],
               ['restarts_in_market', 'Restarts 9:15–3:30'], ['feed_errors', 'Feed errors']],
        round_trips: [['date', 'Date'], ['symbol', 'Symbol'], ['direction', 'Side'], ['qty', 'Qty'], ['entry_ts', 'Entry', t],
               ['entry_price', 'Entry ₹'], ['exit_ts', 'Exit', t], ['exit_price', 'Exit ₹'], ['exit_reason', 'Reason'],
               ['hold', 'Held'], ['gross_pnl', 'P&L', pnl], ['status', 'Status']],
        trades: [['ts', 'Date', d], ['ts', 'Time', t], ['symbol', 'Symbol'], ['side', 'Side'], ['qty', 'Qty'], ['avg_price', 'Avg ₹'],
               ['value', 'Value', inr], ['order_type', 'Type'], ['reason', 'Exit reason'], ['status', 'Status'], ['order_id', 'Order']],
        sl_events: [['ts', 'Date', d], ['ts', 'Time', t], ['action', 'Action'], ['symbol', 'Symbol'], ['trigger_old', 'Old trg'],
               ['trigger_new', 'Trigger'], ['ltp', 'LTP'], ['pnl_pts', 'P&L pts'], ['order_id', 'Order']],
        guards: [['ts', 'Date', d], ['ts', 'Time', t], ['event', 'Event'], ['msg', 'Detail']],
        open_lots: [['symbol', 'Symbol'], ['qty', 'Qty'], ['price', 'Price'], ['since', 'Since']],
    };
    const TABS = [['days', 'Daily summary'], ['round_trips', 'Round trips'], ['sl_events', 'Stop losses']];

    function table(key) {
        const rows = (H.data && H.data[key]) || [];
        if (!rows.length) return '<div class="text-xs text-gray-500 py-4 text-center">Nothing in this range</div>';
        const cols = COLS[key];
        const ordered = [...rows].reverse();   // newest first
        return `<div class="overflow-auto" style="max-height:60vh"><table class="hist-table"><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>` +
            ordered.map(r => `<tr>${cols.map(([k, , fmt]) => `<td>${fmt ? fmt(r[k]) : esc(r[k])}</td>`).join('')}</tr>`).join('') +
            '</tbody></table></div>';
    }

    function render() {
        if (!H.data) return;
        const days = H.data.days || [];
        const T = H.data.totals || {};
        $('histStats').innerHTML = [
            ['Gross P&L', pnl(T.gross), ''],
            ['Net P&L (est.)', pnl(T.net), `after brokerage ${inr(T.brokerage)} (${T.orders || 0} orders) + STT ${inr(T.stt)}`]
        ].map(([k, v, sub]) => `<div class="hist-stat"><div class="text-xs text-gray-500">${k}</div><div class="text-sm font-bold mono">${v}</div>`
            + (sub ? `<div class="text-xs text-gray-500 mt-0.5">${sub}</div>` : '') + '</div>').join('');
        $('histTabs').innerHTML = TABS.map(([k, n]) =>
            `<button class="hist-tab${H.tab === k ? ' active' : ''}" onclick="histTab('${k}')">${n} <span class="text-gray-500">${(H.data[k] || []).length}</span></button>`).join('');
        $('histBody').innerHTML = table(H.tab);
        const exo = days.reduce((a, x) => a + (x.exit_only || 0), 0);
        $('histNote').textContent = `Gross = round trips closed on this day. Net is an estimate (₹20/order, STT 0.15% of sell premium); stamp duty, exchange and GST are ignored.` +
            (exo ? ` ${exo} exit(s) had no entry in the logs (position opened before logging began) and aren't in P&L.` : '');
    }

    async function load() {
        const uid = sessionStorage.getItem('user_id');
        if (!uid) return;
        $('histStatus').textContent = 'Loading…';
        const q = new URLSearchParams();
        if (!$('histDate').value) $('histDate').value = today();
        q.set('date', $('histDate').value);
        try {
            const r = await fetch(`${API}/api/history?${q}`, { headers: { 'X-User-ID': uid } });
            const j = await r.json();
            if (!j.success) throw new Error(j.error || r.status);
            H.data = j;
            $('histStatus').textContent = '';
            render();
        } catch (e) {
            $('histStatus').textContent = 'Could not load history: ' + e.message;
        }
    }

    function csv() {
        const key = H.tab, rows = (H.data && H.data[key]) || [];
        if (!rows.length) return;
        const keys = Object.keys(rows.reduce((a, r) => Object.assign(a, r), {}));
        const esc = v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
        const text = [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
        a.download = `bvr_${key}_${$('histDate').value}.csv`;
        a.click();
    }

    const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    function shift(n) {
        const x = new Date(($('histDate').value || today()) + 'T12:00:00Z');
        x.setUTCDate(x.getUTCDate() + n);
        $('histDate').value = x.toISOString().slice(0, 10);
        load();
    }

    window.histTab = k => { H.tab = k; render(); };
    window.loadHistory = () => load();
    window.histShift = shift;
    window.histToday = () => { $('histDate').value = today(); load(); };
    window.histLoad = load;
    window.histCsv = csv;
})();

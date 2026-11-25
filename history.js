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
    const TABS = [['days', 'Daily summary'], ['round_trips', 'Round trips'], ['trades', 'Fills'],
                  ['sl_events', 'Stop losses'], ['guards', 'Guards'], ['open_lots', 'Unmatched lots']];

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
        const trips = (H.data.round_trips || []).filter(x => x.gross_pnl != null);
        const tot = trips.reduce((a, x) => a + x.gross_pnl, 0);
        const wins = trips.filter(x => x.gross_pnl > 0).length;
        const best = trips.reduce((a, x) => (a == null || x.gross_pnl > a ? x.gross_pnl : a), null);
        const worst = trips.reduce((a, x) => (a == null || x.gross_pnl < a ? x.gross_pnl : a), null);
        $('histStats').innerHTML = [
            ['Gross P&L', pnl(tot)], ['Trading days', days.filter(x => x.trades).length],
            ['Round trips', trips.length], ['Win rate', trips.length ? (100 * wins / trips.length).toFixed(1) + '%' : '—'],
            ['Best trip', pnl(best)], ['Worst trip', pnl(worst)]
        ].map(([k, v]) => `<div class="hist-stat"><div class="text-xs text-gray-500">${k}</div><div class="text-sm font-bold mono">${v}</div></div>`).join('');
        $('histTabs').innerHTML = TABS.map(([k, n]) =>
            `<button class="hist-tab${H.tab === k ? ' active' : ''}" onclick="histTab('${k}')">${n} <span class="text-gray-500">${(H.data[k] || []).length}</span></button>`).join('');
        $('histBody').innerHTML = table(H.tab);
        const exo = days.reduce((a, x) => a + (x.exit_only || 0), 0);
        $('histNote').textContent = `Gross, before charges. Built from ${H.data.files} audit file(s).` +
            (exo ? ` ${exo} exit(s) had no entry in the logs (position opened before logging began) and aren't in P&L.` : '');
    }

    async function load() {
        const uid = sessionStorage.getItem('user_id');
        if (!uid) return;
        $('histStatus').textContent = 'Loading…';
        const q = new URLSearchParams();
        if ($('histFrom').value) q.set('from', $('histFrom').value);
        if ($('histTo').value) q.set('to', $('histTo').value);
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
        a.download = `bvr_${key}_${$('histFrom').value || 'all'}_${$('histTo').value || 'all'}.csv`;
        a.click();
    }

    function preset(days) {
        const to = new Date(Date.now() + 330 * 60000);
        const from = new Date(to - (days - 1) * 86400000);
        $('histFrom').value = days ? from.toISOString().slice(0, 10) : '';
        $('histTo').value = days ? to.toISOString().slice(0, 10) : '';
        load();
    }

    window.histTab = k => { H.tab = k; render(); };
    window.loadHistory = () => { if (!H.data) preset(30); else load(); };
    window.histPreset = preset;
    window.histLoad = load;
    window.histCsv = csv;
})();

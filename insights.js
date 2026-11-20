// Insights page — key events + India VIX (hourly) and price action (every 30 min / on demand)
const INSIGHTS_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5050' : 'https://bvrfunds.top'
};
const insightsState = { timer: null, tab: 'today', last: null };

const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _num = v => (v === null || v === undefined || v === '') ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const _uid = () => sessionStorage.getItem('user_id');
// Exact date + time, plus how long ago — clear even after a weekend
const _ago = iso => {
    if (!iso) return 'never';
    const t = new Date(iso);
    const m = Math.round((Date.now() - t.getTime()) / 60000);
    const rel = m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} day${m >= 2880 ? 's' : ''} ago`;
    const when = t.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${when} (${rel})`;
};
const _chg = b => {
    if (!b || b.change === undefined) return '';
    const up = b.change >= 0;
    return `<span class="${up ? 'text-green-500' : 'text-red-500'}">${up ? '▲' : '▼'} ${_num(Math.abs(b.change))} (${up ? '+' : ''}${_num(b.change_pct)}%)</span>`;
};
const _badge = (txt, kind) => {
    const map = {
        high: 'bg-red-900/60 text-red-300 border-red-700', medium: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
        low: 'bg-slate-700/60 text-slate-300 border-slate-600', bullish: 'bg-green-900/50 text-green-300 border-green-700',
        bearish: 'bg-red-900/50 text-red-300 border-red-700', range: 'bg-blue-900/40 text-blue-300 border-blue-700',
        elevated: 'bg-yellow-900/40 text-yellow-300 border-yellow-700', normal: 'bg-slate-700/60 text-slate-300 border-slate-600'
    };
    return `<span class="ins-badge ${map[(kind || txt || '').toLowerCase()] || map.low}">${_esc(txt)}</span>`;
};

async function insightsFetch(path, opts = {}) {
    const r = await fetch(`${INSIGHTS_CONFIG.backendUrl}/api/insights${path}`, {
        ...opts, headers: { 'Content-Type': 'application/json', 'X-User-ID': _uid(), ...(opts.headers || {}) }
    });
    if (r.status === 401) throw new Error('Session expired — please login again');
    return r.json();
}

function _insightsVisible() {
    const pg = document.getElementById('insightsPage');
    return pg && !pg.classList.contains('hidden') && !document.hidden;
}

async function loadInsights() {
    if (!_uid()) return;
    try {
        const s = await insightsFetch('/state');
        if (!s.success) throw new Error(s.error || 'Failed');
        insightsState.last = s;
        renderInsights(s);
        _scheduleInsightsPoll(s.events.running || s.price.running ? 4000 : 60000);
    } catch (e) {
        document.getElementById('insStatus').innerHTML = `<span class="text-red-400">❌ ${_esc(e.message)}</span>`;
        _scheduleInsightsPoll(60000);
    }
}

function _scheduleInsightsPoll(ms) {
    clearTimeout(insightsState.timer);
    insightsState.timer = setTimeout(() => { if (_insightsVisible()) loadInsights(); else _scheduleInsightsPoll(5000); }, ms);
}

function renderInsights(s) {
    document.getElementById('insStatus').innerHTML = s.claude_enabled
        ? `Claude <b>${_esc(s.model)}</b> · ${s.calls_today}/${s.call_cap} calls today · ` + (s.schedule.auto
            ? `auto: market every ${s.schedule.price_every_min} min, events every ${s.schedule.events_every_min} min`
            : `manual refresh — results stay until you refresh`)
        : `<span class="text-yellow-400">⚠️ Claude is off — add <code>ANTHROPIC_API_KEY</code> to the server <code>.env</code> and restart. Market data still loads once Claude is on.</span>`;
    renderPrice(s.price || {});
    renderEvents(s.events || {});
}

// ── 1. Market today: India VIX · NIFTY · BANKNIFTY (day level) ───────────
function renderPrice(pr) {
    const d = pr.data || {};
    const snap = pr.snapshot || {};
    document.getElementById('insPriceMeta').innerHTML = pr.running
        ? '<span class="ins-spin"></span> Claude is reading the day…'
        : `Updated ${_ago(pr.updated)}` + (pr.error ? ` · <span class="text-red-400">❌ ${_esc(pr.error)}</span>` : '');

    const card = (key, title) => {
        const s = snap[key] || {};
        const a = d[key] || {};
        const day = s.day || {};
        const pd = s.prev_day || {};
        const span = (lbl, b) => b ? `<div><span class="ins-label">${lbl}</span><b>${_chg(b) || '—'}</b></div>
                                      <div><span class="ins-label">${lbl} H / L</span><b>${_num(b.high)} / ${_num(b.low)}</b></div>` : '';
        const lv = (arr, cls) => (arr || []).map(v => `<span class="ins-chip ${cls}">${_num(v)}</span>`).join('');
        const vol = a.volatility ? _badge(a.volatility, { calm: 'low', normal: 'normal', elevated: 'elevated', volatile: 'medium', high: 'high', 'very volatile': 'high' }[a.volatility.toLowerCase()]) : '';
        return `<div class="ins-card">
            <div class="flex items-center justify-between gap-2">
                <div class="font-bold text-sm">${title} ${vol} ${a.bias ? _badge(a.bias) : ''}</div>
                <div class="ins-big">${_num(s.last)} <span class="text-xs">${_chg(day)}</span></div>
            </div>
            <div class="ins-grid mt-1">
                <div><span class="ins-label">Open</span><b>${_num(day.open)}</b></div>
                <div><span class="ins-label">High / Low</span><b>${_num(day.high)} / ${_num(day.low)}</b></div>
                <div><span class="ins-label">Day range</span><b>${_num(day.range)}${day.range_pct != null ? ` (${_num(day.range_pct)}%)` : ''}</b></div>
                <div><span class="ins-label">vs 14-day avg</span><b>${day.range_vs_atr != null ? _num(day.range_vs_atr) + '×' : '—'}</b></div>
                <div><span class="ins-label">Prev H / L / C</span><b>${_num(pd.high)} / ${_num(pd.low)} / ${_num(pd.close)}</b></div>
                <div><span class="ins-label">Gap</span><b>${_num(day.gap)}</b></div>
                ${span('Week', s.week)}
                ${span('Month', s.month)}
            </div>
            ${a.summary ? `<div class="ins-insight mt-2"><div class="ins-insight-h">✦ Claude's read</div>${_esc(a.summary)}</div>` : ''}
            ${(a.support || a.resistance) ? `<div class="mt-1 text-xs"><span class="ins-label">Support</span>${lv(a.support, 'text-green-400') || '—'}
                <span class="ins-label ml-2">Resistance</span>${lv(a.resistance, 'text-red-400') || '—'}</div>` : ''}
        </div>`;
    };
    // India VIX: one slim banner — today / week / month change (+ Claude's read on demand)
    const v = snap.vix || {};
    const va = d.vix || {};
    const vbit = (lbl, b) => `<div class="ins-vix-bit"><span class="ins-label">${lbl}</span>${b ? _chg(b) : '—'}</div>`;
    const vvol = va.volatility ? _badge(va.volatility, { calm: 'low', normal: 'normal', elevated: 'elevated', high: 'high' }[va.volatility.toLowerCase()]) : '';
    document.getElementById('insVixBanner').innerHTML = v.last !== undefined ? `
        <div class="ins-vix">
            <div class="ins-vix-main"><span class="font-bold">India VIX</span> <span class="ins-big">${_num(v.last)}</span> ${vvol}</div>
            ${vbit('Today', v.day)}${vbit('Week', v.week)}${vbit('Month', v.month)}
        </div>
        ${va.summary ? `<details class="ins-vix-read"><summary>✦ Claude's read on VIX</summary><div>${_esc(va.summary)}</div></details>` : ''}` : '';

    document.getElementById('insIndices').innerHTML = card('nifty', 'NIFTY') + card('banknifty', 'BANKNIFTY');

    let g = '';
    if (d.guidance) g += `<div class="ins-guidance"><div class="ins-insight-h">🧭 Guidance</div><div>${_esc(d.guidance)}</div>
        ${d.risk ? `<div class="ins-risk">⚠️ ${_esc(d.risk)}</div>` : ''}</div>`;
    if (pr.raw && !pr.data) g += `<div class="ins-card"><div class="ins-label">Claude's reply</div><div class="ins-text" style="white-space:pre-wrap">${_esc(pr.raw)}</div></div>`;
    document.getElementById('insGuidance').innerHTML = g;

    const h = (pr.history || []).slice(1);
    document.getElementById('insHistory').innerHTML = h.length
        ? `<details><summary class="ins-label cursor-pointer">Earlier reads today (${h.length})</summary>${h.map(x =>
            `<div class="ins-row"><div class="ins-when">${_esc(new Date(x.updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))}</div>
             <div class="ins-text flex-1">${_esc(x.guidance)}</div></div>`).join('')}</details>` : '';
}

// ── 2. Key events + RBI / Fed ─────────────────────────────────────────────
function renderEvents(ev) {
    const d = ev.data || {};
    document.getElementById('insEventsMeta').innerHTML = ev.running
        ? '<span class="ins-spin"></span> Claude is searching the web…'
        : `Updated ${_ago(ev.updated)}` + (ev.error ? ` · <span class="text-red-400">❌ ${_esc(ev.error)}</span>` : '');

    const meet = (label, m) => `<div class="ins-card">
        <div class="ins-label">${label}</div>
        <div class="ins-big">${_esc((m || {}).date || '—')}</div>
        ${(m || {}).note ? `<div class="ins-text">${_esc(m.note)}</div>` : ''}</div>`;
    document.getElementById('insMeetings').innerHTML = meet('Next RBI MPC', d.next_rbi) + meet('Next US Fed FOMC', d.next_fed);

    const list = ((d.events || {})[insightsState.tab]) || [];
    document.querySelectorAll('.ins-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === insightsState.tab));
    document.getElementById('insEventList').innerHTML = list.length ? list.map(e => `
        <div class="ins-row">
            <div class="ins-when">${_esc(e.date || '')}<br><span>${_esc(e.time_ist || '')}</span></div>
            <div class="flex-1">
                <div class="font-semibold text-sm">${_esc(e.event)} ${_badge(e.impact || 'low')}</div>
                ${e.why ? `<div class="ins-sub">${_esc(e.why)}</div>` : ''}
            </div>
        </div>`).join('') : `<div class="ins-sub py-3 text-center">${ev.data ? 'No major events found for this period' : 'Not loaded yet — press Refresh'}</div>`;

    let t = d.takeaway ? `<div class="ins-guidance"><div class="ins-insight-h">🧭 Takeaway</div><div>${_esc(d.takeaway)}</div></div>` : '';
    if (ev.raw && !ev.data) t = `<div class="ins-label">Claude's reply (could not be read as a list)</div><div class="ins-text" style="white-space:pre-wrap">${_esc(ev.raw)}</div>`;
    document.getElementById('insTakeaway').innerHTML = t;
}

// ── actions ───────────────────────────────────────────────────────────────
async function insightsRefreshEvents() {
    const r = await insightsFetch('/events/run', { method: 'POST' }).catch(e => ({ success: false, error: e.message }));
    if (!r.success || r.message) alert(r.error || r.message);
    loadInsights();
}

async function insightsAnalyse() {
    const r = await insightsFetch('/price/run', { method: 'POST', body: '{}' }).catch(e => ({ success: false, error: e.message }));
    if (!r.success || r.message) alert(r.error || r.message);
    loadInsights();
}

function insightsTab(tab) {
    insightsState.tab = tab;
    if (insightsState.last) renderEvents(insightsState.last.events || {});
}

window.loadInsights = loadInsights;
window.insightsRefreshEvents = insightsRefreshEvents;
window.insightsAnalyse = insightsAnalyse;
window.insightsTab = insightsTab;

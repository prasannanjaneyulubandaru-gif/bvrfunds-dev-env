// Header index ticker (NIFTY 50 / NIFTY BANK) with day change, green/red like Kite.
// Also adds the change to the spot chip on the Option Chain page. Read-only.
(function () {
    const API = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:5050' : 'https://bvrfunds.top';
    const LABEL = { NIFTY: 'NIFTY 50', BANKNIFTY: 'NIFTY BANK' };
    window.IDX = window.IDX || {};
    const f2 = v => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function piece(name, d, short) {
        if (!d || d.ltp == null) return '';
        const up = (d.change || 0) >= 0, cls = d.change == null ? '' : up ? 'idx-up' : 'idx-dn';
        const chg = d.change == null ? '' : `<span class="idx-chg ${cls}">${up ? '+' : ''}${f2(d.change)} (${up ? '+' : ''}${d.change_pct.toFixed(2)}%)</span>`;
        return `<span class="idx-item"><span class="idx-name">${short ? name : LABEL[name]}</span> <span class="idx-ltp ${cls}">${f2(d.ltp)}</span> ${chg}</span>`;
    }
    function paint() {
        const el = document.getElementById('idxTicker');
        const chip = document.getElementById('tp-spot-price');
        const inst = (typeof TradingState !== 'undefined') && TradingState.instrument;
        if (chip && inst && IDX[inst]) chip.innerHTML = piece(inst, IDX[inst], true);
    }
    async function tick() {
        const uid = sessionStorage.getItem('user_id');
        if (!uid || document.hidden) return;
        try {
            const r = await fetch(`${API}/api/trading/index-ticker`, { headers: { 'X-User-ID': uid } });
            const j = await r.json();
            if (j.success) { Object.assign(IDX, j.indices); paint(); }
        } catch (e) { /* keep last */ }
    }
    window.paintIndexTicker = paint;
    setInterval(tick, 2000);
    document.addEventListener('DOMContentLoaded', () => setTimeout(tick, 800));

    // Collapsible sidebar (desktop) — more room for the pages
    window.toggleSidebar = () => {
        const on = !document.body.classList.contains('sb-collapsed');
        document.body.classList.toggle('sb-collapsed', on);
        try { localStorage.setItem('bvr_sb_collapsed', on ? '1' : ''); } catch (e) { /* private mode */ }
        window.dispatchEvent(new Event('resize'));
    };
    try { localStorage.removeItem('bvr_sb_collapsed'); } catch (e) { /* sidebar toggle removed */ }
})();

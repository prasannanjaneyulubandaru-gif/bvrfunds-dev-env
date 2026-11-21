// MTM Lock — "Lock profit" / "Book loss" for the whole open-positions basket.
// The server watches MTM every second and runs Exit All if MTM falls to the exit level.
const LOCK_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5050' : 'https://bvrfunds.top'
};
const lockState = { timer: null, last: null };
const _lk$ = n => `${n < 0 ? '-' : ''}₹${Math.abs(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const _lkEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function lockFetch(path, body) {
    const r = await fetch(`${LOCK_CONFIG.backendUrl}/api/lock${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': sessionStorage.getItem('user_id') },
        body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401) return { success: false, error: 'Session expired' };
    return r.json();
}

async function lockStart(mode) {
    const pctEl = document.getElementById('lockPct');
    const pct = parseFloat(pctEl && pctEl.value);
    if (!(pct >= 0.5 && pct <= 90)) { alert('Enter a % between 0.5 and 90'); return; }
    const mtmTxt = (document.getElementById('posTotalPnl') || {}).textContent || '';
    const what = mode === 'profit'
        ? `🔒 LOCK PROFIT at ${pct}%\n\nThe server will track the highest MTM of your open positions (now ${mtmTxt}).\nIf MTM falls ${pct}% below that peak, it runs EXIT ALL:\ncancel every open order and exit every position at market.`
        : `🛑 BOOK LOSS at ${pct}%\n\nCurrent MTM of open positions: ${mtmTxt}.\nIf the loss grows ${pct}% beyond it (the level tightens if the loss shrinks), it runs EXIT ALL:\ncancel every open order and exit every position at market.`;
    if (!confirm(what + '\n\nWorks only 09:15–15:30 and only for today. Continue?')) return;
    const r = await lockFetch('/start', { mode, pct }).catch(e => ({ success: false, error: e.message }));
    if (!r.success) alert(r.error || 'Could not start lock');
    lockPoll();
}

async function lockCancel() {
    if (!confirm('Cancel the lock? Positions stay open and nothing is exited.')) return;
    await lockFetch('/cancel', {}).catch(() => {});
    lockPoll();
}

async function autoStart() {
    if (!confirm('⏰ AUTO EXIT at 15:29 today\n\nAt 15:29 the server will run EXIT ALL — cancel every open order and exit every position at market — even if you are away.\nOnly for today; you must click it again on another day.\n\nContinue?')) return;
    const r = await lockFetch('/auto/start', {}).catch(e => ({ success: false, error: e.message }));
    if (!r.success) alert(r.error || 'Could not arm Auto exit');
    lockPoll();
}

async function autoCancel() {
    if (!confirm('Cancel Auto exit at 15:29? Positions will not be exited automatically.')) return;
    await lockFetch('/auto/cancel', {}).catch(() => {});
    lockPoll();
}

async function lockDismiss() {
    document.getElementById('lockToast').style.display = 'none';
    await lockFetch('/dismiss', {}).catch(() => {});
}

function renderLock(lk, marketOpen, au) {
    // 1) Manage page strip
    const strip = document.getElementById('lockStrip');
    if (strip) {
        if (lk && lk.status === 'armed') {
            const profit = lk.mode === 'profit';
            const gap = (lk.mtm ?? 0) - lk.level;
            strip.innerHTML = `
              <div class="lock-strip ${profit ? 'lock-profit' : 'lock-loss'}">
                <div class="font-bold">${profit ? '🔒 Lock profit' : '🛑 Book loss'} · ${lk.pct}%</div>
                <div>Watching MTM <b>${_lk$(lk.mtm)}</b></div>
                <div>${profit ? 'Highest MTM' : 'Best MTM'} <b>${_lk$(lk.best)}</b></div>
                <div>Exits at <b class="${profit ? 'text-yellow-300' : 'text-red-300'}">${_lk$(lk.level)}</b></div>
                <div class="text-xs text-gray-400">${_lk$(gap)} away · ${_lkEsc(lk.source || '')}</div>
                ${lk.note ? `<div class="text-xs text-yellow-400">${_lkEsc(lk.note)}</div>` : ''}
                <button type="button" onclick="lockCancel()" class="lock-cancel">✕ Stop</button>
              </div>`;
        } else {
            strip.innerHTML = '';
        }
        if (au && au.status === 'armed') {
            strip.innerHTML += `
              <div class="lock-strip lock-auto">
                <div class="font-bold">⏰ Auto exit armed</div>
                <div>Exit All at <b class="text-yellow-300">15:29</b> today</div>
                <button type="button" onclick="autoCancel()" class="lock-cancel">✕ Stop</button>
              </div>`;
        }
        const lockOn = !!(lk && lk.status === 'armed');
        document.querySelectorAll('.lock-arm-profit, .lock-arm-loss').forEach(b => b.disabled = lockOn);
        document.querySelectorAll('.lock-arm-auto').forEach(b => b.disabled = !!(au && au.status === 'armed'));
    }
    // 2) Global notification with ✕ (any page)
    const toast = document.getElementById('lockToast');
    if (toast) {
        const note = (au && au.notify && au.message) ? au : lk;   // auto-exit news first
        if (note && note.notify && note.message) {
            const lk = note;
            const bad = ['error', 'missed'].includes(lk.status) || (lk.result && lk.result.failed);
            toast.className = 'lock-toast ' + (bad ? 'lock-toast-bad' : 'lock-toast-ok');
            toast.innerHTML = `<div>${bad ? '⚠️' : '🔔'} ${_lkEsc(lk.message)}${(lk.result && lk.result.failures && lk.result.failures.length)
                ? '<br><span class="text-xs">' + lk.result.failures.map(f => _lkEsc(`${f.tradingsymbol}: ${f.error}`)).join(' | ') + '</span>' : ''}</div>
                <button type="button" onclick="lockDismiss()" title="Close" class="lock-x">✕</button>`;
            toast.style.display = 'flex';
        } else {
            toast.style.display = 'none';
        }
    }
}

async function lockPoll() {
    clearTimeout(lockState.timer);
    let next = 5000;
    try {
        if (sessionStorage.getItem('user_id') && !document.hidden) {
            const r = await lockFetch('/status');
            if (r && r.success) {
                lockState.last = r.lock;
                renderLock(r.lock, r.market_open, r.auto);
                if ((r.lock && r.lock.status === 'armed') || (r.auto && r.auto.status === 'armed')) next = 1000;
            }
        }
    } catch (e) { /* network blip — try again */ }
    lockState.timer = setTimeout(lockPoll, next);
}

document.addEventListener('DOMContentLoaded', () => setTimeout(lockPoll, 1500));
window.lockStart = lockStart;
window.lockCancel = lockCancel;
window.lockDismiss = lockDismiss;
window.autoStart = autoStart;
window.autoCancel = autoCancel;
window.lockPoll = lockPoll;

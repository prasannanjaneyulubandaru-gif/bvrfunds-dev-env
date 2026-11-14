// Server controls on the login page: status, logs, restart, clear logs.
// Every call sends the admin PIN; the backend checks it against ADMIN_PIN in .env.
(function () {
    const base = () => (typeof CONFIG !== 'undefined' ? CONFIG.backendUrl : '');
    const $ = id => document.getElementById(id);

    function show(text, kind) {
        const out = $('scOutput');
        $('serverControls').classList.remove('sc-wide');
        out.classList.remove('hidden');
        out.style.color = kind === 'error' ? 'var(--loss)' : kind === 'ok' ? 'var(--profit)' : 'var(--text-primary)';
        out.textContent = text;
    }


    // Turn raw journalctl lines into "HH:MM:SS  message" (IST), dropping
    // host/process prefixes and gunicorn's duplicate timestamp.
    function formatLogs(raw) {
        const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const out = [];
        for (const line of raw.split('\n')) {
            if (!line.trim() || line.startsWith('-- ')) continue;
            const m = line.match(/^(\d{4}-\d\d-\d\dT[\d:]+[+-]\d\d:?\d\d)\s+\S+\s+([^\[:]+)(?:\[\d+\])?:\s?(.*)$/);
            if (!m) { out.push(esc(line)); continue; }
            const [, ts, proc, msgRaw] = m;
            let time = ts.slice(11, 19);
            const d = new Date(ts);
            if (!isNaN(d)) time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
            let msg = msgRaw.replace(/^\[[\d\- :+]+\]\s*\[\d+\]\s*/, '');   // gunicorn prefix
            let cls = '';
            if (proc === 'sudo') {
                if (!/COMMAND=/.test(msg)) continue;                          // skip pam open/close noise
                if (/journalctl -u /.test(msg)) continue;                     // skip our own 'View logs' calls
                msg = 'admin: ' + msg.replace(/^.*COMMAND=/, '');
                cls = 'sc-sys';
            } else if (/\[(ERROR|CRITICAL)\]|Traceback|Error|✗/.test(msg)) cls = 'sc-err';
            else if (/\[WARNING\]|Warning|⚠/.test(msg)) cls = 'sc-warn';
            msg = msg.replace(/^\[INFO\]\s*/, '');
            out.push(`<span class="sc-time">${time}</span>  ` + (cls ? `<span class="${cls}">${esc(msg)}</span>` : esc(msg)));
        }
        return out.length ? out.join('\n') : '(no log lines)';
    }

    function setBusy(busy) {
        document.querySelectorAll('#serverControls button[data-sc]').forEach(b => { b.disabled = busy; b.style.opacity = busy ? 0.5 : 1; });
    }

    async function call(action, body) {
        const pin = $('scPin').value.trim();
        if (!pin) { show('Enter your admin PIN first.', 'error'); $('scPin').focus(); return null; }
        setBusy(true);
        show('Working…');
        try {
            const res = await fetch(`${base()}/api/admin/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
                body: JSON.stringify(body || {})
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
                show(data.error || data.message || data.logs || `Request failed (${res.status})`, 'error');
                return null;
            }
            return data;
        } catch (e) {
            show('Could not reach the server: ' + e.message, 'error');
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function waitForBackend() {
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1500));
            try {
                const r = await fetch(`${base()}/health`, { cache: 'no-store' });
                if (r.ok) { show(`✓ App restarted and responding (${(i + 1) * 1.5}s).`, 'ok'); return; }
            } catch (_) { /* still restarting */ }
        }
        show('Restart requested, but the app has not answered after 30s. Tap Status or Logs.', 'error');
    }

    const actions = {
        async status() {
            const d = await call('status');
            if (!d) return;
            const s = d.status, ok = s.service === 'active';
            show([
                `App:         ${ok ? '● running' : '○ ' + s.service}`,
                s.service_since ? `App since:   ${s.service_since}` : null,
                s.server_uptime ? `Server up:   ${s.server_uptime}` : null,
                s.memory ? `Memory:      ${s.memory}` : null,
                s.load ? `Load:        ${s.load}` : null,
                `Disk:        ${s.disk}`
            ].filter(Boolean).join('\n'), ok ? 'ok' : 'error');
        },
        async logs() {
            const d = await call('logs', { lines: 60 });
            if (!d) return;
            show('');
            const o = $('scOutput');
            o.style.color = 'var(--text-primary)';
            o.innerHTML = formatLogs(d.logs || '');
            $('serverControls').classList.add('sc-wide');
            o.scrollTop = o.scrollHeight;
        },
        async restart() {
            if (!confirm('Restart the BVR Funds app now? Open pages will reconnect in a few seconds.')) return;
            const d = await call('restart');
            if (d) { show(d.message + '\nWaiting for it to come back…'); waitForBackend(); }
        },
        async clearLogs() {
            if (!confirm('Delete all server logs? This cannot be undone.')) return;
            const d = await call('clear-logs');
            if (d) show('✓ ' + d.message, 'ok');
        }
    };

    window.addEventListener('DOMContentLoaded', () => {
        const panel = $('serverControls');
        if (!panel) return;
        panel.querySelectorAll('button[data-sc]').forEach(btn =>
            btn.addEventListener('click', () => actions[btn.dataset.sc]()));
        $('scPin').addEventListener('keydown', e => { if (e.key === 'Enter') actions.status(); });
        $('scClose').addEventListener('click', e => {
            e.preventDefault();               // don't let the summary toggle twice
            e.stopPropagation();
            panel.open = false;
            panel.classList.remove('sc-wide');
        });
    });
})();

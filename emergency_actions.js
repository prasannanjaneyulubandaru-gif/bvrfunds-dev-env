// Emergency Actions Module - emergency_actions.js

const EMERGENCY_CONFIG = {
    backendUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://bvrfunds.top'
};

// ===========================================
// IN-APP CONFIRM MODAL
// ===========================================

/**
 * Show an in-app confirmation modal instead of browser confirm().
 * Returns a Promise that resolves true (confirmed) or false (cancelled).
 */
function _showConfirmModal({ icon, title, lines, confirmLabel, confirmClass }) {
    return new Promise(resolve => {
        const existing = document.getElementById('_emergencyConfirmOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = '_emergencyConfirmOverlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.75)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'z-index:99999', 'font-family:sans-serif'
        ].join(';');

        const linesHtml = lines.map(l =>
            `<p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;">${l}</p>`
        ).join('');

        overlay.innerHTML = `
            <div style="background:#1e293b;border:1px solid #334155;border-radius:14px;
                        padding:28px 24px;width:360px;max-width:90vw;
                        box-shadow:0 24px 64px rgba(0,0,0,0.6);">
                <div style="font-size:24px;margin-bottom:10px;">${icon}</div>
                <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;">${title}</div>
                ${linesHtml}
                <div style="display:flex;gap:10px;margin-top:22px;">
                    <button id="_ecmConfirm"
                        style="flex:1;padding:11px 0;border-radius:8px;font-size:13px;
                               font-weight:700;border:none;cursor:pointer;${confirmClass}">
                        ${confirmLabel}
                    </button>
                    <button id="_ecmCancel"
                        style="flex:1;padding:11px 0;border-radius:8px;font-size:13px;
                               font-weight:600;background:transparent;color:#94a3b8;
                               border:1px solid #334155;cursor:pointer;">
                        Cancel
                    </button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const close = (result) => { overlay.remove(); resolve(result); };
        document.getElementById('_ecmConfirm').onclick = () => close(true);
        document.getElementById('_ecmCancel').onclick  = () => close(false);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    });
}

// ===========================================
// RESULT MODAL HELPERS
// ===========================================

function _openResultModal(titleText, bodyHtml) {
    // Reuse the existing emergencyModal if present, otherwise build one inline
    let modal   = document.getElementById('emergencyModal');
    let titleEl = document.getElementById('emergencyModalTitle');
    let content = document.getElementById('emergencyModalContent');
    let results = document.getElementById('emergencyResults');

    // If the HTML doesn't have the modal structure, create it on the fly
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'emergencyModal';
        modal.style.cssText = [
            'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.75)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'z-index:99998', 'font-family:sans-serif'
        ].join(';');
        modal.innerHTML = `
            <div style="background:#1e293b;border:1px solid #334155;border-radius:14px;
                        padding:0;width:480px;max-width:94vw;max-height:85vh;
                        display:flex;flex-direction:column;overflow:hidden;
                        box-shadow:0 24px 64px rgba(0,0,0,0.6);">
                <div style="padding:16px 20px;border-bottom:1px solid #334155;
                            display:flex;justify-content:space-between;align-items:center;">
                    <span id="emergencyModalTitle"
                          style="font-size:15px;font-weight:700;color:#f1f5f9;"></span>
                    <button onclick="closeEmergencyModal()"
                        style="background:none;border:none;color:#64748b;font-size:20px;
                               cursor:pointer;line-height:1;">×</button>
                </div>
                <div id="emergencyModalContent" style="padding:16px 20px;color:#cbd5e1;"></div>
                <div id="emergencyResults"
                     style="padding:0 20px 20px;overflow-y:auto;display:none;"></div>
            </div>`;
        document.body.appendChild(modal);
        titleEl = document.getElementById('emergencyModalTitle');
        content = document.getElementById('emergencyModalContent');
        results = document.getElementById('emergencyResults');
    }

    // Reset state
    titleEl.textContent = titleText;
    content.style.display = '';
    content.innerHTML     = '<p style="text-align:center;padding:24px 0;">Processing… Please wait…</p>';
    results.style.display = 'none';
    results.innerHTML     = '';

    // Show modal
    if (modal.classList) {
        modal.classList.add('show');
    } else {
        modal.style.display = 'flex';
    }

    return { modal, titleEl, content, results };
}

function _showResult(content, results, html) {
    content.style.display = 'none';
    // hide via classList if available, else style
    try { content.classList.add('hidden'); } catch(_) {}
    results.innerHTML     = html;
    results.style.display = '';
    try { results.classList.remove('hidden'); } catch(_) {}
}

// ===========================================
// EMERGENCY ACTIONS
// ===========================================

async function exitAllPositions() {
    const confirmed = await _showConfirmModal({
        icon: '⚠️',
        title: 'Exit All Positions',
        lines: [
            'This will <strong style="color:#fbbf24;">cancel all pending orders</strong>, then',
            '<strong style="color:#f87171;">exit all open positions at MARKET price</strong>.',
            '<span style="font-size:12px;color:#94a3b8;">This action cannot be undone.</span>'
        ],
        confirmLabel: '⚠️ Yes, Exit All',
        confirmClass: 'background:#dc2626;color:#fff;'
    });
    if (!confirmed) return;

    const { content, results } = _openResultModal(
        '⚠️ Cancelling Orders & Exiting Positions'
    );

    try {
        const userId = sessionStorage.getItem('user_id') ||
                       sessionStorage.getItem('userId') ||
                       sessionStorage.getItem('userid');
        if (!userId) throw new Error('User ID not found. Please login again.');

        const response = await fetch(`${EMERGENCY_CONFIG.backendUrl}/api/positions/exit-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
            body: JSON.stringify({})
        });
        if (response.status === 401) { sessionStorage.clear(); throw new Error('Session expired — please login again'); }
        if (!response.ok) { const t = await response.text(); throw new Error(`HTTP ${response.status}: ${t.substring(0, 100)}`); }

        const data = await response.json();

        if (data.success) {
            const cancelledCount   = (data.cancelled_orders || []).length;
            const cancelFailedCount = (data.cancel_failed    || []).length;

            let html = `
                <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:12px;">
                    <div style="font-weight:700;font-size:15px;color:#166534;margin-bottom:12px;">✓ Operation Complete</div>

                    <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #bbf7d0;">
                        <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;
                                    letter-spacing:.06em;margin-bottom:6px;">Phase 1 — Pending Orders Cancelled</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;">
                            <div>
                                <div style="font-size:20px;font-weight:700;color:#16a34a;">${cancelledCount}</div>
                                <div style="font-size:11px;color:#6b7280;">Cancelled</div>
                            </div>
                            <div>
                                <div style="font-size:20px;font-weight:700;color:${cancelFailedCount > 0 ? '#dc2626' : '#9ca3af'};">${cancelFailedCount}</div>
                                <div style="font-size:11px;color:#6b7280;">Failed</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;
                                    letter-spacing:.06em;margin-bottom:6px;">Phase 2 — Positions Exited</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
                            <div>
                                <div style="font-size:20px;font-weight:700;color:#111827;">${data.total_attempted}</div>
                                <div style="font-size:11px;color:#6b7280;">Total</div>
                            </div>
                            <div>
                                <div style="font-size:20px;font-weight:700;color:#16a34a;">${data.closed_positions.length}</div>
                                <div style="font-size:11px;color:#6b7280;">Closed</div>
                            </div>
                            <div>
                                <div style="font-size:20px;font-weight:700;color:#dc2626;">${data.failed_positions.length}</div>
                                <div style="font-size:11px;color:#6b7280;">Failed</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
            `;

            if (cancelledCount > 0) {
                html += `<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin:4px 0 2px;">Orders Cancelled</div>`;
                (data.cancelled_orders || []).forEach(o => {
                    html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;
                                         display:flex;justify-content:space-between;font-size:12px;">
                                 <span style="font-family:monospace;font-weight:600;">${o.tradingsymbol}</span>
                                 <span style="color:#92400e;">Order #${o.order_id} cancelled</span>
                             </div>`;
                });
            }

            if (data.closed_positions.length > 0) {
                html += `<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin:8px 0 2px;">Positions Exited</div>`;
                data.closed_positions.forEach(pos => {
                    const pnlColor = pos.pnl >= 0 ? '#16a34a' : '#dc2626';
                    html += `<div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:6px;padding:8px 10px;">
                                 <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                     <span style="font-family:monospace;font-weight:600;font-size:12px;">${pos.tradingsymbol}</span>
                                     <span style="font-weight:700;font-size:11px;color:${pnlColor};">P&L: ₹${pos.pnl.toFixed(2)}</span>
                                 </div>
                                 <div style="font-size:11px;color:#6b7280;">Qty: ${pos.quantity} • Order ID: ${pos.order_id}</div>
                             </div>`;
                });
            }

            data.failed_positions.forEach(pos => {
                html += `<div style="background:#fef2f2;border:2px solid #fecaca;border-radius:6px;padding:8px 10px;">
                             <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                 <span style="font-family:monospace;font-weight:600;font-size:12px;color:#b91c1c;">${pos.tradingsymbol}</span>
                                 <span style="font-weight:700;font-size:11px;color:#b91c1c;">FAILED</span>
                             </div>
                             <div style="font-size:11px;color:#dc2626;">${pos.error}</div>
                         </div>`;
            });

            html += `</div>
                     <div style="margin-top:14px;">
                         <button onclick="closeEmergencyModal()"
                             style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                                    font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">
                             Close
                         </button>
                     </div>`;
            _showResult(content, results, html);
        } else {
            _showResult(content, results, `
                <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:12px;">
                    <div style="font-weight:700;font-size:15px;color:#991b1b;margin-bottom:6px;">✗ Error</div>
                    <p style="color:#b91c1c;font-size:13px;margin:0;">${data.error || 'Unknown error occurred'}</p>
                </div>
                <button onclick="closeEmergencyModal()"
                    style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                           font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">Close</button>`);
        }
    } catch (error) {
        _showResult(content, results, `
            <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:15px;color:#991b1b;margin-bottom:6px;">✗ Error</div>
                <p style="color:#b91c1c;font-size:13px;margin:0;">${error.message}</p>
            </div>
            <button onclick="closeEmergencyModal()"
                style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                       font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">Close</button>`);
    }
}

async function cancelAllOrders() {
    const confirmed = await _showConfirmModal({
        icon: '🚫',
        title: 'Cancel All Pending Orders',
        lines: [
            'This will <strong style="color:#fbbf24;">cancel all open and trigger-pending orders</strong>.',
            '<span style="font-size:12px;color:#94a3b8;">Open positions will not be affected.</span>'
        ],
        confirmLabel: '🚫 Yes, Cancel All',
        confirmClass: 'background:#d97706;color:#fff;'
    });
    if (!confirmed) return;

    const { content, results } = _openResultModal('🚫 Cancelling All Orders');

    try {
        const userId = sessionStorage.getItem('user_id') ||
                       sessionStorage.getItem('userId') ||
                       sessionStorage.getItem('userid');
        if (!userId) throw new Error('User ID not found. Please login again.');

        const response = await fetch(`${EMERGENCY_CONFIG.backendUrl}/api/orders/cancel-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': userId }
        });
        if (response.status === 401) { sessionStorage.clear(); throw new Error('Session expired — please login again'); }
        if (!response.ok) { const t = await response.text(); throw new Error(`HTTP ${response.status}: ${t.substring(0, 100)}`); }

        const data = await response.json();

        if (data.success) {
            let html = `
                <div style="background:#fffbeb;border:2px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:12px;">
                    <div style="font-weight:700;font-size:15px;color:#92400e;margin-bottom:10px;">✓ Cancellation Complete</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
                        <div>
                            <div style="font-size:22px;font-weight:700;color:#111827;">${data.total_attempted}</div>
                            <div style="font-size:11px;color:#6b7280;">Total</div>
                        </div>
                        <div>
                            <div style="font-size:22px;font-weight:700;color:#16a34a;">${data.cancelled_orders.length}</div>
                            <div style="font-size:11px;color:#6b7280;">Cancelled</div>
                        </div>
                        <div>
                            <div style="font-size:22px;font-weight:700;color:#dc2626;">${data.failed_orders.length}</div>
                            <div style="font-size:11px;color:#6b7280;">Failed</div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">
            `;

            data.cancelled_orders.forEach(order => {
                html += `<div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:6px;padding:8px 10px;">
                             <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                 <span style="font-family:monospace;font-weight:600;font-size:12px;">${order.tradingsymbol}</span>
                                 <span style="font-weight:700;font-size:11px;color:#16a34a;">CANCELLED</span>
                             </div>
                             <div style="font-size:11px;color:#6b7280;">Order ID: ${order.order_id} • Qty: ${order.quantity} • ${order.order_type}</div>
                         </div>`;
            });

            data.failed_orders.forEach(order => {
                html += `<div style="background:#fef2f2;border:2px solid #fecaca;border-radius:6px;padding:8px 10px;">
                             <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                                 <span style="font-family:monospace;font-weight:600;font-size:12px;color:#b91c1c;">${order.tradingsymbol}</span>
                                 <span style="font-weight:700;font-size:11px;color:#b91c1c;">FAILED</span>
                             </div>
                             <div style="font-size:11px;color:#dc2626;">${order.error}</div>
                         </div>`;
            });

            html += `</div>
                     <div style="margin-top:14px;">
                         <button onclick="closeEmergencyModal()"
                             style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                                    font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">
                             Close
                         </button>
                     </div>`;
            _showResult(content, results, html);
        } else {
            _showResult(content, results, `
                <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:12px;">
                    <div style="font-weight:700;font-size:15px;color:#991b1b;margin-bottom:6px;">✗ Error</div>
                    <p style="color:#b91c1c;font-size:13px;margin:0;">${data.error || 'Unknown error occurred'}</p>
                </div>
                <button onclick="closeEmergencyModal()"
                    style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                           font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">Close</button>`);
        }
    } catch (error) {
        _showResult(content, results, `
            <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:12px;">
                <div style="font-weight:700;font-size:15px;color:#991b1b;margin-bottom:6px;">✗ Error</div>
                <p style="color:#b91c1c;font-size:13px;margin:0;">${error.message}</p>
            </div>
            <button onclick="closeEmergencyModal()"
                style="width:100%;padding:10px 0;background:#1d4ed8;color:#fff;
                       font-weight:600;font-size:13px;border:none;border-radius:8px;cursor:pointer;">Close</button>`);
    }
}

function closeEmergencyModal() {
    // Handle both class-based (.show) and style-based modals
    const modal = document.getElementById('emergencyModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        setTimeout(() => {
            const content = document.getElementById('emergencyModalContent');
            const results = document.getElementById('emergencyResults');
            if (content) { content.innerHTML = ''; content.style.display = ''; }
            if (results) { results.innerHTML = ''; results.style.display = 'none'; try { results.classList.add('hidden'); } catch(_) {} }
            modal.style.display = '';
        }, 300);
    }
}

window.exitAllPositions  = exitAllPositions;
window.cancelAllOrders   = cancelAllOrders;
window.closeEmergencyModal = closeEmergencyModal;

console.log('✅ Emergency Actions module loaded');
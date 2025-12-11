// =========================================================
// CHART MONITOR PAGE MODULE
// Monitors chart patterns and sends alerts
// Requires: shared_config.js
// =========================================================

/**
 * Initialize Chart Monitor page
 */
function initChartMonitor() {
    console.log('Initializing Chart Monitor page...');
    setupChartMonitorListeners();
}

/**
 * Setup event listeners for Chart Monitor page
 */
function setupChartMonitorListeners() {
    const startMonitorBtn = document.getElementById('startMonitorBtn');
    const stopMonitorBtn = document.getElementById('stopMonitorBtn');
    const checkNowBtn = document.getElementById('checkNowBtn');
    const testEmailBtn = document.getElementById('testEmailBtn');
    
    if (startMonitorBtn) {
        startMonitorBtn.addEventListener('click', startChartMonitor);
    }
    
    if (stopMonitorBtn) {
        stopMonitorBtn.addEventListener('click', stopChartMonitor);
    }
    
    if (checkNowBtn) {
        checkNowBtn.addEventListener('click', checkCandleNow);
    }
    
    if (testEmailBtn) {
        testEmailBtn.addEventListener('click', testEmail);
    }
}

/**
 * Add log entry to activity log
 */
function addLogEntry(message, type = 'info') {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="text-xs text-gray-500">${timestamp}</span> - ${message}`;
    
    activityLog.insertBefore(entry, activityLog.firstChild);
    
    // Keep only last 50 entries
    while (activityLog.children.length > 50) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

/**
 * Start chart monitoring
 */
async function startChartMonitor() {
    const instrumentToken = document.getElementById('instrumentToken')?.value;
    const interval = document.getElementById('intervalSelect')?.value;
    const threshold = document.getElementById('thresholdPercent')?.value;
    const frequency = parseInt(document.getElementById('checkFrequency')?.value || 300);

    if (!instrumentToken) {
        addLogEntry('❌ Please enter an instrument token', 'error');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/start-monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                instrument_token: instrumentToken,
                interval: interval,
                threshold: threshold,
                frequency: frequency
            })
        });

        const data = await response.json();

        if (data.success) {
            state.monitorRunning = true;
            const monitorStatus = document.getElementById('monitorStatus');
            if (monitorStatus) {
                monitorStatus.className = 'monitor-status active';
                monitorStatus.innerHTML = '<div class="pulse bg-green-600"></div><span>Running</span>';
            }
            
            const startBtn = document.getElementById('startMonitorBtn');
            const stopBtn = document.getElementById('stopMonitorBtn');
            if (startBtn) startBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.remove('hidden');
            
            addLogEntry('✅ Monitor started successfully', 'success');
            addLogEntry(`Checking every ${frequency / 60} minutes for candles with body > ${threshold}%`, 'info');
        } else {
            throw new Error(data.error || 'Failed to start monitor');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * Stop chart monitoring
 */
async function stopChartMonitor() {
    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/stop-monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            }
        });

        const data = await response.json();

        if (data.success) {
            state.monitorRunning = false;
            const monitorStatus = document.getElementById('monitorStatus');
            if (monitorStatus) {
                monitorStatus.className = 'monitor-status inactive';
                monitorStatus.innerHTML = '<div class="pulse bg-red-600"></div><span>Stopped</span>';
            }
            
            const startBtn = document.getElementById('startMonitorBtn');
            const stopBtn = document.getElementById('stopMonitorBtn');
            if (startBtn) startBtn.classList.remove('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
            
            addLogEntry('🛑 Monitor stopped', 'warning');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * Test email functionality
 */
async function testEmail() {
    addLogEntry('📧 Sending test email...', 'info');
    const testEmailBtn = document.getElementById('testEmailBtn');
    
    if (testEmailBtn) {
        testEmailBtn.disabled = true;
        testEmailBtn.textContent = 'Sending...';
    }

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            }
        });

        const data = await response.json();

        if (data.success) {
            addLogEntry('✅ Test email sent! Check your inbox', 'success');
        } else {
            throw new Error(data.error || 'Failed to send test email');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    } finally {
        if (testEmailBtn) {
            testEmailBtn.disabled = false;
            testEmailBtn.textContent = 'Test Email';
        }
    }
}

/**
 * Check candle strength now
 */
async function checkCandleNow() {
    const instrumentToken = document.getElementById('instrumentToken')?.value;
    const interval = document.getElementById('intervalSelect')?.value;
    const threshold = document.getElementById('thresholdPercent')?.value;

    if (!instrumentToken) {
        addLogEntry('❌ Please enter an instrument token', 'error');
        return;
    }

    addLogEntry('🔍 Checking candle strength...', 'info');

    try {
        const response = await fetch(`${CONFIG.backendUrl}/api/check-candle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': state.userId
            },
            body: JSON.stringify({
                instrument_token: instrumentToken,
                interval: interval,
                threshold: threshold
            })
        });

        const data = await response.json();

        if (data.success) {
            const result = data.result;
            addLogEntry(
                `Body: ${result.body_percent.toFixed(2)}% | ${result.message}`,
                result.alert_sent ? 'success' : 'info'
            );
            if (result.alert_sent) {
                addLogEntry(`📧 Alert email sent`, 'success');
            }
        } else {
            throw new Error(data.error || 'Failed to check candle');
        }
    } catch (error) {
        addLogEntry(`❌ Error: ${error.message}`, 'error');
    }
}

// Auto-initialize if page element exists
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        const chartMonitorPage = document.getElementById('chartMonitorPage');
        if (chartMonitorPage && !chartMonitorPage.classList.contains('hidden')) {
            initChartMonitor();
        }
    });
}

// Export functions to global scope
window.initChartMonitor = initChartMonitor;
window.addLogEntry = addLogEntry;
window.startChartMonitor = startChartMonitor;
window.stopChartMonitor = stopChartMonitor;
window.testEmail = testEmail;
window.checkCandleNow = checkCandleNow;

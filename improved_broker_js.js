// Improved Broker Login JavaScript with Better Error Handling

// Check if API is reachable
async function checkApiHealth() {
    try {
        const response = await fetch('http://localhost:5000/health', {
            method: 'GET',
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API is healthy:', data);
            return true;
        } else {
            console.error('❌ API returned error status:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Cannot connect to API:', error.message);
        return false;
    }
}

// Improved Angel One login handler with detailed error messages
async function handleAngelOneLogin(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('angelApiKey').value.trim();
    const clientCode = document.getElementById('angelClientCode').value.trim();
    const pin = document.getElementById('angelPin').value.trim();
    const totpToken = document.getElementById('angelTotp').value.trim();
    
    if (!apiKey || !clientCode || !pin || !totpToken) {
        showError('Please fill all fields');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connecting...';
    
    try {
        // First check if API is reachable
        console.log('Checking API health...');
        const apiHealthy = await checkApiHealth();
        
        if (!apiHealthy) {
            throw new Error('Backend server is not running. Please start the Flask server (python app.py)');
        }
        
        console.log('Sending Angel One login request...');
        const response = await fetch('http://localhost:5000/api/generate-session', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify({
                broker_type: 'angelone',
                api_key: apiKey,
                client_code: clientCode,
                pin: pin,
                totp_token: totpToken
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            // Store session info
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('broker', 'angelone');
            
            console.log('✅ Login successful!');
            
            // Show success message
            showSuccess('Login successful! Loading dashboard...');
            
            // Show main app
            setTimeout(() => {
                document.getElementById('loginPage').classList.add('hidden');
                document.getElementById('mainApp').classList.remove('hidden');
                
                // Load dashboard if function exists
                if (typeof loadDashboardData === 'function') {
                    loadDashboardData();
                }
            }, 1000);
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        
        let errorMessage = error.message;
        
        // Provide helpful error messages
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to backend server. Please ensure:\n' +
                          '1. Flask server is running (python app.py)\n' +
                          '2. Server is accessible at http://localhost:5000\n' +
                          '3. CORS is enabled in the backend';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Network error. Check your internet connection and firewall settings.';
        }
        
        showError(errorMessage);
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Improved Zerodha login handler
async function handleZerodhaLogin(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();
    
    if (!apiKey || !apiSecret) {
        showError('Please enter both API Key and Secret');
        return;
    }
    
    // Check API health first
    const apiHealthy = await checkApiHealth();
    
    if (!apiHealthy) {
        showError('Backend server is not running. Please start the Flask server (python app.py)');
        return;
    }
    
    // Store credentials temporarily
    sessionStorage.setItem('kite_api_key', apiKey);
    sessionStorage.setItem('kite_api_secret', apiSecret);
    
    // Redirect to Kite login
    const loginUrl = `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;
    window.location.href = loginUrl;
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.className = 'mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg';
        const errorText = errorDiv.querySelector('p');
        if (errorText) {
            errorText.className = 'text-green-700 text-sm font-medium';
            errorText.textContent = message;
        }
        errorDiv.classList.remove('hidden');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.className = 'mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg';
        const errorText = errorDiv.querySelector('p');
        if (errorText) {
            errorText.className = 'text-red-700 text-sm font-medium';
            errorText.textContent = message;
        }
        errorDiv.classList.remove('hidden');
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 10000);
    } else {
        alert(message);
    }
}

// Test API connection on page load
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Testing API connection...');
    const healthy = await checkApiHealth();
    
    if (!healthy) {
        console.warn('⚠️ Backend API is not accessible. Make sure to run: python app.py');
    }
});

console.log('✅ Improved broker login script loaded');

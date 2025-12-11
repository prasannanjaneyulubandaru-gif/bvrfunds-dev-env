// =========================================================
// AUTOCOMPLETE FUNCTIONALITY FOR TRADING SYMBOL INPUT
// Add this code to your existing app.js file
// =========================================================

// Autocomplete state
let autocompleteResults = [];
let selectedAutocompleteIndex = -1;
let autocompleteTimeout = null;

/**
 * Setup autocomplete for trading symbol input
 */
function setupSymbolAutocomplete() {
    const inputField = document.getElementById('orderSymbol');
    const exchangeSelect = document.getElementById('orderExchange');
    
    if (!inputField) return;
    
    // Create autocomplete dropdown container
    const autocompleteContainer = document.createElement('div');
    autocompleteContainer.id = 'symbolAutocomplete';
    autocompleteContainer.className = 'absolute z-50 w-full bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto hidden';
    autocompleteContainer.style.top = '100%';
    autocompleteContainer.style.left = '0';
    autocompleteContainer.style.marginTop = '4px';
    
    // Make parent relative for positioning
    inputField.parentElement.style.position = 'relative';
    inputField.parentElement.appendChild(autocompleteContainer);
    
    // Input event listener
    inputField.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        
        // Clear previous timeout
        if (autocompleteTimeout) {
            clearTimeout(autocompleteTimeout);
        }
        
        // Hide dropdown if query is too short
        if (query.length < 2) {
            hideAutocomplete();
            return;
        }
        
        // Debounce: wait 300ms after user stops typing
        autocompleteTimeout = setTimeout(() => {
            searchSymbols(query, exchangeSelect.value);
        }, 300);
    });
    
    // Handle keyboard navigation
    inputField.addEventListener('keydown', (e) => {
        const dropdown = document.getElementById('symbolAutocomplete');
        if (dropdown.classList.contains('hidden')) return;
        
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
                updateAutocompleteSelection(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
                updateAutocompleteSelection(items);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (selectedAutocompleteIndex >= 0 && selectedAutocompleteIndex < items.length) {
                    selectSymbol(autocompleteResults[selectedAutocompleteIndex]);
                }
                break;
                
            case 'Escape':
                hideAutocomplete();
                break;
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!inputField.contains(e.target) && !autocompleteContainer.contains(e.target)) {
            hideAutocomplete();
        }
    });
    
    // Exchange change should trigger new search if there's text
    exchangeSelect.addEventListener('change', () => {
        const query = inputField.value.trim().toUpperCase();
        if (query.length >= 2) {
            searchSymbols(query, exchangeSelect.value);
        }
    });
}

/**
 * Search for symbols via API
 */
async function searchSymbols(query, exchange) {
    try {
        // Show loading state
        const container = document.getElementById('symbolAutocomplete');
        container.innerHTML = '<div class="autocomplete-loading">🔍 Searching...</div>';
        container.classList.remove('hidden');
        
        const response = await fetch(`${CONFIG.backendUrl}/api/search-instruments?q=${encodeURIComponent(query)}&exchange=${exchange}&limit=20`, {
            headers: {
                'X-User-ID': state.userId
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.results && data.results.length > 0) {
            autocompleteResults = data.results;
            displayAutocompleteResults(data.results);
        } else {
            // Show no results message
            container.innerHTML = '<div class="autocomplete-no-results">No instruments found for "' + query + '"</div>';
            setTimeout(() => hideAutocomplete(), 2000);
        }
    } catch (error) {
        console.error('Autocomplete error:', error);
        const container = document.getElementById('symbolAutocomplete');
        container.innerHTML = '<div class="autocomplete-no-results text-red-600">⚠️ Search failed. Please try again.</div>';
        setTimeout(() => hideAutocomplete(), 2000);
    }
}

/**
 * Display autocomplete results
 */
function displayAutocompleteResults(results) {
    const container = document.getElementById('symbolAutocomplete');
    
    if (!results || results.length === 0) {
        hideAutocomplete();
        return;
    }
    
    container.innerHTML = '';
    selectedAutocompleteIndex = -1;
    
    results.forEach((instrument, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item px-4 py-3 cursor-pointer hover:bg-gray-100 border-b border-gray-200 transition-colors';
        item.dataset.index = index;
        
        // Create layout: symbol on left, exchange badge on right
        const symbolSpan = document.createElement('div');
        symbolSpan.className = 'flex items-center justify-between';
        
        const leftSide = document.createElement('div');
        const symbolText = document.createElement('span');
        symbolText.className = 'font-semibold text-gray-900 mono text-sm';
        symbolText.textContent = instrument.tradingsymbol;
        
        const nameText = document.createElement('div');
        nameText.className = 'text-xs text-gray-600 mt-1';
        nameText.textContent = instrument.name || instrument.instrument_type || '';
        
        leftSide.appendChild(symbolText);
        leftSide.appendChild(nameText);
        
        const exchangeBadge = document.createElement('span');
        exchangeBadge.className = 'px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded';
        exchangeBadge.textContent = instrument.exchange;
        
        symbolSpan.appendChild(leftSide);
        symbolSpan.appendChild(exchangeBadge);
        item.appendChild(symbolSpan);
        
        // Click handler
        item.addEventListener('click', () => {
            selectSymbol(instrument);
        });
        
        // Mouse enter handler
        item.addEventListener('mouseenter', () => {
            selectedAutocompleteIndex = index;
            updateAutocompleteSelection(container.querySelectorAll('.autocomplete-item'));
        });
        
        container.appendChild(item);
    });
    
    container.classList.remove('hidden');
}

/**
 * Update visual selection in autocomplete
 */
function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedAutocompleteIndex) {
            item.classList.add('bg-blue-50');
            item.classList.remove('bg-white');
            // Scroll into view if needed
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('bg-blue-50');
            item.classList.add('bg-white');
        }
    });
}

/**
 * Select a symbol from autocomplete
 */
function selectSymbol(instrument) {
    const inputField = document.getElementById('orderSymbol');
    const exchangeSelect = document.getElementById('orderExchange');
    
    inputField.value = instrument.tradingsymbol;
    exchangeSelect.value = instrument.exchange;
    
    // Store instrument token for later use if needed
    inputField.dataset.instrumentToken = instrument.instrument_token;
    
    hideAutocomplete();
}

/**
 * Hide autocomplete dropdown
 */
function hideAutocomplete() {
    const container = document.getElementById('symbolAutocomplete');
    if (container) {
        container.classList.add('hidden');
    }
    autocompleteResults = [];
    selectedAutocompleteIndex = -1;
}

// =========================================================
// END OF AUTOCOMPLETE FUNCTIONALITY
// =========================================================

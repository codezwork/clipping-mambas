const SMM_BACKEND_URL = "https://mamba-clippers-backend-smm.onrender.com/api/test-smm";

function toggleSmmPanel(e, videoId) {
    e.stopPropagation(); 
    if (isSelectionMode) return;
    
    const panel = document.getElementById(`smm-panel-${videoId}`);
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// Controls the Provider Toggle
function setSmmProvider(e, videoId, provider) {
    e.stopPropagation();
    const panel = document.getElementById(`smm-panel-${videoId}`);
    panel.dataset.provider = provider;

    // Reset styles
    document.getElementById(`prov-lite-${videoId}`).classList.remove('active');
    document.getElementById(`prov-one-${videoId}`).classList.remove('active');

    // Add active style to selected
    if (provider === 'smmLite') {
        document.getElementById(`prov-lite-${videoId}`).classList.add('active');
    } else {
        document.getElementById(`prov-one-${videoId}`).classList.add('active');
    }
}

// Controls the Service Mode Toggle
function setSmmMode(e, videoId, mode) {
    e.stopPropagation();
    const panel = document.getElementById(`smm-panel-${videoId}`);
    panel.dataset.mode = mode; // Save state to DOM

    // Reset Icon Toggles
    document.getElementById(`mode-views-${videoId}`).classList.remove('active');
    document.getElementById(`mode-likes-${videoId}`).classList.remove('active');

    // Hide both quantity groups
    document.getElementById(`quantities-views-${videoId}`).classList.add('hidden');
    document.getElementById(`quantities-likes-${videoId}`).classList.add('hidden');

    // Activate the right ones
    if (mode === 'views') {
        document.getElementById(`mode-views-${videoId}`).classList.add('active');
        document.getElementById(`quantities-views-${videoId}`).classList.remove('hidden');
    } else {
        document.getElementById(`mode-likes-${videoId}`).classList.add('active');
        document.getElementById(`quantities-likes-${videoId}`).classList.remove('hidden');
    }
}

// NEW: Connects the Custom Qty Input seamlessly to our main submit function
async function submitCustomSmm(e, videoId, videoLink, btnElement) {
    e.stopPropagation();
    
    const inputEl = document.getElementById(`custom-qty-${videoId}`);
    const quantity = parseInt(inputEl.value);
    
    if (!quantity || quantity <= 0) {
        showToast("Enter a valid quantity", "error");
        return;
    }
    
    // Process it through our existing order submission
    await submitSmmOrder(e, videoId, videoLink, quantity, btnElement);
    
    // Clear input after submission
    inputEl.value = '';
}


// Handles the Order Submission based on toggled states
async function submitSmmOrder(e, videoId, videoLink, quantity, btnElement) {
    e.stopPropagation();
    
    // Read current state from the panel
    const panel = document.getElementById(`smm-panel-${videoId}`);
    const provider = panel.dataset.provider;
    const mode = panel.dataset.mode;
    
    let serviceId = '';
    let serviceName = '';

    // Map the IDs based on provider and mode combinations
    if (provider === 'smmLite' && mode === 'views') { serviceId = '7378'; serviceName = 'Views (L)'; }
    if (provider === 'smmLite' && mode === 'likes') { serviceId = '6944'; serviceName = 'Likes (L)'; }
    if (provider === 'smmPanelOne' && mode === 'views') { serviceId = '8429'; serviceName = 'Views (O)'; }
    if (provider === 'smmPanelOne' && mode === 'likes') { serviceId = '12981'; serviceName = 'Likes (O)'; }

    // Instant UI Feedback (Now supports both Text Buttons and SVG Arrow buttons)
    const originalContent = btnElement.innerHTML;
    
    if (btnElement.innerText.trim()) {
        btnElement.innerText = "ORDERING...";
    } else {
        // If it's an icon button, use a spinner symbol temporarily
        btnElement.innerHTML = "⏳";
    }
    
    btnElement.disabled = true;
    btnElement.classList.add('btn-loading');

    const now = new Date();
    const dateStr = now.getDate() + ' - ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const fullLogDetails = `${dateStr} (${quantity} ${serviceName})`;

    try {
        const response = await fetch(SMM_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                link: videoLink,
                service: serviceId,
                quantity: quantity,
                provider: provider 
            })
        });

        if (response.ok) {
            showToast("Order placed successfully!", "success");
            
            await db.collection('videos').doc(videoId).update({
                lastSmmOrder: fullLogDetails
            });
            
            // Update the log text immediately on screen
            document.getElementById(`smm-log-${videoId}`).innerText = `Last: ${fullLogDetails}`;
            
        } else {
            throw new Error("API returned an error");
        }
    } catch (error) {
        console.error(error);
        showToast("Failed to place order.", "error");
    } finally {
        // Always revert the button back so it can be clicked again
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
        btnElement.classList.remove('btn-loading');
    }
}

// NEW: 24H Hardcoded Automation Protocol
async function fireAutomation(e, videoId, videoLink, btnElement) {
    e.stopPropagation();

    // --- NEW: THE SAFEGUARD CONFIRMATION ---
    if (!confirm("Initiate 24H Automation? This will send 400 views over intervals of 6 hours and lock this button for 24 hours.")) {
        return; // Stops the function immediately if they click "Cancel"
    }
    // ---------------------------------------
    
    // Hardcoded Payload for 24H Drip Feed
    const payload = {
        link: videoLink,
        service: "7378",    // SMM Raja Views
        quantity: 100,      // Total: 400 (4 runs of 100 views)
        runs: 4,            // 4 executions
        interval: 360,      // 6 Hours in minutes
        provider: "smmLite" // Defaults to SMM Raja backend logic
    };

    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = "⏳";
    btnElement.disabled = true;
    btnElement.classList.add('btn-loading');

    try {
        const response = await fetch(SMM_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            showToast("Automation active for 24 Hours!", "success");
            
            const now = new Date();
            const dateStr = now.getDate() + ' - ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            // Lock the button in Firestore by saving the server timestamp
            await db.collection('videos').doc(videoId).update({
                lastAutoOrderAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSmmOrder: `${dateStr} (AUTO 24H Drip-Feed)`
            });
            
            // The row will automatically re-render and lock the button because of your snapshot listener!
            
        } else {
            // Catch hidden SMM Raja errors
            showToast(`API Rejected: ${data.error || 'Unknown Error'}`, "error");
            btnElement.innerHTML = originalContent;
            btnElement.disabled = false;
        }
    } catch (error) {
        console.error(error);
        showToast("Network Error: Could not reach backend", "error");
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
    } finally {
        btnElement.classList.remove('btn-loading');
    }
}

// Make sure this points to your deployed backend URL
const SMM_BALANCE_URL = "https://mamba-clippers-backend-smm.onrender.com/api/smm-balance";

async function fetchSmmBalances() {
    const btn = document.getElementById('refresh-funds-btn');
    const liteBal = document.getElementById('lite-balance');
    const panelOneBal = document.getElementById('panel-one-balance');

    // Trigger visual spinning effect
    if (btn) btn.classList.add('spinning');

    try {
        const response = await fetch(SMM_BALANCE_URL);
        
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        
        // Update the DOM if data is returned
        if (data.lite !== undefined && liteBal) liteBal.innerText = `₹${data.lite}`;
        if (data.panelOne !== undefined && panelOneBal) panelOneBal.innerText = `₹${data.panelOne}`;
        
    } catch (error) {
        console.error("Failed to fetch SMM balances:", error);
        showToast("SMM Funds offline", "error");
    } finally {
        // Stop spinning effect
        if (btn) btn.classList.remove('spinning');
    }
}

// Auto-fetch balances silently when the app loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait 1.5 seconds so it doesn't interrupt the premium splash screen animation
    setTimeout(fetchSmmBalances, 1500); 
});

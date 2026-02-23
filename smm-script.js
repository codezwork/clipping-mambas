const SMM_BACKEND_URL = "https://mamba-clippers-backend-smm.onrender.com/api/test-smm"; // Update this later

// Toggles the expandable panel
function toggleSmmPanel(e, videoId) {
    e.stopPropagation(); // Prevents selection mode from triggering
    if (isSelectionMode) return;
    
    const panel = document.getElementById(`smm-panel-${videoId}`);
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// Handles the API request and Render cold-start UX
// Handles the API request and Render cold-start UX
async function submitSmmOrder(e, videoId, videoLink) {
    e.stopPropagation();
    
    // Grab the provider value
    const provider = document.getElementById(`smm-provider-${videoId}`).value;
    
    const serviceSelect = document.getElementById(`smm-service-${videoId}`);
    const service = serviceSelect.value;
    
    // RESTORED: Grab the actual text (e.g., "R - ꚠ V") and strip out the icon for a clean log
    const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.replace('ꚠ ', '').trim();
    
    const quantity = document.getElementById(`smm-quantity-${videoId}`).value;
    const btn = document.getElementById(`smm-send-btn-${videoId}`);

    if (!quantity || quantity <= 0) {
        showToast("Please enter a valid quantity", "error");
        return;
    }

    // 1. Instant UI Feedback
    const originalText = btn.innerText;
    btn.innerText = "ORDERED...";
    btn.disabled = true;
    btn.classList.add('btn-loading');

    // 2. Format the Date and Details (e.g., "20 - 11:12 AM (100 R - V)")
    const now = new Date();
    const dateStr = now.getDate() + ' - ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const fullLogDetails = `${dateStr} (${quantity} ${serviceName})`;

    try {
        const response = await fetch(SMM_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                link: videoLink,
                service: service,
                quantity: quantity,
                provider: provider 
            })
        });

        if (response.ok) {
            showToast("Order placed successfully!", "success");
            
            // 3. RESTORED: Save the NEW formatted log to Firestore
            await db.collection('videos').doc(videoId).update({
                lastSmmOrder: fullLogDetails
            });
            
        } else {
            throw new Error("API returned an error");
        }
    } catch (error) {
        console.error(error);
        showToast("Failed to place order.", "error");
        
        btn.innerText = originalText;
        btn.disabled = false;
        btn.classList.remove('btn-loading');
    }
}

// Syncs the Service dropdown so users can't pick Panel One with a Raja Service ID
// Swaps out the available services depending on the chosen provider
function syncSmmDropdowns(videoId) {
    const provider = document.getElementById(`smm-provider-${videoId}`).value;
    const serviceSelect = document.getElementById(`smm-service-${videoId}`);
    
    if (provider === 'smmRaja') {
        serviceSelect.innerHTML = `
            <option value="1224">ꚠ - Views (Raja)</option>
            <option value="2150">ꚠ - Likes (Raja)</option>
        `;
    } else if (provider === 'smmPanelOne') {
        serviceSelect.innerHTML = `
            <option value="8429">ꚠ - Views (Panel1)</option>
            <option value="12981">ꚠ - Likes (Panel1)</option>
        `;
    }
}

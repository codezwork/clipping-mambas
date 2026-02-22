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
async function submitSmmOrder(e, videoId, videoLink) {
    e.stopPropagation();
    
    const serviceSelect = document.getElementById(`smm-service-${videoId}`);
    const service = serviceSelect.value;
    // NEW: Grab the actual text ("ꚠ - Views") and strip out the icon for a clean log
    const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.replace('ꚠ - ', '').trim();
    
    const quantity = document.getElementById(`smm-quantity-${videoId}`).value;
    const btn = document.getElementById(`smm-send-btn-${videoId}`);

    if (!quantity || quantity <= 0) {
        showToast("Please enter a valid quantity", "error");
        return;
    }

    // 1. Instant UI Feedback (Solves the Render 45s delay risk)
    const originalText = btn.innerText;
    btn.innerText = "ORDERED...";
    btn.disabled = true;
    btn.classList.add('btn-loading');

    // 2. Format the Date and the Details (e.g., "20 - 11:12 AM (100 Views)")
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
                quantity: quantity
            })
        });

        if (response.ok) {
            showToast("Order placed successfully!", "success");
            
            // 3. Save the NEW formatted log to Firestore so it persists on reload
            await db.collection('videos').doc(videoId).update({
                lastSmmOrder: fullLogDetails
            });
            
            // The UI will automatically re-render via the Firestore listener!
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
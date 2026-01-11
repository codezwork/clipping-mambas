// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbw3f4AdTSvWfwVCssMXZ2SWq0ilYOx_yt0kbO85dRuZQdI9ZrquJgJRZMt_wrVOgdiX/exec"; 

// --- STATE MANAGEMENT ---
let appData = [];
let currentUser = "";
let currentPlatform = "Instagram"; // Default
let isLoading = false;

// --- DEBOUNCE UTILITY ---
let debounceTimer;
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️'}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3000);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Add toast styles dynamically
    const toastStyles = document.createElement('style');
    toastStyles.textContent = `
        .toast-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1a1a1a;
            border-left: 4px solid #ff4444;
            border-radius: 4px;
            padding: 12px 16px;
            color: white;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            animation: slideIn 0.3s ease;
            max-width: 320px;
        }
        .toast-success { border-color: #2ecc71; }
        .toast-error { border-color: #ff4444; }
        .toast-info { border-color: #3498db; }
        .toast-icon { font-size: 18px; }
        .toast-message { flex: 1; font-size: 14px; }
        .toast-close {
            background: none;
            border: none;
            color: #666;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(toastStyles);
});

// --- NAVIGATION FUNCTIONS ---
function openDashboard(user) {
    currentUser = user;
    document.getElementById('current-user-name').innerText = user.toUpperCase();
    
    // Switch Views
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.add('active');

    fetchData(); // Load data from sheet
}

function goHome() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    appData = []; // Clear data
}

function switchPlatform(platform, element) {
    currentPlatform = platform;
    
    // Update Tabs UI
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    renderDashboard();
}

// --- DATA HANDLING ---
async function fetchData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        appData = data;
        renderDashboard();
        showToast('Data loaded successfully', 'success');
    } catch (error) {
        showToast('Error loading data. Check internet connection.', 'error');
        console.error('Fetch error:', error);
    }
    showLoading(false);
}

function renderDashboard() {
    const container = document.getElementById('profiles-container');
    container.innerHTML = "";

    // 1. Filter Data for Current User & Platform
    const filteredData = appData.filter(item => 
        item.person === currentUser && item.platform === currentPlatform
    );

    // 2. Group by Profile Name
    const grouped = {};
    ["Profile 1", "Profile 2", "Profile 3"].forEach(p => grouped[p] = []);
    
    filteredData.forEach(item => {
        if (!grouped[item.profile]) grouped[item.profile] = [];
        grouped[item.profile].push(item);
    });

    // 3. Render Each Profile Section
    Object.keys(grouped).forEach(profileName => {
        const videos = grouped[profileName];
        
        // Calculate Progress
        const total = videos.length;
        const uploaded = videos.filter(v => v.status === "Uploaded").length;
        const progressPct = total === 0 ? 0 : (uploaded / total) * 100;

        // Create HTML Section
        const section = document.createElement('div');
        section.className = 'profile-section';
        
        section.innerHTML = `
            <div class="profile-header">
                <h3 style="color:#fff; font-size: 16px;">${profileName}</h3>
                <span style="color:#666; font-size: 12px;">${uploaded}/${total} Uploaded</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${progressPct}%"></div>
            </div>
            <div class="video-list">
                ${videos.map(video => createVideoRow(video)).join('')}
                ${videos.length === 0 ? '<p style="color:#444; font-size:12px; font-style:italic;">No videos yet.</p>' : ''}
            </div>
        `;
        container.appendChild(section);
    });
}

function createVideoRow(video) {
    const isUploaded = video.status === "Uploaded";
    const statusClass = isUploaded ? 'status-uploaded' : 'status-reviewed';
    
    return `
        <div class="video-item">
            <div class="video-info">
                <h4>${video.title}</h4>
                <a href="${video.link}" target="_blank">Watch Video &#8599;</a>
            </div>
            <div class="video-actions">
                <div class="status-badge ${statusClass}" onclick="debouncedToggleStatus('${video.id}', '${video.status}')">
                    ${video.status}
                </div>
                <button class="icon-btn copy-btn" onclick="copyLink('${video.link}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M16 12.9V17.1C16 20.6 14.6 22 11.1 22H6.9C3.4 22 2 20.6 2 17.1V12.9C2 9.4 3.4 8 6.9 8H11.1C14.6 8 16 9.4 16 12.9Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M22 6.9V11.1C22 14.6 20.6 16 17.1 16H16V12.9C16 9.4 14.6 8 11.1 8H8V6.9C8 3.4 9.4 2 12.9 2H17.1C20.6 2 22 3.4 22 6.9Z" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </button>
                <button class="icon-btn delete-btn" onclick="deleteVideo('${video.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M21 5.98C17.67 5.65 14.32 5.48 10.98 5.48C9 5.48 7.02 5.58 5.04 5.78L3 5.98M8.5 4.97L8.72 3.66C8.88 2.71 9 2 10.69 2H13.31C15 2 15.13 2.75 15.28 3.67L15.5 4.97M18.85 9.14L18.2 19.21C18.09 20.78 18 22 15.21 22H8.79C6 22 5.91 20.78 5.8 19.21L5.15 9.14M10.33 16.5H13.66M9.5 12.5H14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// --- DEBOUNCED ACTIONS ---
const debouncedToggleStatus = debounce(async function(id, currentStatus) {
    const newStatus = currentStatus === "Uploaded" ? "Reviewed" : "Uploaded";
    
    // Optimistic Update
    const videoIndex = appData.findIndex(v => String(v.id) === String(id));
    if(videoIndex > -1) {
        appData[videoIndex].status = newStatus;
        renderDashboard();
        showToast(`Status changed to ${newStatus}`, 'success');
    }

    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "updateStatus",
                id: id,
                newStatus: newStatus
            })
        });
    } catch (error) {
        showToast('Failed to update status', 'error');
        // Revert optimistic update on error
        if(videoIndex > -1) {
            appData[videoIndex].status = currentStatus;
            renderDashboard();
        }
    }
}, 300);

// --- ACTIONS (CRUD) ---
async function submitNewVideo() {
    const profile = document.getElementById('new-profile-select').value;
    const title = document.getElementById('new-title').value.trim();
    const link = document.getElementById('new-link').value.trim();
    
    if(!title || !link) {
        showToast('Please fill all fields', 'error');
        return;
    }

    toggleAddModal(false);
    showLoading(true);

    const newVideo = {
        action: "create",
        id: Date.now().toString(),
        person: currentUser,
        platform: currentPlatform,
        profile: profile,
        title: title,
        link: link
    };

    // Optimistic Update
    appData.push({...newVideo, status: "Reviewed"});
    renderDashboard();

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(newVideo)
        });
        
        if (!response.ok) throw new Error('Failed to save');
        
        showToast('Video added successfully!', 'success');
        document.getElementById('new-title').value = "";
        document.getElementById('new-link').value = "";
    } catch (error) {
        showToast('Failed to save video', 'error');
        // Remove from local data on error
        appData = appData.filter(v => v.id !== newVideo.id);
        renderDashboard();
    }

    showLoading(false);
}

async function deleteVideo(id) {
    if(!confirm("Are you sure you want to delete this video?")) return;

    // Store video for rollback
    const deletedVideo = appData.find(v => String(v.id) === String(id));
    
    // Optimistic Update
    appData = appData.filter(v => String(v.id) !== String(id));
    renderDashboard();

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "delete",
                id: id
            })
        });
        
        if (!response.ok) throw new Error('Failed to delete');
        showToast('Video deleted', 'success');
    } catch (error) {
        showToast('Failed to delete video', 'error');
        // Rollback on error
        if (deletedVideo) {
            appData.push(deletedVideo);
            renderDashboard();
        }
    }
}

// --- UTILITIES ---
function toggleAddModal(show) {
    const modal = document.getElementById('add-modal');
    if(show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

async function copyLink(link) {
    try {
        await navigator.clipboard.writeText(link);
        showToast('Link copied to clipboard!', 'success');
    } catch (error) {
        showToast('Failed to copy link', 'error');
    }
}

function showLoading(show) {
    const dot = document.getElementById('loading-indicator');
    if(show) {
        dot.style.background = "#ff4444";
        dot.style.boxShadow = "0 0 10px #ff4444";
        dot.innerHTML = `
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <path d="M12 2V6" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 18V22" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M4.93 4.93L7.76 7.76" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M16.24 16.24L19.07 19.07" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M2 12H6" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M18 12H22" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M4.93 19.07L7.76 16.24" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
                <path d="M16.24 7.76L19.07 4.93" stroke="#ff4444" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
    } else {
        dot.style.background = "transparent";
        dot.style.boxShadow = "none";
        dot.innerHTML = "";
    }
}
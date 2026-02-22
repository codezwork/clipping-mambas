//
// --- CONFIGURATION ---
// PASTE YOUR FIREBASE CONFIG HERE FROM CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDqI6yHiHJ7Ao257KmVaTSOPJ7C3hd9V7U",
  authDomain: "mambaclippers.firebaseapp.com",
  projectId: "mambaclippers",
  storageBucket: "mambaclippers.firebasestorage.app",
  messagingSenderId: "400915321062",
  appId: "1:400915321062:web:8a8ee616725d40ea47eb27"
};

// --- BACKEND URL ---
// REPLACE THIS WITH YOUR ACTUAL RENDER URL AFTER DEPLOYING
const BACKEND_URL = "https://mamba-clippers-backend-views-scrapper.onrender.com/refresh-stats";

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- STATE MANAGEMENT ---
let appData = [];
let currentUser = "";
let currentPlatform = "TikTok"; 
let isLoading = false;
let profileConfig = {};
let passwordsData = {};
let unsubscribeVideos = null;
let currentEditingId = null;
let currentSortOrder = "newest"; 

// --- SELECTION MODE STATE (NEW) ---
let isSelectionMode = false;
let selectedVideoIds = new Set();
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

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
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'error' ? '⚠️' : type === 'success' ? '✓' : 'ℹ️'}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3000);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const toastStyles = document.createElement('style');
    toastStyles.textContent = `
        .toast-notification {
            position: fixed; top: 20px; right: 20px; background: #1a1a1a;
            border-left: 4px solid #ff4444; border-radius: 4px; padding: 12px 16px;
            color: white; display: flex; align-items: center; gap: 12px;
            z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            animation: slideIn 0.3s ease; max-width: 320px;
        }
        .toast-success { border-color: #2ecc71; }
        .toast-error { border-color: #ff4444; }
        .toast-info { border-color: #3498db; }
        .toast-icon { font-size: 18px; }
        .toast-message { flex: 1; font-size: 14px; }
        .toast-close { background: none; border: none; color: #666; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    document.head.appendChild(toastStyles);

    // Global listener to close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });
});

// --- NAVIGATION FUNCTIONS ---
function openDashboard(user) {
    currentUser = user;
    document.getElementById('current-user-name').innerText = user.toUpperCase();
    
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.add('active');

    fetchData(); 
}

function goHome() {
    exitSelectionMode(); // Ensure we exit mode when leaving
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    appData = [];
    
    if (unsubscribeVideos) {
        unsubscribeVideos();
        unsubscribeVideos = null;
    }
}

function switchPlatform(platform, element) {
    exitSelectionMode(); // Reset selection on tab switch
    currentPlatform = platform;
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    renderDashboard();
}

// --- DATA HANDLING (FIRESTORE) ---
async function fetchData() {
  showLoading(true);
  try {
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (settingsDoc.exists) {
        profileConfig = settingsDoc.data().profileConfig || {};
    }

    const passwordsSnapshot = await db.collection('passwords log').get();
    passwordsData = {};
    passwordsSnapshot.forEach(doc => {
        passwordsData[doc.id] = doc.data();
    });

    if (unsubscribeVideos) unsubscribeVideos();

    unsubscribeVideos = db.collection('videos')
        .where('person', '==', currentUser)
        .onSnapshot((snapshot) => {
            appData = [];
            snapshot.forEach((doc) => {
                appData.push({ ...doc.data(), id: doc.id });
            });
            renderDashboard();
            showLoading(false);
        }, (error) => {
            console.error("Firestore Error:", error);
            showToast('Error syncing data.', 'error');
            showLoading(false);
        });

  } catch (error) {
    showToast('Error loading data.', 'error');
    console.error('Fetch error:', error);
    showLoading(false);
  }
}

// 1. DYNAMIC PROFILE FETCHER
function getProfileData() {
    let config = {};
    if (profileConfig[currentUser] && profileConfig[currentUser][currentPlatform]) {
        config = profileConfig[currentUser][currentPlatform];
    }

    // Count how many 'profileX' keys exist in Firebase, default to at least 3
    const profileKeys = Object.keys(config).filter(k => k.startsWith('profile'));
    let count = Math.max(3, profileKeys.length); 

    const profiles = [];
    for (let i = 1; i <= count; i++) {
        profiles.push({
            key: `Profile ${i}`,       // E.g., "Profile 4" (Used for Dropdowns/UI)
            dbKey: `profile${i}`,      // E.g., "profile4" (Used for Firestore)
            name: config[`profile${i}`] || `Profile ${i}` // Display Name
        });
    }
    return profiles;
}

// 2. UPDATED DROPDOWNS
function updateProfileDropdown() {
    const select = document.getElementById('new-profile-select');
    if (!select) return;
    select.innerHTML = '';
    getProfileData().forEach(p => {
        const option = document.createElement('option');
        option.value = p.key; 
        option.textContent = p.name;
        select.appendChild(option);
    });
}

function updateEditProfileDropdown() {
    const select = document.getElementById('edit-profile-select');
    if (!select) return;
    select.innerHTML = '';
    getProfileData().forEach(p => {
        const option = document.createElement('option');
        option.value = p.key; 
        option.textContent = p.name;
        select.appendChild(option);
    });
}


function formatViews(n) {
    if (!n) return '0';
    if (n < 1000) return n;
    if (n < 1000000) return (n / 1000).toFixed(1) + 'K';
    return (n / 1000000).toFixed(1) + 'M';
}

function toggleSortMenu() {
    const menu = document.getElementById('sort-menu');
    if(menu) menu.classList.toggle('hidden');
}

function setSort(order) {
    currentSortOrder = order;
    toggleSortMenu();
    renderDashboard();
    
    const btnSpan = document.querySelector('#sort-btn span');
    if(btnSpan) {
        if(order === 'newest') btnSpan.innerText = 'NEWEST';
        else if(order === 'oldest') btnSpan.innerText = 'OLDEST';
        else if(order === 'views') btnSpan.innerText = 'VIEWS';
        else if(order === 'name') btnSpan.innerText = 'A-Z';
    }
}

function sortVideos(videos) {
    return videos.sort((a, b) => {
        if (currentSortOrder === 'views') {
            const vA = a.views ? parseInt(a.views) : 0;
            const vB = b.views ? parseInt(b.views) : 0;
            return vB - vA;
        } else if (currentSortOrder === 'name') {
            return a.title.localeCompare(b.title);
        } else if (currentSortOrder === 'oldest') {
            const tA = a.createdAt ? a.createdAt.seconds : 0;
            const tB = b.createdAt ? b.createdAt.seconds : 0;
            return tA - tB;
        } else {
            const tA = a.createdAt ? a.createdAt.seconds : 0;
            const tB = b.createdAt ? b.createdAt.seconds : 0;
            return tB - tA;
        }
    });
}

// --- NEW: LONG PRESS & SELECTION LOGIC ---

function handleRowTouchStart(e, id) {
    if (isSelectionMode) return; // If already in mode, handle as normal click/toggle
    
    longPressTimer = setTimeout(() => {
        enterSelectionMode(id);
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
    }, LONG_PRESS_DURATION);
}

function handleRowTouchEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function handleRowTouchMove(e) {
    // If user scrolls, cancel long press
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

// Desktop mouse events (for testing on desktop)
function handleRowMouseDown(e, id) {
    if (isSelectionMode) return;
    // Only left click
    if (e.button !== 0) return;
    
    longPressTimer = setTimeout(() => {
        enterSelectionMode(id);
    }, LONG_PRESS_DURATION);
}

function handleRowMouseUp(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function handleRowClick(e, id) {
    // If not in selection mode, normal behavior (bubble up to links etc)
    // If IS in selection mode, toggle selection
    if (isSelectionMode) {
        e.preventDefault();
        e.stopPropagation(); // Stop link clicks
        toggleSelection(id);
    }
}

function enterSelectionMode(initialId) {
    isSelectionMode = true;
    selectedVideoIds.clear();
    toggleSelection(initialId);
    
    document.body.classList.add('selection-mode');
    
    // Switch Navbar
    document.getElementById('nav-logo-group').classList.add('hidden');
    document.getElementById('selection-actions').classList.remove('hidden');
    
    // Update UI immediately (add classes to rows)
    renderDashboard(); // Re-render to show checkboxes state
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedVideoIds.clear();
    
    document.body.classList.remove('selection-mode');
    
    // Switch Navbar Back
    document.getElementById('nav-logo-group').classList.remove('hidden');
    document.getElementById('selection-actions').classList.add('hidden');
    
    // Reset FAB
    const fab = document.getElementById('main-fab');
    fab.innerText = "+ ADD VIDEO";
    fab.classList.remove('fab-delete-mode');
    
    renderDashboard();
}

function toggleSelection(id) {
    if (selectedVideoIds.has(id)) {
        selectedVideoIds.delete(id);
    } else {
        selectedVideoIds.add(id);
    }
    
    // If all deselected, should we exit mode? Optional. Lets keep it active.
    if (selectedVideoIds.size === 0) {
        // Optional: exitSelectionMode(); 
    }
    
    updateSelectionUI();
}

function updateSelectionUI() {
    // Update individual row styles without full re-render
    document.querySelectorAll('.video-item').forEach(row => {
        const id = row.id.replace('video-', '');
        const checkbox = row.querySelector('.selection-checkbox');
        
        if (selectedVideoIds.has(id)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    // Update FAB
    const fab = document.getElementById('main-fab');
    const count = selectedVideoIds.size;
    
    if (count > 0) {
        fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> DELETE (${count})`;
        fab.classList.add('fab-delete-mode');
    } else {
        fab.innerHTML = "SELECT ITEMS";
        fab.classList.remove('fab-delete-mode');
    }
}

// Global FAB Handler
function handleFabClick() {
    if (isSelectionMode) {
        if (selectedVideoIds.size > 0) {
            deleteSelectedVideos();
        } else {
            showToast("Select videos to delete", "info");
        }
    } else {
        toggleAddModal(true);
    }
}

async function deleteSelectedVideos() {
    if (!confirm(`Are you sure you want to delete ${selectedVideoIds.size} videos?`)) return;
    
    showLoading(true);
    const batch = db.batch();
    
    selectedVideoIds.forEach(id => {
        const ref = db.collection('videos').doc(id);
        batch.delete(ref);
    });
    
    try {
        await batch.commit();
        showToast(`Deleted ${selectedVideoIds.size} videos.`, 'success');
        exitSelectionMode();
    } catch (error) {
        showToast("Error deleting videos.", "error");
        console.error(error);
    }
    showLoading(false);
}


// --- RENDER DASHBOARD (UPDATED) ---
function renderDashboard() {
    const container = document.getElementById('profiles-container');
    container.innerHTML = "";

    const profiles = getProfileData(); // Get dynamic array of profiles
    const filteredData = appData.filter(item => item.platform === currentPlatform);

    // Initialize groupings dynamically
    const grouped = {};
    profiles.forEach(p => grouped[p.key] = []); 
    
    filteredData.forEach(item => {
        if (grouped[item.profile]) {
            grouped[item.profile].push(item);
        } else {
            // Failsafe: if a video belongs to a profile that was somehow removed
            grouped[item.profile] = [item]; 
        }
    });

    // Loop through dynamic profiles
    profiles.forEach((p, index) => {
        let videos = grouped[p.key] || [];
        const displayName = p.name;
        
        videos = sortVideos(videos);

        // ... Keep everything else in renderDashboard exactly the same from here down!

        const total = videos.length;
        const approved = videos.filter(v => v.status === "Approved").length;
        const progressPct = total === 0 ? 0 : (approved / total) * 100;

        const totalProfileViews = videos.reduce((acc, curr) => {
            const v = curr.views ? parseInt(curr.views) : 0;
            return acc + v;
        }, 0);
        
        const formattedTotalViews = formatViews(totalProfileViews);

        const section = document.createElement('div');
        section.className = 'profile-section';
        
        section.innerHTML = `
            <div class="profile-header">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <h3 style="color:#fff; font-size: 16px;">${displayName}</h3>
                    
                    <button class="icon-btn edit-btn" onclick="openProfileSettings(${index})" style="padding: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M11 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M16.04 3.02001L8.16 10.9C7.86 11.2 7.56 11.79 7.5 12.22L7.07 15.23C6.91 16.32 7.68 17.08 8.77 16.93L11.78 16.5C12.2 16.44 12.79 16.14 13.1 15.84L20.98 7.96001C22.34 6.60001 22.98 5.02001 20.98 3.02001C18.98 1.02001 17.4 1.66001 16.04 3.02001Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14.91 4.15002C15.58 6.54002 17.45 8.41002 19.85 9.09002" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>

                    <div class="total-views-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        ${formattedTotalViews}
                    </div>

                </div>
                <span style="color:#666; font-size: 12px;">${approved}/${total} Approved</span>
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
    
    updateProfileDropdown();
    // After render, make sure UI matches selection state
    if(isSelectionMode) updateSelectionUI();
}

function createVideoRow(video) {
    const isApproved = video.status === "Approved";
    const isRejected = video.status === "Rejected";
    
    // Class determination
    let statusClass = 'status-pending';
    if (isApproved) statusClass = 'status-approved';
    if (isRejected) statusClass = 'status-rejected';
    
    // Check if selected
    const isSelected = selectedVideoIds.has(video.id);

    const viewsDisplay = video.views !== undefined 
        ? `<span class="view-count">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
             ${formatViews(video.views)}
           </span>`
        : '';

    // NEW: Likes Display (using a heart SVG)
    const likesDisplay = video.likes !== undefined 
        ? `<span class="view-count" title="Likes" style="margin-left: 12px;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
             ${formatViews(video.likes)}
           </span>`
        : '';

    // Grab the raw number of views (fallback to 0 if undefined)
    const rawViews = video.views ? parseInt(video.views) : 0;

    // Calculate the money! 
    // Note: If your multiplier is $1.50 per 1000 views (RPM), use: (rawViews / 1000) * 1.5
    // If it is literally $1.50 per single view, keep it as: rawViews * 1.5
    const estimatedRevenue = (rawViews / 1000) * 1.5; // Adjusted for standard RPM, change if needed!

    // Create a stylish green money badge (only shows if revenue is > $0)
    const revenueBadge = estimatedRevenue > 0 
        ? `<span style="color: #ffa500; font-size: 14px; margin-left: 24px; font-weight: bold; margin-bottom: 4px">
            $${estimatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>`
        : '';

    // ADDED: Events for long press, ID for selection logic, Checkbox HTML
    return `
        <div class="video-item ${isSelected ? 'selected' : ''}" 
             id="video-${video.id}"
             oncontextmenu="return false;"
             ontouchstart="handleRowTouchStart(event, '${video.id}')"
             ontouchend="handleRowTouchEnd(event)"
             ontouchmove="handleRowTouchMove(event)"
             onmousedown="handleRowMouseDown(event, '${video.id}')"
             onmouseup="handleRowMouseUp(event)"
             onclick="handleRowClick(event, '${video.id}')"
        >
            
            <div style="display: flex; width: 100%; align-items: center;">
                <div class="selection-checkbox">
                    <div class="checkbox-circle"></div>
                </div>

                <div class="video-info">
                    <div style="display: flex; align-items: center;">
                       <h4>${video.title}</h4>
                       ${revenueBadge}
                    </div>
                    <div style="display: flex; align-items: center; margin-top: 2px;">
                        ${viewsDisplay}
                        ${likesDisplay}
                    </div>
                </div>
                
                <div class="video-actions">
                    <div class="status-badge ${statusClass}" onclick="debouncedToggleStatus('${video.id}', '${video.status}')">
                        ${video.status}
                    </div>

                    <button class="icon-btn" onclick="toggleSmmPanel(event, '${video.id}')" style="color: #2ecc71; border-color: rgba(46, 204, 113, 0.3);" title="Boost Video">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </button>

                    <div class="dropdown-container">
                        <button class="icon-btn delete-btn" onclick="toggleDropdown('${video.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M3 7H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                <path d="M3 12H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                <path d="M3 17H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                        
                        <div id="dropdown-${video.id}" class="dropdown-menu hidden">

                             <div class="dropdown-item item-edit" onclick="openEditVideoModal('${video.id}')">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                 </svg>
                                 Edit Details
                             </div>
                             
                             <div class="dropdown-item item-rejected" onclick="markAsRejected('${video.id}')">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                 </svg>
                                 Rejected
                             </div>
                             <div class="dropdown-item item-delete" onclick="deleteVideo('${video.id}')">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                 </svg>
                                 Delete
                             </div>

                             <a href="${video.link}" target="_blank" class="dropdown-item" style="text-decoration: none;">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                 </svg>
                                 Watch Video
                             </a>
                        </div>
                    </div>

                </div>
            </div>

            <div id="smm-panel-${video.id}" class="smm-panel hidden">
                <select id="smm-service-${video.id}" class="smm-input smm-select">
                    <option value="1224">ꚠ - Views</option>
                    <option value="2150">ꚠ - Likes</option>
                </select>
                
                <input type="number" id="smm-quantity-${video.id}" class="smm-input smm-quantity" placeholder="Qty (e.g. 100)">
                
                <button id="smm-send-btn-${video.id}" class="cta-button smm-send-btn" onclick="submitSmmOrder(event, '${video.id}', '${video.link}')">SEND</button>
                
                <div class="smm-log" id="smm-log-${video.id}">
                    Last: ${video.lastSmmOrder ? video.lastSmmOrder : 'Never'}
                </div>
            </div>
        </div>
    `;
}

// --- REFRESH STATS FUNCTION (NEW) ---
async function refreshStats() {
    const btn = document.getElementById('refresh-btn');
    const btnText = btn.querySelector('span');
    const originalText = btnText.innerText;
    
    // 1. Get List of Videos to Update
    const videosToUpdate = appData.filter(v => v.link && v.link.startsWith('http'));

    if (videosToUpdate.length === 0) {
        showToast("No videos found to update.", "info");
        return;
    }

    // 2. Enter Loading State
    btn.classList.add('refresh-loading');
    btn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;

    // 3. Loop through videos one by one
    for (let i = 0; i < videosToUpdate.length; i++) {
        const video = videosToUpdate[i];
        btnText.innerText = `Checking ${i + 1}/${videosToUpdate.length}...`;

        try {
            const rootUrl = BACKEND_URL.replace('/refresh-stats', ''); 
            const targetUrl = `${rootUrl}/check-video`;

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: video.id,
                    url: video.link
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
                console.warn(`Failed to update ${video.title}`);
            }

        } catch (error) {
            console.error(`Error updating ${video.title}:`, error);
            failCount++;
        }
        
        await new Promise(r => setTimeout(r, 500));
    }

    // 4. Reset Button State & Show Summary
    btn.classList.remove('refresh-loading');
    btn.disabled = false;
    btnText.innerText = originalText;

    if (successCount > 0) {
        showToast(`Updated ${successCount} videos! (${failCount} skipped)`, 'success');
    } else {
        showToast('Update finished, but no videos changed.', 'info');
    }
}

// --- ACTIONS (CRUD) ---

// Toggle Dropdown Visibility
function toggleDropdown(id) {
    if (isSelectionMode) return; // Disable in selection mode
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if(menu.id !== `dropdown-${id}`) menu.classList.add('hidden');
    });

    const menu = document.getElementById(`dropdown-${id}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Mark as Rejected
async function markAsRejected(id) {
    try {
        await db.collection('videos').doc(id).update({
            status: "Rejected"
        });
        showToast('Status updated to Rejected', 'info');
    } catch (error) {
        showToast('Failed to update status', 'error');
        console.error(error);
    }
    const menu = document.getElementById(`dropdown-${id}`);
    if(menu) menu.classList.add('hidden');
}

const debouncedToggleStatus = debounce(async function(id, currentStatus) {
    if (isSelectionMode) return; // Disable in selection mode

    let newStatus = "Approved";
    
    if (currentStatus === "Approved") {
        newStatus = "Pending";
    } else if (currentStatus === "Pending") {
        newStatus = "Approved";
    } else if (currentStatus === "Rejected") {
        newStatus = "Approved";
    }
    
    try {
        await db.collection('videos').doc(id).update({
            status: newStatus
        });
        showToast(`Status updated to ${newStatus}`, 'success');
    } catch (error) {
        showToast('Failed to update status', 'error');
        console.error(error);
    }
}, 300);

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
        person: currentUser,
        platform: currentPlatform,
        profile: profile,
        title: title,
        link: link,
        status: "Pending", 
        views: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // NEW: Save timestamp
    };

    try {
        await db.collection('videos').add(newVideo);
        showToast('Video added successfully!', 'success');
        document.getElementById('new-title').value = "";
        document.getElementById('new-link').value = "";
    } catch (error) {
        showToast('Failed to save video', 'error');
        console.error(error);
    }
    showLoading(false);
}

// --- NEW EDIT FUNCTIONS ---

function openEditVideoModal(id) {
    // 1. Find the video in appData
    const video = appData.find(v => v.id === id);
    if (!video) {
        showToast("Error finding video data", "error");
        return;
    }

    // 2. Set global currentEditingId
    currentEditingId = id;

    // 3. Populate inputs
    updateEditProfileDropdown(); // Ensure dropdown has correct options
    document.getElementById('edit-profile-select').value = video.profile;
    document.getElementById('edit-title').value = video.title;
    document.getElementById('edit-link').value = video.link;

    // 4. Show Modal
    // Hide the dropdown menu first
    // toggleDropdown(id); // Dropdown logic might conflict, just hide all
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    
    toggleEditVideoModal(true);
}

function toggleEditVideoModal(show) {
    const modal = document.getElementById('edit-video-modal');
    if(show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

async function saveVideoEdit() {
    if (!currentEditingId) return;

    const profile = document.getElementById('edit-profile-select').value;
    const title = document.getElementById('edit-title').value.trim();
    const link = document.getElementById('edit-link').value.trim();
    
    if(!title || !link) {
        showToast('Please fill all fields', 'error');
        return;
    }

    toggleEditVideoModal(false);
    showLoading(true);

    try {
        await db.collection('videos').doc(currentEditingId).update({
            profile: profile,
            title: title,
            link: link
        });
        showToast('Video details updated!', 'success');
    } catch (error) {
        showToast('Failed to update video', 'error');
        console.error(error);
    }
    showLoading(false);
    currentEditingId = null;
}


async function deleteVideo(id) {
    if(!confirm("Are you sure you want to delete this video?")) return;

    try {
        await db.collection('videos').doc(id).delete();
        showToast('Video deleted', 'success');
    } catch (error) {
        showToast('Failed to delete video', 'error');
        console.error(error);
    }
}

// --- PROFILE SETTINGS FUNCTIONS ---
// --- DYNAMIC PROFILE SETTINGS FUNCTIONS ---
function openProfileSettings(profileIndex = null) {
    const modal = document.getElementById('profile-settings-modal');
    const container = document.getElementById('dynamic-profile-inputs');
    container.innerHTML = ''; // Clear old inputs
    
    const profiles = getProfileData();
    
    // Generate inputs dynamically
    profiles.forEach((p, i) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `profile-name-${i + 1}`;
        input.value = p.name;
        input.placeholder = `Profile ${i + 1} Name`;
        input.className = 'mamba-input';
        container.appendChild(input);
    });
    
    modal.classList.remove('hidden');
    
    if (profileIndex !== null) {
        setTimeout(() => {
            const el = document.getElementById(`profile-name-${profileIndex + 1}`);
            if (el) el.focus();
        }, 100);
    }
}

// Function triggered by the "+ ADD ANOTHER PROFILE" button
function addNewProfileField() {
    const container = document.getElementById('dynamic-profile-inputs');
    const currentCount = container.querySelectorAll('input').length;
    const newIndex = currentCount + 1;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `profile-name-${newIndex}`;
    input.placeholder = `Profile ${newIndex} Name`;
    input.className = 'mamba-input';
    
    container.appendChild(input);
    input.focus(); // Auto-focus the new field
}

async function saveProfileNames() {
    const inputs = document.querySelectorAll('#dynamic-profile-inputs input');
    const updates = {};
    const localConfig = {};
    
    let hasError = false;
    inputs.forEach((input, index) => {
        const val = input.value.trim();
        if (!val) hasError = true;
        // Build Firebase mapping (e.g., "profile4": "Ganya Gaming")
        updates[`profileConfig.${currentUser}.${currentPlatform}.profile${index + 1}`] = val;
        localConfig[`profile${index + 1}`] = val;
    });
    
    if (hasError) {
        showToast('All profile names must be filled out', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        await db.collection('settings').doc('global').update(updates);
        
        // Update local state instantly
        if (!profileConfig[currentUser]) profileConfig[currentUser] = {};
        profileConfig[currentUser][currentPlatform] = localConfig;
        
        renderDashboard();
        showToast('Profile names updated!', 'success');
        toggleProfileSettingsModal(false);
        
    } catch (error) {
        if (error.code === 'not-found') {
            await db.collection('settings').doc('global').set({
                 profileConfig: { [currentUser]: { [currentPlatform]: localConfig } }
            }, { merge: true });
            renderDashboard();
            showToast('Profile names updated!', 'success');
            toggleProfileSettingsModal(false);
        } else {
            showToast('Failed to update profile names', 'error');
        }
    }
    
    showLoading(false);
}

function toggleProfileSettingsModal(show) {
    const modal = document.getElementById('profile-settings-modal');
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
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
        dot.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ff4444" stroke-width="4" stroke-dasharray="30" stroke-dashoffset="30"></circle></svg>`;
    } else {
        dot.style.background = "transparent";
        dot.style.boxShadow = "none";
        dot.innerHTML = "";
    }
}

function getPlatformLogo(platform) {
  if (platform === 'Instagram') {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    `;
  } else if (platform === 'TikTok') {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  return '';
}

// --- PASSWORD MANAGEMENT ---
function openPasswordsModal() {
  togglePasswordsModal(true);
  renderPasswords();
}

function togglePasswordsModal(show) {
  const modal = document.getElementById('passwords-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}

function renderPasswords() {
  const container = document.getElementById('passwords-container');
  container.innerHTML = '';
  
  const users = Object.keys(passwordsData);
  
  if (users.length === 0) {
      container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #666;">
        <p>No passwords found.</p>
        <p style="font-size: 12px; margin-top: 10px;">Check 'passwords log' collection.</p>
      </div>`;
      return;
  }

  users.forEach(user => {
    const userSection = document.createElement('div');
    userSection.style.marginBottom = '30px';
    
    const userHeader = document.createElement('h4');
    userHeader.textContent = `User : ${user}`;
    userHeader.style.color = '#ff4444';
    userHeader.style.marginBottom = '15px';
    userHeader.style.fontSize = '16px';
    userHeader.style.borderBottom = '1px solid #333';
    userHeader.style.paddingBottom = '5px';
    
    userSection.appendChild(userHeader);
    
    const platforms = ['Instagram', 'TikTok'];
    
    platforms.forEach(platform => {
      if (!passwordsData[user][platform] || passwordsData[user][platform].length === 0) return;
      
      const platformProfiles = passwordsData[user][platform];
      
      platformProfiles.forEach(profileData => {
        const profileDiv = document.createElement('div');
        profileDiv.className = 'password-entry';
        
        const logoDiv = document.createElement('div');
        logoDiv.className = 'platform-logo';
        logoDiv.innerHTML = getPlatformLogo(platform);
        profileDiv.appendChild(logoDiv);
        
        const profileInfo = document.createElement('div');
        profileInfo.className = 'password-info';
        
        const profileName = document.createElement('span');
        profileName.className = 'profile-label';
        profileName.textContent = `${profileData.profileName || 'Not set'}`;
        
        const sep = document.createElement('span');
        sep.innerText = " - ";
        sep.style.color = "#666";

        const passwordSpan = document.createElement('span');
        passwordSpan.className = 'password-text';
        passwordSpan.textContent = profileData.password || '******';
        
        profileInfo.appendChild(profileName);
        profileInfo.appendChild(sep);
        profileInfo.appendChild(passwordSpan);
        profileDiv.appendChild(profileInfo);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-password-btn';
        copyBtn.innerText = "COPY";
        copyBtn.onclick = () => copyPassword(profileData.password);
        profileDiv.appendChild(copyBtn);
        
        userSection.appendChild(profileDiv);
      });
    });
    
    container.appendChild(userSection);
  });
}

function copyPassword(password) {
  if (!password) {
    showToast('No password to copy', 'error');
    return;
  }
  copyLink(password);
}

// --- PWA INSTALLATION LOGIC ---
let deferredPrompt;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error:', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const homeBtn = document.getElementById('install-container-home');
    const settingsBtn = document.getElementById('install-container-settings');
    
    if(homeBtn) homeBtn.classList.remove('hidden');
    if(settingsBtn) settingsBtn.classList.remove('hidden');
});

async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    deferredPrompt = null;
    
    if(outcome === 'accepted'){
        document.getElementById('install-container-home').classList.add('hidden');
        document.getElementById('install-container-settings').classList.add('hidden');
    }
}

window.addEventListener('appinstalled', () => {
    document.getElementById('install-container-home').classList.add('hidden');
    document.getElementById('install-container-settings').classList.add('hidden');
});

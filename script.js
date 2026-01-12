// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbyWEY0gzHGvjjzzEqpzGWxCLDiTaTWmUg5ylx1aCPnAMj6U-WS4fdHDcZPS5TlU2YJU/exec"; 

// --- STATE MANAGEMENT ---
let appData = [];
let currentUser = "";
let currentPlatform = "Instagram"; // Default
let isLoading = false;
let profileConfig = {};
let passwordsData = {};

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
    const result = await response.json();
    appData = result.videos || [];
    profileConfig = result.profileConfig || {};
    passwordsData = result.passwords || {}; // Store passwords data
    renderDashboard();
  } catch (error) {
    showToast('Error loading data. Check internet connection.', 'error');
    console.error('Fetch error:', error);
  }
  showLoading(false);
}

// Helper function to get current profile names
function getCurrentProfileNames() {
    if (profileConfig[currentUser] && profileConfig[currentUser][currentPlatform]) {
        const config = profileConfig[currentUser][currentPlatform];
        return [
            config.profile1 || "Profile 1",
            config.profile2 || "Profile 2", 
            config.profile3 || "Profile 3"
        ];
    }
    return ["Profile 1", "Profile 2", "Profile 3"];
}

// Function to update the dropdown in add modal
function updateProfileDropdown() {
    const select = document.getElementById('new-profile-select');
    if (!select) return;
    
    select.innerHTML = '';
    const profileNames = getCurrentProfileNames();
    
    profileNames.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = `Profile ${index + 1}`; // Keep the original value for backend
        option.textContent = name;
        select.appendChild(option);
    });
}

function renderDashboard() {
    const container = document.getElementById('profiles-container');
    container.innerHTML = "";

    // Get profile names for current user and platform
    const profileNames = getCurrentProfileNames();
    
    // Filter Data for Current User & Platform
    const filteredData = appData.filter(item => 
        item.person === currentUser && item.platform === currentPlatform
    );

    // Group by Profile Name (using the original Profile 1/2/3 as keys)
    const grouped = {};
    ["Profile 1", "Profile 2", "Profile 3"].forEach(p => grouped[p] = []);
    
    filteredData.forEach(item => {
        if (grouped[item.profile]) {
            grouped[item.profile].push(item);
        }
    });

    // Render Each Profile Section with dynamic names
    ["Profile 1", "Profile 2", "Profile 3"].forEach((profileKey, index) => {
        const videos = grouped[profileKey];
        const displayName = profileNames[index];
        
        // Calculate Progress
        const total = videos.length;
        const uploaded = videos.filter(v => v.status === "Uploaded").length;
        const progressPct = total === 0 ? 0 : (uploaded / total) * 100;

        // Create HTML Section
        const section = document.createElement('div');
        section.className = 'profile-section';
        
        section.innerHTML = `
            <div class="profile-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h3 style="color:#fff; font-size: 16px;">${displayName}</h3>
                    <button class="icon-btn edit-btn" onclick="openProfileSettings(${index})" style="padding: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M11 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M16.04 3.02001L8.16 10.9C7.86 11.2 7.56 11.79 7.5 12.22L7.07 15.23C6.91 16.32 7.68 17.08 8.77 16.93L11.78 16.5C12.2 16.44 12.79 16.14 13.1 15.84L20.98 7.96001C22.34 6.60001 22.98 5.02001 20.98 3.02001C18.98 1.02001 17.4 1.66001 16.04 3.02001Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14.91 4.15002C15.58 6.54002 17.45 8.41002 19.85 9.09002" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
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
    
    // Update the dropdown in add modal
    updateProfileDropdown();
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

// --- PROFILE SETTINGS FUNCTIONS ---
function openProfileSettings(profileIndex = null) {
    const modal = document.getElementById('profile-settings-modal');
    const profileNames = getCurrentProfileNames();
    
    // Fill the input fields with current names
    document.getElementById('profile-name-1').value = profileNames[0];
    document.getElementById('profile-name-2').value = profileNames[1];
    document.getElementById('profile-name-3').value = profileNames[2];
    
    modal.classList.remove('hidden');
    
    // Focus on specific profile if index provided
    if (profileIndex !== null) {
        setTimeout(() => {
            document.getElementById(`profile-name-${profileIndex + 1}`).focus();
        }, 100);
    }
}

function toggleProfileSettingsModal(show) {
    const modal = document.getElementById('profile-settings-modal');
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

async function saveProfileNames() {
    const profile1 = document.getElementById('profile-name-1').value.trim();
    const profile2 = document.getElementById('profile-name-2').value.trim();
    const profile3 = document.getElementById('profile-name-3').value.trim();
    
    // Validate names
    if (!profile1 || !profile2 || !profile3) {
        showToast('All profile names are required', 'error');
        return;
    }
    
    showLoading(true);
    
    const profileData = {
        action: "updateProfileNames",
        user: currentUser,
        platform: currentPlatform,
        profileNames: {
            profile1: profile1,
            profile2: profile2,
            profile3: profile3
        }
    };
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) throw new Error('Failed to save');
        
        // Update local config
        if (!profileConfig[currentUser]) profileConfig[currentUser] = {};
        profileConfig[currentUser][currentPlatform] = {
            profile1: profile1,
            profile2: profile2,
            profile3: profile3
        };
        
        // Re-render dashboard with new names
        renderDashboard();
        
        showToast('Profile names updated!', 'success');
        toggleProfileSettingsModal(false);
        
    } catch (error) {
        showToast('Failed to update profile names', 'error');
        console.error('Error saving profile names:', error);
    }
    
    showLoading(false);
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

//-- Function to get platform logo SVG --
function getPlatformLogo(platform) {
  if (platform === 'Instagram') {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
        <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" 
          stroke="#ff4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 16V8C3 5.23858 5.23858 3 8 3H16C18.7614 3 21 5.23858 21 8V16C21 18.7614 18.7614 21 16 21H8C5.23858 21 3 18.7614 3 16Z" 
          stroke="#ff4444" stroke-width="1.5"/>
        <path d="M17.5 6.51L17.51 6.49889" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  } else if (platform === 'TikTok') {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
        <path d="M21 8C19 8 17.5 6.5 17.5 4.5V4H15.5V12C15.5 15.03 13.03 17.5 10 17.5C6.97 17.5 4.5 15.03 4.5 12C4.5 8.97 6.97 6.5 10 6.5C10.5 6.5 11 6.6 11.5 6.7V4.7C11 4.5 10.5 4.5 10 4.5C5.86 4.5 2.5 7.86 2.5 12C2.5 16.14 5.86 19.5 10 19.5C14.14 19.5 17.5 16.14 17.5 12V8H21Z" 
          fill="#ff4444"/>
      </svg>
    `;
  }
  return '';
}

// Add function to open passwords modal
function openPasswordsModal() {
  togglePasswordsModal(true);
  renderPasswords();
}

// Add function to toggle passwords modal
function togglePasswordsModal(show) {
  const modal = document.getElementById('passwords-modal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}

// Add function to render passwords
function renderPasswords() {
  const container = document.getElementById('passwords-container');
  container.innerHTML = '';
  
  const users = ['Dikshansh', 'Aditya', 'Anurag'];
  
  users.forEach(user => {
    if (!passwordsData[user]) return;
    
    // Create user section
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
    
    // Add platforms for this user
    const platforms = ['Instagram', 'TikTok'];
    
    platforms.forEach(platform => {
      if (!passwordsData[user][platform] || passwordsData[user][platform].length === 0) return;
      
      const platformProfiles = passwordsData[user][platform];
      
      platformProfiles.forEach(profileData => {
        const profileDiv = document.createElement('div');
        profileDiv.style.display = 'flex';
        profileDiv.style.alignItems = 'center';
        profileDiv.style.marginBottom = '12px';
        profileDiv.style.padding = '10px';
        profileDiv.style.background = 'rgba(255,255,255,0.02)';
        profileDiv.style.borderRadius = '6px';
        profileDiv.style.border = '1px solid #222';
        
        // Add platform logo
        const logoDiv = document.createElement('div');
        logoDiv.innerHTML = getPlatformLogo(platform);
        profileDiv.appendChild(logoDiv);
        
        // Create profile info
        const profileInfo = document.createElement('div');
        profileInfo.style.flex = '1';
        
        const profileName = document.createElement('span');
        profileName.textContent = `${profileData.profile} : ${profileData.profileName || 'Not set'} - `;
        profileName.style.color = '#fff';
        profileName.style.fontSize = '14px';
        
        const passwordSpan = document.createElement('span');
        passwordSpan.textContent = profileData.password || 'No password';
        passwordSpan.style.color = '#aaa';
        passwordSpan.style.fontSize = '14px';
        passwordSpan.style.fontFamily = 'monospace';
        
        profileInfo.appendChild(profileName);
        profileInfo.appendChild(passwordSpan);
        profileDiv.appendChild(profileInfo);
        
        // Add copy password button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'icon-btn copy-btn';
        copyBtn.style.marginLeft = '10px';
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M16 12.9V17.1C16 20.6 14.6 22 11.1 22H6.9C3.4 22 2 20.6 2 17.1V12.9C2 9.4 3.4 8 6.9 8H11.1C14.6 8 16 9.4 16 12.9Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M22 6.9V11.1C22 14.6 20.6 16 17.1 16H16V12.9C16 9.4 14.6 8 11.1 8H8V6.9C8 3.4 9.4 2 12.9 2H17.1C20.6 2 22 3.4 22 6.9Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        `;
        copyBtn.onclick = () => copyPassword(profileData.password);
        profileDiv.appendChild(copyBtn);
        
        userSection.appendChild(profileDiv);
      });
    });
    
    container.appendChild(userSection);
  });
  
  // If no passwords found
  if (container.children.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #666;">
        <p>No passwords found in the database.</p>
        <p style="font-size: 12px; margin-top: 10px;">Add passwords to the "Passwords" sheet in Google Sheets.</p>
      </div>
    `;
  }
}

// Add function to copy password
function copyPassword(password) {
  if (!password) {
    showToast('No password to copy', 'error');
    return;
  }
  
  copyLink(password); // Reuse existing copy function
}

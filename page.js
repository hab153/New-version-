// ============================================================
// page.js - Skyline AI · Lead Discovery Dashboard
// ============================================================

const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// ── DOM Elements ──
const customerDescription = document.getElementById('customerDescription');
const charCounter = document.getElementById('charCounter');
const suggestionChips = document.querySelectorAll('.chip-btn');
const findProspectsBtn = document.getElementById('findProspectsBtn');
const plusBtn = document.getElementById('plusBtn');
const deleteBtn = document.getElementById('deleteBtn');
const connectEmailBtn = document.getElementById('connectEmailBtn');
const emailBanner = document.getElementById('emailBanner');

// ── 1. Plus Button: Refresh Page ──
if (plusBtn) {
    plusBtn.addEventListener('click', function() {
        window.location.reload();
    });
}

// ── 2. Delete Button: Clear Input (New Start) ──
if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
        if (customerDescription) {
            if (customerDescription.value.length > 0) {
                // Optional: Confirm before clearing if there is text
                // if (confirm('Clear current description?')) { ... }
                customerDescription.value = '';
                customerDescription.dispatchEvent(new Event('input'));
                showToast('Input cleared', 'info');
            }
        }
    });
}

// ── 3. Connect Email Logic (Matches dashboard.html) ──

// Check if we returned from Nylas OAuth
function handleOAuthRedirect() {
    const params = new URLSearchParams(window.location.search);
    const nylasSuccess = params.get('nylas');
    
    if (nylasSuccess === 'success') {
        showToast('✅ Email account connected successfully!', 'success', 6000);
        updateEmailUI(true, 'Connected');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (nylasSuccess === 'error') {
        const errorMsg = params.get('error') || 'Unknown error';
        showToast(`❌ Connection failed: ${decodeURIComponent(errorMsg)}`, 'error', 6000);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Update UI based on connection status
function updateEmailUI(isConnected, emailOrStatus) {
    if (!emailBanner || !connectEmailBtn) return;

    if (isConnected) {
        emailBanner.classList.remove('disconnected');
        emailBanner.classList.add('connected');
        
        // Update Banner Text
        const title = emailBanner.querySelector('.banner-title');
        const desc = emailBanner.querySelector('.banner-desc');
        if (title) title.textContent = 'Email Connected';
        if (desc) desc.textContent = typeof emailOrStatus === 'string' ? emailOrStatus : 'Connected successfully';

        // Update Button
        connectEmailBtn.innerHTML = '<span>Manage</span>';
        connectEmailBtn.onclick = () => {
            // Placeholder for managing email settings
            showToast('Email settings coming soon', 'info');
        };
    } else {
        emailBanner.classList.add('disconnected');
        emailBanner.classList.remove('connected');
        
        const title = emailBanner.querySelector('.banner-title');
        const desc = emailBanner.querySelector('.banner-desc');
        if (title) title.textContent = 'No email connected';
        if (desc) desc.textContent = 'Connect Gmail or Outlook to unlock inbox and follow-up features';

        // Reset Button to Connect Action
        connectEmailBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <span>Connect email</span>
        `;
        connectEmailBtn.onclick = connectEmail;
    }
}

// Fetch Status from Backend
async function checkEmailStatus() {
    if (!token) return;
    
    try {
        const res = await fetch(`${BACKEND}/api/auth/nylas/status`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('Status check failed');

        const data = await res.json();
        
        if (data.connected && !data.isExpired) {
            updateEmailUI(true, data.email || 'Connected');
        } else {
            updateEmailUI(false);
        }
    } catch (err) {
        console.error('Email status error:', err);
        updateEmailUI(false);
    }
}

// Initiate Connection
async function connectEmail() {
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const btn = connectEmailBtn;
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span>Connecting...</span>';

    try {
        const res = await fetch(`${BACKEND}/api/auth/nylas/connect`, {
            method: 'GET',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error('Failed to get connection URL');

        const data = await res.json();

        if (data.url) {
            // Fix any HTML entity issues in URL if present
            let redirectUrl = data.url.replace(/&amp;/g, '&');
            window.location.href = redirectUrl;
        } else {
            throw new Error('No URL received');
        }

    } catch (error) {
        console.error('Connection error:', error);
        btn.disabled = false;
        btn.innerHTML = originalContent;
        showToast('❌ Could not start connection process', 'error');
    }
}

// ── Character Counter Logic ──
if (customerDescription && charCounter) {
    customerDescription.addEventListener('input', function() {
        const currentLength = this.value.length;
        charCounter.textContent = `${currentLength}/500`;
        
        if (currentLength >= 450) {
            charCounter.style.color = '#ff5555';
        } else {
            charCounter.style.color = '#92939D';
        }
    });
}

// ── Suggestion Chips Logic ──
suggestionChips.forEach(chip => {
    chip.addEventListener('click', function() {
        const text = this.getAttribute('data-text');
        if (customerDescription && text) {
            customerDescription.value = text;
            customerDescription.dispatchEvent(new Event('input'));
            customerDescription.focus();
        }
    });
});

// ── Find Prospects Button ──
if (findProspectsBtn) {
    findProspectsBtn.addEventListener('click', function() {
        const query = customerDescription ? customerDescription.value.trim() : '';
        if (!query) {
            showToast('Please describe your ideal customer first.', 'warning');
            return;
        }
        showToast('Searching for prospects...', 'info');
        console.log('[Lead Discovery] Query:', query);
        // Future: Integrate with streamPipeline here
    });
}

// ── Utility: Toast Notification ──
function showToast(message, type, duration) {
    type = type || 'info'; 
    duration = duration || 4000;
    var existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    
    var toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    
    var colors = {
        success: { bg: 'rgba(102,221,153,0.10)', border: 'rgba(102,221,153,0.5)', text: '#66dd99' },
        error:   { bg: 'rgba(255,85,85,0.10)',   border: 'rgba(255,85,85,0.5)',   text: '#ff5555' },
        warning: { bg: 'rgba(255,170,0,0.10)',   border: 'rgba(255,170,0,0.5)',   text: '#ffaa00' },
        info:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.2)', text: '#f5f5f5' }
    };
    
    var color = colors[type] || colors.info;
    Object.assign(toast.style, {
        background: color.bg, 
        border: '1px solid ' + color.border, 
        color: color.text,
        position: 'fixed', 
        top: '20px', 
        left: '50%', 
        transform: 'translateX(-50%)',
        padding: '12px 24px', 
        borderRadius: '10px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
        zIndex: '9999',
        backdropFilter: 'blur(10px)'
    });
    
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, duration);
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', function() {
    handleOAuthRedirect();
    checkEmailStatus();
    console.log('✅ [PAGE] Lead Discovery Dashboard Ready');
});

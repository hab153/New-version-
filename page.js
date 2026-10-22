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

// ── Character Counter Logic ──
if (customerDescription && charCounter) {
    customerDescription.addEventListener('input', function() {
        const currentLength = this.value.length;
        charCounter.textContent = `${currentLength}/500`;
        
        // Optional: Change color if near limit
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
            // Trigger input event to update counter
            customerDescription.dispatchEvent(new Event('input'));
            customerDescription.focus();
        }
    });
});

// ── Button Placeholders ──

// Find Prospects Button
if (findProspectsBtn) {
    findProspectsBtn.addEventListener('click', function() {
        const query = customerDescription ? customerDescription.value.trim() : '';
        if (!query) {
            showToast('Please describe your ideal customer first.', 'warning');
            return;
        }
        // Placeholder for future backend integration
        showToast('Searching for prospects...', 'info');
        console.log('[Lead Discovery] Query:', query);
    });
}

// Plus Button (New Chat/Lead)
if (plusBtn) {
    plusBtn.addEventListener('click', function() {
        // Placeholder: Could open a modal or redirect to a new lead form
        showToast('Create new lead feature coming soon.', 'info');
    });
}

// Delete Button (Clear Input)
if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
        if (customerDescription) {
            if (customerDescription.value.length > 0) {
                if (confirm('Are you sure you want to clear the description?')) {
                    customerDescription.value = '';
                    customerDescription.dispatchEvent(new Event('input'));
                }
            }
        }
    });
}

// Connect Email Button
if (connectEmailBtn) {
    connectEmailBtn.addEventListener('click', function() {
        // Redirect to Nylas auth endpoint
        window.location.href = `${BACKEND}/api/auth/nylas/connect`;
    });
}

// ── Existing Backend Integration (Preserved) ──

// Check User Plan and Status
function checkDashboardStatus() {
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Check Email Connection Status
    fetch(`${BACKEND}/api/auth/nylas/status`, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(res => res.json())
    .then(data => {
        if (data.connected && !data.isExpired) {
            // Update UI to show connected state
            if (emailBanner) {
                emailBanner.classList.remove('disconnected');
                emailBanner.classList.add('connected');
                emailBanner.querySelector('.banner-title').textContent = 'Email Connected';
                emailBanner.querySelector('.banner-desc').textContent = data.email || 'Connected successfully';
                connectEmailBtn.innerHTML = '<span>Manage</span>';
                connectEmailBtn.onclick = () => window.location.href = 'settings.html';
            }
        }
    })
    .catch(err => console.error('Status check failed:', err));

    // Check User Plan (for the Free Plan card)
    fetch(`${BACKEND}/api/users/me`, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(res => res.json())
    .then(user => {
        // Update plan card if needed based on user.subscriptionTier
        console.log('User plan:', user.subscriptionTier);
    })
    .catch(err => console.error('User fetch failed:', err));
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkDashboardStatus();
    console.log('✅ [PAGE] Lead Discovery Dashboard UI Ready');
});

// Utility: Toast Notification (from previous implementation)
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

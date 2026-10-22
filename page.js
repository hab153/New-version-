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
                customerDescription.value = '';
                customerDescription.dispatchEvent(new Event('input'));
                showToast('Input cleared', 'info');
            }
        }
    });
}

// ── 3. Connect Email Logic (Matches dashboard.html) ──

function handleOAuthRedirect() {
    const params = new URLSearchParams(window.location.search);
    const nylasSuccess = params.get('nylas');
    
    if (nylasSuccess === 'success') {
        showToast('✅ Email account connected successfully!', 'success', 6000);
        updateEmailUI(true, 'Connected');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (nylasSuccess === 'error') {
        const errorMsg = params.get('error') || 'Unknown error';
        showToast(`❌ Connection failed: ${decodeURIComponent(errorMsg)}`, 'error', 6000);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function updateEmailUI(isConnected, emailOrStatus) {
    if (!emailBanner || !connectEmailBtn) return;

    if (isConnected) {
        emailBanner.classList.remove('disconnected');
        emailBanner.classList.add('connected');
        
        const title = emailBanner.querySelector('.banner-title');
        const desc = emailBanner.querySelector('.banner-desc');
        if (title) title.textContent = 'Email Connected';
        if (desc) desc.textContent = typeof emailOrStatus === 'string' ? emailOrStatus : 'Connected successfully';

        connectEmailBtn.innerHTML = '<span>Manage</span>';
        connectEmailBtn.onclick = () => showToast('Email settings coming soon', 'info');
    } else {
        emailBanner.classList.add('disconnected');
        emailBanner.classList.remove('connected');
        
        const title = emailBanner.querySelector('.banner-title');
        const desc = emailBanner.querySelector('.banner-desc');
        if (title) title.textContent = 'No email connected';
        if (desc) desc.textContent = 'Connect Gmail or Outlook to unlock inbox and follow-up features';

        connectEmailBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <span>Connect email</span>
        `;
        connectEmailBtn.onclick = connectEmail;
    }
}

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
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to get connection URL');
        const data = await res.json();
        if (data.url) {
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

// ── 4. Character Counter & Suggestions ──
if (customerDescription && charCounter) {
    customerDescription.addEventListener('input', function() {
        const currentLength = this.value.length;
        charCounter.textContent = `${currentLength}/500`;
        charCounter.style.color = currentLength >= 450 ? '#ff5555' : '#92939D';
    });
}

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

// ── 5. Fixed Mini-Panel & Streaming Logic ──

// Stage Mapping
const STAGE_NAMES = {
    's1': 'Understanding your target',
    's2': 'Finding relevant companies',
    's3': 'Checking available business details',
    's4': 'Verifying key information',
    's5': 'Preparing your results'
};

let _activeEventSource = null;
let _runCounter = 0;
let _stageData = {};

function createMiniPanel() {
    // Remove existing panel if any
    const existing = document.getElementById('stageMiniPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'stageMiniPanel';
    panel.className = 'stage-mini-panel';
    
    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span>Lead Discovery Pipeline</span><span class="panel-timer">⏱️ 0s</span>';
    panel.appendChild(header);

    // Scrollable Content
    const content = document.createElement('div');
    content.className = 'panel-content';
    content.id = 'stagePanelContent';
    panel.appendChild(content);

    // Insert after the input wrapper
    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper && inputWrapper.parentNode) {
        inputWrapper.parentNode.insertBefore(panel, inputWrapper.nextSibling);
    }
}

function updateStageInPanel(stageId, status) {
    const content = document.getElementById('stagePanelContent');
    if (!content) return;

    let stageEl = document.getElementById(`stage-item-${stageId}`);
    const label = STAGE_NAMES[stageId] || stageId;

    if (!stageEl) {
        stageEl = document.createElement('div');
        stageEl.id = `stage-item-${stageId}`;
        stageEl.className = 'stage-item waiting';
        stageEl.innerHTML = `
            <div class="stage-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="8"/></svg>
            </div>
            <div class="stage-label">${label}</div>
        `;
        content.appendChild(stageEl);
        // Auto-scroll to bottom if user hasn't scrolled up manually
        content.scrollTop = content.scrollHeight;
    }

    // Update State
    stageEl.className = `stage-item ${status}`;
    const iconContainer = stageEl.querySelector('.stage-icon');
    
    if (status === 'processing') {
        iconContainer.innerHTML = `<svg class="spinner" viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    } else if (status === 'completed') {
        iconContainer.innerHTML = `<svg class="check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (status === 'failed') {
        iconContainer.innerHTML = `<svg class="cross" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    }
}

function removeMiniPanel() {
    const panel = document.getElementById('stageMiniPanel');
    if (panel) panel.remove();
}

function streamLeadResponse(message) {
    if (_activeEventSource) {
        try { _activeEventSource.close(); } catch (e) {}
        _activeEventSource = null;
    }

    const runId = ++_runCounter;
    _stageData = {};
    createMiniPanel();

    // Timer Logic
    let startTime = Date.now();
    const timerEl = document.querySelector('.panel-timer');
    const timerInterval = setInterval(() => {
        if (timerEl) timerEl.textContent = `⏱️ ${Math.floor((Date.now() - startTime) / 1000)}s`;
    }, 1000);

    const url = `${BACKEND}/api/stream/pipeline?message=${encodeURIComponent(message)}&token=${encodeURIComponent(token)}`;

    try {
        const es = new EventSource(url);
        _activeEventSource = es;

        es.addEventListener('stage', function(event) {
            if (runId !== _runCounter) return;
            const payload = JSON.parse(event.data);
            if (!payload || !payload.stage) return;

            const stageId = payload.stage;
            const status = payload.data?.status;

            if (status) updateStageInPanel(stageId, status);
            
            if (payload.data?.data) _stageData[stageId] = payload.data.data;

            if (stageId === 'done' || stageId === 'error') {
                clearInterval(timerInterval);
                es.close();
                _activeEventSource = null;
                
                setTimeout(() => {
                    removeMiniPanel();
                    if (stageId === 'done') {
                        renderFinalResults(_stageData['s5']);
                    } else {
                        showToast('Pipeline encountered an error.', 'error');
                    }
                }, 1000);
            }
        });

        es.addEventListener('error', function() {
            clearInterval(timerInterval);
            es.close();
            _activeEventSource = null;
            showToast('Connection lost during search.', 'error');
            removeMiniPanel();
        });

    } catch (e) {
        clearInterval(timerInterval);
        showToast('Could not start search engine.', 'error');
        removeMiniPanel();
    }
}

function renderFinalResults(data) {
    // For now, just show a success toast. 
    // In a full implementation, this would populate a results grid.
    const count = data?.companies?.length || 0;
    showToast(`Search complete! Found ${count} prospects.`, 'success');
    console.log('Final Data:', data);
}

// ── Find Prospects Button Action ──
if (findProspectsBtn) {
    findProspectsBtn.addEventListener('click', function() {
        const query = customerDescription ? customerDescription.value.trim() : '';
        if (!query) {
            showToast('Please describe your ideal customer first.', 'warning');
            return;
        }
        streamLeadResponse(query);
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

const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// DOM Elements
const backToAlertsBtn = document.getElementById('backToAlertsBtn');
const statusCard = document.getElementById('statusCard');
const statusIcon = document.getElementById('statusIcon');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const pauseResumeText = document.getElementById('pauseResumeText');
const autoRepliesToggle = document.getElementById('autoRepliesToggle');
const followUpToggle = document.getElementById('followUpToggle');
const businessHoursToggle = document.getElementById('businessHoursToggle');
const schedulesList = document.getElementById('schedulesList');
const disableAllBtn = document.getElementById('disableAllBtn');
const warningModalOverlay = document.getElementById('warningModalOverlay');
const cancelWarningBtn = document.getElementById('cancelWarningBtn');
const confirmDisableBtn = document.getElementById('confirmDisableBtn');

// State
let currentSchedules = [];
let isAutomationOn = false;

// ─ Navigation ──
if (backToAlertsBtn) {
    backToAlertsBtn.addEventListener('click', () => window.history.back());
}

// ── Load Automation State ──
async function loadAutomationState() {
    if (!token) {
        setAutomationOff();
        return;
    }

    try {
        // Fetch pending schedules to determine state
        const res = await fetch(`${BACKEND}/api/leads/schedules/pending`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('Failed to fetch schedules');

        const data = await res.json();
        currentSchedules = data.schedules || [];

        // Determine if automation is on (has pending schedules) or paused/off
        const hasPending = currentSchedules.some(s => s.status === 'pending');
        const hasPaused = currentSchedules.some(s => s.status === 'paused');

        if (hasPending) {
            setAutomationOn();
        } else if (hasPaused) {
            setAutomationPaused();
        } else {
            setAutomationOff();
        }

        renderActiveSchedules();

    } catch (err) {
        console.error('Error loading automation state:', err);
        setAutomationOff();
    }
}

function setAutomationOn() {
    isAutomationOn = true;
    statusCard.className = 'status-card active';
    statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>';
    statusTitle.textContent = 'Automation is on';
    statusDesc.textContent = `${currentSchedules.filter(s => s.status === 'pending').length} active schedules running`;
    pauseResumeText.textContent = 'Pause all automation';
    pauseResumeBtn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
}

function setAutomationPaused() {
    isAutomationOn = false;
    statusCard.className = 'status-card paused';
    statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    statusTitle.textContent = 'Automation is paused';
    statusDesc.textContent = 'Schedules are frozen and will resume when turned back on';
    pauseResumeText.textContent = 'Resume all automation';
    pauseResumeBtn.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function setAutomationOff() {
    isAutomationOn = false;
    statusCard.className = 'status-card';
    statusIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    statusTitle.textContent = 'Automation is off';
    statusDesc.textContent = 'No automatic emails will be sent';
    pauseResumeText.textContent = 'Pause all automation';
    pauseResumeBtn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
}

function renderActiveSchedules() {
    const pendingSchedules = currentSchedules.filter(s => s.status === 'pending');
    
    if (pendingSchedules.length === 0) {
        schedulesList.innerHTML = `
            <div class="empty-schedule">
                <div class="empty-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#92939D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <h4 class="empty-title">No active schedules</h4>
                <p class="empty-desc">Approved scheduled outreach will appear here</p>
            </div>
        `;
        return;
    }

    schedulesList.innerHTML = pendingSchedules.map(s => `
        <div class="schedule-item">
            <div class="schedule-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="schedule-info">
                <h4 class="schedule-title">${s.companyName}</h4>
                <p class="schedule-desc">${new Date(s.scheduledAt).toLocaleString()}</p>
            </div>
        </div>
    `).join('');
}

// ── Pause/Resume Handler ──
if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener('click', async function() {
        if (!token) return;

        const endpoint = isAutomationOn ? '/api/automation/pause' : '/api/automation/resume';
        const method = 'PUT';

        try {
            pauseResumeBtn.disabled = true;
            pauseResumeText.textContent = isAutomationOn ? 'Pausing...' : 'Resuming...';

            const res = await fetch(`${BACKEND}${endpoint}`, {
                method,
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error(`Failed to ${isAutomationOn ? 'pause' : 'resume'}`);

            await loadAutomationState();
            showToast(`✅ Automation ${isAutomationOn ? 'paused' : 'resumed'} successfully`, 'success');

        } catch (err) {
            console.error('Error:', err);
            showToast(`❌ Failed to ${isAutomationOn ? 'pause' : 'resume'} automation`, 'error');
        } finally {
            pauseResumeBtn.disabled = false;
        }
    });
}

// ── Disable All Handler ──
if (disableAllBtn) {
    disableAllBtn.addEventListener('click', function() {
        warningModalOverlay.style.display = 'flex';
    });
}

if (cancelWarningBtn) {
    cancelWarningBtn.addEventListener('click', function() {
        warningModalOverlay.style.display = 'none';
    });
}

if (confirmDisableBtn) {
    confirmDisableBtn.addEventListener('click', async function() {
        if (!token) return;

        try {
            confirmDisableBtn.disabled = true;
            confirmDisableBtn.textContent = 'Disabling...';

            const res = await fetch(`${BACKEND}/api/automation/cancel`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error('Failed to disable');

            warningModalOverlay.style.display = 'none';
            await loadAutomationState();
            showToast('️ All automation disabled and schedules cancelled', 'info');

        } catch (err) {
            console.error('Error:', err);
            showToast(' Failed to disable automation', 'error');
        } finally {
            confirmDisableBtn.disabled = false;
            confirmDisableBtn.textContent = 'Yes, Disable All';
        }
    });
}

// Close modal on overlay click
if (warningModalOverlay) {
    warningModalOverlay.addEventListener('click', function(e) {
        if (e.target === warningModalOverlay) {
            warningModalOverlay.style.display = 'none';
        }
    });
}

// ── Toast Utility ──
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;

    const colors = {
        success: { bg: 'rgba(102,221,153,0.10)', border: 'rgba(102,221,153,0.5)', text: '#66dd99' },
        error:   { bg: 'rgba(255,85,85,0.10)',   border: 'rgba(255,85,85,0.5)',   text: '#ff5555' },
        warning: { bg: 'rgba(255,170,0,0.10)',   border: 'rgba(255,170,0,0.5)',   text: '#ffaa00' },
        info:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.2)', text: '#f5f5f5' }
    };

    const color = colors[type] || colors.info;
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
    setTimeout(() => toast.remove(), duration);
}

// Initialize
document.addEventListener('DOMContentLoaded', loadAutomationState);

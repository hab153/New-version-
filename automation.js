const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// DOM Elements
const backToAlertsBtn = document.getElementById('backToAlertsBtn');
const statusCard = document.getElementById('statusCard');
const statusSvg = statusCard.querySelector('.status-svg');
const statusTitle = document.getElementById('statusTitle');
const statusDesc = document.getElementById('statusDesc');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const pauseResumeText = document.getElementById('pauseResumeText');
const autoRepliesToggle = document.getElementById('autoRepliesToggle');
const autoRepliesLabel = document.getElementById('autoRepliesLabel');
const followUpToggle = document.getElementById('followUpToggle');
const followUpLabel = document.getElementById('followUpLabel');
const businessHoursToggle = document.getElementById('businessHoursToggle');
const bizHoursLabel = document.getElementById('bizHoursLabel');
const dailyLimitValue = document.getElementById('dailyLimitValue');
const paceValue = document.getElementById('paceValue');
const schedulesContent = document.getElementById('schedulesContent');
const disableAllBtn = document.getElementById('disableAllBtn');
const warningModalOverlay = document.getElementById('warningModalOverlay');
const cancelWarningBtn = document.getElementById('cancelWarningBtn');
const confirmDisableBtn = document.getElementById('confirmDisableBtn');
const dailyLimitRow = document.getElementById('dailyLimitRow');
const paceRow = document.getElementById('paceRow');

// State
let currentSchedules = [];
let automationState = 'off'; // 'on' | 'paused' | 'off'
let userSettings = {};

// SVG Icons for Status States
const ICONS = {
    off: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    on: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
    paused: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
};

// ─ Navigation ──
if (backToAlertsBtn) {
    backToAlertsBtn.addEventListener('click', () => window.history.back());
}

// ── Load Full Automation State ──
async function loadAutomationState() {
    if (!token) {
        setAutomationState('off');
        return;
    }

    try {
        // Fetch schedules and user settings in parallel
        const [schedRes, settingsRes] = await Promise.all([
            fetch(`${BACKEND}/api/leads/schedules/pending`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).catch(() => null),
            fetch(`${BACKEND}/api/users/me`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).catch(() => null)
        ]);

        // Process schedules
        if (schedRes && schedRes.ok) {
            const schedData = await schedRes.json();
            currentSchedules = schedData.schedules || [];
        } else {
            currentSchedules = [];
        }

        // Determine automation state from schedules
        const hasPending = currentSchedules.some(s => s.status === 'pending');
        const hasPaused = currentSchedules.some(s => s.status === 'paused');

        if (hasPending) {
            setAutomationState('on');
        } else if (hasPaused) {
            setAutomationState('paused');
        } else {
            setAutomationState('off');
        }

        // Process user settings
        if (settingsRes && settingsRes.ok) {
            const userData = await settingsRes.json();
            userSettings = userData.settings || userData.automation || {};
            
            // Update UI from real settings
            if (userSettings.autoReplies !== undefined) {
                autoRepliesToggle.checked = userSettings.autoReplies;
                autoRepliesLabel.textContent = userSettings.autoReplies ? 'On' : 'Off';
            }
            if (userSettings.followUpSequences !== undefined) {
                followUpToggle.checked = userSettings.followUpSequences;
                followUpLabel.textContent = userSettings.followUpSequences ? 'On' : 'Off';
            }
            if (userSettings.businessHours !== undefined) {
                businessHoursToggle.checked = userSettings.businessHours;
                bizHoursLabel.textContent = userSettings.businessHours ? 'On' : 'Off';
            }
            if (userSettings.dailyEmailLimit) {
                dailyLimitValue.textContent = `${userSettings.dailyEmailLimit} emails`;
            } else {
                dailyLimitValue.textContent = '25 emails'; // Fallback default
            }
            if (userSettings.sendingPace) {
                paceValue.textContent = formatPace(userSettings.sendingPace);
            } else {
                paceValue.textContent = 'One email every 5 minutes'; // Fallback default
            }
        }

        renderActiveSchedules();

    } catch (err) {
        console.error('Error loading automation state:', err);
        setAutomationState('off');
    }
}

function setAutomationState(state) {
    automationState = state;
    statusCard.className = `status-card ${state}`;
    statusSvg.innerHTML = ICONS[state];

    switch (state) {
        case 'on':
            statusTitle.textContent = 'Automation is on';
            statusDesc.textContent = `${currentSchedules.filter(s => s.status === 'pending').length} active schedules running`;
            pauseResumeText.textContent = 'Pause all automation';
            pauseResumeBtn.disabled = false;
            break;
        case 'paused':
            statusTitle.textContent = 'Automation is paused';
            statusDesc.textContent = 'Schedules are frozen and will resume when turned back on';
            pauseResumeText.textContent = 'Resume all automation';
            pauseResumeBtn.disabled = false;
            break;
        case 'off':
        default:
            statusTitle.textContent = 'Automation is off';
            statusDesc.textContent = 'No automatic emails will be sent';
            pauseResumeText.textContent = 'Pause all automation';
            pauseResumeBtn.disabled = true;
            break;
    }
}

function formatPace(minutes) {
    if (minutes === 1) return 'One email every minute';
    if (minutes === 5) return 'One email every 5 minutes';
    if (minutes === 10) return 'One email every 10 minutes';
    if (minutes === 15) return 'One email every 15 minutes';
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        return `One email every ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `One email every ${minutes} minutes`;
}

function renderActiveSchedules() {
    const pendingSchedules = currentSchedules.filter(s => s.status === 'pending');

    if (pendingSchedules.length === 0) {
        schedulesContent.innerHTML = `
            <div class="empty-schedule-state">
                <div class="empty-icon-tile">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5F7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div class="empty-text">
                    <h4 class="empty-title">No active schedules</h4>
                    <p class="empty-desc">Approved scheduled outreach will appear here</p>
                </div>
            </div>
        `;
        return;
    }

    schedulesContent.innerHTML = pendingSchedules.map(s => `
        <div class="schedule-item">
            <div class="schedule-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="schedule-info">
                <h4 class="schedule-title">${escapeHtml(s.companyName)}</h4>
                <p class="schedule-desc">${new Date(s.scheduledAt).toLocaleString()}</p>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Pause/Resume Handler ──
if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener('click', async function() {
        if (!token || this.disabled) return;

        const endpoint = automationState === 'on' 
            ? '/api/automation/pause' 
            : '/api/automation/resume';

        try {
            this.disabled = true;
            pauseResumeText.textContent = automationState === 'on' ? 'Pausing...' : 'Resuming...';

            const res = await fetch(`${BACKEND}${endpoint}`, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            await loadAutomationState();
            showToast(
                `✅ Automation ${automationState === 'on' ? 'paused' : 'resumed'} successfully`, 
                'success'
            );

        } catch (err) {
            console.error('Pause/Resume error:', err);
            showToast(`❌ Failed to update automation`, 'error');
        } finally {
            this.disabled = false;
        }
    });
}

// ── Toggle Handlers ──
if (autoRepliesToggle) {
    autoRepliesToggle.addEventListener('change', async function() {
        if (!token) return;
        const newState = this.checked;
        autoRepliesLabel.textContent = newState ? 'On' : 'Off';
        
        try {
            await saveUserSetting('autoReplies', newState);
            showToast(`✅ Automatic replies ${newState ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            this.checked = !newState;
            autoRepliesLabel.textContent = !newState ? 'On' : 'Off';
            showToast('❌ Failed to save setting', 'error');
        }
    });
}

if (followUpToggle) {
    followUpToggle.addEventListener('change', async function() {
        if (!token) return;
        const newState = this.checked;
        followUpLabel.textContent = newState ? 'On' : 'Off';
        
        try {
            await saveUserSetting('followUpSequences', newState);
            showToast(`✅ Follow-up sequences ${newState ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            this.checked = !newState;
            followUpLabel.textContent = !newState ? 'On' : 'Off';
            showToast('❌ Failed to save setting', 'error');
        }
    });
}

if (businessHoursToggle) {
    businessHoursToggle.addEventListener('change', async function() {
        if (!token) return;
        const newState = this.checked;
        bizHoursLabel.textContent = newState ? 'On' : 'Off';
        
        try {
            await saveUserSetting('businessHours', newState);
            showToast(`✅ Business hours ${newState ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            this.checked = !newState;
            bizHoursLabel.textContent = !newState ? 'On' : 'Off';
            showToast('❌ Failed to save setting', 'error');
        }
    });
}

async function saveUserSetting(key, value) {
    // TODO: Replace with actual settings API endpoint when available
    // For now, simulate persistence
    await new Promise(resolve => setTimeout(resolve, 300));
    userSettings[key] = value;
}

// ── Sending Limits Row Click Handlers ──
if (dailyLimitRow) {
    dailyLimitRow.addEventListener('click', function() {
        showToast('ℹ️ Daily limit editor coming soon', 'info');
        // TODO: Open existing limit editor modal/dialog
    });
}

if (paceRow) {
    paceRow.addEventListener('click', function() {
        showToast('️ Pace selector coming soon', 'info');
        // TODO: Open pace selector modal/dialog
    });
}

// ── Safety Rules Handlers ──
document.querySelectorAll('.safety-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async function() {
        if (!token) return;
        const rule = this.dataset.rule;
        const isEnabled = this.checked;
        
        try {
            // TODO: Connect to actual safety rules API
            // await fetch(`${BACKEND}/api/automation/safety-rules`, {
            //     method: 'PUT',
            //     headers: { 
            //         'Authorization': 'Bearer ' + token,
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({ [rule]: isEnabled })
            // });
            await new Promise(resolve => setTimeout(resolve, 200));
            showToast(`✅ "${this.nextElementSibling.nextElementSibling.textContent}" ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            this.checked = !isEnabled;
            showToast('❌ Failed to update safety rule', 'error');
        }
    });
});

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
            this.disabled = true;
            this.textContent = 'Disabling...';

            const res = await fetch(`${BACKEND}/api/automation/cancel`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            warningModalOverlay.style.display = 'none';
            await loadAutomationState();
            showToast('️ All automation disabled and schedules cancelled', 'info');

        } catch (err) {
            console.error('Disable error:', err);
            showToast('❌ Failed to disable automation', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Yes, Disable All';
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

// ── Toast Utility ─
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

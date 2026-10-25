const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// ─ DOM Elements ──
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
const emptyScheduleState = document.getElementById('emptyScheduleState');
const disableAllBtn = document.getElementById('disableAllBtn');
const warningModalOverlay = document.getElementById('warningModalOverlay');
const cancelWarningBtn = document.getElementById('cancelWarningBtn');
const confirmDisableBtn = document.getElementById('confirmDisableBtn');
const dailyLimitRow = document.getElementById('dailyLimitRow');
const paceRow = document.getElementById('paceRow');

// ✅ NEW: Inline bulk schedule toggle elements
const bulkScheduleToggleBtn = document.getElementById('bulkScheduleToggleBtn');
const bulkScheduleToggleText = document.getElementById('bulkScheduleToggleText');

// ✅ NEW: Per-lead removal modal elements
const removeScheduleModalOverlay = document.getElementById('removeScheduleModalOverlay');
const removeScheduleTitle = document.getElementById('removeScheduleTitle');
const removeScheduleDesc = document.getElementById('removeScheduleDesc');
const cancelRemoveBtn = document.getElementById('cancelRemoveBtn');
const confirmRemoveBtn = document.getElementById('confirmRemoveBtn');

// State
let currentSchedules = [];
let automationState = 'off'; // 'on' | 'paused' | 'off' — tracks ONLY scheduled outreach
let userSettings = {};
let countdownIntervals = {}; // Map<scheduleId, intervalId>
let pendingRemovalId = null; // Track which schedule is being confirmed for removal

// SVG Icons for Status States
const ICONS = {
    off: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    on: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
    paused: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
};

// BULK PAUSE ICONS
const BULK_ICONS = {
    pause: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    resume: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
};

// PER-LEAD ACTION ICONS
const ACTION_ICONS = {
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    pause: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    resume: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    remove: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

// ════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════
if (backToAlertsBtn) {
    backToAlertsBtn.addEventListener('click', () => window.history.back());
}

// ════════════════════════════════════════════
// LOAD FULL AUTOMATION STATE
// ═══════════════════════════════════════════
async function loadAutomationState() {
    if (!token) {
        setAutomationState('off');
        renderActiveSchedules();
        return;
    }

    try {
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

        // Determine scheduled-outreach-only state
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
                dailyLimitValue.textContent = '25 emails';
            }
            if (userSettings.sendingPace) {
                paceValue.textContent = formatPace(userSettings.sendingPace);
            } else {
                paceValue.textContent = 'One email every 5 minutes';
            }
        }

        renderActiveSchedules();
        startAllCountdowns();

    } catch (err) {
        console.error('Error loading automation state:', err);
        setAutomationState('off');
        renderActiveSchedules();
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

    // ✅ Update inline bulk toggle button independently
    updateBulkToggleUI();
}

function updateBulkToggleUI() {
    if (!bulkScheduleToggleBtn || !bulkScheduleToggleText) return;

    const hasAny = currentSchedules.length > 0;
    const hasPaused = currentSchedules.some(s => s.status === 'paused');
    const hasPending = currentSchedules.some(s => s.status === 'pending');

    bulkScheduleToggleBtn.disabled = !hasAny;

    if (hasPaused && !hasPending) {
        bulkScheduleToggleText.textContent = 'Resume all schedules';
        bulkScheduleToggleBtn.querySelector('svg').outerHTML = BULK_ICONS.resume;
    } else {
        bulkScheduleToggleText.textContent = 'Pause all schedules';
        bulkScheduleToggleBtn.querySelector('svg').outerHTML = BULK_ICONS.pause;
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

// ═══════════════════════════════════════════
// COUNTDOWN TIMER ENGINE
// ════════════════════════════════════════════
function formatCountdown(ms) {
    if (ms <= 0) return 'Sending...';
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    let str = '';
    if (h > 0) str += `${h}h `;
    if (m > 0 || h > 0) str += `${m}m `;
    str += `${s}s`;
    return str.trim();
}

function startAllCountdowns() {
    // Clear existing intervals
    Object.values(countdownIntervals).forEach(clearInterval);
    countdownIntervals = {};

    currentSchedules.forEach(schedule => {
        if (schedule.status === 'pending') {
            startSingleCountdown(schedule);
        }
    });
}

function startSingleCountdown(schedule) {
    // ✅ FIX: Use String() to extract raw hex ID from Mongoose ObjectId
    const safeId = String(schedule._id || schedule.id);
    const el = document.getElementById(`countdown-${safeId}`);
    if (!el) return;

    const updateTimer = () => {
        const now = Date.now();
        const target = new Date(schedule.scheduledAt).getTime();
        const diff = target - now;
        el.textContent = formatCountdown(diff);
    };

    updateTimer();
    countdownIntervals[safeId] = setInterval(updateTimer, 1000);
}

// ════════════════════════════════════════════
// RENDER ACTIVE SCHEDULES WITH PER-LEAD ACTIONS
// ════════════════════════════════════════════
function renderActiveSchedules() {
    // Clear existing countdowns first
    Object.values(countdownIntervals).forEach(clearInterval);
    countdownIntervals = {};

    const hasAny = currentSchedules.length > 0;

    if (!hasAny) {
        emptyScheduleState.style.display = 'flex';
        // Remove any previously rendered schedule items
        const existingItems = schedulesContent.querySelectorAll('.schedule-item');
        existingItems.forEach(item => item.remove());
        updateBulkToggleUI();
        return;
    }

    emptyScheduleState.style.display = 'none';

    // Remove old items but keep empty state in DOM
    const existingItems = schedulesContent.querySelectorAll('.schedule-item');
    existingItems.forEach(item => item.remove());

    // Build per-lead items
    currentSchedules.forEach(schedule => {
        // ✅ CRITICAL FIX: Extract raw hex string from Mongoose ObjectId
        // schedule._id is an ObjectId object; schedule.id may also be an object
        const safeId = String(schedule._id || schedule.id);
        
        const isPaused = schedule.status === 'paused';
        const item = document.createElement('div');
        item.className = `schedule-item${isPaused ? ' paused' : ''}`;
        item.dataset.scheduleId = safeId; // ✅ Store safe string ID

        const btnLabel = isPaused ? 'Resume' : 'Pause';
        const btnIcon = isPaused ? ACTION_ICONS.resume : ACTION_ICONS.pause;
        const btnClass = isPaused ? 'resume-btn' : 'pause-btn';

        // ✅ All data-id attributes now use safeId (raw hex string)
        item.innerHTML = `
            <div class="schedule-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="schedule-info">
                <h4 class="schedule-title">${escapeHtml(schedule.companyName)}</h4>
                <p class="schedule-desc">${new Date(schedule.scheduledAt).toLocaleString()}</p>
            </div>
            <div class="schedule-countdown" id="countdown-${safeId}">--</div>
            <div class="schedule-actions">
                <button class="schedule-action-btn edit-btn" data-id="${safeId}" title="Edit schedule">
                    ${ACTION_ICONS.edit} Edit
                </button>
                <button class="schedule-action-btn ${btnClass}" 
                        data-id="${safeId}" 
                        data-action="${isPaused ? 'resume' : 'pause'}">
                    ${btnIcon} ${btnLabel}
                </button>
                <button class="schedule-action-btn remove-btn" 
                        data-id="${safeId}" 
                        data-action="remove" 
                        title="Remove schedule">
                    ${ACTION_ICONS.remove} Remove
                </button>
            </div>
        `;

        schedulesContent.appendChild(item);

        // Start countdown if pending
        if (!isPaused) {
            startSingleCountdown(schedule);
        }
    });

    updateBulkToggleUI();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ════════════════════════════════════════════
// INLINE BULK PAUSE/RESUME ALL SCHEDULES
// ════════════════════════════════════════════
if (bulkScheduleToggleBtn) {
    bulkScheduleToggleBtn.addEventListener('click', async function() {
        if (!token || this.disabled) return;

        const hasPaused = currentSchedules.some(s => s.status === 'paused');
        const endpoint = hasPaused
            ? '/api/automation/resume'
            : '/api/automation/pause';

        try {
            this.disabled = true;
            bulkScheduleToggleText.textContent = hasPaused ? 'Resuming...' : 'Pausing...';

            const res = await fetch(`${BACKEND}${endpoint}`, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            await loadAutomationState();
            showToast(
                `✅ All schedules ${hasPaused ? 'resumed' : 'paused'} successfully`,
                'success'
            );

        } catch (err) {
            console.error('Bulk toggle error:', err);
            showToast(`❌ Failed to update schedules`, 'error');
        } finally {
            this.disabled = false;
        }
    });
}

// ════════════════════════════════════════════
// GLOBAL STATUS CARD PAUSE/RESUME
// ════════════════════════════════════════════
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

// ════════════════════════════════════════════
// ✅ FIXED: PER-LEAD ACTION HANDLERS (Event Delegation)
// Uses class-based detection + validated string IDs
// ════════════════════════════════════════════
if (schedulesContent) {
    schedulesContent.addEventListener('click', async function(e) {
        const actionBtn = e.target.closest('.schedule-action-btn');
        if (!actionBtn) return;

        const rawScheduleId = actionBtn.dataset.id;
        
        // ✅ CRITICAL VALIDATION: Ensure ID is a valid hex string, not "[object Object]"
        if (!rawScheduleId || typeof rawScheduleId !== 'string' || rawScheduleId === '[object Object]') {
            console.error('Invalid schedule ID detected:', rawScheduleId);
            showToast('❌ Schedule ID error. Please refresh the page.', 'error');
            return;
        }
        
        const scheduleId = rawScheduleId.trim();

        // ✅ FIX #1: EDIT → Navigate to leads.html with schedule pre-populated via URL params
        if (actionBtn.classList.contains('edit-btn')) {
            // Find schedule by matching the safe string ID
            const schedule = currentSchedules.find(s => {
                const sid = String(s._id || s.id);
                return sid === scheduleId;
            });
            if (!schedule) return;

            // Redirect to leads.html with schedule edit params
            const params = new URLSearchParams({
                editScheduleId: scheduleId,
                companyName: schedule.companyName,
                leadEmail: schedule.leadEmail,
                subject: encodeURIComponent(schedule.subject || ''),
                body: encodeURIComponent(schedule.body || ''),
                scheduledAt: schedule.scheduledAt,
                paceMinutes: schedule.paceMinutes || 5
            });
            window.location.href = `leads.html?${params.toString()}`;
            return;
        }

        // ✅ FIX #2 & #3: Detect action by CSS class instead of dataset.action
        if (actionBtn.classList.contains('pause-btn') || actionBtn.classList.contains('resume-btn')) {
            const isPaused = actionBtn.classList.contains('resume-btn');
            const endpoint = isPaused
                ? `/api/automation/schedule/${scheduleId}/resume`
                : `/api/automation/schedule/${scheduleId}/pause`;

            try {
                actionBtn.disabled = true;
                const originalHTML = actionBtn.innerHTML;
                actionBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> ...`;

                const res = await fetch(`${BACKEND}${endpoint}`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                await loadAutomationState();
                showToast(`✅ Schedule ${isPaused ? 'resumed' : 'paused'} successfully`, 'success');

            } catch (err) {
                console.error('Per-lead toggle error:', err);
                showToast(`❌ Failed to update schedule`, 'error');
            } finally {
                actionBtn.disabled = false;
            }
            return;
        }

        if (actionBtn.classList.contains('remove-btn')) {
            // Find schedule by matching the safe string ID
            const schedule = currentSchedules.find(s => {
                const sid = String(s._id || s.id);
                return sid === scheduleId;
            });
            if (!schedule) return;

            pendingRemovalId = scheduleId;
            const companyName = escapeHtml(schedule.companyName);
            removeScheduleTitle.textContent = `⚠️ Remove ${companyName}?`;
            removeScheduleDesc.textContent = `This will permanently cancel the scheduled email for ${companyName}. This action cannot be undone.`;
            removeScheduleModalOverlay.style.display = 'flex';
            return;
        }
    });
}

// ════════════════════════════════════════════
// PER-LEAD REMOVAL CONFIRMATION MODAL
// ════════════════════════════════════════════
if (cancelRemoveBtn) {
    cancelRemoveBtn.addEventListener('click', function() {
        removeScheduleModalOverlay.style.display = 'none';
        pendingRemovalId = null;
    });
}

if (confirmRemoveBtn) {
    confirmRemoveBtn.addEventListener('click', async function() {
        if (!token || !pendingRemovalId) return;

        try {
            this.disabled = true;
            this.textContent = 'Removing...';

            const res = await fetch(`${BACKEND}/api/automation/schedule/${pendingRemovalId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            removeScheduleModalOverlay.style.display = 'none';
            pendingRemovalId = null;

            // Backend already cleared Lead.scheduledAt & Lead.scheduleStatus via $unset
            // Just reload to reflect updated state
            await loadAutomationState();
            showToast(`️ Schedule for ${data.companyName || 'lead'} removed successfully`, 'info');

        } catch (err) {
            console.error('Remove schedule error:', err);
            showToast('❌ Failed to remove schedule', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Yes, Remove';
        }
    });
}

// Close removal modal on overlay click
if (removeScheduleModalOverlay) {
    removeScheduleModalOverlay.addEventListener('click', function(e) {
        if (e.target === removeScheduleModalOverlay) {
            removeScheduleModalOverlay.style.display = 'none';
            pendingRemovalId = null;
        }
    });
}

// ═══════════════════════════════════════════
// TOGGLE HANDLERS (Auto-replies, Follow-ups, Business Hours)
// ════════════════════════════════════════════
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
    // TODO: Replace with actual settings API endpoint
    await new Promise(resolve => setTimeout(resolve, 300));
    userSettings[key] = value;
}

// ════════════════════════════════════════════
// SENDING LIMITS ROW CLICK HANDLERS
// ════════════════════════════════════════════
if (dailyLimitRow) {
    dailyLimitRow.addEventListener('click', function() {
        showToast('ℹ️ Daily limit editor coming soon', 'info');
    });
}

if (paceRow) {
    paceRow.addEventListener('click', function() {
        showToast('ℹ️ Pace selector coming soon', 'info');
    });
}

// ════════════════════════════════════════════
// SAFETY RULES HANDLERS
// ════════════════════════════════════════════
document.querySelectorAll('.safety-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async function() {
        if (!token) return;
        const rule = this.dataset.rule;
        const isEnabled = this.checked;

        try {
            // TODO: Connect to actual safety rules API
            await new Promise(resolve => setTimeout(resolve, 200));
            const labelEl = this.nextElementSibling?.nextElementSibling;
            showToast(`✅ "${labelEl ? labelEl.textContent : rule}" ${isEnabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (err) {
            this.checked = !isEnabled;
            showToast('❌ Failed to update safety rule', 'error');
        }
    });
});

// ═══════════════════════════════════════════
// DISABLE ALL AUTOMATION HANDLER
// ═══════════════════════════════════════════
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
            showToast('🗑️ All automation disabled and schedules cancelled', 'info');

        } catch (err) {
            console.error('Disable error:', err);
            showToast('❌ Failed to disable automation', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Yes, Disable All';
        }
    });
}

// Close global warning modal on overlay click
if (warningModalOverlay) {
    warningModalOverlay.addEventListener('click', function(e) {
        if (e.target === warningModalOverlay) {
            warningModalOverlay.style.display = 'none';
        }
    });
}

// ════════════════════════════════════════════
// TOAST UTILITY
// ═══════════════════════════════════════════
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

// ════════════════════════════════════════════
// CLEANUP ON UNLOAD
// ════════════════════════════════════════════
window.addEventListener('beforeunload', function() {
    Object.values(countdownIntervals).forEach(clearInterval);
    countdownIntervals = {};
});

// Initialize
document.addEventListener('DOMContentLoaded', loadAutomationState);

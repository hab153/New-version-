const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// DOM Elements
const backToAlertsBtn = document.getElementById('backToAlertsBtn');
const cardSkeleton = document.getElementById('cardSkeleton');
const cardContent = document.getElementById('cardContent');
const scheduleCount = document.getElementById('scheduleCount');
const nextSendTime = document.getElementById('nextSendTime');
const emptyState = document.getElementById('emptyState');
const automationToggle = document.getElementById('automationToggle');
const toggleInput = document.getElementById('toggleInput');
const scheduleCard = document.getElementById('scheduleCard');
const countdownDisplay = document.getElementById('countdownDisplay');

// Warning Modal Elements
const warningModalOverlay = document.getElementById('warningModalOverlay');
const cancelWarningBtn = document.getElementById('cancelWarningBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

// State
let countdownInterval = null;
let currentSchedules = [];
let isPaused = false;

// ─ Navigation ──
if (backToAlertsBtn) {
    backToAlertsBtn.addEventListener('click', () => window.history.back());
}

// ── Fetch Schedules on Load ──
async function loadSchedules() {
    if (!token) {
        showEmptyState();
        return;
    }

    try {
        const res = await fetch(`${BACKEND}/api/leads/schedules/pending`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('Failed to fetch schedules');

        const data = await res.json();
        currentSchedules = data.schedules || [];

        // Check if any schedules are paused
        isPaused = currentSchedules.some(s => s.status === 'paused');

        renderScheduleCard();
        startCountdownTimer();

    } catch (err) {
        console.error('Error loading schedules:', err);
        showEmptyState();
    } finally {
        cardSkeleton.style.display = 'none';
        cardContent.style.display = 'flex';
    }
}

function renderScheduleCard() {
    const activeCount = currentSchedules.filter(s => s.status === 'pending').length;
    const pausedCount = currentSchedules.filter(s => s.status === 'paused').length;

    if (currentSchedules.length === 0) {
        showEmptyState();
        toggleInput.checked = false;
        toggleInput.disabled = true;
        return;
    }

    toggleInput.disabled = false;
    emptyState.style.display = 'none';
    countdownDisplay.style.display = 'block';

    if (isPaused) {
        scheduleCard.classList.add('paused');
        scheduleCount.textContent = `${pausedCount} paused, ${activeCount} active`;
        nextSendTime.textContent = '--:--';
        toggleInput.checked = false;
    } else {
        scheduleCard.classList.remove('paused');
        scheduleCount.textContent = `${activeCount} active schedule${activeCount !== 1 ? 's' : ''}`;
        toggleInput.checked = true;
    }
}

function showEmptyState() {
    emptyState.style.display = 'flex';
    countdownDisplay.style.display = 'none';
    scheduleCount.textContent = 'No active schedules';
    nextSendTime.textContent = '--:--';
    toggleInput.checked = false;
    toggleInput.disabled = true;
}

// ── Countdown Timer ──
function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);

    if (isPaused || currentSchedules.length === 0) {
        nextSendTime.textContent = '--:--';
        return;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const pendingSchedules = currentSchedules.filter(s => s.status === 'pending');
    if (pendingSchedules.length === 0) {
        nextSendTime.textContent = '--:--';
        return;
    }

    // Find earliest scheduled time
    const earliest = pendingSchedules.reduce((min, s) => {
        const time = new Date(s.scheduledAt).getTime();
        return time < min ? time : min;
    }, Infinity);

    const now = Date.now();
    const diff = earliest - now;

    if (diff <= 0) {
        nextSendTime.textContent = 'Sending...';
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let timeStr = '';
    if (hours > 0) timeStr += `${hours}h `;
    if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
    timeStr += `${seconds}s`;

    nextSendTime.textContent = timeStr.trim();
}

// ── Toggle Handler ──
if (automationToggle) {
    toggleInput.addEventListener('change', async function() {
        const shouldBeOn = this.checked;

        if (shouldBeOn && isPaused) {
            // Resume
            await handleResume();
        } else if (!shouldBeOn && !isPaused) {
            // Show warning before turning off
            this.checked = true; // Revert temporarily
            warningModalOverlay.style.display = 'flex';
        }
    });
}

async function handleResume() {
    try {
        toggleInput.disabled = true;
        const res = await fetch(`${BACKEND}/api/automation/resume`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) throw new Error('Failed to resume');

        isPaused = false;
        await loadSchedules();
        showToast('✅ Automation resumed successfully', 'success');

    } catch (err) {
        console.error('Resume error:', err);
        showToast('❌ Failed to resume automation', 'error');
        toggleInput.checked = false;
    } finally {
        toggleInput.disabled = false;
    }
}

// ── Warning Modal Handlers ──
if (cancelWarningBtn) {
    cancelWarningBtn.addEventListener('click', () => {
        warningModalOverlay.style.display = 'none';
    });
}

if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', async () => {
        try {
            confirmCancelBtn.disabled = true;
            confirmCancelBtn.textContent = 'Cancelling...';

            const res = await fetch(`${BACKEND}/api/automation/cancel`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (!res.ok) throw new Error('Failed to cancel');

            warningModalOverlay.style.display = 'none';
            currentSchedules = [];
            isPaused = false;
            renderScheduleCard();
            startCountdownTimer();
            showToast('🗑️ All schedules cancelled', 'info');

        } catch (err) {
            console.error('Cancel error:', err);
            showToast('❌ Failed to cancel schedules', 'error');
        } finally {
            confirmCancelBtn.disabled = false;
            confirmCancelBtn.textContent = 'Yes, Cancel All';
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
document.addEventListener('DOMContentLoaded', loadSchedules);

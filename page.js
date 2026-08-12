// ============================================================
// DIRECT BACKEND CONNECTION - Notification Badge (RED DOT)
// 1 MINUTE localStorage CACHE - Auto-fetch every 50 seconds
// ============================================================

var BADGE_BACKEND = 'https://skylineapp-backend-file.onrender.com';
var BADGE_KEY = 'notif_has_unread';
var BADGE_TIME_KEY = 'notif_last_check';
var CACHE_DURATION = 60000; // 1 minute (60,000 ms)
var FETCH_INTERVAL = 50000; // 50 seconds (fetch before cache expires)
var BADGE_FETCH_INTERVAL = null;

// ─── Get token ───
function getToken() {
    return localStorage.getItem('token');
}

// ─── Get stored badge state from localStorage ───
function getStoredBadgeState() {
    var hasUnread = localStorage.getItem(BADGE_KEY);
    var lastCheck = localStorage.getItem(BADGE_TIME_KEY);
    
    if (hasUnread === null || lastCheck === null) return null;
    
    // Check if cache is still valid (less than 1 minute old)
    var age = Date.now() - parseInt(lastCheck);
    if (age > CACHE_DURATION) {
        // Cache expired - clear it
        localStorage.removeItem(BADGE_KEY);
        localStorage.removeItem(BADGE_TIME_KEY);
        return null;
    }
    
    return hasUnread === 'true';
}

// ─── Save badge state to localStorage ───
function saveBadgeState(hasUnread) {
    localStorage.setItem(BADGE_KEY, hasUnread ? 'true' : 'false');
    localStorage.setItem(BADGE_TIME_KEY, String(Date.now()));
}

// ─── Clear badge state ───
function clearBadgeState() {
    localStorage.removeItem(BADGE_KEY);
    localStorage.removeItem(BADGE_TIME_KEY);
}

// ─── Update badge UI (RED DOT - no number) ───
function updateBadgeUI(hasUnread) {
    var badges = document.querySelectorAll('.nav-badge');
    if (badges.length === 0) return;

    badges.forEach(function(badge) {
        if (hasUnread) {
            // ✅ RED DOT only - no number
            badge.textContent = '';
            badge.style.display = 'flex';
            badge.style.background = '#ff5555';
            badge.style.width = '10px';
            badge.style.height = '10px';
            badge.style.minWidth = '10px';
            badge.style.borderRadius = '50%';
            badge.style.padding = '0';
            badge.style.fontSize = '0';
            badge.style.lineHeight = '0';
            var parent = badge.closest('.nav-item');
            if (parent) parent.classList.add('has-notifs');
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
            badge.style.width = '';
            badge.style.height = '';
            badge.style.minWidth = '';
            badge.style.borderRadius = '';
            badge.style.padding = '';
            badge.style.fontSize = '';
            badge.style.lineHeight = '';
            var parent = badge.closest('.nav-item');
            if (parent) parent.classList.remove('has-notifs');
        }
    });
}

// ─── FETCH UNREAD COUNT FROM BACKEND ───
function fetchBadgeCount() {
    var token = getToken();
    if (!token) {
        clearBadgeState();
        updateBadgeUI(false);
        return;
    }

    fetch(BADGE_BACKEND + '/api/notifications/count', {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                clearBadgeState();
                updateBadgeUI(false);
                return;
            }
            // Use stored state if available
            var stored = getStoredBadgeState();
            if (stored !== null) {
                updateBadgeUI(stored);
            }
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var count = data.count || 0;
        var hasUnread = count > 0;
        
        // ✅ Save to localStorage with timestamp
        saveBadgeState(hasUnread);
        
        // ✅ Update UI
        updateBadgeUI(hasUnread);
        
        console.log('🔔 [BADGE] Unread:', count, '→', hasUnread ? '🔴 RED DOT' : '⚪ No dot');
    })
    .catch(function() {
        // On error, use stored state if available
        var stored = getStoredBadgeState();
        if (stored !== null) {
            updateBadgeUI(stored);
        } else {
            updateBadgeUI(false);
        }
    });
}

// ─── SSE Real-time (instant updates) ───
var sseConnection = null;
var reconnectAttempts = 0;

function connectBadgeSSE() {
    var token = getToken();
    if (!token) return;

    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }

    try {
        sseConnection = new EventSource(BADGE_BACKEND + '/api/events/stream?token=' + encodeURIComponent(token));

        sseConnection.addEventListener('open', function() {
            console.log('✅ [BADGE SSE] Connected');
            reconnectAttempts = 0;
        });

        sseConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    // ✅ Instant update from SSE
                    fetchBadgeCount();
                }
            } catch (err) { /* ignore */ }
        });

        sseConnection.addEventListener('error', function() {
            if (sseConnection) {
                sseConnection.close();
                sseConnection = null;
            }
            reconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            if (reconnectAttempts <= 5) {
                setTimeout(connectBadgeSSE, delay);
            }
        });

    } catch (err) {
        console.error('[BADGE SSE] Error:', err.message);
    }
}

// ─── Storage listener (sync across tabs) ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === BADGE_KEY || e.key === BADGE_TIME_KEY) {
            var stored = getStoredBadgeState();
            if (stored !== null) {
                updateBadgeUI(stored);
            }
        }
    });
}

// ─── Clean up ───
function cleanupBadge() {
    if (BADGE_FETCH_INTERVAL) {
        clearInterval(BADGE_FETCH_INTERVAL);
        BADGE_FETCH_INTERVAL = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
}

// ─── Notification click handler ───
function setupNotifClick() {
    var btn = document.getElementById('navNotifBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var href = this.getAttribute('href');
        if (href && href.includes('notifications.html')) {
            // ✅ Clear badge state when user clicks to view notifications
            clearBadgeState();
            updateBadgeUI(false);
        }
    });
}

// ─── ✅ START AUTO-FETCH ───
function startAutoFetch() {
    // Clear any existing interval
    if (BADGE_FETCH_INTERVAL) {
        clearInterval(BADGE_FETCH_INTERVAL);
        BADGE_FETCH_INTERVAL = null;
    }

    // ✅ Check cache first
    var cached = getStoredBadgeState();
    if (cached !== null) {
        updateBadgeUI(cached);
        console.log('🔔 [BADGE] Loaded from cache:', cached ? '🔴 RED DOT' : '⚪ No dot');
    }

    // ✅ Fetch immediately on start
    fetchBadgeCount();

    // ✅ Then fetch every 50 seconds (before cache expires at 60s)
    BADGE_FETCH_INTERVAL = setInterval(function() {
        fetchBadgeCount();
    }, FETCH_INTERVAL);

    console.log('✅ [BADGE] Auto-fetch started (every 50 seconds, cache 1 minute)');
}

// ============================================================
// PAGE-SPECIFIC SCRIPT
// ============================================================

// ── CONFIG ─
const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

// ── STATE ─
let currentMode = 'lead';
let currentSessionId = new URLSearchParams(window.location.search).get('session');
let conversationHistory = [];
let isTyping = false;
let currentGeneratedLeads = [];
let statusInterval = null;
let assistantSessionId = null;
let assistantConversationHistory = [];

// ✅ PERF: Cache API responses — skip slow DB hits if data is fresh
var _cachedPlan = null;
var _cachedPlanTime = 0;
var _cachedStatus = null;
var _cachedStatusTime = 0;
var CACHE_TTL = 60000; // 60 seconds

// ──────────────────────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────

function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollDown(container) {
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function showToast(message, type = 'info', duration = 4000) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(message) : esc(message);
    const colors = {
        success: { bg: 'rgba(0,230,118,0.12)', border: '#00e676', text: '#00e676' },
        error: { bg: 'rgba(255,77,77,0.12)', border: '#ff4d4d', text: '#ff4d4d' },
        warning: { bg: 'rgba(255,170,0,0.12)', border: '#ffaa00', text: '#ffaa00' },
        info: { bg: 'rgba(0,210,255,0.12)', border: '#00d2ff', text: '#00d2ff' }
    };
    const color = colors[type] || colors.info;
    Object.assign(toast.style, {
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        padding: '12px 24px', borderRadius: '8px',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: '600',
        zIndex: '9999', maxWidth: '90%', textAlign: 'center',
        background: color.bg, border: '1px solid ' + color.border, color: color.text,
        animation: 'slideDown 0.3s ease'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function formatAI(text) {
    if (!text) return '';
    let s = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(text) : esc(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, m => `<ul class="ai-ul">${m}</ul>`);
    s = s.replace(/\n/g, '<br>');
    return s;
}

// ──────────────────────────────────────────────────────────────
//  MODE SWITCHING
// ──────────────────────────────────────────────────────────────

function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    document.getElementById('leadModeBtn').classList.toggle('active', mode === 'lead');
    document.getElementById('assistantModeBtn').classList.toggle('active', mode === 'assistant');
    document.getElementById('leadModeContainer').classList.toggle('active', mode === 'lead');
    document.getElementById('assistantModeContainer').classList.toggle('active', mode === 'assistant');
    document.querySelector('.topbar-label').textContent = mode === 'lead' ? 'Lead Search' : 'Assistant Chat';
}

// ──────────────────────────────────────────────────────────────
//  LEAD MODE FUNCTIONS
// ──────────────────────────────────────────────────────────────

const leadMsgContainer = document.getElementById('leadMsgContainer');
const leadChatArea = document.getElementById('leadChatArea');
const leadInputBar = document.getElementById('leadInputBar');
const leadMsgInput = document.getElementById('leadMsgInput');
const leadSendBtn = document.getElementById('leadSendBtn');
const leadCharCount = document.getElementById('leadCharCount');

function appendLeadMsg(role, content) {
    const container = leadMsgContainer;
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    let displayContent;
    if (role === 'ai') {
        displayContent = formatAI(content);
    } else {
        displayContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content);
    }
    row.innerHTML = `
        <div class="av">${role === 'ai' ? 'AI' : 'ME'}</div>
        <div class="bubble-wrap">
            <div class="bubble">${displayContent}</div>
            <div class="msg-time">${now()}</div>
        </div>`;
    container.appendChild(row);
    scrollDown(leadChatArea);
}

function showLeadTyping(label = 'Thinking…') {
    let row = document.getElementById('leadTypingRow');
    if (row) {
        const lbl = row.querySelector('.t-label');
        if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label);
        scrollDown(leadChatArea);
        return;
    }
    row = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'leadTypingRow';
    row.innerHTML = `
        <div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div>
        <div class="typing-bubble">
            <span class="t-label">${esc(label)}</span>
            <div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>
        </div>`;
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function hideLeadTyping() { document.getElementById('leadTypingRow')?.remove(); }

function updateLeadSend() {
    leadSendBtn.disabled = !leadMsgInput.value.trim() || isTyping;
}

leadMsgInput.addEventListener('input', () => {
    leadMsgInput.style.height = 'auto';
    leadMsgInput.style.height = Math.min(leadMsgInput.scrollHeight, 130) + 'px';
    updateLeadSend();
    leadCharCount.textContent = leadMsgInput.value.length || '';
});

leadMsgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!leadSendBtn.disabled) sendLeadMessage();
    }
});

leadSendBtn.addEventListener('click', sendLeadMessage);

async function sendLeadMessage() {
    const text = leadMsgInput.value.trim();
    if (!text || isTyping) return;
    appendLeadMsg('user', text);
    leadMsgInput.value = '';
    leadMsgInput.style.height = 'auto';
    updateLeadSend();
    await fetchLeadResponse(text);
}

async function fetchLeadResponse(message) {
    isTyping = true;
    updateLeadSend();
    const steps = ['Searching…', 'Filtering results…', 'Finding decision-makers…', 'Finalising…'];
    let si = 0;
    showLeadTyping(steps[0]);
    statusInterval = setInterval(() => {
        si++;
        if (si < steps.length) showLeadTyping(steps[si]);
    }, 2500);

    try {
        const res = await fetch(`${BACKEND}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ message, history: conversationHistory, sessionId: currentSessionId })
        });
        const data = await res.json();
        clearInterval(statusInterval);
        hideLeadTyping();

        if (res.ok) {
            if (data.sessionId && !currentSessionId) {
                currentSessionId = data.sessionId;
                const url = new URL(window.location);
                url.searchParams.set('session', data.sessionId);
                window.history.pushState({}, '', url);
            }
            if (data.history) conversationHistory = data.history;
            appendLeadMsg('ai', data.reply || "Request received. How can I help further?");
        } else {
            appendLeadMsg('ai', `⚠️ ${data.message || 'Unable to process. Please try again.'}`);
        }
    } catch {
        clearInterval(statusInterval);
        hideLeadTyping();
        appendLeadMsg('ai', '🔌 Connection error — check your network and try again.');
    } finally {
        isTyping = false;
        updateLeadSend();
    }
}

// ──────────────────────────────────────────────────────────────
//  ASSISTANT MODE FUNCTIONS
// ──────────────────────────────────────────────────────────────

const assistantMsgContainer = document.getElementById('assistantMsgContainer');
const assistantChatArea = document.getElementById('assistantChatArea');
const assistantInputBar = document.getElementById('assistantInputBar');
const assistantMsgInput = document.getElementById('assistantMsgInput');
const assistantSendBtn = document.getElementById('assistantSendBtn');
const assistantCharCount = document.getElementById('assistantCharCount');

function appendAssistantMsg(role, content) {
    const container = assistantMsgContainer;
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    let displayContent;
    if (role === 'ai') {
        displayContent = formatAI(content);
    } else {
        displayContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content);
    }
    row.innerHTML = `
        <div class="av">${role === 'ai' ? 'AI' : 'ME'}</div>
        <div class="bubble-wrap">
            <div class="bubble">${displayContent}</div>
            <div class="msg-time">${now()}</div>
        </div>`;
    container.appendChild(row);
    scrollDown(assistantChatArea);
}

function showAssistantTyping(label = 'Thinking…') {
    let row = document.getElementById('assistantTypingRow');
    if (row) {
        const lbl = row.querySelector('.t-label');
        if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label);
        scrollDown(assistantChatArea);
        return;
    }
    row = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'assistantTypingRow';
    row.innerHTML = `
        <div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div>
        <div class="typing-bubble">
            <span class="t-label">${esc(label)}</span>
            <div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>
        </div>`;
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function hideAssistantTyping() { document.getElementById('assistantTypingRow')?.remove(); }

function updateAssistantSend() {
    assistantSendBtn.disabled = !assistantMsgInput.value.trim() || isTyping;
}

assistantMsgInput.addEventListener('input', () => {
    assistantMsgInput.style.height = 'auto';
    assistantMsgInput.style.height = Math.min(assistantMsgInput.scrollHeight, 130) + 'px';
    updateAssistantSend();
    assistantCharCount.textContent = assistantMsgInput.value.length || '';
});

assistantMsgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!assistantSendBtn.disabled) sendAssistantMessage();
    }
});

assistantSendBtn.addEventListener('click', sendAssistantMessage);

async function sendAssistantMessage() {
    const text = assistantMsgInput.value.trim();
    if (!text || isTyping) return;
    appendAssistantMsg('user', text);
    assistantMsgInput.value = '';
    assistantMsgInput.style.height = 'auto';
    updateAssistantSend();
    await fetchAssistantResponse(text);
}

async function fetchAssistantResponse(message) {
    isTyping = true;
    updateAssistantSend();
    showAssistantTyping('Thinking…');

    try {
        const res = await fetch(`${BACKEND}/api/assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ message, sessionId: assistantSessionId })
        });
        const data = await res.json();
        hideAssistantTyping();

        if (res.ok) {
            if (data.sessionId) assistantSessionId = data.sessionId;
            appendAssistantMsg('ai', data.response || "I couldn't process that. Please try again.");
        } else {
            appendAssistantMsg('ai', `⚠️ ${data.message || 'Something went wrong.'}`);
        }
    } catch {
        hideAssistantTyping();
        appendAssistantMsg('ai', '🔌 Connection error — check your network and try again.');
    } finally {
        isTyping = false;
        updateAssistantSend();
    }
}

// ──────────────────────────────────────────────────────────────
//  LOAD SESSION
// ──────────────────────────────────────────────────────────────

async function loadLeadSession() {
    if (!currentSessionId) return;
    try {
        const res = await fetch(`${BACKEND}/api/history/${currentSessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const msgs = await res.json();
            if (msgs?.length) {
                leadMsgContainer.innerHTML = '';
                for (const m of msgs) {
                    const role = m.role === 'ai' ? 'ai' : 'user';
                    appendLeadMsg(role, m.content);
                    conversationHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: m.content });
                }
                scrollDown(leadChatArea);
            }
        }
    } catch {}
}

// ──────────────────────────────────────────────────────────────
//  ✅ PERF #4: CHECK PLAN — cached, skips API if data < 60s old
// ──────────────────────────────────────────────────────────────

function checkPlan() {
    var now_ts = Date.now();
    if (_cachedPlan && (now_ts - _cachedPlanTime) < CACHE_TTL) {
        var p = _cachedPlan;
        planChip.className = 'plan-chip ' + p;
        planChip.textContent = p === 'go' ? 'GO' : p === 'pro' ? 'PRO' : 'FREE';
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(user) {
        if (user) {
            var p = user.subscriptionTier || 'free';
            _cachedPlan = p;
            _cachedPlanTime = Date.now();
            planChip.className = 'plan-chip ' + p;
            planChip.textContent = p === 'go' ? 'GO' : p === 'pro' ? 'PRO' : 'FREE';
        }
    }).catch(function() {});
}

// ──────────────────────────────────────────────────────────────
//  ✅ PERF #4: UPDATE STATUS — cached, skips API if data < 60s old
// ──────────────────────────────────────────────────────────────

function updateStatus() {
    var now_ts = Date.now();
    if (_cachedStatus && (now_ts - _cachedStatusTime) < CACHE_TTL) {
        applyStatus(_cachedStatus);
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/auth/nylas/status', { headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
        if (data) { _cachedStatus = data; _cachedStatusTime = Date.now(); applyStatus(data); }
    })
    .catch(function() {
        var txt = document.getElementById('statusText');
        if (txt) txt.textContent = '⚠️ Status unknown';
    });
}

function applyStatus(data) {
    var bar = document.getElementById('statusBar');
    var txt = document.getElementById('statusText');
    if (data.connected && !data.isExpired) {
        bar.className = 'status-bar connected';
        txt.textContent = data.email ? '✅ Connected as ' + data.email : '✅ Email connected';
    } else if (data.connected && data.isExpired) {
        bar.className = 'status-bar disconnected';
        txt.textContent = '⚠️ Session expired — Reconnect in Dashboard';
    } else {
        bar.className = 'status-bar disconnected';
        txt.textContent = '❌ No email connected — Connect in Dashboard';
    }
}

// ──────────────────────────────────────────────────────────────
//  CLEAR CHAT
// ──────────────────────────────────────────────────────────────

function clearChat() {
    leadMsgContainer.innerHTML = '';
    conversationHistory = [];
    currentGeneratedLeads = [];
    currentSessionId = null;
    assistantMsgContainer.innerHTML = '';
    assistantSessionId = null;
    assistantConversationHistory = [];
    _cachedPlan = null;
    _cachedPlanTime = 0;
    _cachedStatus = null;
    _cachedStatusTime = 0;

    document.getElementById('setupWizard').style.display = 'flex';
    leadChatArea.classList.remove('active');
    leadInputBar.classList.remove('active');

    assistantMsgContainer.innerHTML = `
        <div class="msg-row ai">
            <div class="av">AI</div>
            <div class="bubble-wrap">
                <div class="bubble">👋 Hello! I'm your business assistant. Ask me anything about your business, leads, or strategy!</div>
                <div class="msg-time">Just now</div>
            </div>
        </div>`;

    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url);
}

// ──────────────────────────────────────────────────────────────
//  ✅ INIT — parallel API calls
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // ✅ Start badge auto-fetch with cache
    startAutoFetch();

    // ✅ Connect SSE for instant updates (bonus)
    connectBadgeSSE();

    // Storage listener for cross-tab sync
    setupStorageListener();

    // Notification click handler
    setupNotifClick();

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanupBadge);

    document.getElementById('clearSessionBtn').addEventListener('click', e => { e.preventDefault(); clearChat(); });
    document.getElementById('newChatBtn').addEventListener('click', e => { e.preventDefault(); clearChat(); });

    // ✅ Fire initial API calls in parallel
    Promise.all([checkPlan(), updateStatus()]).catch(function() {});

    // ✅ Status polling every 120 seconds
    statusInterval = setInterval(updateStatus, 120000);

    // ─── LEAD MODE FORM ───
    document.getElementById('targetForm').addEventListener('submit', async e => {
        e.preventDefault();
        const industry = document.getElementById('industry').value.trim();
        const region = document.getElementById('region').value.trim();
        const companySize = document.getElementById('companySize').value;
        const jobTitle = document.getElementById('jobTitle').value.trim();
        const msg = `Find me ${jobTitle}s in the ${industry} industry, located in ${region}. Company size: ${companySize}.`;
        document.getElementById('setupWizard').style.display = 'none';
        leadChatArea.classList.add('active');
        leadInputBar.classList.add('active');
        appendLeadMsg('user', msg);
        await fetchLeadResponse(msg);
    });

    // ─── LOAD SESSION ───
    if (currentSessionId) {
        document.getElementById('setupWizard').style.display = 'none';
        leadChatArea.classList.add('active');
        leadInputBar.classList.add('active');
        await loadLeadSession();
    }

    // ─── INITIAL STATE ───
    switchMode('lead');

    window.switchMode = switchMode;
    window.clearChat = clearChat;
    window.sendAllEmails = function() { showToast('Send all emails function', 'info', 2000); };

    console.log('✅ [PAGE] Loaded with direct backend connection for badge');
});

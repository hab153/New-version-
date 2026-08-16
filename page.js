// ============================================================
// page.js - Skyline AA-1 Business Agent (FAST)
// Simplified - No cache layer, just localStorage
// ============================================================

// ── CONFIG 
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

// ✅ SIMPLE localStorage CACHING (no memory cache)
const CACHE_KEYS = {
    DASHBOARD: 'page_cached_dashboard',
    DASHBOARD_TIME: 'page_cached_dashboard_time',
    SESSION: (id) => `page_session_${id}`,
    SESSION_TIME: (id) => `page_session_time_${id}`,
};
const CACHE_TTL = 300000; // 5 minutes

// ──────────────────────────────────────────────────────────────
//  ✅ SIMPLE CACHED HELPERS
// ──────────────────────────────────────────────────────────────

function getCached(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch { return null; }
}

function setCached(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch { /* ignore */ }
}

function getCachedWithTTL(key, timeKey) {
    const data = getCached(key);
    const time = getCached(timeKey);
    if (data && time && (Date.now() - time) < CACHE_TTL) {
        return data;
    }
    return null;
}

function setCachedWithTTL(key, timeKey, data) {
    setCached(key, data);
    setCached(timeKey, Date.now());
}

function clearCache() {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('page_cached_') || key.startsWith('page_session_')) {
            localStorage.removeItem(key);
        }
    });
}

// ──────────────────────────────────────────────────────────────
//  ✅ SKELETON LOADER
// ──────────────────────────────────────────────────────────────

function showSkeleton() {
    document.body.classList.add('loaded');
}

function hideSkeleton() {
    document.body.classList.add('content-loaded');
}

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

function showToast(message, type, duration) {
    type = type || 'info'; duration = duration || 4000;
    var existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(message) : esc(message);
    var colors = {
        success: { bg: 'rgba(0,230,118,0.12)', border: '#00e676', text: '#00e676' },
        error: { bg: 'rgba(255,77,77,0.12)', border: '#ff4d4d', text: '#ff4d4d' },
        warning: { bg: 'rgba(255,170,0,0.12)', border: '#ffaa00', text: '#ffaa00' },
        info: { bg: 'rgba(0,210,255,0.12)', border: '#00d2ff', text: '#00d2ff' }
    };
    var color = colors[type] || colors.info;
    Object.assign(toast.style, {
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        padding: '12px 24px', borderRadius: '8px',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', fontWeight: '600',
        zIndex: '9999', maxWidth: '90%', textAlign: 'center',
        background: color.bg, border: '1px solid ' + color.border, color: color.text,
        animation: 'slideDown 0.3s ease'
    });
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, duration);
}

function formatAI(text) {
    if (!text) return '';
    var s = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(text) : esc(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, function(m) { return '<ul class="ai-ul">' + m + '</ul>'; });
    s = s.replace(/\n/g, '<br>');
    return s;
}

// ──────────────────────────────────────────────────────────────
//  MODE SWITCHING
// ──────────────────────────────────────────────────────────────

function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    var leadBtn = document.getElementById('leadModeBtn');
    var assistantBtn = document.getElementById('assistantModeBtn');
    var leadContainer = document.getElementById('leadModeContainer');
    var assistantContainer = document.getElementById('assistantModeContainer');
    if (leadBtn) leadBtn.classList.toggle('active', mode === 'lead');
    if (assistantBtn) assistantBtn.classList.toggle('active', mode === 'assistant');
    if (leadContainer) leadContainer.classList.toggle('active', mode === 'lead');
    if (assistantContainer) assistantContainer.classList.toggle('active', mode === 'assistant');
    var label = document.querySelector('.topbar-label');
    if (label) label.textContent = mode === 'lead' ? 'Lead Search' : 'Assistant Chat';
}

// ──────────────────────────────────────────────────────────────
//  LEAD MODE FUNCTIONS
// ──────────────────────────────────────────────────────────────

var leadMsgContainer = document.getElementById('leadMsgContainer');
var leadChatArea = document.getElementById('leadChatArea');
var leadInputBar = document.getElementById('leadInputBar');
var leadMsgInput = document.getElementById('leadMsgInput');
var leadSendBtn = document.getElementById('leadSendBtn');
var leadCharCount = document.getElementById('leadCharCount');

function appendLeadMsg(role, content) {
    if (!leadMsgContainer) return;
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = role === 'ai' ? formatAI(content) : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content));
    row.innerHTML = '<div class="av">' + (role === 'ai' ? 'AI' : 'ME') + '</div><div class="bubble-wrap"><div class="bubble">' + displayContent + '</div><div class="msg-time">' + now() + '</div></div>';
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function showLeadTyping(label) {
    label = label || 'Thinking…';
    if (!leadMsgContainer) return;
    var row = document.getElementById('leadTypingRow');
    if (row) { 
        var lbl = row.querySelector('.t-label'); 
        if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label); 
        scrollDown(leadChatArea); 
        return; 
    }
    row = document.createElement('div'); 
    row.className = 'typing-row'; 
    row.id = 'leadTypingRow';
    row.innerHTML = '<div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div><div class="typing-bubble"><span class="t-label">' + esc(label) + '</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>';
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function hideLeadTyping() { 
    var r = document.getElementById('leadTypingRow'); 
    if (r) r.remove(); 
}

function updateLeadSend() { 
    if (leadSendBtn) leadSendBtn.disabled = !leadMsgInput.value.trim() || isTyping; 
}

if (leadMsgInput) {
    leadMsgInput.addEventListener('input', function() { 
        leadMsgInput.style.height = 'auto'; 
        leadMsgInput.style.height = Math.min(leadMsgInput.scrollHeight, 130) + 'px'; 
        updateLeadSend(); 
        if (leadCharCount) leadCharCount.textContent = leadMsgInput.value.length || ''; 
    });
    leadMsgInput.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            if (!leadSendBtn.disabled) sendLeadMessage(); 
        } 
    });
}
if (leadSendBtn) leadSendBtn.addEventListener('click', sendLeadMessage);

function sendLeadMessage() {
    var text = leadMsgInput.value.trim();
    if (!text || isTyping) return;
    appendLeadMsg('user', text); 
    leadMsgInput.value = ''; 
    leadMsgInput.style.height = 'auto'; 
    updateLeadSend();
    fetchLeadResponse(text);
}

function fetchLeadResponse(message) {
    isTyping = true; 
    updateLeadSend();
    var steps = ['Searching…', 'Filtering results…', 'Finding decision-makers…', 'Finalising…'];
    var si = 0; 
    showLeadTyping(steps[0]);
    statusInterval = setInterval(function() { si++; if (si < steps.length) showLeadTyping(steps[si]); }, 2500);
    fetch(BACKEND + '/api/chat', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
        body: JSON.stringify({ message: message, history: conversationHistory, sessionId: currentSessionId }) 
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        clearInterval(statusInterval); 
        hideLeadTyping();
        if (data.sessionId && !currentSessionId) { 
            currentSessionId = data.sessionId; 
            var url = new URL(window.location); 
            url.searchParams.set('session', data.sessionId); 
            window.history.pushState({}, '', url); 
        }
        if (data.history) conversationHistory = data.history;
        appendLeadMsg('ai', data.reply || "Request received. How can I help further?");
    })
    .catch(function() { 
        clearInterval(statusInterval); 
        hideLeadTyping(); 
        appendLeadMsg('ai', '🔌 Connection error — check your network and try again.'); 
    })
    .finally(function() { 
        isTyping = false; 
        updateLeadSend(); 
    });
}

// ──────────────────────────────────────────────────────────────
//  ASSISTANT MODE FUNCTIONS
// ──────────────────────────────────────────────────────────────

var assistantMsgContainer = document.getElementById('assistantMsgContainer');
var assistantChatArea = document.getElementById('assistantChatArea');
var assistantInputBar = document.getElementById('assistantInputBar');
var assistantMsgInput = document.getElementById('assistantMsgInput');
var assistantSendBtn = document.getElementById('assistantSendBtn');
var assistantCharCount = document.getElementById('assistantCharCount');

function appendAssistantMsg(role, content) {
    if (!assistantMsgContainer) return;
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = role === 'ai' ? formatAI(content) : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content));
    row.innerHTML = '<div class="av">' + (role === 'ai' ? 'AI' : 'ME') + '</div><div class="bubble-wrap"><div class="bubble">' + displayContent + '</div><div class="msg-time">' + now() + '</div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function showAssistantTyping(label) {
    label = label || 'Thinking…';
    if (!assistantMsgContainer) return;
    var row = document.getElementById('assistantTypingRow');
    if (row) { 
        var lbl = row.querySelector('.t-label'); 
        if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label); 
        scrollDown(assistantChatArea); 
        return; 
    }
    row = document.createElement('div'); 
    row.className = 'typing-row'; 
    row.id = 'assistantTypingRow';
    row.innerHTML = '<div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div><div class="typing-bubble"><span class="t-label">' + esc(label) + '</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function hideAssistantTyping() { 
    var r = document.getElementById('assistantTypingRow'); 
    if (r) r.remove(); 
}

function updateAssistantSend() { 
    if (assistantSendBtn) assistantSendBtn.disabled = !assistantMsgInput.value.trim() || isTyping; 
}

if (assistantMsgInput) {
    assistantMsgInput.addEventListener('input', function() { 
        assistantMsgInput.style.height = 'auto'; 
        assistantMsgInput.style.height = Math.min(assistantMsgInput.scrollHeight, 130) + 'px'; 
        updateAssistantSend(); 
        if (assistantCharCount) assistantCharCount.textContent = assistantMsgInput.value.length || ''; 
    });
    assistantMsgInput.addEventListener('keydown', function(e) { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            if (!assistantSendBtn.disabled) sendAssistantMessage(); 
        } 
    });
}
if (assistantSendBtn) assistantSendBtn.addEventListener('click', sendAssistantMessage);

function sendAssistantMessage() {
    var text = assistantMsgInput.value.trim();
    if (!text || isTyping) return;
    appendAssistantMsg('user', text); 
    assistantMsgInput.value = ''; 
    assistantMsgInput.style.height = 'auto'; 
    updateAssistantSend();
    fetchAssistantResponse(text);
}

function fetchAssistantResponse(message) {
    isTyping = true; 
    updateAssistantSend(); 
    showAssistantTyping('Thinking…');
    fetch(BACKEND + '/api/assistant', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 
        body: JSON.stringify({ message: message, sessionId: assistantSessionId }) 
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        hideAssistantTyping();
        if (data.sessionId) assistantSessionId = data.sessionId;
        appendAssistantMsg('ai', data.response || "I couldn't process that. Please try again.");
    })
    .catch(function() { 
        hideAssistantTyping(); 
        appendAssistantMsg('ai', '🔌 Connection error — check your network and try again.'); 
    })
    .finally(function() { 
        isTyping = false; 
        updateAssistantSend(); 
    });
}

// ──────────────────────────────────────────────────────────────
//  ✅ FETCH DASHBOARD DATA (NO CACHE)
// ──────────────────────────────────────────────────────────────

function fetchDashboardData() {
    return fetch(BACKEND + '/api/user/dashboard-data', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            throw new Error('Failed to fetch dashboard data');
        }
        return res.json();
    })
    .then(function(data) {
        if (data) {
            applyDashboardData(data);
            return data;
        }
    })
    .catch(function(err) {
        console.warn('⚠️ [DASHBOARD] Failed to fetch:', err.message);
        return null;
    });
}

function applyDashboardData(data) {
    if (!data) return;
    
    // ✅ Apply plan
    applyPlan(data.subscription.tier);
    
    // ✅ Apply email status
    applyStatus(data.email);
    
    console.log('📊 [DASHBOARD] Data applied:', {
        tier: data.subscription.tier,
        emailConnected: data.email.connected,
        user: data.user.fullName
    });
}

function applyPlan(plan) {
    var chip = document.getElementById('planChip');
    if (!chip) return;
    chip.className = 'plan-chip ' + plan;
    chip.textContent = plan === 'go' ? 'GO' : plan === 'pro' ? 'PRO' : 'FREE';
}

function applyStatus(data) {
    var bar = document.getElementById('statusBar');
    var txt = document.getElementById('statusText');
    if (!bar || !txt) return;
    
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
//  ✅ LOAD SESSION (SIMPLE CACHE)
// ──────────────────────────────────────────────────────────────

function loadLeadSession() {
    if (!currentSessionId) return Promise.resolve();
    
    // ✅ Check cache first
    var cached = getCachedWithTTL(
        CACHE_KEYS.SESSION(currentSessionId),
        CACHE_KEYS.SESSION_TIME(currentSessionId)
    );
    
    if (cached && cached.length > 0) {
        renderMessages(cached);
        return Promise.resolve();
    }
    
    return fetch(BACKEND + '/api/history/' + currentSessionId, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(msgs) {
        if (msgs && msgs.length) {
            setCachedWithTTL(
                CACHE_KEYS.SESSION(currentSessionId),
                CACHE_KEYS.SESSION_TIME(currentSessionId),
                msgs
            );
            renderMessages(msgs);
        }
    })
    .catch(function() {});
}

function renderMessages(msgs) {
    if (!leadMsgContainer) return;
    leadMsgContainer.innerHTML = '';
    for (var i = 0; i < msgs.length; i++) {
        var role = msgs[i].role === 'ai' ? 'ai' : 'user';
        appendLeadMsg(role, msgs[i].content);
        conversationHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: msgs[i].content });
    }
    scrollDown(leadChatArea);
}

// ──────────────────────────────────────────────────────────────
//  CLEAR CHAT
// ──────────────────────────────────────────────────────────────

function clearChat() {
    if (leadMsgContainer) leadMsgContainer.innerHTML = '';
    conversationHistory = [];
    currentGeneratedLeads = [];
    currentSessionId = null;
    
    if (assistantMsgContainer) {
        assistantMsgContainer.innerHTML = '<div class="msg-row ai"><div class="av">AI</div><div class="bubble-wrap"><div class="bubble">👋 Hello! I\'m your business assistant. Ask me anything about your business, leads, or strategy!</div><div class="msg-time">Just now</div></div></div>';
    }
    assistantSessionId = null;
    assistantConversationHistory = [];
    
    // Clear cache
    clearCache();
    
    var setup = document.getElementById('setupWizard');
    if (setup) setup.style.display = 'flex';
    if (leadChatArea) leadChatArea.classList.remove('active');
    if (leadInputBar) leadInputBar.classList.remove('active');
    
    var url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url);
}

// ──────────────────────────────────────────────────────────────
//  ✅ FAST INIT - LOAD EVERYTHING IN PARALLEL
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 [PAGE] Starting fast load...');
    
    // ✅ STEP 1: Show skeleton immediately
    showSkeleton();
    
    // ✅ STEP 2: Set up event listeners
    var clearBtn = document.getElementById('clearSessionBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearChat();
        });
    }
    
    var newBtn = document.getElementById('newChatBtn');
    if (newBtn) {
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearChat();
        });
    }
    
    // ✅ STEP 3: Target form submit
    var targetForm = document.getElementById('targetForm');
    if (targetForm) {
        targetForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var industry = document.getElementById('industry').value.trim();
            var region = document.getElementById('region').value.trim();
            var companySize = document.getElementById('companySize').value;
            var jobTitle = document.getElementById('jobTitle').value.trim();
            var msg = 'Find me ' + jobTitle + 's in the ' + industry + ' industry, located in ' + region + '. Company size: ' + companySize + '.';
            var setup = document.getElementById('setupWizard');
            if (setup) setup.style.display = 'none';
            if (leadChatArea) leadChatArea.classList.add('active');
            if (leadInputBar) leadInputBar.classList.add('active');
            appendLeadMsg('user', msg);
            fetchLeadResponse(msg);
        });
    }
    
    // ✅ STEP 4: Set up UI based on session
    if (currentSessionId) {
        var setup = document.getElementById('setupWizard');
        if (setup) setup.style.display = 'none';
        if (leadChatArea) leadChatArea.classList.add('active');
        if (leadInputBar) leadInputBar.classList.add('active');
    } else {
        var setup = document.getElementById('setupWizard');
        if (setup) setup.style.display = 'flex';
    }
    
    // ✅ STEP 5: Load ALL data in PARALLEL (fastest)
    Promise.all([
        fetchDashboardData(),
        loadLeadSession()
    ]).then(function() {
        console.log('✅ [PAGE] All data loaded');
        hideSkeleton();
    }).catch(function(err) {
        console.warn('⚠️ [PAGE] Some data failed to load:', err);
        hideSkeleton();
    });
    
    // ✅ STEP 6: Periodic refresh (every 2 minutes)
    setInterval(function() {
        fetchDashboardData();
    }, 120000);
    
    // ✅ STEP 7: Set initial mode
    switchMode('lead');
    
    // ✅ STEP 8: Make functions global
    window.switchMode = switchMode;
    window.clearChat = clearChat;
    window.sendAllEmails = function() { 
        showToast('Send all emails function', 'info', 2000); 
    };
    
    console.log('✅ [PAGE] Ready');
});

// ─── Clean up on unload ───
window.addEventListener('beforeunload', function() {
    if (statusInterval) clearInterval(statusInterval);
});

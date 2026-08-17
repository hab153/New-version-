// ============================================================
// page.js - Skyline AA-1 Business Agent
// NOTIFICATION BUTTON RESTORED (Visual Only)
// WITH SKELETON LOADER SUPPORT
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

// ✅ PERF: Cache API responses (simplified - no complex cache)
var _cachedPlan = null;
var _cachedPlanTime = 0;
var _cachedStatus = null;
var _cachedStatusTime = 0;
var CACHE_TTL = 60000; // 60 seconds

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
//  ✅ NOTIFICATION BADGE - PERMANENT VISUAL ONLY
// ──────────────────────────────────────────────────────────────

console.log('✅ [PAGE] Notification button restored with permanent red dot.');

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
    document.getElementById('leadModeBtn').classList.toggle('active', mode === 'lead');
    document.getElementById('assistantModeBtn').classList.toggle('active', mode === 'assistant');
    document.getElementById('leadModeContainer').classList.toggle('active', mode === 'lead');
    document.getElementById('assistantModeContainer').classList.toggle('active', mode === 'assistant');
    document.querySelector('.topbar-label').textContent = mode === 'lead' ? 'Lead Search' : 'Assistant Chat';
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
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = role === 'ai' ? formatAI(content) : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content));
    row.innerHTML = '<div class="av">' + (role === 'ai' ? 'AI' : 'ME') + '</div><div class="bubble-wrap"><div class="bubble">' + displayContent + '</div><div class="msg-time">' + now() + '</div></div>';
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function showLeadTyping(label) {
    label = label || 'Thinking…';
    var row = document.getElementById('leadTypingRow');
    if (row) { var lbl = row.querySelector('.t-label'); if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label); scrollDown(leadChatArea); return; }
    row = document.createElement('div'); row.className = 'typing-row'; row.id = 'leadTypingRow';
    row.innerHTML = '<div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div><div class="typing-bubble"><span class="t-label">' + esc(label) + '</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>';
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function hideLeadTyping() { var r = document.getElementById('leadTypingRow'); if (r) r.remove(); }
function updateLeadSend() { leadSendBtn.disabled = !leadMsgInput.value.trim() || isTyping; }

leadMsgInput.addEventListener('input', function() { leadMsgInput.style.height = 'auto'; leadMsgInput.style.height = Math.min(leadMsgInput.scrollHeight, 130) + 'px'; updateLeadSend(); leadCharCount.textContent = leadMsgInput.value.length || ''; });
leadMsgInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!leadSendBtn.disabled) sendLeadMessage(); } });
leadSendBtn.addEventListener('click', sendLeadMessage);

function sendLeadMessage() {
    var text = leadMsgInput.value.trim();
    if (!text || isTyping) return;
    appendLeadMsg('user', text); leadMsgInput.value = ''; leadMsgInput.style.height = 'auto'; updateLeadSend();
    fetchLeadResponse(text);
}

function fetchLeadResponse(message) {
    isTyping = true; updateLeadSend();
    var steps = ['Searching…', 'Filtering results…', 'Finding decision-makers…', 'Finalising…'];
    var si = 0; showLeadTyping(steps[0]);
    statusInterval = setInterval(function() { si++; if (si < steps.length) showLeadTyping(steps[si]); }, 2500);
    fetch(BACKEND + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ message: message, history: conversationHistory, sessionId: currentSessionId }) })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        clearInterval(statusInterval); hideLeadTyping();
        if (data.sessionId && !currentSessionId) { currentSessionId = data.sessionId; var url = new URL(window.location); url.searchParams.set('session', data.sessionId); window.history.pushState({}, '', url); }
        if (data.history) conversationHistory = data.history;
        appendLeadMsg('ai', data.reply || "Request received. How can I help further?");
    })
    .catch(function() { clearInterval(statusInterval); hideLeadTyping(); appendLeadMsg('ai', '🔌 Connection error — check your network and try again.'); })
    .finally(function() { isTyping = false; updateLeadSend(); });
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
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = role === 'ai' ? formatAI(content) : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content));
    row.innerHTML = '<div class="av">' + (role === 'ai' ? 'AI' : 'ME') + '</div><div class="bubble-wrap"><div class="bubble">' + displayContent + '</div><div class="msg-time">' + now() + '</div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function showAssistantTyping(label) {
    label = label || 'Thinking…';
    var row = document.getElementById('assistantTypingRow');
    if (row) { var lbl = row.querySelector('.t-label'); if (lbl) lbl.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(label) : esc(label); scrollDown(assistantChatArea); return; }
    row = document.createElement('div'); row.className = 'typing-row'; row.id = 'assistantTypingRow';
    row.innerHTML = '<div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div><div class="typing-bubble"><span class="t-label">' + esc(label) + '</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function hideAssistantTyping() { var r = document.getElementById('assistantTypingRow'); if (r) r.remove(); }
function updateAssistantSend() { assistantSendBtn.disabled = !assistantMsgInput.value.trim() || isTyping; }

assistantMsgInput.addEventListener('input', function() { assistantMsgInput.style.height = 'auto'; assistantMsgInput.style.height = Math.min(assistantMsgInput.scrollHeight, 130) + 'px'; updateAssistantSend(); assistantCharCount.textContent = assistantMsgInput.value.length || ''; });
assistantMsgInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!assistantSendBtn.disabled) sendAssistantMessage(); } });
assistantSendBtn.addEventListener('click', sendAssistantMessage);

function sendAssistantMessage() {
    var text = assistantMsgInput.value.trim();
    if (!text || isTyping) return;
    appendAssistantMsg('user', text); assistantMsgInput.value = ''; assistantMsgInput.style.height = 'auto'; updateAssistantSend();
    fetchAssistantResponse(text);
}

function fetchAssistantResponse(message) {
    isTyping = true; updateAssistantSend(); showAssistantTyping('Thinking…');
    fetch(BACKEND + '/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ message: message, sessionId: assistantSessionId }) })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        hideAssistantTyping();
        if (data.sessionId) assistantSessionId = data.sessionId;
        appendAssistantMsg('ai', data.response || "I couldn't process that. Please try again.");
    })
    .catch(function() { hideAssistantTyping(); appendAssistantMsg('ai', '🔌 Connection error — check your network and try again.'); })
    .finally(function() { isTyping = false; updateAssistantSend(); });
}

// ──────────────────────────────────────────────────────────────
//  LOAD SESSION
// ──────────────────────────────────────────────────────────────

function loadLeadSession() {
    if (!currentSessionId) return Promise.resolve();
    return fetch(BACKEND + '/api/history/' + currentSessionId, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { if (res.ok) return res.json(); return null; })
    .then(function(msgs) {
        if (msgs && msgs.length) {
            leadMsgContainer.innerHTML = '';
            for (var i = 0; i < msgs.length; i++) { var role = msgs[i].role === 'ai' ? 'ai' : 'user'; appendLeadMsg(role, msgs[i].content); conversationHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: msgs[i].content }); }
            scrollDown(leadChatArea);
        }
    }).catch(function() {});
}

// ──────────────────────────────────────────────────────────────
//  CHECK PLAN — cached
// ──────────────────────────────────────────────────────────────

function checkPlan() {
    var now_ts = Date.now();
    if (_cachedPlan && (now_ts - _cachedPlanTime) < CACHE_TTL) { planChip.className = 'plan-chip ' + _cachedPlan; planChip.textContent = _cachedPlan === 'go' ? 'GO' : _cachedPlan === 'pro' ? 'PRO' : 'FREE'; return Promise.resolve(); }
    return fetch(BACKEND + '/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(user) { if (user) { var p = user.subscriptionTier || 'free'; _cachedPlan = p; _cachedPlanTime = Date.now(); planChip.className = 'plan-chip ' + p; planChip.textContent = p === 'go' ? 'GO' : p === 'pro' ? 'PRO' : 'FREE'; } })
    .catch(function() {});
}

// ──────────────────────────────────────────────────────────────
//  UPDATE STATUS — cached
// ──────────────────────────────────────────────────────────────

function updateStatus() {
    var now_ts = Date.now();
    if (_cachedStatus && (now_ts - _cachedStatusTime) < CACHE_TTL) { applyStatus(_cachedStatus); return Promise.resolve(); }
    return fetch(BACKEND + '/api/auth/nylas/status', { headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) { if (data) { _cachedStatus = data; _cachedStatusTime = Date.now(); applyStatus(data); } })
    .catch(function() { var txt = document.getElementById('statusText'); if (txt) txt.textContent = '⚠️ Status unknown'; });
}

function applyStatus(data) {
    var bar = document.getElementById('statusBar'); var txt = document.getElementById('statusText');
    if (data.connected && !data.isExpired) { bar.className = 'status-bar connected'; txt.textContent = data.email ? '✅ Connected as ' + data.email : '✅ Email connected'; }
    else if (data.connected && data.isExpired) { bar.className = 'status-bar disconnected'; txt.textContent = '⚠️ Session expired — Reconnect in Dashboard'; }
    else { bar.className = 'status-bar disconnected'; txt.textContent = '❌ No email connected — Connect in Dashboard'; }
}

// ──────────────────────────────────────────────────────────────
//  CLEAR CHAT
// ──────────────────────────────────────────────────────────────

function clearChat() {
    leadMsgContainer.innerHTML = ''; conversationHistory = []; currentGeneratedLeads = []; currentSessionId = null;
    assistantMsgContainer.innerHTML = ''; assistantSessionId = null; assistantConversationHistory = [];
    _cachedPlan = null; _cachedPlanTime = 0; _cachedStatus = null; _cachedStatusTime = 0;
    document.getElementById('setupWizard').style.display = 'flex'; leadChatArea.classList.remove('active'); leadInputBar.classList.remove('active');
    assistantMsgContainer.innerHTML = '<div class="msg-row ai"><div class="av">AI</div><div class="bubble-wrap"><div class="bubble">👋 Hello! I\'m your business assistant. Ask me anything about your business, leads, or strategy!</div><div class="msg-time">Just now</div></div></div>';
    var url = new URL(window.location); url.searchParams.delete('session'); window.history.pushState({}, '', url);
}

// ──────────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    // ✅ Show skeleton immediately
    showSkeleton();
    
    document.getElementById('clearSessionBtn').addEventListener('click', function(e) { e.preventDefault(); clearChat(); });
    document.getElementById('newChatBtn').addEventListener('click', function(e) { e.preventDefault(); clearChat(); });

    // ✅ Load data in parallel
    Promise.all([checkPlan(), updateStatus()])
        .then(function() {
            // ✅ Hide skeleton when data loads
            hideSkeleton();
        })
        .catch(function() {
            // ✅ Hide skeleton even if error
            hideSkeleton();
        });

    statusInterval = setInterval(updateStatus, 120000);

    document.getElementById('targetForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var industry = document.getElementById('industry').value.trim();
        var region = document.getElementById('region').value.trim();
        var companySize = document.getElementById('companySize').value;
        var jobTitle = document.getElementById('jobTitle').value.trim();
        var msg = 'Find me ' + jobTitle + 's in the ' + industry + ' industry, located in ' + region + '. Company size: ' + companySize + '.';
        document.getElementById('setupWizard').style.display = 'none'; leadChatArea.classList.add('active'); leadInputBar.classList.add('active');
        appendLeadMsg('user', msg); fetchLeadResponse(msg);
    });

    if (currentSessionId) { document.getElementById('setupWizard').style.display = 'none'; leadChatArea.classList.add('active'); leadInputBar.classList.add('active'); loadLeadSession(); }

    switchMode('lead');

    window.switchMode = switchMode;
    window.clearChat = clearChat;
    window.sendAllEmails = function() { showToast('Send all emails function', 'info', 2000); };

    console.log('✅ [PAGE] Loaded');

    window.addEventListener('beforeunload', function() {
        if (statusInterval) clearInterval(statusInterval);
    });
});

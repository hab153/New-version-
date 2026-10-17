// ============================================================
// page.js - Skyline · Nexa Business Agent
// ============================================================

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

var _cachedPlan = null;
var _cachedPlanTime = 0;
var _cachedStatus = null;
var _cachedStatusTime = 0;
var CACHE_TTL = 60000;

// ── STREAM STATE ─
var _activeEventSource = null;

// ──────────────────────────────────────────────────────────────
//  UTIL
// ──────────────────────────────────────────────────────────────

function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function scrollDown(container) { if (container) container.scrollTop = container.scrollHeight; }

function showToast(message, type, duration) {
    type = type || 'info'; duration = duration || 4000;
    var existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(message) : esc(message);
    var colors = {
        success: { bg: 'rgba(102,221,153,0.10)', border: 'rgba(102,221,153,0.5)', text: '#66dd99' },
        error:   { bg: 'rgba(255,85,85,0.10)',   border: 'rgba(255,85,85,0.5)',   text: '#ff5555' },
        warning: { bg: 'rgba(255,170,0,0.10)',   border: 'rgba(255,170,0,0.5)',   text: '#ffaa00' },
        info:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.2)', text: '#f5f5f5' }
    };
    var color = colors[type] || colors.info;
    Object.assign(toast.style, {
        background: color.bg, border: '1px solid ' + color.border, color: color.text
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

// Nexa avatar helper
function avatarFor(role) { return role === 'ai' ? 'N' : 'ME'; }

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
//  GUIDE MODAL
// ──────────────────────────────────────────────────────────────
function showGuide() {
    var m = document.getElementById('guideModal');
    if (!m) return;
    m.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function hideGuide() {
    var m = document.getElementById('guideModal');
    if (!m) return;
    m.style.display = 'none';
    document.body.style.overflow = '';
    // auto-focus input after dismiss
    setTimeout(function() {
        var inp = currentMode === 'lead' ? leadMsgInput : assistantMsgInput;
        if (inp) inp.focus();
    }, 120);
}

// ──────────────────────────────────────────────────────────────
//  STEPPER — pipeline progress indicator
// ──────────────────────────────────────────────────────────────
//
// The stepper reflects the real backend stage. Every visual change is
// triggered by a real SSE event — no fake timers, no simulated progress.
//
// The backend sends neutral stage IDs (s1..s7) and a `done` event. The
// stepper maps those IDs to display labels. When the pipeline finishes,
// the stepper fades out and the final reply is rendered as a chat bubble.

var STEPPER_STAGES = [
    { id: 's1', label: 'Understanding' },
    { id: 's2', label: 'Planning' },
    { id: 's3', label: 'Summary' },
    { id: 's4', label: 'Generation' },
    { id: 's5', label: 'Controlling' },
    { id: 's6', label: 'Search System' },
    { id: 's7', label: 'Verification' }
];

var _stepperBuilt = false;

// Build the stepper HTML once and mount it into #leadStepper
function initStepper() {
    if (_stepperBuilt) return;

    var container = document.getElementById('leadStepper');
    if (!container) return;

    var html = '';

    for (var i = 0; i < STEPPER_STAGES.length; i++) {
        var stage = STEPPER_STAGES[i];
        var isLast = i === STEPPER_STAGES.length - 1;

        html += '<div class="stepper-stage waiting" data-stage="' + stage.id + '">';
        html +=   '<div class="stepper-icon">';
        // Circle outline (waiting state)
        html +=     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">';
        html +=       '<circle cx="12" cy="12" r="8"/>';
        html +=     '</svg>';
        html +=   '</div>';
        html +=   '<div class="stepper-label">' + stage.label + '</div>';
        if (!isLast) {
            html += '<div class="stepper-connector"></div>';
        }
        html += '</div>';
    }

    container.innerHTML = html;
    _stepperBuilt = true;
}

// Show the stepper overlay
function showStepper() {
    initStepper();

    // Reset all stages to waiting
    var stages = document.querySelectorAll('.stepper-stage');
    for (var i = 0; i < stages.length; i++) {
        stages[i].className = 'stepper-stage waiting';
        var icon = stages[i].querySelector('.stepper-icon');
        if (icon) {
            icon.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">' +
                '<circle cx="12" cy="12" r="8"/></svg>';
        }
        var lbl = stages[i].querySelector('.stepper-label');
        if (lbl) {
            // Restore original label (drop any sublabel)
            var original = null;
            for (var j = 0; j < STEPPER_STAGES.length; j++) {
                if (STEPPER_STAGES[j].id === stages[i].getAttribute('data-stage')) {
                    original = STEPPER_STAGES[j].label;
                    break;
                }
            }
            if (original) lbl.textContent = original;
        }
    }

    var overlay = document.getElementById('leadStepperOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

// Hide the stepper overlay
function hideStepper() {
    var overlay = document.getElementById('leadStepperOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// Update one stage's visual state.
//
// stageId — 's1'..'s7'
// state   — 'waiting' | 'processing' | 'completed' | 'failed'
// extra   — optional { sublabel: '3 of 10' }
function updateStepperStage(stageId, state, extra) {
    initStepper();

    var stageEl = document.querySelector('.stepper-stage[data-stage="' + stageId + '"]');
    if (!stageEl) return;

    stageEl.className = 'stepper-stage ' + state;

    var icon = stageEl.querySelector('.stepper-icon');
    var labelEl = stageEl.querySelector('.stepper-label');
    var stageConfig = null;
    for (var i = 0; i < STEPPER_STAGES.length; i++) {
        if (STEPPER_STAGES[i].id === stageId) { stageConfig = STEPPER_STAGES[i]; break; }
    }

    if (icon) {
        if (state === 'processing') {
            icon.innerHTML =
                '<svg class="spinner" viewBox="0 0 24 24" fill="none" width="14" height="14">' +
                '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>' +
                '<path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
                '</svg>';
        } else if (state === 'completed') {
            icon.innerHTML =
                '<svg class="check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
                '<polyline points="20 6 9 17 4 12"/></svg>';
        } else if (state === 'failed') {
            icon.innerHTML =
                '<svg class="cross" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
                '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        } else {
            icon.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">' +
                '<circle cx="12" cy="12" r="8"/></svg>';
        }
    }

    if (labelEl && stageConfig) {
        labelEl.textContent = stageConfig.label;
        if (extra && typeof extra.sublabel === 'string' && extra.sublabel.trim()) {
            var sub = document.createElement('span');
            sub.className = 'stepper-sublabel';
            sub.textContent = extra.sublabel.trim();
            labelEl.appendChild(sub);
        }
    }
}

// ──────────────────────────────────────────────────────────────
//  LEAD MODE
// ──────────────────────────────────────────────────────────────
var leadMsgContainer = document.getElementById('leadMsgContainer');
var leadChatArea = document.getElementById('leadChatArea');
var leadMsgInput = document.getElementById('leadMsgInput');
var leadSendBtn = document.getElementById('leadSendBtn');
var leadCharCount = document.getElementById('leadCharCount');

function appendLeadMsg(role, content) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = content;
    if (typeof content === 'string') {
        try {
            var parsed = JSON.parse(content);
            if (parsed.ambiguities && parsed.ambiguities.length > 0) {
                displayContent = buildClarificationDisplay(parsed);
            }
        } catch (e) {}
    }
    var formattedContent = role === 'ai'
        ? formatAI(displayContent)
        : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(displayContent) : esc(displayContent));
    row.innerHTML = '<div class="av">' + avatarFor(role) + '</div>' +
                    '<div class="bubble-wrap"><div class="bubble">' + formattedContent + '</div>' +
                    '<div class="msg-time">' + now() + '</div></div>';
    leadMsgContainer.appendChild(row);
    scrollDown(leadChatArea);
}

function buildClarificationDisplay(parsed) {
    if (!parsed.ambiguities || parsed.ambiguities.length === 0) {
        return 'I understood your request. What would you like me to do?';
    }
    var msg = '⚠️ **I need a bit more clarity:**\n\n';
    parsed.ambiguities.forEach(function(amb) {
        msg += '• **' + amb.field + '**: ' + amb.issue + '\n';
        if (amb.candidates && amb.candidates.length > 0) {
            msg += '  → Options: ' + amb.candidates.join(' | ') + '\n';
        }
        msg += '\n';
    });
    msg += 'Please provide more details so I can help you better.';
    return msg;
}

function updateLeadSend() { leadSendBtn.disabled = !leadMsgInput.value.trim() || isTyping; }

leadMsgInput.addEventListener('input', function() {
    leadMsgInput.style.height = 'auto';
    leadMsgInput.style.height = Math.min(leadMsgInput.scrollHeight, 130) + 'px';
    updateLeadSend();
    leadCharCount.textContent = leadMsgInput.value.length || '';
});
leadMsgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!leadSendBtn.disabled) sendLeadMessage();
    }
});
leadSendBtn.addEventListener('click', sendLeadMessage);

function sendLeadMessage() {
    var text = leadMsgInput.value.trim();
    if (!text || isTyping) return;
    appendLeadMsg('user', text);
    leadMsgInput.value = ''; leadMsgInput.style.height = 'auto'; updateLeadSend();
    streamLeadResponse(text);
}

// ──────────────────────────────────────────────────────────────
//  LEAD STREAM — feeds the stepper with real backend events
// ──────────────────────────────────────────────────────────────

function streamLeadResponse(message) {
    isTyping = true; updateLeadSend();

    // Close any lingering stream from a previous request
    if (_activeEventSource) {
        try { _activeEventSource.close(); } catch (e) {}
        _activeEventSource = null;
    }

    // Show stepper, all stages waiting
    showStepper();

    var url = BACKEND + '/api/stream/pipeline'
        + '?message=' + encodeURIComponent(message)
        + '&token=' + encodeURIComponent(token);

    var stages = {};

    var es;
    try {
        es = new EventSource(url);
    } catch (e) {
        hideStepper();
        appendLeadMsg('ai', '🔌 Could not open a live connection. Please try again.');
        isTyping = false; updateLeadSend();
        return;
    }

    _activeEventSource = es;

    // The backend sends: { stage: 's1'..'s7'|'done'|'error', data: { status, data?, current?, total? } }
    es.addEventListener('stage', function(event) {
        var payload;
        try { payload = JSON.parse(event.data); } catch (e) { return; }
        if (!payload || !payload.stage) return;

        var stageId = payload.stage;
        var stageData = payload.data || {};
        var status = stageData.status;

        console.log('[SSE] Stage event:', stageId, status);

        // Store final data for the done renderer
        if (status === 'completed' && stageData.data) {
            stages[stageId] = stageData.data;
        }

        // Error event
        if (stageId === 'error') {
            try { es.close(); } catch (e) {}
            _activeEventSource = null;

            // Mark any processing stage as failed
            var processing = document.querySelectorAll('.stepper-stage.processing');
            for (var i = 0; i < processing.length; i++) {
                processing[i].className = 'stepper-stage failed';
            }

            setTimeout(function() {
                hideStepper();
                appendLeadMsg('ai', '⚠️ Something went wrong while processing your request. Please try again.');
                isTyping = false; updateLeadSend();
            }, 900);
            return;
        }

        // Done event — hide stepper, render final reply
        if (stageId === 'done') {
            try { es.close(); } catch (e) {}
            _activeEventSource = null;

            setTimeout(function() {
                hideStepper();
                renderFinalReply(stages['s7']);
                isTyping = false; updateLeadSend();
            }, 500);
            return;
        }

        // Per-search progress for s6
        if (stageId === 's6' && status === 'processing' && typeof stageData.current === 'number' && typeof stageData.total === 'number') {
            updateStepperStage('s6', 'processing', {
                sublabel: stageData.current + ' of ' + stageData.total
            });
            return;
        }

        // Normal stage transitions
        if (status === 'processing') {
            updateStepperStage(stageId, 'processing');
        } else if (status === 'completed') {
            updateStepperStage(stageId, 'completed');
        }
    });

    es.addEventListener('error', function() {
        if (_activeEventSource !== es) return;

        try { es.close(); } catch (e) {}
        _activeEventSource = null;

        // If we got stage 7 data, the stream completed but the connection
        // closed abruptly. Treat as success.
        if (stages['s7']) {
            setTimeout(function() {
                hideStepper();
                renderFinalReply(stages['s7']);
                isTyping = false; updateLeadSend();
            }, 300);
        } else {
            setTimeout(function() {
                hideStepper();
                appendLeadMsg('ai', '🔌 Connection lost — please try again.');
                isTyping = false; updateLeadSend();
            }, 300);
        }
    });
}

// ──────────────────────────────────────────────────────────────
//  FINAL REPLY RENDER — builds a chat bubble from stage 7 data
// ──────────────────────────────────────────────────────────────

function renderFinalReply(verification) {
    if (!verification || typeof verification !== 'object') {
        appendLeadMsg('ai', 'Request received. How can I help further?');
        return;
    }

    // Fallback shape — Generation or Verification returned a message
    if (typeof verification.message === 'string' && verification.message.trim()) {
        appendLeadMsg('ai', '💬 ' + verification.message.trim());
        return;
    }

    var lines = [];

    // ── Summary block ──
    var summary = verification.summary;
    if (summary && typeof summary === 'object') {
        var parts = [];
        if (typeof summary.valid === 'number') parts.push(summary.valid + ' valid');
        if (typeof summary.invalid === 'number') parts.push(summary.invalid + ' invalid');
        if (typeof summary.total === 'number') parts.push(summary.total + ' total');
        if (parts.length > 0) {
            lines.push('**📊 Summary:** ' + parts.join(' / '));
        }
        if (typeof summary.qualified === 'number') {
            lines.push('**✅ Qualified (rating 5+):** ' + summary.qualified);
        }
    }

    // ── Qualified companies ──
    var qualified = Array.isArray(verification.qualified) ? verification.qualified : [];

    if (qualified.length > 0) {
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('**QUALIFIED COMPANIES**');
        lines.push('');

        for (var i = 0; i < qualified.length; i++) {
            var c = qualified[i];
            if (!c || typeof c !== 'object') continue;

            var name = (typeof c.name === 'string' && c.name.trim()) ? c.name.trim() : ('Company ' + (i + 1));
            lines.push('**' + (i + 1) + '. ' + name + '**');

            if (typeof c.rating === 'number') lines.push('⭐ Rating: ' + c.rating);
            if (typeof c.status === 'string' && c.status.trim()) lines.push('🏷️ Status: ' + c.status.trim());
            if (typeof c.reason === 'string' && c.reason.trim()) lines.push('💬 ' + c.reason.trim());

            var mentions = Array.isArray(c.mentions) ? c.mentions : [];
            for (var j = 0; j < mentions.length; j++) {
                var m = mentions[j];
                if (!m || typeof m !== 'object') continue;

                if (typeof m.url === 'string' && m.url.trim()) {
                    lines.push('🔗 ' + m.url.trim());
                }
                if (typeof m.title === 'string' && m.title.trim()) {
                    lines.push('📝 ' + m.title.trim());
                }
                if (j === 0) break;
            }

            lines.push('');
        }
    } else if (lines.length === 0) {
        lines.push('No qualified companies were found for this request.');
    }

    appendLeadMsg('ai', lines.join('\n'));
}

// ──────────────────────────────────────────────────────────────
//  ASSISTANT MODE
// ──────────────────────────────────────────────────────────────
var assistantMsgContainer = document.getElementById('assistantMsgContainer');
var assistantChatArea = document.getElementById('assistantChatArea');
var assistantMsgInput = document.getElementById('assistantMsgInput');
var assistantSendBtn = document.getElementById('assistantSendBtn');
var assistantCharCount = document.getElementById('assistantCharCount');

function appendAssistantMsg(role, content) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + role;
    var displayContent = role === 'ai'
        ? formatAI(content)
        : ((typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(content) : esc(content));
    row.innerHTML = '<div class="av">' + avatarFor(role) + '</div>' +
                    '<div class="bubble-wrap"><div class="bubble">' + displayContent + '</div>' +
                    '<div class="msg-time">' + now() + '</div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}

function showAssistantTyping(label) {
    label = label || 'Nexa is thinking…';
    var row = document.getElementById('assistantTypingRow');
    if (row) { var lbl = row.querySelector('.t-label'); if (lbl) lbl.textContent = label; scrollDown(assistantChatArea); return; }
    row = document.createElement('div');
    row.className = 'typing-row'; row.id = 'assistantTypingRow';
    row.innerHTML = '<div class="av">N</div>' +
                    '<div class="typing-bubble"><span class="t-label">' + esc(label) + '</span>' +
                    '<div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>';
    assistantMsgContainer.appendChild(row);
    scrollDown(assistantChatArea);
}
function hideAssistantTyping() { var r = document.getElementById('assistantTypingRow'); if (r) r.remove(); }
function updateAssistantSend() { assistantSendBtn.disabled = !assistantMsgInput.value.trim() || isTyping; }

assistantMsgInput.addEventListener('input', function() {
    assistantMsgInput.style.height = 'auto';
    assistantMsgInput.style.height = Math.min(assistantMsgInput.scrollHeight, 130) + 'px';
    updateAssistantSend();
    assistantCharCount.textContent = assistantMsgInput.value.length || '';
});
assistantMsgInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!assistantSendBtn.disabled) sendAssistantMessage();
    }
});
assistantSendBtn.addEventListener('click', sendAssistantMessage);

function sendAssistantMessage() {
    var text = assistantMsgInput.value.trim();
    if (!text || isTyping) return;
    appendAssistantMsg('user', text);
    assistantMsgInput.value = ''; assistantMsgInput.style.height = 'auto'; updateAssistantSend();
    fetchAssistantResponse(text);
}

function fetchAssistantResponse(message) {
    isTyping = true; updateAssistantSend(); showAssistantTyping('Nexa is thinking…');
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
    .finally(function() { isTyping = false; updateAssistantSend(); });
}

// ──────────────────────────────────────────────────────────────
//  LOAD SESSION
// ──────────────────────────────────────────────────────────────
function loadLeadSession() {
    if (!currentSessionId) return Promise.resolve();
    return fetch(BACKEND + '/api/history/' + currentSessionId, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(msgs) {
        if (msgs && msgs.length) {
            leadMsgContainer.innerHTML = '';
            for (var i = 0; i < msgs.length; i++) {
                var role = msgs[i].role === 'ai' ? 'ai' : 'user';
                appendLeadMsg(role, msgs[i].content);
                conversationHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: msgs[i].content });
            }
            scrollDown(leadChatArea);
        }
    }).catch(function() {});
}

// ──────────────────────────────────────────────────────────────
//  PLAN + STATUS (cached)
// ──────────────────────────────────────────────────────────────
function checkPlan() {
    var t = Date.now();
    var chip = document.getElementById('planChip');
    if (_cachedPlan && (t - _cachedPlanTime) < CACHE_TTL) {
        chip.className = 'plan-chip ' + _cachedPlan;
        chip.textContent = _cachedPlan === 'go' ? 'GO' : _cachedPlan === 'pro' ? 'PRO' : 'FREE';
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(user) {
        if (user && chip) {
            var p = user.subscriptionTier || 'free';
            _cachedPlan = p; _cachedPlanTime = Date.now();
            chip.className = 'plan-chip ' + p;
            chip.textContent = p === 'go' ? 'GO' : p === 'pro' ? 'PRO' : 'FREE';
        }
    }).catch(function() {});
}

function updateStatus() {
    var t = Date.now();
    if (_cachedStatus && (t - _cachedStatusTime) < CACHE_TTL) { applyStatus(_cachedStatus); return Promise.resolve(); }
    return fetch(BACKEND + '/api/auth/nylas/status', { headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) { if (data) { _cachedStatus = data; _cachedStatusTime = Date.now(); applyStatus(data); } })
    .catch(function() { var txt = document.getElementById('statusText'); if (txt) txt.textContent = '⚠️ Status unknown'; });
}
function applyStatus(data) {
    var bar = document.getElementById('statusBar'); var txt = document.getElementById('statusText');
    if (!bar || !txt) return;
    if (data.connected && !data.isExpired) { bar.className = 'status-bar connected'; txt.textContent = data.email ? '✅ Connected as ' + data.email : '✅ Email connected'; }
    else if (data.connected && data.isExpired) { bar.className = 'status-bar disconnected'; txt.textContent = '⚠️ Session expired — Reconnect in Dashboard'; }
    else { bar.className = 'status-bar disconnected'; txt.textContent = '❌ No email connected — Connect in Dashboard'; }
}

// ──────────────────────────────────────────────────────────────
//  CLEAR / NEW CHAT
// ──────────────────────────────────────────────────────────────
function clearChat() {
    // Close any in-flight stream
    if (_activeEventSource) {
        try { _activeEventSource.close(); } catch (e) {}
        _activeEventSource = null;
    }

    // Hide stepper if visible
    hideStepper();

    leadMsgContainer.innerHTML = ''; conversationHistory = []; currentGeneratedLeads = []; currentSessionId = null;
    assistantMsgContainer.innerHTML = '';
    assistantMsgContainer.innerHTML =
        '<div class="msg-row ai"><div class="av">N</div>' +
        '<div class="bubble-wrap"><div class="bubble">👋 Hi, I\'m <strong>Nexa</strong> — your business assistant. Ask me anything about your business, leads, or strategy.</div>' +
        '<div class="msg-time">Just now</div></div></div>';
    assistantSessionId = null; assistantConversationHistory = [];
    _cachedPlan = null; _cachedPlanTime = 0; _cachedStatus = null; _cachedStatusTime = 0;

    var url = new URL(window.location); url.searchParams.delete('session'); window.history.pushState({}, '', url);

    // Show guide again on new chat
    showGuide();
}

// ──────────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Topbar buttons
    var newBtn = document.getElementById('newChatBtn');
    var clrBtn = document.getElementById('clearSessionBtn');
    if (newBtn) newBtn.addEventListener('click', function(e) { e.preventDefault(); clearChat(); });
    if (clrBtn) clrBtn.addEventListener('click', function(e) { e.preventDefault(); clearChat(); });

    // Guide modal Okay button
    var okayBtn = document.getElementById('guideOkayBtn');
    if (okayBtn) okayBtn.addEventListener('click', hideGuide);

    // Plan + status
    Promise.all([checkPlan(), updateStatus()]).catch(function() {});
    statusInterval = setInterval(updateStatus, 120000);

    // Build stepper once so it exists even before first use
    initStepper();

    // Legacy wizard form (guard — may not exist)
    var targetForm = document.getElementById('targetForm');
    if (targetForm) {
        targetForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var industry = (document.getElementById('industry') || {}).value || '';
            var region = (document.getElementById('region') || {}).value || '';
            var companySize = (document.getElementById('companySize') || {}).value || '';
            var jobTitle = (document.getElementById('jobTitle') || {}).value || '';
            var msg = 'Find me ' + jobTitle + 's in the ' + industry + ' industry, located in ' + region + '. Company size: ' + companySize + '.';
            var wz = document.getElementById('setupWizard');
            if (wz) wz.style.display = 'none';
            appendLeadMsg('user', msg); streamLeadResponse(msg);
        });
    }

    // Load session if present (skip guide)
    if (currentSessionId) {
        hideGuide();
        loadLeadSession();
    } else {
        // Show guide on first load / new chat
        showGuide();
    }

    switchMode('lead');

    window.switchMode = switchMode;
    window.clearChat = clearChat;
    window.sendAllEmails = function() { showToast('Send all emails function', 'info', 2000); };

    console.log('✅ [PAGE] Nexa ready (stepper streaming enabled)');

    window.addEventListener('beforeunload', function() {
        if (statusInterval) clearInterval(statusInterval);

        if (_activeEventSource) {
            try { _activeEventSource.close(); } catch (e) {}
            _activeEventSource = null;
        }
    });
});

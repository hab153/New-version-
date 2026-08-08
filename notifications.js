// ============================================================
// notifications.js
// Skyline AA-1 Inbox / Notifications Logic
// ============================================================

// ── CONFIG ───
var BACKEND = 'https://skylineapp-backend-file.onrender.com';
var token = localStorage.getItem('token');

// ── DOM ELEMENTS ──
var loadingScreen = document.getElementById('loadingScreen');
var contactList = document.getElementById('contactList');
var emptyState = document.getElementById('emptyState');
var noResults = document.getElementById('noResults');
var searchInput = document.getElementById('searchInput');
var menuBtn = document.getElementById('menuBtn');
var menuDropdown = document.getElementById('menuDropdown');
var toast = document.getElementById('toast');
var revenueModal = document.getElementById('revenueModal');
var revenueBody = document.getElementById('revenueBody');
var closeRevenueModal = document.getElementById('closeRevenueModal');
var tierBadge = document.getElementById('tierBadge');

// Chat elements
var chatView = document.getElementById('chatView');
var chatBack = document.getElementById('chatBack');
var chatAvatar = document.getElementById('chatAvatar');
var chatName = document.getElementById('chatName');
var chatEmail = document.getElementById('chatEmail');
var chatRenameBtn = document.getElementById('chatRenameBtn');
var messagesContainer = document.getElementById('messagesContainer');
var chatInput = document.getElementById('chatInput');
var chatSendBtn = document.getElementById('chatSendBtn');

var chatAutoReplyBtn = document.getElementById('chatAutoReplyBtn');
var autoReplyModalOverlay = document.getElementById('autoReplyModalOverlay');
var closeAutoReplyModal = document.getElementById('closeAutoReplyModal');
var autoReplyInstructions = document.getElementById('autoReplyInstructions');
var saveAutoReplyBtn = document.getElementById('saveAutoReplyBtn');

var followupBtn = document.getElementById('chatFollowupBtn');
var followupDropdown = document.getElementById('chatFollowupDropdown');
var followupStatus = document.getElementById('followupStatus');

var autoFollowupModal = document.getElementById('autoFollowupModal');
var closeAutoFollowupModal = document.getElementById('closeAutoFollowupModal');
var cancelAutoFollowup = document.getElementById('cancelAutoFollowup');
var confirmAutoFollowup = document.getElementById('confirmAutoFollowup');
var afDayButtons = document.querySelectorAll('.af-day-btn');
var afCustomInput = document.getElementById('afCustomInput');
var afStatusBadge = document.getElementById('afStatusBadge');
var afCurrentStatus = document.getElementById('afCurrentStatus');
var afSelectedDays = 3;
var afCurrentEnabledState = false;

// ─── STATE 
var allContacts = [];
var toastTimeout = null;
var currentLeadId = null;
var currentLeadName = null;
var currentLeadEmail = null;
var isSending = false;
var isAutoReplyActive = false;

var _cachedContacts = null;
var _cachedContactsTime = 0;
var CONTACTS_CACHE_TTL = 60000;

var _cachedChatHistory = {};
var CHAT_HISTORY_CACHE_TTL = 30000;

var _cachedFollowUpStatus = {};
var FOLLOWUP_CACHE_TTL = 30000;

var _pollInterval = null;
var _currentMessageCount = 0;

// ✅ Global contact list poller — runs every 2 seconds
var _contactPollInterval = null;
var CONTACT_POLL_MS = 2000; // Every 2 seconds — real-time updates

function safeSanitize(str) {
    if (!str) return '';
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(str);
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

if (!token) {
    window.location.href = 'login.html';
}

function showToast(message, duration) {
    duration = duration || 3000;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
    }, duration);
}

// ─── MENU TOGGLE ─
menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
});

document.addEventListener('click', function() {
    menuDropdown.classList.remove('show');
});

document.querySelectorAll('.menu-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
        e.stopPropagation();
        var action = this.dataset.action;
        menuDropdown.classList.remove('show');
        if (action === 'revenue') { fetchRevenueData(); return; }
        if (action === 'followup') {
            if (!currentLeadId) { showToast('Open a chat first to access follow-up.'); return; }
            suggestFollowUp(); return;
        }
        if (action === 'hint') {
            if (!currentLeadId) { showToast('Open a chat first to get a hint.'); return; }
            generateHint(); return;
        }
        if (action === 'autoreply') {
            if (!currentLeadId) { showToast('Open a chat first to configure auto-reply.'); return; }
            openAutoReplyModal(); return;
        }
        showToast('Please open a chat to access this feature.');
    });
});

closeRevenueModal.addEventListener('click', function() { revenueModal.classList.remove('active'); });
revenueModal.addEventListener('click', function(e) { if (e.target === this) revenueModal.classList.remove('active'); });

if (followupBtn && followupDropdown) {
    followupBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        followupDropdown.classList.toggle('show');
    });
    document.addEventListener('click', function(e) {
        if (!followupBtn.contains(e.target) && !followupDropdown.contains(e.target)) {
            followupDropdown.classList.remove('show');
        }
    });
}

var suggestBtn = document.querySelector('.chat-followup-option[data-action="suggest"]');
if (suggestBtn) {
    suggestBtn.addEventListener('click', function() {
        followupDropdown.classList.remove('show');
        suggestFollowUp();
    });
}

var autoFollowupOption = document.querySelector('.chat-followup-option[data-action="auto"]');
if (autoFollowupOption) {
    autoFollowupOption.addEventListener('click', function(e) {
        e.stopPropagation();
        if (followupDropdown) followupDropdown.classList.remove('show');
        loadFollowUpStatusForModal();
        if (autoFollowupModal) autoFollowupModal.classList.add('active');
    });
}

function closeAutoFollowupModalFn() {
    if (autoFollowupModal) autoFollowupModal.classList.remove('active');
}
if (closeAutoFollowupModal) closeAutoFollowupModal.addEventListener('click', closeAutoFollowupModalFn);
if (cancelAutoFollowup) cancelAutoFollowup.addEventListener('click', closeAutoFollowupModalFn);
if (autoFollowupModal) {
    autoFollowupModal.addEventListener('click', function(e) {
        if (e.target === this) closeAutoFollowupModalFn();
    });
}

function loadFollowUpStatusForModal() {
    if (!currentLeadId) return;
    var cached = _cachedFollowUpStatus[currentLeadId];
    if (cached && (Date.now() - cached.time) < FOLLOWUP_CACHE_TTL) {
        afCurrentEnabledState = cached.data.autoFollowUpEnabled || false;
        updateModalStatus(afCurrentEnabledState);
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/follow-up-status', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) { if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } return; }
        return res.json();
    })
    .then(function(data) {
        if (data) {
            _cachedFollowUpStatus[currentLeadId] = { data: data, time: Date.now() };
            afCurrentEnabledState = data.autoFollowUpEnabled || false;
            updateModalStatus(afCurrentEnabledState);
        }
    })
    .catch(function(err) { console.error('Failed to load follow-up status for modal:', err); });
}

function updateModalStatus(enabled) {
    if (followupStatus) {
        followupStatus.textContent = enabled ? 'ON' : 'OFF';
        followupStatus.className = enabled ? 'followup-status on' : 'followup-status';
    }
    if (afStatusBadge) {
        afStatusBadge.textContent = enabled ? 'ON' : 'OFF';
        afStatusBadge.style.background = enabled ? 'rgba(102,221,153,0.12)' : 'rgba(255,85,85,0.12)';
        afStatusBadge.style.color = enabled ? 'var(--green)' : '#ff5555';
    }
    if (afCurrentStatus) {
        afCurrentStatus.textContent = enabled ? 'ON' : 'OFF';
        afCurrentStatus.style.color = enabled ? 'var(--green)' : '#ff5555';
    }
    if (confirmAutoFollowup) {
        confirmAutoFollowup.textContent = enabled ? '\u274c Disable Auto Follow-up' : '\u2705 Enable Auto Follow-up';
        confirmAutoFollowup.style.background = enabled ? '#ff5555' : 'var(--green)';
        confirmAutoFollowup.style.color = enabled ? '#fff' : '#000';
    }
}

afDayButtons.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        afDayButtons.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        afSelectedDays = parseInt(this.dataset.days);
        if (afCustomInput) afCustomInput.value = afSelectedDays;
    });
});

if (afCustomInput) {
    afCustomInput.addEventListener('input', function() {
        var val = parseInt(this.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 7) val = 7;
        this.value = val;
        afSelectedDays = val;
        afDayButtons.forEach(function(b) { b.classList.remove('active'); });
    });
}

if (confirmAutoFollowup) {
    confirmAutoFollowup.addEventListener('click', function() {
        var newState = !afCurrentEnabledState;
        closeAutoFollowupModalFn();
        toggleAutoFollowUp(afSelectedDays, newState);
    });
}

function closeChatAndGoBack() {
    chatView.classList.remove('active');
    document.body.classList.remove('chat-active');
    document.body.style.overflow = '';
    currentLeadId = null;
    stopPolling();
}

chatBack.addEventListener('click', function() { closeChatAndGoBack(); });

chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    chatSendBtn.disabled = !this.value.trim();
});

chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) sendMessage();
    }
});

chatSendBtn.addEventListener('click', sendMessage);

chatRenameBtn.addEventListener('click', function() {
    if (!currentLeadId) { showToast('No lead selected.'); return; }
    var newName = prompt('Enter new name for this contact:', currentLeadName || '');
    if (newName === null || newName.trim() === '') return;
    renameLead(currentLeadId, newName.trim());
});

function renameLead(leadId, newName) {
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(leadId) + '/rename', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName })
    })
    .then(function(res) { return res.text().then(function(text) { return { ok: res.ok, status: res.status, text: text }; }); })
    .then(function(result) {
        var data = {};
        if (result.text) { try { data = JSON.parse(result.text); } catch (e) { data = { message: result.text || 'Empty response' }; } }
        if (!result.ok) {
            if (result.status === 401 || result.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; }
            showToast('Failed to rename: ' + (data.message || data.error || 'Unknown error')); return;
        }
        if (data.success) {
            currentLeadName = data.newName;
            chatName.textContent = data.newName;
            chatAvatar.textContent = data.newName.charAt(0).toUpperCase();
            showToast('Renamed successfully!');
            _cachedContacts = null; _cachedContactsTime = 0; loadContacts(true);
        } else { showToast('Failed to rename: ' + (data.message || 'Unknown error')); }
    })
    .catch(function(err) { console.error('Rename error:', err); showToast('Connection error while renaming.'); });
}

function sendMessage() {
    var text = chatInput.value.trim();
    if (!text || isSending || !currentLeadId) return;
    isSending = true;
    chatSendBtn.disabled = true;
    var originalText = text;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    appendMessage('lead', originalText, new Date().toISOString());
    _currentMessageCount++;
    var payload = {
        leads: [{ name: currentLeadName || 'Unknown', email: currentLeadEmail || '', company: '', messages: [{ subject: 'Re: Conversation', body: originalText }] }],
        leadId: currentLeadId, allowNewLead: false
    };
    fetch(BACKEND + '/api/leads/batch-send', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            delete _cachedChatHistory[currentLeadId];
            setTimeout(function() { _cachedContacts = null; _cachedContactsTime = 0; loadContacts(true); }, 800);
        } else { showToast('Failed to send: ' + (data.message || 'Unknown error')); }
    })
    .catch(function(err) { console.error('Network Error:', err); showToast('Connection error. Message may not have been sent.'); })
    .finally(function() { isSending = false; chatSendBtn.disabled = !chatInput.value.trim(); });
}

function appendMessage(from, content, date) {
    var div = document.createElement('div');
    var cssClass = from === 'lead' ? 'from-lead' : 'from-ai';
    var senderLabel = from === 'lead' ? 'You' : 'Customer';
    var alignItems = from === 'lead' ? 'flex-end' : 'flex-start';
    div.className = 'msg-group ' + cssClass;
    div.style.alignSelf = alignItems;
    var time = date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    div.innerHTML = '<div class="msg-sender">' + senderLabel + '</div><div class="message-bubble">' + safeSanitize(content) + '</div><div class="message-time">' + time + '</div>';
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadChatHistory(leadId) {
    messagesContainer.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px;"><div class="spinner" style="width:28px; height:28px; border-width:2px;"></div><div style="color:#505050; font-size:11px; letter-spacing:0.05em;">Loading messages...</div></div>';
    var cached = _cachedChatHistory[leadId];
    if (cached && (Date.now() - cached.time) < CHAT_HISTORY_CACHE_TTL) { renderChatMessages(cached.data); return Promise.resolve(); }
    return fetch(BACKEND + '/api/conversations/' + encodeURIComponent(leadId), {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; }
            if (res.status === 404) { messagesContainer.innerHTML = '<div class="empty-chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>Conversation not found</h3><p>This conversation may have been deleted.</p></div>'; return; }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.success === false) throw new Error(data.message || 'Failed to load conversation');
        var messages = data.messages || [];
        _cachedChatHistory[leadId] = { data: messages, time: Date.now() };
        _currentMessageCount = messages.length;
        renderChatMessages(messages);
    })
    .catch(function(err) { console.error('Load chat history error:', err); messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#505050; font-size:12px;">Failed to load messages. Please try again.</div>'; });
}

function renderChatMessages(messages) {
    messagesContainer.innerHTML = '';
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>No messages yet</h3><p>Send a message to start the conversation.</p></div>';
        _currentMessageCount = 0; return;
    }
    for (var i = 0; i < messages.length; i++) appendMessage(messages[i].from, messages[i].content, messages[i].date);
    _currentMessageCount = messages.length;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function openChat(leadId, name, email) {
    if (currentLeadId === leadId && chatView.classList.contains('active')) {
        Promise.all([loadChatHistory(leadId), loadFollowUpStatus(), loadAutoReplyStatus()]).catch(function() {});
        return;
    }
    currentLeadId = leadId;
    currentLeadName = name || 'Unknown';
    currentLeadEmail = email || '';
    chatAvatar.textContent = (name || '?').charAt(0).toUpperCase();
    chatName.textContent = currentLeadName;
    chatEmail.textContent = currentLeadEmail || 'No email provided';
    chatView.classList.add('active');
    document.body.classList.add('chat-active');
    document.body.style.overflow = 'hidden';
    menuDropdown.classList.remove('show');
    if (followupDropdown) followupDropdown.classList.remove('show');
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSendBtn.disabled = true;
    history.pushState({ chatOpen: true }, '', window.location.href);
    Promise.all([loadFollowUpStatus(), loadChatHistory(leadId), loadAutoReplyStatus()])
    .then(function() {
        _cachedContacts = null; _cachedContactsTime = 0; loadContacts(true);
        startPolling(leadId);
    })
    .catch(function() {
        _cachedContacts = null; _cachedContactsTime = 0; loadContacts(true);
        startPolling(leadId);
    });
}

// ============================================================
// ✅ CHAT POLLING — Check for new messages every 2 seconds while in chat
// ============================================================
function startPolling(leadId) {
    stopPolling();
    _pollInterval = setInterval(function() {
        if (!currentLeadId || currentLeadId !== leadId || !chatView.classList.contains('active')) { stopPolling(); return; }
        fetch(BACKEND + '/api/conversations/' + encodeURIComponent(leadId), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) { if (!res.ok) return null; return res.json(); })
        .then(function(data) {
            if (!data || !data.messages) return;
            var newMessages = data.messages;
            if (newMessages.length > _currentMessageCount) {
                _cachedChatHistory[leadId] = { data: newMessages, time: Date.now() };
                for (var i = _currentMessageCount; i < newMessages.length; i++) {
                    appendMessage(newMessages[i].from, newMessages[i].content, newMessages[i].date);
                }
                _currentMessageCount = newMessages.length;
                var lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.from !== 'lead') showToast('\ud83d\udcac New reply from ' + (currentLeadName || 'customer') + '!');
            }
        })
        .catch(function() {});
    }, 2000); // Every 2 seconds — real-time chat updates
}

function stopPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

// ============================================================
// ✅ GLOBAL CONTACT LIST POLLING — Runs every 2 seconds ALWAYS
// Updates badges and previews in real-time without refresh
// ============================================================
function startContactPolling() {
    if (_contactPollInterval) clearInterval(_contactPollInterval);
    _contactPollInterval = setInterval(function() {
        if (!token) return;
        fetch(BACKEND + '/api/conversations', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) { if (!res.ok) return null; return res.json(); })
        .then(function(data) {
            if (!data || !Array.isArray(data)) return;
            allContacts = data;
            _cachedContacts = data;
            _cachedContactsTime = Date.now();
            renderContacts(allContacts);
        })
        .catch(function() {});
    }, CONTACT_POLL_MS);
}

function stopContactPolling() {
    if (_contactPollInterval) { clearInterval(_contactPollInterval); _contactPollInterval = null; }
}

// ============================================================
// FOLLOW-UP FUNCTIONS
// ============================================================
function loadFollowUpStatus() {
    if (!currentLeadId) return Promise.resolve();
    var cached = _cachedFollowUpStatus[currentLeadId];
    if (cached && (Date.now() - cached.time) < FOLLOWUP_CACHE_TTL) {
        var data = cached.data;
        if (followupStatus) { followupStatus.textContent = data.autoFollowUpEnabled ? 'ON' : 'OFF'; followupStatus.className = data.autoFollowUpEnabled ? 'followup-status on' : 'followup-status'; }
        afCurrentEnabledState = data.autoFollowUpEnabled || false;
        updateModalStatus(afCurrentEnabledState);
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/follow-up-status', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { if (!res.ok) { if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } return; } return res.json(); })
    .then(function(data) {
        if (!data) return;
        _cachedFollowUpStatus[currentLeadId] = { data: data, time: Date.now() };
        if (followupStatus) { followupStatus.textContent = data.autoFollowUpEnabled ? 'ON' : 'OFF'; followupStatus.className = data.autoFollowUpEnabled ? 'followup-status on' : 'followup-status'; }
        afCurrentEnabledState = data.autoFollowUpEnabled || false;
        updateModalStatus(afCurrentEnabledState);
    })
    .catch(function(err) { console.error('Failed to load follow-up status:', err); });
}

function suggestFollowUp() {
    if (!currentLeadId) { showToast('Open a chat first to get a follow-up suggestion.'); return; }
    showToast('Generating follow-up suggestion...');
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/suggest-follow-up', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } })
    .then(function(res) { if (!res.ok) { if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } return res.json().then(function(err) { showToast('Failed: ' + (err.message || 'Unknown error')); }); } return res.json(); })
    .then(function(data) {
        if (!data) return;
        if (data.success && data.suggestion) { chatInput.value = data.suggestion; chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px'; chatSendBtn.disabled = false; chatInput.focus(); showToast('Follow-up suggestion ready!'); }
        else showToast(data.message || 'No suggestion generated.');
    })
    .catch(function(err) { console.error('Suggest follow-up error:', err); showToast('Connection error. Please try again.'); });
}

function generateHint() {
    if (!currentLeadId) { showToast('Open a chat first to get a hint.'); return; }
    showToast('Generating AI hint...');
    fetch(BACKEND + '/api/conversations/' + encodeURIComponent(currentLeadId), { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(convRes) { if (!convRes.ok) { if (convRes.status === 401 || convRes.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } showToast('Failed to load conversation.'); return; } return convRes.json(); })
    .then(function(convData) { if (!convData) return; var messages = convData.messages || []; if (messages.length === 0) { showToast('No messages to generate a hint from.'); return; } return fetch(BACKEND + '/api/ai/suggest', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages.slice(-5) }) }); })
    .then(function(suggestRes) { if (!suggestRes) return; if (!suggestRes.ok) { if (suggestRes.status === 401 || suggestRes.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } return suggestRes.json().then(function(err) { showToast('Failed: ' + (err.message || 'Unknown error')); }); } return suggestRes.json(); })
    .then(function(data) {
        if (!data) return;
        if (data.suggestion) { chatInput.value = data.suggestion; chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px'; chatSendBtn.disabled = false; chatInput.focus(); showToast('AI hint ready!'); }
        else showToast(data.message || 'No hint generated.');
    })
    .catch(function(err) { console.error('Generate hint error:', err); showToast('Connection error. Please try again.'); });
}

function toggleAutoFollowUp(days, forceState) {
    if (!currentLeadId) { showToast('Open a chat first to manage auto follow-up.'); return; }
    var delayDays = days || afSelectedDays || 3;
    var currentStatus = afCurrentEnabledState;
    var newStatus = typeof forceState !== 'undefined' ? forceState : !currentStatus;
    afCurrentEnabledState = newStatus;
    updateModalStatus(afCurrentEnabledState);
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-follow-up', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: newStatus, delayDays: delayDays }) })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; }
            var errorMessage = 'Failed to toggle auto follow-up.';
            return res.json().then(function(err) { errorMessage = err.message || err.error || errorMessage; afCurrentEnabledState = !newStatus; updateModalStatus(afCurrentEnabledState); showToast(errorMessage); }).catch(function() { afCurrentEnabledState = !newStatus; updateModalStatus(afCurrentEnabledState); showToast(errorMessage); });
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.success) {
            afCurrentEnabledState = data.autoFollowUpEnabled;
            delete _cachedFollowUpStatus[currentLeadId];
            updateModalStatus(afCurrentEnabledState);
            showToast(data.autoFollowUpEnabled ? 'Auto follow-up enabled. First follow-up in ' + delayDays + ' day(s).' : 'Auto follow-up disabled.');
        } else { afCurrentEnabledState = !newStatus; updateModalStatus(afCurrentEnabledState); showToast(data.message || 'Failed to toggle auto follow-up.'); }
    })
    .catch(function(err) { console.error('AUTO-FOLLOWUP Error:', err); afCurrentEnabledState = !newStatus; updateModalStatus(afCurrentEnabledState); showToast('Connection error. Please try again.'); });
}

var CATEGORY_CONFIG = {
    contacted: { label: 'Contacted', icon: '\ud83d\udd35', color: '#66ddff' },
    replied: { label: 'Replied', icon: '\ud83d\udfe2', color: '#66dd99' },
    interested: { label: 'Interested', icon: '\ud83d\udfe1', color: '#ffbb44' },
    ongoing: { label: 'Ongoing', icon: '\ud83d\udfea', color: '#bb88ff' },
    win: { label: 'Win', icon: '\ud83d\udd34', color: '#ff6b6b' }
};

function fetchRevenueData() {
    revenueModal.classList.add('active');
    revenueBody.innerHTML = '<div class="modal-loading">Loading revenue data...</div>';
    tierBadge.textContent = 'Loading...';
    fetch(BACKEND + '/api/revenue/tracking', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { if (!res.ok) { if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } throw new Error('HTTP ' + res.status); } return res.json(); })
    .then(function(data) { if (data) renderRevenueData(data); })
    .catch(function(err) { console.error('Failed to fetch revenue:', err); revenueBody.innerHTML = '<div class="modal-error"><p>Failed to load revenue data.</p><p style="font-size:12px; color:#707070; margin-top:8px;">' + escapeHtml(err.message) + '</p></div>'; tierBadge.textContent = 'Error'; });
}

function escapeHtml(str) { if (!str) return ''; var div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function renderRevenueData(data) {
    var tier = data.tier || 'free';
    tierBadge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
    var categories = data.categories || {};
    var html = '<div style="margin-bottom:12px;"><strong style="color:#f5f5f5; font-size:13px;">\ud83d\udcca Categories</strong></div>';
    var hasCategories = false;
    var catKeys = Object.keys(categories);
    for (var ci = 0; ci < catKeys.length; ci++) {
        var key = catKeys[ci]; var leads = categories[key];
        var config = CATEGORY_CONFIG[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), icon: '\u2022', color: '#707070' };
        var count = Array.isArray(leads) ? leads.length : 0;
        if (count > 0) hasCategories = true;
        html += '<div class="category-section cat-' + key + '"><div class="category-header"><span class="category-name"><span class="category-icon"></span>' + config.icon + ' ' + config.label + '</span><span class="category-count">' + count + '</span></div>';
        if (count === 0) { html += '<div class="empty-category">No leads in this category</div>'; }
        else {
            var displayLeads = leads.slice(0, 10); var remaining = leads.length - 10;
            for (var li = 0; li < displayLeads.length; li++) { var lead = displayLeads[li]; var lname = lead.name || 'Unknown'; var company = lead.company || ''; var leadId = lead.id || ''; html += '<div class="lead-item" data-id="' + leadId + '" onclick="openChatFromRevenue(\'' + leadId + '\', \'' + safeSanitize(lname).replace(/'/g, "\\'") + '\', \'' + safeSanitize(lead.email || '').replace(/'/g, "\\'") + '\')"><span class="lead-name">' + safeSanitize(lname) + '</span>' + (company ? '<span class="lead-company">\u00b7 ' + safeSanitize(company) + '</span>' : '') + '</div>'; }
            if (remaining > 0) html += '<div class="lead-item" style="color:#505050; font-style:italic; border-left-color:transparent; cursor:default;">+ ' + remaining + ' more</div>';
        }
        html += '</div>';
    }
    if (!hasCategories) html += '<div class="no-data">No leads found.</div>';
    var advice = data.advice || {}; var adviceKeys = Object.keys(advice);
    if (adviceKeys.length > 0) { html += '<div class="section-divider"></div><div class="advice-section"><div class="advice-title">\ud83d\udca1 Strategic Advice</div>'; for (var ai = 0; ai < adviceKeys.length; ai++) { var akey = adviceKeys[ai]; var label = akey.replace('Advice', '').replace(/([A-Z])/g, ' $1').replace(/^./, function(str) { return str.toUpperCase(); }); var value = advice[akey]; if (value && value.trim()) html += '<div class="advice-item"><strong>' + label + ':</strong> ' + safeSanitize(value) + '</div>'; } html += '</div>'; }
    var actions = data.actions || [];
    if (actions.length > 0) { html += '<div class="section-divider"></div><div class="actions-section"><div class="actions-title">Recommended Actions</div>'; var maxActions = Math.min(actions.length, 10); for (var aci = 0; aci < maxActions; aci++) { var action = actions[aci]; html += '<div class="action-item"><span style="color:#505050; font-size:10px;">' + (aci + 1) + '.</span><span class="action-lead">' + safeSanitize(action.leadName || 'Lead') + '</span><span class="action-text">\u2014 ' + safeSanitize(action.action || 'Follow up') + '</span></div>'; } if (actions.length > 10) html += '<div class="no-data" style="padding-top:4px;">+ ' + (actions.length - 10) + ' more actions</div>'; html += '</div>'; }
    if (tierBadge.textContent === 'Free') html += '<div class="section-divider"></div><div style="background: rgba(255,187,68,0.06); border: 1px solid rgba(255,187,68,0.15); border-radius: 8px; padding: 12px 16px; margin-top: 4px;"><p style="color:#ffbb44; font-size:12px; margin:0;">Upgrade to <strong>Go</strong> for AI\u2011powered advice, or <strong>Pro</strong> for personalised actions on your top leads.</p></div>';
    revenueBody.innerHTML = html;
}

function openChatFromRevenue(leadId, name, email) { revenueModal.classList.remove('active'); openChat(leadId, name, email); }

function loadContacts(forceRefresh) {
    var now_ts = Date.now();
    if (!forceRefresh && _cachedContacts && (now_ts - _cachedContactsTime) < CONTACTS_CACHE_TTL) {
        allContacts = _cachedContacts; renderContacts(allContacts);
        setTimeout(function() { loadingScreen.classList.add('hidden'); }, 300);
        return Promise.resolve();
    }
    return fetch(BACKEND + '/api/conversations', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { if (!res.ok) { if (res.status === 401 || res.status === 403) { localStorage.removeItem('token'); window.location.href = 'login.html'; return; } throw new Error('HTTP ' + res.status); } return res.json(); })
    .then(function(data) { if (!data) return; allContacts = data; _cachedContacts = data; _cachedContactsTime = Date.now(); renderContacts(allContacts); })
    .catch(function(err) { console.error('Failed to load contacts:', err); showEmptyState(); })
    .finally(function() { setTimeout(function() { loadingScreen.classList.add('hidden'); }, 300); });
}

function renderContacts(contacts) {
    if (!contacts || contacts.length === 0) {
        if (searchInput.value.trim() !== '') { contactList.classList.remove('active'); emptyState.classList.remove('active'); noResults.classList.add('active'); }
        else showEmptyState();
        return;
    }
    contactList.classList.add('active'); emptyState.classList.remove('active'); noResults.classList.remove('active');
    var html = '';
    for (var i = 0; i < contacts.length; i++) {
        var c = contacts[i];
        var initials = (c.name || '?').charAt(0).toUpperCase();
        var preview = c.lastMessage || 'No messages yet';
        var time = c.lastDate ? new Date(c.lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        var unreadCount = c.unreadCount || 0;
        var hasUnread = unreadCount > 0;
        var unreadClass = hasUnread ? ' has-unread' : '';
        var badgeHtml = '<div class="contact-unread-badge">' + (unreadCount > 9 ? '9+' : unreadCount) + '</div>';
        html += '<div class="contact-item' + unreadClass + '" data-id="' + c.id + '" onclick="openChat(\'' + c.id + '\', \'' + safeSanitize(c.name || 'Unknown').replace(/'/g, "\\'") + '\', \'' + safeSanitize(c.email || '').replace(/'/g, "\\'") + '\')">' + badgeHtml + '<div class="contact-avatar">' + initials + '</div><div class="contact-info"><div class="contact-name">' + safeSanitize(c.name || 'Unknown') + '</div><div class="contact-preview">' + safeSanitize(preview) + '</div></div>' + (time ? '<div class="contact-time">' + time + '</div>' : '') + '</div>';
    }
    contactList.innerHTML = html;
}

searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    if (!query) { renderContacts(allContacts); return; }
    var filtered = [];
    for (var i = 0; i < allContacts.length; i++) {
        var c = allContacts[i];
        if ((c.name || '').toLowerCase().indexOf(query) !== -1 || (c.company || '').toLowerCase().indexOf(query) !== -1 || (c.email || '').toLowerCase().indexOf(query) !== -1) filtered.push(c);
    }
    renderContacts(filtered);
});

function showEmptyState() { contactList.classList.remove('active'); emptyState.classList.add('active'); noResults.classList.remove('active'); }

var hintOption = document.querySelector('.chat-followup-option[data-action="hint"]');
if (hintOption) { hintOption.addEventListener('click', function() { followupDropdown.classList.remove('show'); generateHint(); }); }

function loadAutoReplyStatus() {
    if (!currentLeadId) return Promise.resolve();
    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(res) { if (res.ok) return res.json(); return null; })
    .then(function(data) { if (data) { isAutoReplyActive = data.enabled || false; autoReplyInstructions.value = data.instructions || ''; updateAutoReplyButtonUI(); } })
    .catch(function(err) { console.error('Failed to load auto-reply status:', err); });
}

function updateAutoReplyButtonUI() {
    if (isAutoReplyActive) { chatAutoReplyBtn.classList.add('active'); chatAutoReplyBtn.setAttribute('title', 'AI Auto-Reply ON - Click to turn OFF'); }
    else { chatAutoReplyBtn.classList.remove('active'); chatAutoReplyBtn.setAttribute('title', 'AI Auto-Reply OFF - Click to configure'); }
}

chatAutoReplyBtn.addEventListener('click', function() {
    if (!currentLeadId) { showToast('Open a chat first.'); return; }
    if (isAutoReplyActive) {
        fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false, instructions: autoReplyInstructions.value }) })
        .then(function(res) { if (res.ok) { isAutoReplyActive = false; updateAutoReplyButtonUI(); showToast('AI Auto-Reply disabled'); } })
        .catch(function() { showToast('Failed to disable auto-reply'); });
    } else { autoReplyModalOverlay.classList.add('show'); autoReplyInstructions.focus(); }
});

closeAutoReplyModal.addEventListener('click', function() { autoReplyModalOverlay.classList.remove('show'); });
autoReplyModalOverlay.addEventListener('click', function(e) { if (e.target === autoReplyModalOverlay) autoReplyModalOverlay.classList.remove('show'); });

saveAutoReplyBtn.addEventListener('click', function() {
    var instructions = autoReplyInstructions.value.trim();
    if (!instructions) { showToast('Please enter instructions first.'); return; }
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, instructions: instructions }) })
    .then(function(res) {
        if (res.ok) { isAutoReplyActive = true; updateAutoReplyButtonUI(); autoReplyModalOverlay.classList.remove('show'); showToast('AI Auto-Reply activated!'); }
        else showToast('Failed to save auto-reply settings');
    })
    .catch(function() { showToast('Connection error while saving'); });
});

function openAutoReplyModal() {
    if (!currentLeadId) { showToast('Open a chat first.'); return; }
    if (isAutoReplyActive) chatAutoReplyBtn.click();
    else { autoReplyModalOverlay.classList.add('show'); autoReplyInstructions.focus(); }
}

window.addEventListener('popstate', function(e) {
    if (chatView.classList.contains('active')) { closeChatAndGoBack(); history.pushState(null, '', window.location.href); }
});

window.addEventListener('beforeunload', function() { stopPolling(); stopContactPolling(); });

// ── START EVERYTHING ───
loadContacts();
startContactPolling();
history.pushState(null, '', window.location.href);

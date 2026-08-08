// ============================================================
// notifications.js - FAST LOADING VERSION
// Skyline AA-1 Inbox / Notifications Logic
// Like WhatsApp - Instant UI, Background Updates
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

// AI AUTO-REPLY DOM ELEMENTS
var chatAutoReplyBtn = document.getElementById('chatAutoReplyBtn');
var autoReplyModalOverlay = document.getElementById('autoReplyModalOverlay');
var closeAutoReplyModal = document.getElementById('closeAutoReplyModal');
var autoReplyInstructions = document.getElementById('autoReplyInstructions');
var saveAutoReplyBtn = document.getElementById('saveAutoReplyBtn');

// FOLLOW-UP ELEMENTS
var followupBtn = document.getElementById('chatFollowupBtn');
var followupDropdown = document.getElementById('chatFollowupDropdown');
var followupStatus = document.getElementById('followupStatus');

// AUTO FOLLOW-UP MODAL ELEMENTS
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

// ─── STATE ───
var allContacts = [];
var toastTimeout = null;
var currentLeadId = null;
var currentLeadName = null;
var currentLeadEmail = null;
var isSending = false;
var isAutoReplyActive = false;

// ✅ FAST LOADING: CACHE KEYS
var CACHE_KEYS = {
    CONTACTS: 'notif_contacts_cache',
    CONTACTS_TIME: 'notif_contacts_time',
    MESSAGES_PREFIX: 'notif_messages_',
    MESSAGES_TIME_PREFIX: 'notif_messages_time_',
    FOLLOWUP_PREFIX: 'notif_followup_',
    UNREAD_COUNT: 'notif_unread_count'
};

// ✅ FAST LOADING: CACHE TTL (5 minutes)
var CACHE_TTL = 5 * 60 * 1000;

// ✅ FAST LOADING: POLLING INTERVAL (3 seconds)
var _pollInterval = null;
var _contactPollInterval = null;
var _currentMessageCount = 0;
var CONTACT_POLL_MS = 5000;

// ============================================================
// ✅ FAST LOADING: CACHE HELPERS
// ============================================================

function saveContactsToCache(contacts) {
    try {
        localStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(contacts));
        localStorage.setItem(CACHE_KEYS.CONTACTS_TIME, String(Date.now()));
    } catch (e) { /* Ignore */ }
}

function getContactsFromCache() {
    try {
        var data = localStorage.getItem(CACHE_KEYS.CONTACTS);
        var time = localStorage.getItem(CACHE_KEYS.CONTACTS_TIME);
        if (!data || !time) return null;
        if (Date.now() - parseInt(time) > CACHE_TTL) return null;
        return JSON.parse(data);
    } catch (e) { return null; }
}

function saveMessagesToCache(leadId, messages) {
    try {
        localStorage.setItem(CACHE_KEYS.MESSAGES_PREFIX + leadId, JSON.stringify(messages));
        localStorage.setItem(CACHE_KEYS.MESSAGES_TIME_PREFIX + leadId, String(Date.now()));
    } catch (e) { /* Ignore */ }
}

function getMessagesFromCache(leadId) {
    try {
        var data = localStorage.getItem(CACHE_KEYS.MESSAGES_PREFIX + leadId);
        var time = localStorage.getItem(CACHE_KEYS.MESSAGES_TIME_PREFIX + leadId);
        if (!data || !time) return null;
        if (Date.now() - parseInt(time) > CACHE_TTL) return null;
        return JSON.parse(data);
    } catch (e) { return null; }
}

// ============================================================
// ✅ FAST LOADING: INSTANT UI - SHOW CACHED DATA FIRST
// ============================================================

function loadContactsInstant() {
    // ✅ STEP 1: Show cached contacts IMMEDIATELY (like WhatsApp)
    var cached = getContactsFromCache();
    if (cached && cached.length > 0) {
        allContacts = cached;
        renderContacts(allContacts);
        loadingScreen.classList.add('hidden');
        console.log('⚡ [FAST] Loaded ' + cached.length + ' contacts from cache');
        return true;
    }
    return false;
}

function loadChatHistoryInstant(leadId) {
    // ✅ STEP 1: Show cached messages IMMEDIATELY (like WhatsApp)
    var cached = getMessagesFromCache(leadId);
    if (cached && cached.length > 0) {
        renderChatMessages(cached);
        _currentMessageCount = cached.length;
        console.log('⚡ [FAST] Loaded ' + cached.length + ' messages from cache');
        return true;
    }
    return false;
}

// ============================================================
// ✅ SMART LOADING: Background Fetch + Update
// ============================================================

function loadContacts(forceRefresh) {
    // ✅ If we have cached data, show it first
    var hasCache = loadContactsInstant();
    
    // ✅ Then fetch fresh data in background
    if (!forceRefresh && hasCache) {
        // Already showing cached data, fetch in background
        fetchContactsInBackground();
        return Promise.resolve();
    }
    
    // ✅ No cache or force refresh - show loading but fetch
    if (!hasCache) {
        loadingScreen.classList.remove('hidden');
    }
    
    return fetch(BACKEND + '/api/conversations', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        allContacts = data;
        
        // ✅ Save to cache for next time
        saveContactsToCache(data);
        
        // ✅ Update UI (only if changed)
        renderContacts(allContacts);
        loadingScreen.classList.add('hidden');
        console.log('✅ [BACKGROUND] Updated contacts from server');
    })
    .catch(function(err) {
        console.error('Failed to load contacts:', err);
        // If we have cache, keep showing it
        if (!hasCache) {
            showEmptyState();
            loadingScreen.classList.add('hidden');
        }
    });
}

function fetchContactsInBackground() {
    // ✅ Silent background fetch - no loading spinner
    fetch(BACKEND + '/api/conversations', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) return null;
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        allContacts = data;
        saveContactsToCache(data);
        renderContacts(allContacts);
        console.log('🔄 [BACKGROUND] Contacts updated silently');
    })
    .catch(function() { /* Silently ignore */ });
}

function loadChatHistory(leadId) {
    // ✅ If we have cached messages, show them first
    var hasCache = loadChatHistoryInstant(leadId);
    
    // ✅ Then fetch fresh data in background
    if (hasCache) {
        // Already showing cached messages, fetch in background
        fetchChatHistoryInBackground(leadId);
        return Promise.resolve();
    }
    
    // ✅ No cache - show loading
    messagesContainer.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px;"><div class="spinner" style="width:28px; height:28px; border-width:2px;"></div><div style="color:#505050; font-size:11px; letter-spacing:0.05em;">Loading messages...</div></div>';

    return fetch(BACKEND + '/api/conversations/' + encodeURIComponent(leadId), {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            if (res.status === 404) {
                messagesContainer.innerHTML = '<div class="empty-chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>Conversation not found</h3><p>This conversation may have been deleted.</p></div>';
                return;
            }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var messages = data.messages || [];
        
        // ✅ Save to cache
        saveMessagesToCache(leadId, messages);
        _currentMessageCount = messages.length;
        
        // ✅ Update UI (only if changed)
        renderChatMessages(messages);
        console.log('✅ [BACKGROUND] Updated ' + messages.length + ' messages from server');
    })
    .catch(function(err) {
        console.error('Load chat history error:', err);
        if (!hasCache) {
            messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#505050; font-size:12px;">Failed to load messages. Please try again.</div>';
        }
    });
}

function fetchChatHistoryInBackground(leadId) {
    // ✅ Silent background fetch - no loading spinner
    fetch(BACKEND + '/api/conversations/' + encodeURIComponent(leadId), {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) return null;
        return res.json();
    })
    .then(function(data) {
        if (!data || !data.messages) return;
        var messages = data.messages;
        saveMessagesToCache(leadId, messages);
        
        // Only re-render if messages changed
        if (messages.length !== _currentMessageCount) {
            renderChatMessages(messages);
            _currentMessageCount = messages.length;
            console.log('🔄 [BACKGROUND] Messages updated silently');
        }
    })
    .catch(function() { /* Silently ignore */ });
}

// ============================================================
// ✅ OPEN CHAT - INSTANT + BACKGROUND
// ============================================================

function openChat(leadId, name, email) {
    if (currentLeadId === leadId && chatView.classList.contains('active')) {
        loadChatHistory(leadId);
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

    // ✅ Clear unread badge locally immediately
    for (var ci = 0; ci < allContacts.length; ci++) {
        if (allContacts[ci].id === leadId) {
            allContacts[ci].unreadCount = 0;
            allContacts[ci].unread = false;
            break;
        }
    }
    renderContacts(allContacts);

    // ✅ Load chat history (cached first, then background)
    Promise.all([
        loadFollowUpStatus(),
        loadChatHistory(leadId),
        loadAutoReplyStatus()
    ]).then(function() {
        // ✅ Start background polling for new messages
        startPolling(leadId);
    }).catch(function() {
        startPolling(leadId);
    });
}

// ============================================================
// ✅ RENDER CONTACTS (FAST)
// ============================================================

function renderContacts(contacts) {
    if (!contacts || contacts.length === 0) {
        if (searchInput.value.trim() !== '') {
            contactList.classList.remove('active');
            emptyState.classList.remove('active');
            noResults.classList.add('active');
        } else {
            showEmptyState();
        }
        return;
    }

    contactList.classList.add('active');
    emptyState.classList.remove('active');
    noResults.classList.remove('active');

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

// ============================================================
// ✅ RENDER CHAT MESSAGES (FAST)
// ============================================================

function renderChatMessages(messages) {
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>No messages yet</h3><p>Send a message to start the conversation.</p></div>';
        _currentMessageCount = 0;
        return;
    }

    // ✅ Use DocumentFragment for faster rendering
    var fragment = document.createDocumentFragment();
    
    for (var i = 0; i < messages.length; i++) {
        var div = document.createElement('div');
        var msg = messages[i];
        var cssClass = msg.from === 'lead' ? 'from-lead' : 'from-ai';
        var senderLabel = msg.from === 'lead' ? 'You' : 'Customer';
        var align = msg.from === 'lead' ? 'flex-end' : 'flex-start';
        var time = msg.date ? new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        div.className = 'msg-group ' + cssClass;
        div.style.alignSelf = align;
        div.innerHTML = '<div class="msg-sender">' + senderLabel + '</div><div class="message-bubble">' + safeSanitize(msg.content) + '</div><div class="message-time">' + time + '</div>';
        fragment.appendChild(div);
    }
    
    messagesContainer.appendChild(fragment);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================================
// ✅ APPEND MESSAGE (OPTIMIZED)
// ============================================================

function appendMessage(from, content, date) {
    var div = document.createElement('div');
    var cssClass = from === 'lead' ? 'from-lead' : 'from-ai';
    var senderLabel = from === 'lead' ? 'You' : 'Customer';
    var align = from === 'lead' ? 'flex-end' : 'flex-start';
    var time = date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    div.className = 'msg-group ' + cssClass;
    div.style.alignSelf = align;
    div.innerHTML = '<div class="msg-sender">' + senderLabel + '</div><div class="message-bubble">' + safeSanitize(content) + '</div><div class="message-time">' + time + '</div>';

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================================
// ✅ BACKGROUND POLLING (3 seconds)
// ============================================================

function startPolling(leadId) {
    stopPolling();
    
    _pollInterval = setInterval(function() {
        if (!currentLeadId || currentLeadId !== leadId || !chatView.classList.contains('active')) {
            stopPolling();
            return;
        }
        
        // ✅ Silent fetch - no loading spinner
        fetch(BACKEND + '/api/conversations/' + encodeURIComponent(leadId), {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) {
            if (!res.ok) return null;
            return res.json();
        })
        .then(function(data) {
            if (!data || !data.messages) return;
            
            var newMessages = data.messages;
            
            if (newMessages.length > _currentMessageCount) {
                // ✅ Save to cache
                saveMessagesToCache(leadId, newMessages);
                
                // ✅ Append only new messages (don't re-render everything)
                for (var i = _currentMessageCount; i < newMessages.length; i++) {
                    appendMessage(newMessages[i].from, newMessages[i].content, newMessages[i].date);
                }
                
                _currentMessageCount = newMessages.length;
                
                // ✅ Show toast for incoming messages
                var lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.from !== 'lead') {
                    showToast('📩 New reply from ' + (currentLeadName || 'customer') + '!');
                }
                
                // ✅ Update contact list in background
                fetchContactsInBackground();
            }
        })
        .catch(function() { /* Silently ignore */ });
    }, 3000);
}

function stopPolling() {
    if (_pollInterval) {
        clearInterval(_pollInterval);
        _pollInterval = null;
    }
}

// ============================================================
// ✅ CONTACT POLLING (5 seconds)
// ============================================================

function startContactPolling() {
    if (_contactPollInterval) clearInterval(_contactPollInterval);
    _contactPollInterval = setInterval(function() {
        if (!token) return;
        fetchContactsInBackground();
    }, CONTACT_POLL_MS);
}

function stopContactPolling() {
    if (_contactPollInterval) {
        clearInterval(_contactPollInterval);
        _contactPollInterval = null;
    }
}

// ============================================================
// ✅ SEND MESSAGE (OPTIMISTIC - Like WhatsApp)
// ============================================================

function sendMessage() {
    var text = chatInput.value.trim();
    if (!text || isSending || !currentLeadId) return;

    isSending = true;
    chatSendBtn.disabled = true;

    var originalText = text;
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // ✅ STEP 1: Show message INSTANTLY (optimistic UI)
    appendMessage('lead', originalText, new Date().toISOString());
    _currentMessageCount++;

    var payload = {
        leads: [{
            name: currentLeadName || 'Unknown',
            email: currentLeadEmail || '',
            company: '',
            messages: [{ 
                subject: 'Re: Conversation', 
                body: originalText 
            }]
        }],
        leadId: currentLeadId,
        allowNewLead: false
    };

    // ✅ STEP 2: Send in background
    fetch(BACKEND + '/api/leads/batch-send', {
        method: 'POST',
        headers: { 
            'Authorization': 'Bearer ' + token, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            // ✅ Update cache silently
            setTimeout(function() {
                fetchContactsInBackground();
            }, 800);
        } else {
            showToast('Failed to send: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(function(err) {
        console.error('Network Error:', err);
        showToast('Connection error. Message may not have been sent.');
    })
    .finally(function() {
        isSending = false;
        chatSendBtn.disabled = !chatInput.value.trim();
    });
}

// ============================================================
// ✅ TOAST HELPER
// ============================================================

function showToast(message, duration) {
    duration = duration || 3000;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
    }, duration);
}

// ============================================================
// ✅ SAFE SANITIZE
// ============================================================

function safeSanitize(str) {
    if (!str) return '';
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(str);
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// ✅ ESCAPE HTML
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// ✅ CLOSE CHAT
// ============================================================

function closeChatAndGoBack() {
    chatView.classList.remove('active');
    document.body.classList.remove('chat-active');
    document.body.style.overflow = '';
    currentLeadId = null;
    stopPolling();
}

// ─── CHAT BACK ───
chatBack.addEventListener('click', function() {
    closeChatAndGoBack();
});

// ─── CHAT INPUT ───
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    chatSendBtn.disabled = !this.value.trim();
});

chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) {
            sendMessage();
        }
    }
});

chatSendBtn.addEventListener('click', sendMessage);

// ============================================================
// ✅ RENAME LEAD
// ============================================================

chatRenameBtn.addEventListener('click', function() {
    if (!currentLeadId) {
        showToast('No lead selected.');
        return;
    }
    var newName = prompt('Enter new name for this contact:', currentLeadName || '');
    if (newName === null || newName.trim() === '') return;
    renameLead(currentLeadId, newName.trim());
});

function renameLead(leadId, newName) {
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(leadId) + '/rename', {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newName })
    })
    .then(function(res) { return res.text().then(function(text) { return { ok: res.ok, status: res.status, text: text }; }); })
    .then(function(result) {
        var data = {};
        if (result.text) {
            try { data = JSON.parse(result.text); } catch (e) { data = { message: result.text || 'Empty response' }; }
        }

        if (!result.ok) {
            if (result.status === 401 || result.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            showToast('Failed to rename: ' + (data.message || data.error || 'Unknown error'));
            return;
        }

        if (data.success) {
            currentLeadName = data.newName;
            chatName.textContent = data.newName;
            chatAvatar.textContent = data.newName.charAt(0).toUpperCase();
            showToast('Renamed successfully!');
            fetchContactsInBackground();
        } else {
            showToast('Failed to rename: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(function(err) {
        console.error('Rename error:', err);
        showToast('Connection error while renaming.');
    });
}

// ============================================================
// ✅ FOLLOW-UP FUNCTIONS
// ============================================================

function loadFollowUpStatus() {
    if (!currentLeadId) {
        return Promise.resolve();
    }

    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/follow-up-status', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        if (followupStatus) {
            if (data.autoFollowUpEnabled) {
                followupStatus.textContent = 'ON';
                followupStatus.className = 'followup-status on';
            } else {
                followupStatus.textContent = 'OFF';
                followupStatus.className = 'followup-status';
            }
        }
        afCurrentEnabledState = data.autoFollowUpEnabled || false;
        updateModalStatus(afCurrentEnabledState);
    })
    .catch(function(err) {
        console.error('Failed to load follow-up status:', err);
    });
}

function suggestFollowUp() {
    if (!currentLeadId) {
        showToast('Open a chat first to get a follow-up suggestion.');
        return;
    }

    showToast('Generating follow-up suggestion...');

    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/suggest-follow-up', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            return res.json().then(function(err) {
                showToast('Failed: ' + (err.message || 'Unknown error'));
            });
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.success && data.suggestion) {
            chatInput.value = data.suggestion;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
            chatSendBtn.disabled = false;
            chatInput.focus();
            showToast('Follow-up suggestion ready!');
        } else {
            showToast(data.message || 'No suggestion generated.');
        }
    })
    .catch(function(err) {
        console.error('Suggest follow-up error:', err);
        showToast('Connection error. Please try again.');
    });
}

function generateHint() {
    if (!currentLeadId) {
        showToast('Open a chat first to get a hint.');
        return;
    }

    showToast('Generating AI hint...');

    fetch(BACKEND + '/api/conversations/' + encodeURIComponent(currentLeadId), {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(convRes) {
        if (!convRes.ok) {
            if (convRes.status === 401 || convRes.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            showToast('Failed to load conversation.');
            return;
        }
        return convRes.json();
    })
    .then(function(convData) {
        if (!convData) return;
        var messages = convData.messages || [];

        if (messages.length === 0) {
            showToast('No messages to generate a hint from.');
            return;
        }

        return fetch(BACKEND + '/api/ai/suggest', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                messages: messages.slice(-5)
            })
        });
    })
    .then(function(suggestRes) {
        if (!suggestRes) return;
        if (!suggestRes.ok) {
            if (suggestRes.status === 401 || suggestRes.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            return suggestRes.json().then(function(err) {
                showToast('Failed: ' + (err.message || 'Unknown error'));
            });
        }
        return suggestRes.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.suggestion) {
            chatInput.value = data.suggestion;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
            chatSendBtn.disabled = false;
            chatInput.focus();
            showToast('AI hint ready!');
        } else {
            showToast(data.message || 'No hint generated.');
        }
    })
    .catch(function(err) {
        console.error('Generate hint error:', err);
        showToast('Connection error. Please try again.');
    });
}

function toggleAutoFollowUp(days, forceState) {
    if (!currentLeadId) {
        showToast('Open a chat first to manage auto follow-up.');
        return;
    }

    var delayDays = days || afSelectedDays || 3;
    var newStatus = typeof forceState !== 'undefined' ? forceState : !afCurrentEnabledState;

    afCurrentEnabledState = newStatus;
    updateModalStatus(afCurrentEnabledState);

    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-follow-up', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: newStatus, delayDays: delayDays })
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            var errorMessage = 'Failed to toggle auto follow-up.';
            return res.json().then(function(err) {
                errorMessage = err.message || err.error || errorMessage;
                afCurrentEnabledState = !newStatus;
                updateModalStatus(afCurrentEnabledState);
                showToast(errorMessage);
            }).catch(function() {
                afCurrentEnabledState = !newStatus;
                updateModalStatus(afCurrentEnabledState);
                showToast(errorMessage);
            });
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        if (data.success) {
            afCurrentEnabledState = data.autoFollowUpEnabled;
            updateModalStatus(afCurrentEnabledState);
            
            if (data.autoFollowUpEnabled) {
                showToast('Auto follow-up enabled. First follow-up in ' + delayDays + ' day(s).');
            } else {
                showToast('Auto follow-up disabled.');
            }
        } else {
            afCurrentEnabledState = !newStatus;
            updateModalStatus(afCurrentEnabledState);
            showToast(data.message || 'Failed to toggle auto follow-up.');
        }
    })
    .catch(function(err) {
        console.error('AUTO-FOLLOWUP Error:', err);
        afCurrentEnabledState = !newStatus;
        updateModalStatus(afCurrentEnabledState);
        showToast('Connection error. Please try again.');
    });
}

// ============================================================
// ✅ MODAL STATUS UPDATE
// ============================================================

function updateModalStatus(enabled) {
    if (followupStatus) {
        if (enabled) {
            followupStatus.textContent = 'ON';
            followupStatus.className = 'followup-status on';
        } else {
            followupStatus.textContent = 'OFF';
            followupStatus.className = 'followup-status';
        }
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
        confirmAutoFollowup.textContent = enabled ? '❌ Disable Auto Follow-up' : '✅ Enable Auto Follow-up';
        confirmAutoFollowup.style.background = enabled ? '#ff5555' : 'var(--green)';
        confirmAutoFollowup.style.color = enabled ? '#fff' : '#000';
    }
}

// ============================================================
// ✅ MENU TOGGLE
// ============================================================

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
        if (action === 'revenue') {
            fetchRevenueData();
            return;
        }
        if (action === 'followup') {
            if (!currentLeadId) {
                showToast('Open a chat first to access follow-up.');
                return;
            }
            suggestFollowUp();
            return;
        }
        if (action === 'hint') {
            if (!currentLeadId) {
                showToast('Open a chat first to get a hint.');
                return;
            }
            generateHint();
            return;
        }
        if (action === 'autoreply') {
            if (!currentLeadId) {
                showToast('Open a chat first to configure auto-reply.');
                return;
            }
            openAutoReplyModal();
            return;
        }
        showToast('Please open a chat to access this feature.');
    });
});

// ============================================================
// ✅ REVENUE FUNCTIONS
// ============================================================

var CATEGORY_CONFIG = {
    contacted: { label: 'Contacted', icon: '🔵', color: '#66ddff' },
    replied: { label: 'Replied', icon: '🟢', color: '#66dd99' },
    interested: { label: 'Interested', icon: '🟡', color: '#ffbb44' },
    ongoing: { label: 'Ongoing', icon: '🟣', color: '#bb88ff' },
    win: { label: 'Win', icon: '🔴', color: '#ff6b6b' }
};

function fetchRevenueData() {
    revenueModal.classList.add('active');
    revenueBody.innerHTML = '<div class="modal-loading">Loading revenue data...</div>';
    tierBadge.textContent = 'Loading...';

    fetch(BACKEND + '/api/revenue/tracking', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (data) renderRevenueData(data);
    })
    .catch(function(err) {
        console.error('Failed to fetch revenue:', err);
        revenueBody.innerHTML = '<div class="modal-error"><p>Failed to load revenue data.</p><p style="font-size:12px; color:#707070; margin-top:8px;">' + escapeHtml(err.message) + '</p></div>';
        tierBadge.textContent = 'Error';
    });
}

function renderRevenueData(data) {
    var tier = data.tier || 'free';
    tierBadge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);

    var categories = data.categories || {};
    var html = '';

    html += '<div style="margin-bottom:12px;"><strong style="color:#f5f5f5; font-size:13px;">📊 Categories</strong></div>';

    var hasCategories = false;
    var catKeys = Object.keys(categories);
    for (var ci = 0; ci < catKeys.length; ci++) {
        var key = catKeys[ci];
        var leads = categories[key];
        var config = CATEGORY_CONFIG[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), icon: '•', color: '#707070' };
        var count = Array.isArray(leads) ? leads.length : 0;

        if (count > 0) hasCategories = true;

        html += '<div class="category-section cat-' + key + '"><div class="category-header"><span class="category-name"><span class="category-icon"></span>' + config.icon + ' ' + config.label + '</span><span class="category-count">' + count + '</span></div>';

        if (count === 0) {
            html += '<div class="empty-category">No leads in this category</div>';
        } else {
            var displayLeads = leads.slice(0, 10);
            var remaining = leads.length - 10;

            for (var li = 0; li < displayLeads.length; li++) {
                var lead = displayLeads[li];
                var lname = lead.name || 'Unknown';
                var company = lead.company || '';
                var leadId = lead.id || '';
                html += '<div class="lead-item" data-id="' + leadId + '" onclick="openChatFromRevenue(\'' + leadId + '\', \'' + safeSanitize(lname).replace(/'/g, "\\'") + '\', \'' + safeSanitize(lead.email || '').replace(/'/g, "\\'") + '\')"><span class="lead-name">' + safeSanitize(lname) + '</span>' + (company ? '<span class="lead-company"> · ' + safeSanitize(company) + '</span>' : '') + '</div>';
            }

            if (remaining > 0) {
                html += '<div class="lead-item" style="color:#505050; font-style:italic; border-left-color:transparent; cursor:default;">+ ' + remaining + ' more</div>';
            }
        }

        html += '</div>';
    }

    if (!hasCategories) {
        html += '<div class="no-data">No leads found.</div>';
    }

    var advice = data.advice || {};
    var adviceKeys = Object.keys(advice);
    if (adviceKeys.length > 0) {
        html += '<div class="section-divider"></div>';
        html += '<div class="advice-section">';
        html += '<div class="advice-title">💡 Strategic Advice</div>';

        for (var ai = 0; ai < adviceKeys.length; ai++) {
            var akey = adviceKeys[ai];
            var label = akey.replace('Advice', '').replace(/([A-Z])/g, ' $1').replace(/^./, function(str) { return str.toUpperCase(); });
            var value = advice[akey];
            if (value && value.trim()) {
                html += '<div class="advice-item"><strong>' + label + ':</strong> ' + safeSanitize(value) + '</div>';
            }
        }

        html += '</div>';
    }

    var actions = data.actions || [];
    if (actions.length > 0) {
        html += '<div class="section-divider"></div>';
        html += '<div class="actions-section">';
        html += '<div class="actions-title">Recommended Actions</div>';

        var maxActions = Math.min(actions.length, 10);
        for (var aci = 0; aci < maxActions; aci++) {
            var action = actions[aci];
            html += '<div class="action-item"><span style="color:#505050; font-size:10px;">' + (aci + 1) + '.</span><span class="action-lead">' + safeSanitize(action.leadName || 'Lead') + '</span><span class="action-text"> — ' + safeSanitize(action.action || 'Follow up') + '</span></div>';
        }

        if (actions.length > 10) {
            html += '<div class="no-data" style="padding-top:4px;">+ ' + (actions.length - 10) + ' more actions</div>';
        }

        html += '</div>';
    }

    if (tierBadge.textContent === 'Free') {
        html += '<div class="section-divider"></div>';
        html += '<div style="background: rgba(255,187,68,0.06); border: 1px solid rgba(255,187,68,0.15); border-radius: 8px; padding: 12px 16px; margin-top: 4px;"><p style="color:#ffbb44; font-size:12px; margin:0;">Upgrade to <strong>Go</strong> for AI-powered advice, or <strong>Pro</strong> for personalised actions on your top leads.</p></div>';
    }

    revenueBody.innerHTML = html;
}

function openChatFromRevenue(leadId, name, email) {
    revenueModal.classList.remove('active');
    openChat(leadId, name, email);
}

// ============================================================
// ✅ AUTO-REPLY FUNCTIONS
// ============================================================

function loadAutoReplyStatus() {
    if (!currentLeadId) return Promise.resolve();

    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (res.ok) return res.json();
        return null;
    })
    .then(function(data) {
        if (data) {
            isAutoReplyActive = data.enabled || false;
            autoReplyInstructions.value = data.instructions || '';
            updateAutoReplyButtonUI();
        }
    })
    .catch(function(err) { console.error('Failed to load auto-reply status:', err); });
}

function updateAutoReplyButtonUI() {
    if (isAutoReplyActive) {
        chatAutoReplyBtn.classList.add('active');
        chatAutoReplyBtn.setAttribute('title', 'AI Auto-Reply ON - Click to turn OFF');
    } else {
        chatAutoReplyBtn.classList.remove('active');
        chatAutoReplyBtn.setAttribute('title', 'AI Auto-Reply OFF - Click to configure');
    }
}

chatAutoReplyBtn.addEventListener('click', function() {
    if (!currentLeadId) { showToast('Open a chat first.'); return; }
    
    if (isAutoReplyActive) {
        fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false, instructions: autoReplyInstructions.value })
        })
        .then(function(res) {
            if (res.ok) {
                isAutoReplyActive = false;
                updateAutoReplyButtonUI();
                showToast('AI Auto-Reply disabled');
            }
        })
        .catch(function() { showToast('Failed to disable auto-reply'); });
    } else {
        autoReplyModalOverlay.classList.add('show');
        autoReplyInstructions.focus();
    }
});

closeAutoReplyModal.addEventListener('click', function() { autoReplyModalOverlay.classList.remove('show'); });
autoReplyModalOverlay.addEventListener('click', function(e) {
    if (e.target === autoReplyModalOverlay) autoReplyModalOverlay.classList.remove('show');
});

saveAutoReplyBtn.addEventListener('click', function() {
    var instructions = autoReplyInstructions.value.trim();
    if (!instructions) { showToast('Please enter instructions first.'); return; }
    
    fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-reply', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, instructions: instructions })
    })
    .then(function(res) {
        if (res.ok) {
            isAutoReplyActive = true;
            updateAutoReplyButtonUI();
            autoReplyModalOverlay.classList.remove('show');
            showToast('AI Auto-Reply activated!');
        } else {
            showToast('Failed to save auto-reply settings');
        }
    })
    .catch(function() { showToast('Connection error while saving'); });
});

function openAutoReplyModal() {
    if (!currentLeadId) { showToast('Open a chat first.'); return; }
    if (isAutoReplyActive) {
        chatAutoReplyBtn.click();
    } else {
        autoReplyModalOverlay.classList.add('show');
        autoReplyInstructions.focus();
    }
}

// ============================================================
// ✅ AUTO FOLLOW-UP MODAL EVENTS
// ============================================================

// ─── OPEN AUTO FOLLOW-UP MODAL ───
var autoFollowupOption = document.querySelector('.chat-followup-option[data-action="auto"]');
if (autoFollowupOption) {
    autoFollowupOption.addEventListener('click', function(e) {
        e.stopPropagation();
        if (followupDropdown) {
            followupDropdown.classList.remove('show');
        }
        loadFollowUpStatusForModal();
        if (autoFollowupModal) {
            autoFollowupModal.classList.add('active');
        }
    });
}

function loadFollowUpStatusForModal() {
    if (!currentLeadId) {
        return;
    }
    return fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/follow-up-status', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (data) {
            afCurrentEnabledState = data.autoFollowUpEnabled || false;
            updateModalStatus(afCurrentEnabledState);
        }
    })
    .catch(function(err) {
        console.error('Failed to load follow-up status for modal:', err);
    });
}

function closeAutoFollowupModalFn() {
    if (autoFollowupModal) {
        autoFollowupModal.classList.remove('active');
    }
}

if (closeAutoFollowupModal) closeAutoFollowupModal.addEventListener('click', closeAutoFollowupModalFn);
if (cancelAutoFollowup) cancelAutoFollowup.addEventListener('click', closeAutoFollowupModalFn);

if (autoFollowupModal) {
    autoFollowupModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeAutoFollowupModalFn();
        }
    });
}

// ─── DAY BUTTON CLICK IN MODAL ───
afDayButtons.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        afDayButtons.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        afSelectedDays = parseInt(this.dataset.days);
        if (afCustomInput) {
            afCustomInput.value = afSelectedDays;
        }
    });
});

// ── CUSTOM INPUT IN MODAL ───
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

// ─── CONFIRM AUTO FOLLOW-UP ───
if (confirmAutoFollowup) {
    confirmAutoFollowup.addEventListener('click', function() {
        var newState = !afCurrentEnabledState;
        closeAutoFollowupModalFn();
        toggleAutoFollowUp(afSelectedDays, newState);
    });
}

// ─── FOLLOW-UP DROPDOWN TOGGLE ───
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

// ── SUGGEST FOLLOW-UP ───
var suggestBtn = document.querySelector('.chat-followup-option[data-action="suggest"]');
if (suggestBtn) {
    suggestBtn.addEventListener('click', function() {
        followupDropdown.classList.remove('show');
        suggestFollowUp();
    });
}

var hintOption = document.querySelector('.chat-followup-option[data-action="hint"]');
if (hintOption) {
    hintOption.addEventListener('click', function() {
        followupDropdown.classList.remove('show');
        generateHint();
    });
}

// ============================================================
// ✅ REVENUE MODAL CLOSE
// ============================================================

closeRevenueModal.addEventListener('click', function() {
    revenueModal.classList.remove('active');
});

revenueModal.addEventListener('click', function(e) {
    if (e.target === this) {
        revenueModal.classList.remove('active');
    }
});

// ============================================================
// ✅ SHOW EMPTY STATE
// ============================================================

function showEmptyState() {
    contactList.classList.remove('active');
    emptyState.classList.add('active');
    noResults.classList.remove('active');
}

// ============================================================
// ✅ SEARCH
// ============================================================

searchInput.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
    if (!query) {
        renderContacts(allContacts);
        return;
    }
    var filtered = [];
    for (var i = 0; i < allContacts.length; i++) {
        var c = allContacts[i];
        if ((c.name || '').toLowerCase().indexOf(query) !== -1 ||
            (c.company || '').toLowerCase().indexOf(query) !== -1 ||
            (c.email || '').toLowerCase().indexOf(query) !== -1) {
            filtered.push(c);
        }
    }
    renderContacts(filtered);
});

// ============================================================
// ✅ PHONE BACK BUTTON
// ============================================================

window.addEventListener('popstate', function(e) {
    if (chatView.classList.contains('active')) {
        closeChatAndGoBack();
        history.pushState(null, '', window.location.href);
    }
});

// ============================================================
// ✅ CLEAN UP
// ============================================================

window.addEventListener('beforeunload', function() {
    stopPolling();
    stopContactPolling();
});

// ============================================================
// ✅ INIT - FAST LOADING STARTUP
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    var token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // ✅ FAST: Show cached contacts immediately
    var cached = getContactsFromCache();
    if (cached && cached.length > 0) {
        allContacts = cached;
        renderContacts(allContacts);
        loadingScreen.classList.add('hidden');
        console.log('⚡ [INIT] Contacts shown from cache');
    }
    
    // ✅ BACKGROUND: Fetch fresh data
    loadContacts(true);
    
    // ✅ Start contact polling
    startContactPolling();
    
    // ✅ Setup history state
    history.pushState(null, '', window.location.href);
    
    // ✅ Setup notification badge (global)
    if (typeof initNotifBadge === 'function') {
        initNotifBadge();
    }
    
    console.log('✅ [INIT] Notifications page loaded with FAST mode');
});

console.log('✅ [NOTIFICATIONS] Fast loading system initialized');

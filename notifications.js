// ============================================================
// notifications.js
// Skyline AA-1 Inbox / Notifications Logic
// INSTANT LOADING - Always loaded in background
// WITH SKELETON LOADERS + HTML STRIPPING
// ============================================================

// ── CONFIG ───
var BACKEND = 'https://skylineapp-backend-file.onrender.com';
var token = localStorage.getItem('token');

// ════════════════════════════════════════════
// ✅ DETECT WHICH PAGE WE'RE ON
// ════════════════════════════════════════════
var isNotificationsPage = !!document.getElementById('contactList');
var isChatPage = !!document.getElementById('chatView');

// ════════════════════════════════════════════
// ✅ SHARED BADGE SYSTEM (Works across ALL pages)
// ════════════════════════════════════════════

// ─── BADGE STATE KEYS ───
var BADGE_KEY = 'globalUnreadCount';
var SEEN_KEY = 'lastSeenNotifCount';
var CONTACTS_CACHE_KEY = 'notif_contacts_cache';
var CONTACTS_CACHE_TIME_KEY = 'notif_contacts_cache_time';
var CACHE_TTL = 60000; // 60 seconds

// ─── Get stored badge count ───
function getStoredBadge() {
    var count = localStorage.getItem(BADGE_KEY);
    if (count === null || count === undefined) return 0;
    return parseInt(count) || 0;
}

// ─── Set stored badge count ───
function setStoredBadge(count) {
    localStorage.setItem(BADGE_KEY, String(count || 0));
}

// ─── Get last seen count ───
function getLastSeenCount() {
    var count = localStorage.getItem(SEEN_KEY);
    return count ? parseInt(count) : 0;
}

// ─── Set last seen count ───
function setLastSeenCount(count) {
    localStorage.setItem(SEEN_KEY, String(count || 0));
}

// ─── Get cached contacts ───
function getCachedContacts() {
    try {
        var data = localStorage.getItem(CONTACTS_CACHE_KEY);
        var time = localStorage.getItem(CONTACTS_CACHE_TIME_KEY);
        if (!data || !time) return null;
        if (Date.now() - parseInt(time) > CACHE_TTL) return null;
        return JSON.parse(data);
    } catch (e) { return null; }
}

// ─── Set cached contacts ───
function setCachedContacts(contacts) {
    try {
        localStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify(contacts));
        localStorage.setItem(CONTACTS_CACHE_TIME_KEY, String(Date.now()));
    } catch (e) { /* ignore */ }
}

// ─── UPDATE ALL BADGES ON CURRENT PAGE ───
function updateAllBadges(count) {
    var badges = document.querySelectorAll('.nav-badge');
    if (badges.length === 0) return;

    badges.forEach(function(badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
            badge.style.background = '#ff5555';
            var parent = badge.closest('.nav-item');
            if (parent) parent.classList.add('has-notifs');
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
            var parent = badge.closest('.nav-item');
            if (parent) parent.classList.remove('has-notifs');
        }
    });
}

// ─── FETCH UNREAD COUNT FROM SERVER ───
function fetchGlobalUnreadCount() {
    var token = localStorage.getItem('token');
    if (!token) {
        updateAllBadges(0);
        return;
    }

    fetch(BACKEND + '/api/notifications/count', {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                updateAllBadges(0);
                return;
            }
            var stored = getStoredBadge();
            updateAllBadges(stored);
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var count = data.count || 0;
        setStoredBadge(count);
        var seen = getLastSeenCount();
        var displayCount = count > seen ? count - seen : 0;
        updateAllBadges(displayCount);
    })
    .catch(function(error) {
        console.error('[NOTIFICATIONS] Fetch error:', error);
        var stored = getStoredBadge();
        updateAllBadges(stored);
    });
}

// ─── MARK NOTIFICATIONS AS READ ───
function markNotificationsRead() {
    var token = localStorage.getItem('token');
    if (!token) return;

    var currentCount = getStoredBadge();
    setLastSeenCount(currentCount);
    setStoredBadge(0);
    updateAllBadges(0);
    console.log('🔔 [BADGE] Marked all as read');
}

// ─── INIT BADGE ON PAGE LOAD ───
function initBadge() {
    var token = localStorage.getItem('token');
    if (!token) {
        updateAllBadges(0);
        return;
    }

    // Show stored count immediately
    var stored = getStoredBadge();
    var seen = getLastSeenCount();
    var displayCount = stored > seen ? stored - seen : 0;
    updateAllBadges(displayCount);

    // Fetch fresh count
    fetchGlobalUnreadCount();

    // Periodic refresh (every 15 seconds)
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
    }
    window._badgeInterval = setInterval(fetchGlobalUnreadCount, 15000);
}

// ─── STORAGE LISTENER (sync across tabs/pages) ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === BADGE_KEY || e.key === SEEN_KEY) {
            var stored = getStoredBadge();
            var seen = getLastSeenCount();
            var displayCount = stored > seen ? stored - seen : 0;
            updateAllBadges(displayCount);
        }
    });
}

// ─── CLEAN UP ───
function cleanupBadge() {
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
        window._badgeInterval = null;
    }
}

// ════════════════════════════════════════════
// ✅ BACKGROUND ENGINE - ALWAYS RUNS ON ALL PAGES
// ════════════════════════════════════════════

var _backgroundPollInterval = null;
var _isBackgroundInitialized = false;

function initBackgroundEngine() {
    if (_isBackgroundInitialized) return;
    _isBackgroundInitialized = true;
    
    var token = localStorage.getItem('token');
    if (!token) {
        updateAllBadges(0);
        return;
    }

    console.log('🔄 [BACKGROUND] Initializing background engine...');

    // ✅ 1. Show badge from cache
    var stored = getStoredBadge();
    var seen = getLastSeenCount();
    var displayCount = stored > seen ? stored - seen : 0;
    updateAllBadges(displayCount);

    // ✅ 2. Fetch fresh count
    fetchGlobalUnreadCount();

    // ✅ 3. Load contacts in background (silent)
    loadContactsInBackground();

    // ✅ 4. Connect SSE for real-time
    connectBackgroundSSE();

    // ✅ 5. Start background polling (every 10 seconds)
    startBackgroundPolling();

    // ✅ 6. Setup storage listener
    setupStorageListener();

    console.log('✅ [BACKGROUND] Engine initialized');
}

// ─── BACKGROUND CONTACT LOADING (SILENT) ───
function loadContactsInBackground() {
    // Check cache first
    var cached = getCachedContacts();
    if (cached && cached.length > 0) {
        // Store in memory for instant access
        window._cachedContactsData = cached;
        console.log('⚡ [BACKGROUND] Loaded', cached.length, 'contacts from cache');
    }

    // Fetch fresh in background
    fetch(BACKEND + '/api/conversations', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                return;
            }
            return null;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        
        var contacts = data;
        if (data.data && Array.isArray(data.data)) {
            contacts = data.data;
        } else if (Array.isArray(data)) {
            contacts = data;
        }
        
        if (!contacts || !Array.isArray(contacts)) {
            contacts = [];
        }
        
        window._cachedContactsData = contacts;
        setCachedContacts(contacts);
        console.log('✅ [BACKGROUND] Updated contacts:', contacts.length);
    })
    .catch(function() { /* Silently ignore */ });
}

// ─── BACKGROUND SSE CONNECTION ───
var sseConnection = null;
var sseReconnectAttempts = 0;
var MAX_SSE_RECONNECT_ATTEMPTS = 10;

function connectBackgroundSSE() {
    var token = localStorage.getItem('token');
    if (!token) return;

    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }

    try {
        sseConnection = new EventSource(BACKEND + '/api/events/stream?token=' + encodeURIComponent(token));

        sseConnection.addEventListener('open', function() {
            console.log('✅ [SSE] Background connection established');
            sseReconnectAttempts = 0;
        });

        sseConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                
                if (data.type === 'new_message') {
                    console.log('📨 [SSE] New message from:', data.leadName || 'Unknown');
                    
                    // ✅ Update badge
                    fetchGlobalUnreadCount();
                    
                    // ✅ Update contacts in background
                    loadContactsInBackground();
                    
                    // ✅ Show toast if on any page
                    if (data.leadName) {
                        showToast('📩 New message from ' + data.leadName, 3000);
                    }
                }
                
                if (data.type === 'lead_updated') {
                    fetchGlobalUnreadCount();
                    loadContactsInBackground();
                }

            } catch (err) {
                // Ignore parse errors
            }
        });

        sseConnection.addEventListener('error', function() {
            console.warn('⚠️ [SSE] Connection error');

            if (sseConnection) {
                sseConnection.close();
                sseConnection = null;
            }

            sseReconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, sseReconnectAttempts), 30000);

            if (sseReconnectAttempts <= MAX_SSE_RECONNECT_ATTEMPTS) {
                setTimeout(connectBackgroundSSE, delay);
            }
        });

    } catch (err) {
        console.error('❌ [SSE] Failed to connect:', err.message);
    }
}

// ─── BACKGROUND POLLING ───
function startBackgroundPolling() {
    if (_backgroundPollInterval) {
        clearInterval(_backgroundPollInterval);
    }
    
    _backgroundPollInterval = setInterval(function() {
        // Only poll if page is visible
        if (!document.hidden) {
            fetchGlobalUnreadCount();
            loadContactsInBackground();
        }
    }, 10000); // Every 10 seconds
}

// ─── TOAST HELPER ───
function showToast(message, duration) {
    duration = duration || 3000;
    
    var toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 12px 20px;
            color: #f5f5f5;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            z-index: 9999;
            max-width: 90%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateX(-50%) translateY(20px);
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
}

// ─── CLEANUP ───
function cleanupBackground() {
    if (_backgroundPollInterval) {
        clearInterval(_backgroundPollInterval);
        _backgroundPollInterval = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
    cleanupBadge();
}

// ════════════════════════════════════════════
// ✅ INSTANT CONTACT DISPLAY (When user clicks notification)
// ════════════════════════════════════════════

function showContactsInstantly() {
    // ✅ Show cached contacts immediately
    var cached = getCachedContacts();
    
    if (cached && cached.length > 0) {
        renderContacts(cached);
        console.log('⚡ [INSTANT] Showed', cached.length, 'contacts from cache');
        return true;
    }
    
    // If no cache, try memory
    if (window._cachedContactsData && window._cachedContactsData.length > 0) {
        renderContacts(window._cachedContactsData);
        console.log('⚡ [INSTANT] Showed', window._cachedContactsData.length, 'contacts from memory');
        return true;
    }
    
    return false;
}

// ════════════════════════════════════════════
//  DOM ELEMENTS (Only used on notifications page)
// ════════════════════════════════════════════

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

// ─── CACHE ───
var _cachedContacts = null;
var _cachedContactsTime = 0;
var CONTACTS_CACHE_TTL = 5000;
var _cachedChatHistory = {};
var CHAT_HISTORY_CACHE_TTL = 30000;
var _cachedFollowUpStatus = {};
var FOLLOWUP_CACHE_TTL = 30000;

// ─── POLLING ───
var _pollInterval = null;
var _currentMessageCount = 0;
var _contactPollInterval = null;
var CONTACT_POLL_MS = 5000;

// ============================================================
// ✅ STRIP HTML TAGS
// ============================================================
function stripHtml(html) {
    if (!html) return '';
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

// ============================================================
// ✅ SKELETON LOADER FUNCTIONS
// ============================================================

function showSkeletonLoader() {
    // Only show skeleton if we have no cached contacts
    var cached = getCachedContacts();
    if (cached && cached.length > 0) {
        // Skip skeleton - show contacts instantly
        renderContacts(cached);
        loadingScreen.classList.add('hidden');
        return;
    }
    
    var skeletonHTML = '';
    for (var i = 0; i < 8; i++) {
        skeletonHTML += `
            <div class="skeleton-item">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-line-title"></div>
                    <div class="skeleton-line skeleton-line-subtitle"></div>
                </div>
            </div>
        `;
    }
    contactList.innerHTML = skeletonHTML;
    contactList.classList.add('active');
    emptyState.classList.remove('active');
    noResults.classList.remove('active');
    loadingScreen.classList.add('hidden');
}

// ─── SKELETON CSS ───
function injectSkeletonStyles() {
    if (document.getElementById('skeleton-styles')) return;
    
    var style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
        .skeleton-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px;
            margin-bottom: 10px;
        }
        .skeleton-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
            flex-shrink: 0;
        }
        .skeleton-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .skeleton-line {
            height: 12px;
            border-radius: 4px;
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
        }
        .skeleton-line-title {
            width: 65%;
            height: 14px;
        }
        .skeleton-line-subtitle {
            width: 40%;
            height: 10px;
        }
        .skeleton-item:nth-child(1) .skeleton-line { animation-delay: 0.05s; }
        .skeleton-item:nth-child(2) .skeleton-line { animation-delay: 0.10s; }
        .skeleton-item:nth-child(3) .skeleton-line { animation-delay: 0.15s; }
        .skeleton-item:nth-child(4) .skeleton-line { animation-delay: 0.20s; }
        .skeleton-item:nth-child(5) .skeleton-line { animation-delay: 0.25s; }
        .skeleton-item:nth-child(6) .skeleton-line { animation-delay: 0.30s; }
        .skeleton-item:nth-child(7) .skeleton-line { animation-delay: 0.35s; }
        .skeleton-item:nth-child(8) .skeleton-line { animation-delay: 0.40s; }
        
        @keyframes skeletonShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        /* ─── SKELETON FOR MESSAGES ─── */
        .skeleton-message {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 8px 16px;
            max-width: 80%;
        }
        .skeleton-message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
            flex-shrink: 0;
        }
        .skeleton-message-content {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
        }
        .skeleton-message .skeleton-line {
            height: 10px;
            border-radius: 4px;
            background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
            background-size: 200% 100%;
            animation: skeletonShimmer 1.5s ease-in-out infinite;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// ✅ NOTIFICATIONS PAGE FUNCTIONS (Only on notifications.html)
// ============================================================

if (isNotificationsPage) {
    console.log('📱 [NOTIFICATIONS] Full page mode loaded');

    // ─── SAFE SANITIZE ───
    function safeSanitize(str) {
        if (!str) return '';
        if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(str);
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── AUTH CHECK ───
    if (!token) {
        window.location.href = 'login.html';
    }

    // ─── TOAST HELPER ───
    function showToast(message, duration) {
        duration = duration || 3000;
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(function() {
                toast.classList.remove('show');
            }, duration);
        }
    }

    // ─── MENU TOGGLE ───
    if (menuBtn) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            menuDropdown.classList.toggle('show');
        });
    }

    document.addEventListener('click', function() {
        if (menuDropdown) menuDropdown.classList.remove('show');
    });

    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            var action = this.dataset.action;
            if (menuDropdown) menuDropdown.classList.remove('show');
            if (action === 'revenue') { fetchRevenueData(); return; }
            if (action === 'followup') {
                if (!currentLeadId) { showToast('Open a chat first.'); return; }
                suggestFollowUp(); return;
            }
            if (action === 'hint') {
                if (!currentLeadId) { showToast('Open a chat first.'); return; }
                generateHint(); return;
            }
            if (action === 'autoreply') {
                if (!currentLeadId) { showToast('Open a chat first.'); return; }
                openAutoReplyModal(); return;
            }
            showToast('Please open a chat to access this feature.');
        });
    });

    if (closeRevenueModal) {
        closeRevenueModal.addEventListener('click', function() { revenueModal.classList.remove('active'); });
    }

    if (revenueModal) {
        revenueModal.addEventListener('click', function(e) {
            if (e.target === this) { revenueModal.classList.remove('active'); }
        });
    }

    // ── FOLLOW-UP DROPDOWN ──
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

    // ─── AUTO FOLLOW-UP MODAL ───
    var autoFollowupOption = document.querySelector('.chat-followup-option[data-action="auto"]');
    if (autoFollowupOption) {
        autoFollowupOption.addEventListener('click', function(e) {
            e.stopPropagation();
            if (followupDropdown) { followupDropdown.classList.remove('show'); }
            loadFollowUpStatusForModal();
            if (autoFollowupModal) { autoFollowupModal.classList.add('active'); }
        });
    }

    function closeAutoFollowupModalFn() {
        if (autoFollowupModal) { autoFollowupModal.classList.remove('active'); }
    }

    if (closeAutoFollowupModal) closeAutoFollowupModal.addEventListener('click', closeAutoFollowupModalFn);
    if (cancelAutoFollowup) cancelAutoFollowup.addEventListener('click', closeAutoFollowupModalFn);
    if (autoFollowupModal) {
        autoFollowupModal.addEventListener('click', function(e) {
            if (e.target === this) { closeAutoFollowupModalFn(); }
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
                _cachedFollowUpStatus[currentLeadId] = { data: data, time: Date.now() };
                afCurrentEnabledState = data.autoFollowUpEnabled || false;
                updateModalStatus(afCurrentEnabledState);
            }
        })
        .catch(function(err) { console.error('Failed to load follow-up status:', err); });
    }

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
            confirmAutoFollowup.textContent = enabled ? '\u274c Disable Auto Follow-up' : '\u2705 Enable Auto Follow-up';
            confirmAutoFollowup.style.background = enabled ? '#ff5555' : 'var(--green)';
            confirmAutoFollowup.style.color = enabled ? '#fff' : '#000';
        }
    }

    // ─── DAY BUTTON CLICK ───
    afDayButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            afDayButtons.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            afSelectedDays = parseInt(this.dataset.days);
            if (afCustomInput) { afCustomInput.value = afSelectedDays; }
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

    // ─── CLOSE CHAT ───
    function closeChatAndGoBack() {
        chatView.classList.remove('active');
        document.body.classList.remove('chat-active');
        document.body.style.overflow = '';
        currentLeadId = null;
        stopPolling();
        loadContacts(true);
    }

    if (chatBack) {
        chatBack.addEventListener('click', function() { closeChatAndGoBack(); });
    }

    // ─── CHAT INPUT ───
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
            chatSendBtn.disabled = !this.value.trim();
        });

        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!chatSendBtn.disabled) { sendMessage(); }
            }
        });
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
    }

    // ─── RENAME ───
    if (chatRenameBtn) {
        chatRenameBtn.addEventListener('click', function() {
            if (!currentLeadId) { showToast('No lead selected.'); return; }
            var newName = prompt('Enter new name for this contact:', currentLeadName || '');
            if (newName === null || newName.trim() === '') return;
            renameLead(currentLeadId, newName.trim());
        });
    }

    function renameLead(leadId, newName) {
        fetch(BACKEND + '/api/leads/' + encodeURIComponent(leadId) + '/rename', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
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
                _cachedContacts = null;
                _cachedContactsTime = 0;
                loadContacts(true);
            } else {
                showToast('Failed to rename: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(function(err) {
            console.error('Rename error:', err);
            showToast('Connection error while renaming.');
        });
    }

    // ─── SEND MESSAGE ───
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
            leads: [{
                name: currentLeadName || 'Unknown',
                email: currentLeadEmail || '',
                company: '',
                messages: [{ subject: 'Re: Conversation', body: originalText }]
            }],
            leadId: currentLeadId,
            allowNewLead: false
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
                setTimeout(function() {
                    _cachedContacts = null;
                    _cachedContactsTime = 0;
                    loadContacts(true);
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

    // ─── APPEND MESSAGE - WITH HTML STRIPPING ───
    function appendMessage(from, content, date) {
        var div = document.createElement('div');
        var cssClass = from === 'lead' ? 'from-lead' : 'from-ai';
        var senderLabel = from === 'lead' ? 'You' : 'Customer';
        var alignItems = from === 'lead' ? 'flex-end' : 'flex-start';
        var time = date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        div.className = 'msg-group ' + cssClass;
        div.style.alignSelf = alignItems;
        
        var cleanContent = stripHtml(content);
        
        div.innerHTML = '<div class="msg-sender">' + senderLabel + '</div><div class="message-bubble">' + safeSanitize(cleanContent) + '</div><div class="message-time">' + time + '</div>';

        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ─── LOAD CHAT HISTORY ───
    function loadChatHistory(leadId) {
        var cached = _cachedChatHistory[leadId];
        if (cached && (Date.now() - cached.time) < CHAT_HISTORY_CACHE_TTL) {
            renderChatMessages(cached.data);
            return Promise.resolve();
        }

        messagesContainer.innerHTML = `
            <div class="skeleton-message">
                <div class="skeleton-message-avatar"></div>
                <div class="skeleton-message-content">
                    <div class="skeleton-line skeleton-line-title" style="width:60%;"></div>
                    <div class="skeleton-line skeleton-line-subtitle" style="width:80%;"></div>
                    <div class="skeleton-line skeleton-line-subtitle" style="width:50%;"></div>
                </div>
            </div>
            <div class="skeleton-message" style="align-self:flex-end;">
                <div class="skeleton-message-content" style="align-items:flex-end;">
                    <div class="skeleton-line skeleton-line-title" style="width:40%;"></div>
                    <div class="skeleton-line skeleton-line-subtitle" style="width:60%;"></div>
                </div>
                <div class="skeleton-message-avatar"></div>
            </div>
            <div class="skeleton-message">
                <div class="skeleton-message-avatar"></div>
                <div class="skeleton-message-content">
                    <div class="skeleton-line skeleton-line-title" style="width:50%;"></div>
                    <div class="skeleton-line skeleton-line-subtitle" style="width:70%;"></div>
                    <div class="skeleton-line skeleton-line-subtitle" style="width:30%;"></div>
                </div>
            </div>
        `;

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
            if (data.success === false) {
                throw new Error(data.message || 'Failed to load conversation');
            }
            var messages = data.messages || [];
            _cachedChatHistory[leadId] = { data: messages, time: Date.now() };
            _currentMessageCount = messages.length;
            renderChatMessages(messages);
        })
        .catch(function(err) {
            console.error('Load chat history error:', err);
            messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#505050; font-size:12px;">Failed to load messages. Please try again.</div>';
        });
    }

    function renderChatMessages(messages) {
        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><h3>No messages yet</h3><p>Send a message to start the conversation.</p></div>';
            _currentMessageCount = 0;
            return;
        }
        for (var i = 0; i < messages.length; i++) {
            var cleanContent = stripHtml(messages[i].content || '');
            appendMessage(messages[i].from, cleanContent, messages[i].date);
        }
        _currentMessageCount = messages.length;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ─── CLEAR UNREAD BADGE ───
    function clearUnreadBadge(leadId) {
        if (!leadId) return;
        console.log('🔔 [CLEAR] Clearing unread badge for:', leadId);

        for (var i = 0; i < allContacts.length; i++) {
            if (allContacts[i].id === leadId) {
                allContacts[i].unreadCount = 0;
                allContacts[i].unread = false;
                break;
            }
        }

        if (_cachedContacts) {
            for (var j = 0; j < _cachedContacts.length; j++) {
                if (_cachedContacts[j].id === leadId) {
                    _cachedContacts[j].unreadCount = 0;
                    _cachedContacts[j].unread = false;
                    break;
                }
            }
        }

        renderContacts(allContacts);
        fetchGlobalUnreadCount();
    }

    // ─── OPEN CHAT ───
    function openChat(leadId, name, email) {
        if (currentLeadId === leadId && chatView.classList.contains('active')) {
            Promise.all([
                loadChatHistory(leadId),
                loadFollowUpStatus(),
                loadAutoReplyStatus()
            ]).catch(function() {});
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
        if (menuDropdown) menuDropdown.classList.remove('show');
        if (followupDropdown) followupDropdown.classList.remove('show');

        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatSendBtn.disabled = true;

        history.pushState({ chatOpen: true }, '', window.location.href);

        clearUnreadBadge(leadId);

        Promise.all([
            loadFollowUpStatus(),
            loadChatHistory(leadId),
            loadAutoReplyStatus()
        ]).then(function() {
            clearUnreadBadge(leadId);
            startPolling(leadId);
        }).catch(function() {
            clearUnreadBadge(leadId);
            startPolling(leadId);
        });
    }

    // ─── POLLING ───
    function startPolling(leadId) {
        stopPolling();
        _pollInterval = setInterval(function() {
            if (!currentLeadId || currentLeadId !== leadId || !chatView.classList.contains('active')) {
                stopPolling();
                return;
            }
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
                    _cachedChatHistory[leadId] = { data: newMessages, time: Date.now() };
                    for (var i = _currentMessageCount; i < newMessages.length; i++) {
                        var cleanContent = stripHtml(newMessages[i].content || '');
                        appendMessage(newMessages[i].from, cleanContent, newMessages[i].date);
                    }
                    _currentMessageCount = newMessages.length;
                    var lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.from !== 'lead') {
                        showToast('\ud83d\udcac New reply from ' + (currentLeadName || 'customer') + '!');
                    }
                    _cachedContacts = null;
                    _cachedContactsTime = 0;
                    loadContacts(true);
                    fetchGlobalUnreadCount();
                }
            })
            .catch(function() {});
        }, 3000);
    }

    function stopPolling() {
        if (_pollInterval) {
            clearInterval(_pollInterval);
            _pollInterval = null;
        }
    }

    // ─── CONTACT POLLING ───
    function startContactPolling() {
        if (_contactPollInterval) clearInterval(_contactPollInterval);
        _contactPollInterval = setInterval(function() {
            if (!token) return;
            fetch(BACKEND + '/api/conversations', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(function(res) { if (!res.ok) return null; return res.json(); })
            .then(function(data) {
                if (!data) return;
                
                var contacts = data;
                if (data.data && Array.isArray(data.data)) {
                    contacts = data.data;
                } else if (Array.isArray(data)) {
                    contacts = data;
                }
                
                if (!contacts || !Array.isArray(contacts)) {
                    contacts = [];
                }
                
                allContacts = contacts;
                _cachedContacts = contacts;
                _cachedContactsTime = Date.now();
                renderContacts(allContacts);
                
                // Update badge
                var totalUnread = 0;
                for (var j = 0; j < contacts.length; j++) {
                    totalUnread += (contacts[j].unreadCount || 0);
                }
                if (totalUnread > 0) {
                    setStoredBadge(totalUnread);
                    var seen = getLastSeenCount();
                    var displayCount = totalUnread > seen ? totalUnread - seen : 0;
                    updateAllBadges(displayCount);
                }
            })
            .catch(function() {});
        }, CONTACT_POLL_MS);
    }

    function stopContactPolling() {
        if (_contactPollInterval) {
            clearInterval(_contactPollInterval);
            _contactPollInterval = null;
        }
    }

    // ─── FOLLOW-UP FUNCTIONS ───
    function loadFollowUpStatus() {
        if (!currentLeadId) return Promise.resolve();
        var cached = _cachedFollowUpStatus[currentLeadId];
        if (cached && (Date.now() - cached.time) < FOLLOWUP_CACHE_TTL) {
            var data = cached.data;
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
            _cachedFollowUpStatus[currentLeadId] = { data: data, time: Date.now() };
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
        .catch(function(err) { console.error('Failed to load follow-up status:', err); });
    }

    function suggestFollowUp() {
        if (!currentLeadId) { showToast('Open a chat first.'); return; }
        showToast('Generating follow-up suggestion...');
        fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/suggest-follow-up', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
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
        if (!currentLeadId) { showToast('Open a chat first.'); return; }
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
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messages.slice(-5) })
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
        if (!currentLeadId) { showToast('Open a chat first.'); return; }
        var delayDays = days || afSelectedDays || 3;
        var newStatus = typeof forceState !== 'undefined' ? forceState : !afCurrentEnabledState;
        afCurrentEnabledState = newStatus;
        updateModalStatus(afCurrentEnabledState);

        fetch(BACKEND + '/api/leads/' + encodeURIComponent(currentLeadId) + '/auto-follow-up', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
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
                delete _cachedFollowUpStatus[currentLeadId];
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

    // ─── REVENUE ───
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

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderRevenueData(data) {
        var tier = data.tier || 'free';
        tierBadge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
        var categories = data.categories || {};
        var html = '';
        html += '<div style="margin-bottom:12px;"><strong style="color:#f5f5f5; font-size:13px;">\ud83d\udcca Categories</strong></div>';
        var hasCategories = false;
        var catKeys = Object.keys(categories);
        for (var ci = 0; ci < catKeys.length; ci++) {
            var key = catKeys[ci];
            var leads = categories[key];
            var config = CATEGORY_CONFIG[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), icon: '\u2022', color: '#707070' };
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
                    html += '<div class="lead-item" data-id="' + leadId + '" onclick="openChatFromRevenue(\'' + leadId + '\', \'' + safeSanitize(lname).replace(/'/g, "\\'") + '\', \'' + safeSanitize(lead.email || '').replace(/'/g, "\\'") + '\')"><span class="lead-name">' + safeSanitize(lname) + '</span>' + (company ? '<span class="lead-company">\u00b7 ' + safeSanitize(company) + '</span>' : '') + '</div>';
                }
                if (remaining > 0) {
                    html += '<div class="lead-item" style="color:#505050; font-style:italic; border-left-color:transparent; cursor:default;">+ ' + remaining + ' more</div>';
                }
            }
            html += '</div>';
        }
        if (!hasCategories) { html += '<div class="no-data">No leads found.</div>'; }
        var advice = data.advice || {};
        var adviceKeys = Object.keys(advice);
        if (adviceKeys.length > 0) {
            html += '<div class="section-divider"></div>';
            html += '<div class="advice-section">';
            html += '<div class="advice-title">\ud83d\udca1 Strategic Advice</div>';
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
                html += '<div class="action-item"><span style="color:#505050; font-size:10px;">' + (aci + 1) + '.</span><span class="action-lead">' + safeSanitize(action.leadName || 'Lead') + '</span><span class="action-text">\u2014 ' + safeSanitize(action.action || 'Follow up') + '</span></div>';
            }
            if (actions.length > 10) {
                html += '<div class="no-data" style="padding-top:4px;">+ ' + (actions.length - 10) + ' more actions</div>';
            }
            html += '</div>';
        }
        if (tierBadge.textContent === 'Free') {
            html += '<div class="section-divider"></div>';
            html += '<div style="background: rgba(255,187,68,0.06); border: 1px solid rgba(255,187,68,0.15); border-radius: 8px; padding: 12px 16px; margin-top: 4px;"><p style="color:#ffbb44; font-size:12px; margin:0;">Upgrade to <strong>Go</strong> for AI\u2011powered advice, or <strong>Pro</strong> for personalised actions on your top leads.</p></div>';
        }
        revenueBody.innerHTML = html;
    }

    function openChatFromRevenue(leadId, name, email) {
        revenueModal.classList.remove('active');
        openChat(leadId, name, email);
    }

    // ============================================================
    // ✅ LOAD CONTACTS - INSTANT FROM CACHE
    // ============================================================
    function loadContacts(forceRefresh) {
        var now_ts = Date.now();
        
        // ✅ If cache exists and not forced, use it
        if (!forceRefresh && _cachedContacts && (now_ts - _cachedContactsTime) < CONTACTS_CACHE_TTL) {
            allContacts = _cachedContacts;
            renderContacts(allContacts);
            return Promise.resolve();
        }
        
        // ✅ Try to show cached contacts immediately
        var cached = getCachedContacts();
        if (cached && cached.length > 0) {
            allContacts = cached;
            _cachedContacts = cached;
            _cachedContactsTime = Date.now();
            renderContacts(allContacts);
            console.log('⚡ [INSTANT] Showed contacts from cache');
        } else {
            // Show skeleton only if no cache
            showSkeletonLoader();
        }
        
        // ✅ Fetch fresh in background
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
            
            var contacts = data;
            if (data.data && Array.isArray(data.data)) {
                contacts = data.data;
            } else if (Array.isArray(data)) {
                contacts = data;
            }
            
            if (!contacts || !Array.isArray(contacts)) {
                contacts = [];
            }
            
            allContacts = contacts;
            _cachedContacts = contacts;
            _cachedContactsTime = Date.now();
            setCachedContacts(contacts);
            renderContacts(allContacts);
            console.log('✅ [loadContacts] Loaded', contacts.length, 'contacts');
            
            // Update badge
            var totalUnread = 0;
            for (var j = 0; j < contacts.length; j++) {
                totalUnread += (contacts[j].unreadCount || 0);
            }
            if (totalUnread > 0) {
                setStoredBadge(totalUnread);
                var seen = getLastSeenCount();
                var displayCount = totalUnread > seen ? totalUnread - seen : 0;
                updateAllBadges(displayCount);
            }
        })
        .catch(function(err) {
            console.error('Failed to load contacts:', err);
            if (!getCachedContacts()) {
                showEmptyState();
            }
        });
    }

    // ─── RENDER CONTACTS ───
    function renderContacts(contacts) {
        if (!contacts || contacts.length === 0) {
            if (searchInput && searchInput.value.trim() !== '') {
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

    if (searchInput) {
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
    }

    function showEmptyState() {
        contactList.classList.remove('active');
        emptyState.classList.add('active');
        noResults.classList.remove('active');
    }

    var hintOption = document.querySelector('.chat-followup-option[data-action="hint"]');
    if (hintOption) {
        hintOption.addEventListener('click', function() {
            followupDropdown.classList.remove('show');
            generateHint();
        });
    }

    // ─── AUTO-REPLY ───
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

    if (chatAutoReplyBtn) {
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
    }

    if (closeAutoReplyModal) {
        closeAutoReplyModal.addEventListener('click', function() { autoReplyModalOverlay.classList.remove('show'); });
    }
    if (autoReplyModalOverlay) {
        autoReplyModalOverlay.addEventListener('click', function(e) {
            if (e.target === autoReplyModalOverlay) { autoReplyModalOverlay.classList.remove('show'); }
        });
    }

    if (saveAutoReplyBtn) {
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
    }

    function openAutoReplyModal() {
        if (!currentLeadId) { showToast('Open a chat first.'); return; }
        if (isAutoReplyActive) {
            chatAutoReplyBtn.click();
        } else {
            autoReplyModalOverlay.classList.add('show');
            autoReplyInstructions.focus();
        }
    }

    // ─── PHONE BACK BUTTON ───
    window.addEventListener('popstate', function(e) {
        if (chatView && chatView.classList.contains('active')) {
            closeChatAndGoBack();
            history.pushState(null, '', window.location.href);
        }
    });

    // ─── START FULL PAGE ───
    injectSkeletonStyles();
    
    // ✅ SHOW CONTACTS INSTANTLY FROM CACHE
    var cached = getCachedContacts();
    if (cached && cached.length > 0) {
        allContacts = cached;
        _cachedContacts = cached;
        _cachedContactsTime = Date.now();
        renderContacts(allContacts);
        console.log('⚡ [FULL PAGE] Instantly rendered', cached.length, 'contacts from cache');
    } else {
        showSkeletonLoader();
    }
    
    // ✅ Load fresh in background
    loadContacts();
    
    // ✅ Start polling and SSE
    startContactPolling();
    connectBackgroundSSE();
    history.pushState(null, '', window.location.href);

    console.log('✅ [NOTIFICATIONS] Full page loaded with instant display');
}

// ════════════════════════════════════════════
// ✅ RUN BACKGROUND ENGINE ON ALL PAGES
// ════════════════════════════════════════════

// ✅ ALWAYS run background engine
document.addEventListener('DOMContentLoaded', function() {
    // Initialize background engine on ALL pages
    initBackgroundEngine();
    
    // Also init badge if notification button exists
    var notifBtn = document.getElementById('navNotifBtn');
    if (notifBtn) {
        initBadge();
        
        // ✅ When user clicks notification button, show contacts instantly
        notifBtn.addEventListener('click', function(e) {
            // If we're on the notifications page, let it handle itself
            if (isNotificationsPage) return;
            
            // Otherwise, preload contacts before navigation
            var cached = getCachedContacts();
            if (cached && cached.length > 0) {
                // Store in memory for the next page
                window._cachedContactsData = cached;
                console.log('⚡ [NAV] Preloaded', cached.length, 'contacts for notifications page');
            }
        });
    }
});

// ─── CLEAN UP ON PAGE UNLOAD ───
window.addEventListener('beforeunload', function() {
    cleanupBackground();
    stopPolling();
    stopContactPolling();
});

console.log('✅ [NOTIFICATIONS] Instant loading system initialized');

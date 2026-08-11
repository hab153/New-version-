// ============================================================
// badge.js
// UNIVERSAL NOTIFICATION BADGE - Works on ALL pages
// ============================================================

var BADGE_BACKEND = 'https://skylineapp-backend-file.onrender.com';
var BADGE_KEY = 'unread_count';
var BADGE_TIME_KEY = 'unread_last_check';
var CACHE_DURATION = 60000; // 1 minute
var POLL_INTERVAL = 5000; // 5 seconds

// ─── Get token ───
function getToken() {
    return localStorage.getItem('token');
}

// ─── Get stored count ───
function getStoredCount() {
    var count = localStorage.getItem(BADGE_KEY);
    var time = localStorage.getItem(BADGE_TIME_KEY);
    
    if (count === null || time === null) return null;
    
    // Check if cache is still valid
    var age = Date.now() - parseInt(time);
    if (age > CACHE_DURATION) {
        localStorage.removeItem(BADGE_KEY);
        localStorage.removeItem(BADGE_TIME_KEY);
        return null;
    }
    
    return parseInt(count) || 0;
}

// ─── Save count ───
function saveCount(count) {
    localStorage.setItem(BADGE_KEY, String(count));
    localStorage.setItem(BADGE_TIME_KEY, String(Date.now()));
}

// ─── Update badge UI (RED DOT) ───
function updateBadge(count) {
    var badges = document.querySelectorAll('.nav-badge');
    if (badges.length === 0) return;

    var hasUnread = count > 0;

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

// ─── Fetch from backend ───
function fetchBadge() {
    var token = getToken();
    if (!token) {
        updateBadge(0);
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
                updateBadge(0);
                return;
            }
            var stored = getStoredCount();
            if (stored !== null) updateBadge(stored);
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var count = data.count || 0;
        saveCount(count);
        updateBadge(count);
        console.log('🔔 [BADGE] Unread:', count, count > 0 ? '🔴 RED DOT' : '⚪ No dot');
    })
    .catch(function() {
        var stored = getStoredCount();
        if (stored !== null) updateBadge(stored);
    });
}

// ─── SSE: Server-Sent Events ───
var sseConnection = null;
var sseReconnectAttempts = 0;

function connectSSE() {
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
            sseReconnectAttempts = 0;
        });

        sseConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    console.log('📨 [BADGE SSE] Event received:', data.type);
                    // ✅ INSTANT UPDATE
                    fetchBadge();
                }
            } catch (err) { /* ignore */ }
        });

        sseConnection.addEventListener('error', function() {
            console.warn('⚠️ [BADGE SSE] Connection error');
            if (sseConnection) {
                sseConnection.close();
                sseConnection = null;
            }
            
            sseReconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, sseReconnectAttempts), 30000);
            if (sseReconnectAttempts <= 5) {
                console.log('🔄 [BADGE SSE] Reconnecting in ' + delay + 'ms...');
                setTimeout(connectSSE, delay);
            }
        });

    } catch (err) {
        console.error('[BADGE SSE] Error:', err.message);
    }
}

// ─── Storage Listener (sync across tabs) ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === BADGE_KEY || e.key === BADGE_TIME_KEY) {
            var stored = getStoredCount();
            if (stored !== null) {
                updateBadge(stored);
                console.log('🔄 [BADGE] Synced from another tab:', stored);
            }
        }
    });
}

// ─── Polling fallback (every 5 seconds) ───
var pollInterval = null;

function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    pollInterval = setInterval(fetchBadge, POLL_INTERVAL);
    console.log('⏰ [BADGE] Polling started (every ' + POLL_INTERVAL/1000 + ' seconds)');
}

// ─── Clear badge (when user opens notifications) ───
function clearBadge() {
    saveCount(0);
    updateBadge(0);
    console.log('🧹 [BADGE] Badge cleared');
}

// ─── Cleanup ───
function cleanup() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
}

// ─── INIT ───
function initBadge() {
    // Show stored count immediately
    var stored = getStoredCount();
    if (stored !== null) {
        updateBadge(stored);
        console.log('📦 [BADGE] Loaded from cache:', stored);
    }

    // Fetch fresh
    fetchBadge();

    // Start polling (every 5 seconds)
    startPolling();

    // Connect SSE (instant updates)
    connectSSE();

    // Storage listener (cross-tab sync)
    setupStorageListener();

    // Clear badge when notification button is clicked
    var notifBtn = document.getElementById('navNotifBtn');
    if (notifBtn) {
        notifBtn.addEventListener('click', function() {
            var href = this.getAttribute('href');
            if (href && href.includes('notifications.html')) {
                clearBadge();
            }
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
}

// ─── Run on page load ───
document.addEventListener('DOMContentLoaded', initBadge);

console.log('✅ [BADGE] Universal badge system loaded');

// ============================================================
// notif-badge.js
// SHARED NOTIFICATION BADGE SYSTEM
// Single source of truth = BACKEND
// Works across ALL 4 pages (page, dashboard, history, notifications)
// Skyline AA-1
// ============================================================

var NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';

// ──────────────────────────────────────────────────────────────
//  CONFIGURATION
// ──────────────────────────────────────────────────────────────

var BADGE_REFRESH_INTERVAL = 15000; // 15 seconds fallback
var SSE_RECONNECT_DELAY = 5000; // 5 seconds

// ──────────────────────────────────────────────────────────────
//  TOKEN HELPER
// ──────────────────────────────────────────────────────────────

function getNotifToken() {
    return localStorage.getItem('token');
}

// ──────────────────────────────────────────────────────────────
//  BADGE UI UPDATE
// ──────────────────────────────────────────────────────────────

function updateAllBadges(count) {
    var badges = document.querySelectorAll('.nav-badge');
    if (badges.length === 0) {
        // No badges on this page - that's fine
        return;
    }

    badges.forEach(function(badge) {
        var parent = badge.closest('.nav-item');
        
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
            badge.style.background = '#ff5555';
            badge.style.color = '#ffffff';
            badge.style.borderRadius = '50%';
            badge.style.minWidth = '18px';
            badge.style.height = '18px';
            badge.style.fontSize = '10px';
            badge.style.fontWeight = '600';
            badge.style.alignItems = 'center';
            badge.style.justifyContent = 'center';
            badge.style.padding = '0 4px';
            if (parent) parent.classList.add('has-notifs');
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
            if (parent) parent.classList.remove('has-notifs');
        }
    });
}

// ──────────────────────────────────────────────────────────────
//  FETCH UNREAD COUNT FROM BACKEND
// ──────────────────────────────────────────────────────────────

function fetchUnreadCount() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }

    fetch(NOTIF_BACKEND + '/api/unread/status', {
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
            updateAllBadges(0);
            return;
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var count = data.count || 0;
        updateAllBadges(count);
        console.log('🔔 [BADGE] Unread count from DB:', count);
    })
    .catch(function(err) {
        console.error('[BADGE] Error fetching:', err);
        updateAllBadges(0);
    });
}

// ──────────────────────────────────────────────────────────────
//  SSE: REAL-TIME UPDATES
// ──────────────────────────────────────────────────────────────

var sseConnection = null;
var sseReconnectAttempts = 0;
var MAX_SSE_RECONNECT_ATTEMPTS = 10;

function connectBadgeSSE() {
    var token = getNotifToken();
    if (!token) return;

    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }

    try {
        sseConnection = new EventSource(NOTIF_BACKEND + '/api/events/stream?token=' + encodeURIComponent(token));

        sseConnection.addEventListener('open', function() {
            console.log('✅ [BADGE SSE] Connection established');
            sseReconnectAttempts = 0;
        });

        sseConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                
                // ✅ Handle unread_update events (from scheduler every 4 seconds)
                if (data.type === 'unread_update') {
                    var count = data.count || 0;
                    updateAllBadges(count);
                    console.log('🔔 [BADGE] SSE update:', count);
                    return;
                }
                
                // ✅ Handle other events
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    fetchUnreadCount();
                }
                
            } catch (err) {
                // Ignore parse errors
            }
        });

        sseConnection.addEventListener('error', function() {
            console.warn('⚠️ [BADGE SSE] Connection error');
            if (sseConnection) {
                sseConnection.close();
                sseConnection = null;
            }

            sseReconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, sseReconnectAttempts), 30000);

            if (sseReconnectAttempts <= MAX_SSE_RECONNECT_ATTEMPTS) {
                console.log('🔄 [BADGE SSE] Reconnecting in ' + delay + 'ms... (attempt ' + sseReconnectAttempts + '/' + MAX_SSE_RECONNECT_ATTEMPTS + ')');
                setTimeout(connectBadgeSSE, delay);
            } else {
                console.error('❌ [BADGE SSE] Max reconnect attempts reached. Using polling fallback.');
            }
        });

    } catch (err) {
        console.error('[BADGE SSE] Failed to connect:', err.message);
    }
}

// ──────────────────────────────────────────────────────────────
//  INIT BADGE
// ──────────────────────────────────────────────────────────────

var badgeInterval = null;

function initNotifBadge() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }

    console.log('🔔 [BADGE] Initializing shared badge system...');

    // ✅ Step 1: Fetch immediately
    fetchUnreadCount();

    // ✅ Step 2: Connect to SSE for real-time updates
    connectBadgeSSE();

    // ✅ Step 3: Fallback polling (every 15 seconds)
    if (badgeInterval) {
        clearInterval(badgeInterval);
    }
    badgeInterval = setInterval(fetchUnreadCount, BADGE_REFRESH_INTERVAL);

    console.log('✅ [BADGE] Shared badge system initialized');
}

// ──────────────────────────────────────────────────────────────
//  CLEAN UP
// ──────────────────────────────────────────────────────────────

function cleanupNotifBadge() {
    if (badgeInterval) {
        clearInterval(badgeInterval);
        badgeInterval = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
    console.log('🔔 [BADGE] Cleaned up');
}

// ──────────────────────────────────────────────────────────────
//  EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ──────────────────────────────────────────────────────────────

window.NotifBadge = {
    init: initNotifBadge,
    fetch: fetchUnreadCount,
    update: updateAllBadges,
    cleanup: cleanupNotifBadge
};

// ──────────────────────────────────────────────────────────────
//  AUTO-INIT ON PAGE LOAD
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    // Check if this page has a notification button
    var hasBadge = document.querySelector('.nav-badge');
    if (hasBadge) {
        initNotifBadge();
    }
});

// ──────────────────────────────────────────────────────────────
//  CLEAN UP ON PAGE UNLOAD
// ──────────────────────────────────────────────────────────────

window.addEventListener('beforeunload', function() {
    cleanupNotifBadge();
});

// ============================================================
// ✅ FIX: RE-INIT BADGE ON PAGE NAVIGATION
// ============================================================

// ─── On visibility change (user comes back to tab) ───
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔔 [BADGE] Tab visible, refreshing...');
        fetchUnreadCount();
    }
});

// ─── On page show (user navigates back/forward) ───
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('🔔 [BADGE] Page restored from bfcache, refreshing...');
        fetchUnreadCount();
    }
});

// ─── On hash change ───
window.addEventListener('hashchange', function() {
    console.log('🔔 [BADGE] Hash changed, refreshing...');
    fetchUnreadCount();
});

// ─── On popstate (browser back/forward) ───
window.addEventListener('popstate', function() {
    console.log('🔔 [BADGE] Popstate, refreshing...');
    fetchUnreadCount();
});

console.log('✅ [BADGE] notif-badge.js loaded with navigation fix');

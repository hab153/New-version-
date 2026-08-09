// ============================================================
// notif-badge.js
// SHARED Notification Badge - Works across ALL pages
// WITH SSE REAL-TIME UPDATES
// Skyline AA-1
// ============================================================

var NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';
var badgeSSEConnection = null;
var badgeSSEReconnectAttempts = 0;
var MAX_BADGE_SSE_RECONNECT_ATTEMPTS = 5;

// ─── Get token ───
function getNotifToken() {
    return localStorage.getItem('token');
}

// ─── Get stored badge count from localStorage ───
function getStoredBadge() {
    var count = localStorage.getItem('globalUnreadCount');
    if (count === null || count === undefined) return 0;
    return parseInt(count) || 0;
}

// ─── Set stored badge count in localStorage ───
function setStoredBadge(count) {
    localStorage.setItem('globalUnreadCount', String(count || 0));
}

// ─── Get last seen count ───
function getLastSeenCount() {
    var count = localStorage.getItem('lastSeenNotifCount');
    return count ? parseInt(count) : 0;
}

// ─── Set last seen count ───
function setLastSeenCount(count) {
    localStorage.setItem('lastSeenNotifCount', String(count || 0));
}

// ─── Update ALL badges on the current page ───
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

// ─── Fetch unread count from server ───
async function fetchGlobalUnreadCount() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return 0;
    }

    try {
        var res = await fetch(NOTIF_BACKEND + '/api/notifications/count', {
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                updateAllBadges(0);
                return 0;
            }
            var stored = getStoredBadge();
            updateAllBadges(stored);
            return stored;
        }

        var data = await res.json();
        var count = data.count || 0;
        setStoredBadge(count);
        var seen = getLastSeenCount();
        var displayCount = count > seen ? count - seen : 0;
        updateAllBadges(displayCount);
        return displayCount;

    } catch (error) {
        console.error('[NOTIF BADGE] Fetch error:', error);
        var stored = getStoredBadge();
        updateAllBadges(stored);
        return stored;
    }
}

// ─── Mark notifications as read ───
async function markNotificationsRead() {
    var token = getNotifToken();
    if (!token) return false;

    try {
        var currentCount = getStoredBadge();
        setLastSeenCount(currentCount);
        setStoredBadge(0);
        updateAllBadges(0);

        try {
            var res = await fetch(NOTIF_BACKEND + '/api/notifications/mark-read', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                console.log('[NOTIF BADGE] Marked all as read on server');
            }
        } catch (serverErr) {
            console.log('[NOTIF BADGE] Server mark-read not available');
        }

        return true;
    } catch (error) {
        console.error('[NOTIF BADGE] Error marking read:', error);
        return false;
    }
}

// ─── SSE: Connect for real-time badge updates ───
function connectBadgeSSE() {
    var token = getNotifToken();
    if (!token) return;

    if (badgeSSEConnection) {
        badgeSSEConnection.close();
        badgeSSEConnection = null;
    }

    try {
        badgeSSEConnection = new EventSource(NOTIF_BACKEND + '/api/events/stream?token=' + encodeURIComponent(token));

        badgeSSEConnection.addEventListener('open', function() {
            console.log('✅ [BADGE SSE] Connection established');
            badgeSSEReconnectAttempts = 0;
        });

        badgeSSEConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    // ✅ Update badge when any event happens
                    fetchGlobalUnreadCount();
                }
            } catch (err) {
                // Ignore parse errors
            }
        });

        badgeSSEConnection.addEventListener('error', function() {
            console.warn('⚠️ [BADGE SSE] Connection error');
            if (badgeSSEConnection) {
                badgeSSEConnection.close();
                badgeSSEConnection = null;
            }

            badgeSSEReconnectAttempts++;
            var delay = Math.min(1000 * Math.pow(2, badgeSSEReconnectAttempts), 30000);

            if (badgeSSEReconnectAttempts <= MAX_BADGE_SSE_RECONNECT_ATTEMPTS) {
                console.log('🔄 [BADGE SSE] Reconnecting in ' + delay + 'ms...');
                setTimeout(connectBadgeSSE, delay);
            }
        });

    } catch (err) {
        console.error('[BADGE SSE] Failed to connect:', err.message);
    }
}

// ─── Initialize notification badge ───
function initNotifBadge() {
    var token = getNotifToken();
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

    // ✅ Connect to SSE for real-time updates
    connectBadgeSSE();

    // Periodic refresh fallback (every 15 seconds)
    if (window._notifInterval) {
        clearInterval(window._notifInterval);
    }
    window._notifInterval = setInterval(fetchGlobalUnreadCount, 15000);
}

// ─── Notification button click handler ───
function setupNotifButton() {
    var notifBtn = document.getElementById('navNotifBtn');
    if (!notifBtn) return;

    notifBtn.addEventListener('click', function(e) {
        var href = this.getAttribute('href');
        if (href && href.includes('notifications.html')) {
            var currentCount = getStoredBadge();
            setLastSeenCount(currentCount);
            updateAllBadges(0);
            setStoredBadge(0);
        }
    });
}

// ─── Listen for storage changes from other tabs/pages ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === 'globalUnreadCount' || e.key === 'lastSeenNotifCount') {
            var stored = getStoredBadge();
            var seen = getLastSeenCount();
            var displayCount = stored > seen ? stored - seen : 0;
            updateAllBadges(displayCount);
        }
    });
}

// ─── Run on page load ───
document.addEventListener('DOMContentLoaded', function() {
    initNotifBadge();
    setupNotifButton();
    setupStorageListener();
});

// ─── Clean up on page unload ───
window.addEventListener('beforeunload', function() {
    if (window._notifInterval) {
        clearInterval(window._notifInterval);
        window._notifInterval = null;
    }
    if (badgeSSEConnection) {
        badgeSSEConnection.close();
        badgeSSEConnection = null;
    }
});

console.log('✅ [NOTIF BADGE] Shared badge system loaded with SSE');

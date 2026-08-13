// ============================================================
// notif-badge.js
// SHARED Notification Badge - Works across ALL pages
// Uses /api/unread/status as source of truth
// Skyline AA-1
// ============================================================

var NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';

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

// ─── Update ALL badges on the current page ───
function updateAllBadges(count) {
    var badges = document.querySelectorAll('.nav-badge');
    var navItems = document.querySelectorAll('.nav-item');
    
    if (badges.length === 0) return;
    
    badges.forEach(function(badge) {
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
        // ✅ Use the unread status endpoint
        var res = await fetch(NOTIF_BACKEND + '/api/unread/status', {
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
        
        // ✅ Store in localStorage for other pages
        setStoredBadge(count);
        
        // ✅ Update ALL badges on current page
        updateAllBadges(count);
        
        return count;

    } catch (error) {
        console.error('[NOTIF BADGE] Fetch error:', error);
        var stored = getStoredBadge();
        updateAllBadges(stored);
        return stored;
    }
}

// ─── Clear unread messages ───
async function clearUnreadMessages() {
    var token = getNotifToken();
    if (!token) return false;

    try {
        var res = await fetch(NOTIF_BACKEND + '/api/unread/clear', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            setStoredBadge(0);
            updateAllBadges(0);
            console.log('[NOTIF BADGE] Cleared all unread messages');
            return true;
        }
        return false;

    } catch (error) {
        console.error('[NOTIF BADGE] Error clearing unread:', error);
        return false;
    }
}

// ─── SSE: Connect for real-time badge updates ───
var badgeSSEConnection = null;
var badgeSSEReconnectAttempts = 0;
var MAX_BADGE_SSE_RECONNECT_ATTEMPTS = 5;

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

    // ✅ First: Show stored count immediately (no delay)
    var stored = getStoredBadge();
    updateAllBadges(stored);

    // ✅ Then: Fetch fresh count from server
    fetchGlobalUnreadCount();

    // ✅ Connect to SSE for real-time updates
    connectBadgeSSE();

    // ✅ Set up periodic refresh (every 15 seconds) - FALLBACK
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
        
        // If clicking notification button, clear unread
        if (href && href.includes('notifications.html')) {
            // ✅ Clear unread immediately for better UX
            clearUnreadMessages();
        }
    });
}

// ─── Listen for storage changes from other tabs/pages ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === 'globalUnreadCount') {
            var count = parseInt(e.newValue) || 0;
            updateAllBadges(count);
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

console.log('✅ [NOTIF BADGE] Shared badge system loaded with /api/unread');

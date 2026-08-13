// ============================================================
// notif-badge.js
// SINGLE SOURCE OF TRUTH = BACKEND ONLY
// NO localStorage - always fetches from database
// Works across ALL 4 pages
// Skyline AA-1
// ============================================================

var NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';

// ─── Get token ───
function getNotifToken() {
    return localStorage.getItem('token');
}

// ─── UPDATE BADGE UI ───
function updateAllBadges(count) {
    var badges = document.querySelectorAll('.nav-badge');
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

// ─── FETCH REAL UNREAD COUNT FROM BACKEND ───
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
                window.location.href = 'login.html';
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

// ─── SSE: REAL-TIME UPDATES ───
var sseConnection = null;
var sseReconnectAttempts = 0;
var MAX_SSE_RECONNECT_ATTEMPTS = 5;

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
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    // ✅ Fetch fresh count from database
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
                console.log('🔄 [BADGE SSE] Reconnecting in ' + delay + 'ms...');
                setTimeout(connectBadgeSSE, delay);
            }
        });

    } catch (err) {
        console.error('[BADGE SSE] Failed to connect:', err.message);
    }
}

// ─── INIT BADGE ───
function initNotifBadge() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }

    // ✅ Fetch REAL count from database
    fetchUnreadCount();

    // ✅ Connect to SSE for real-time updates
    connectBadgeSSE();

    // ✅ Periodic refresh fallback (every 15 seconds)
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
    }
    window._badgeInterval = setInterval(fetchUnreadCount, 15000);
}

// ─── CLEAN UP ───
function cleanupBadge() {
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
        window._badgeInterval = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
}

// ─── RUN ON PAGE LOAD ───
document.addEventListener('DOMContentLoaded', function() {
    initNotifBadge();
});

window.addEventListener('beforeunload', function() {
    cleanupBadge();
});

console.log('✅ [BADGE] Loaded - Backend as source of truth');

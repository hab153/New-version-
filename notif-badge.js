// ============================================================
// notif-badge.js
// SINGLE SOURCE OF TRUTH = BACKEND ONLY
// No localStorage tricks - only fetches from backend
// ============================================================

var NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';

function getNotifToken() {
    return localStorage.getItem('token');
}

// ─── FETCH REAL UNREAD COUNT FROM BACKEND ───
function fetchUnreadCount() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }

    fetch(NOTIF_BACKEND + '/api/unread/status', {
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
        var count = data.count || 0;
        updateAllBadges(count);
        console.log('🔔 [BADGE] Unread count from DB:', count);
    })
    .catch(function(err) {
        console.error('[BADGE] Error fetching:', err);
        updateAllBadges(0);
    });
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

// ─── SSE: REAL-TIME UPDATES ───
var sseConnection = null;

function connectSSE() {
    var token = getNotifToken();
    if (!token) return;

    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }

    try {
        sseConnection = new EventSource(NOTIF_BACKEND + '/api/events/stream?token=' + encodeURIComponent(token));

        sseConnection.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                if (data.type === 'new_message' || data.type === 'lead_updated') {
                    // ✅ Fetch fresh count from database
                    fetchUnreadCount();
                }
            } catch (err) { /* ignore */ }
        });

        sseConnection.addEventListener('error', function() {
            if (sseConnection) {
                sseConnection.close();
                sseConnection = null;
            }
            // Reconnect after 5 seconds
            setTimeout(connectSSE, 5000);
        });

    } catch (err) {
        console.error('[SSE] Error:', err.message);
    }
}

// ─── INIT ───
function initNotifBadge() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }

    // ✅ Fetch REAL count from database
    fetchUnreadCount();

    // ✅ Connect to SSE for real-time updates
    connectSSE();

    // ✅ Periodic refresh fallback (every 15 seconds)
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
    }
    window._badgeInterval = setInterval(fetchUnreadCount, 15000);
}

// ─── RUN ───
document.addEventListener('DOMContentLoaded', function() {
    initNotifBadge();
});

window.addEventListener('beforeunload', function() {
    if (window._badgeInterval) {
        clearInterval(window._badgeInterval);
        window._badgeInterval = null;
    }
    if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
    }
});

console.log('✅ [BADGE] Using backend as source of truth');

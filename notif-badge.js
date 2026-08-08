// ============================================================
// notif-badge.js
// SHARED Notification Badge - Works across ALL pages
// Skyline AA-1
// ============================================================

const NOTIF_BACKEND = 'https://skylineapp-backend-file.onrender.com';

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
    // Find ALL notification badges on the page
    var badges = document.querySelectorAll('.nav-badge');
    var navItems = document.querySelectorAll('.nav-item');
    
    if (badges.length === 0) {
        // No badges found on this page - that's fine
        return;
    }
    
    badges.forEach(function(badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
            badge.style.background = '#ff5555';
            // Mark parent nav item
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
        // No token, hide badges
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
                // Token expired, clear storage
                localStorage.removeItem('token');
                updateAllBadges(0);
                return 0;
            }
            // Use stored value as fallback
            var stored = getStoredBadge();
            updateAllBadges(stored);
            return stored;
        }
        
        var data = await res.json();
        var count = data.count || 0;
        
        // ✅ Store in localStorage for other pages
        setStoredBadge(count);
        
        // ✅ Check if user has seen these notifications
        var seen = getLastSeenCount();
        var displayCount = count > seen ? count - seen : 0;
        
        // ✅ Update ALL badges on current page
        updateAllBadges(displayCount);
        
        return displayCount;
        
    } catch (error) {
        console.error('[NOTIF BADGE] Fetch error:', error);
        // Use stored value as fallback
        var stored = getStoredBadge();
        updateAllBadges(stored);
        return stored;
    }
}

// ─── Mark notifications as read (when user views notifications page) ───
async function markNotificationsRead() {
    var token = getNotifToken();
    if (!token) return false;
    
    try {
        // ✅ Update last seen count
        var currentCount = getStoredBadge();
        setLastSeenCount(currentCount);
        setStoredBadge(0);
        
        // ✅ Clear badge immediately
        updateAllBadges(0);
        
        // ✅ Optional: Call server to mark as read
        // Only if your backend has this endpoint
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
            // Server may not have this endpoint - that's fine
            console.log('[NOTIF BADGE] Server mark-read not available');
        }
        
        return true;
        
    } catch (error) {
        console.error('[NOTIF BADGE] Error marking read:', error);
        return false;
    }
}

// ─── Initialize notification badge on page load ───
function initNotifBadge() {
    var token = getNotifToken();
    if (!token) {
        updateAllBadges(0);
        return;
    }
    
    // ✅ First: Show stored count immediately (no delay)
    var stored = getStoredBadge();
    var seen = getLastSeenCount();
    var displayCount = stored > seen ? stored - seen : 0;
    updateAllBadges(displayCount);
    
    // ✅ Then: Fetch fresh count from server
    fetchGlobalUnreadCount();
    
    // ✅ Set up periodic refresh (every 15 seconds)
    if (window._notifInterval) {
        clearInterval(window._notifInterval);
    }
    window._notifInterval = setInterval(fetchGlobalUnreadCount, 15000);
}

// ─── Notification button click handler ───
function setupNotifButton() {
    var notifBtn = document.getElementById('navNotifBtn');
    if (!notifBtn) return;
    
    // ✅ When user clicks notification button, mark as read
    notifBtn.addEventListener('click', function(e) {
        var href = this.getAttribute('href');
        
        // If clicking notification button, mark as read
        // The user is about to view notifications
        if (href && href.includes('notifications.html')) {
            // Mark as read when they navigate to notifications
            // We'll let the notifications page handle the actual clearing
            // But we can prepare by setting the seen count
            var currentCount = getStoredBadge();
            setLastSeenCount(currentCount);
            
            // Clear badge immediately for better UX
            updateAllBadges(0);
            
            // Store that we've seen these
            setStoredBadge(0);
        }
    });
}

// ─── Listen for storage changes from other tabs/pages ───
function setupStorageListener() {
    window.addEventListener('storage', function(e) {
        if (e.key === 'globalUnreadCount' || e.key === 'lastSeenNotifCount') {
            // Another page updated the badge count
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

// ─── Clean up interval on page unload ───
window.addEventListener('beforeunload', function() {
    if (window._notifInterval) {
        clearInterval(window._notifInterval);
        window._notifInterval = null;
    }
});

console.log('✅ [NOTIF BADGE] Shared badge system loaded');

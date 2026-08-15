// ============================================================
// session-check.js
// Auto-logout after 3 days - Shared across ALL pages
// Skyline AA-1
// ============================================================

(function() {
    'use strict';

    // ─── CONFIG ───
    var SESSION_MAX_DAYS = 3;
    var SESSION_MAX_MS = SESSION_MAX_DAYS * 24 * 60 * 60 * 1000; // 259,200,000 ms

    // ─── DOM Elements ───
    var body = document.body;
    var toast = null;

    // ─── Get token ───
    function getToken() {
        return localStorage.getItem('token');
    }

    // ─── Check if session is expired ───
    function isSessionExpired() {
        var loginTime = localStorage.getItem('loginTime');
        if (!loginTime) {
            // No login time recorded - set it now
            localStorage.setItem('loginTime', String(Date.now()));
            return false;
        }

        var elapsed = Date.now() - parseInt(loginTime);
        return elapsed > SESSION_MAX_MS;
    }

    // ─── Clear all session data ───
    function clearSession() {
        var keysToRemove = [
            'token',
            'csrfToken',
            'loginTime',
            'globalUnreadCount',
            'lastSeenNotifCount',
            'lastKnownNotifCount',
            'pendingEmailPayload'
        ];

        keysToRemove.forEach(function(key) {
            localStorage.removeItem(key);
        });

        console.log('🔒 [SESSION] All session data cleared');
    }

    // ─── Get remaining session time ───
    function getRemainingTime() {
        var loginTime = localStorage.getItem('loginTime');
        if (!loginTime) return null;

        var elapsed = Date.now() - parseInt(loginTime);
        var remaining = SESSION_MAX_MS - elapsed;

        if (remaining <= 0) return null;

        var days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        var hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        var minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

        return {
            days: days,
            hours: hours,
            minutes: minutes,
            totalMs: remaining,
            formatted: days + 'd ' + hours + 'h ' + minutes + 'm'
        };
    }

    // ─── Show toast message ───
    function showToast(message, duration) {
        duration = duration || 4000;

        // Remove existing toast
        var existing = document.querySelector('.session-toast');
        if (existing) existing.remove();

        toast = document.createElement('div');
        toast.className = 'session-toast';
        toast.textContent = message;

        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#f5f5f5',
            padding: '14px 24px',
            borderRadius: '10px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
            fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: '9999',
            maxWidth: '90%',
            textAlign: 'center',
            animation: 'sessionFadeUp 0.3s ease both',
            pointerEvents: 'none'
        });

        document.body.appendChild(toast);

        // Add animation keyframes if not already added
        if (!document.getElementById('sessionToastStyles')) {
            var style = document.createElement('style');
            style.id = 'sessionToastStyles';
            style.textContent = `
                @keyframes sessionFadeUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(14px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        // Auto-hide
        setTimeout(function() {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(10px)';
                toast.style.transition = 'opacity 0.3s, transform 0.3s';
                setTimeout(function() {
                    if (toast) toast.remove();
                }, 300);
            }
        }, duration);
    }

    // ─── Redirect to login ───
    function redirectToLogin(expired) {
        var url = 'login.html';
        if (expired) {
            url += '?expired=true';
        }
        window.location.href = url;
    }

    // ─── Main session check ───
    function checkSession() {
        var token = getToken();

        // No token - user is not logged in
        if (!token) {
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('login.html')) {
                redirectToLogin(false);
            }
            return;
        }

        // Check if session is expired
        if (isSessionExpired()) {
            console.log('⏰ [SESSION] Session expired after 3 days');
            clearSession();
            redirectToLogin(true);
            return;
        }

        // Session is valid - log remaining time (only in development)
        if (process && process.env && process.env.NODE_ENV === 'development') {
            var remaining = getRemainingTime();
            if (remaining) {
                console.log('⏰ [SESSION] Session expires in:', remaining.formatted);
            }
        }

        // Show warning when session is about to expire (last 6 hours)
        var remaining = getRemainingTime();
        if (remaining && remaining.totalMs < 6 * 60 * 60 * 1000 && remaining.totalMs > 0) {
            var hoursLeft = Math.floor(remaining.totalMs / (60 * 60 * 1000));
            var minutesLeft = Math.floor((remaining.totalMs % (60 * 60 * 1000)) / (60 * 1000));
            var message = '⏰ Your session expires in ' + hoursLeft + 'h ' + minutesLeft + 'm';
            showToast(message, 5000);
        }
    }

    // ─── Listen for storage changes (other tabs) ───
    function setupStorageListener() {
        window.addEventListener('storage', function(e) {
            if (e.key === 'token' && !e.newValue) {
                // Token was removed from another tab
                redirectToLogin(false);
            }
            if (e.key === 'loginTime') {
                // Login time changed - re-check
                checkSession();
            }
        });
    }

    // ─── Initialize ───
    function init() {
        // Check session on page load
        checkSession();

        // Set up storage listener for cross-tab sync
        setupStorageListener();

        // Re-check when page becomes visible again (user switches tabs)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                checkSession();
            }
        });

        // Re-check on user activity (clicks, keypresses)
        var activityTimeout;
        var ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

        function onUserActivity() {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(function() {
                checkSession();
            }, 5000);
        }

        document.addEventListener('click', onUserActivity);
        document.addEventListener('keydown', onUserActivity);
        document.addEventListener('scroll', onUserActivity);

        console.log('🔒 [SESSION] Session check initialized (3 days expiry)');
    }

    // ─── Run on DOM ready ───
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

console.log('✅ [SESSION] session-check.js loaded');

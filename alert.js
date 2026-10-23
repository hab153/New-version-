// ============================================================
// alert.js - Skyline AI · Alerts Page Logic
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ── DOM Elements ──
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const filterTabs = document.querySelectorAll('.tab-btn');
    const preferencesCard = document.getElementById('preferencesCard');
    const addAlertBtn = document.getElementById('addAlertBtn');
    const deleteAlertsBtn = document.getElementById('deleteAlertsBtn');

    // State
    let notifications = [];
    let currentFilter = 'all';
    const BACKEND = 'https://skylineapp-backend-file.onrender.com';
    const token = localStorage.getItem('token');

    // ── 1. Fetch Notifications ──
    async function fetchNotifications() {
        if (!token) {
            renderEmptyState('Please log in to view alerts.');
            return;
        }

        try {
            const res = await fetch(`${BACKEND}/api/notifications`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (res.ok) {
                const data = await res.json();
                notifications = data.data || [];
                renderNotifications();
            } else {
                renderErrorState('Failed to load alerts. Please retry.');
            }
        } catch (e) {
            console.error('Fetch notifications error:', e);
            renderErrorState('Network error. Check your connection.');
        }
    }

    // ── 2. Render Notifications ──
    function renderNotifications() {
        if (!notificationList) return;
        notificationList.innerHTML = '';

        let filtered = notifications;

        if (currentFilter === 'unread') {
            filtered = notifications.filter(n => !n.isRead);
        } else if (currentFilter === 'security') {
            filtered = notifications.filter(n => n.category === 'security' || n.type === 'automation_paused');
        }

        if (filtered.length === 0) {
            renderEmptyState(currentFilter === 'unread' ? "You're all caught up." : "No alerts found.");
            return;
        }

        filtered.forEach(notification => {
            const card = createNotificationCard(notification);
            notificationList.appendChild(card);
        });
    }

    // ── 3. Create Notification Card ──
    function createNotificationCard(n) {
        const card = document.createElement('div');
        card.className = 'notification-card';
        if (!n.isRead) card.classList.add('unread');
        if (n.type === 'automation_paused') card.classList.add('security-type');
        if (n.type === 'email_connection') card.classList.add('connection-type');

        const iconConfig = getIconConfig(n.type);
        const timeStr = formatTimestamp(n.createdAt);

        card.innerHTML = `
            <div class="card-icon ${iconConfig.class}">
                ${iconConfig.svg}
                ${!n.isRead ? '<div class="unread-dot"></div>' : ''}
            </div>
            <div class="card-content">
                <div class="card-header-row">
                    <h3 class="card-title">${n.title}</h3>
                    <span class="card-timestamp">${timeStr}</span>
                </div>
                <p class="card-desc">${n.description}</p>
                <a href="${n.actionUrl || '#'}" class="card-action-btn" data-id="${n._id}" data-type="${n.type}">
                    ${n.actionLabel || 'View details'}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </a>
            </div>
        `;

        // Mark as read on click
        card.addEventListener('click', async function(e) {
            if (!n.isRead && token) {
                try {
                    await fetch(`${BACKEND}/api/notifications/${n._id}/read`, {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    n.isRead = true;
                    updateUnreadBadge();
                    renderNotifications();
                } catch (err) {
                    console.error('Mark read error:', err);
                }
            }
        });

        return card;
    }

    // ─ 4. Icon Configuration ──
    function getIconConfig(type) {
        const icons = {
            reply: {
                class: 'default',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>'
            },
            ai_draft: {
                class: 'ai',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>'
            },
            automation_paused: {
                class: 'security',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
            },
            email_connection: {
                class: 'warning',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
            },
            usage_summary: {
                class: 'default',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
            }
        };
        return icons[type] || icons.reply;
    }

    // ── 5. Format Timestamp ──
    function formatTimestamp(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'long' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    // ── 6. Empty & Error States ──
    function renderEmptyState(message) {
        notificationList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9699A3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>${message}</p>
            </div>
        `;
    }

    function renderErrorState(message) {
        notificationList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF535B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                <p>${message}</p>
                <button class="mark-all-read-btn" style="margin-top:16px;" onclick="fetchNotifications()">Retry</button>
            </div>
        `;
    }

    // ── 7. Update Unread Badge ─
    function updateUnreadBadge() {
        const unreadCount = notifications.filter(n => !n.isRead).length;
        const badges = document.querySelectorAll('.nav-badge');
        badges.forEach(badge => {
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        });
    }

    // ── 8. Event Listeners ──

    // Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            renderNotifications();
        });
    });

    // Mark All As Read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async function() {
            if (!token) return;
            
            const unreadIds = notifications.filter(n => !n.isRead).map(n => n._id);
            if (unreadIds.length === 0) return;

            try {
                await fetch(`${BACKEND}/api/notifications/mark-all-read`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ids: unreadIds })
                });

                notifications.forEach(n => n.isRead = true);
                updateUnreadBadge();
                renderNotifications();
            } catch (e) {
                console.error('Mark all read error:', e);
                alert('Failed to mark all as read.');
            }
        });
    }

    // Preferences Card → Settings
    if (preferencesCard) {
        preferencesCard.addEventListener('click', function() {
            window.location.href = 'settings.html#notifications';
        });
    }

    // Add / Delete Buttons (Placeholder integration)
    if (addAlertBtn) {
        addAlertBtn.addEventListener('click', function() {
            // Integrate with existing create workflow
            console.log('Add alert clicked');
        });
    }

    if (deleteAlertsBtn) {
        deleteAlertsBtn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to clear all alerts?')) return;
            if (!token) return;

            try {
                await fetch(`${BACKEND}/api/notifications/clear-all`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                notifications = [];
                updateUnreadBadge();
                renderNotifications();
            } catch (e) {
                console.error('Clear all error:', e);
                alert('Failed to clear alerts.');
            }
        });
    }

    // ── 9. Initial Load ──
    fetchNotifications();
});

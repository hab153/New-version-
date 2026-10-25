// ============================================================
// alert.js - Skyline AI · Alerts Page (LIVE DATA - FIXED)
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ── DOM Elements ──
    const notificationList = document.getElementById('notificationList');
    const markAllReadBtn = document.querySelector('.mark-all-read-btn');
    const filterTabs = document.querySelectorAll('.tab-btn');
    const preferencesCard = document.getElementById('preferencesCard');
    const automationCard = document.getElementById('automationCard'); // ✅ NEW
    
    const usageModalOverlay = document.getElementById('usageModalOverlay');
    const closeUsageModal = document.getElementById('closeUsageModal');
    const usageGrid = document.getElementById('usageGrid');

    // State
    let currentFilter = 'all';
    let liveNotifications = []; 
    const BACKEND = 'https://skylineapp-backend-file.onrender.com';
    const token = localStorage.getItem('token');

    // ⭐ FIXED: Cache includes ALL 8 fields (remaining + max)
    let _cachedLimits = {
        emails: 0,          emailsLimit: 30,
        research: 0,        researchLimit: 4,
        chats: 0,           chatsLimit: 30,
        aiSuggestions: 0,   aiSuggestionsLimit: 7,
        tier: 'free'
    };

    // ── 1. Fetch Live Usage (FIXED: reads data.limits.*) ──
    async function checkUsageLimits() {
        if (!token) return null;

        try {
            console.log('📤 [USAGE] Fetching /api/users/me/usage...');
            const res = await fetch(`${BACKEND}/api/users/me/usage`, {
                headers: { 'Authorization': 'Bearer ' + token },
                cache: 'no-store'
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            console.log('📥 [USAGE] Received:', data);

            // ⭐ FIXED: Read from data.limits.{type}.remaining / .max
            const limits = data.limits || {};
            _cachedLimits.emails            = limits.email?.remaining         ?? 0;
            _cachedLimits.emailsLimit       = limits.email?.max               ?? 30;
            _cachedLimits.research          = limits.research?.remaining      ?? 0;
            _cachedLimits.researchLimit     = limits.research?.max            ?? 4;
            _cachedLimits.chats             = limits.chat?.remaining          ?? 0;
            _cachedLimits.chatsLimit        = limits.chat?.max                ?? 30;
            _cachedLimits.aiSuggestions     = limits.aiSuggestions?.remaining ?? 0;
            _cachedLimits.aiSuggestionsLimit = limits.aiSuggestions?.max      ?? 7;
            _cachedLimits.tier              = data.tier || 'free';

            console.log('✅ [USAGE] Cached limits:', _cachedLimits);
            return data;
        } catch (err) {
            console.error('❌ [USAGE] Failed:', err);
            return null;
        }
    }

    // ── 2. Build Usage Card Text from Cache (FIXED) ──
    function buildUsageCardText() {
        const chatsUsed  = _cachedLimits.chatsLimit         - _cachedLimits.chats;
        const emailsUsed = _cachedLimits.emailsLimit        - _cachedLimits.emails;
        const aiUsed     = _cachedLimits.aiSuggestionsLimit - _cachedLimits.aiSuggestions;
        
        return `You used ${chatsUsed} of ${_cachedLimits.chatsLimit} daily chats, ${emailsUsed} of ${_cachedLimits.emailsLimit} daily emails, and ${aiUsed} of ${_cachedLimits.aiSuggestionsLimit} AI suggestions.`;
    }

    function getTodayDayName() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    // ── 3. Init Alerts Page ──
    async function initAlertsPage() {
        if (!notificationList) return;
        
        notificationList.innerHTML = `
            <div class="skeleton-card skeleton-animate"></div>
            <div class="skeleton-card skeleton-animate"></div>
            <div class="skeleton-card skeleton-animate"></div>
        `;

        if (!token) {
            renderEmptyState('Please log in to view alerts.');
            return;
        }

        // Fetch usage + notifications in parallel
        const [usageData, notifRes] = await Promise.all([
            checkUsageLimits(),
            fetch(`${BACKEND}/api/notifications`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).catch(() => null)
        ]);

        // Process notifications
        if (notifRes && notifRes.ok) {
            const notifData = await notifRes.json();
            console.log('📥 [NOTIFS] Received:', notifData);

            liveNotifications = (notifData.data || []).map(n => ({
                id: n._id,
                type: mapNotificationType(n.type),
                title: n.title,
                description: n.description,
                timestamp: formatTimestamp(n.createdAt),
                isRead: n.isRead,
                category: n.category || 'general',
                actionLabel: n.actionLabel || 'View details',
                actionUrl: n.actionUrl || '#',
                createdAt: n.createdAt
            }));
        } else {
            liveNotifications = [];
        }

        // ⭐ FIXED: Build usage card from cache (not from `usageData`)
        const existingUsageIdx = liveNotifications.findIndex(n => n.type === 'usage_summary');
        const usageCard = {
            id: existingUsageIdx >= 0 ? liveNotifications[existingUsageIdx].id : 'dynamic_usage_' + Date.now(),
            type: 'usage_summary',
            title: 'Daily usage summary',
            description: buildUsageCardText(),  // ← No argument needed now
            timestamp: getTodayDayName(),
            isRead: true,
            category: 'general',
            actionLabel: 'View usage',
            actionUrl: '#usage',
            createdAt: new Date().toISOString()
        };

        if (existingUsageIdx >= 0) {
            liveNotifications[existingUsageIdx] = usageCard;
        } else {
            liveNotifications.push(usageCard);
        }

        liveNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderNotifications();
    }

    // ── Render Notifications ──
    function renderNotifications() {
        if (!notificationList) return;
        notificationList.innerHTML = '';

        let filtered = liveNotifications;
        if (currentFilter === 'unread') {
            filtered = liveNotifications.filter(n => !n.isRead);
        } else if (currentFilter === 'security') {
            filtered = liveNotifications.filter(n => n.category === 'security' || n.type === 'automation_paused');
        }

        if (filtered.length === 0) {
            renderEmptyState(currentFilter === 'unread' ? "You're all caught up." : "No alerts found.");
            return;
        }

        filtered.forEach(n => {
            notificationList.appendChild(createNotificationCard(n));
        });
    }

    function createNotificationCard(n) {
        const card = document.createElement('div');
        card.className = 'notification-card';
        if (!n.isRead) card.classList.add('unread');
        if (n.type === 'automation_paused') card.classList.add('security-type');
        if (n.type === 'email_connection') card.classList.add('connection-type');

        const iconConfig = getIconConfig(n.type);

        card.innerHTML = `
            <div class="card-icon ${iconConfig.class}">
                ${iconConfig.svg}
                ${!n.isRead ? '<div class="unread-dot"></div>' : ''}
            </div>
            <div class="card-content">
                <div class="card-header-row">
                    <h3 class="card-title">${n.title}</h3>
                    <span class="card-timestamp">${n.timestamp}</span>
                </div>
                <p class="card-desc">${n.description}</p>
                <button class="card-action-btn" data-action="${n.actionLabel}" data-url="${n.actionUrl}">
                    ${n.actionLabel}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
            </div>
        `;

        const actionBtn = card.querySelector('.card-action-btn');
        actionBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (n.actionUrl === '#usage') {
                openUsageModal();
            } else if (n.actionUrl && n.actionUrl !== '#') {
                window.location.href = n.actionUrl;
            }
        });

        card.addEventListener('click', async function() {
            if (!n.isRead && token) {
                try {
                    await fetch(`${BACKEND}/api/notifications/${n.id}/read`, {
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

    function mapNotificationType(backendType) {
        const mapping = {
            'reply_received': 'reply',
            'ai_draft_ready': 'ai_draft',
            'automation_paused': 'automation_paused',
            'email_connection_error': 'email_connection',
            'usage_summary': 'usage_summary'
        };
        return mapping[backendType] || 'reply';
    }

    function formatTimestamp(dateString) {
        if (!dateString) return getTodayDayName();
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

    function renderEmptyState(message) {
        notificationList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9699A3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>${message}</p>
            </div>`;
    }

    function updateUnreadBadge() {
        const unreadCount = liveNotifications.filter(n => !n.isRead).length;
        document.querySelectorAll('.nav-badge').forEach(badge => {
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        });
    }

    // ═══════════════════════════════════════
    // ✅ USAGE MODAL — ALWAYS FETCH FRESH (FIXED paths)
    // ═══════════════════════════════════════
    async function openUsageModal() {
        if (!usageModalOverlay) return;
        
        usageModalOverlay.style.display = 'flex';
        usageGrid.innerHTML = '<div class="usage-loading">Loading usage data...</div>';

        if (!token) {
            usageGrid.innerHTML = '<div class="usage-error">Please log in to view usage.</div>';
            return;
        }

        try {
            console.log('📤 [MODAL] Fetching fresh usage...');
            const res = await fetch(`${BACKEND}/api/users/me/usage`, {
                headers: { 'Authorization': 'Bearer ' + token },
                cache: 'no-store'
            });

            const data = await res.json();
            console.log('📥 [MODAL] Fresh data:', data);

            if (!res.ok) throw new Error(data.message || 'Failed');

            // ⭐ FIXED: Read from data.limits.{type}.{remaining, max}
            const limits = data.limits || {};
            
            const metrics = [
                { 
                    label: 'Emails', 
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
                    remaining: limits.email?.remaining ?? 0,
                    total: limits.email?.max ?? 30
                },
                { 
                    label: 'Research', 
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
                    remaining: limits.research?.remaining ?? 0,
                    total: limits.research?.max ?? 4
                },
                { 
                    label: 'Chats', 
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
                    remaining: limits.chat?.remaining ?? 0,
                    total: limits.chat?.max ?? 30
                },
                { 
                    label: 'AI Suggestions', 
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
                    remaining: limits.aiSuggestions?.remaining ?? 0,
                    total: limits.aiSuggestions?.max ?? 7
                }
            ];

            usageGrid.innerHTML = metrics.map(m => {
                const used = m.total - m.remaining;
                const pct = m.total > 0 ? (m.remaining / m.total) * 100 : 0;
                return `
                    <div class="usage-card">
                        <div class="usage-icon">${m.icon}</div>
                        <div class="usage-info">
                            <div class="usage-label">${m.label}</div>
                            <div class="usage-count">${m.remaining} / ${m.total}</div>
                        </div>
                        <div class="usage-bar-container">
                            <div class="usage-bar" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error('❌ [MODAL] Error:', err);
            usageGrid.innerHTML = `<div class="usage-error">Failed to load usage: ${err.message}</div>`;
        }
    }

    function closeUsageModalFn() {
        if (usageModalOverlay) usageModalOverlay.style.display = 'none';
    }

    if (closeUsageModal) closeUsageModal.addEventListener('click', closeUsageModalFn);
    if (usageModalOverlay) {
        usageModalOverlay.addEventListener('click', function(e) {
            if (e.target === usageModalOverlay) closeUsageModalFn();
        });
    }

    // ── Event Listeners ──
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            renderNotifications();
        });
    });

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async function() {
            if (!token) return;
            try {
                await fetch(`${BACKEND}/api/notifications/mark-all-read`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                liveNotifications.forEach(n => n.isRead = true);
                updateUnreadBadge();
                renderNotifications();
            } catch (err) {
                console.error('Mark all error:', err);
                alert('Failed to mark all as read.');
            }
        });
    }

    if (preferencesCard) {
        preferencesCard.addEventListener('click', function() {
            window.location.href = 'settings.html#notifications';
        });
    }

    // ✅ NEW: Automation Card Navigation
    if (automationCard) {
        automationCard.addEventListener('click', function() {
            window.location.href = 'automation.html';
        });
    }

    // Initial Load
    initAlertsPage();
});

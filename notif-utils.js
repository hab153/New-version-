// ========== GLOBAL CSRF FETCH INTERCEPTOR ==========
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        const csrfToken = localStorage.getItem('csrfToken');
        const method = (options.method || 'GET').toUpperCase();
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

        // Only add CSRF token for state-changing requests
        if (!safeMethods.includes(method) && csrfToken) {
            options.headers = options.headers || {};
            options.headers['X-CSRF-Token'] = csrfToken;
        }

        return originalFetch.call(this, url, options);
    };
})();

// ========== XSS PROTECTION – COMPREHENSIVE ==========

/**
 * Escape HTML special characters for safe insertion into HTML content
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#x60;');
}

/**
 * Escape HTML for insertion into HTML attributes (single or double quotes)
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for attributes
 */
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escape HTML for safe insertion into JavaScript strings (prevents breakouts)
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for JS
 */
function escapeJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f');
}

// Make globally available
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.escapeJS = escapeJS;

// ========== UTILITY FUNCTIONS ==========

function calculateEngagementScore(lead, messages) {
    let score = 50;
    let tier = 'MED';
    if (lead && lead.status === 'Replied') score = 70;
    else if (lead && lead.status === 'Contacted') score = 40;
    if (messages && messages.length > 10) score += 10;
    if (score >= 75) tier = 'HIGH';
    else if (score >= 40) tier = 'MED';
    else tier = 'LOW';
    return { score, tier };
}

function getInitials(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// ========== GLOBAL UI STATE ==========
let allContacts = [];
let userTier = 'free';
let currentLeadId = null;
let isAutoReplyEnabled = false;
let autoReplyInstructions = "";

// ========== UI FUNCTIONS ==========

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendReply(document.getElementById('replyText').value.trim());
    }
}

function switchTab(tab, btn) {
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (tab === 'leads') {
        document.getElementById('viewList').classList.remove('hidden');
        document.getElementById('viewAdmin').classList.remove('active');
        closeChat();
    } else {
        document.getElementById('viewList').classList.add('hidden');
        document.getElementById('viewAdmin').classList.add('active');
        closeChat();
    }
}

function updateStats(contacts) {
    allContacts = contacts;
    const total = contacts.length;
    const unread = contacts.filter(c => (c.unreadCount || 0) > 0).length;

    let high = 0;
    let med = 0;
    contacts.forEach(c => {
        const rating = calculateEngagementScore(c, []);
        if (rating.score >= 75) high++;
        else if (rating.score >= 40) med++;
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statUnread').textContent = unread;
    document.getElementById('statHigh').textContent = high;
    document.getElementById('statMed').textContent = med;

    const badge = document.getElementById('leadsTabBadge');
    if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderContacts(contacts) {
    const list = document.getElementById('contactList');
    if (contacts.length === 0) {
        list.innerHTML = '<div style="padding:36px 20px; text-align:center; color:var(--text-3); font-family:var(--font-mono); font-size:11px; letter-spacing:0.06em;">NO CONVERSATIONS YET</div>';
        return;
    }
    const sorted = [...contacts].sort((a, b) => {
        const aU = (a.unreadCount || 0) > 0;
        const bU = (b.unreadCount || 0) > 0;
        if (aU && !bU) return -1;
        if (!aU && bU) return 1;
        return new Date(b.lastDate || 0) - new Date(a.lastDate || 0);
    });

    list.innerHTML = sorted.map(c => {
        const unread = c.unreadCount || 0;
        const rating = calculateEngagementScore(c, []);
        let confClass = 'low';
        if (rating.score >= 75) confClass = 'high';
        else if (rating.score >= 40) confClass = 'med';

        // ALL user-generated content is escaped
        const safeName = escapeHtml(c.name || 'Unknown');
        const safeEmail = escapeHtml(c.email || '');
        const safeCompany = escapeHtml(c.company || '');
        const safeLastMsg = escapeHtml(c.lastMessage || 'No messages yet');
        const safeTier = escapeHtml(rating.tier);
        const safeId = escapeAttr(c.id || '');

        return `
            <div class="contact-item ${unread > 0 ? 'unread' : ''}"
                 onclick="openChat('${safeId}', '${safeName}', '${safeEmail}')">
                <div class="contact-avatar">${escapeHtml(getInitials(c.name))}</div>
                <div class="contact-body">
                    <div class="contact-row1">
                        <span class="contact-name">${safeName}</span>
                        <span class="contact-time">${c.lastDate ? new Date(c.lastDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}</span>
                    </div>
                    <div class="contact-row2">
                        <span class="contact-preview">${safeLastMsg}</span>
                        <div class="contact-meta">
                            ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
                            <span class="conf-badge ${confClass}">
                                ${rating.score} <span style="opacity:0.7; font-weight:400;">${safeTier}</span>
                            </span>
                            ${c.company ? `<span class="company-tag">${safeCompany}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function filterContacts(query) {
    if (!query.trim()) { renderContacts(allContacts); return; }
    const q = query.toLowerCase();
    renderContacts(allContacts.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    ));
}

async function openChat(leadId, name, email) {
    window.currentLeadId = leadId;
    window.currentLeadName = name;
    window.currentLeadEmail = email;
    currentLeadId = leadId;

    const leadData = allContacts.find(l => l.id === leadId);
    let badgeHtml = '';
    if (leadData) {
        const rating = calculateEngagementScore(leadData, []);
        let cls = 'low';
        if (rating.score >= 75) cls = 'high';
        else if (rating.score >= 40) cls = 'med';
        // Escape the tier and score
        const safeTier = escapeHtml(rating.tier);
        badgeHtml = `<span class="conf-badge ${cls}" style="margin-left:6px; font-size:8px;">${rating.score} ${safeTier}</span>`;
    }

    // Use textContent for display name, innerHTML for badge (badge is safe)
    const chatNameEl = document.getElementById('chatName');
    chatNameEl.innerHTML = `${escapeHtml(name)} ${badgeHtml}`;
    document.getElementById('chatEmail').textContent = email;
    document.getElementById('chatAvatar').textContent = getInitials(name);
    document.getElementById('replyText').value = '';
    document.getElementById('replyText').style.height = '38px';
    document.getElementById('viewChat').classList.add('active');

    const contact = allContacts.find(c => c.id === leadId);
    if (contact && contact.unreadCount > 0) {
        contact.unreadCount = 0;
        updateStats(allContacts);
        renderContacts(allContacts);
        markAsRead(leadId);
    }

    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-3); font-family:var(--font-mono); font-size:10px; letter-spacing:0.06em;">LOADING MESSAGES…</div>';

    try {
        const data = await fetchConversationDetails(leadId);
        isAutoReplyEnabled = data.lead.autoReplyEnabled || false;
        autoReplyInstructions = data.lead.autoReplyInstructions || "";
        updateAutoReplyUI();

        if (data.messages && data.messages.length > 0) {
            const realRating = calculateEngagementScore(leadData, data.messages);
            let cls = 'low';
            if (realRating.score >= 75) cls = 'high';
            else if (realRating.score >= 40) cls = 'med';
            const safeTier = escapeHtml(realRating.tier);
            document.getElementById('chatName').innerHTML = `${escapeHtml(name)} <span class="conf-badge ${cls}" style="margin-left:6px; font-size:8px;">${realRating.score} ${safeTier}</span>`;
        }

        if (!data.messages || data.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3>No messages yet</h3>
                    <p>Send the first message to start the conversation.</p>
                </div>`;
            return;
        }

        container.innerHTML = data.messages.map(msg => {
            // Escape ALL user-generated content from messages
            const safeContent = escapeHtml(msg.content || '');
            const safeTime = msg.date ? new Date(msg.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            return `
                <div class="msg-group ${msg.from === 'lead' ? 'from-lead' : 'from-ai'}">
                    <div class="message-bubble ${msg.from === 'lead' ? 'lead' : 'ai'}">
                        ${safeContent}
                        <div class="message-time">${safeTime}</div>
                    </div>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-3); font-size:12px;">Failed to load messages.</div>';
    }
}

function closeChat() {
    document.getElementById('viewChat').classList.remove('active');
    currentLeadId = null;
}

function toggleAutoReply() {
    const tier = (userTier || 'free').toLowerCase();
    if (tier === 'free') {
        alert("Auto-reply is not available on the Free plan. Upgrade to Go or Pro to use AI auto-replies.");
        return;
    }
    if (isAutoReplyEnabled) {
        isAutoReplyEnabled = false;
        saveAutoReplyStatus();
    } else {
        openInstructionsModal();
    }
}

function openInstructionsModal() {
    document.getElementById('instructionsText').value = autoReplyInstructions;
    document.getElementById('instructionsModal').classList.add('active');
}

function closeInstructionsModal() {
    document.getElementById('instructionsModal').classList.remove('active');
    updateAutoReplyUI();
}

async function handleSaveInstructions() {
    const instructions = document.getElementById('instructionsText').value.trim();
    const success = await saveAutoReplyInstructions(instructions);
    if (success) closeInstructionsModal();
}

function updateAutoReplyUI() {
    const toggle = document.getElementById('aiToggle');
    const editBtn = document.getElementById('editDetailsBtn');
    const inputArea = document.getElementById('replyInputArea');

    if (isAutoReplyEnabled) {
        toggle.classList.add('active');
        editBtn.style.display = 'flex';
        inputArea.classList.add('hidden');
    } else {
        toggle.classList.remove('active');
        editBtn.style.display = 'none';
        inputArea.classList.remove('hidden');
    }
}

// ─── HINT MENU LOGIC ───

function toggleHintMenu() {
    const dropdown = document.getElementById('hintDropdown');
    const hintItem = document.querySelector('.hint-item');
    const tierBadge = document.getElementById('hintTierBadge');

    const currentTier = (userTier || 'free').toLowerCase();

    if (tierBadge) {
        if (currentTier === 'free') {
            tierBadge.textContent = 'GO';
            tierBadge.style.display = 'inline-block';
        } else {
            tierBadge.style.display = 'none';
        }
    }

    if (isAutoReplyEnabled) {
        if (hintItem) hintItem.classList.add('disabled-hint');
    } else {
        if (hintItem) hintItem.classList.remove('disabled-hint');
    }
    dropdown.classList.toggle('show');
}

async function triggerHint() {
    if (isAutoReplyEnabled) return;

    document.getElementById('hintDropdown').classList.remove('show');

    if (!currentLeadId) {
        alert("Open a chat first to get a hint.");
        return;
    }

    const btn = document.getElementById('hintMenuBtn');
    const originalContent = btn.innerHTML;

    btn.innerHTML = `<svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;

    try {
        const BACKEND = window.BACKEND || 'https://skylineapp-backend-file.onrender.com';
        const token = localStorage.getItem('token');

        const res = await fetch(`${BACKEND}/api/conversations/${currentLeadId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const messages = data.messages || [];
        if (messages.length === 0) {
            alert("No messages to base a hint on.");
            return;
        }

        const suggestRes = await fetch(`${BACKEND}/api/ai/suggest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ messages: messages.slice(-3) })
        });

        const suggestData = await suggestRes.json();

        if (!suggestRes.ok) {
            if (suggestRes.status === 403) {
                alert(suggestData.message || "Hint limit reached.");
            } else {
                alert("Failed to get hint.");
            }
            return;
        }

        if (suggestData.suggestion) {
            const textArea = document.getElementById('replyText');
            textArea.value = suggestData.suggestion;
            autoResize(textArea);
            textArea.focus();
        }
    } catch (error) {
        console.error(error);
        alert("Connection error.");
    } finally {
        btn.innerHTML = originalContent;
    }
}

document.addEventListener('click', function(event) {
    const menu = document.querySelector('.hint-menu-wrap');
    const dropdown = document.getElementById('hintDropdown');
    if (menu && !menu.contains(event.target) && dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }
});

// ========== AUTO-RESIZE FOR TEXTAREA (on input) ==========
document.addEventListener('DOMContentLoaded', function() {
    const replyText = document.getElementById('replyText');
    if (replyText) {
        replyText.addEventListener('input', function() {
            autoResize(this);
        });
    }
});

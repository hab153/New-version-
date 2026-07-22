// ========== GLOBAL UI STATE ==========
// ✅ REMOVED duplicate declaration - allContacts is already in notif-api.js
let userTier = 'free';
let autoFollowUpEnabled = false;

// ========== EXISTING UI FUNCTIONS ==========
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
        const unreadDot = unread > 0 ? `<span class="unread-dot" style="display:inline-block; width:8px; height:8px; background:#4a9eff; border-radius:50%; margin-left:6px; flex-shrink:0;"></span>` : '';
        const nameStyle = unread > 0 ? 'font-weight:700;' : 'font-weight:400;';
        return `
            <div class="contact-item ${unread > 0 ? 'unread' : ''}"
                 onclick="openChat('${c.id}', '${escapeHtml(c.name)}', '${escapeHtml(c.email)}')">
                <div class="contact-avatar">${getInitials(c.name)}</div>
                <div class="contact-body">
                    <div class="contact-row1">
                        <span class="contact-name" style="${nameStyle}">${escapeHtml(c.name)}${unreadDot}</span>
                        <span class="contact-time">${c.lastDate ? new Date(c.lastDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}</span>
                    </div>
                    <div class="contact-row2">
                        <span class="contact-preview">${escapeHtml(c.lastMessage || 'No messages yet')}</span>
                        <div class="contact-meta">
                            ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
                            <span class="conf-badge ${confClass}">
                                ${rating.score} <span style="opacity:0.7; font-weight:400;">${rating.tier}</span>
                            </span>
                            ${c.company ? `<span class="company-tag">${escapeHtml(c.company)}</span>` : ''}
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
    console.log(`💬 [openChat] Opening chat with ${name} (${leadId})`);
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
        badgeHtml = `<span class="conf-badge ${cls}" style="margin-left:6px; font-size:8px;">${rating.score} ${rating.tier}</span>`;
    }
    document.getElementById('chatName').innerHTML = `${escapeHtml(name)} ${badgeHtml}`;
    document.getElementById('chatEmail').innerText = email;
    document.getElementById('chatAvatar').innerText = getInitials(name);
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
        await loadFollowUpStatus();
        if (data.messages && data.messages.length > 0) {
            const realRating = calculateEngagementScore(leadData, data.messages);
            let cls = 'low';
            if (realRating.score >= 75) cls = 'high';
            else if (realRating.score >= 40) cls = 'med';
            document.getElementById('chatName').innerHTML = `${escapeHtml(name)} <span class="conf-badge ${cls}" style="margin-left:6px; font-size:8px;">${realRating.score} ${realRating.tier}</span>`;
        }
        if (!data.messages || data.messages.length === 0) {
            container.innerHTML = `<div class="empty-state">
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
        container.innerHTML = data.messages.map(msg => `
            <div class="msg-group ${msg.from === 'lead' ? 'from-lead' : 'from-ai'}">
                <div class="message-bubble ${msg.from === 'lead' ? 'lead' : 'ai'}">
                    ${escapeHtml(msg.content)}
                    <div class="message-time">${new Date(msg.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
            </div>
        `).join('');
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error('❌ [openChat] Error loading messages:', err);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-3); font-size:12px;">Failed to load messages.</div>';
    }
}

function closeChat() {
    console.log('🔚 [closeChat] Closing chat');
    document.getElementById('viewChat').classList.remove('active');
    currentLeadId = null;
}

// ========== AUTO‑REPLY ==========
function toggleAutoReply() {
    console.log(`🤖 [toggleAutoReply] Current isAutoReplyEnabled=${isAutoReplyEnabled}`);
    if (isAutoReplyEnabled) {
        isAutoReplyEnabled = false;
        saveAutoReplyStatus();
    } else {
        const currentTier = (userTier || 'free').toLowerCase();
        if (currentTier === 'free') {
            alert("Auto-reply is not available on the Free plan. Upgrade to Go or Pro to use AI auto-replies.");
        } else {
            openInstructionsModal();
        }
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

// ========== FOLLOW‑UP & HINT DROPDOWN ==========
function toggleFollowUpMenu(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('followUpDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('show');
    if (isOpen) {
        const submenu = document.getElementById('followUpSubmenu');
        if (submenu) submenu.style.display = 'none';
    }
    dropdown.classList.toggle('show');
    if (!isOpen && currentLeadId) {
        loadFollowUpStatus();
    }
}

function toggleFollowUpSubmenu(event) {
    if (event) event.stopPropagation();
    const submenu = document.getElementById('followUpSubmenu');
    if (!submenu) return;
    submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
}

function toggleHintMenu() {
    toggleFollowUpMenu();
}

// ========== FOLLOW‑UP UI FUNCTIONS ==========
async function loadFollowUpStatus() {
    if (!currentLeadId) return;
    try {
        const status = await getFollowUpStatus(currentLeadId);
        autoFollowUpEnabled = status.autoFollowUpEnabled;
        updateAutoFollowUpUI();
    } catch (err) {
        console.error('Failed to load follow-up status:', err);
        autoFollowUpEnabled = false;
        updateAutoFollowUpUI();
    }
}

function updateAutoFollowUpUI() {
    const btn = document.getElementById('autoFollowUpBtn');
    const statusSpan = document.getElementById('autoFollowUpStatus');
    if (!btn) return;
    if (autoFollowUpEnabled) {
        btn.classList.add('active');
        statusSpan.textContent = 'ON';
        statusSpan.style.color = '#66dd99';
    } else {
        btn.classList.remove('active');
        statusSpan.textContent = 'OFF';
        statusSpan.style.color = '#ff5555';
    }
}

async function suggestFollowUp() {
    if (!currentLeadId) {
        alert("Open a chat first to get a follow-up suggestion.");
        return;
    }
    const btn = document.querySelector('.follow-up-option[onclick="suggestFollowUp()"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<svg class="spin-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Generating...`;
        btn.disabled = true;
    }
    try {
        const result = await window.suggestFollowUp(currentLeadId);
        if (result.success && result.suggestion) {
            const textArea = document.getElementById('replyText');
            textArea.value = result.suggestion;
            autoResize(textArea);
            textArea.focus();
        } else {
            alert(result.message || "Failed to generate follow-up suggestion.");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error. Please try again.");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function toggleAutoFollowUp() {
    if (!currentLeadId) return;
    const newState = !autoFollowUpEnabled;
    try {
        const result = await window.toggleAutoFollowUp(currentLeadId, newState);
        if (result.success) {
            autoFollowUpEnabled = result.autoFollowUpEnabled;
            updateAutoFollowUpUI();
            const msg = autoFollowUpEnabled ?
                `Auto follow-up enabled. First follow-up scheduled in 3 days.` :
                `Auto follow-up disabled.`;
            alert(msg);
        } else {
            alert(result.message || "Failed to toggle auto follow-up.");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error. Please try again.");
    }
}

// ========== HINT FUNCTION ==========
async function triggerHint() {
    if (isAutoReplyEnabled) return;
    const dropdown = document.getElementById('followUpDropdown');
    if (dropdown) dropdown.classList.remove('show');
    const submenu = document.getElementById('followUpSubmenu');
    if (submenu) submenu.style.display = 'none';
    if (!currentLeadId) {
        alert("Open a chat first to get a hint.");
        return;
    }
    console.log(`💡 [triggerHint] Requesting hint for lead ${currentLeadId}`);
    const btn = document.getElementById('hintMenuBtn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
    try {
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ messages: messages.slice(-3) })
        });
        const suggestData = await suggestRes.json();

        if (!suggestRes.ok) {
            if (suggestRes.status === 403) {
                const currentTier = (userTier || 'free').toLowerCase();
                if (currentTier === 'free') {
                    alert("You have reached your daily hint limit (3/3). Upgrade to Go for more hints.");
                } else if (currentTier === 'go') {
                    alert("You have reached your daily hint limit (20/20). Upgrade to Pro for unlimited hints.");
                } else {
                    alert("An unexpected error occurred. Please try again later.");
                }
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
            console.log('✅ [triggerHint] Hint applied');
        } else {
            console.warn('⚠️ [triggerHint] No suggestion returned');
        }
    } catch (error) {
        console.error('❌ [triggerHint] Error:', error);
        alert("Failed to get hint.");
    } finally {
        btn.innerHTML = originalContent;
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.querySelector('.hint-menu-wrap');
    const dropdown = document.getElementById('followUpDropdown');
    if (menu && !menu.contains(event.target) && dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        const submenu = document.getElementById('followUpSubmenu');
        if (submenu) submenu.style.display = 'none';
    }
});

// ========== REVENUE TRACKING UI ==========
let revenueModal = null;
let revenueContent = null;

function openRevenueTracking() {
    if (!revenueModal) {
        revenueModal = document.getElementById('revenueModal');
        revenueContent = document.getElementById('revenueContent');
        const closeBtn = document.getElementById('closeRevenueModalBtn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                revenueModal.classList.remove('active');
            };
        }
        if (revenueModal) {
            revenueModal.addEventListener('click', (e) => {
                if (e.target === revenueModal) revenueModal.classList.remove('active');
            });
        }
    }
    if (!revenueModal) return;
    revenueModal.classList.add('active');
    revenueContent.innerHTML = '<div style="text-align: center; padding: 30px;"><div class="spin-icon" style="display: inline-block;">↻</div> Loading revenue data...</div>';
    
    fetchRevenueTracking()
        .then(data => {
            renderRevenueData(data);
        })
        .catch(err => {
            revenueContent.innerHTML = `<div style="color: var(--red); text-align: center; padding: 20px;">❌ ${err.message}</div>`;
        });
}

function renderRevenueData(data) {
    if (!revenueContent) return;
    const tier = data.tier || userTier;
    const categories = data.categories || {};
    const advice = data.advice || {};
    const actions = data.actions || [];
    
    let html = '';
    
    const order = ['contacted', 'replied', 'interested', 'ongoing', 'win'];
    const labels = {
        contacted: 'Customers Contacted',
        replied: 'Customers Replied',
        interested: 'Interested Customers',
        ongoing: 'Ongoing Conversation',
        win: 'Win Conversation'
    };
    
    for (const key of order) {
        const leads = categories[key] || [];
        const count = leads.length;
        html += `
            <div class="revenue-category">
                <div class="revenue-category-header">
                    <span class="revenue-category-title">${labels[key]}</span>
                    <span class="revenue-category-count">${count}</span>
                </div>
                <div class="revenue-lead-list">
                    ${leads.map(lead => `<span class="revenue-lead-name" data-lead-id="${lead.id}" data-lead-name="${escapeHtml(lead.name)}">${escapeHtml(lead.name)}</span>`).join('')}
                    ${count === 0 ? '<span style="color: var(--text-3); font-size: 11px;">—</span>' : ''}
                </div>
            </div>
        `;
    }
    
    if (tier === 'go' || tier === 'pro') {
        let adviceHtml = '';
        for (const key of order) {
            const adviceKey = key + 'Advice';
            const adviceText = advice[adviceKey];
            if (adviceText && categories[key] && categories[key].length > 0) {
                adviceHtml += `<div class="revenue-advice"><strong>${labels[key]}:</strong><br>${escapeHtml(adviceText)}</div>`;
            }
        }
        if (adviceHtml) {
            html += `<div style="margin: 16px 0 8px;"><strong>🤖 AI Advice</strong></div>${adviceHtml}`;
        } else {
            html += `<div class="revenue-advice">No specific advice available for your current leads.</div>`;
        }
    }
    
    if (tier === 'pro' && actions && actions.length > 0) {
        html += `<div style="margin: 20px 0 8px;"><strong>⚡ AI Actions (Top ${actions.length})</strong></div>`;
        html += `<div class="revenue-actions">`;
        actions.forEach(action => {
            html += `
                <div class="revenue-action-item">
                    <div class="revenue-action-lead">${escapeHtml(action.leadName || 'Lead')}</div>
                    <div class="revenue-action-text">▶ ${escapeHtml(action.action)}</div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    if (tier === 'free') {
        html += `
            <div class="upgrade-message">
                <span>✨ Unlock AI Advice – Upgrade to Go or Pro</span>
                <div><button class="upgrade-button" id="upgradeAdviceBtn">View Plans</button></div>
            </div>
        `;
    } else if (tier === 'go') {
        html += `
            <div class="upgrade-message">
                <span>🚀 Unlock AI Actions – Upgrade to Pro</span>
                <div><button class="upgrade-button" id="upgradeActionsBtn">View Plans</button></div>
            </div>
        `;
    }
    
    revenueContent.innerHTML = html;
    
    document.querySelectorAll('.revenue-lead-name').forEach(el => {
        el.addEventListener('click', () => {
            const leadId = el.getAttribute('data-lead-id');
            const leadName = el.getAttribute('data-lead-name');
            const contact = allContacts.find(c => c.id === leadId);
            if (contact && typeof openChat === 'function') {
                closeRevenueModal();
                openChat(leadId, contact.name, contact.email);
            } else {
                alert(`Open chat for ${leadName} not available`);
            }
        });
    });
    
    const upgradeAdvice = document.getElementById('upgradeAdviceBtn');
    if (upgradeAdvice) {
        upgradeAdvice.onclick = () => {
            alert('Upgrade to Go or Pro plan to unlock AI Advice.\n\nGo: 30 suggest-follow-up/day, 15 auto-follow-up/day\nPro: 200 suggest-follow-up/day, 100 auto-follow-up/day');
        };
    }
    const upgradeActions = document.getElementById('upgradeActionsBtn');
    if (upgradeActions) {
        upgradeActions.onclick = () => {
            alert('Upgrade to Pro plan to unlock AI Actions.\n\nPro gives you specific actions for your top 20 most promising leads.');
        };
    }
}

function closeRevenueModal() {
    if (revenueModal) revenueModal.classList.remove('active');
}

// ========== ADDED: AUTO-REFRESH FOR LIVE UPDATES ==========
let refreshInterval = null;

/**
 * Start auto-refreshing the contact list to pick up new messages.
 * Call this from page.html after initial load, e.g. startAutoRefresh(15);
 * @param {number} intervalSeconds - How often to refresh (default 15)
 */
function startAutoRefresh(intervalSeconds = 15) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        // Only refresh if page is visible to save resources
        if (document.visibilityState === 'visible') {
            loadContacts();
        }
    }, intervalSeconds * 1000);
    console.log(`🔄 [startAutoRefresh] Auto-refresh started (every ${intervalSeconds}s)`);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('🔄 [stopAutoRefresh] Auto-refresh stopped');
    }
            }

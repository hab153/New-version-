// notif-ui.js

// ========== GLOBAL UI STATE ==========
// ✅ REMOVED duplicate declaration - allContacts is already in notif-api.js
let userTier = 'free';
let autoFollowUpEnabled = false;
let refreshInterval = null;
let selectedDelayDays = 3;

// ========== UI FUNCTIONS ==========

/**
 * Handle keyboard events for the reply textarea
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = document.getElementById('replyText')?.value?.trim();
        if (text && typeof sendReply === 'function') {
            sendReply(text);
        }
    }
}

/**
 * Switch between tabs (Leads / Team)
 * @param {string} tab - Tab name ('leads' or 'team')
 * @param {HTMLElement} btn - The clicked button
 */
function switchTab(tab, btn) {
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (tab === 'leads') {
        const viewList = document.getElementById('viewList');
        const viewAdmin = document.getElementById('viewAdmin');
        if (viewList) viewList.classList.remove('hidden');
        if (viewAdmin) viewAdmin.classList.remove('active');
        if (typeof closeChat === 'function') closeChat();
    } else {
        const viewList = document.getElementById('viewList');
        const viewAdmin = document.getElementById('viewAdmin');
        if (viewList) viewList.classList.add('hidden');
        if (viewAdmin) viewAdmin.classList.add('active');
        if (typeof closeChat === 'function') closeChat();
    }
}

/**
 * Update stats in the stats row
 * @param {Array} contacts - Array of contact objects
 */
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
    
    const statTotal = document.getElementById('statTotal');
    const statUnread = document.getElementById('statUnread');
    const statHigh = document.getElementById('statHigh');
    const statMed = document.getElementById('statMed');
    const badge = document.getElementById('leadsTabBadge');
    
    if (statTotal) statTotal.textContent = total;
    if (statUnread) statUnread.textContent = unread;
    if (statHigh) statHigh.textContent = high;
    if (statMed) statMed.textContent = med;
    
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Render contacts in the contact list
 * @param {Array} contacts - Array of contact objects
 */
function renderContacts(contacts) {
    const list = document.getElementById('contactList');
    if (!list) return;
    
    if (!contacts || contacts.length === 0) {
        list.innerHTML = '<div style="padding:36px 20px; text-align:center; color:var(--text-3); font-family:var(--font-mono); font-size:11px; letter-spacing:0.06em;">📭 NO CONVERSATIONS YET</div>';
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
        
        let safeId = '';
        if (c.id) {
            if (typeof c.id === 'object') {
                safeId = c.id._id || c.id.id || c.id.toString();
            } else {
                safeId = String(c.id);
            }
        }
        if (!safeId && c._id) {
            safeId = String(c._id);
        }
        safeId = safeId.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
        
        const safeName = escapeHtml(c.name || 'Unknown');
        const safeEmail = escapeHtml(c.email || '');
        const safeCompany = escapeHtml(c.company || '');
        const safeLastMsg = escapeHtml(c.lastMessage || 'No messages yet');
        const safeTier = escapeHtml(rating.tier);
        const unreadDot = unread > 0 ? `<span class="unread-dot"></span>` : '';
        const nameStyle = unread > 0 ? 'font-weight:700;' : 'font-weight:400;';
        
        return `
            <div class="contact-item ${unread > 0 ? 'unread' : ''}" onclick="if (typeof openChat === 'function') openChat('${safeId}', '${safeName}', '${safeEmail}')">
                <div class="contact-avatar">${getInitials(c.name)}</div>
                <div class="contact-body">
                    <div class="contact-row1">
                        <span class="contact-name" style="${nameStyle}">${safeName}${unreadDot}</span>
                        <span class="contact-time">${c.lastDate ? new Date(c.lastDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}</span>
                    </div>
                    <div class="contact-row2">
                        <span class="contact-preview">${safeLastMsg}</span>
                        <div class="contact-meta">
                            ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
                            <span class="conf-badge ${confClass}">${rating.score} <span style="opacity:0.7;font-weight:400;">${safeTier}</span></span>
                            ${c.company ? `<span class="company-tag">${safeCompany}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filter contacts by search query
 * @param {string} query - Search query
 */
function filterContacts(query) {
    if (!query.trim()) { renderContacts(allContacts); return; }
    const q = query.toLowerCase();
    renderContacts(allContacts.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    ));
}

/**
 * Open a chat with a lead
 * @param {string} leadId - Lead ID
 * @param {string} name - Lead name
 * @param {string} email - Lead email
 */
async function openChat(leadId, name, email) {
    if (!leadId || leadId === 'undefined' || leadId === 'null' || leadId === '[object Object]') {
        console.error('❌ [openChat] Invalid leadId:', leadId);
        alert('⚠️ Invalid conversation. Please refresh the page.');
        return;
    }
    
    const cleanId = String(leadId).trim();
    console.log(`💬 [openChat] Opening chat with ${name} (${cleanId})`);
    
    // ✅ FIX: Set the bare variable that sendReply() reads
    currentLeadId = cleanId;
    
    window.currentLeadId = cleanId;
    window.currentLeadName = name;
    window.currentLeadEmail = email;
    
    // Update header
    const leadData = allContacts.find(l => String(l.id) === cleanId);
    let badgeHtml = '';
    if (leadData) {
        const rating = calculateEngagementScore(leadData, []);
        let cls = 'low';
        if (rating.score >= 75) cls = 'high';
        else if (rating.score >= 40) cls = 'med';
        badgeHtml = `<span class="conf-badge ${cls}" style="margin-left:6px;font-size:8px;">${rating.score} ${escapeHtml(rating.tier)}</span>`;
    }
    
    const chatName = document.getElementById('chatName');
    const chatEmail = document.getElementById('chatEmail');
    const chatAvatar = document.getElementById('chatAvatar');
    const replyText = document.getElementById('replyText');
    const viewChat = document.getElementById('viewChat');
    
    if (chatName) chatName.innerHTML = `${escapeHtml(name)} ${badgeHtml}`;
    if (chatEmail) chatEmail.textContent = email || 'No email';
    if (chatAvatar) chatAvatar.textContent = getInitials(name);
    if (replyText) {
        replyText.value = '';
        replyText.style.height = '38px';
    }
    if (viewChat) viewChat.classList.add('active');
    
    // Mark as read
    if (leadData && leadData.unreadCount > 0) {
        leadData.unreadCount = 0;
        updateStats(allContacts);
        renderContacts(allContacts);
        if (typeof markAsRead === 'function') markAsRead(cleanId);
    }
    
    // Show loading
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3);font-family:var(--font-mono);font-size:10px;letter-spacing:0.06em;">⏳ LOADING MESSAGES…</div>';
    }
    
    try {
        const data = await fetchConversationDetails(cleanId);
        console.log('📊 [openChat] Data received:', data);
        console.log('📊 [openChat] Messages count:', data.messages?.length || 0);
        
        const messages = data.messages || [];
        
        if (messages.length === 0) {
            if (container) {
                container.innerHTML = `<div class="empty-state"><span class="icon">💬</span><h3>No messages yet</h3><p>Send the first message to start the conversation.</p></div>`;
            }
            return;
        }
        
        // Display all messages
        let messagesHtml = '';
        messages.forEach(msg => {
            const isLead = msg.from === 'lead';
            const fromClass = isLead ? 'lead' : 'ai';
            const groupClass = isLead ? 'from-lead' : 'from-ai';
            const safeContent = escapeHtml(msg.content || '');
            const safeTime = msg.date ? new Date(msg.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            const safeSubject = msg.subject ? escapeHtml(msg.subject) : '';
            
            messagesHtml += `
                <div class="msg-group ${groupClass}">
                    <div class="message-bubble ${fromClass}">
                        ${safeContent}
                        ${safeSubject ? `<div style="font-size:10px;color:var(--text-3);margin-top:4px;">📎 ${safeSubject}</div>` : ''}
                        <div class="message-time">${safeTime}</div>
                    </div>
                </div>
            `;
        });
        
        if (container) {
            container.innerHTML = messagesHtml;
            container.scrollTop = container.scrollHeight;
        }
        
        console.log('✅ [openChat] Displayed', messages.length, 'messages');
        
        // Load follow-up status and auto-reply settings
        if (typeof isAutoReplyEnabled !== 'undefined') {
            isAutoReplyEnabled = data.lead?.autoReplyEnabled || false;
        }
        if (typeof autoReplyInstructions !== 'undefined') {
            autoReplyInstructions = data.lead?.autoReplyInstructions || "";
        }
        updateAutoReplyUI();
        await loadFollowUpStatus();
        
    } catch (err) {
        console.error('❌ [openChat] Error loading messages:', err);
        if (container) {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--red);font-size:12px;">⚠️ Failed to load messages: ${err.message}</div>`;
        }
    }
}

/**
 * Close the chat view
 */
function closeChat() {
    const viewChat = document.getElementById('viewChat');
    if (viewChat) viewChat.classList.remove('active');
    currentLeadId = null;
    window.currentLeadId = null;
}

// ========== AUTO-REPLY FUNCTIONS ==========

/**
 * Toggle auto-reply on/off
 */
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

/**
 * Open the instructions modal
 */
function openInstructionsModal() {
    const instructionsText = document.getElementById('instructionsText');
    const modal = document.getElementById('instructionsModal');
    if (instructionsText) instructionsText.value = autoReplyInstructions;
    if (modal) modal.classList.add('active');
}

/**
 * Close the instructions modal
 */
function closeInstructionsModal() {
    const modal = document.getElementById('instructionsModal');
    if (modal) modal.classList.remove('active');
    updateAutoReplyUI();
}

/**
 * Handle saving instructions
 */
async function handleSaveInstructions() {
    const instructions = document.getElementById('instructionsText')?.value?.trim();
    if (!instructions) { alert("Please enter AI instructions."); return; }
    const success = await saveAutoReplyInstructions(instructions);
    if (success) closeInstructionsModal();
}

/**
 * Update the auto-reply UI
 */
function updateAutoReplyUI() {
    const toggle = document.getElementById('aiToggle');
    const inputArea = document.getElementById('replyInputArea');
    if (isAutoReplyEnabled) {
        if (toggle) toggle.classList.add('active');
        if (inputArea) inputArea.classList.add('hidden');
    } else {
        if (toggle) toggle.classList.remove('active');
        if (inputArea) inputArea.classList.remove('hidden');
    }
}

// ========== FOLLOW-UP FUNCTIONS ==========

/**
 * Load follow-up status for the current lead
 */
async function loadFollowUpStatus() {
    if (!currentLeadId) return;
    try {
        const status = await getFollowUpStatus(currentLeadId);
        autoFollowUpEnabled = status.autoFollowUpEnabled || false;
        updateAutoFollowUpUI();
    } catch (err) {
        console.error('Failed to load follow-up status:', err);
        autoFollowUpEnabled = false;
        updateAutoFollowUpUI();
    }
}

/**
 * Update auto follow-up UI
 */
function updateAutoFollowUpUI() {
    const statusSpan = document.getElementById('autoStatusSpan');
    if (!statusSpan) return;
    if (autoFollowUpEnabled) {
        statusSpan.textContent = 'ON';
        statusSpan.style.color = '#66dd99';
    } else {
        statusSpan.textContent = 'OFF';
        statusSpan.style.color = '#ff5555';
    }
}

/**
 * Suggest a follow-up message
 */
async function suggestFollowUpAction() {
    if (isAutoReplyEnabled) {
        alert("Please turn off Auto‑Reply to use Suggest Follow‑up.");
        return;
    }
    if (!currentLeadId) {
        alert('Open a chat first.');
        return;
    }
    const btn = document.getElementById('suggestFollowUpBtn');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<svg class="spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Generating...`;
        btn.disabled = true;
    }
    try {
        const result = await window.suggestFollowUp(currentLeadId);
        if (result.success && result.suggestion) {
            const textArea = document.getElementById('replyText');
            if (textArea) {
                textArea.value = result.suggestion;
                autoResize(textArea);
                textArea.focus();
            }
        } else {
            alert(result.message || 'Failed to generate follow-up suggestion.');
        }
    } catch (err) {
        console.error(err);
        alert('Connection error.');
    } finally {
        if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
}

// ========== AI HINT FUNCTIONS ==========

/**
 * Trigger AI hint
 */
async function triggerHint() {
    if (isAutoReplyEnabled) {
        alert("Please turn off Auto‑Reply to use AI Hint.");
        return;
    }
    if (!currentLeadId) {
        alert("Open a chat first to get a hint.");
        return;
    }
    const btn = document.getElementById('aiHintBtn');
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Loading...`;
        btn.disabled = true;
    }
    try {
        const convRes = await fetch(`${BACKEND}/api/conversations/${currentLeadId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!convRes.ok) throw new Error('Failed to fetch conversation');
        const convData = await convRes.json();
        const messages = convData.messages || [];
        if (messages.length === 0) { alert("No messages to base a hint on."); return; }
        const hintRes = await fetch(`${BACKEND}/api/ai/suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ messages: messages.slice(-3) })
        });
        const hintData = await hintRes.json();
        if (!hintRes.ok) {
            if (hintRes.status === 403) {
                alert(hintData.message || "Hint limit reached.");
            } else {
                alert(hintData.error || "Failed to get hint.");
            }
            return;
        }
        if (hintData.suggestion) {
            const textArea = document.getElementById('replyText');
            if (textArea) {
                textArea.value = hintData.suggestion;
                autoResize(textArea);
                textArea.focus();
            }
        } else {
            alert("No suggestion returned.");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error.");
    } finally {
        if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
}

// ========== REVENUE TRACKING ==========

/**
 * Open revenue tracking modal
 */
function openRevenueTracking() {
    const modal = document.getElementById('revenueModal');
    const content = document.getElementById('revenueContent');
    if (!modal || !content) return;
    modal.classList.add('active');
    content.innerHTML = '<div style="text-align:center;padding:30px;"><div class="spin-icon" style="display:inline-block;">↻</div> Loading revenue data...</div>';
    fetchRevenueTracking()
        .then(data => renderRevenueData(data))
        .catch(err => {
            content.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px;">❌ ${err.message}</div>`;
        });
}

/**
 * Render revenue data
 * @param {Object} data - Revenue data from API
 */
function renderRevenueData(data) {
    const content = document.getElementById('revenueContent');
    if (!content) return;
    
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
                    ${leads.map(l => `<span class="revenue-lead-name" data-lead-id="${l.id}" data-lead-name="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>`).join('')}
                    ${count === 0 ? '<span style="color:var(--text-3);font-size:11px;">—</span>' : ''}
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
        html += adviceHtml ? `<div style="margin:16px 0 8px;"><strong>🤖 AI Advice</strong></div>${adviceHtml}` : `<div class="revenue-advice">No specific advice available.</div>`;
    }
    
    if (tier === 'pro' && actions && actions.length > 0) {
        html += `<div style="margin:20px 0 8px;"><strong>⚡ AI Actions (Top ${actions.length})</strong></div><div class="revenue-actions">`;
        actions.forEach(a => {
            html += `<div class="revenue-action-item"><div class="revenue-action-lead">${escapeHtml(a.leadName || 'Lead')}</div><div class="revenue-action-text">▶ ${escapeHtml(a.action)}</div></div>`;
        });
        html += `</div>`;
    }
    
    if (tier === 'free') {
        html += `<div class="upgrade-message"><span>✨ Unlock AI Advice – Upgrade to Go or Pro</span><div><button class="upgrade-button" onclick="alert('Upgrade to Go or Pro plan to unlock AI Advice.')">View Plans</button></div></div>`;
    } else if (tier === 'go') {
        html += `<div class="upgrade-message"><span>🚀 Unlock AI Actions – Upgrade to Pro</span><div><button class="upgrade-button" onclick="alert('Upgrade to Pro plan to unlock AI Actions.')">View Plans</button></div></div>`;
    }
    
    content.innerHTML = html;
    
    document.querySelectorAll('.revenue-lead-name').forEach(el => {
        el.onclick = () => {
            const leadId = el.getAttribute('data-lead-id');
            const leadName = el.getAttribute('data-lead-name');
            const contact = allContacts.find(c => c.id === leadId);
            if (contact && typeof openChat === 'function') {
                const modal = document.getElementById('revenueModal');
                if (modal) modal.classList.remove('active');
                openChat(leadId, contact.name, contact.email);
            } else {
                alert(`Open chat for ${leadName} not available`);
            }
        };
    });
}

// ========== MENU DROPDOWN ==========

/**
 * Initialize menu dropdowns and event listeners
 */
function initMenuDropdowns() {
    const menuBtn = document.getElementById('menuBtn');
    const dropdown = document.getElementById('menuDropdown');
    const followUpMain = document.getElementById('followUpMainBtn');
    const submenu = document.getElementById('followUpSubmenu');
    const autoFollowUpBtn = document.getElementById('autoFollowUpBtn');
    
    if (menuBtn && dropdown) {
        menuBtn.onclick = function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };
    }
    
    if (followUpMain && submenu) {
        followUpMain.onclick = function(e) {
            e.stopPropagation();
            submenu.classList.toggle('show');
        };
    }
    
    const aiHintBtn = document.getElementById('aiHintBtn');
    if (aiHintBtn) {
        aiHintBtn.onclick = function(e) {
            e.stopPropagation();
            if (dropdown) dropdown.classList.remove('show');
            if (submenu) submenu.classList.remove('show');
            triggerHint();
        };
    }
    
    const suggestFollowUpBtn = document.getElementById('suggestFollowUpBtn');
    if (suggestFollowUpBtn) {
        suggestFollowUpBtn.onclick = function(e) {
            e.stopPropagation();
            if (dropdown) dropdown.classList.remove('show');
            if (submenu) submenu.classList.remove('show');
            suggestFollowUpAction();
        };
    }
    
    if (autoFollowUpBtn) {
        autoFollowUpBtn.onclick = function(e) {
            e.stopPropagation();
            if (isAutoReplyEnabled) {
                alert("Please turn off Auto‑Reply to use Auto Follow‑up.");
                return;
            }
            if (!currentLeadId) { alert('Open a chat first.'); return; }
            openAutoFollowUpModal();
        };
    }
    
    const revenueBtn = document.getElementById('revenueTrackingBtn');
    if (revenueBtn) {
        revenueBtn.onclick = function(e) {
            e.stopPropagation();
            if (dropdown) dropdown.classList.remove('show');
            openRevenueTracking();
        };
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (menuBtn && dropdown && !menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
        if (submenu && followUpMain && !followUpMain.contains(e.target) && !submenu.contains(e.target)) {
            submenu.classList.remove('show');
        }
    });
}

// ========== AUTO FOLLOW-UP MODAL ==========

function openAutoFollowUpModal() {
    loadFollowUpStatus().then(() => {
        selectedDelayDays = 3;
        updateModalUI();
        const modal = document.getElementById('autoFollowUpModal');
        if (modal) modal.classList.add('active');
    });
}

function closeAutoFollowUpModal() {
    const modal = document.getElementById('autoFollowUpModal');
    if (modal) modal.classList.remove('active');
}

function updateModalUI() {
    document.querySelectorAll('.delay-day-btn').forEach(btn => {
        const days = parseInt(btn.getAttribute('data-days'));
        btn.classList.toggle('selected', days === selectedDelayDays);
    });
    const confirmBtn = document.getElementById('confirmAutoFollowUpBtn');
    if (confirmBtn) {
        confirmBtn.textContent = `Enable (${selectedDelayDays} day${selectedDelayDays !== 1 ? 's' : ''})`;
        confirmBtn.disabled = false;
    }
}

/**
 * Initialize auto follow-up modal events
 */
function initAutoFollowUpModal() {
    document.querySelectorAll('.delay-day-btn').forEach(btn => {
        btn.onclick = () => {
            selectedDelayDays = parseInt(btn.getAttribute('data-days'));
            updateModalUI();
        };
    });
    
    const applyCustom = document.getElementById('applyCustomDelay');
    if (applyCustom) {
        applyCustom.onclick = () => {
            const val = parseInt(document.getElementById('customDelayDays')?.value);
            if (isNaN(val) || val < 1) { alert('Please enter a valid number of days (at least 1).'); return; }
            selectedDelayDays = val;
            updateModalUI();
        };
    }
    
    const confirmBtn = document.getElementById('confirmAutoFollowUpBtn');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            closeAutoFollowUpModal();
            if (!currentLeadId) { alert('Open a chat first.'); return; }
            try {
                const res = await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-follow-up`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: true, delayDays: selectedDelayDays })
                });
                const data = await res.json();
                if (data.success) {
                    autoFollowUpEnabled = true;
                    updateAutoFollowUpUI();
                    alert(data.message || `Auto follow-up enabled. First follow-up in ${selectedDelayDays} day(s).`);
                } else {
                    alert(data.message || 'Failed to enable auto follow-up.');
                }
            } catch (err) {
                console.error(err);
                alert('Connection error.');
            }
        };
    }
    
    const offBtn = document.getElementById('offFollowUpBtn');
    if (offBtn) {
        offBtn.onclick = async () => {
            closeAutoFollowUpModal();
            if (!currentLeadId) { alert('Open a chat first.'); return; }
            try {
                const res = await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-follow-up`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: false })
                });
                const data = await res.json();
                if (data.success) {
                    autoFollowUpEnabled = false;
                    updateAutoFollowUpUI();
                    alert('Auto follow-up disabled.');
                } else {
                    alert(data.message || 'Failed to disable auto follow-up.');
                }
            } catch (err) {
                console.error(err);
                alert('Connection error.');
            }
        };
    }
    
    const closeBtn = document.getElementById('closeAutoFollowUpModalBtn');
    if (closeBtn) closeBtn.onclick = closeAutoFollowUpModal;
    const cancelBtn = document.getElementById('cancelAutoFollowUpBtn');
    if (cancelBtn) cancelBtn.onclick = closeAutoFollowUpModal;
    
    // Close modal on outside click
    const modal = document.getElementById('autoFollowUpModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
}

// ========== REVENUE MODAL ==========

function initRevenueModal() {
    const closeBtn = document.getElementById('closeRevenueModalBtn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('revenueModal');
            if (modal) modal.classList.remove('active');
        };
    }
    const modal = document.getElementById('revenueModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
}

// ========== AUTO-REFRESH ==========

/**
 * Start auto-refreshing the contact list
 * @param {number} intervalSeconds - Interval in seconds
 */
function startAutoRefresh(intervalSeconds = 15) {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && typeof loadContacts === 'function') {
            loadContacts();
        }
    }, intervalSeconds * 1000);
    console.log(`🔄 [startAutoRefresh] Auto-refresh started (every ${intervalSeconds}s)`);
}

/**
 * Stop auto-refreshing
 */
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('🔄 [stopAutoRefresh] Auto-refresh stopped');
    }
}

// ========== DOM CONTENT LOADED ==========

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }
    
    // Fetch user plan
    fetch(`${BACKEND}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(res => res.json())
        .then(user => {
            userTier = user.subscriptionTier || 'free';
        })
        .catch(e => console.error(e));
    
    // Initialize UI components
    initMenuDropdowns();
    initAutoFollowUpModal();
    initRevenueModal();
    
    // Load contacts
    loadContacts();
    
    // Start auto-refresh
    startAutoRefresh(15);
});

// ========== EXPOSE GLOBALLY ==========

window.allContacts = allContacts;
window.userTier = userTier;
window.autoFollowUpEnabled = autoFollowUpEnabled;
window.handleKey = handleKey;
window.switchTab = switchTab;
window.updateStats = updateStats;
window.renderContacts = renderContacts;
window.filterContacts = filterContacts;
window.openChat = openChat;
window.closeChat = closeChat;
window.toggleAutoReply = toggleAutoReply;
window.openInstructionsModal = openInstructionsModal;
window.closeInstructionsModal = closeInstructionsModal;
window.handleSaveInstructions = handleSaveInstructions;
window.updateAutoReplyUI = updateAutoReplyUI;
window.loadFollowUpStatus = loadFollowUpStatus;
window.updateAutoFollowUpUI = updateAutoFollowUpUI;
window.suggestFollowUpAction = suggestFollowUpAction;
window.triggerHint = triggerHint;
window.openRevenueTracking = openRevenueTracking;
window.renderRevenueData = renderRevenueData;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;

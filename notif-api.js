// notif-api.js

// ========== CONFIG ==========
const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

console.log('🔑 [FRONTEND] Token from localStorage:', token ? 'exists' : 'MISSING');

// ========== GLOBAL STATE ==========
let currentLeadId = null;
let isAutoReplyEnabled = false;
let autoReplyInstructions = "";
let allContacts = [];

// ========== API FUNCTIONS ==========

/**
 * Load all contacts/conversations for the authenticated user
 * @returns {Promise<Array>} - Array of contact objects
 */
async function loadContacts() {
    console.log('📡 [loadContacts] Fetching /api/conversations...');
    try {
        const res = await fetch(`${BACKEND}/api/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`📡 [loadContacts] Response status: ${res.status}`);
        if (!res.ok) {
            const text = await res.text();
            console.error(`❌ [loadContacts] HTTP ${res.status} - body:`, text);
            throw new Error(`HTTP ${res.status}`);
        }
        const contacts = await res.json();
        console.log(`✅ [loadContacts] Received ${contacts.length} contacts`);
        allContacts = contacts;
        if (typeof updateStats === 'function') {
            updateStats(contacts);
        }
        if (typeof renderContacts === 'function') {
            renderContacts(contacts);
        }

        // If current chat is open, refresh it to show new replies
        if (currentLeadId && document.getElementById('viewChat')?.classList.contains('active')) {
            const currentLead = allContacts.find(c => String(c.id) === String(currentLeadId));
            if (currentLead && typeof openChat === 'function') {
                console.log('🔄 [loadContacts] Refreshing current chat:', currentLead.name);
                await openChat(currentLeadId, currentLead.name, currentLead.email);
            }
        }

        return contacts;
    } catch (err) {
        console.error('❌ [loadContacts] Error:', err);
        const list = document.getElementById('contactList');
        if (list) {
            list.innerHTML = '<div style="padding:28px; text-align:center; color:var(--text-3); font-family:var(--font-mono); font-size:11px;">⚠️ FAILED TO LOAD · REFRESH TO RETRY</div>';
        }
        return [];
    }
}

/**
 * Send a reply email to a lead
 * @param {string} text - The reply message text
 * @returns {Promise<Object>} - Response data
 */
async function sendReply(text) {
    if (!text || !currentLeadId) {
        console.log('⚠️ [sendReply] No text or leadId');
        return;
    }

    const btn = document.getElementById('sendBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
    }

    const leadData = allContacts.find(c => String(c.id) === String(currentLeadId));
    const leadName = window.currentLeadName || leadData?.name || 'Lead';
    const leadEmail = window.currentLeadEmail || leadData?.email || '';
    const leadCompany = leadData?.company || '';

    if (!leadEmail || !leadEmail.includes('@')) {
        alert('⚠️ This lead does not have a valid email address. Cannot send reply.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        return;
    }

    const payload = {
        leadId: currentLeadId,
        leads: [{
            name: leadName || 'Lead',
            email: leadEmail,
            company: leadCompany || '',
            messages: [{
                subject: "Re: Conversation",
                body: text
            }]
        }]
    };

    console.log('📤 [sendReply] Sending payload with leadId:', payload);

    try {
        const res = await fetch(`${BACKEND}/api/leads/batch-send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('📥 [sendReply] Response:', data);

        if (res.status === 400) {
            let errorMsg = 'Validation failed';
            if (data.errors && Array.isArray(data.errors)) {
                errorMsg = data.errors.map(e => e.message).join(', ');
            } else if (data.message) {
                errorMsg = data.message;
            } else if (data.error) {
                errorMsg = data.error;
            }
            alert(`❌ ${errorMsg}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            }
            return;
        }

        if (res.status === 401 || data.error === 'NYLAS_DISCONNECTED') {
            localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
            alert("⚠️ Email session expired. Please reconnect.");
            window.location.href = 'dashboard.html?connect=true';
            return;
        }

        if (data.success) {
            // Clear input
            const replyText = document.getElementById('replyText');
            if (replyText) {
                replyText.value = '';
                replyText.style.height = '38px';
            }

            // Add message to UI immediately
            const container = document.getElementById('messagesContainer');
            if (container) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'msg-group from-ai';
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                msgDiv.innerHTML = `
                    <div class="message-bubble ai">
                        ${escapeHtml(text)}
                        <div class="message-time">${time} (Sent)</div>
                    </div>
                `;
                container.appendChild(msgDiv);
                container.scrollTop = container.scrollHeight;
            }

            // Reload contacts and refresh the chat view
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadContacts();
            
            // Reopen the chat to show updated conversation
            if (typeof openChat === 'function') {
                await openChat(currentLeadId, window.currentLeadName, window.currentLeadEmail);
            }
            
            console.log('✅ [sendReply] Message sent and chat refreshed');
        } else {
            const errorMsg = data.message || data.error || JSON.stringify(data.errors) || 'Unknown error';
            alert(`❌ Failed to send: ${errorMsg}`);
        }
    } catch (err) {
        console.error('❌ [sendReply] Error:', err);
        localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
        alert("⚠️ Connection error. Please try again.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
    }
}

/**
 * Save auto-reply instructions for a lead
 * @param {string} instructions - The AI instructions
 * @returns {Promise<boolean>} - Success status
 */
async function saveAutoReplyInstructions(instructions) {
    if (!instructions) { alert("Please enter AI instructions."); return false; }
    console.log(`💾 [saveAutoReplyInstructions] Saving instructions for lead ${currentLeadId}`);
    try {
        const res = await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-reply`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ enabled: true, instructions })
        });
        if (res.ok) {
            isAutoReplyEnabled = true;
            autoReplyInstructions = instructions;
            if (typeof updateAutoReplyUI === 'function') {
                updateAutoReplyUI();
            }
            console.log('✅ [saveAutoReplyInstructions] Success');
            return true;
        } else {
            alert("Failed to save.");
            return false;
        }
    } catch (err) {
        console.error('❌ [saveAutoReplyInstructions] Error:', err);
        alert("Connection error.");
        return false;
    }
}

/**
 * Save auto-reply toggle status
 * @returns {Promise<void>}
 */
async function saveAutoReplyStatus() {
    console.log(`💾 [saveAutoReplyStatus] Updating auto-reply status for lead ${currentLeadId} to ${isAutoReplyEnabled}`);
    try {
        await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-reply`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ enabled: isAutoReplyEnabled })
        });
        if (typeof updateAutoReplyUI === 'function') {
            updateAutoReplyUI();
        }
    } catch (err) {
        console.error('❌ [saveAutoReplyStatus] Error:', err);
    }
}

/**
 * Rename a lead/customer
 * @param {string} newName - The new name
 * @returns {Promise<void>}
 */
async function renameCustomer(newName) {
    if (newName && newName !== window.currentLeadName) {
        console.log(`✏️ [renameCustomer] Renaming lead ${currentLeadId} to ${newName}`);
        try {
            await fetch(`${BACKEND}/api/leads/${currentLeadId}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newName })
            });
            window.currentLeadName = newName;
            const chatName = document.getElementById('chatName');
            if (chatName) chatName.innerText = newName;
            const chatAvatar = document.getElementById('chatAvatar');
            if (chatAvatar) chatAvatar.innerText = getInitials(newName);
            loadContacts();
        } catch (err) {
            console.error('❌ [renameCustomer] Error:', err);
            alert("Failed to rename.");
        }
    }
}

/**
 * Fetch conversation details for a lead
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} - Conversation data
 */
async function fetchConversationDetails(leadId) {
    if (!leadId || typeof leadId !== 'string') {
        console.error('❌ [fetchConversationDetails] Invalid leadId:', leadId);
        throw new Error('Invalid conversation ID');
    }
    const cleanId = leadId.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    console.log(`📡 [fetchConversationDetails] Fetching for leadId: ${cleanId}`);
    const res = await fetch(`${BACKEND}/api/conversations/${encodeURIComponent(cleanId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
}

/**
 * Mark a conversation as read
 * @param {string} leadId - The lead ID
 * @returns {Promise<void>}
 */
async function markAsRead(leadId) {
    console.log(`👁️ [markAsRead] Marking lead ${leadId} as read`);
    try {
        await fetch(`${BACKEND}/api/conversations/${leadId}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) {
        console.error('❌ [markAsRead] Error:', err);
    }
}

// ========== FOLLOW-UP API FUNCTIONS ==========

/**
 * Suggest a follow-up message for a lead
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} - Suggestion data
 */
async function suggestFollowUp(leadId) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/suggest-follow-up`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return await res.json();
}

/**
 * Toggle auto follow-up for a lead
 * @param {string} leadId - The lead ID
 * @param {boolean} enabled - Enable or disable
 * @returns {Promise<Object>} - Response data
 */
async function toggleAutoFollowUp(leadId, enabled) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/auto-follow-up`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
    });
    return await res.json();
}

/**
 * Get follow-up status for a lead
 * @param {string} leadId - The lead ID
 * @returns {Promise<Object>} - Status data
 */
async function getFollowUpStatus(leadId) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/follow-up-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
}

// ========== REVENUE TRACKING API ==========

/**
 * Fetch revenue tracking data
 * @returns {Promise<Object>} - Revenue data
 */
async function fetchRevenueTracking() {
    const res = await fetch(`${BACKEND}/api/revenue/tracking`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to load revenue data');
    }
    return await res.json();
}

// ========== EXPOSE FUNCTIONS GLOBALLY ==========

window.loadContacts = loadContacts;
window.sendReply = sendReply;
window.saveAutoReplyInstructions = saveAutoReplyInstructions;
window.saveAutoReplyStatus = saveAutoReplyStatus;
window.renameCustomer = renameCustomer;
window.fetchConversationDetails = fetchConversationDetails;
window.markAsRead = markAsRead;
window.suggestFollowUp = suggestFollowUp;
window.toggleAutoFollowUp = toggleAutoFollowUp;
window.getFollowUpStatus = getFollowUpStatus;
window.fetchRevenueTracking = fetchRevenueTracking;
window.currentLeadId = currentLeadId;
window.isAutoReplyEnabled = isAutoReplyEnabled;
window.autoReplyInstructions = autoReplyInstructions;
window.allContacts = allContacts;
window.BACKEND = BACKEND;
window.token = token;

const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

console.log('🔑 [FRONTEND] Token from localStorage:', token ? 'exists' : 'MISSING');

// Global State for API interactions
let currentLeadId = null;
let isAutoReplyEnabled = false;
let autoReplyInstructions = "";

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
        updateStats(contacts);
        renderContacts(contacts);
        return contacts;
    } catch (err) {
        console.error('❌ [loadContacts] Error:', err);
        document.getElementById('contactList').innerHTML =
            '<div style="padding:28px; text-align:center; color:var(--text-3); font-family:var(--font-mono); font-size:11px;">FAILED TO LOAD · REFRESH TO RETRY</div>';
        return [];
    }
}

// UPDATED: sendReply – display backend error message
async function sendReply(text) {
    if (!text || !currentLeadId) return;
    console.log(`📤 [sendReply] Sending reply to lead ${currentLeadId}`);
    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    const payload = {
        leads: [{ 
            name: window.currentLeadName, 
            email: window.currentLeadEmail, 
            company: '',
            messages: [{ subject: "Re: Conversation", body: text }] 
        }]
    };
    try {
        const res = await fetch(`${BACKEND}/api/leads/batch-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log(`📤 [sendReply] Response status: ${res.status}`);
        if (res.status === 401 || data.error === 'NYLAS_DISCONNECTED') {
            localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
            alert("⚠️ Email session expired. Please reconnect.");
            window.location.href = 'dashboard.html?connect=true';
            return;
        }
        if (data.success) {
            document.getElementById('replyText').value = '';
            document.getElementById('replyText').style.height = '38px';
            openChat(currentLeadId, window.currentLeadName, window.currentLeadEmail);
        } else {
            // Use backend error message if available
            const errorMsg = data.message || data.error || JSON.stringify(data.errors);
            alert(`Failed to send: ${errorMsg}`);
        }
    } catch (err) {
        console.error('❌ [sendReply] Network error:', err);
        localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
        alert("Connection error. Message saved.");
        window.location.href = 'dashboard.html?connect=true';
    } finally {
        btn.disabled = false;
    }
}

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
            updateAutoReplyUI();
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

async function saveAutoReplyStatus() {
    console.log(`💾 [saveAutoReplyStatus] Updating auto-reply status for lead ${currentLeadId} to ${isAutoReplyEnabled}`);
    try {
        await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-reply`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ enabled: isAutoReplyEnabled })
        });
        updateAutoReplyUI();
    } catch (err) {
        console.error('❌ [saveAutoReplyStatus] Error:', err);
    }
}

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
            document.getElementById('chatName').innerText = newName;
            document.getElementById('chatAvatar').innerText = getInitials(newName);
            loadContacts();
        } catch (err) {
            console.error('❌ [renameCustomer] Error:', err);
            alert("Failed to rename.");
        }
    }
}

async function fetchConversationDetails(leadId) {
    console.log(`📡 [fetchConversationDetails] Fetching details for lead ${leadId}`);
    const res = await fetch(`${BACKEND}/api/conversations/${leadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`✅ [fetchConversationDetails] Received ${data.messages?.length || 0} messages`);
    return data;
}

async function markAsRead(leadId) {
    console.log(`👁️ [markAsRead] Marking lead ${leadId} as read`);
    fetch(`${BACKEND}/api/conversations/${leadId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    }).catch(err => console.error('❌ [markAsRead] Error:', err));
}

// ========== FOLLOW-UP API FUNCTIONS ==========

async function suggestFollowUp(leadId) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/suggest-follow-up`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return await res.json();
}

async function toggleAutoFollowUp(leadId, enabled) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/auto-follow-up`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
    });
    return await res.json();
}

async function getFollowUpStatus(leadId) {
    const res = await fetch(`${BACKEND}/api/leads/${leadId}/follow-up-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
            }

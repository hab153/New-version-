// ============================================================
// notifications.js
// Skyline AA-1 Inbox / Notifications Logic
// ============================================================

// ─── CONFIG ───
const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// ─── DOM ELEMENTS ───
const loadingScreen = document.getElementById('loadingScreen');
const contactList = document.getElementById('contactList');
const emptyState = document.getElementById('emptyState');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const toast = document.getElementById('toast');
const revenueModal = document.getElementById('revenueModal');
const revenueBody = document.getElementById('revenueBody');
const closeRevenueModal = document.getElementById('closeRevenueModal');
const tierBadge = document.getElementById('tierBadge');

// Chat elements
const chatView = document.getElementById('chatView');
const chatBack = document.getElementById('chatBack');
const chatAvatar = document.getElementById('chatAvatar');
const chatName = document.getElementById('chatName');
const chatEmail = document.getElementById('chatEmail');
const chatRenameBtn = document.getElementById('chatRenameBtn');
const messagesContainer = document.getElementById('messagesContainer');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// ─── STATE ───
let allContacts = [];
let toastTimeout = null;
let currentLeadId = null;
let currentLeadName = null;
let currentLeadEmail = null;
let isSending = false;

// ─── AUTH CHECK ───
if (!token) {
    window.location.href = 'login.html';
}

// ─── MENU TOGGLE ───
menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
});

document.addEventListener('click', function() {
    menuDropdown.classList.remove('show');
});

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.stopPropagation();
        const action = this.dataset.action;
        menuDropdown.classList.remove('show');
        if (action === 'revenue') {
            fetchRevenueData();
            return;
        }
        showToast('Please open a chat to access this feature.');
    });
});

closeRevenueModal.addEventListener('click', function() {
    revenueModal.classList.remove('active');
});

revenueModal.addEventListener('click', function(e) {
    if (e.target === this) {
        revenueModal.classList.remove('active');
    }
});

// ─── CHAT BACK ───
chatBack.addEventListener('click', function() {
    chatView.classList.remove('active');
    document.body.style.overflow = '';
    currentLeadId = null;
});

// ─── CHAT INPUT ───
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    chatSendBtn.disabled = !this.value.trim();
});

chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) {
            sendMessage();
        }
    }
});

chatSendBtn.addEventListener('click', sendMessage);

// ─── RENAME ───
chatRenameBtn.addEventListener('click', function() {
    if (!currentLeadId) {
        showToast('No lead selected.');
        return;
    }
    const newName = prompt('Enter new name for this contact:', currentLeadName || '');
    if (newName === null || newName.trim() === '') return;
    renameLead(currentLeadId, newName.trim());
});

// ─── RENAME FUNCTION ───
async function renameLead(leadId, newName) {
    try {
        const res = await fetch(`${BACKEND}/api/leads/${leadId}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newName })
        });

        const text = await res.text();
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { message: text || 'Empty response' };
            }
        }

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            showToast('Failed to rename: ' + (data.message || data.error || 'Unknown error'));
            return;
        }

        if (data.success) {
            currentLeadName = data.newName;
            chatName.textContent = data.newName;
            chatAvatar.textContent = data.newName.charAt(0).toUpperCase();
            showToast('Renamed successfully!');
            loadContacts();
        } else {
            showToast('Failed to rename: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('❌ Rename error:', err);
        showToast('Connection error while renaming.');
    }
}

// ─── SEND MESSAGE (WITH TRACE LOGS) ───
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isSending || !currentLeadId) return;

    console.log('🚀 [FE-SEND] Starting send process...');
    console.log('🆔 [FE-SEND] Current Lead ID:', currentLeadId);

    isSending = true;
    chatSendBtn.disabled = true;

    const originalText = text;
    chatInput.value = '';
    chatInput.style.height = 'auto';

    try {
        const payload = {
            leads: [{
                name: currentLeadName || 'Unknown',
                email: currentLeadEmail || '',
                company: '',
                messages: [{ 
                    subject: 'Re: Conversation', 
                    body: originalText 
                }]
            }],
            leadId: currentLeadId,
            allowNewLead: false
        };

        console.log('📡 [FE-SEND] Sending payload:', JSON.stringify(payload));

        const res = await fetch(`${BACKEND}/api/leads/batch-send`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('📥 [FE-SEND] Backend Response:', data);

        if (data.success) {
            console.log('✅ [FE-SEND] Success! Reloading history for ID:', currentLeadId);
            await loadChatHistory(currentLeadId);
            
            setTimeout(() => {
                loadContacts(); 
            }, 800);
        } else {
            console.error('❌ [FE-SEND] Backend reported failure:', data);
            chatInput.value = originalText;
            showToast('Failed to send: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('💥 [FE-SEND] Network Error:', err);
        chatInput.value = originalText;
        showToast('Connection error. Please try again.');
    } finally {
        isSending = false;
        chatSendBtn.disabled = !chatInput.value.trim();
    }
}

// ─── APPEND MESSAGE (FIXED: Correct Labels) ───
function appendMessage(from, content, date) {
    const div = document.createElement('div');
    
    let cssClass = '';
    let senderLabel = '';

    if (from === 'ai') {
        cssClass = 'from-ai'; 
        senderLabel = 'You';
    } else {
        cssClass = 'from-lead';
        senderLabel = 'Customer';
    }

    div.className = `msg-group ${cssClass}`;

    const time = date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    div.innerHTML = `
        <div class="msg-sender">${senderLabel}</div>
        <div class="message-bubble">${escapeHtml(content)}</div>
        <div class="message-time">${time}</div>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ─── LOAD CHAT HISTORY ───
async function loadChatHistory(leadId) {
    messagesContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px;">
            <div class="spinner" style="width:28px; height:28px; border-width:2px;"></div>
            <div style="color:#505050; font-size:11px; letter-spacing:0.05em;">Loading messages...</div>
        </div>
    `;

    try {
        const res = await fetch(`${BACKEND}/api/conversations/${leadId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const messages = data.messages || [];

        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="empty-chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h3>No messages yet</h3>
                    <p>Send a message to start the conversation.</p>
                </div>
            `;
            return;
        }

        messages.forEach(msg => {
            const from = msg.from === 'ai' ? 'ai' : 'lead';
            appendMessage(from, msg.content, msg.date);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;

    } catch (err) {
        console.error('Load chat history error:', err);
        messagesContainer.innerHTML = `
            <div style="text-align:center; padding:20px; color:#505050; font-size:12px;">
                Failed to load messages. Please try again.
            </div>
        `;
    }
}

// ─── OPEN CHAT (WITH TRACE LOGS) ───
function openChat(leadId, name, email) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📂 [FE-OPEN] Attempting to open chat...');
    console.log('🆔 [FE-OPEN] Target Lead ID:', leadId);
    console.log('🆔 [FE-OPEN] Current Active ID:', currentLeadId);
    
    if (currentLeadId === leadId && chatView.classList.contains('active')) {
        console.log('⚡ [FE-OPEN] Chat is already active. Only reloading history.');
        loadChatHistory(leadId);
        return;
    }

    console.log('🆕 [FE-OPEN] Opening NEW chat view.');
    currentLeadId = leadId;
    currentLeadName = name || 'Unknown';
    currentLeadEmail = email || '';

    chatAvatar.textContent = (name || '?').charAt(0).toUpperCase();
    chatName.textContent = currentLeadName;
    chatEmail.textContent = currentLeadEmail || 'No email provided';
    
    chatView.classList.add('active');
    document.body.style.overflow = 'hidden';
    menuDropdown.classList.remove('show');
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatSendBtn.disabled = true;

    loadChatHistory(leadId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ─── CATEGORY CONFIG ───
const CATEGORY_CONFIG = {
    contacted: { label: 'Contacted', icon: '🔵', color: '#66ddff' },
    replied: { label: 'Replied', icon: '🟢', color: '#66dd99' },
    interested: { label: 'Interested', icon: '🟡', color: '#ffbb44' },
    ongoing: { label: 'Ongoing', icon: '🟣', color: '#bb88ff' },
    win: { label: 'Win', icon: '🔴', color: '#ff6b6b' }
};

// ─── FETCH REVENUE DATA ───
async function fetchRevenueData() {
    revenueModal.classList.add('active');
    revenueBody.innerHTML = '<div class="modal-loading">Loading revenue data...</div>';
    tierBadge.textContent = 'Loading...';

    try {
        const res = await fetch(`${BACKEND}/api/revenue/tracking`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        renderRevenueData(data);

    } catch (err) {
        console.error('❌ Failed to fetch revenue:', err);
        revenueBody.innerHTML = `
            <div class="modal-error">
                <p>Failed to load revenue data.</p>
                <p style="font-size:12px; color:#707070; margin-top:8px;">${err.message}</p>
            </div>
        `;
        tierBadge.textContent = 'Error';
    }
}

// ─── RENDER REVENUE DATA ───
function renderRevenueData(data) {
    const tier = data.tier || 'free';
    tierBadge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);

    const categories = data.categories || {};
    let html = '';

    html += `<div style="margin-bottom:12px;"><strong style="color:#f5f5f5; font-size:13px;">📊 Categories</strong></div>`;

    let hasCategories = false;
    for (const [key, leads] of Object.entries(categories)) {
        const config = CATEGORY_CONFIG[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), icon: '•', color: '#707070' };
        const count = Array.isArray(leads) ? leads.length : 0;

        if (count > 0) hasCategories = true;

        html += `
            <div class="category-section cat-${key}">
                <div class="category-header">
                    <span class="category-name">
                        <span class="category-icon"></span>
                        ${config.icon} ${config.label}
                    </span>
                    <span class="category-count">${count}</span>
                </div>
        `;

        if (count === 0) {
            html += `<div class="empty-category">No leads in this category</div>`;
        } else {
            const displayLeads = leads.slice(0, 10);
            const remaining = leads.length - 10;

            displayLeads.forEach(lead => {
                const name = lead.name || 'Unknown';
                const company = lead.company || '';
                const leadId = lead.id || '';
                html += `
                    <div class="lead-item" data-id="${leadId}" data-name="${escapeHtml(name)}" data-email="${escapeHtml(lead.email || '')}" onclick="openChatFromRevenue('${leadId}', '${escapeHtml(name)}', '${escapeHtml(lead.email || '')}')">
                        <span class="lead-name">${escapeHtml(name)}</span>
                        ${company ? `<span class="lead-company">· ${escapeHtml(company)}</span>` : ''}
                    </div>
                `;
            });

            if (remaining > 0) {
                html += `
                    <div class="lead-item" style="color:#505050; font-style:italic; border-left-color:transparent; cursor:default;">
                        + ${remaining} more
                    </div>
                `;
            }
        }

        html += `</div>`;
    }

    if (!hasCategories) {
        html += `<div class="no-data">No leads found.</div>`;
    }

    const advice = data.advice || {};
    const adviceKeys = Object.keys(advice);
    if (adviceKeys.length > 0) {
        html += `<div class="section-divider"></div>`;
        html += `<div class="advice-section">`;
        html += `<div class="advice-title">💡 Strategic Advice</div>`;

        adviceKeys.forEach(key => {
            const label = key.replace('Advice', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const value = advice[key];
            if (value && value.trim()) {
                html += `
                    <div class="advice-item">
                        <strong>${label}:</strong> ${escapeHtml(value)}
                    </div>
                `;
            }
        });

        html += `</div>`;
    }

    const actions = data.actions || [];
    if (actions.length > 0) {
        html += `<div class="section-divider"></div>`;
        html += `<div class="actions-section">`;
        html += `<div class="actions-title">🎯 Recommended Actions</div>`;

        actions.slice(0, 10).forEach((action, index) => {
            html += `
                <div class="action-item">
                    <span style="color:#505050; font-size:10px;">${index + 1}.</span>
                    <span class="action-lead">${escapeHtml(action.leadName || 'Lead')}</span>
                    <span class="action-text">— ${escapeHtml(action.action || 'Follow up')}</span>
                </div>
            `;
        });

        if (actions.length > 10) {
            html += `<div class="no-data" style="padding-top:4px;">+ ${actions.length - 10} more actions</div>`;
        }

        html += `</div>`;
    }

    if (tierBadge.textContent === 'Free') {
        html += `<div class="section-divider"></div>`;
        html += `
            <div style="background: rgba(255,187,68,0.06); border: 1px solid rgba(255,187,68,0.15); border-radius: 8px; padding: 12px 16px; margin-top: 4px;">
                <p style="color:#ffbb44; font-size:12px; margin:0;">
                    🚀 Upgrade to <strong>Go</strong> for AI‑powered advice, or <strong>Pro</strong> for personalised actions on your top leads.
                </p>
            </div>
        `;
    }

    revenueBody.innerHTML = html;
}

// ─── OPEN CHAT FROM REVENUE MODAL ───
function openChatFromRevenue(leadId, name, email) {
    revenueModal.classList.remove('active');
    openChat(leadId, name, email);
}

// ─── TOAST ───
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ─── LOAD CONTACTS ───
async function loadContacts() {
    try {
        const res = await fetch(`${BACKEND}/api/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP ${res.status}`);
        }

        allContacts = await res.json();
        renderContacts(allContacts);

    } catch (err) {
        console.error('❌ Failed to load contacts:', err);
        showEmptyState();
    } finally {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 1500);
    }
}

function renderContacts(contacts) {
    if (!contacts || contacts.length === 0) {
        if (searchInput.value.trim() !== '') {
            contactList.classList.remove('active');
            emptyState.classList.remove('active');
            noResults.classList.add('active');
        } else {
            showEmptyState();
        }
        return;
    }

    contactList.classList.add('active');
    emptyState.classList.remove('active');
    noResults.classList.remove('active');

    contactList.innerHTML = contacts.map(c => {
        const initials = (c.name || '?').charAt(0).toUpperCase();
        const preview = c.lastMessage || 'No messages yet';
        const time = c.lastDate ? new Date(c.lastDate).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        }) : '';

        return `
            <div class="contact-item" data-id="${c.id}" onclick="openChat('${c.id}', '${escapeHtml(c.name || 'Unknown')}', '${escapeHtml(c.email || '')}')">
                <div class="contact-avatar">${initials}</div>
                <div class="contact-info">
                    <div class="contact-name">${escapeHtml(c.name || 'Unknown')}</div>
                    <div class="contact-preview">${escapeHtml(preview)}</div>
                </div>
                ${time ? `<div class="contact-time">${time}</div>` : ''}
            </div>
        `;
    }).join('');
}

searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
    if (!query) {
        renderContacts(allContacts);
        return;
    }
    const filtered = allContacts.filter(c =>
        (c.name || '').toLowerCase().includes(query) ||
        (c.company || '').toLowerCase().includes(query) ||
        (c.email || '').toLowerCase().includes(query)
    );
    renderContacts(filtered);
});

function showEmptyState() {
    contactList.classList.remove('active');
    emptyState.classList.add('active');
    noResults.classList.remove('active');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── START ───
loadContacts();

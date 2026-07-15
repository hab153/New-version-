// ============================================================
//  CHAT.JS - Shared Chat Logic for Skyline AA-1
//  Used by both page.html and history.html
// ============================================================

// ──────────────────────────────────────────────────────────────
//  1. CONFIGURATION
// ──────────────────────────────────────────────────────────────

const CHAT_CONFIG = {
    BACKEND: 'https://skylineapp-backend-file.onrender.com',
    MAX_MESSAGE_LENGTH: 800,
    MAX_LEADS_RETURNED: 5,
};

// ──────────────────────────────────────────────────────────────
//  2. STATE
// ──────────────────────────────────────────────────────────────

const CHAT_STATE = {
    token: localStorage.getItem('token'),
    currentMode: 'lead', // 'lead' | 'assistant'
    isChatActive: false,
    isTyping: false,
    currentSessionId: null,
    assistantSessionId: null,
    conversationHistory: [],
    currentGeneratedLeads: [],
};

// ──────────────────────────────────────────────────────────────
//  3. XSS PROTECTION
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
//  4. UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────

function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatAI(text) {
    if (!text) return '';
    let s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, m => `<ul class="ai-ul">${m}</ul>`);
    s = s.replace(/\n/g, '<br>');
    return s;
}

// ──────────────────────────────────────────────────────────────
//  5. CLEAN AI RESPONSE (Handle JSON leads)
// ──────────────────────────────────────────────────────────────

function cleanAIResponse(content) {
    if (typeof content !== 'string') return content;
    
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            if (parsed.length > 0) {
                return `📊 Found <strong>${parsed.length}</strong> lead${parsed.length !== 1 ? 's' : ''}. View them in the table below.`;
            } else {
                return '📊 No leads found. Try adjusting your search criteria.';
            }
        }
        if (typeof parsed === 'object' && parsed !== null) {
            let lines = [];
            for (const [key, value] of Object.entries(parsed)) {
                lines.push(`<strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}`);
            }
            return lines.join('<br>');
        }
    } catch (e) {}
    
    return content;
}

// ──────────────────────────────────────────────────────────────
//  6. RENDER MESSAGES (Shared)
// ──────────────────────────────────────────────────────────────

function renderMessages(container, messages, isAssistant = false) {
    if (!container) return;
    
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    if (!messages || messages.length === 0) {
        const row = document.createElement('div');
        row.className = 'msg-row ai';
        row.innerHTML = `<div class="av">AI</div><div class="bubble-wrap"><div class="bubble">No messages in this session.</div><div class="msg-time">${getTime()}</div></div>`;
        fragment.appendChild(row);
        container.appendChild(fragment);
        return;
    }
    
    for (const msg of messages) {
        if (!msg.content) continue;
        
        const role = (msg.role === 'assistant' || msg.role === 'ai') ? 'ai' : 'user';
        const row = document.createElement('div');
        row.className = `msg-row ${role}`;
        
        let displayContent = msg.content;
        if (role === 'ai') {
            displayContent = cleanAIResponse(msg.content);
        } else {
            displayContent = escapeHtml(msg.content);
        }
        
        const html = role === 'ai' ? formatAI(displayContent) : displayContent;
        row.innerHTML = `<div class="av">${role === 'ai' ? 'AI' : 'ME'}</div><div class="bubble-wrap"><div class="bubble">${html}</div><div class="msg-time">${getTime()}</div></div>`;
        fragment.appendChild(row);
    }
    
    container.appendChild(fragment);
    scrollToBottom(container);
}

// ──────────────────────────────────────────────────────────────
//  7. SCROLL HELPERS
// ──────────────────────────────────────────────────────────────

function scrollToBottom(container) {
    if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
}

// ──────────────────────────────────────────────────────────────
//  8. LOAD SESSION (Shared)
// ──────────────────────────────────────────────────────────────

async function loadSession(sessionId, container, type = null) {
    if (!sessionId || !container) return false;
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    
    console.log('📥 [CHAT.JS] Loading session:', sessionId, 'type:', type);
    
    try {
        const res = await fetch(`${CHAT_CONFIG.BACKEND}/api/history/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load session');
        
        const messages = await res.json();
        console.log('📥 [CHAT.JS] Loaded', messages.length, 'messages');
        
        // Determine if assistant session
        const isAssistant = (type === 'assistant') || (sessionId === 'assistant');
        
        // Render messages
        renderMessages(container, messages, isAssistant);
        
        // Update state
        CHAT_STATE.currentSessionId = sessionId;
        if (isAssistant) {
            CHAT_STATE.assistantSessionId = sessionId;
        }
        
        // Update conversation history
        CHAT_STATE.conversationHistory = messages.map(m => ({
            role: m.role === 'assistant' || m.role === 'ai' ? 'assistant' : 'user',
            content: m.content
        }));
        
        return true;
        
    } catch (error) {
        console.error('❌ [CHAT.JS] Error loading session:', error);
        container.innerHTML = `<div class="msg-row ai"><div class="av">AI</div><div class="bubble-wrap"><div class="bubble">❌ Failed to load session. Please try again.</div><div class="msg-time">${getTime()}</div></div></div>`;
        return false;
    }
}

// ──────────────────────────────────────────────────────────────
//  9. SEND MESSAGE (Shared)
// ──────────────────────────────────────────────────────────────

async function sendChatMessage(message, container, sessionId = null, mode = 'lead') {
    if (!message || !container) return null;
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    
    const isAssistant = mode === 'assistant';
    const currentSessionId = sessionId || (isAssistant ? CHAT_STATE.assistantSessionId : CHAT_STATE.currentSessionId) || null;
    
    // Add user message to UI
    addMessageToUI(container, 'user', message);
    
    // Show typing indicator
    showTyping(container);
    
    try {
        const endpoint = isAssistant ? '/api/assistant' : '/api/chat';
        const payload = isAssistant ? {
            message: message,
            sessionId: currentSessionId
        } : {
            message: message,
            history: CHAT_STATE.conversationHistory,
            sessionId: currentSessionId
        };
        
        const res = await fetch(`${CHAT_CONFIG.BACKEND}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        hideTyping(container);
        
        const data = await res.json();
        
        if (!res.ok) {
            addMessageToUI(container, 'ai', `⚠️ ${data.message || 'Something went wrong'}`);
            return null;
        }
        
        // Update session ID
        if (data.sessionId) {
            if (isAssistant) {
                CHAT_STATE.assistantSessionId = data.sessionId;
            } else {
                CHAT_STATE.currentSessionId = data.sessionId;
            }
        }
        
        // Add AI response to UI
        const reply = data.reply || data.response || 'No response received.';
        
        // Check if it's a lead response (JSON array)
        try {
            const parsed = JSON.parse(reply);
            if (Array.isArray(parsed)) {
                CHAT_STATE.currentGeneratedLeads = parsed;
                addMessageToUI(container, 'ai', `📊 Found <strong>${parsed.length}</strong> lead${parsed.length !== 1 ? 's' : ''}.`);
                // Callback for leads if provided
                if (window.onLeadsFound) {
                    window.onLeadsFound(parsed);
                }
                return { reply, leads: parsed, sessionId: data.sessionId };
            }
        } catch (e) {}
        
        addMessageToUI(container, 'ai', reply);
        
        // Update conversation history
        CHAT_STATE.conversationHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: reply }
        );
        
        return { reply, sessionId: data.sessionId };
        
    } catch (error) {
        console.error('❌ [CHAT.JS] Send error:', error);
        hideTyping(container);
        addMessageToUI(container, 'ai', '🔌 Connection error — check your network and try again.');
        return null;
    }
}

// ──────────────────────────────────────────────────────────────
//  10. UI HELPERS (for adding messages)
// ──────────────────────────────────────────────────────────────

function addMessageToUI(container, role, content) {
    if (!container || !content) return;
    
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    
    let displayContent = content;
    if (role === 'ai') {
        displayContent = cleanAIResponse(content);
    } else {
        displayContent = escapeHtml(content);
    }
    
    const html = role === 'ai' ? formatAI(displayContent) : displayContent;
    row.innerHTML = `<div class="av">${role === 'ai' ? 'AI' : 'ME'}</div><div class="bubble-wrap"><div class="bubble">${html}</div><div class="msg-time">${getTime()}</div></div>`;
    container.appendChild(row);
    scrollToBottom(container);
}

function showTyping(container, label = 'Thinking…') {
    if (!container) return;
    
    let row = container.querySelector('.typing-row');
    if (row) {
        const lbl = row.querySelector('.t-label');
        if (lbl) lbl.textContent = label;
        scrollToBottom(container);
        return;
    }
    
    row = document.createElement('div');
    row.className = 'typing-row';
    row.innerHTML = `<div class="av" style="background:linear-gradient(135deg,var(--gold),var(--gold-bright));color:#0d0a04;">AI</div><div class="typing-bubble"><span class="t-label">${label}</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div></div>`;
    container.appendChild(row);
    scrollToBottom(container);
}

function hideTyping(container) {
    if (!container) return;
    const row = container.querySelector('.typing-row');
    if (row) row.remove();
}

// ──────────────────────────────────────────────────────────────
//  11. SESSION MANAGEMENT (Shared)
// ──────────────────────────────────────────────────────────────

async function getSessions() {
    const token = localStorage.getItem('token');
    if (!token) return [];
    
    try {
        const res = await fetch(`${CHAT_CONFIG.BACKEND}/api/sessions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch sessions');
        
        const sessions = await res.json();
        return sessions;
    } catch (error) {
        console.error('❌ [CHAT.JS] Error fetching sessions:', error);
        return [];
    }
}

function createSessionLink(sessionId, type) {
    return `page.html?session=${encodeURIComponent(sessionId)}&type=${encodeURIComponent(type || 'lead')}`;
}

// ──────────────────────────────────────────────────────────────
//  12. EXPORTS (for use in other files)
// ──────────────────────────────────────────────────────────────

// If using ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHAT_CONFIG,
        CHAT_STATE,
        escapeHtml,
        getTime,
        formatAI,
        cleanAIResponse,
        renderMessages,
        scrollToBottom,
        loadSession,
        sendChatMessage,
        addMessageToUI,
        showTyping,
        hideTyping,
        getSessions,
        createSessionLink,
    };
}

// If using in browser
if (typeof window !== 'undefined') {
    window.Chat = {
        CHAT_CONFIG,
        CHAT_STATE,
        escapeHtml,
        getTime,
        formatAI,
        cleanAIResponse,
        renderMessages,
        scrollToBottom,
        loadSession,
        sendChatMessage,
        addMessageToUI,
        showTyping,
        hideTyping,
        getSessions,
        createSessionLink,
    };
                                              }

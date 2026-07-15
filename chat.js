// chat.js - Central Chat Orchestrator
// All pages share this file for session management

// ────────────────────────────────────────────────────────────────
//  1. CONFIGURATION
// ────────────────────────────────────────────────────────────────

const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const TOKEN = localStorage.getItem('token');

// ────────────────────────────────────────────────────────────────
//  2. STATE
// ────────────────────────────────────────────────────────────────

const ChatState = {
    currentMode: 'lead',
    sessionId: null,
    assistantSessionId: null,
    conversationHistory: [],
    currentGeneratedLeads: [],
    isChatActive: false,
    isTyping: false,
    currentSessionType: null,
};

// ────────────────────────────────────────────────────────────────
//  3. SESSION MANAGER
// ────────────────────────────────────────────────────────────────

const SessionManager = {
    // ── Get all sessions ──
    getSessions: async () => {
        try {
            const res = await fetch(`${BACKEND}/api/sessions`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            if (!res.ok) throw new Error('Failed to fetch sessions');
            const sessions = await res.json();
            return sessions;
        } catch (error) {
            console.error('❌ [Chat] Failed to fetch sessions:', error);
            return [];
        }
    },

    // ── Get a single session by ID ──
    getSession: async (sessionId) => {
        try {
            const sessions = await SessionManager.getSessions();
            return sessions.find(s => (s.sessionId || s._id) === sessionId) || null;
        } catch (error) {
            console.error('❌ [Chat] Failed to get session:', error);
            return null;
        }
    },

    // ── Create a new session ──
    createSession: async (type, name) => {
        try {
            const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            const res = await fetch(`${BACKEND}/api/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    type: type || 'lead',
                    name: name || (type === 'assistant' ? 'Assistant Chat' : 'Lead Search')
                })
            });
            if (!res.ok) throw new Error('Failed to create session');
            const session = await res.json();
            return session;
        } catch (error) {
            console.error('❌ [Chat] Failed to create session:', error);
            return null;
        }
    },

    // ── Rename a session ──
    renameSession: async (sessionId, newName) => {
        try {
            const res = await fetch(`${BACKEND}/api/sessions/${sessionId}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({ name: newName })
            });
            if (!res.ok) throw new Error('Failed to rename session');
            return await res.json();
        } catch (error) {
            console.error('❌ [Chat] Failed to rename session:', error);
            return null;
        }
    },

    // ── Pin/Unpin a session ──
    pinSession: async (sessionId, pinned) => {
        try {
            const res = await fetch(`${BACKEND}/api/sessions/${sessionId}/pin`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({ pinned: pinned })
            });
            if (!res.ok) throw new Error('Failed to pin session');
            return await res.json();
        } catch (error) {
            console.error('❌ [Chat] Failed to pin session:', error);
            return null;
        }
    },

    // ── Delete a session ──
    deleteSession: async (sessionId) => {
        try {
            const res = await fetch(`${BACKEND}/api/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            return res.ok;
        } catch (error) {
            console.error('❌ [Chat] Failed to delete session:', error);
            return false;
        }
    }
};

// ────────────────────────────────────────────────────────────────
//  4. MESSAGE HANDLER
// ────────────────────────────────────────────────────────────────

const MessageHandler = {
    // ── Get messages for a session ──
    getMessages: async (sessionId) => {
        try {
            const res = await fetch(`${BACKEND}/api/history/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            if (!res.ok) throw new Error('Failed to load messages');
            const messages = await res.json();
            return messages;
        } catch (error) {
            console.error('❌ [Chat] Failed to get messages:', error);
            return [];
        }
    },

    // ── Send a message (lead mode) ──
    sendLeadMessage: async (message, sessionId, history = []) => {
        try {
            const res = await fetch(`${BACKEND}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: sessionId,
                    history: history
                })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to send message');
            }
            return await res.json();
        } catch (error) {
            console.error('❌ [Chat] Failed to send lead message:', error);
            throw error;
        }
    },

    // ── Send a message (assistant mode) ──
    sendAssistantMessage: async (message, sessionId) => {
        try {
            const res = await fetch(`${BACKEND}/api/assistant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: sessionId
                })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to send message');
            }
            return await res.json();
        } catch (error) {
            console.error('❌ [Chat] Failed to send assistant message:', error);
            throw error;
        }
    },

    // ── Format messages for display ──
    formatMessages: (messages) => {
        return messages.map(msg => ({
            role: msg.role === 'ai' || msg.role === 'assistant' ? 'ai' : 'user',
            content: msg.content,
            time: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            messageId: msg._id
        }));
    }
};

// ────────────────────────────────────────────────────────────────
//  5. PUBLIC EXPORTS
// ────────────────────────────────────────────────────────────────

window.Chat = {
    State: ChatState,
    Sessions: SessionManager,
    Messages: MessageHandler,

    // ── Initialize ──
    init: function(mode = 'lead') {
        ChatState.currentMode = mode;
        console.log('🚀 [Chat] Orchestrator initialized in', mode, 'mode');
        return this;
    },

    // ── Switch mode ──
    switchMode: function(mode) {
        ChatState.currentMode = mode;
        console.log('🔄 [Chat] Switched to', mode, 'mode');
        return this;
    },

    // ── Get current state ──
    getState: function() {
        return ChatState;
    },

    // ── Clear state ──
    clearState: function() {
        ChatState.conversationHistory = [];
        ChatState.currentGeneratedLeads = [];
        ChatState.sessionId = null;
        ChatState.isChatActive = false;
        ChatState.isTyping = false;
        console.log('🧹 [Chat] State cleared');
        return this;
    },

    // ── Load a session by ID ──
    loadSession: async function(sessionId) {
        try {
            const messages = await MessageHandler.getMessages(sessionId);
            const session = await SessionManager.getSession(sessionId);
            
            ChatState.sessionId = sessionId;
            ChatState.currentSessionType = session?.type || 'lead';
            
            return {
                messages: messages,
                session: session,
                formattedMessages: MessageHandler.formatMessages(messages)
            };
        } catch (error) {
            console.error('❌ [Chat] Failed to load session:', error);
            return null;
        }
    },

    // ── Send message (auto-detects mode) ──
    sendMessage: async function(message, sessionId, history = []) {
        const type = ChatState.currentSessionType || 'lead';
        
        if (type === 'assistant') {
            return await MessageHandler.sendAssistantMessage(message, sessionId);
        } else {
            return await MessageHandler.sendLeadMessage(message, sessionId, history);
        }
    }
};

console.log('✅ [Chat] Orchestrator loaded successfully');

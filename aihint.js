// aihint.js - Standalone AI Hint Module for Notifications Page
(function() {
    'use strict';

    // Wait for DOM and required globals to be available
    function initAiHint() {
        if (!window.BACKEND || !window.token) {
            console.warn('⚠️ [AI HINT] BACKEND or token not yet initialized. Retrying...');
            setTimeout(initAiHint, 100);
            return;
        }

        var showToast = window.showToast || function(msg) { alert(msg); };
        var chatInput = document.getElementById('chatInput');
        var chatSendBtn = document.getElementById('chatSendBtn');

        function generateHint() {
            if (!window.currentLeadId) { 
                showToast('Open a chat first.'); 
                return; 
            }
            
            showToast('Generating AI hint...');
            
            fetch(window.BACKEND + '/api/conversations/' + encodeURIComponent(window.currentLeadId), {
                headers: { 'Authorization': 'Bearer ' + window.token }
            })
            .then(function(convRes) {
                if (!convRes.ok) {
                    if (convRes.status === 401 || convRes.status === 403) {
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }
                    showToast('Failed to load conversation.');
                    return;
                }
                return convRes.json();
            })
            .then(function(convData) {
                if (!convData) return;
                var messages = convData.messages || [];
                if (messages.length === 0) {
                    showToast('No messages to generate a hint from.');
                    return;
                }
                return fetch(window.BACKEND + '/api/ai/suggest', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + window.token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: messages.slice(-5) })
                });
            })
            .then(function(suggestRes) {
                if (!suggestRes) return;
                if (!suggestRes.ok) {
                    if (suggestRes.status === 401 || suggestRes.status === 403) {
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }
                    return suggestRes.json().then(function(err) {
                        showToast('Failed: ' + (err.message || 'Unknown error'));
                    });
                }
                return suggestRes.json();
            })
            .then(function(data) {
                if (!data) return;
                if (data.suggestion && chatInput) {
                    chatInput.value = data.suggestion;
                    chatInput.style.height = 'auto';
                    chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
                    if (chatSendBtn) chatSendBtn.disabled = false;
                    chatInput.focus();
                    showToast('AI hint ready!');
                } else {
                    showToast(data.message || 'No hint generated.');
                }
            })
            .catch(function(err) {
                console.error('Generate hint error:', err);
                showToast('Connection error. Please try again.');
            });
        }

        // Expose globally so menu handlers can call it
        window.generateHint = generateHint;

        // Auto-attach to follow-up dropdown hint option if it exists
        var hintOption = document.querySelector('.chat-followup-option[data-action="hint"]');
        if (hintOption) {
            hintOption.addEventListener('click', function() {
                var dropdown = document.getElementById('chatFollowupDropdown');
                if (dropdown) dropdown.classList.remove('show');
                generateHint();
            });
        }

        console.log('✅ [AI HINT] Module initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAiHint);
    } else {
        initAiHint();
    }
})();

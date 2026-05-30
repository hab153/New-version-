/**
 * suggest.js
 * Frontend utility for handling AI reply suggestions in the notifications interface.
 */

const BACKEND = 'https://skylineapp-backend-file.onrender.com';

/**
 * Fetches an AI-generated suggestion based on the current chat history.
 * @param {string} leadId - The ID of the current lead.
 * @param {HTMLElement} btnElement - The hint button element to manage loading state.
 * @param {HTMLTextAreaElement} textArea - The reply textarea to inject the suggestion into.
 */
async function fetchAISuggestion(leadId, btnElement, textArea) {
    const token = localStorage.getItem('token');
    if (!token || !leadId) return;

    // 1. UI Loading State
    const originalContent = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `
        <svg class="spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
    `;
    btnElement.style.opacity = '0.7';

    try {
        // 2. Fetch Conversation History (to get the last 3 messages)
        const res = await fetch(`${BACKEND}/api/conversations/${leadId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch conversation');

        const data = await res.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
            alert("Start the conversation first to get a suggestion.");
            return;
        }

        // 3. Call the AI Suggestion Endpoint
        const suggestRes = await fetch(`${BACKEND}/api/ai/suggest`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ messages })
        });

        if (!suggestRes.ok) throw new Error('AI service unavailable');

        const suggestData = await suggestRes.json();
        
        // 4. Inject Suggestion into Textarea
        if (suggestData.suggestion) {
            textArea.value = suggestData.suggestion;
            // Trigger auto-resize if available
            if (typeof autoResize === 'function') {
                autoResize(textArea);
            }
            textArea.focus();
        }

    } catch (error) {
        console.error("Suggestion Error:", error);
        alert("Could not generate a hint. Please try again.");
    } finally {
        // 5. Reset Button State
        btnElement.disabled = false;
        btnElement.innerHTML = originalContent;
        btnElement.style.opacity = '1';
    }
}

// Add CSS for the spinning loader dynamically
const style = document.createElement('style');
style.innerHTML = `
    .spin-icon {
        width: 16px;
        height: 16px;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// limit-monitor.js
const BACKEND = 'https://skylineapp-backend-file.onrender.com';

async function initLimitMonitor() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const container = document.getElementById('limit-monitor-container');
    if (!container) return;

    // Show skeleton initially
    container.innerHTML = `
        <div class="lm-header">📊 Daily Limits</div>
        <div class="lm-skeleton"></div>
        <div class="lm-skeleton"></div>
        <div class="lm-skeleton"></div>
    `;

    try {
        const res = await fetch(`${BACKEND}/api/users/me/usage`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!res.ok) throw new Error('Failed to fetch usage');
        
        const data = await res.json();
        renderLimitMonitor(data, container);
        
        // Poll every 60 seconds to catch midnight resets
        setInterval(async () => {
            const freshRes = await fetch(`${BACKEND}/api/users/me/usage`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (freshRes.ok) {
                const freshData = await freshRes.json();
                renderLimitMonitor(freshData, container);
            }
        }, 60000);

    } catch (err) {
        console.error('Limit Monitor Error:', err);
        container.innerHTML = '<div style="color:#707070; font-size:13px;">Could not load limits</div>';
    }
}

function renderLimitMonitor(data, container) {
    const { limits, tier } = data;
    
    const createBar = (label, info, icon) => {
        // Calculate percentage for the "blood" fill
        const percent = Math.max(0, Math.min(100, (info.remaining / info.max) * 100));
        
        // Determine color state based on remaining amount
        let stateClass = 'high';
        if (percent < 30) stateClass = ''; // Default red
        else if (percent < 70) stateClass = 'medium';

        return `
            <div class="lm-row">
                <div class="lm-label">
                    <span>${icon}</span>
                    <span>${label}</span>
                </div>
                <div class="lm-bar-bg">
                    <div class="lm-bar-fill ${stateClass}" style="width: ${percent}%"></div>
                    <div class="lm-count">${info.remaining} / ${info.max}</div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="lm-header">
            <span>📊 Daily Limits (${tier.toUpperCase()})</span>
        </div>
        <div class="lm-body">
            ${createBar('Research', limits.research, '🔍')}
            ${createBar('Emails', limits.email, '📧')}
            ${createBar('Chats', limits.chat, '💬')}
        </div>
    `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLimitMonitor);
} else {
    initLimitMonitor();
                                }

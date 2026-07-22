// notif-utils.js

// ========== GLOBAL CSRF FETCH INTERCEPTOR ==========
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        const csrfToken = localStorage.getItem('csrfToken');
        const method = (options.method || 'GET').toUpperCase();
        const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

        // Only add CSRF token for state-changing requests
        if (!safeMethods.includes(method) && csrfToken) {
            options.headers = options.headers || {};
            options.headers['X-CSRF-Token'] = csrfToken;
        }

        return originalFetch.call(this, url, options);
    };
})();

// ========== XSS PROTECTION – COMPREHENSIVE ==========

/**
 * Escape HTML special characters for safe insertion into HTML content
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for HTML
 */
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

/**
 * Escape HTML for insertion into HTML attributes (single or double quotes)
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for attributes
 */
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escape HTML for safe insertion into JavaScript strings (prevents breakouts)
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for JS
 */
function escapeJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f');
}

// Make globally available
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.escapeJS = escapeJS;

// ========== UTILITY FUNCTIONS ==========

/**
 * Calculate engagement score for a lead based on status and conversation
 * @param {Object} lead - Lead object with status property
 * @param {Array} messages - Array of message objects
 * @returns {Object} - { score: number, tier: string }
 */
function calculateEngagementScore(lead, messages) {
    let score = 50;
    let tier = 'MED';
    if (lead && lead.status === 'Replied') score = 70;
    else if (lead && lead.status === 'Contacted') score = 40;
    if (messages && messages.length > 10) score += 10;
    if (score >= 75) tier = 'HIGH';
    else if (score >= 40) tier = 'MED';
    else tier = 'LOW';
    return { score, tier };
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} - First character uppercase
 */
function getInitials(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

/**
 * Auto-resize a textarea to fit its content
 * @param {HTMLTextAreaElement} textarea - The textarea element
 */
function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

/**
 * Format a date string to a relative time (e.g., "2h ago", "3d ago")
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted relative time
 */
function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

/**
 * Debounce a function call
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string
 * @param {*} fallback - Fallback value if parse fails
 * @returns {*} - Parsed object or fallback
 */
function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

/**
 * Check if a string is a valid email
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Get the current date as a string (YYYY-MM-DD)
 * @returns {string} - Today's date
 */
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Check if a date is today
 * @param {string} dateStr - Date string
 * @returns {boolean} - True if date is today
 */
function isToday(dateStr) {
    if (!dateStr) return false;
    try {
        const d = new Date(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    } catch {
        return false;
    }
}

// ========== GLOBAL EXPOSURE ==========

// Expose utility functions globally so they can be used in other scripts
window.calculateEngagementScore = calculateEngagementScore;
window.getInitials = getInitials;
window.autoResize = autoResize;
window.formatTime = formatTime;
window.debounce = debounce;
window.safeJsonParse = safeJsonParse;
window.isValidEmail = isValidEmail;
window.truncateText = truncateText;
window.getTodayDate = getTodayDate;
window.isToday = isToday;

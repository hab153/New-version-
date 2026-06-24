/**
 * score.js
 * Frontend utility for calculating lead scores.
 */

/**
 * Calculates a confidence score based on data validity (Verification, Role, Source).
 * @param {Object} lead - The lead object.
 * @returns {Object} Score details.
 */
function calculateLeadScore(lead) {
    let score = 0;
    const reasons = [];

    // 1. Email Verification (Max 40)
    if (lead.verification) {
        if (lead.verification.email_syntax) score += 5;
        if (lead.verification.mx_valid) score += 10;
        if (lead.verification.smtp_status === 'valid') {
            score += 25;
            reasons.push("SMTP Verified");
        } else if (lead.verification.smtp_status === 'catch-all') {
            score += 15;
            reasons.push("Catch-all Domain");
        }
        if (!lead.verification.is_disposable) score += 5;
        if (!lead.verification.is_free_provider) {
            score += 5;
            reasons.push("Professional Domain");
        }
    }

    // 2. Role Match (Max 30)
    if (lead.role && lead.role.length > 2) {
        const roleLower = lead.role.toLowerCase();
        const decisionKeywords = ['ceo', 'founder', 'owner', 'director', 'head', 'vp', 'chief', 'partner'];
        const isDecisionMaker = decisionKeywords.some(keyword => roleLower.includes(keyword));
        
        if (isDecisionMaker) {
            score += 30;
            reasons.push("Decision Maker");
        } else {
            score += 15;
            reasons.push("Role Identified");
        }
    }

    // 3. Company & Source (Max 30)
    if (lead.company && lead.company.length > 2) score += 10;
    if (lead.industry && lead.industry.length > 2) score += 10;        if (lead.source === 'linkedin' || lead.source === 'official_website') {
        score += 10;
        reasons.push("High-Quality Source");
    } else {
        score += 5;
    }

    score = Math.min(score, 100);

    let tier, color;
    if (score >= 80) {
        tier = 'Outreach Ready';
        color = '#10b981'; // Green
    } else if (score >= 50) {
        tier = 'Needs Review';
        color = '#f59e0b'; // Amber
    } else {
        tier = 'Low Confidence';
        color = '#ef4444'; // Red
    }

    return { score, tier, color, reasons };
}

/**
 * Calculates an engagement score based on chat activity.
 * @param {Object} lead - The lead object containing message history or counts.
 * @param {Array} messages - Optional array of message objects for deeper analysis.
 * @returns {Object} Score details.
 */
function calculateEngagementScore(lead, messages = []) {
    let score = 0;
    const reasons = [];

    // 1. Recency of Interaction (Max 40 points)
    if (lead.lastDate) {
        const lastMsgTime = new Date(lead.lastDate).getTime();
        const now = new Date().getTime();
        const hoursSinceLastMsg = (now - lastMsgTime) / (1000 * 60 * 60);

        if (hoursSinceLastMsg < 24) {
            score += 40;
            reasons.push("Active Today");
        } else if (hoursSinceLastMsg < 72) {
            score += 25;
            reasons.push("Active Recently");
        } else if (hoursSinceLastMsg < 168) { // 1 week
            score += 10;            
            reasons.push("Active This Week");
        }    }

    // 2. Message Volume (Max 30 points)
    const msgCount = messages.length || lead.messageCount || 0;
    if (msgCount > 10) {
        score += 30;
        reasons.push("High Engagement");
    } else if (msgCount > 5) {
        score += 20;
        reasons.push("Moderate Engagement");
    } else if (msgCount > 2) {
        score += 10;
        reasons.push("Initial Contact");
    }

    // 3. Conversation Balance (Max 30 points)
    if (messages.length > 0) {
        const leadMsgs = messages.filter(m => m.from === 'lead').length;
        const aiMsgs = messages.filter(m => m.from === 'ai').length;
        
        if (leadMsgs > 0 && aiMsgs > 0) {
            score += 30;
            reasons.push("Two-way Conversation");
        } else if (leadMsgs > 0) {
            score += 15;
            reasons.push("Lead Responding");
        }
    } else if (lead.unreadCount > 0) {
        // If we don't have full messages but know there's an unread reply
        score += 20;
        reasons.push("Lead Replied");
    }

    score = Math.min(score, 100);

    let tier, color;
    if (score >= 75) {
        tier = 'Highly Active';
        color = '#10b981'; // Green
    } else if (score >= 40) {
        tier = 'Moderately Active';
        color = '#f59e0b'; // Amber
    } else {
        tier = 'Inactive';
        color = '#707070'; // Gray/Text-3
    }
    return { score, tier, color, reasons };
}

if (typeof module !== 'undefined' && module.exports) {    module.exports = { calculateLeadScore, calculateEngagementScore };
    }

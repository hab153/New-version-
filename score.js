/**
 * score.js
 * Frontend utility for calculating deterministic lead confidence scores (0-100).
 * 
 * Usage:
 * const rating = calculateLeadScore(leadData);
 * console.log(rating.score); // e.g., 85
 * console.log(rating.tier);  // e.g., 'Outreach Ready'
 * console.log(rating.color); // e.g., '#10b981'
 */

/**
 * Calculates a confidence score for a lead based on available data fields.
 * @param {Object} lead - The lead object containing verification, role, and company details.
 * @returns {Object} An object containing score (number), tier (string), color (hex), and reasons (array).
 */
function calculateLeadScore(lead) {
    let score = 0;
    const reasons = [];

    // 1. Email Verification Status (Max 40 points)
    if (lead.verification) {
        if (lead.verification.email_syntax) {
            score += 5;
            reasons.push("Valid Syntax");
        }
        
        if (lead.verification.mx_valid) {
            score += 10;
            reasons.push("MX Records Valid");
        }
        
        if (lead.verification.smtp_status === 'valid') {
            score += 25;
            reasons.push("SMTP Verified");
        } else if (lead.verification.smtp_status === 'catch-all') {
            score += 15;
            reasons.push("Catch-all Domain");
        }
        
        if (!lead.verification.is_disposable) {
            score += 5;
        }
        
        if (!lead.verification.is_free_provider) {
            score += 5; // Professional domain bonus
            reasons.push("Professional Domain");
        }
    }
    // 2. Role/Decision Maker Match (Max 30 points)
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

    // 3. Company & Source Quality (Max 30 points)
    if (lead.company && lead.company.length > 2) {
        score += 10;
    }
    
    if (lead.industry && lead.industry.length > 2) {
        score += 10;
    }
    
    // Source quality bonus
    if (lead.source === 'linkedin' || lead.source === 'official_website') {
        score += 10;
        reasons.push("High-Quality Source");
    } else {
        score += 5;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine Tier and Color
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

    return { 
        score,         tier, 
        color, 
        reasons 
    };
}

// Export for module usage if needed, otherwise available globally in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateLeadScore };
                                  }

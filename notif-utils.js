function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function autoResize(el) {
  el.style.height = '38px';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function calculateEngagementScore(lead, messages = []) {
    let score = 0;
    const reasons = [];

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
        } else if (hoursSinceLastMsg < 168) {
            score += 10;
            reasons.push("Active This Week");
        }
    }

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
        score += 20;
        reasons.push("Lead Replied");
    }

    score = Math.min(score, 100);

    let tier, color;
    if (score >= 75) {
        tier = 'Highly Active';
        color = '#10b981';
    } else if (score >= 40) {
        tier = 'Moderately Active';
        color = '#f59e0b';
    } else {
        tier = 'Inactive';
        color = '#707070';
    }

    return { score, tier, color, reasons };
          }

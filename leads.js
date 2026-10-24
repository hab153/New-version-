// ============================================================
// leads.js - Skyline AI · Lead Results Logic
// UPDATED: Dynamic Company List in Review Sheet, Schedule API, Live Countdown
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    //  DOM Elements ──
    const leadsList = document.getElementById('leadsList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const selectCountSpan = document.querySelector('.select-count');
    const saveLeadsBtn = document.querySelector('.action-btn.primary');
    const saveBtnText = document.getElementById('saveBtnText');
    const sendBtn = document.getElementById('sendBtn');
    const closeWarningBtn = document.getElementById('closeWarning');
    const warningStrip = document.getElementById('warningStrip');
    
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeModal');
    const modalContent = document.getElementById('modalContent');

    const cardActionOverlay = document.getElementById('cardActionOverlay');
    const closeCardActionBtn = document.getElementById('closeCardAction');
    const viewInfoBtn = document.getElementById('viewInfoBtn');
    const viewDraftBtn = document.getElementById('viewDraftBtn');
    const cardActionTitle = document.getElementById('cardActionTitle');

    const draftViewOverlay = document.getElementById('draftViewOverlay');
    const closeDraftViewBtn = document.getElementById('closeDraftView');
    const draftViewCompany = document.getElementById('draftViewCompany');
    const draftViewEmail = document.getElementById('draftViewEmail');
    const draftEditSubject = document.getElementById('draftEditSubject');
    const draftEditMessage = document.getElementById('draftEditMessage');
    const draftSendBtn = document.getElementById('draftSendBtn');
    const draftScheduleBtn = document.getElementById('draftScheduleBtn');

    const reviewSheetOverlay = document.getElementById('reviewSheetOverlay');
    const draftListContainer = document.getElementById('draftListContainer');
    const closeReviewSheetBtn = document.getElementById('closeReviewSheet');
    const sendApprovedBtn = document.getElementById('sendApprovedBtn');
    const draftMessageBtn = document.getElementById('draftMessageBtn');
    const scheduleOutreachBtn = document.getElementById('scheduleOutreachBtn');
    const draftCountsEl = document.getElementById('draftCounts');
    
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    const aiSuggestStatus = document.getElementById('aiSuggestStatus');

    const sendAllDraftsWrapper = document.getElementById('sendAllDraftsWrapper');
    const sendAllDraftsBtn = document.getElementById('sendAllDraftsBtn');
    const scheduleAllDraftsBtn = document.getElementById('scheduleAllDraftsBtn');

    // Note: We are reusing the Review Sheet for scheduling now, 
    // so we don't strictly need separate schedule overlay elements unless you want a 2nd step.
    // For this implementation, we handle everything in the Review Sheet as requested.

    const filterDropdownBtn = document.getElementById('filterDropdownBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const currentFilterSpan = document.getElementById('currentFilter');
    const contextMenu = document.getElementById('contextMenu');
    const pinLeadBtn = document.getElementById('pinLeadBtn');
    const deleteLeadBtn = document.getElementById('deleteLeadBtn');

    // State
    let allLeadsData = []; 
    let savedLeadsEmails = new Set(); 
    let draftedEmails = new Map();
    let currentFilter = 'all';
    let longPressTimer;
    let selectedLeadIndex = null;
    let reviewDrafts = []; // Used for both sending and scheduling context
    let currentCardActionIndex = null;
    let isLoading = true;
    let countdownIntervals = {}; 

    const BACKEND = 'https://skylineapp-backend-file.onrender.com';
    const token = localStorage.getItem('token');

    // ═══════════════════════════════════════════════════════════
    // LIVE COUNTDOWN LOGIC
    // ═══════════════════════════════════════════════════════════
    function startCountdowns() {
        Object.values(countdownIntervals).forEach(clearInterval);
        countdownIntervals = {};

        allLeadsData.forEach((lead, index) => {
            if (lead.scheduledAt && lead.scheduleStatus === 'pending') {
                const card = document.querySelector(`.lead-card[data-index="${index}"]`);
                if (!card) return;

                let statusBadge = card.querySelector('.status-label.scheduled');
                if (!statusBadge) {
                    const rightCol = card.querySelector('.card-right');
                    if (rightCol) {
                        statusBadge = document.createElement('span');
                        statusBadge.className = 'status-label scheduled';
                        rightCol.insertBefore(statusBadge, rightCol.firstChild);
                    }
                }

                if (statusBadge) {
                    const timerId = setInterval(() => {
                        const now = new Date().getTime();
                        const scheduled = new Date(lead.scheduledAt).getTime();
                        const diff = scheduled - now;

                        if (diff <= 0) {
                            clearInterval(timerId);
                            statusBadge.textContent = 'Sent';
                            statusBadge.classList.remove('scheduled');
                            statusBadge.classList.add('sent');
                            lead.scheduleStatus = 'sent';
                        } else {
                            const hours = Math.floor(diff / (1000 * 60 * 60));
                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                            
                            let timeStr = '';
                            if (hours > 0) timeStr += `${hours}h `;
                            if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
                            timeStr += `${seconds}s`;
                            
                            statusBadge.textContent = `Scheduled · ${timeStr.trim()}`;
                        }
                    }, 1000);
                    countdownIntervals[lead.email] = timerId;
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DYNAMIC COMPANY LIST IN REVIEW SHEET
    // ═══════════════════════════════════════════════════════════
    function renderCompanyListInReviewSheet() {
        // Find or create container in review sheet
        let listContainer = document.getElementById('reviewCompanyList');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'reviewCompanyList';
            listContainer.className = 'company-list-container';
            
            // Insert after draft counts or warning panel
            const warningPanel = document.querySelector('.warning-panel');
            if (warningPanel) {
                reviewSheetOverlay.querySelector('.review-sheet').insertBefore(listContainer, warningPanel);
            } else {
                reviewSheetOverlay.querySelector('.review-sheet').appendChild(listContainer);
            }
        }
        
        listContainer.innerHTML = '';
        let approvedCount = 0;

        reviewDrafts.forEach((lead, index) => {
            const initial = lead.lead.companyName ? lead.lead.companyName.charAt(0).toUpperCase() : '?';
            const isApproved = lead.approved;
            if (isApproved) approvedCount++;

            const row = document.createElement('div');
            row.className = 'company-row';
            row.innerHTML = `
                <label class="row-checkbox-wrapper">
                    <input type="checkbox" class="row-checkbox" ${isApproved ? 'checked' : ''}>
                    <span class="row-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                </label>
                <div class="company-avatar">${initial}</div>
                <div class="company-info">
                    <div class="company-name-text">${lead.lead.companyName || 'Unknown'}</div>
                    <div class="company-email-text">${lead.lead.email || 'No email'}</div>
                </div>
                <button class="approve-btn ${isApproved ? 'approved' : ''}" data-index="${index}">
                    ${isApproved 
                        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Approved' 
                        : 'Approve'}
                </button>
            `;

            // Checkbox Logic
            const checkbox = row.querySelector('.row-checkbox');
            checkbox.addEventListener('change', function() {
                lead.approved = this.checked;
                renderCompanyListInReviewSheet();
                updateScheduleButtonState();
            });

            // Approve Button Logic
            const approveBtn = row.querySelector('.approve-btn');
            approveBtn.addEventListener('click', function() {
                lead.approved = !lead.approved;
                renderCompanyListInReviewSheet();
                updateScheduleButtonState();
            });

            listContainer.appendChild(row);
        });

        // Update button state based on approvals
        updateScheduleButtonState();
    }

    function updateScheduleButtonState() {
        const approvedCount = reviewDrafts.filter(l => l.approved).length;
        if (scheduleOutreachBtn) {
            if (approvedCount > 0) {
                scheduleOutreachBtn.disabled = false;
                scheduleOutreachBtn.classList.remove('disabled');
                scheduleOutreachBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Schedule ${approvedCount} email${approvedCount !== 1 ? 's' : ''}
                `;
            } else {
                scheduleOutreachBtn.disabled = true;
                scheduleOutreachBtn.classList.add('disabled');
                scheduleOutreachBtn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Schedule outreach
                `;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // THE SINGLE RENDER FUNCTION FOR ALL DRAFTS (Original)
    // ═══════════════════════════════════════════════════════════
    function renderDraftRows() {
        if (!draftListContainer) return;
        draftListContainer.innerHTML = '';
        
        reviewDrafts.forEach(function(draft) {
            const row = document.createElement('div');
            row.className = 'draft-row';
            row.setAttribute('data-draft-id', draft.id);

            const badgeHtml = draft.approved 
                ? `<div class="draft-status-badge approved">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                     <span>Approved</span>
                   </div>`
                : `<div class="draft-status-badge">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                     <span>Needs review</span>
                   </div>`;

            row.innerHTML = `
                <div class="draft-header">
                    <label class="draft-checkbox-wrapper">
                        <input type="checkbox" class="draft-checkbox" ${draft.approved ? 'checked' : ''}>
                        <span class="custom-checkbox draft-check">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                    </label>
                    <div class="draft-logo">
                        <span style="font-weight:700; font-size:16px; color:white;">${draft.lead.companyName ? draft.lead.companyName.charAt(0).toUpperCase() : '?'}</span>
                    </div>
                    <div class="draft-info">
                        <div class="draft-company">${draft.lead.companyName || 'Unknown'}</div>
                        <div class="draft-email">${draft.lead.email}</div>
                    </div>
                    ${badgeHtml}
                    <button type="button" class="expand-editor-btn" data-action="toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                </div>
                <div class="draft-editor" style="display: none;">
                    <div class="editor-field">
                        <label>Subject</label>
                        <input type="text" class="subject-input" value="${String(draft.subject).replace(/"/g, '&quot;')}">
                    </div>
                    <div class="editor-field">
                        <label>Message</label>
                        <textarea class="message-input">${draft.body}</textarea>
                    </div>
                </div>
            `;

            const subjectInput = row.querySelector('.subject-input');
            const messageTextarea = row.querySelector('.message-input');
            const checkbox = row.querySelector('.draft-checkbox');
            const expandBtn = row.querySelector('.expand-editor-btn');
            const editorDiv = row.querySelector('.draft-editor');
            const arrowSvg = expandBtn.querySelector('svg');

            subjectInput._draftRef = draft;
            messageTextarea._draftRef = draft;
            checkbox._draftRef = draft;

            draft._subjectInputEl = subjectInput;
            draft._messageInputEl = messageTextarea;
            draft._checkboxEl = checkbox;

            expandBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (editorDiv.style.display === 'none' || !editorDiv.style.display) {
                    editorDiv.style.display = 'block';
                    arrowSvg.style.transform = 'rotate(180deg)';
                } else {
                    editorDiv.style.display = 'none';
                    arrowSvg.style.transform = 'rotate(0deg)';
                }
            });

            checkbox.addEventListener('change', function() {
                draft.approved = this.checked;
                const badge = row.querySelector('.draft-status-badge');
                if (badge) {
                    if (draft.approved) {
                        badge.className = 'draft-status-badge approved';
                        badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Approved</span>`;
                    } else {
                        badge.className = 'draft-status-badge';
                        badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Needs review</span>`;
                    }
                }
                updateSendButtonState();
                updateScheduleButtonState(); // Sync both buttons
            });

            subjectInput.addEventListener('input', function() {
                draft.subject = this.value;
                updateSendButtonState();
            });
            messageTextarea.addEventListener('input', function() {
                draft.body = this.value;
                updateSendButtonState();
            });

            draftListContainer.appendChild(row);
        });
    }

    // ── Load Data ──
    async function initData() {
        isLoading = true;
        renderSkeletons(5);

        try {
            const storedData = localStorage.getItem('skyline_leads_data');
            if (storedData) {
                allLeadsData = JSON.parse(storedData);
            }
        } catch (e) {
            console.error('Failed to parse local lead data:', e);
        }

        if (token) {
            try {
                const res = await fetch(`${BACKEND}/api/leads/saved`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const data = await res.json();
                    savedLeadsEmails = new Set(data.data.map(l => l.email));
                }
            } catch (e) {
                console.error('Failed to fetch saved leads:', e);
            }
        }

        if (token) {
            try {
                const res = await fetch(`${BACKEND}/api/leads/drafts`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    const data = await res.json();
                    draftedEmails = new Map();
                    (data.data || []).forEach(d => {
                        draftedEmails.set(d.email, { subject: d.subject, message: d.message });
                    });
                }
            } catch (e) {
                console.error('Failed to fetch drafts:', e);
            }
        }

        isLoading = false;
        renderLeads();
        startCountdowns();
    }

    function renderSkeletons(count) {
        if (!leadsList) return;
        leadsList.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.innerHTML = `
                <div class="skeleton-left">
                    <div class="skeleton-checkbox skeleton-animate"></div>
                    <div class="skeleton-logo skeleton-animate"></div>
                </div>
                <div class="skeleton-center">
                    <div class="skeleton-line long skeleton-animate"></div>
                    <div class="skeleton-line medium skeleton-animate"></div>
                    <div class="skeleton-line short skeleton-animate"></div>
                    <div class="skeleton-badge skeleton-animate"></div>
                </div>
                <div class="skeleton-right">
                    <div class="skeleton-btn skeleton-animate"></div>
                </div>
            `;
            leadsList.appendChild(skeleton);
        }
    }

    function getStatusLabel(lead) {
        const isSaved = savedLeadsEmails.has(lead.email);
        const isDraft = draftedEmails.has(lead.email);
        if (isSaved && isDraft) return '<span class="status-label combined">Saved & Draft</span>';
        if (isDraft) return '<span class="status-label draft">Draft</span>';
        if (isSaved) return '<span class="status-label saved">Saved</span>';
        return '<span class="status-label recent">Recent</span>';
    }

    function renderLeads() {
        if (!leadsList) return;
        leadsList.innerHTML = '';

        let displayLeads = [];
        if (currentFilter === 'all') displayLeads = [...allLeadsData];
        else if (currentFilter === 'saved') displayLeads = allLeadsData.filter(lead => savedLeadsEmails.has(lead.email));
        else if (currentFilter === 'recent') displayLeads = allLeadsData.filter(lead => !savedLeadsEmails.has(lead.email) && !draftedEmails.has(lead.email));
        else if (currentFilter === 'draft') displayLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));

        if (sendAllDraftsWrapper) {
            sendAllDraftsWrapper.style.display = currentFilter === 'draft' ? 'flex' : 'none';
        }

        if (displayLeads.length === 0) {
            leadsList.innerHTML = '<div style="text-align:center; padding:40px; color:#9697A1;">No leads found for this filter.</div>';
            return;
        }

        const countEl = document.getElementById('resultsCount');
        if (countEl) countEl.textContent = `${displayLeads.length} prospects found`;

        displayLeads.forEach((lead) => {
            const originalIndex = allLeadsData.indexOf(lead);
            const card = document.createElement('div');
            card.className = 'lead-card';
            card.setAttribute('data-index', originalIndex);

            let badgeClass = 'low';
            let badgeText = 'Needs verification';
            if (lead.emailStatus === 'verified') {
                badgeClass = 'high';
                badgeText = 'High confidence';
            } else if (lead.email && lead.email.includes('@')) {
                badgeClass = 'medium';
                badgeText = 'Medium confidence';
            }

            const statusLabel = getStatusLabel(lead);
            const emailDisplay = lead.email || 'No email found';

            card.innerHTML = `
                <div class="card-left">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" class="lead-checkbox">
                        <span class="custom-checkbox">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                    </label>
                    <div class="company-logo">
                        <span style="font-weight:700; font-size:18px; color:white;">${lead.companyName ? lead.companyName.charAt(0).toUpperCase() : '?'}</span>
                    </div>
                </div>
                <div class="card-center">
                    <h3 class="company-name">${lead.companyName || 'Unknown Company'}</h3>
                    <div class="info-row email">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9697A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <span>${emailDisplay}</span>
                    </div>
                    <div class="confidence-badge ${badgeClass}">
                        <span class="dot"></span>
                        <span>${badgeText}</span>
                    </div>
                </div>
                <div class="card-right">
                    ${statusLabel}
                    <button class="view-btn">
                        More
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            `;
            leadsList.appendChild(card);
        });

        initSelectionLogic();
        initLongPressLogic();
        startCountdowns();
    }

    // ... [Existing Modal Logic: openDetailsModal, closeModal, etc.] ...
    function openDetailsModal(index) {
        const lead = allLeadsData[index];
        if (!lead || !modalOverlay || !modalContent) return;
        const phone = lead.phoneNumber || 'Not publicly listed';
        const info = lead.companyInformation || 'No additional information available.';
        const email = lead.email || 'No email found';
        modalContent.innerHTML = `
            <h2 style="margin-bottom:16px; color:white; font-size:1.2rem;">${lead.companyName}</h2>
            <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #2D2F33;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Email Address</div>
                <div style="color:white; font-size:1rem; word-break:break-all;">${email}</div>
                <div style="color:${lead.emailStatus === 'verified' ? '#22C55E' : '#FFAA00'}; font-size:0.75rem; margin-top:4px;">Status: ${lead.emailStatus || 'unknown'}</div>
            </div>
            <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #2D2F33;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Phone Number</div>
                <div style="color:white; font-size:1rem;">${phone}</div>
            </div>
            <div>
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Company Information</div>
                <div style="color:white; font-size:0.9rem; line-height:1.6;">${info}</div>
            </div>
        `;
        modalOverlay.style.display = 'flex';
    }

    function closeModal() { if (modalOverlay) modalOverlay.style.display = 'none'; }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeModal(); });

    function openCardActionModal(index) {
        const lead = allLeadsData[index];
        if (!lead || !cardActionOverlay) return;
        currentCardActionIndex = index;
        if (cardActionTitle) cardActionTitle.textContent = lead.companyName || 'Choose an action';
        cardActionOverlay.style.display = 'flex';
    }
    function closeCardActionModal() { if (cardActionOverlay) cardActionOverlay.style.display = 'none'; currentCardActionIndex = null; }
    if (closeCardActionBtn) closeCardActionBtn.addEventListener('click', closeCardActionModal);
    if (cardActionOverlay) cardActionOverlay.addEventListener('click', function(e) { if (e.target === cardActionOverlay) closeCardActionModal(); });

    if (viewInfoBtn) viewInfoBtn.addEventListener('click', function() { if (currentCardActionIndex !== null) { closeCardActionModal(); openDetailsModal(currentCardActionIndex); } });
    if (viewDraftBtn) viewDraftBtn.addEventListener('click', function() { if (currentCardActionIndex !== null) { const lead = allLeadsData[currentCardActionIndex]; closeCardActionModal(); openDraftViewModal(lead); } });

    function openDraftViewModal(lead) {
        if (!lead || !draftViewOverlay) return;
        const draft = draftedEmails.get(lead.email) || { subject: '', message: '' };
        if (draftViewCompany) draftViewCompany.textContent = lead.companyName || 'Unknown';
        if (draftViewEmail) draftViewEmail.textContent = lead.email || '';
        if (draftEditSubject) draftEditSubject.value = draft.subject;
        if (draftEditMessage) draftEditMessage.value = draft.message;
        draftViewOverlay.style.display = 'flex';
    }
    function closeDraftViewModal() { if (draftViewOverlay) draftViewOverlay.style.display = 'none'; }
    if (closeDraftViewBtn) closeDraftViewBtn.addEventListener('click', closeDraftViewModal);
    if (draftViewOverlay) draftViewOverlay.addEventListener('click', function(e) { if (e.target === draftViewOverlay) closeDraftViewModal(); });

    if (draftSendBtn) {
        draftSendBtn.addEventListener('click', async function() {
            if (!token) return;
            const company = draftViewCompany ? draftViewCompany.textContent : '';
            const email = draftViewEmail ? draftViewEmail.textContent : '';
            const subject = draftEditSubject ? draftEditSubject.value : '';
            const message = draftEditMessage ? draftEditMessage.value : '';
            if (!email || !message.trim()) { alert('Please enter a message before sending.'); return; }
            const originalText = draftSendBtn.innerHTML;
            draftSendBtn.innerHTML = '<span>Sending...</span>';
            draftSendBtn.disabled = true;
            try {
                const res = await fetch(BACKEND + '/api/leads/batch-send', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leads: [{ name: company, email: email, company: company, messages: [{ subject: subject, body: message }] }] })
                });
                if (res.ok) {
                    await fetch(BACKEND + '/api/leads/draft', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
                    draftedEmails.delete(email);
                    closeDraftViewModal();
                    renderLeads();
                } else { alert('Failed to send message.'); }
            } catch (e) { console.error('Send error:', e); alert('Network error while sending.'); }
            finally { draftSendBtn.innerHTML = originalText; draftSendBtn.disabled = false; }
        });
    }

    if (draftScheduleBtn) {
        draftScheduleBtn.addEventListener('click', function() {
            const company = draftViewCompany ? draftViewCompany.textContent : '';
            const email = draftViewEmail ? draftViewEmail.textContent : '';
            const subject = draftEditSubject ? draftEditSubject.value : '';
            const message = draftEditMessage ? draftEditMessage.value : '';
            if (!email) return;
            
            // Add to review drafts and open sheet
            const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            reviewDrafts = [{
                id: draftId,
                lead: { companyName: company, email: email },
                subject: subject,
                body: message,
                approved: true,
                _subjectInputEl: null, _messageInputEl: null, _checkboxEl: null
            }];
            
            renderDraftRows();
            renderCompanyListInReviewSheet();
            draftViewOverlay.style.display = 'none';
            reviewSheetOverlay.style.display = 'flex';
        });
    }

    if (leadsList) {
        leadsList.addEventListener('click', function(e) {
            if (e.target.closest('.checkbox-wrapper') || e.target.closest('.view-btn')) return;
            const card = e.target.closest('.lead-card');
            if (card) {
                const index = parseInt(card.getAttribute('data-index'));
                const lead = allLeadsData[index];
                if (lead && draftedEmails.has(lead.email)) { openCardActionModal(index); }
                else { openDetailsModal(index); }
            }
        });
    }

    function initSelectionLogic() {
        const leadCheckboxes = document.querySelectorAll('.lead-checkbox');
        function updateSelectionState() {
            const total = leadCheckboxes.length;
            const checked = Array.from(leadCheckboxes).filter(cb => cb.checked).length;
            if (selectCountSpan) selectCountSpan.textContent = `${checked} selected`;
            if (selectAllCheckbox) {
                if (checked === 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; }
                else if (checked === total) { selectAllCheckbox.checked = true; selectAllCheckbox.indeterminate = false; }
                else { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = true; }
            }
            const hasSelection = checked > 0;
            if (saveLeadsBtn) { saveLeadsBtn.disabled = !hasSelection; saveLeadsBtn.style.opacity = hasSelection ? '1' : '0.5'; }
            if (sendBtn) { sendBtn.disabled = !hasSelection; sendBtn.style.opacity = hasSelection ? '1' : '0.5'; }
        }
        if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', function() { const isChecked = this.checked; leadCheckboxes.forEach(cb => { cb.checked = isChecked; }); updateSelectionState(); });
        leadCheckboxes.forEach(cb => { cb.addEventListener('change', updateSelectionState); });
        updateSelectionState();
    }

    function initLongPressLogic() {
        const cards = document.querySelectorAll('.lead-card');
        cards.forEach(card => {
            card.addEventListener('mousedown', startPress);
            card.addEventListener('touchstart', startPress, {passive: true});
            card.addEventListener('mouseup', cancelPress);
            card.addEventListener('mouseleave', cancelPress);
            card.addEventListener('touchend', cancelPress);
        });
    }
    function startPress(e) { const card = e.currentTarget; selectedLeadIndex = parseInt(card.getAttribute('data-index')); longPressTimer = setTimeout(() => { showContextMenu(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY); }, 600); }
    function cancelPress() { clearTimeout(longPressTimer); }
    function showContextMenu(x, y) { contextMenu.style.left = `${x}px`; contextMenu.style.top = `${y}px`; contextMenu.style.display = 'block'; }
    document.addEventListener('click', function(e) { if (!e.target.closest('.context-menu')) { contextMenu.style.display = 'none'; } });
    if (pinLeadBtn) pinLeadBtn.addEventListener('click', function() { if (selectedLeadIndex !== null) { const lead = allLeadsData[selectedLeadIndex]; allLeadsData.splice(selectedLeadIndex, 1); allLeadsData.unshift(lead); renderLeads(); contextMenu.style.display = 'none'; } });
    if (deleteLeadBtn) deleteLeadBtn.addEventListener('click', async function() { if (selectedLeadIndex !== null && token) { const lead = allLeadsData[selectedLeadIndex]; allLeadsData.splice(selectedLeadIndex, 1); renderLeads(); contextMenu.style.display = 'none'; try { await fetch(`${BACKEND}/api/leads/${lead.email}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: lead.email, companyName: lead.companyName }) }); } catch (e) { console.error('Failed to delete from backend:', e); } } });

    if (filterDropdownBtn) filterDropdownBtn.addEventListener('click', function(e) { e.stopPropagation(); filterDropdown.classList.toggle('show'); });
    document.addEventListener('click', function(e) { if (!e.target.closest('.dropdown-wrapper')) { filterDropdown.classList.remove('show'); } });
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => { item.addEventListener('click', function() { const value = this.getAttribute('data-value'); currentFilter = value; dropdownItems.forEach(i => i.classList.remove('active')); this.classList.add('active'); currentFilterSpan.textContent = this.textContent; renderLeads(); filterDropdown.classList.remove('show'); }); });

    if (saveLeadsBtn) {
        saveLeadsBtn.addEventListener('click', async function() {
            if (this.disabled || !token) return;
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            if (selectedCards.length === 0) return;
            const leadsToSave = [];
            selectedCards.forEach(cb => { const card = cb.closest('.lead-card'); const index = parseInt(card.getAttribute('data-index')); leadsToSave.push(allLeadsData[index]); });
            saveBtnText.textContent = 'Saving...'; saveLeadsBtn.disabled = true;
            leadsToSave.forEach(l => savedLeadsEmails.add(l.email));
            renderLeads();
            try { await fetch(`${BACKEND}/api/leads/save`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: leadsToSave }) }); saveBtnText.textContent = 'Saved'; setTimeout(() => { saveBtnText.textContent = 'Save leads'; }, 2000); } catch (e) { console.error('Save error:', e); saveBtnText.textContent = 'Error'; } finally { saveLeadsBtn.disabled = false; }
        });
    }

    function checkMessagesHaveText() { return reviewDrafts.some(d => d.body && d.body.trim().length > 0); }
    function updateSendButtonState() {
        const anyChecked = reviewDrafts.some(d => d.approved);
        const hasText = checkMessagesHaveText();
        if (sendApprovedBtn) { if (anyChecked && hasText) { sendApprovedBtn.disabled = false; sendApprovedBtn.classList.remove('disabled'); } else { sendApprovedBtn.disabled = true; sendApprovedBtn.classList.add('disabled'); } }
    }

    function closeReviewSheet() { 
        if (reviewSheetOverlay) reviewSheetOverlay.style.display = 'none'; 
        // Remove dynamic company list if it exists
        const listContainer = document.getElementById('reviewCompanyList');
        if (listContainer) listContainer.remove();
        
        reviewDrafts.forEach(d => { d._subjectInputEl = null; d._messageInputEl = null; d._checkboxEl = null; }); 
    }
    
    function openReviewSheet() {
        const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
        if (selectedCards.length === 0) return;
        reviewDrafts = [];
        selectedCards.forEach(cb => {
            const card = cb.closest('.lead-card');
            const index = parseInt(card.getAttribute('data-index'));
            const lead = allLeadsData[index];
            if (!lead.email) return;
            const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            reviewDrafts.push({ id: draftId, lead: lead, subject: 'Partnership Inquiry', body: 'Hi ' + (lead.companyName || '') + ',\n\nI came across your company and was impressed by your work. I would love to discuss a potential partnership.\n\nBest regards,\nSkyline AI User', approved: true, _subjectInputEl: null, _messageInputEl: null, _checkboxEl: null });
        });
        renderDraftRows();
        renderCompanyListInReviewSheet(); // Render company list for scheduling
        if (draftCountsEl) draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 sent';
        reviewSheetOverlay.style.display = 'flex';
        updateSendButtonState();
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            const missingEmails = [];
            selectedCards.forEach(cb => { const card = cb.closest('.lead-card'); const index = parseInt(card.getAttribute('data-index')); const lead = allLeadsData[index]; if (!lead.email) missingEmails.push(lead.companyName || 'Unknown Company'); });
            if (missingEmails.length > 0) { alert('Cannot send to:\n\n- ' + missingEmails.join('\n- ')); return; }
            openReviewSheet();
        });
    }

    if (closeReviewSheetBtn) closeReviewSheetBtn.addEventListener('click', closeReviewSheet);
    window.toggleEditor = function(btn) { const editor = btn.closest('.draft-row').querySelector('.draft-editor'); const arrow = btn.querySelector('svg'); if (editor.style.display === 'none' || !editor.style.display) { editor.style.display = 'block'; arrow.style.transform = 'rotate(180deg)'; } else { editor.style.display = 'none'; arrow.style.transform = 'rotate(0deg)'; } };

    if (sendApprovedBtn) {
        sendApprovedBtn.addEventListener('click', async function() {
            if (this.disabled || this.classList.contains('disabled')) return;
            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) return;
            const originalText = sendApprovedBtn.innerHTML;
            sendApprovedBtn.innerHTML = '<span>Sending...</span>';
            sendApprovedBtn.disabled = true;
            const leadsToSend = approvedDrafts.map(d => ({ name: d.lead.companyName, email: d.lead.email, company: d.lead.companyName, messages: [{ subject: d.subject, body: d.body }] }));
            try {
                const res = await fetch(BACKEND + '/api/leads/batch-send', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: leadsToSend }) });
                if (res.ok) { closeReviewSheet(); document.querySelectorAll('.lead-checkbox:checked').forEach(cb => { cb.checked = false; }); initSelectionLogic(); } else { const errData = await res.json(); alert('Failed to send: ' + (errData.message || 'Unknown error')); }
            } catch (e) { console.error('Send error:', e); alert('Network error while sending.'); }
            finally { sendApprovedBtn.innerHTML = originalText; sendApprovedBtn.disabled = false; updateSendButtonState(); }
        });
    }

    // ✅ FIXED: Schedule Button now validates and submits from Review Sheet
    if (scheduleOutreachBtn) {
        scheduleOutreachBtn.addEventListener('click', async function() {
            // Validate approval
            const unapproved = reviewDrafts.filter(d => !d.approved);
            if (unapproved.length > 0) {
                const names = unapproved.map(d => d.lead.companyName).join(', ');
                alert(`⚠️ Please approve all companies before scheduling:\n\n${names}`);
                return;
            }

            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) { alert('Please approve at least one draft.'); return; }
            
            // Prepare payload with default scheduling settings
            const payload = {
                scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default to tomorrow
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                paceMinutes: 5,
                safetyRules: { stopOnReply: true, stopOnUnsubscribe: true, skipMissingEmail: true },
                leads: approvedDrafts.map(d => ({
                    companyName: d.lead.companyName,
                    email: d.lead.email,
                    subject: d.subject,
                    message: d.body,
                    approved: true
                }))
            };

            await submitSchedule(payload);
        });
    }

    async function submitSchedule(payload) {
        if (!token) return;
        const originalText = scheduleOutreachBtn.innerHTML;
        scheduleOutreachBtn.innerHTML = '<span>Scheduling...</span>';
        scheduleOutreachBtn.disabled = true;

        try {
            const res = await fetch(`${BACKEND}/api/leads/schedule`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to schedule');

            // Update local data for countdown
            if (data.leads && Array.isArray(data.leads)) {
                data.leads.forEach(scheduledLead => {
                    const leadInList = allLeadsData.find(l => l.email === scheduledLead.email);
                    if (leadInList) {
                        leadInList.scheduledAt = scheduledLead.scheduledAt;
                        leadInList.scheduleStatus = scheduledLead.scheduleStatus;
                    }
                });
            }

            closeReviewSheet();
            renderLeads();
            alert('Outreach scheduled successfully!');

        } catch (e) {
            console.error('Schedule error:', e);
            alert(e.message || 'Failed to schedule outreach.');
        } finally {
            scheduleOutreachBtn.innerHTML = originalText;
            scheduleOutreachBtn.disabled = false;
        }
    }

    if (draftMessageBtn) {
        draftMessageBtn.addEventListener('click', async function() {
            if (!token) { closeReviewSheet(); return; }
            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) { closeReviewSheet(); return; }
            const originalText = draftMessageBtn.innerHTML;
            draftMessageBtn.innerHTML = '<span>Saving...</span>';
            draftMessageBtn.disabled = true;
            try {
                for (const draft of approvedDrafts) {
                    await fetch(BACKEND + '/api/leads/draft', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: draft.lead.companyName, email: draft.lead.email, subject: draft.subject, message: draft.body }) });
                    draftedEmails.set(draft.lead.email, { subject: draft.subject, message: draft.body });
                }
                closeReviewSheet();
                renderLeads();
            } catch (e) { console.error('Save draft error:', e); alert('Failed to save drafts.'); }
            finally { draftMessageBtn.innerHTML = originalText; draftMessageBtn.disabled = false; }
        });
    }

    if (sendAllDraftsBtn) {
        sendAllDraftsBtn.addEventListener('click', function() {
            const draftLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));
            if (draftLeads.length === 0) { alert('No draft messages to send.'); return; }
            reviewDrafts = draftLeads.map(lead => { const draft = draftedEmails.get(lead.email); const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9); return { id: draftId, lead: lead, subject: draft.subject, body: draft.message, approved: true, _subjectInputEl: null, _messageInputEl: null, _checkboxEl: null }; });
            renderDraftRows();
            renderCompanyListInReviewSheet();
            if (draftCountsEl) draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 sent';
            updateSendButtonState();
            reviewSheetOverlay.style.display = 'flex';
        });
    }

    if (scheduleAllDraftsBtn) {
        scheduleAllDraftsBtn.addEventListener('click', function() {
            const draftLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));
            if (draftLeads.length === 0) { alert('No draft messages to schedule.'); return; }
            
            // Open review sheet first for verification
            reviewDrafts = draftLeads.map(lead => { const draft = draftedEmails.get(lead.email); const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9); return { id: draftId, lead: lead, subject: draft.subject, body: draft.message, approved: true, _subjectInputEl: null, _messageInputEl: null, _checkboxEl: null }; });
            renderDraftRows();
            renderCompanyListInReviewSheet();
            if (draftCountsEl) draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 scheduled';
            updateSendButtonState();
            reviewSheetOverlay.style.display = 'flex';
        });
    }

    // ═══════════════════════════════════════════════════════════
    // AI SUGGESTION LOGIC
    // ═══════════════════════════════════════════════════════════
    if (aiSuggestBtn) {
        aiSuggestBtn.addEventListener('click', async function() {
            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) { alert('Please approve at least one draft before requesting AI suggestions.'); return; }
            const originalBtnHTML = aiSuggestBtn.innerHTML;
            aiSuggestBtn.disabled = true;
            aiSuggestBtn.innerHTML = '<span class="spinner"></span> Generating...';
            if (aiSuggestStatus) aiSuggestStatus.textContent = `Generating ${approvedDrafts.length} personalized messages...`;
            try {
                const payload = { count: approvedDrafts.length, leads: approvedDrafts.map(d => ({ companyName: d.lead.companyName || '', email: d.lead.email || '', industry: d.lead.industry || '' })) };
                const res = await fetch(BACKEND + '/api/ai/suggest-outreach', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to generate suggestions');
                if (!data.drafts || !Array.isArray(data.drafts)) throw new Error('Invalid response: missing drafts array');
                
                let updatedCount = 0;
                data.drafts.forEach(aiDraft => {
                    const draft = reviewDrafts.find(d => d.lead.email === aiDraft.leadEmail);
                    if (!draft) return;
                    draft.subject = aiDraft.subject;
                    draft.body = aiDraft.message;
                    if (draft._subjectInputEl) draft._subjectInputEl.value = aiDraft.subject;
                    if (draft._messageInputEl) draft._messageInputEl.value = aiDraft.message;
                    updatedCount++;
                });
                if (aiSuggestStatus) aiSuggestStatus.textContent = `✅ ${updatedCount}/${approvedDrafts.length} drafts updated · ${data.remainingCalls ?? '?'} remaining today`;
                if (updatedCount > 0) { aiSuggestBtn.style.backgroundColor = '#22C55E'; setTimeout(() => { aiSuggestBtn.style.backgroundColor = ''; }, 800); updateSendButtonState(); }
            } catch (err) { console.error('❌ AI Suggestion Error:', err); alert(err.message || 'Failed to generate AI suggestions.'); if (aiSuggestStatus) aiSuggestStatus.textContent = '❌ Failed. Try again.'; }
            finally { aiSuggestBtn.disabled = false; aiSuggestBtn.innerHTML = originalBtnHTML; }
        });
    }

    if (closeWarningBtn && warningStrip) closeWarningBtn.addEventListener('click', function() { warningStrip.style.display = 'none'; });

    // Init
    initData();
});

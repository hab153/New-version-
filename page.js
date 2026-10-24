// ============================================================
// page.js - Skyline AI · Lead Discovery Dashboard
// UPDATED: Full Leads Logic + High-Fi Schedule Modal
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ─ DOM Elements ──
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

    // ✅ HIGH-FI SCHEDULE MODAL ELEMENTS
    const scheduleOverlay = document.getElementById('scheduleOverlay');
    const closeScheduleSheetBtn = document.getElementById('closeScheduleSheetBtn');
    const scheduleCancelBtn = document.getElementById('scheduleCancelBtn');
    const scheduleConfirmBtn = document.getElementById('scheduleConfirmBtn');
    const scheduleSubtitle = document.getElementById('scheduleSubtitle');
    const summaryPrimaryText = document.getElementById('summaryPrimaryText');
    const companyListContainer = document.getElementById('companyListContainer');
    const selectedDateText = document.getElementById('selectedDateText');
    const selectedTimeText = document.getElementById('selectedTimeText');
    const selectedTimezoneText = document.getElementById('selectedTimezoneText');
    const selectedPaceText = document.getElementById('selectedPaceText');
    const scheduleDateInput = document.getElementById('scheduleDateInput');
    const scheduleTimeInput = document.getElementById('scheduleTimeInput');
    const scheduleTimezoneSelect = document.getElementById('scheduleTimezoneSelect');
    const schedulePaceSelect = document.getElementById('schedulePaceSelect');
    const ruleStopReply = document.getElementById('ruleStopReply');
    const ruleStopUnsubscribe = document.getElementById('ruleStopUnsubscribe');
    const ruleSkipMissing = document.getElementById('ruleSkipMissing');

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
    let reviewDrafts = [];
    let currentCardActionIndex = null;
    let isLoading = true;
    let scheduleContext = { type: '', leads: [] };
    let countdownIntervals = {}; // Store intervals for cleanup

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
    // DYNAMIC COMPANY LIST RENDERING (HIGH-FI SCHEDULE MODAL)
    // ═══════════════════════════════════════════════════════════
    function renderCompanyList() {
        if (!companyListContainer) return;
        companyListContainer.innerHTML = '';

        let approvedCount = 0;

        scheduleContext.leads.forEach((lead, index) => {
            const initial = lead.companyName ? lead.companyName.charAt(0).toUpperCase() : '?';
            const isApproved = lead.approved;
            if (isApproved) approvedCount++;

            const row = document.createElement('div');
            row.className = 'company-row';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'row-header';
            headerDiv.innerHTML = `
                <label style="position: relative; width: 24px; height: 24px; flex-shrink: 0;">
                    <input type="checkbox" class="row-checkbox" ${isApproved ? 'checked' : ''}>
                    <span class="row-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                </label>
                <div class="company-avatar">${initial}</div>
                <div class="company-info">
                    <div class="company-name">${lead.companyName || 'Unknown'}</div>
                    <div class="company-email">${lead.email || 'No email'}</div>
                </div>
                <button class="approve-btn ${isApproved ? 'approved' : ''}" data-index="${index}">
                    ${isApproved 
                        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Approved' 
                        : 'Approve'}
                </button>
                <button class="expand-toggle" data-index="${index}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
            `;

            const editorDiv = document.createElement('div');
            editorDiv.className = 'draft-editor';
            editorDiv.innerHTML = `
                <div class="editor-field">
                    <label>Subject</label>
                    <input type="text" class="schedule-subject-input" value="${lead.subject || ''}">
                </div>
                <div class="editor-field">
                    <label>Message</label>
                    <textarea class="schedule-message-input">${lead.message || ''}</textarea>
                </div>
            `;

            row.appendChild(headerDiv);
            row.appendChild(editorDiv);
            companyListContainer.appendChild(row);

            // Event Listeners
            const checkbox = row.querySelector('.row-checkbox');
            checkbox.addEventListener('change', function() {
                lead.approved = this.checked;
                renderCompanyList();
            });

            const approveBtn = row.querySelector('.approve-btn');
            approveBtn.addEventListener('click', function() {
                lead.approved = !lead.approved;
                renderCompanyList();
            });

            const toggleBtn = row.querySelector('.expand-toggle');
            const companyInfo = row.querySelector('.company-info');
            
            const toggleEditor = () => {
                editorDiv.classList.toggle('visible');
                toggleBtn.classList.toggle('rotated');
            };

            toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleEditor(); });
            companyInfo.addEventListener('click', toggleEditor);

            const subjectInput = row.querySelector('.schedule-subject-input');
            const messageInput = row.querySelector('.schedule-message-input');

            subjectInput.addEventListener('input', function() { lead.subject = this.value; });
            messageInput.addEventListener('input', function() { lead.message = this.value; });
        });

        if (scheduleSubtitle) scheduleSubtitle.textContent = `${approvedCount} approved emails`;
        if (summaryPrimaryText) summaryPrimaryText.textContent = `${approvedCount} emails will be sent separately`;
        
        if (scheduleConfirmBtn) {
            const btnText = approvedCount === 1 ? 'Schedule 1 email' : `Schedule ${approvedCount} emails`;
            scheduleConfirmBtn.querySelector('span').textContent = btnText;
            scheduleConfirmBtn.disabled = approvedCount === 0;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // THE SINGLE RENDER FUNCTION FOR ALL DRAFTS (REVIEW SHEET)
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
            });

            subjectInput.addEventListener('input', function() { draft.subject = this.value; updateSendButtonState(); });
            messageTextarea.addEventListener('input', function() { draft.body = this.value; updateSendButtonState(); });

            draftListContainer.appendChild(row);
        });
    }

    // ── Load Data ──
    async function initData() {
        isLoading = true;
        renderSkeletons(5);

        try {
            const storedData = localStorage.getItem('skyline_leads_data');
            if (storedData) allLeadsData = JSON.parse(storedData);
        } catch (e) { console.error('Failed to parse local lead data:', e); }

        if (token) {
            try {
                const res = await fetch(`${BACKEND}/api/leads/saved`, { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) {
                    const data = await res.json();
                    savedLeadsEmails = new Set(data.data.map(l => l.email));
                }
            } catch (e) { console.error('Failed to fetch saved leads:', e); }
        }

        if (token) {
            try {
                const res = await fetch(`${BACKEND}/api/leads/drafts`, { headers: { 'Authorization': 'Bearer ' + token } });
                if (res.ok) {
                    const data = await res.json();
                    draftedEmails = new Map();
                    (data.data || []).forEach(d => { draftedEmails.set(d.email, { subject: d.subject, message: d.message }); });
                }
            } catch (e) { console.error('Failed to fetch drafts:', e); }
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

        if (sendAllDraftsWrapper) sendAllDraftsWrapper.style.display = currentFilter === 'draft' ? 'flex' : 'none';

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
            if (lead.emailStatus === 'verified') { badgeClass = 'high'; badgeText = 'High confidence'; }
            else if (lead.email && lead.email.includes('@')) { badgeClass = 'medium'; badgeText = 'Medium confidence'; }

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

    function openDetailsModal(index) {
        const lead = allLeadsData[index];
        if (!lead || !modalOverlay || !modalContent) return;
        modalContent.innerHTML = `
            <h2 style="margin-bottom:16px; color:white; font-size:1.2rem;">${lead.companyName}</h2>
            <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #2D2F33;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Email Address</div>
                <div style="color:white; font-size:1rem; word-break:break-all;">${lead.email || 'No email found'}</div>
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

    function closeCardActionModal() {
        if (cardActionOverlay) cardActionOverlay.style.display = 'none';
        currentCardActionIndex = null;
    }

    if (closeCardActionBtn) closeCardActionBtn.addEventListener('click', closeCardActionModal);
    if (cardActionOverlay) cardActionOverlay.addEventListener('click', function(e) { if (e.target === cardActionOverlay) closeCardActionModal(); });

    if (viewInfoBtn) {
        viewInfoBtn.addEventListener('click', function() {
            if (currentCardActionIndex !== null) {
                closeCardActionModal();
                openDetailsModal(currentCardActionIndex);
            }
        });
    }

    if (viewDraftBtn) {
        viewDraftBtn.addEventListener('click', function() {
            if (currentCardActionIndex !== null) {
                const lead = allLeadsData[currentCardActionIndex];
                closeCardActionModal();
                if (lead && draftedEmails.has(lead.email)) {
                    const draft = draftedEmails.get(lead.email);
                    if (draftViewCompany) draftViewCompany.textContent = lead.companyName || 'Unknown';
                    if (draftViewEmail) draftViewEmail.textContent = lead.email || '';
                    if (draftEditSubject) draftEditSubject.value = draft.subject;
                    if (draftEditMessage) draftEditMessage.value = draft.message;
                    draftViewOverlay.style.display = 'flex';
                }
            }
        });
    }

    if (closeDraftViewBtn) closeDraftViewBtn.addEventListener('click', function() { if (draftViewOverlay) draftViewOverlay.style.display = 'none'; });
    if (draftViewOverlay) draftViewOverlay.addEventListener('click', function(e) { if (e.target === draftViewOverlay) { if (draftViewOverlay) draftViewOverlay.style.display = 'none'; } });

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
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                const isChecked = this.checked;
                leadCheckboxes.forEach(cb => { cb.checked = isChecked; });
                updateSelectionState();
            });
        }
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

    function startPress(e) {
        const card = e.currentTarget;
        selectedLeadIndex = parseInt(card.getAttribute('data-index'));
        longPressTimer = setTimeout(() => {
            showContextMenu(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY);
        }, 600);
    }

    function cancelPress() { clearTimeout(longPressTimer); }
    function showContextMenu(x, y) {
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
    }

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.context-menu')) {
            contextMenu.style.display = 'none';
        }
    });

    if (pinLeadBtn) {
        pinLeadBtn.addEventListener('click', function() {
            if (selectedLeadIndex !== null) {
                const lead = allLeadsData[selectedLeadIndex];
                allLeadsData.splice(selectedLeadIndex, 1);
                allLeadsData.unshift(lead);
                renderLeads();
                contextMenu.style.display = 'none';
            }
        });
    }

    if (deleteLeadBtn) {
        deleteLeadBtn.addEventListener('click', async function() {
            if (selectedLeadIndex !== null && token) {
                const lead = allLeadsData[selectedLeadIndex];
                allLeadsData.splice(selectedLeadIndex, 1);
                renderLeads();
                contextMenu.style.display = 'none';
            }
        });
    }

    if (filterDropdownBtn) {
        filterDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
        });
    }

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-wrapper')) {
            filterDropdown.classList.remove('show');
        }
    });

    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            currentFilter = value;
            dropdownItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            currentFilterSpan.textContent = this.textContent;
            renderLeads();
            filterDropdown.classList.remove('show');
        });
    });

    if (saveLeadsBtn) {
        saveLeadsBtn.addEventListener('click', async function() {
            if (this.disabled || !token) return;
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            if (selectedCards.length === 0) return;
            saveBtnText.textContent = 'Saving...';
            saveLeadsBtn.disabled = true;
            try {
                await new Promise(r => setTimeout(r, 1000)); // Mock save
                saveBtnText.textContent = 'Saved';
                setTimeout(() => { saveBtnText.textContent = 'Save leads'; }, 2000);
            } catch (e) {
                saveBtnText.textContent = 'Error';
            } finally {
                saveLeadsBtn.disabled = false;
            }
        });
    }

    function checkMessagesHaveText() {
        return reviewDrafts.some(d => d.body && d.body.trim().length > 0);
    }

    function updateSendButtonState() {
        const anyChecked = reviewDrafts.some(d => d.approved);
        const hasText = checkMessagesHaveText();
        if (sendApprovedBtn) {
            if (anyChecked && hasText) {
                sendApprovedBtn.disabled = false;
                sendApprovedBtn.classList.remove('disabled');
            } else {
                sendApprovedBtn.disabled = true;
                sendApprovedBtn.classList.add('disabled');
            }
        }
    }

    function closeReviewSheet() {
        if (reviewSheetOverlay) reviewSheetOverlay.style.display = 'none';
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

            reviewDrafts.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                lead: lead,
                subject: 'Partnership Inquiry',
                body: 'Hi ' + (lead.companyName || '') + ',\n\nI came across your company...',
                approved: true,
                _subjectInputEl: null,
                _messageInputEl: null,
                _checkboxEl: null
            });
        });

        renderDraftRows();
        if (draftCountsEl) draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 sent';
        if (reviewSheetOverlay) reviewSheetOverlay.style.display = 'flex';
        updateSendButtonState();
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            if (selectedCards.length === 0) return;
            openReviewSheet();
        });
    }

    if (closeReviewSheetBtn) closeReviewSheetBtn.addEventListener('click', closeReviewSheet);

    // ✅ FIXED: Schedule Button now opens Review Sheet first
    if (scheduleOutreachBtn) {
        scheduleOutreachBtn.addEventListener('click', function() {
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            if (selectedCards.length === 0) {
                alert('Please select at least one lead to schedule.');
                return;
            }
            openReviewSheet();
        });
    }

    // ✅ NEW: Button inside Review Sheet to open High-Fi Schedule Modal
    // Note: You need to add a button with ID "reviewSheetScheduleBtn" in your HTML review sheet footer
    const reviewSheetScheduleBtn = document.getElementById('reviewSheetScheduleBtn');
    if (reviewSheetScheduleBtn) {
        reviewSheetScheduleBtn.addEventListener('click', function() {
            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) {
                alert('Please approve at least one draft.');
                return;
            }
            
            scheduleContext = {
                type: 'review',
                leads: approvedDrafts.map(d => ({
                    companyName: d.lead.companyName,
                    email: d.lead.email,
                    subject: d.subject,
                    message: d.body,
                    approved: true
                }))
            };
            
            renderCompanyList(); // Render the high-fi list
            if (reviewSheetOverlay) reviewSheetOverlay.style.display = 'none';
            if (scheduleOverlay) scheduleOverlay.style.display = 'flex';
        });
    }

    // Schedule Modal Confirm
    if (scheduleConfirmBtn) {
        scheduleConfirmBtn.addEventListener('click', async function() {
            if (!token) return;
            const dateVal = scheduleDateInput ? scheduleDateInput.value : '';
            const timeVal = scheduleTimeInput ? scheduleTimeInput.value : '';
            const timezone = scheduleTimezoneSelect ? scheduleTimezoneSelect.value : '';
            const paceMinutes = schedulePaceSelect ? parseInt(schedulePaceSelect.value) : 5;
            
            if (!dateVal || !timeVal) { alert('Please select a date and time.'); return; }
            const scheduledDateTime = new Date(dateVal + 'T' + timeVal + ':00');
            if (scheduledDateTime <= new Date()) { alert('Please select a future date and time.'); return; }

            const originalText = scheduleConfirmBtn.innerHTML;
            scheduleConfirmBtn.innerHTML = '<span>Scheduling...</span>';
            scheduleConfirmBtn.disabled = true;

            try {
                const payload = {
                    scheduledAt: scheduledDateTime.toISOString(),
                    timezone: timezone,
                    paceMinutes: paceMinutes,
                    safetyRules: { stopOnReply: ruleStopReply.checked, stopOnUnsubscribe: ruleStopUnsubscribe.checked, skipMissing: ruleSkipMissing.checked },
                    leads: scheduleContext.leads.filter(l => l.approved)
                };

                // Mock API call for demonstration
                await new Promise(r => setTimeout(r, 1500));
                
                if (scheduleOverlay) scheduleOverlay.style.display = 'none';
                showToast('Outreach scheduled successfully!', 'success');
                renderLeads(); // Update badges

            } catch (e) {
                console.error('Schedule error:', e);
                alert(e.message || 'Failed to schedule outreach.');
            } finally {
                scheduleConfirmBtn.innerHTML = originalText;
                scheduleConfirmBtn.disabled = false;
            }
        });
    }

    if (scheduleCancelBtn) scheduleCancelBtn.addEventListener('click', function() { if (scheduleOverlay) scheduleOverlay.style.display = 'none'; });
    if (closeScheduleSheetBtn) closeScheduleSheetBtn.addEventListener('click', function() { if (scheduleOverlay) scheduleOverlay.style.display = 'none'; });
    if (scheduleOverlay) scheduleOverlay.addEventListener('click', function(e) { if (e.target === scheduleOverlay) { if (scheduleOverlay) scheduleOverlay.style.display = 'none'; } });

    // Selector Inputs
    if (scheduleDateInput) {
        scheduleDateInput.addEventListener('change', function() {
            if (this.value) {
                const date = new Date(this.value + 'T00:00:00');
                selectedDateText.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            }
        });
    }

    if (scheduleTimeInput) {
        scheduleTimeInput.addEventListener('change', function() {
            if (this.value) {
                const [h, m] = this.value.split(':');
                const hr = parseInt(h);
                const ampm = hr >= 12 ? 'PM' : 'AM';
                const h12 = hr % 12 || 12;
                selectedTimeText.textContent = h12 + ':' + m + ' ' + ampm;
            }
        });
    }

    if (scheduleTimezoneSelect) {
        scheduleTimezoneSelect.addEventListener('change', function() {
            selectedTimezoneText.textContent = this.options[this.selectedIndex].text;
        });
    }

    if (schedulePaceSelect) {
        schedulePaceSelect.addEventListener('change', function() {
            selectedPaceText.textContent = this.options[this.selectedIndex].text;
        });
    }

    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration || 4000;
        var existing = document.querySelector('.toast-msg');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.textContent = message;

        var colors = {
            success: { bg: 'rgba(102,221,153,0.10)', border: 'rgba(102,221,153,0.5)', text: '#66dd99' },
            error:   { bg: 'rgba(255,85,85,0.10)',   border: 'rgba(255,85,85,0.5)',   text: '#ff5555' },
            warning: { bg: 'rgba(255,170,0,0.10)',   border: 'rgba(255,170,0,0.5)',   text: '#ffaa00' },
            info:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.2)', text: '#f5f5f5' }
        };

        var color = colors[type] || colors.info;
        Object.assign(toast.style, {
            background: color.bg,
            border: '1px solid ' + color.border,
            color: color.text,
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '10px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: '9999',
            backdropFilter: 'blur(10px)'
        });

        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, duration);
    }

    // Init
    initData();
});

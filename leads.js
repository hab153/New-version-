// ============================================================
// leads.js - Skyline AI · Lead Results Logic
// UPDATED: Direct AI Suggestion Update (Subject + Body)
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ── DOM Elements ──
    const leadsList = document.getElementById('leadsList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const selectCountSpan = document.querySelector('.select-count');
    const saveLeadsBtn = document.querySelector('.action-btn.primary');
    const saveBtnText = document.getElementById('saveBtnText');
    const sendBtn = document.getElementById('sendBtn');
    const closeWarningBtn = document.getElementById('closeWarning');
    const warningStrip = document.getElementById('warningStrip');
    
    // Modal Elements
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeModal');
    const modalContent = document.getElementById('modalContent');

    // Card Action Modal Elements
    const cardActionOverlay = document.getElementById('cardActionOverlay');
    const closeCardActionBtn = document.getElementById('closeCardAction');
    const viewInfoBtn = document.getElementById('viewInfoBtn');
    const viewDraftBtn = document.getElementById('viewDraftBtn');
    const cardActionTitle = document.getElementById('cardActionTitle');

    // Draft View Modal Elements
    const draftViewOverlay = document.getElementById('draftViewOverlay');
    const closeDraftViewBtn = document.getElementById('closeDraftView');
    const draftViewCompany = document.getElementById('draftViewCompany');
    const draftViewEmail = document.getElementById('draftViewEmail');
    const draftEditSubject = document.getElementById('draftEditSubject');
    const draftEditMessage = document.getElementById('draftEditMessage');
    const draftSendBtn = document.getElementById('draftSendBtn');
    const draftScheduleBtn = document.getElementById('draftScheduleBtn');

    // Review Sheet Elements
    const reviewSheetOverlay = document.getElementById('reviewSheetOverlay');
    const draftListContainer = document.getElementById('draftListContainer');
    const closeReviewSheetBtn = document.getElementById('closeReviewSheet');
    const sendApprovedBtn = document.getElementById('sendApprovedBtn');
    const draftMessageBtn = document.getElementById('draftMessageBtn');
    const scheduleOutreachBtn = document.getElementById('scheduleOutreachBtn');
    const draftCountsEl = document.getElementById('draftCounts');
    
    // ✅ NEW: AI Suggestion Elements
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    const aiSuggestStatus = document.getElementById('aiSuggestStatus');

    // Send All Drafts + Schedule Elements
    const sendAllDraftsWrapper = document.getElementById('sendAllDraftsWrapper');
    const sendAllDraftsBtn = document.getElementById('sendAllDraftsBtn');
    const scheduleAllDraftsBtn = document.getElementById('scheduleAllDraftsBtn');

    // Schedule Outreach Modal Elements
    const scheduleOverlay = document.getElementById('scheduleOverlay');
    const closeScheduleSheetBtn = document.getElementById('closeScheduleSheet');
    const scheduleCancelBtn = document.getElementById('scheduleCancelBtn');
    const scheduleConfirmBtn = document.getElementById('scheduleConfirmBtn');
    const scheduleEmailCount = document.getElementById('scheduleEmailCount');
    const summaryEmailCount = document.getElementById('summaryEmailCount');
    const scheduleConfirmText = document.getElementById('scheduleConfirmText');
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

    // Filter & Context Menu Elements
    const filterDropdownBtn = document.getElementById('filterDropdownBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const currentFilterSpan = document.getElementById('currentFilter');
    const contextMenu = document.getElementById('contextMenu');
    const pinLeadBtn = document.getElementById('pinLeadBtn');
    const deleteLeadBtn = document.getElementById('deleteLeadBtn');

    // State
    let allLeadsData = []; 
    let savedLeadsEmails = new Set(); 
    let draftedEmails = new Map(); // email -> { subject, message }
    let currentFilter = 'all';
    let longPressTimer;
    let selectedLeadIndex = null;
    let reviewDrafts = [];
    let currentCardActionIndex = null;
    let isLoading = true;
    let scheduleContext = { type: '', leads: [] }; // 'review', 'single', 'all'

    const BACKEND = 'https://skylineapp-backend-file.onrender.com';
    const token = localStorage.getItem('token');

    // ── 1. Load Data with Progressive Loading ──
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
    }

    // ── 2. Render Skeleton Cards ──
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

    // ─ 3. Get Status Label HTML ──
    function getStatusLabel(lead) {
        const isSaved = savedLeadsEmails.has(lead.email);
        const isDraft = draftedEmails.has(lead.email);
        
        if (isSaved && isDraft) {
            return '<span class="status-label combined">Saved & Draft</span>';
        } else if (isDraft) {
            return '<span class="status-label draft">Draft</span>';
        } else if (isSaved) {
            return '<span class="status-label saved">Saved</span>';
        } else {
            return '<span class="status-label recent">Recent</span>';
        }
    }

    // ─ 4. Render Lead Cards ──
    function renderLeads() {
        if (!leadsList) return;
        leadsList.innerHTML = ''; 

        let displayLeads = [];

        if (currentFilter === 'all') {
            displayLeads = [...allLeadsData];
        } else if (currentFilter === 'saved') {
            displayLeads = allLeadsData.filter(lead => savedLeadsEmails.has(lead.email));
        } else if (currentFilter === 'recent') {
            displayLeads = allLeadsData.filter(lead => !savedLeadsEmails.has(lead.email) && !draftedEmails.has(lead.email));
        } else if (currentFilter === 'draft') {
            displayLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));
        }

        if (sendAllDraftsWrapper) {
            sendAllDraftsWrapper.style.display = currentFilter === 'draft' ? 'flex' : 'none';
        }

        if (displayLeads.length === 0) {
            leadsList.innerHTML = '<div style="text-align:center; padding:40px; color:#9697A1;">No leads found for this filter.</div>';
            return;
        }

        const countEl = document.getElementById('resultsCount');
        if (countEl) countEl.textContent = `${displayLeads.length} prospects found`;

        displayLeads.forEach((lead, index) => {
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
    }

    // ── 5. Details Modal Logic ──
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

    function closeModal() {
        if (modalOverlay) modalOverlay.style.display = 'none';
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // ── 6. Card Action Modal (Information vs Draft) ──
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
    if (cardActionOverlay) {
        cardActionOverlay.addEventListener('click', function(e) {
            if (e.target === cardActionOverlay) closeCardActionModal();
        });
    }

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
                openDraftViewModal(lead);
            }
        });
    }

    // ─ 7. Draft View Modal ─
    function openDraftViewModal(lead) {
        if (!lead || !draftViewOverlay) return;

        const draft = draftedEmails.get(lead.email) || { subject: '', message: '' };

        if (draftViewCompany) draftViewCompany.textContent = lead.companyName || 'Unknown';
        if (draftViewEmail) draftViewEmail.textContent = lead.email || '';
        if (draftEditSubject) draftEditSubject.value = draft.subject;
        if (draftEditMessage) draftEditMessage.value = draft.message;

        draftViewOverlay.style.display = 'flex';
    }

    function closeDraftViewModal() {
        if (draftViewOverlay) draftViewOverlay.style.display = 'none';
    }

    if (closeDraftViewBtn) closeDraftViewBtn.addEventListener('click', closeDraftViewModal);
    if (draftViewOverlay) {
        draftViewOverlay.addEventListener('click', function(e) {
            if (e.target === draftViewOverlay) closeDraftViewModal();
        });
    }

    // Send individual draft
    if (draftSendBtn) {
        draftSendBtn.addEventListener('click', async function() {
            if (!token) return;

            const company = draftViewCompany ? draftViewCompany.textContent : '';
            const email = draftViewEmail ? draftViewEmail.textContent : '';
            const subject = draftEditSubject ? draftEditSubject.value : '';
            const message = draftEditMessage ? draftEditMessage.value : '';

            if (!email || !message.trim()) {
                alert('Please enter a message before sending.');
                return;
            }

            const originalText = draftSendBtn.innerHTML;
            draftSendBtn.innerHTML = '<span>Sending...</span>';
            draftSendBtn.disabled = true;

            try {
                const res = await fetch(BACKEND + '/api/leads/batch-send', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        leads: [{
                            name: company,
                            email: email,
                            company: company,
                            messages: [{ subject: subject, body: message }]
                        }]
                    })
                });

                if (res.ok) {
                    await fetch(BACKEND + '/api/leads/draft', {
                        method: 'DELETE',
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email: email })
                    });

                    draftedEmails.delete(email);
                    closeDraftViewModal();
                    renderLeads();
                } else {
                    alert('Failed to send message.');
                }
            } catch (e) {
                console.error('Send error:', e);
                alert('Network error while sending.');
            } finally {
                draftSendBtn.innerHTML = originalText;
                draftSendBtn.disabled = false;
            }
        });
    }

    // Schedule single draft from Draft View Modal
    if (draftScheduleBtn) {
        draftScheduleBtn.addEventListener('click', function() {
            const company = draftViewCompany ? draftViewCompany.textContent : '';
            const email = draftViewEmail ? draftViewEmail.textContent : '';
            const subject = draftEditSubject ? draftEditSubject.value : '';
            const message = draftEditMessage ? draftEditMessage.value : '';

            if (!email) return;

            scheduleContext = {
                type: 'single',
                leads: [{
                    companyName: company,
                    email: email,
                    subject: subject,
                    message: message
                }]
            };

            updateScheduleModalUI();
            closeDraftViewModal();
            scheduleOverlay.style.display = 'flex';
        });
    }

    // ── 8. Card Click Handler ──
    if (leadsList) {
        leadsList.addEventListener('click', function(e) {
            if (e.target.closest('.checkbox-wrapper') || e.target.closest('.view-btn')) return;
            const card = e.target.closest('.lead-card');
            if (card) {
                const index = parseInt(card.getAttribute('data-index'));
                const lead = allLeadsData[index];
                
                if (lead && draftedEmails.has(lead.email)) {
                    openCardActionModal(index);
                } else {
                    openDetailsModal(index);
                }
            }
        });
    }

    // ── 9. Selection Logic ─
    function initSelectionLogic() {
        const leadCheckboxes = document.querySelectorAll('.lead-checkbox');
        
        function updateSelectionState() {
            const total = leadCheckboxes.length;
            const checked = Array.from(leadCheckboxes).filter(cb => cb.checked).length;
            
            if (selectCountSpan) selectCountSpan.textContent = `${checked} selected`;

            if (selectAllCheckbox) {
                if (checked === 0) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                } else if (checked === total) {
                    selectAllCheckbox.checked = true;
                    selectAllCheckbox.indeterminate = false;
                } else {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = true;
                }
            }

            const hasSelection = checked > 0;
            if (saveLeadsBtn) {
                saveLeadsBtn.disabled = !hasSelection;
                saveLeadsBtn.style.opacity = hasSelection ? '1' : '0.5';
            }
            if (sendBtn) {
                sendBtn.disabled = !hasSelection;
                sendBtn.style.opacity = hasSelection ? '1' : '0.5';
            }
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                const isChecked = this.checked;
                leadCheckboxes.forEach(cb => {
                    cb.checked = isChecked;
                });
                updateSelectionState();
            });
        }

        leadCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectionState);
        });

        updateSelectionState();
    }

    // ─ 10. Long Press Logic ──
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

    function cancelPress() {
        clearTimeout(longPressTimer);
    }

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

                try {
                    await fetch(`${BACKEND}/api/leads/${lead.email}`, {
                        method: 'DELETE',
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email: lead.email, companyName: lead.companyName })
                    });
                } catch (e) {
                    console.error('Failed to delete from backend:', e);
                }
            }
        });
    }

    // ─ 11. Filter Dropdown Logic ──
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

    // ─ 12. Save Leads Backend Integration ──
    if (saveLeadsBtn) {
        saveLeadsBtn.addEventListener('click', async function() {
            if (this.disabled || !token) return;
            
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            if (selectedCards.length === 0) return;

            const leadsToSave = [];
            selectedCards.forEach(cb => {
                const card = cb.closest('.lead-card');
                const index = parseInt(card.getAttribute('data-index'));
                leadsToSave.push(allLeadsData[index]);
            });

            saveBtnText.textContent = 'Saving...';
            saveLeadsBtn.disabled = true;

            leadsToSave.forEach(l => savedLeadsEmails.add(l.email));
            renderLeads();

            try {
                await fetch(`${BACKEND}/api/leads/save`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ leads: leadsToSave })
                });
                saveBtnText.textContent = 'Saved';
                setTimeout(() => { saveBtnText.textContent = 'Save leads'; }, 2000);
            } catch (e) {
                console.error('Save error:', e);
                saveBtnText.textContent = 'Error';
            } finally {
                saveLeadsBtn.disabled = false;
            }
        });
    }

    // ── 13. Review Outreach Modal Logic ──
    
    function toggleEditor(btn) {
        const editor = btn.closest('.draft-row').querySelector('.draft-editor');
        const arrow = btn.querySelector('svg');
        
        if (editor.style.display === 'none' || !editor.style.display) {
            editor.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            editor.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    }

    function checkMessagesHaveText() {
        const messageInputs = document.querySelectorAll('.message-input');
        if (messageInputs.length === 0) return false;
        
        let hasText = false;
        messageInputs.forEach(input => {
            if (input.value.trim().length > 0) {
                hasText = true;
            }
        });
        return hasText;
    }

    function updateSendButtonState() {
        const anyChecked = document.querySelectorAll('.draft-checkbox:checked').length > 0;
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
        if (reviewSheetOverlay) {
            reviewSheetOverlay.style.display = 'none';
        }
    }

    function openReviewSheet() {
        const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
        if (selectedCards.length === 0) return;

        reviewDrafts = [];
        draftListContainer.innerHTML = '';

        selectedCards.forEach(cb => {
            const card = cb.closest('.lead-card');
            const index = parseInt(card.getAttribute('data-index'));
            const lead = allLeadsData[index];

            if (!lead.email) return;

            const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            const defaultSubject = 'Partnership Inquiry';
            const defaultBody = 'Hi ' + (lead.companyName || '') + ',\n\nI came across your company and was impressed by your work. I would love to discuss a potential partnership.\n\nBest regards,\nSkyline AI User';

            reviewDrafts.push({
                id: draftId,
                lead: lead,
                subject: defaultSubject,
                body: defaultBody,
                approved: true
            });

            const row = document.createElement('div');
            row.className = 'draft-row';
            row.setAttribute('data-draft-id', draftId);

            row.innerHTML = `
                <div class="draft-header">
                    <label class="draft-checkbox-wrapper">
                        <input type="checkbox" class="draft-checkbox" checked>
                        <span class="custom-checkbox draft-check">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                    </label>
                    <div class="draft-logo">
                        <span style="font-weight:700; font-size:16px; color:white;">${lead.companyName ? lead.companyName.charAt(0).toUpperCase() : '?'}</span>
                    </div>
                    <div class="draft-info">
                        <div class="draft-company">${lead.companyName || 'Unknown'}</div>
                        <div class="draft-email">${lead.email}</div>
                    </div>
                    <div class="draft-status-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Needs review</span>
                    </div>
                    <button class="expand-editor-btn" onclick="window.toggleEditor(this)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                </div>
                <div class="draft-editor" style="display: none;">
                    <div class="editor-field">
                        <label>Subject</label>
                        <input type="text" class="subject-input" value="${defaultSubject}" data-draft-id="${draftId}">
                    </div>
                    <div class="editor-field">
                        <label>Message</label>
                        <textarea class="message-input" data-draft-id="${draftId}">${defaultBody}</textarea>
                    </div>
                </div>
            `;

            draftListContainer.appendChild(row);
        });

        if (draftCountsEl) {
            draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 sent';
        }

        reviewSheetOverlay.style.display = 'flex';
        updateSendButtonState();
    }

    // Event listener for Send button in bulk panel
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            const selectedCards = document.querySelectorAll('.lead-checkbox:checked');
            const missingEmails = [];
            
            selectedCards.forEach(cb => {
                const card = cb.closest('.lead-card');
                const index = parseInt(card.getAttribute('data-index'));
                const lead = allLeadsData[index];
                if (!lead.email) {
                    missingEmails.push(lead.companyName || 'Unknown Company');
                }
            });

            if (missingEmails.length > 0) {
                alert('Cannot send to the following companies because they are missing email addresses:\n\n- ' + missingEmails.join('\n- ') + '\n\nPlease unmark them or add their emails.');
                return;
            }

            openReviewSheet();
        });
    }

    // Close Review Sheet
    if (closeReviewSheetBtn) {
        closeReviewSheetBtn.addEventListener('click', closeReviewSheet);
    }

    // Handle Draft Checkbox Changes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('draft-checkbox')) {
            const row = e.target.closest('.draft-row');
            const draftId = row.getAttribute('data-draft-id');
            const draft = reviewDrafts.find(function(d) { return d.id === draftId; });
            if (draft) {
                draft.approved = e.target.checked;
            }
            updateSendButtonState();
        }
    });

    // Handle Input Changes in Editor
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('subject-input') || e.target.classList.contains('message-input')) {
            const draftId = e.target.getAttribute('data-draft-id');
            const draft = reviewDrafts.find(function(d) { return d.id === draftId; });
            if (draft) {
                if (e.target.classList.contains('subject-input')) {
                    draft.subject = e.target.value;
                } else {
                    draft.body = e.target.value;
                }
            }
            updateSendButtonState();
        }
    });

    window.toggleEditor = toggleEditor;

    // Send Approved Emails
    if (sendApprovedBtn) {
        sendApprovedBtn.addEventListener('click', async function() {
            if (this.disabled || this.classList.contains('disabled')) return;

            const approvedDrafts = reviewDrafts.filter(function(d) { return d.approved; });
            if (approvedDrafts.length === 0) return;

            const originalText = sendApprovedBtn.innerHTML;
            sendApprovedBtn.innerHTML = '<span>Sending...</span>';
            sendApprovedBtn.disabled = true;

            const leadsToSend = approvedDrafts.map(function(d) {
                return {
                    name: d.lead.companyName,
                    email: d.lead.email,
                    company: d.lead.companyName,
                    messages: [{
                        subject: d.subject,
                        body: d.body
                    }]
                };
            });

            try {
                const res = await fetch(BACKEND + '/api/leads/batch-send', {
                    method: 'POST',
                    headers: { 
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ leads: leadsToSend })
                });

                if (res.ok) {
                    closeReviewSheet();
                    document.querySelectorAll('.lead-checkbox:checked').forEach(function(cb) { cb.checked = false; });
                    initSelectionLogic();
                } else {
                    const errData = await res.json();
                    alert('Failed to send: ' + (errData.message || 'Unknown error'));
                }
            } catch (e) {
                console.error('Send error:', e);
                alert('Network error while sending.');
            } finally {
                sendApprovedBtn.innerHTML = originalText;
                sendApprovedBtn.disabled = false;
                updateSendButtonState();
            }
        });
    }

    // Schedule Outreach from Review Sheet
    if (scheduleOutreachBtn) {
        scheduleOutreachBtn.addEventListener('click', function() {
            const approvedDrafts = reviewDrafts.filter(function(d) { return d.approved; });
            if (approvedDrafts.length === 0) {
                alert('Please approve at least one draft before scheduling.');
                return;
            }

            scheduleContext = {
                type: 'review',
                leads: approvedDrafts.map(d => ({
                    companyName: d.lead.companyName,
                    email: d.lead.email,
                    subject: d.subject,
                    message: d.body
                }))
            };

            updateScheduleModalUI();
            closeReviewSheet();
            scheduleOverlay.style.display = 'flex';
        });
    }

    // Draft Message Button - Saves drafts to backend
    if (draftMessageBtn) {
        draftMessageBtn.addEventListener('click', async function() {
            if (!token) {
                closeReviewSheet();
                return;
            }

            const approvedDrafts = reviewDrafts.filter(function(d) { return d.approved; });
            if (approvedDrafts.length === 0) {
                closeReviewSheet();
                return;
            }

            const originalText = draftMessageBtn.innerHTML;
            draftMessageBtn.innerHTML = '<span>Saving...</span>';
            draftMessageBtn.disabled = true;

            try {
                for (const draft of approvedDrafts) {
                    await fetch(BACKEND + '/api/leads/draft', {
                        method: 'POST',
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            companyName: draft.lead.companyName,
                            email: draft.lead.email,
                            subject: draft.subject,
                            message: draft.body
                        })
                    });

                    draftedEmails.set(draft.lead.email, { subject: draft.subject, message: draft.body });
                }

                closeReviewSheet();
                renderLeads();
            } catch (e) {
                console.error('Save draft error:', e);
                alert('Failed to save drafts.');
            } finally {
                draftMessageBtn.innerHTML = originalText;
                draftMessageBtn.disabled = false;
            }
        });
    }

    // ── 14. Send All Drafts Button (FIXED: Opens Review Sheet) ─
    if (sendAllDraftsBtn) {
        sendAllDraftsBtn.addEventListener('click', function() {
            const draftLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));
            if (draftLeads.length === 0) {
                alert('No draft messages to send.');
                return;
            }

            // Build reviewDrafts from saved drafts
            reviewDrafts = draftLeads.map(lead => {
                const draft = draftedEmails.get(lead.email);
                const draftId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                
                return {
                    id: draftId,
                    lead: lead,
                    subject: draft.subject,
                    body: draft.message,
                    approved: true
                };
            });

            // Render into review sheet
            draftListContainer.innerHTML = '';
            reviewDrafts.forEach(d => {
                const row = document.createElement('div');
                row.className = 'draft-row';
                row.setAttribute('data-draft-id', d.id);
                row.innerHTML = `
                    <div class="draft-header">
                        <label class="draft-checkbox-wrapper">
                            <input type="checkbox" class="draft-checkbox" checked>
                            <span class="custom-checkbox draft-check">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                        </label>
                        <div class="draft-logo">
                            <span style="font-weight:700; font-size:16px; color:white;">${d.lead.companyName ? d.lead.companyName.charAt(0).toUpperCase() : '?'}</span>
                        </div>
                        <div class="draft-info">
                            <div class="draft-company">${d.lead.companyName || 'Unknown'}</div>
                            <div class="draft-email">${d.lead.email}</div>
                        </div>
                        <div class="draft-status-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB84D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Needs review</span>
                        </div>
                        <button class="expand-editor-btn" onclick="window.toggleEditor(this)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                    </div>
                    <div class="draft-editor" style="display: none;">
                        <div class="editor-field">
                            <label>Subject</label>
                            <input type="text" class="subject-input" value="${d.subject}" data-draft-id="${d.id}">
                        </div>
                        <div class="editor-field">
                            <label>Message</label>
                            <textarea class="message-input" data-draft-id="${d.id}">${d.body}</textarea>
                        </div>
                    </div>
                `;
                draftListContainer.appendChild(row);
            });

            if (draftCountsEl) {
                draftCountsEl.textContent = reviewDrafts.length + ' drafts created - 0 sent';
            }

            updateSendButtonState();
            reviewSheetOverlay.style.display = 'flex';
        });
    }

    // ── 15. Schedule All Drafts Button ──
    if (scheduleAllDraftsBtn) {
        scheduleAllDraftsBtn.addEventListener('click', function() {
            const draftLeads = allLeadsData.filter(lead => draftedEmails.has(lead.email));
            if (draftLeads.length === 0) {
                alert('No draft messages to schedule.');
                return;
            }

            scheduleContext = {
                type: 'all',
                leads: draftLeads.map(lead => {
                    const draft = draftedEmails.get(lead.email);
                    return {
                        companyName: lead.companyName,
                        email: lead.email,
                        subject: draft.subject,
                        message: draft.message
                    };
                })
            };

            updateScheduleModalUI();
            scheduleOverlay.style.display = 'flex';
        });
    }

    // ── 16. Schedule Outreach Modal Logic ──

    function updateScheduleModalUI() {
        const count = scheduleContext.leads.length;
        if (scheduleEmailCount) scheduleEmailCount.textContent = count + ' approved emails';
        if (summaryEmailCount) summaryEmailCount.textContent = count + ' emails will be sent separately';
        if (scheduleConfirmText) scheduleConfirmText.textContent = 'Schedule ' + count + ' emails';
    }

    function closeScheduleModal() {
        if (scheduleOverlay) scheduleOverlay.style.display = 'none';
        scheduleContext = { type: '', leads: [] };
    }

    if (closeScheduleSheetBtn) closeScheduleSheetBtn.addEventListener('click', closeScheduleModal);
    if (scheduleCancelBtn) scheduleCancelBtn.addEventListener('click', closeScheduleModal);
    if (scheduleOverlay) {
        scheduleOverlay.addEventListener('click', function(e) {
            if (e.target === scheduleOverlay) closeScheduleModal();
        });
    }

    // Date Selector
    if (scheduleDateInput) {
        scheduleDateInput.addEventListener('change', function() {
            if (this.value) {
                const date = new Date(this.value + 'T00:00:00');
                const options = { weekday: 'long', month: 'short', day: 'numeric' };
                selectedDateText.textContent = date.toLocaleDateString('en-US', options);
            }
        });
    }

    // Time Selector
    if (scheduleTimeInput) {
        scheduleTimeInput.addEventListener('change', function() {
            if (this.value) {
                const [hours, minutes] = this.value.split(':');
                const h = parseInt(hours);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                selectedTimeText.textContent = h12 + ':' + minutes + ' ' + ampm;
            }
        });
    }

    // Timezone Selector
    if (scheduleTimezoneSelect) {
        scheduleTimezoneSelect.addEventListener('change', function() {
            const option = this.options[this.selectedIndex];
            selectedTimezoneText.textContent = option.text;
        });
    }

    // Pace Selector
    if (schedulePaceSelect) {
        schedulePaceSelect.addEventListener('change', function() {
            const option = this.options[this.selectedIndex];
            selectedPaceText.textContent = option.text;
        });
    }

    // Schedule Confirm Button
    if (scheduleConfirmBtn) {
        scheduleConfirmBtn.addEventListener('click', async function() {
            if (!token) return;

            const dateVal = scheduleDateInput ? scheduleDateInput.value : '';
            const timeVal = scheduleTimeInput ? scheduleTimeInput.value : '';
            const timezone = scheduleTimezoneSelect ? scheduleTimezoneSelect.value : '';
            const paceMinutes = schedulePaceSelect ? parseInt(schedulePaceSelect.value) : 5;
            const stopOnReply = ruleStopReply ? ruleStopReply.checked : true;
            const stopOnUnsubscribe = ruleStopUnsubscribe ? ruleStopUnsubscribe.checked : true;
            const skipMissing = ruleSkipMissing ? ruleSkipMissing.checked : true;

            if (!dateVal || !timeVal) {
                alert('Please select both a date and time for scheduling.');
                return;
            }

            const scheduledDateTime = new Date(dateVal + 'T' + timeVal + ':00');
            if (scheduledDateTime <= new Date()) {
                alert('Please select a future date and time.');
                return;
            }

            const originalText = scheduleConfirmBtn.innerHTML;
            scheduleConfirmBtn.innerHTML = '<span>Scheduling...</span>';
            scheduleConfirmBtn.disabled = true;

            try {
                // NOTE: This is a placeholder API call. The actual scheduling backend
                // endpoint will be implemented when you explain how scheduling works.
                // For now, we simulate success.
                
                console.log('Schedule payload:', {
                    leads: scheduleContext.leads,
                    scheduledAt: scheduledDateTime.toISOString(),
                    timezone: timezone,
                    paceMinutes: paceMinutes,
                    safetyRules: { stopOnReply, stopOnUnsubscribe, skipMissing }
                });

                // Simulate success for UI testing
                await new Promise(resolve => setTimeout(resolve, 1000));

                closeScheduleModal();
                alert('Outreach scheduled successfully!');
                
                // If scheduling from draft view, remove the draft
                if (scheduleContext.type === 'single') {
                    const email = scheduleContext.leads[0].email;
                    await fetch(BACKEND + '/api/leads/draft', {
                        method: 'DELETE',
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email: email })
                    });
                    draftedEmails.delete(email);
                    renderLeads();
                }
            } catch (e) {
                console.error('Schedule error:', e);
                alert('Failed to schedule outreach.');
            } finally {
                scheduleConfirmBtn.innerHTML = originalText;
                scheduleConfirmBtn.disabled = false;
            }
        });
    }

    // ═════════════════════════════════════════
    // ✅ FIXED: DIRECT AI SUGGESTION UPDATE (ROBUST)
    // ══════════════════════════════════════════

    if (aiSuggestBtn) {
        aiSuggestBtn.addEventListener('click', async function() {
            const approvedDrafts = reviewDrafts.filter(d => d.approved);
            if (approvedDrafts.length === 0) {
                alert('Please approve at least one draft before requesting AI suggestions.');
                return;
            }

            // Show loading state directly on the button
            const originalBtnHTML = aiSuggestBtn.innerHTML;
            aiSuggestBtn.disabled = true;
            aiSuggestBtn.innerHTML = '<span class="spinner"></span> Generating...';
            
            if (aiSuggestStatus) aiSuggestStatus.textContent = 'Working on personalized messages...';

            try {
                const res = await fetch(BACKEND + '/api/ai/suggest-outreach', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        leads: approvedDrafts.map(d => ({
                            companyName: d.lead.companyName,
                            email: d.lead.email,
                            industry: d.lead.industry || ''
                        }))
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Failed to generate suggestions');
                }

                // ✅ DIRECTLY UPDATE THE REVIEW SHEET FIELDS
                let updatedCount = 0;
                
                // We loop through the data.suggestions and find the matching draft in our state
                data.suggestions.forEach(suggestion => {
                    const draft = reviewDrafts.find(d => d.lead.email === suggestion.email);
                    
                    // Only proceed if we found the draft AND the API returned valid subject/body
                    if (draft && suggestion.subject && suggestion.body) {
                        
                        // 1. Update internal state immediately
                        draft.subject = suggestion.subject;
                        draft.body = suggestion.body;
                        
                        // 2. SAFELY find and update the ACTUAL DOM elements inside the modal
                        // We use the unique data-draft-id to guarantee we hit the right input
                        const subjectInput = document.querySelector(`input.subject-input[data-draft-id="${draft.id}"]`);
                        const messageTextarea = document.querySelector(`textarea.message-input[data-draft-id="${draft.id}"]`);
                        
                        if (subjectInput) {
                            subjectInput.value = suggestion.subject;
                            // Dispatching an 'input' event ensures any other listeners (like validation) know it changed
                            subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        
                        if (messageTextarea) {
                            messageTextarea.value = suggestion.body;
                            messageTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        
                        updatedCount++;
                    }
                });

                // Update status to show remaining calls
                if (aiSuggestStatus) {
                    aiSuggestStatus.textContent = `${data.remainingCalls} suggestions remaining today`;
                }

                if (updatedCount > 0) {
                    // Optional: Brief visual feedback that update happened
                    aiSuggestBtn.style.backgroundColor = '#22C55E'; // Green flash
                    setTimeout(() => {
                        aiSuggestBtn.style.backgroundColor = ''; // Reset
                    }, 600);
                } else {
                    console.warn('AI suggestions received but no matching DOM elements found to update.');
                }

            } catch (err) {
                console.error('AI Suggestion Error:', err);
                alert(err.message || 'Failed to generate AI suggestions.');
                if (aiSuggestStatus) aiSuggestStatus.textContent = 'Generation failed. Try again.';
            } finally {
                // Restore button state
                aiSuggestBtn.disabled = false;
                aiSuggestBtn.innerHTML = originalBtnHTML;
            }
        });
    }

    // ── 17. Warning Strip Dismissal ──
    if (closeWarningBtn && warningStrip) {
        closeWarningBtn.addEventListener('click', function() {
            warningStrip.style.display = 'none';
        });
    }

    // Initial Load
    initData();
});

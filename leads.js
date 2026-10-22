// ============================================================
// leads.js - Skyline AI · Lead Results Logic
// UPDATED: Dynamic rendering from localStorage & Details Modal
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ── DOM Elements ──
    const leadsList = document.getElementById('leadsList');
    const selectAllCheckbox = document.getElementById('selectAll');
    const selectCountSpan = document.querySelector('.select-count');
    const saveLeadsBtn = document.querySelector('.action-btn.primary');
    const draftOutreachBtn = document.querySelector('.action-btn.secondary');
    const closeWarningBtn = document.getElementById('closeWarning');
    const warningStrip = document.getElementById('warningStrip');
    
    // Modal Elements
    const detailsModal = document.getElementById('detailsModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeModal');
    const modalContent = document.getElementById('modalContent');

    // ── 1. Load Data from LocalStorage ──
    let leadsData = [];
    try {
        const storedData = localStorage.getItem('skyline_leads_data');
        if (storedData) {
            leadsData = JSON.parse(storedData);
        }
    } catch (e) {
        console.error('Failed to parse lead data:', e);
    }

    // ── 2. Render Lead Cards Dynamically ──
    function renderLeads() {
        if (!leadsList) return;
        leadsList.innerHTML = ''; // Clear hardcoded examples

        if (leadsData.length === 0) {
            leadsList.innerHTML = '<div style="text-align:center; padding:40px; color:#9697A1;">No leads found. Try a new search.</div>';
            return;
        }

        // Update results count in toolbar
        const countEl = document.getElementById('resultsCount');
        if (countEl) countEl.textContent = `${leadsData.length} prospects found`;

        leadsData.forEach((lead, index) => {
            const card = document.createElement('div');
            card.className = 'lead-card';
            card.setAttribute('data-id', index);
            
            // Determine confidence badge based on email status
            let badgeClass = 'low';
            let badgeText = 'Needs verification';
            if (lead.emailStatus === 'verified') {
                badgeClass = 'high';
                badgeText = 'High confidence';
            } else if (lead.email && lead.email.includes('@')) {
                badgeClass = 'medium';
                badgeText = 'Medium confidence';
            }

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
                    <button class="view-btn">
                        More
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            `;

            // Add click event for details
            const viewBtn = card.querySelector('.view-btn');
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetailsModal(lead);
            });
            
            // Also allow clicking the whole card to open details
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.checkbox-wrapper') && !e.target.closest('.view-btn')) {
                    openDetailsModal(lead);
                }
            });

            leadsList.appendChild(card);
        });

        // Re-initialize selection logic for new elements
        initSelectionLogic();
    }

    // ── 3. Details Modal Logic ──
    function openDetailsModal(lead) {
        if (!detailsModal || !modalContent) return;

        const phone = lead.phoneNumber || 'Not publicly listed — try their website contact form';
        const info = lead.companyInformation || 'No additional information available.';
        const email = lead.email || 'No email found';

        modalContent.innerHTML = `
            <h2 style="margin-bottom:16px; color:white;">${lead.companyName}</h2>
            
            <div style="margin-bottom:12px;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Email Address</div>
                <div style="color:white; font-size:1rem;">${email}</div>
                <div style="color:${lead.emailStatus === 'verified' ? '#22C55E' : '#FFAA00'}; font-size:0.75rem; margin-top:2px;">
                    Status: ${lead.emailStatus || 'unknown'}
                </div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Phone Number</div>
                <div style="color:white; font-size:1rem;">${phone}</div>
            </div>

            <div style="margin-bottom:12px;">
                <div style="color:#9697A1; font-size:0.8rem; margin-bottom:4px;">Company Information</div>
                <div style="color:white; font-size:0.9rem; line-height:1.5;">${info}</div>
            </div>
        `;

        detailsModal.style.display = 'flex';
    }

    function closeModal() {
        if (detailsModal) detailsModal.style.display = 'none';
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

    // ── 4. Selection Logic ──
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
            if (draftOutreachBtn) {
                draftOutreachBtn.disabled = !hasSelection;
                draftOutreachBtn.style.opacity = hasSelection ? '1' : '0.5';
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

    // ── 5. Warning Strip Dismissal ──
    if (closeWarningBtn && warningStrip) {
        closeWarningBtn.addEventListener('click', function() {
            warningStrip.style.display = 'none';
        });
    }

    // ── 6. Bulk Action Buttons ──
    if (saveLeadsBtn) {
        saveLeadsBtn.addEventListener('click', function() {
            if (this.disabled) return;
            const selectedIds = Array.from(document.querySelectorAll('.lead-checkbox:checked'))
                .map(cb => cb.closest('.lead-card').getAttribute('data-id'));
            
            console.log('[ACTION] Saving leads:', selectedIds);
            alert(`Saving ${selectedIds.length} leads to your database...`);
        });
    }

    if (draftOutreachBtn) {
        draftOutreachBtn.addEventListener('click', function() {
            if (this.disabled) return;
            const selectedIds = Array.from(document.querySelectorAll('.lead-checkbox:checked'))
                .map(cb => cb.closest('.lead-card').getAttribute('data-id'));
            
            console.log('[ACTION] Drafting outreach for:', selectedIds);
            alert(`Starting outreach draft for ${selectedIds.length} leads...`);
        });
    }

    // Initial Render
    renderLeads();
    console.log('✅ [LEADS.JS] Lead Results Page Ready with Dynamic Data');
});

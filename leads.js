// ============================================================
// leads.js - Skyline AI · Lead Results Logic
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // ── DOM Elements ──
    const selectAllCheckbox = document.getElementById('selectAll');
    const leadCheckboxes = document.querySelectorAll('.lead-checkbox');
    const selectCountSpan = document.querySelector('.select-count');
    const saveLeadsBtn = document.querySelector('.action-btn.primary');
    const draftOutreachBtn = document.querySelector('.action-btn.secondary');
    const closeWarningBtn = document.getElementById('closeWarning');
    const warningStrip = document.getElementById('warningStrip');
    const viewButtons = document.querySelectorAll('.view-btn');
    const menuButtons = document.querySelectorAll('.menu-btn');

    // ── 1. Selection Logic ──

    function updateSelectionState() {
        const total = leadCheckboxes.length;
        const checked = Array.from(leadCheckboxes).filter(cb => cb.checked).length;
        
        // Update count text
        selectCountSpan.textContent = `${checked} selected`;

        // Update Master Checkbox state
        if (checked === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checked === total) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true; // Shows a dash in some browsers
        }

        // Enable/Disable Bulk Actions
        const hasSelection = checked > 0;
        saveLeadsBtn.disabled = !hasSelection;
        draftOutreachBtn.disabled = !hasSelection;
        
        if (!hasSelection) {
            saveLeadsBtn.style.opacity = '0.5';
            draftOutreachBtn.style.opacity = '0.5';
        } else {
            saveLeadsBtn.style.opacity = '1';
            draftOutreachBtn.style.opacity = '1';
        }
    }

    // Master Select All Toggle
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            leadCheckboxes.forEach(cb => {
                cb.checked = isChecked;
            });
            updateSelectionState();
        });
    }

    // Individual Lead Toggles
    leadCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            updateSelectionState();
        });
    });

    // Initialize state on load
    updateSelectionState();

    // ── 2. Warning Strip Dismissal ──

    if (closeWarningBtn && warningStrip) {
        closeWarningBtn.addEventListener('click', function() {
            warningStrip.style.display = 'none';
        });
    }

    // ── 3. View Button Interactions ──

    viewButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Find the parent card to get the ID
            const card = this.closest('.lead-card');
            const leadId = card ? card.getAttribute('data-id') : 'unknown';
            
            console.log(`[NAV] Opening details for lead ID: ${leadId}`);
            // In a real app, this would route to a details page:
            // window.location.href = `lead-details.html?id=${leadId}`;
            alert(`Opening details for Lead #${leadId}`);
        });
    });

    // ── 4. Menu Button Interactions ──

    menuButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent card click
            const card = this.closest('.lead-card');
            const leadId = card ? card.getAttribute('data-id') : 'unknown';
            
            console.log(`[MENU] Options opened for lead ID: ${leadId}`);
            // In a real app, this would open a popover or context menu
            alert(`Options menu for Lead #${leadId}`);
        });
    });

    // ── 5. Bulk Action Buttons ──

    if (saveLeadsBtn) {
        saveLeadsBtn.addEventListener('click', function() {
            if (this.disabled) return;
            const selectedIds = Array.from(leadCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.closest('.lead-card').getAttribute('data-id'));
            
            console.log('[ACTION] Saving leads:', selectedIds);
            alert(`Saving ${selectedIds.length} leads to your database...`);
        });
    }

    if (draftOutreachBtn) {
        draftOutreachBtn.addEventListener('click', function() {
            if (this.disabled) return;
            const selectedIds = Array.from(leadCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.closest('.lead-card').getAttribute('data-id'));
            
            console.log('[ACTION] Drafting outreach for:', selectedIds);
            alert(`Starting outreach draft for ${selectedIds.length} leads...`);
        });
    }

    console.log('✅ [LEADS.JS] Lead Results Page Ready');
});

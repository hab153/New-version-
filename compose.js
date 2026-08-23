// ============================================================
// compose.js — Skyline AA-1 Compose Page Logic
// ============================================================

// ─── CONFIG ───
var BACKEND = 'https://skylineapp-backend-file.onrender.com';
var token = localStorage.getItem('token');

// ─── DOM ELEMENTS ───
var closeBtn = document.getElementById('closeCompose');
var cancelBtn = document.getElementById('cancelCompose');
var toInput = document.getElementById('toInput');
var subjectInput = document.getElementById('subjectInput');
var messageInput = document.getElementById('messageInput');
var sendBtn = document.getElementById('sendBtn');
var composeForm = document.getElementById('composeForm');
var recentDropdown = document.getElementById('recentDropdown');
var recentToggle = document.getElementById('recentToggle');
var toast = document.getElementById('toast');

// ─── CHARACTER COUNTER ELEMENTS ───
var charCount = document.getElementById('charCount');
var charMax = document.getElementById('charMax');
var wordCount = document.getElementById('wordCount');

// ─── STATE ───
var isSending = false;
var toastTimeout = null;

// ============================================================
// ✅ AUTH CHECK
// ============================================================
if (!token) {
    window.location.href = 'login.html';
}

// ============================================================
// ✅ HELPERS
// ============================================================

function safeSanitize(str) {
    if (!str) return '';
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(str);
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type) {
    type = type || 'info';
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
        toast.classList.remove('show');
    }, 4000);
}

function goBack() {
    window.location.href = 'notifications.html';
}

// ============================================================
// ✅ CHARACTER COUNTER
// ============================================================

function updateCharCounter() {
    var text = messageInput.value || '';
    var length = text.length;
    var maxLength = 5000;
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;

    // Update character count
    charCount.textContent = length;
    charMax.textContent = maxLength;

    // Color coding
    charCount.className = 'count';
    if (length > maxLength) {
        charCount.classList.add('danger');
    } else if (length > maxLength * 0.85) {
        charCount.classList.add('warning');
    }

    // Update word count
    wordCount.textContent = words + ' word' + (words !== 1 ? 's' : '');
}

// ─── EVENT: Message input → update counter ───
messageInput.addEventListener('input', updateCharCounter);

// ─── INITIAL COUNTER ───
updateCharCounter();

// ============================================================
// ✅ RECENT CONTACTS
// ============================================================

function loadRecentContacts() {
    fetch(BACKEND + '/api/conversations?limit=10', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (!data) return;
        var contacts = data.data || [];
        renderRecentContacts(contacts);
    })
    .catch(function(err) {
        console.error('Failed to load recent contacts:', err);
    });
}

function renderRecentContacts(contacts) {
    recentDropdown.innerHTML = '';

    if (!contacts || contacts.length === 0) {
        var emptyItem = document.createElement('button');
        emptyItem.className = 'recent-dropdown-item';
        emptyItem.textContent = 'No recent contacts';
        emptyItem.disabled = true;
        emptyItem.style.color = '#505050';
        emptyItem.style.cursor = 'default';
        recentDropdown.appendChild(emptyItem);
        return;
    }

    // Show only first 10
    var displayContacts = contacts.slice(0, 10);

    for (var i = 0; i < displayContacts.length; i++) {
        var c = displayContacts[i];
        var item = document.createElement('button');
        item.className = 'recent-dropdown-item';
        item.innerHTML = '<span class="rd-name">' + safeSanitize(c.name || 'Unknown') + '</span><span class="rd-email">' + safeSanitize(c.email || '') + '</span>';
        item.addEventListener('click', function(email) {
            return function() {
                toInput.value = email;
                recentDropdown.classList.remove('show');
            };
        }(c.email || ''));
        recentDropdown.appendChild(item);
    }
}

// ─── TOGGLE DROPDOWN ───
recentToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    recentDropdown.classList.toggle('show');
});

// ─── CLOSE DROPDOWN ON CLICK OUTSIDE ───
document.addEventListener('click', function(e) {
    if (!recentToggle.contains(e.target) && !recentDropdown.contains(e.target)) {
        recentDropdown.classList.remove('show');
    }
});

// ============================================================
// ✅ SEND EMAIL
// ============================================================

function validateForm() {
    var to = toInput.value.trim();
    var subject = subjectInput.value.trim();
    var message = messageInput.value.trim();

    if (!to) {
        showToast('Please enter a recipient email address.', 'error');
        toInput.focus();
        return false;
    }

    // Basic email validation
    if (!to.includes('@') || !to.includes('.')) {
        showToast('Please enter a valid email address.', 'error');
        toInput.focus();
        return false;
    }

    if (!message) {
        showToast('Please enter a message.', 'error');
        messageInput.focus();
        return false;
    }

    if (message.length > 5000) {
        showToast('Message exceeds 5000 character limit.', 'error');
        messageInput.focus();
        return false;
    }

    return true;
}

function sendEmail() {
    if (isSending) return;
    if (!validateForm()) return;

    isSending = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');

    var payload = {
        leads: [{
            name: toInput.value.split('@')[0] || 'Lead',
            email: toInput.value.trim(),
            company: '',
            messages: [{
                subject: subjectInput.value.trim() || '(no subject)',
                body: messageInput.value.trim()
            }]
        }],
        allowNewLead: true
    };

    fetch(BACKEND + '/api/leads/batch-send', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(function(res) {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('HTTP ' + res.status);
        }
        return res.json();
    })
    .then(function(data) {
        if (data.success) {
            showToast('✅ Email sent successfully!', 'success');
            // Clear form after successful send
            toInput.value = '';
            subjectInput.value = '';
            messageInput.value = '';
            updateCharCounter();
            setTimeout(goBack, 1500);
        } else {
            showToast('Failed to send: ' + (data.message || 'Unknown error'), 'error');
        }
    })
    .catch(function(err) {
        console.error('Send email error:', err);
        showToast('Connection error. Please try again.', 'error');
    })
    .finally(function() {
        isSending = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
    });
}

// ============================================================
// ✅ CLOSE / CANCEL
// ============================================================

function closeCompose() {
    if (messageInput.value.trim() || subjectInput.value.trim()) {
        if (confirm('Are you sure you want to discard this message?')) {
            goBack();
        }
        return;
    }
    goBack();
}

closeBtn.addEventListener('click', closeCompose);
cancelBtn.addEventListener('click', closeCompose);

// ─── ESC KEY ───
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCompose();
    }
});

// ─── CMD+ENTER / CTRL+ENTER ───
document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        sendEmail();
    }
});

// ============================================================
// ✅ FORM SUBMIT
// ============================================================

composeForm.addEventListener('submit', function(e) {
    e.preventDefault();
    sendEmail();
});

// ============================================================
// ✅ INIT
// ============================================================

loadRecentContacts();

console.log('✅ [COMPOSE] Page loaded with character counter');

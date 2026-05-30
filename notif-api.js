const BACKEND = 'https://skylineapp-backend-file.onrender.com';
const token = localStorage.getItem('token');

// Global State for API interactions
let currentLeadId = null;
let isAutoReplyEnabled = false;
let autoReplyInstructions = "";

async function loadContacts() {
  try {
    const res = await fetch(`${BACKEND}/api/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const contacts = await res.json();
    updateStats(contacts);
    renderContacts(contacts);
    return contacts;
  } catch (err) {
    document.getElementById('contactList').innerHTML =
      '<div style="padding:28px; text-align:center; color:var(--text-3); font-family:var(--font-mono); font-size:11px;">FAILED TO LOAD · REFRESH TO RETRY</div>';
    return [];
  }
}

async function sendReply(text) {
  if (!text || !currentLeadId) return;
  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  
  // We need to get current name/email from UI state or global vars
  // Assuming currentLeadName and currentLeadEmail are accessible or passed
  const payload = {
    leads: [{ 
      name: window.currentLeadName, 
      email: window.currentLeadEmail, 
      company: '',
      messages: [{ subject: "Re: Conversation", body: text }] 
    }]
  };

  try {
    const res = await fetch(`${BACKEND}/api/leads/batch-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.status === 401 || data.error === 'NYLAS_DISCONNECTED') {
      localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
      alert("⚠️ Email session expired. Please reconnect.");      window.location.href = 'dashboard.html?connect=true';
      return;
    }
    if (data.success) {
      document.getElementById('replyText').value = '';
      document.getElementById('replyText').style.height = '38px';
      openChat(currentLeadId, window.currentLeadName, window.currentLeadEmail);
    } else { alert("Failed to send: " + JSON.stringify(data.errors)); }
  } catch {
    localStorage.setItem('pendingEmailPayload', JSON.stringify(payload));
    alert("Connection error. Message saved.");
    window.location.href = 'dashboard.html?connect=true';
  } finally { btn.disabled = false; }
}

async function saveAutoReplyInstructions(instructions) {
  if (!instructions) { alert("Please enter AI instructions."); return; }
  try {
    const res = await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-reply`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ enabled: true, instructions })
    });
    if (res.ok) {
      isAutoReplyEnabled = true;
      autoReplyInstructions = instructions;
      updateAutoReplyUI();
      return true;
    } else { alert("Failed to save."); return false; }
  } catch { alert("Connection error."); return false; }
}

async function saveAutoReplyStatus() {
  try {
    await fetch(`${BACKEND}/api/leads/${currentLeadId}/auto-reply`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ enabled: isAutoReplyEnabled })
    });
    updateAutoReplyUI();
  } catch {}
}

async function renameCustomer(newName) {
  if (newName && newName !== window.currentLeadName) {
    try {
      await fetch(`${BACKEND}/api/leads/${currentLeadId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newName })      });
      window.currentLeadName = newName;
      document.getElementById('chatName').innerText = newName;
      document.getElementById('chatAvatar').innerText = getInitials(newName);
      loadContacts();
    } catch { alert("Failed to rename."); }
  }
}

async function fetchConversationDetails(leadId) {
    const res = await fetch(`${BACKEND}/api/conversations/${leadId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await res.json();
}

async function markAsRead(leadId) {
    fetch(`${BACKEND}/api/conversations/${leadId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
    }

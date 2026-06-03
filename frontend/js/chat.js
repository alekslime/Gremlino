/* ============================================================
   Gremlino — chat.js  v0.3.0
   - File attach (any file, best-effort read)
   - Model switcher + pull with progress
   - Agent tools auto-detect
   ============================================================ */

const BACKEND = 'http://localhost:7000';

let currentSessionId = null;
let isStreaming = false;
let attachedFile = null; // { name, size, content }

// ── DOM refs ──────────────────────────────────────────────────
const chatBox       = document.getElementById('chat-box');
const promptEl      = document.getElementById('prompt');
const sendBtn       = document.getElementById('send-btn');
const statCpu       = document.getElementById('stat-cpu');
const statRam       = document.getElementById('stat-ram');
const statUptime    = document.getElementById('stat-uptime');
const statModel     = document.getElementById('stat-model');
const sessionList   = document.getElementById('session-list');
const newChatBtn    = document.getElementById('new-chat-btn');
const fileInput     = document.getElementById('file-input');
const attachBar     = document.getElementById('attach-bar');
const attachName    = document.getElementById('attach-name');
const attachSize    = document.getElementById('attach-size');
const attachClear   = document.getElementById('attach-clear');
const modelSelect   = document.getElementById('model-select');
const modelCustom   = document.getElementById('model-custom');
const modelSetBtn   = document.getElementById('model-set-btn');
const pullBar       = document.getElementById('pull-bar');
const pullLabel     = document.getElementById('pull-label');
const pullFill      = document.getElementById('pull-fill');
const pullPct       = document.getElementById('pull-pct');

// ── Helpers ───────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtBytes(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1024/1024).toFixed(1)}MB`;
}
function scrollBottom() { chatBox.scrollTop = chatBox.scrollHeight; }
function addSeparator() {
  if (chatBox.children.length > 0) {
    const hr = document.createElement('hr');
    hr.className = 'message-separator';
    chatBox.appendChild(hr);
  }
}

// ── File attach ───────────────────────────────────────────────
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  attachName.textContent = file.name;
  attachSize.textContent = `(${fmtBytes(file.size)})`;
  attachBar.style.display = 'flex';

  // Try to read as text; binary files get a note
  try {
    const text = await file.text();
    // Heuristic: if >20% non-printable chars it's probably binary
    const nonPrintable = (text.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
    if (nonPrintable / text.length > 0.2) {
      attachedFile = { name: file.name, size: file.size, content: `[binary file: ${file.name}, ${fmtBytes(file.size)}]` };
    } else {
      attachedFile = { name: file.name, size: file.size, content: text };
    }
  } catch (_) {
    attachedFile = { name: file.name, size: file.size, content: `[could not read file: ${file.name}]` };
  }
  fileInput.value = '';
});

attachClear.addEventListener('click', () => {
  attachedFile = null;
  attachBar.style.display = 'none';
  attachName.textContent = '';
  attachSize.textContent = '';
});

// ── Model switcher ────────────────────────────────────────────
async function loadModels() {
  try {
    const resp = await fetch(`${BACKEND}/api/models/`);
    const data = await resp.json();
    modelSelect.innerHTML = '';
    (data.models || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === data.active) opt.selected = true;
      modelSelect.appendChild(opt);
    });
    if (data.active) statModel.textContent = data.active;
  } catch (_) {}
}

async function setModel(name) {
  name = name.trim();
  if (!name) return;

  // Check if it's already in the list
  const existing = Array.from(modelSelect.options).map(o => o.value);
  if (existing.includes(name)) {
    await fetch(`${BACKEND}/api/models/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: name }),
    });
    await loadModels();
    return;
  }

  // Not found — pull it
  pullBar.style.display = 'flex';
  pullLabel.textContent = `pulling ${name}...`;
  pullFill.style.width = '0%';
  pullPct.textContent = '0%';

  try {
    const resp = await fetch(`${BACKEND}/api/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: name }),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.pct != null) {
            pullFill.style.width = `${payload.pct}%`;
            pullPct.textContent = `${payload.pct}%`;
          }
          pullLabel.textContent = payload.status || 'pulling...';
          if (payload.status === 'done' || payload.status === 'error') break;
        } catch (_) {}
      }
    }
  } catch (e) {
    pullLabel.textContent = 'pull failed';
  }

  setTimeout(() => { pullBar.style.display = 'none'; }, 1500);
  await loadModels();
}

modelSetBtn.addEventListener('click', async () => {
  const custom = modelCustom.value.trim();
  const selected = modelSelect.value;
  await setModel(custom || selected);
  modelCustom.value = '';
});

modelCustom.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    await setModel(modelCustom.value.trim());
    modelCustom.value = '';
  }
});

modelSelect.addEventListener('change', async () => {
  await setModel(modelSelect.value);
});

// ── Message rendering ─────────────────────────────────────────
function renderMessage({ role, content, time, tool_call, tool_result, file_name }, sep = true) {
  if (sep) addSeparator();
  const wrap = document.createElement('div');
  wrap.className = 'message';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  const displayTime = typeof time === 'number'
    ? new Date(time * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : (time || nowTime());
  timeEl.textContent = `[${displayTime}]`;
  const label = document.createElement('span');
  label.className = `message-label ${role === 'user' ? 'user' : 'bot'}`;
  label.textContent = role === 'user' ? 'YOU' : 'GREMLINO';
  meta.appendChild(timeEl);
  meta.appendChild(label);
  wrap.appendChild(meta);

  if (file_name) {
    const fileTag = document.createElement('div');
    fileTag.className = 'file-tag';
    fileTag.textContent = `📎 ${file_name}`;
    wrap.appendChild(fileTag);
  }

  if (tool_call) {
    const toolBox = document.createElement('div');
    toolBox.className = 'tool-call-box';
    toolBox.textContent = '⚙ ' + JSON.stringify(tool_call);
    wrap.appendChild(toolBox);
  }

  if (tool_result) {
    const resultBox = document.createElement('div');
    resultBox.className = 'tool-result-box';
    const s = typeof tool_result === 'string' ? tool_result : JSON.stringify(tool_result, null, 2);
    resultBox.textContent = s.slice(0, 800) + (s.length > 800 ? '\n...' : '');
    wrap.appendChild(resultBox);
  }

  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = content;
  wrap.appendChild(body);

  chatBox.appendChild(wrap);
  scrollBottom();
  return { wrap, body };
}

// ── Thinking spinner ──────────────────────────────────────────
function showThinking() {
  addSeparator();
  const wrap = document.createElement('div');
  wrap.className = 'message';
  wrap.id = 'thinking-indicator';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const label = document.createElement('span');
  label.className = 'message-label bot';
  label.textContent = 'GREMLINO';
  meta.appendChild(label);
  wrap.appendChild(meta);
  const body = document.createElement('div');
  body.className = 'message-body thinking';
  body.innerHTML = '<span class="think-dot">.</span><span class="think-dot">.</span><span class="think-dot">.</span>';
  wrap.appendChild(body);
  chatBox.appendChild(wrap);
  scrollBottom();
}
function hideThinking() {
  const el = document.getElementById('thinking-indicator');
  if (el) el.remove();
}

// ── Confirmation dialog ───────────────────────────────────────
function showConfirmDialog(tool_call) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    const box = document.createElement('div');
    box.className = 'confirm-box';
    const title = document.createElement('div');
    title.className = 'confirm-title';
    title.textContent = 'gremlino wants to execute';
    const detail = document.createElement('div');
    detail.className = 'confirm-detail';
    detail.textContent = JSON.stringify(tool_call, null, 2);
    const btns = document.createElement('div');
    btns.className = 'confirm-btns';
    const yes = document.createElement('button');
    yes.className = 'confirm-yes';
    yes.textContent = 'allow';
    yes.onclick = () => { overlay.remove(); resolve(true); };
    const no = document.createElement('button');
    no.className = 'confirm-no';
    no.textContent = 'deny';
    no.onclick = () => { overlay.remove(); resolve(false); };
    btns.appendChild(yes);
    btns.appendChild(no);
    box.appendChild(title);
    box.appendChild(detail);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

// ── Tool handling ─────────────────────────────────────────────
async function handleToolCall(tool_call, prompt) {
  if (['shell', 'create_file'].includes(tool_call.tool)) {
    const allowed = await showConfirmDialog(tool_call);
    if (!allowed) {
      renderMessage({ role: 'bot', content: 'cancelled.', time: nowTime() });
      return;
    }
  }
  showThinking();
  try {
    const resp = await fetch(`${BACKEND}/api/chat/tool/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_call, prompt, session_id: currentSessionId }),
    });
    const data = await resp.json();
    hideThinking();
    renderMessage({ role: 'bot', content: data.reply, time: nowTime(), tool_call, tool_result: data.tool_result });
    await refreshSessionList();
  } catch (_) {
    hideThinking();
    renderMessage({ role: 'bot', content: 'tool execution failed.', time: nowTime() });
  }
}

// ── Send message ──────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;
  const raw = promptEl.value.trim();
  if (!raw) return;

  isStreaming = true;
  sendBtn.disabled = true;
  promptEl.value = '';
  autoResize();

  if (!currentSessionId) await startNewSession();

  const file = attachedFile;
  if (file) {
    attachedFile = null;
    attachBar.style.display = 'none';
  }

  renderMessage({ role: 'user', content: raw, time: nowTime(), file_name: file?.name });

  // Bot streaming placeholder
  addSeparator();
  const botWrap = document.createElement('div');
  botWrap.className = 'message';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = `[${nowTime()}]`;
  const labelEl = document.createElement('span');
  labelEl.className = 'message-label bot';
  labelEl.textContent = 'GREMLINO';
  meta.appendChild(timeEl);
  meta.appendChild(labelEl);
  botWrap.appendChild(meta);
  const bodyEl = document.createElement('div');
  bodyEl.className = 'message-body';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  bodyEl.appendChild(cursor);
  botWrap.appendChild(bodyEl);
  chatBox.appendChild(botWrap);
  scrollBottom();

  let fullText = '';

  try {
    const resp = await fetch(`${BACKEND}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: raw,
        session_id: currentSessionId,
        file_content: file?.content || null,
      }),
    });

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;
        try {
          const { token } = JSON.parse(payload);
          fullText += token;
          bodyEl.textContent = fullText;
          bodyEl.appendChild(cursor);
          scrollBottom();
        } catch (_) {}
      }
    }
  } catch (_) {
    fullText = 'stream failed.';
    bodyEl.textContent = fullText;
  }

  cursor.remove();

  // Tool call check
  if (fullText.trim().startsWith('{')) {
    botWrap.remove();
    const prev = chatBox.lastElementChild;
    if (prev?.classList.contains('message-separator')) prev.remove();

    isStreaming = false;
    sendBtn.disabled = false;
    promptEl.focus();

    try {
      const checkResp = await fetch(`${BACKEND}/api/chat/tool/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: fullText }),
      });
      const check = await checkResp.json();
      if (check.is_tool) {
        await handleToolCall(check.tool_call, raw);
      } else {
        renderMessage({ role: 'bot', content: fullText, time: nowTime() });
        await saveBot(fullText);
      }
    } catch (_) {
      renderMessage({ role: 'bot', content: fullText, time: nowTime() });
    }
  } else {
    await saveBot(fullText);
    await refreshSessionList();
    isStreaming = false;
    sendBtn.disabled = false;
    promptEl.focus();
  }
}

async function saveBot(content) {
  if (!currentSessionId) return;
  try {
    await fetch(`${BACKEND}/api/chat/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSessionId, role: 'bot', content }),
    });
  } catch (_) {}
}

// ── Sessions ──────────────────────────────────────────────────
async function startNewSession() {
  try {
    const resp = await fetch(`${BACKEND}/api/sessions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = await resp.json();
    currentSessionId = session.id;
    chatBox.innerHTML = '';
    await refreshSessionList();
  } catch (_) { currentSessionId = null; }
}

async function loadSession(sessionId) {
  try {
    const resp = await fetch(`${BACKEND}/api/sessions/${sessionId}`);
    const session = await resp.json();
    currentSessionId = session.id;
    chatBox.innerHTML = '';
    session.messages.forEach((msg, i) => renderMessage(msg, i > 0));
    await refreshSessionList();
  } catch (_) {}
}

async function refreshSessionList() {
  try {
    const resp = await fetch(`${BACKEND}/api/sessions/`);
    const sessions = await resp.json();
    renderSessionList(sessions);
  } catch (_) {}
}

function renderSessionList(sessions) {
  sessionList.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === currentSessionId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'session-name';
    name.textContent = s.name.length > 30 ? s.name.slice(0, 30) + '…' : s.name;
    name.title = s.name;
    const count = document.createElement('span');
    count.className = 'session-count';
    count.textContent = `${s.message_count}`;
    const del = document.createElement('button');
    del.className = 'session-delete';
    del.textContent = '×';
    del.onclick = async (e) => {
      e.stopPropagation();
      await fetch(`${BACKEND}/api/sessions/${s.id}`, { method: 'DELETE' });
      if (s.id === currentSessionId) { currentSessionId = null; chatBox.innerHTML = ''; }
      await refreshSessionList();
    };
    item.appendChild(name);
    item.appendChild(count);
    item.appendChild(del);
    item.onclick = () => loadSession(s.id);
    sessionList.appendChild(item);
  });
}

newChatBtn.addEventListener('click', startNewSession);

// ── Textarea ──────────────────────────────────────────────────
function autoResize() {
  promptEl.style.height = 'auto';
  promptEl.style.height = Math.min(promptEl.scrollHeight, 120) + 'px';
}
promptEl.addEventListener('input', autoResize);
promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── System stats ──────────────────────────────────────────────
let uptimeSeconds = null;

async function fetchStats() {
  try {
    const resp = await fetch(`${BACKEND}/api/system/`);
    const data = await resp.json();
    statCpu.textContent = `${Math.round(data.cpu)}%`;
    statRam.textContent = data.ram_gb ? `${data.ram_gb} GB` : `${Math.round(data.ram)}%`;
    if (data.model) statModel.textContent = data.model;
    if (data.uptime_seconds != null && uptimeSeconds === null) uptimeSeconds = data.uptime_seconds;
  } catch (_) {}
}

function tickUptime() {
  if (uptimeSeconds === null) return;
  uptimeSeconds++;
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;
  statUptime.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

fetchStats();
setInterval(fetchStats, 5000);
setInterval(tickUptime, 1000);

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  await loadModels();
  await refreshSessionList();
  try {
    const resp = await fetch(`${BACKEND}/api/sessions/`);
    const sessions = await resp.json();
    if (sessions.length > 0) await loadSession(sessions[0].id);
    else await startNewSession();
  } catch (_) { await startNewSession(); }
  promptEl.focus();
})();

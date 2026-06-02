/* ============================================================
   Gremlino — chat.js
   - Streaming responses (SSE / fetch ReadableStream)
   - Chat history with localStorage persistence
   - System stats polling
   ============================================================ */

const BACKEND = 'http://localhost:7000';

// ── State ────────────────────────────────────────────────────
let history = [];          // [{role, content, time, emote?}]
let isStreaming = false;

// ── DOM refs ─────────────────────────────────────────────────
const chatBox    = document.getElementById('chat-box');
const promptEl   = document.getElementById('prompt');
const sendBtn    = document.getElementById('send-btn');
const statCpu    = document.getElementById('stat-cpu');
const statRam    = document.getElementById('stat-ram');
const statUptime = document.getElementById('stat-uptime');

// ── Time helper ───────────────────────────────────────────────
function nowTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ── Render a single message ────────────────────────────────
function renderMessage({ role, content, time, emote }, appendSeparator = true) {
  if (appendSeparator && chatBox.children.length > 0) {
    const hr = document.createElement('hr');
    hr.className = 'message-separator';
    chatBox.appendChild(hr);
  }

  const wrap = document.createElement('div');
  wrap.className = 'message';

  // meta row: timestamp + label
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = `[${time}]`;

  const label = document.createElement('span');
  label.className = `message-label ${role === 'user' ? 'user' : 'bot'}`;
  label.textContent = role === 'user' ? 'YOU' : 'GREMLINO';

  meta.appendChild(timeEl);
  meta.appendChild(label);
  wrap.appendChild(meta);

  // optional emote
  if (emote) {
    const emoteEl = document.createElement('div');
    emoteEl.className = 'message-emote';
    emoteEl.textContent = emote;
    wrap.appendChild(emoteEl);
  }

  // body
  const body = document.createElement('div');
  body.className = 'message-body';
  body.textContent = content;
  wrap.appendChild(body);

  chatBox.appendChild(wrap);
  scrollBottom();
  return { wrap, body };
}

// ── Render history from localStorage ─────────────────────────
function loadHistory() {
  try {
    const saved = localStorage.getItem('gremlino_history');
    if (saved) {
      history = JSON.parse(saved);
      history.forEach(msg => renderMessage(msg, chatBox.children.length > 0));
    }
  } catch (_) {
    history = [];
  }
}

function saveHistory() {
  try {
    // keep last 60 messages max
    if (history.length > 60) history = history.slice(-60);
    localStorage.setItem('gremlino_history', JSON.stringify(history));
  } catch (_) {}
}

// ── Scroll to bottom ─────────────────────────────────────────
function scrollBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ── Parse emote from Gremlino response ───────────────────────
// Gremlino sometimes opens with *something* — extract it
function parseEmote(text) {
  const match = text.match(/^\s*(\*[^*]+\*)\s*/);
  if (match) {
    return {
      emote: match[1],
      body: text.slice(match[0].length)
    };
  }
  return { emote: null, body: text };
}

// ── Send message ─────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;

  const raw = promptEl.value.trim();
  if (!raw) return;

  isStreaming = true;
  sendBtn.disabled = true;
  promptEl.value = '';
  autoResize();

  const userTime = nowTime();
  const userMsg = { role: 'user', content: raw, time: userTime };
  history.push(userMsg);
  renderMessage(userMsg);
  saveHistory();

  // Bot placeholder — streaming target
  const botTime = nowTime();
  if (chatBox.children.length > 0) {
    const hr = document.createElement('hr');
    hr.className = 'message-separator';
    chatBox.appendChild(hr);
  }

  const botWrap = document.createElement('div');
  botWrap.className = 'message';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = `[${botTime}]`;
  const labelEl = document.createElement('span');
  labelEl.className = 'message-label bot';
  labelEl.textContent = 'GREMLINO';
  meta.appendChild(timeEl);
  meta.appendChild(labelEl);
  botWrap.appendChild(meta);

  const emoteEl = document.createElement('div');
  emoteEl.className = 'message-emote';
  emoteEl.style.display = 'none';
  botWrap.appendChild(emoteEl);

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
        history: history.slice(-20).map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!resp.ok || !resp.body) throw new Error('stream failed');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const { token } = JSON.parse(raw);
          fullText += token;
          // check for emote prefix on the fly
          const { emote, body } = parseEmote(fullText);
          if (emote) {
            emoteEl.textContent = emote;
            emoteEl.style.display = '';
            bodyEl.textContent = body;
          } else {
            bodyEl.textContent = fullText;
          }
          bodyEl.appendChild(cursor);
          scrollBottom();
        } catch (_) {}
      }
    }
  } catch (err) {
    // fallback: non-streaming
    try {
      const resp = await fetch(`${BACKEND}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: raw })
      });
      const data = await resp.json();
      fullText = data.response ?? 'gremlino is confused.';
    } catch (_) {
      fullText = 'gremlino fell into a cable duct. try again.';
    }
    const { emote, body } = parseEmote(fullText);
    if (emote) {
      emoteEl.textContent = emote;
      emoteEl.style.display = '';
    }
    bodyEl.textContent = body || fullText;
    bodyEl.appendChild(cursor);
    scrollBottom();
  }

  // Remove cursor, finalise
  cursor.remove();

  const { emote, body } = parseEmote(fullText);
  const botMsg = {
    role: 'bot',
    content: body || fullText,
    time: botTime,
    emote: emote || undefined
  };
  history.push(botMsg);
  saveHistory();

  isStreaming = false;
  sendBtn.disabled = false;
  promptEl.focus();
}

// ── Auto-resize textarea ──────────────────────────────────────
function autoResize() {
  promptEl.style.height = 'auto';
  promptEl.style.height = Math.min(promptEl.scrollHeight, 120) + 'px';
}

promptEl.addEventListener('input', autoResize);

promptEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── System stats polling ──────────────────────────────────────
let uptimeSeconds = null;

async function fetchStats() {
  try {
    const resp = await fetch(`${BACKEND}/api/system/`);
    const data = await resp.json();

    statCpu.textContent = `${Math.round(data.cpu)}%`;
    statRam.textContent = data.ram_gb ? `${data.ram_gb} GB` : `${Math.round(data.ram)}%`;

    if (data.uptime_seconds != null && uptimeSeconds === null) {
      uptimeSeconds = data.uptime_seconds;
    }
  } catch (_) {
    statCpu.textContent = 'err';
  }
}

function tickUptime() {
  if (uptimeSeconds === null) return;
  uptimeSeconds++;
  const h  = Math.floor(uptimeSeconds / 3600);
  const m  = Math.floor((uptimeSeconds % 3600) / 60);
  const s  = uptimeSeconds % 60;
  statUptime.textContent =
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Poll stats every 5 s, tick uptime every second
fetchStats();
setInterval(fetchStats, 5000);
setInterval(tickUptime, 1000);

// ── Boot ──────────────────────────────────────────────────────
loadHistory();
promptEl.focus();
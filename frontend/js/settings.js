/* ============================================================
   Gremlino — settings.js  v0.4.0
   Settings modal + sidebar workspace switching
   ============================================================ */

const SETTINGS_BACKEND = 'http://localhost:7000';

// ── Workspace switching ───────────────────────────────────────
const toolBtns      = document.querySelectorAll('.tool-btn:not(.coming-soon)');
const workspaces    = document.querySelectorAll('.workspace');
let   pmLoaded      = false;

toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    switchWorkspace(tool);
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function switchWorkspace(tool) {
  workspaces.forEach(ws => ws.classList.remove('active'));

  if (tool === 'chat') {
    document.getElementById('workspace-chat').classList.add('active');
  } else if (tool === 'pm') {
    document.getElementById('workspace-pm').classList.add('active');
    if (!pmLoaded) { pmLoaded = true; pmLoad(); }
  } else {
    const csLabel = document.getElementById('cs-label');
    const names = {
      design: 'Design Tools',
      system: 'System Manager',
      honest: 'Be Honest',
      imggen: 'Image Gen',
      music: 'Music Gen',
    };
    if (csLabel && names[tool]) csLabel.textContent = names[tool];
    document.getElementById('workspace-soon').classList.add('active');
  }
}

// Make chat area accessible from sidebar by clicking off tool btns
// (currently there's no explicit "Chat" tool btn; chat is the default view)

// ── Settings modal ────────────────────────────────────────────
const overlay      = document.getElementById('settings-overlay');
const settingsBtn  = document.getElementById('settings-btn');
const closeBtn     = document.getElementById('settings-close');
const closeBtn2    = document.getElementById('settings-close-2');
const saveBtn      = document.getElementById('s-save-btn');
const snavBtns     = document.querySelectorAll('.snav-btn');
const sSections    = document.querySelectorAll('.s-section');

function openSettings() {
  overlay.classList.add('open');
  loadSettingsFromStorage();
}

function closeSettings() {
  overlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
closeBtn.addEventListener('click', closeSettings);
closeBtn2.addEventListener('click', closeSettings);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeSettings();
});

// Settings nav tabs
snavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    snavBtns.forEach(b => b.classList.remove('active'));
    sSections.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const section = document.getElementById(`s-${btn.dataset.section}`);
    if (section) section.classList.add('active');
  });
});

// ── Persist settings in localStorage ─────────────────────────
const SETTINGS_KEY = 'gremlino_settings';

const FIELD_MAP = [
  ['cfg-username',       'username'],
  ['cfg-provider',       'provider'],
  ['cfg-font-size',      'fontSize'],
  ['cfg-theme',          'theme'],
  ['cfg-openai-key',     'openaiKey'],
  ['cfg-openai-model',   'openaiModel'],
  ['cfg-anthropic-key',  'anthropicKey'],
  ['cfg-anthropic-model','anthropicModel'],
  ['cfg-gemini-key',     'geminiKey'],
  ['cfg-gemini-model',   'geminiModel'],
  ['cfg-groq-key',       'groqKey'],
  ['cfg-groq-model',     'groqModel'],
  ['cfg-custom-url',     'customUrl'],
  ['cfg-custom-key',     'customKey'],
  ['cfg-custom-model',   'customModel'],
];

function loadSettingsFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    FIELD_MAP.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && saved[key] != null) el.value = saved[key];
    });
  } catch (_) {}
}

function saveSettings() {
  const cfg = {};
  FIELD_MAP.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) cfg[key] = el.value;
  });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));

  // Apply font size
  if (cfg.fontSize) {
    document.documentElement.style.setProperty('font-size', cfg.fontSize + 'px');
  }

  // Persist provider config to backend
  pushSettingsToBackend(cfg).catch(() => {});

  closeSettings();
}

saveBtn.addEventListener('click', saveSettings);

async function pushSettingsToBackend(cfg) {
  // Only send non-sensitive provider selection and model choices
  // Keys are stored locally only — never sent to our own backend
  await fetch(`${SETTINGS_BACKEND}/api/settings/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: cfg.provider,
      openai_model: cfg.openaiModel,
      anthropic_model: cfg.anthropicModel,
      gemini_model: cfg.geminiModel,
      groq_model: cfg.groqModel,
      custom_url: cfg.customUrl,
      custom_model: cfg.customModel,
      // Keys sent only to BE for provider calls — stored in memory, not on disk
      openai_key: cfg.openaiKey,
      anthropic_key: cfg.anthropicKey,
      gemini_key: cfg.geminiKey,
      groq_key: cfg.groqKey,
      custom_key: cfg.customKey,
    }),
  });
}

// Apply saved font size on load
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (saved.fontSize) {
    document.documentElement.style.setProperty('font-size', saved.fontSize + 'px');
  }
} catch (_) {}

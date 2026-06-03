/* ============================================================
   Gremlino — pm.js  v0.4.0
   Project Manager workspace
   ============================================================ */

const PM_BACKEND = 'http://localhost:7000';

let pmProjects = [];
let pmActiveId = null;

// ── DOM ───────────────────────────────────────────────────────
const pmProjectList = document.getElementById('pm-project-list');
const pmNewBtn      = document.getElementById('pm-new-btn');
const pmEmpty       = document.getElementById('pm-empty');
const pmDetail      = document.getElementById('pm-detail');
const pmTitleInput  = document.getElementById('pm-title-input');
const pmDescription = document.getElementById('pm-description');
const pmNotes       = document.getElementById('pm-notes');
const pmDeleteBtn   = document.getElementById('pm-delete-btn');

// ── API helpers ───────────────────────────────────────────────
async function pmFetch(path, opts = {}) {
  const resp = await fetch(`${PM_BACKEND}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ── Load all projects ─────────────────────────────────────────
async function pmLoad() {
  try {
    pmProjects = await pmFetch('/api/projects/');
    renderProjectList();
    if (pmActiveId) {
      const still = pmProjects.find(p => p.id === pmActiveId);
      if (still) renderDetail(still);
      else showEmpty();
    }
  } catch (_) {}
}

// ── Render sidebar list ───────────────────────────────────────
function renderProjectList() {
  pmProjectList.innerHTML = '';
  pmProjects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'pm-project-item' + (p.id === pmActiveId ? ' active' : '');

    const name = document.createElement('span');
    name.className = 'pm-project-name';
    name.textContent = p.name || 'untitled';
    name.title = p.name;

    const counts = document.createElement('span');
    counts.className = 'pm-project-counts';
    const total = (p.tasks || []).length;
    const done  = (p.tasks || []).filter(t => t.status === 'done').length;
    counts.textContent = total > 0 ? `${done}/${total}` : '';

    item.appendChild(name);
    item.appendChild(counts);
    item.onclick = () => selectProject(p.id);
    pmProjectList.appendChild(item);
  });
}

// ── Select / show project ─────────────────────────────────────
async function selectProject(id) {
  pmActiveId = id;
  renderProjectList();
  const project = pmProjects.find(p => p.id === id);
  if (project) renderDetail(project);
}

function showEmpty() {
  pmActiveId = null;
  pmEmpty.style.display = 'flex';
  pmDetail.style.display = 'none';
  renderProjectList();
}

function renderDetail(project) {
  pmEmpty.style.display = 'none';
  pmDetail.style.display = 'flex';

  pmTitleInput.value = project.name || '';
  pmDescription.value = project.description || '';
  pmNotes.value = project.notes || '';

  renderKanban(project.tasks || []);
}

// ── Kanban ────────────────────────────────────────────────────
function renderKanban(tasks) {
  ['todo', 'in-progress', 'done'].forEach(status => {
    const col = document.getElementById(`tasks-${status}`);
    col.innerHTML = '';
    tasks.filter(t => t.status === status).forEach(task => {
      col.appendChild(makeTaskEl(task));
    });
  });
}

function makeTaskEl(task) {
  const el = document.createElement('div');
  el.className = 'kanban-task' + (task.status === 'done' ? ' done-task' : '');
  el.dataset.id = task.id;

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  const del = document.createElement('button');
  del.className = 'task-del';
  del.textContent = '×';
  del.onclick = async (e) => {
    e.stopPropagation();
    await pmDeleteTask(task.id);
  };

  el.appendChild(text);
  el.appendChild(del);

  // Click task body to cycle status
  text.onclick = async () => {
    const next = { 'todo': 'in-progress', 'in-progress': 'done', 'done': 'todo' };
    await pmUpdateTask(task.id, { status: next[task.status] });
  };

  return el;
}

// ── Add task inline ───────────────────────────────────────────
document.querySelectorAll('.kanban-add-btn').forEach(btn => {
  btn.onclick = () => showTaskInput(btn.dataset.status, btn);
});

function showTaskInput(status, addBtn) {
  // Remove any existing input rows
  document.querySelectorAll('.task-input-row').forEach(r => r.remove());

  const col = document.getElementById(`tasks-${status}`);
  const row = document.createElement('div');
  row.className = 'task-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'task name...';
  input.autofocus = true;

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'add';

  const doSave = async () => {
    const text = input.value.trim();
    if (text) await pmAddTask(status, text);
    row.remove();
  };

  input.onkeydown = async (e) => {
    if (e.key === 'Enter') await doSave();
    if (e.key === 'Escape') row.remove();
  };
  saveBtn.onclick = doSave;

  row.appendChild(input);
  row.appendChild(saveBtn);
  col.appendChild(row);
  input.focus();
}

// ── API: projects ─────────────────────────────────────────────
async function pmCreateProject() {
  try {
    const project = await pmFetch('/api/projects/', {
      method: 'POST',
      body: JSON.stringify({ name: 'new project' }),
    });
    await pmLoad();
    await selectProject(project.id);
    // Focus title for immediate rename
    setTimeout(() => { pmTitleInput.select(); }, 50);
  } catch (_) {}
}

async function pmSaveProject() {
  if (!pmActiveId) return;
  try {
    await pmFetch(`/api/projects/${pmActiveId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: pmTitleInput.value.trim() || 'untitled',
        description: pmDescription.value,
        notes: pmNotes.value,
      }),
    });
    await pmLoad();
  } catch (_) {}
}

async function pmDeleteProject() {
  if (!pmActiveId) return;
  try {
    await pmFetch(`/api/projects/${pmActiveId}`, { method: 'DELETE' });
    pmActiveId = null;
    await pmLoad();
    showEmpty();
  } catch (_) {}
}

// ── API: tasks ────────────────────────────────────────────────
async function pmAddTask(status, text) {
  if (!pmActiveId) return;
  try {
    await pmFetch(`/api/projects/${pmActiveId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ text, status }),
    });
    await pmLoad();
  } catch (_) {}
}

async function pmUpdateTask(taskId, patch) {
  if (!pmActiveId) return;
  try {
    await pmFetch(`/api/projects/${pmActiveId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await pmLoad();
  } catch (_) {}
}

async function pmDeleteTask(taskId) {
  if (!pmActiveId) return;
  try {
    await pmFetch(`/api/projects/${pmActiveId}/tasks/${taskId}`, { method: 'DELETE' });
    await pmLoad();
  } catch (_) {}
}

// ── Auto-save on blur ─────────────────────────────────────────
let pmSaveTimer = null;
function scheduleSave() {
  clearTimeout(pmSaveTimer);
  pmSaveTimer = setTimeout(pmSaveProject, 800);
}
pmTitleInput.addEventListener('input', scheduleSave);
pmDescription.addEventListener('input', scheduleSave);
pmNotes.addEventListener('input', scheduleSave);

// ── Events ────────────────────────────────────────────────────
pmNewBtn.onclick = pmCreateProject;
pmDeleteBtn.onclick = () => {
  if (confirm('Delete this project?')) pmDeleteProject();
};

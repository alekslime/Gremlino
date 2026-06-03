import json
import os
import uuid
import time

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'projects.json')

def _load():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def _save(projects):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(projects, f, indent=2)

def list_projects():
    return _load()

def get_project(project_id):
    for p in _load():
        if p['id'] == project_id:
            return p
    return None

def create_project(name='new project'):
    projects = _load()
    project = {
        'id': uuid.uuid4().hex[:8],
        'name': name,
        'description': '',
        'notes': '',
        'tasks': [],
        'created_at': int(time.time()),
        'updated_at': int(time.time()),
    }
    projects.insert(0, project)
    _save(projects)
    return project

def update_project(project_id, patch):
    projects = _load()
    for p in projects:
        if p['id'] == project_id:
            for k, v in patch.items():
                if k in ('name', 'description', 'notes'):
                    p[k] = v
            p['updated_at'] = int(time.time())
            _save(projects)
            return p
    return None

def delete_project(project_id):
    projects = _load()
    projects = [p for p in projects if p['id'] != project_id]
    _save(projects)
    return True

# ── Tasks ─────────────────────────────────────────────────────
def add_task(project_id, text, status='todo'):
    projects = _load()
    for p in projects:
        if p['id'] == project_id:
            task = {
                'id': uuid.uuid4().hex[:8],
                'text': text,
                'status': status,
                'created_at': int(time.time()),
            }
            p.setdefault('tasks', []).append(task)
            p['updated_at'] = int(time.time())
            _save(projects)
            return task
    return None

def update_task(project_id, task_id, patch):
    projects = _load()
    for p in projects:
        if p['id'] == project_id:
            for t in p.get('tasks', []):
                if t['id'] == task_id:
                    for k, v in patch.items():
                        if k in ('text', 'status'):
                            t[k] = v
                    p['updated_at'] = int(time.time())
                    _save(projects)
                    return t
    return None

def delete_task(project_id, task_id):
    projects = _load()
    for p in projects:
        if p['id'] == project_id:
            p['tasks'] = [t for t in p.get('tasks', []) if t['id'] != task_id]
            p['updated_at'] = int(time.time())
            _save(projects)
            return True
    return False

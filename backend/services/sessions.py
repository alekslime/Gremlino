"""
Session management — JSON file backed.
Each session is a dict: { id, name, created_at, messages: [] }
Stored in backend/data/sessions.json
"""
import json
import os
import time
import uuid

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
SESSIONS_FILE = os.path.join(DATA_DIR, 'sessions.json')


def _load() -> dict:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(SESSIONS_FILE):
        return {}
    try:
        with open(SESSIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save(data: dict):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SESSIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def list_sessions() -> list:
    data = _load()
    sessions = list(data.values())
    sessions.sort(key=lambda s: s.get('updated_at', s.get('created_at', 0)), reverse=True)
    # Return without full message history for the list view
    return [
        {
            'id': s['id'],
            'name': s['name'],
            'created_at': s['created_at'],
            'updated_at': s.get('updated_at', s['created_at']),
            'message_count': len(s.get('messages', [])),
        }
        for s in sessions
    ]


def create_session(name: str = None) -> dict:
    data = _load()
    sid = str(uuid.uuid4())[:8]
    now = time.time()
    session = {
        'id': sid,
        'name': name or f'session-{sid}',
        'created_at': now,
        'updated_at': now,
        'messages': [],
    }
    data[sid] = session
    _save(data)
    return session


def get_session(session_id: str) -> dict | None:
    data = _load()
    return data.get(session_id)


def append_message(session_id: str, role: str, content: str, emote: str = None, tool_call: dict = None, tool_result: str = None) -> bool:
    data = _load()
    if session_id not in data:
        return False
    msg = {
        'role': role,
        'content': content,
        'time': time.time(),
    }
    if emote:
        msg['emote'] = emote
    if tool_call:
        msg['tool_call'] = tool_call
    if tool_result is not None:
        msg['tool_result'] = tool_result
    data[session_id]['messages'].append(msg)
    data[session_id]['updated_at'] = time.time()

    # Auto-name: use first user message as session name (truncated)
    if role == 'user' and data[session_id]['name'].startswith('session-'):
        data[session_id]['name'] = content[:40].strip()

    _save(data)
    return True


def delete_session(session_id: str) -> bool:
    data = _load()
    if session_id not in data:
        return False
    del data[session_id]
    _save(data)
    return True


def rename_session(session_id: str, name: str) -> bool:
    data = _load()
    if session_id not in data:
        return False
    data[session_id]['name'] = name
    data[session_id]['updated_at'] = time.time()
    _save(data)
    return True

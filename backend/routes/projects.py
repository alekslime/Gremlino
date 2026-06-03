from flask import Blueprint, request, jsonify
from services.projects import (
    list_projects, get_project, create_project,
    update_project, delete_project,
    add_task, update_task, delete_task,
)

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/api/projects/', methods=['GET'])
def get_projects():
    return jsonify(list_projects())

@projects_bp.route('/api/projects/', methods=['POST'])
def post_project():
    data = request.get_json(silent=True) or {}
    project = create_project(name=data.get('name', 'new project'))
    return jsonify(project), 201

@projects_bp.route('/api/projects/<project_id>', methods=['GET'])
def get_one_project(project_id):
    p = get_project(project_id)
    if not p:
        return jsonify({'error': 'not found'}), 404
    return jsonify(p)

@projects_bp.route('/api/projects/<project_id>', methods=['PATCH'])
def patch_project(project_id):
    data = request.get_json(silent=True) or {}
    p = update_project(project_id, data)
    if not p:
        return jsonify({'error': 'not found'}), 404
    return jsonify(p)

@projects_bp.route('/api/projects/<project_id>', methods=['DELETE'])
def del_project(project_id):
    delete_project(project_id)
    return jsonify({'ok': True})

# ── Tasks ─────────────────────────────────────────────────────
@projects_bp.route('/api/projects/<project_id>/tasks', methods=['POST'])
def post_task(project_id):
    data = request.get_json(silent=True) or {}
    task = add_task(project_id, data.get('text', ''), data.get('status', 'todo'))
    if not task:
        return jsonify({'error': 'project not found'}), 404
    return jsonify(task), 201

@projects_bp.route('/api/projects/<project_id>/tasks/<task_id>', methods=['PATCH'])
def patch_task(project_id, task_id):
    data = request.get_json(silent=True) or {}
    task = update_task(project_id, task_id, data)
    if not task:
        return jsonify({'error': 'not found'}), 404
    return jsonify(task)

@projects_bp.route('/api/projects/<project_id>/tasks/<task_id>', methods=['DELETE'])
def del_task(project_id, task_id):
    delete_task(project_id, task_id)
    return jsonify({'ok': True})

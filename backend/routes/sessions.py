from flask import Blueprint, request, jsonify
from services.sessions import (
    list_sessions, create_session, get_session,
    delete_session, rename_session
)

sessions_bp = Blueprint("sessions", __name__, url_prefix="/api/sessions")


@sessions_bp.route("/", methods=["GET"])
def get_sessions():
    return jsonify(list_sessions())


@sessions_bp.route("/", methods=["POST"])
def new_session():
    data = request.get_json() or {}
    name = data.get("name")
    session = create_session(name=name)
    return jsonify(session), 201


@sessions_bp.route("/<session_id>", methods=["GET"])
def get_one(session_id):
    session = get_session(session_id)
    if not session:
        return jsonify({"error": "not found"}), 404
    return jsonify(session)


@sessions_bp.route("/<session_id>", methods=["DELETE"])
def delete_one(session_id):
    ok = delete_session(session_id)
    return jsonify({"ok": ok})


@sessions_bp.route("/<session_id>/rename", methods=["POST"])
def rename_one(session_id):
    data = request.get_json() or {}
    name = data.get("name", "")
    ok = rename_session(session_id, name)
    return jsonify({"ok": ok})

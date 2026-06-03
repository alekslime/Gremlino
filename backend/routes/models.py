import requests
from flask import Blueprint, jsonify, request, Response, stream_with_context

models_bp = Blueprint("models", __name__, url_prefix="/api/models")

OLLAMA_BASE = "http://localhost:11434"

# Active model — shared state, default
_active_model = "llama3.2:3b"


def get_active_model():
    return _active_model


@models_bp.route("/", methods=["GET"])
def list_models():
    """List all locally pulled Ollama models."""
    try:
        resp = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=5)
        data = resp.json()
        models = [m["name"] for m in data.get("models", [])]
        return jsonify({"models": models, "active": _active_model})
    except Exception as e:
        return jsonify({"models": [], "active": _active_model, "error": str(e)})


@models_bp.route("/active", methods=["POST"])
def set_active():
    """Switch the active model (must already be pulled)."""
    global _active_model
    data = request.get_json() or {}
    model = data.get("model", "").strip()
    if not model:
        return jsonify({"error": "model name required"}), 400
    _active_model = model
    return jsonify({"active": _active_model})


@models_bp.route("/pull", methods=["POST"])
def pull_model():
    """
    Pull a model from Ollama registry, streaming progress back as SSE.
    After pull completes, sets it as active.
    """
    global _active_model
    data = request.get_json() or {}
    model = data.get("model", "").strip()
    if not model:
        return jsonify({"error": "model name required"}), 400

    def generate():
        import json
        try:
            with requests.post(
                f"{OLLAMA_BASE}/api/pull",
                json={"name": model},
                stream=True,
                timeout=600,
            ) as resp:
                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                        status = payload.get("status", "")
                        completed = payload.get("completed")
                        total = payload.get("total")
                        if completed and total:
                            pct = round((completed / total) * 100)
                            yield f"data: {json.dumps({'status': status, 'pct': pct})}\n\n"
                        else:
                            yield f"data: {json.dumps({'status': status})}\n\n"
                        if payload.get("status") == "success":
                            break
                    except Exception:
                        continue
            # Set as active after successful pull
            _active_model = model
            yield f"data: {json.dumps({'status': 'done', 'active': model})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

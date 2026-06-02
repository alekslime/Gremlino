import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.ollama import ask_ollama, stream_ollama

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


@chat_bp.route("/", methods=["POST"])
def chat():
    data = request.get_json()
    prompt = data.get("prompt", "")
    history = data.get("history", [])
    reply = ask_ollama(prompt, history=history)
    return jsonify({"response": reply})


@chat_bp.route("/stream", methods=["POST"])
def chat_stream():
    data = request.get_json()
    prompt = data.get("prompt", "")
    history = data.get("history", [])

    def generate():
        try:
            for token in stream_ollama(prompt, history=history):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'token': 'gremlino got tangled in a wire.'})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
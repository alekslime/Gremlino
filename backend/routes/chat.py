import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.ollama import ask_ollama, stream_ollama, detect_tool_call
from services.sessions import get_session, append_message
from services.agent import execute_tool

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")


def _history_for_ollama(messages: list) -> list:
    return [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-20:]
    ]


@chat_bp.route("/stream", methods=["POST"])
def chat_stream():
    data = request.get_json()
    prompt = data.get("prompt", "")
    session_id = data.get("session_id")
    file_content = data.get("file_content")  # optional attached file text
    history = data.get("history", [])

    if session_id:
        session = get_session(session_id)
        if session:
            history = _history_for_ollama(session["messages"])
            append_message(session_id, "user", prompt)

    def generate():
        try:
            for token in stream_ollama(prompt, history=history, file_content=file_content):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception:
            yield f"data: {json.dumps({'token': 'stream failed.'})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@chat_bp.route("/save", methods=["POST"])
def save_message():
    data = request.get_json()
    session_id = data.get("session_id")
    role = data.get("role", "bot")
    content = data.get("content", "")
    if session_id:
        append_message(session_id, role, content)
    return jsonify({"ok": True})


@chat_bp.route("/tool/check", methods=["POST"])
def tool_check():
    data = request.get_json()
    reply = data.get("reply", "")
    tool_call = detect_tool_call(reply)
    if not tool_call:
        return jsonify({"is_tool": False, "tool_call": None, "needs_confirm": False})
    needs_confirm = tool_call.get("tool") in ("shell", "create_file")
    return jsonify({"is_tool": True, "tool_call": tool_call, "needs_confirm": needs_confirm})


@chat_bp.route("/tool/execute", methods=["POST"])
def tool_execute():
    data = request.get_json()
    tool_call = data.get("tool_call", {})
    prompt = data.get("prompt", "")
    session_id = data.get("session_id")
    history = data.get("history", [])

    if session_id:
        session = get_session(session_id)
        if session:
            history = _history_for_ollama(session["messages"])

    result = execute_tool(tool_call)
    result_str = json.dumps(result, ensure_ascii=False)
    reply = ask_ollama(prompt, history=history, tool_result=result_str)

    if session_id:
        append_message(session_id, "bot", reply, tool_call=tool_call, tool_result=result_str)

    return jsonify({"reply": reply, "tool_result": result})


@chat_bp.route("/", methods=["POST"])
def chat():
    data = request.get_json()
    prompt = data.get("prompt", "")
    history = data.get("history", [])
    reply = ask_ollama(prompt, history=history)
    return jsonify({"response": reply})

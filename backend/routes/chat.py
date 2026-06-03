import json
from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.ollama import ask_ollama, stream_ollama, detect_tool_call
from services.sessions import get_session, append_message, create_session
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
    history = data.get("history", [])

    # Load from session if provided
    if session_id:
        session = get_session(session_id)
        if session:
            history = _history_for_ollama(session["messages"])
            append_message(session_id, "user", prompt)

    def generate():
        try:
            for token in stream_ollama(prompt, history=history):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'token': '*chews a wire nervously* gremlino got tangled. try again.'})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@chat_bp.route("/save", methods=["POST"])
def save_message():
    """Called by frontend to persist a completed bot message."""
    data = request.get_json()
    session_id = data.get("session_id")
    role = data.get("role", "bot")
    content = data.get("content", "")
    emote = data.get("emote")
    if session_id:
        append_message(session_id, role, content, emote=emote)
    return jsonify({"ok": True})


@chat_bp.route("/tool/check", methods=["POST"])
def tool_check():
    """
    Frontend sends the raw model reply. We detect if it's a tool call.
    Returns: { is_tool: bool, tool_call: dict|null, needs_confirm: bool }
    """
    data = request.get_json()
    reply = data.get("reply", "")
    tool_call = detect_tool_call(reply)

    if not tool_call:
        return jsonify({"is_tool": False, "tool_call": None, "needs_confirm": False})

    # Shell commands always need confirmation; file reads/lists don't
    needs_confirm = tool_call.get("tool") in ("shell", "create_file")

    return jsonify({
        "is_tool": True,
        "tool_call": tool_call,
        "needs_confirm": needs_confirm,
    })


@chat_bp.route("/tool/execute", methods=["POST"])
def tool_execute():
    """
    Execute a tool (after confirmation if needed), then ask Ollama to
    interpret the result and return a full response.
    """
    data = request.get_json()
    tool_call = data.get("tool_call", {})
    prompt = data.get("prompt", "")
    session_id = data.get("session_id")
    history = data.get("history", [])

    if session_id:
        session = get_session(session_id)
        if session:
            history = _history_for_ollama(session["messages"])

    # Execute the tool
    result = execute_tool(tool_call)
    result_str = json.dumps(result, ensure_ascii=False)

    # Ask Gremlino to respond given the tool output
    reply = ask_ollama(prompt, history=history, tool_result=result_str)

    # Persist
    if session_id:
        append_message(session_id, "bot", reply, tool_call=tool_call, tool_result=result_str)

    return jsonify({
        "reply": reply,
        "tool_result": result,
    })


@chat_bp.route("/", methods=["POST"])
def chat():
    """Fallback non-streaming endpoint."""
    data = request.get_json()
    prompt = data.get("prompt", "")
    history = data.get("history", [])
    reply = ask_ollama(prompt, history=history)
    return jsonify({"response": reply})

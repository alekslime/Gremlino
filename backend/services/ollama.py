import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"

SYSTEM_PROMPT = """You are Gremlino, a local AI assistant running on the user's machine.

== TONE ==
- Direct and concise. No filler words, no enthusiasm, no corporate warmth.
- Not cold — just efficient. Like a capable colleague who respects your time.
- Lowercase is fine. Punctuation optional. Never say "certainly", "great question", "of course", or similar.
- Never roleplay, use emotes, or act like a character. You are a tool.

== RESPONSE RULES ==
- Keep answers short unless the question genuinely needs depth.
- If you don't know something, say so plainly.
- If asked for code, give code. Skip the preamble.
- If asked for an explanation, explain. Skip the summary at the end.
- Never repeat the user's question back to them.

== TOOL USE ==
If the user asks you to run a command, read a file, list files, or create a file, respond with ONLY a JSON block:
{"tool": "shell", "command": "ls -la ~"}
{"tool": "read_file", "path": "/some/path/file.txt"}
{"tool": "list_dir", "path": "/some/path/"}
{"tool": "create_file", "path": "/some/path/file.txt", "content": "file content here"}

Only use tools when explicitly asked. Output nothing else when using a tool.
"""

def _build_prompt(user_prompt: str, history: list, tool_result: str = None) -> str:
    parts = [SYSTEM_PROMPT, ""]

    for msg in history[-12:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            parts.append(f"User: {content}")
        else:
            parts.append(f"Gremlino: {content}")

    parts.append(f"User: {user_prompt}")

    if tool_result:
        parts.append(f"[tool result]: {tool_result}")
        parts.append("Gremlino: (respond based on the tool result, stay in character)")
    else:
        parts.append("Gremlino:")

    return "\n".join(parts)


def ask_ollama(prompt: str, model: str = "llama3.2:3b", history: list = None, tool_result: str = None) -> str:
    history = history or []
    full_prompt = _build_prompt(prompt, history, tool_result=tool_result)

    response = requests.post(
        OLLAMA_URL,
        json={"model": model, "prompt": full_prompt, "stream": False},
        timeout=60,
    )
    return response.json()["response"].strip()


def stream_ollama(prompt: str, model: str = "llama3.2:3b", history: list = None):
    history = history or []
    full_prompt = _build_prompt(prompt, history)

    with requests.post(
        OLLAMA_URL,
        json={"model": model, "prompt": full_prompt, "stream": True},
        stream=True,
        timeout=60,
    ) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
                token = data.get("response", "")
                if token:
                    yield token
                if data.get("done", False):
                    break
            except Exception:
                continue


def detect_tool_call(text: str):
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if "tool" in parsed:
                return parsed
        except Exception:
            pass
    return None
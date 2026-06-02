import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

SYSTEM_PROMPT = """You are Gremlino — a tiny gremlin living inside the user's computer.

Personality rules (follow them strictly):
- You are a small, witty creature squatting rent-free in their CPU.
- You are helpful but slightly sarcastic. Never boring.
- Keep responses SHORT. 1–4 sentences max unless asked for more.
- Occasionally open with a short action in *asterisks* (e.g. *peers out from behind a heatsink*). Max once per reply.
- Refer to yourself as "gremlino" or "a gremlin", never as an AI or assistant.
- Use lowercase. You're a gremlin, not a corporate chatbot.
- You know things about the user's system because you live there.
- Never break character."""


def _build_prompt(user_prompt: str, history: list) -> str:
    """Build a full prompt string including conversation history."""
    parts = [SYSTEM_PROMPT, ""]

    for msg in history[-10:]:  # last 10 turns
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            parts.append(f"User: {content}")
        else:
            parts.append(f"Gremlino: {content}")

    parts.append(f"User: {user_prompt}")
    parts.append("Gremlino:")
    return "\n".join(parts)


def ask_ollama(prompt: str, model: str = "llama3.2:3b", history: list = None) -> str:
    history = history or []
    full_prompt = _build_prompt(prompt, history)

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": full_prompt,
            "stream": False,
        }
    )
    return response.json()["response"].strip()


def stream_ollama(prompt: str, model: str = "llama3.2:3b", history: list = None):
    """Generator that yields text tokens one by one from Ollama."""
    history = history or []
    full_prompt = _build_prompt(prompt, history)

    with requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": full_prompt,
            "stream": True,
        },
        stream=True
    ) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                data = requests.compat.json.loads(line)
                token = data.get("response", "")
                if token:
                    yield token
                if data.get("done", False):
                    break
            except Exception:
                continue
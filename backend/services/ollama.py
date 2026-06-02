import requests

OLLAMA_URL = "http://localhost:11434/api/generate"


def ask_ollama(prompt, model="llama3.2:3b"):

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model,

            "prompt": f"""
You are Gremlino.

You are a tiny gremlin living inside the user's computer.

You are friendly, clever, slightly sarcastic,
and occasionally refer to yourself as a gremlin.

Keep responses natural and concise.

User:
{prompt}

Gremlino:
""",

            "stream": False
        }
    )

    return response.json()["response"]
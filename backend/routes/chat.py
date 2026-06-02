from flask import Blueprint
from flask import request
from flask import jsonify

from services.ollama import ask_ollama

chat_bp = Blueprint(
    "chat",
    __name__,
    url_prefix="/api/chat"
)


@chat_bp.route("/", methods=["POST"])
def chat():

    data = request.get_json()

    prompt = data["prompt"]

    reply = ask_ollama(prompt)

    return jsonify({
        "response": reply
    })
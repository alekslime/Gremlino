from flask import Flask
from flask_cors import CORS

from routes.chat import chat_bp
from routes.system import system_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(chat_bp)
app.register_blueprint(system_bp)

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=7000,
        debug=True
    )
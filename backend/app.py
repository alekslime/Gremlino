from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from routes.chat import chat_bp
from routes.system import system_bp
from routes.sessions import sessions_bp
from routes.models import models_bp
from routes.projects import projects_bp
from routes.settings import settings_bp

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

app = Flask(__name__, static_folder=None)
CORS(app)

app.register_blueprint(chat_bp)
app.register_blueprint(system_bp)
app.register_blueprint(sessions_bp)
app.register_blueprint(models_bp)
app.register_blueprint(projects_bp)
app.register_blueprint(settings_bp)

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7000, debug=True)

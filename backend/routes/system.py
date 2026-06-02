from flask import Blueprint
from flask import jsonify

import psutil

system_bp = Blueprint(
    "system",
    __name__,
    url_prefix="/api/system"
)


@system_bp.route("/")
def info():

    return jsonify({
        "cpu": psutil.cpu_percent(),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent
    })
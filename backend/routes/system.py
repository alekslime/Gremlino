import time
import psutil
from flask import Blueprint, jsonify

system_bp = Blueprint("system", __name__, url_prefix="/api/system")
START_TIME = time.time()

@system_bp.route("/")
def system_status():
    from routes.models import get_active_model
    mem = psutil.virtual_memory()
    ram_gb = round(mem.used / (1024 ** 3), 1)
    return jsonify({
        "cpu": psutil.cpu_percent(interval=0.5),
        "ram": mem.percent,
        "ram_gb": ram_gb,
        "uptime_seconds": int(time.time() - START_TIME),
        "model": get_active_model(),
    })

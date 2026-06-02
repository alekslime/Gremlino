from flask import Blueprint, jsonify
import psutil
import time

system_bp = Blueprint("system", __name__, url_prefix="/api/system")

START_TIME = time.time()


@system_bp.route("/")
def info():
    mem = psutil.virtual_memory()
    ram_gb = round(mem.used / (1024 ** 3), 1)
    uptime_seconds = int(time.time() - START_TIME)

    return jsonify({
        "cpu": psutil.cpu_percent(interval=0.1),
        "ram": mem.percent,
        "ram_gb": ram_gb,
        "uptime_seconds": uptime_seconds,
        "model": "llama3.2:3b",
    })
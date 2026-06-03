"""
Agent tools — filesystem access and shell command execution.
All shell commands require frontend confirmation before running.
"""
import os
import subprocess
import shlex

WORKSPACE = os.path.expanduser("~/gremlino-workspace")


def ensure_workspace():
    os.makedirs(WORKSPACE, exist_ok=True)


def list_dir(path: str) -> dict:
    try:
        path = os.path.expanduser(path)
        if not os.path.exists(path):
            return {"error": f"path does not exist: {path}"}
        entries = []
        for name in sorted(os.listdir(path)):
            full = os.path.join(path, name)
            entries.append({
                "name": name,
                "type": "dir" if os.path.isdir(full) else "file",
                "size": os.path.getsize(full) if os.path.isfile(full) else None,
            })
        return {"path": path, "entries": entries}
    except PermissionError:
        return {"error": "permission denied"}
    except Exception as e:
        return {"error": str(e)}


def read_file(path: str) -> dict:
    try:
        path = os.path.expanduser(path)
        if not os.path.exists(path):
            return {"error": f"file not found: {path}"}
        if os.path.getsize(path) > 100_000:
            return {"error": "file too large (>100KB). try a smaller file."}
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return {"path": path, "content": content}
    except PermissionError:
        return {"error": "permission denied"}
    except Exception as e:
        return {"error": str(e)}


def create_file(path: str, content: str) -> dict:
    try:
        path = os.path.expanduser(path)
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return {"path": path, "written": len(content), "ok": True}
    except PermissionError:
        return {"error": "permission denied"}
    except Exception as e:
        return {"error": str(e)}


def run_shell(command: str, timeout: int = 15) -> dict:
    """
    Run a shell command. Returns stdout, stderr, returncode.
    This should only be called AFTER the user has confirmed.
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "stdout": result.stdout[:4000],  # cap output
            "stderr": result.stderr[:1000],
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": f"command timed out after {timeout}s"}
    except Exception as e:
        return {"error": str(e)}


def execute_tool(tool_call: dict) -> dict:
    """Dispatch a tool call dict to the right function."""
    tool = tool_call.get("tool")
    if tool == "list_dir":
        return list_dir(tool_call.get("path", "."))
    elif tool == "read_file":
        return read_file(tool_call.get("path", ""))
    elif tool == "create_file":
        return create_file(tool_call.get("path", ""), tool_call.get("content", ""))
    elif tool == "shell":
        return run_shell(tool_call.get("command", ""))
    else:
        return {"error": f"unknown tool: {tool}"}

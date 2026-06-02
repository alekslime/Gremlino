from pathlib import Path

WORKSPACE = Path.home() / "Gremlino"


def list_files():
    files = []

    for file in WORKSPACE.rglob("*"):
        if file.is_file():
            files.append(str(file))

    return files


def read_file(filepath):
    path = Path(filepath)

    with open(path, "r") as f:
        return f.read()


def write_file(filepath, content):
    path = Path(filepath)

    with open(path, "w") as f:
        f.write(content)

    return True
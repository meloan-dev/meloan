from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
for name in ("build_story.py", "build_app.py", "build_merged.py"):
    subprocess.run(["python3", name], cwd=root, check=True)

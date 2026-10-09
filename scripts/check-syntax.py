from pathlib import Path
import re, subprocess, ast
root = Path(__file__).resolve().parents[1]
count = 0
for folder in ("src", "app/src", "app/test", "test"):
    for p in sorted((root / folder).rglob("*")):
        if p.suffix in (".js", ".cjs", ".mjs"):
            args = ["node", "--check"] if p.suffix == ".cjs" else ["node", "--input-type=module", "--check"]
            subprocess.run(args, input=p.read_text(), text=True, check=True)
            count += 1
for p in root.glob("*.cjs"):
    subprocess.run(["node", "--check", str(p)], check=True)
for p in [*root.glob("*.py"), *(root / "scripts").glob("*.py")]:
    ast.parse(p.read_text(), filename=str(p))
for p in (root / "src/story.template.html", root / "dist/merged/index.html"):
    if not p.exists(): continue
    for attrs, body in re.findall(r"<script([^>]*)>([\s\S]*?)</script>", p.read_text()):
        if "importmap" in attrs or "src=" in attrs: continue
        if "/*STORY_JS*/" in body: body = body.replace("/*STORY_JS*/", "")
        subprocess.run(["node", "--input-type=module", "--check"], input=body, text=True, check=True)
print(f"Syntax verified for {count} JavaScript modules, Python builders and inline scripts")

from pathlib import Path
import re, sys
if len(sys.argv) != 2 or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", sys.argv[1]):
    raise SystemExit("Usage: python3 scripts/configure-repository.py OWNER/REPOSITORY")
repo = sys.argv[1]
root = Path(__file__).resolve().parents[1]
workflows = sorted((root / '.github/workflows').glob('*.yml'))
links = []
for p in workflows:
    name = re.search(r'^name: (.+)$', p.read_text(), re.M).group(1)
    url = f'https://github.com/{repo}/actions/workflows/{p.name}'
    links.append(f'<a href="{url}"><img src="{url}/badge.svg?branch=main" alt="{name}" /></a>')
readme = root / 'README.md'
readme.write_text(re.sub(r'<!-- WORKFLOW_BADGES -->[\s\S]*?<!-- END_WORKFLOW_BADGES -->',
    '<!-- WORKFLOW_BADGES -->\n<p align="center">' + ' '.join(links) + '</p>\n<!-- END_WORKFLOW_BADGES -->', readme.read_text()))
print(f'Configured eight live-status badges for {repo}')

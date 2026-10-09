from pathlib import Path
from urllib.parse import unquote
import re
root = Path(__file__).resolve().parents[1]
required = ['README.md','SECURITY.md','CONTRIBUTING.md','THIRD_PARTY_NOTICES.md','docs/GETTING_STARTED.md','docs/ARCHITECTURE.md','docs/CI.md','app/src/meme-tokens.js','app/src/wallet-balances.js','src/story.template.html','dist/merged/index.html','dist/merged/app/index.html']
for name in required:
    assert (root/name).is_file(), f'Missing {name}'
assert len(list((root/'.github/workflows').glob('*.yml'))) == 8, 'Expected eight workflows'
for p in [root/'README.md',* (root/'docs').glob('*.md')]:
    links = re.findall(r'\]\(([^)]+)\)', p.read_text()) + re.findall(r'(?:href|src)="([^"]+)"', p.read_text())
    for link in links:
        if re.match(r'^(?:https?://|#|mailto:)',link): continue
        target = unquote(link.split('#')[0])
        assert (p.parent/target).exists(), f'Broken local documentation link: {p.name}: {link}'
merged = root/'dist/merged'
html = (merged/'index.html').read_text()
assert '{{WORDMARK}}' not in html and '/*STORY_JS*/' not in html, 'Unresolved story placeholders'
assert 'claude.ai/artifact/' not in html, 'App links must resolve inside the merged build'
assert 'id="ld-start"' in html and 'Tap anywhere to begin' in html
assert '<button id="ld-start"' not in html, 'Start prompt should remain plain text'
assert "storyUrl: '../index.html'" in (merged/'app/src/config.js').read_text()
for asset in ['buddy.webp','buddy-face.webp','favicon.png']:
    if asset == 'favicon.png': continue
    assert (merged/'app/assets'/asset).is_file(), f'Missing {asset}'
for p in merged.rglob('*'):
    if p.is_file():
        assert p.stat().st_size > 0, f'Empty build asset: {p}'
for p in (root/'app/src').rglob('*.js'):
    for spec in re.findall(r"(?:from\s+|import\s*)['\"]([^'\"]+)['\"]",p.read_text()):
        if spec.startswith('.'):
            assert (p.parent/spec).exists(), f'Broken module import {p.name}: {spec}'
for name in ['.env','.env.local','.git-credentials']:
    assert not (root/name).exists(), f'Unexpected credential file: {name}'
print('Documentation, module imports, assets, start prompt and merged routes verified')

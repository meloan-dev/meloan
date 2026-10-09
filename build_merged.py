# Combined site: the 3D story is the landing page (index.html) and the platform lives at app/index.html.
# Built from the two separate builds (dist/meloan-story.html and dist/app), which stay untouched,
# so either original site can still be rebuilt and published on its own.
import shutil, pathlib, re
root = pathlib.Path(__file__).parent
APP_URL = 'https://claude.ai/artifact/FdwXmWqUwUP7ax4e84hukt'
out = root / 'dist' / 'merged'
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)

# 1) story as the landing page: Launch app / whitepaper open the platform in the same tab
story = (root / 'dist/meloan-story.html').read_text()
n = story.count(APP_URL)
story = re.sub(r'href="' + re.escape(APP_URL) + r'(#/[^"]*)?" target="_blank" rel="noopener"',
               lambda m: f'href="app/index.html{m.group(1) or ""}"', story)
assert APP_URL not in story, 'an app link was not rewritten'
story = re.sub(r'<title>[^<]*</title>', '<title>Meloan</title>', story, count=1)
(out / 'index.html').write_text(story)

# 2) platform under app/ — a page of its own, so it carries its own doctype and head basics
shutil.copytree(root / 'dist/app', out / 'app')
idx = out / 'app/index.html'
idx.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
               '<style>html,body{margin:0}</style>\n' + idx.read_text())
cfg = out / 'app/src/config.js'
c = cfg.read_text()
c2 = re.sub(r"storyUrl: '[^']*'", "storyUrl: '../index.html'", c)
assert c2 != c; cfg.write_text(c2)
for f in ['app/src/shell.js', 'app/src/pages/home.js']:
    p = out / f; t = p.read_text()
    t2 = t.replace("href: CONFIG.storyUrl, target: '_blank', rel: 'noopener'", 'href: CONFIG.storyUrl')
    assert t2 != t, f; p.write_text(t2)
files = sorted(str(p.relative_to(out)) for p in out.rglob('*') if p.is_file() and str(p.relative_to(out)) not in ('index.html', 'files.txt'))
(out / 'files.txt').write_text('\n'.join(files) + '\n')
print('ok', n, 'story links ->', 'app/index.html;', len(files), 'files')

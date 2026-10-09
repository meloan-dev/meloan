import re, shutil, pathlib
root = pathlib.Path(__file__).parent
out = root / 'dist' / 'app'
if out.exists(): shutil.rmtree(out)
(out).mkdir(parents=True)
svg = (root/'app/assets/wordmark.svg').read_text()
svg = re.sub(r'fill="#232845"', 'fill="currentColor"', svg).replace('<svg ', '<svg aria-hidden="true" focusable="false" ', 1)
html = (root/'app/index.template.html').read_text().replace('{{WORDMARK}}', svg)
(out/'index.html').write_text(html)
shutil.copy(root/'app/styles.css', out/'styles.css')
shutil.copytree(root/'app/src', out/'src')
shutil.copytree(root/'app/assets', out/'assets', ignore=shutil.ignore_patterns('wordmark.svg'))
print('ok', sum(f.stat().st_size for f in out.rglob('*') if f.is_file()))

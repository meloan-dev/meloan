import re, pathlib
root = pathlib.Path(__file__).parent
js = (root/'src/buddy.js').read_text()
js = re.sub(r'^export ', '', js, flags=re.M)
props = (root/'src/props.js').read_text()
props = re.sub(r'^import .*\n', '', props, flags=re.M)
props = re.sub(r'^export ', '', props, flags=re.M)
js = js + '\n' + props
html = (root/'src/preview.template.html').read_text()
svg = (root/'build/wordmark.svg').read_text()
svg = svg.replace('<svg ', '<svg aria-label="Meloan" ', 1)
html = html.replace('/*BUDDY_JS*/', js).replace('{{WORDMARK}}', svg)
faces = ','.join('"data:image/jpeg;base64,%s"' % (root/f'build/coin-{n}.b64').read_text() for n in ['potato','cat','rocket','banana'])
html = html.replace('/*COIN_FACES*/', faces)
for n in ['front','side','back','drone','counter','cfront','c34','cside']:
    html = html.replace('{{THUMB_%s}}' % n.upper(), (root/f'build/thumb-{n}.b64').read_text())
(root/'dist').mkdir(exist_ok=True)
(root/'dist/buddy-preview.html').write_text(html)
print('ok', len(html))

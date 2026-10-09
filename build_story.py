import re, pathlib
root = pathlib.Path(__file__).parent
def strip(path, drop_imports):
    t = (root/path).read_text()
    if drop_imports: t = re.sub(r'^import .*\n', '', t, flags=re.M)
    return re.sub(r'^export ', '', t, flags=re.M)
js = strip('src/buddy.js', False) + '\n' + strip('src/props.js', True) + '\n' + strip('src/sfx.js', True) + '\n' + strip('src/story-sound.js', True) + '\n' + strip('src/story.js', True)
faces = ','.join('"data:image/jpeg;base64,%s"' % (root/f'build/coin-{n}.b64').read_text() for n in ['potato','cat','rocket','banana'])
js = js.replace('/*COIN_FACES*/', faces)
html = (root/'src/story.template.html').read_text()
svg = (root/'build/wordmark.svg').read_text().replace('<svg ', '<svg aria-hidden="true" focusable="false" ', 1)
html = html.replace('{{WORDMARK}}', svg).replace('/*STORY_JS*/', js)
(root/'dist').mkdir(exist_ok=True)
(root/'dist/meloan-story.html').write_text(html)
print('ok', len(html))

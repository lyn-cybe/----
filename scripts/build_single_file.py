"""生成包含图片、样式和脚本的单文件试读版；视频完整版仍使用 dist/。"""
import base64
from io import BytesIO
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root.parent / 'exports' / '小傩面-单文件试读版.html'
assets = {}
for path in sorted((root / 'public/images').glob('*.webp')):
    with Image.open(path) as image:
        image.thumbnail((1280, 720))
        data = BytesIO()
        image.save(data, format='WEBP', quality=78, method=4)
        assets[path.stem] = 'data:image/webp;base64,' + base64.b64encode(data.getvalue()).decode('ascii')

html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="./styles.css">',
                    '<style>' + (root / 'styles.css').read_text() +
                    '\n#motion-toggle,#replay{display:none!important}</style>')
for src in ['./lib/page-flip.browser.js', './story.js', './app.js']:
    html = html.replace(f'<script defer src="{src}"></script>', '')
html = html.replace('数字绘本 · 阅读版', '数字绘本 · 图片试读')
html = html.replace('画面视频暂时静音。', '这是图片试读版，视频在完整版中。')
app = (root / 'app.js').read_text().replace("'little-nuo-reader-v1'", "'little-nuo-reader-v1-singlefile'")
app = app.replace('let motion = saved.motion === true;', 'let motion = false;')
app = app.replace('const imagePath = (stem) => `./images/${stem}.webp`;',
                  'const imagePath = (stem) => window.NUO_ASSETS[stem];')
html = html.replace('<div id="book" aria-label="可翻页绘本"></div>',
                    '<div id="book" aria-label="可翻页绘本"><img id="initial-cover" '
                    'alt="小傩面工坊封面" style="width:100%;height:100%;object-fit:contain" '
                    'src="' + assets['page-01-awakening'] + '"></div>')
html = html.replace('<p class="reading-hint">',
                    '<p id="startup-note" role="status" style="text-align:center;color:#9a5835">'
                    '正在启动翻页程序；如果这行提示一直存在，当前预览器未运行脚本。</p>'
                    '<p class="reading-hint">')
app = app.replace("const bookElement = $('book');", "const bookElement = $('book');\n"
                  "bookElement.querySelector('#initial-cover')?.remove();\n"
                  "$('startup-note')?.remove();")

def inline(code):
    return '<script>' + code.replace('</script', '<\\/script') + '</script>'

scripts = '\n'.join([
    inline('window.NUO_ASSETS=' + json.dumps(assets, ensure_ascii=False) + ';'),
    inline((root / 'public/lib/page-flip.browser.js').read_text()),
    inline((root / 'story.js').read_text()),
    inline(app),
])
license_text = (root / 'public/lib/StPageFlip-LICENSE.txt').read_text()
html = html.replace('</body>', scripts + '\n<!-- StPageFlip MIT license:\n' + license_text + '\n-->\n</body>')
out.parent.mkdir(exist_ok=True)
out.write_text(html)
out.parent.chmod(0o755)
out.chmod(0o644)
direct_preview = root.parent / 'preview.html'
direct_preview.write_text(html)
direct_preview.chmod(0o644)
print(f'Generated {out} ({out.stat().st_size / 1024**2:.2f} MiB), {len(assets)} embedded images.')
print(f'Direct workspace preview: {direct_preview}')

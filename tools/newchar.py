"""新夥伴的素材一次切好：動作表（站姿／蓄力／出手／勝利）、受擊與防禦、倒地兩格、半身像、眼神特寫。
用法：uv run --with pillow --with numpy --with scipy python tools/newchar.py yan heilun …
原圖：art/raw/<id>_sheet.png、art/raw/anim/<id>_hg.png、<id>_ko.png、art/raw/bust_<id>.png、eyes_<id>.png（art/raw/jobs7.sh 生的）。
每張圖 GPT 畫的人物大小不一樣，所以各自量人物高度算縮小倍率，讓同一個角色的每一格像素密度一致（站姿約 112 像素高）。
切完會輸出 out/check_<id>.png：所有姿勢排在一起，要用眼睛檢查每一格是不是都面向左邊。"""
import os, sys, subprocess, json
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
READY = 112
def pieces(path, dil=8):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int); fg = ~((a[..., 0] > 170) & (a[..., 1] < 100) & (a[..., 2] > 170)); lab, n = ndi.label(ndi.binary_dilation(fg, iterations=dil)); out = []
    for sl in ndi.find_objects(lab):
        h, w = sl[0].stop - sl[0].start - 2 * dil, sl[1].stop - sl[1].start - 2 * dil
        if h * w > 9000: out.append((sl[1].start, w, h))
    return sorted(out)
def cut(src, outdir, names, cell, gap=5):
    for g in (gap, 3, 2, 1):      # 兩格黏在一起（件數不對）就把分隔縮小再切一次
        r = subprocess.run(['uv', 'run', '--quiet', '--with', 'pillow', '--with', 'numpy', '--with', 'scipy', 'python', 'tools/cut.py', src, outdir, ','.join(names), '--cell', f'{cell:.2f}', '--gap', str(g)], capture_output=True, text=True)
        if '警告' not in r.stdout: break
    meta = f'{outdir}/{names[0]}_meta.json'
    if os.path.exists(meta): os.remove(meta)
    print('  ', os.path.basename(src), '倍率', round(cell, 2), (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1][:160])
def trim(path):      # 裁到人物範圍並左右置中（倒地圖用，腳底中心不準）
    im = Image.open(path).convert('RGBA'); c = im.crop(im.getbbox()); w, h = c.size; W = w + 2 + (w % 2); o = Image.new('RGBA', (W, h), (0, 0, 0, 0)); o.paste(c, ((W - w) // 2, 0)); o.save(path)
for n in sys.argv[1:]:
    print(n); sh = f'art/raw/{n}_sheet.png'; p = pieces(sh); cell = p[0][2] / READY; cut(sh, 'art/chars', [f'{n}_{k}' for k in ('ready', 'wind', 'act', 'win')], cell)
    hg = f'art/raw/anim/{n}_hg.png'
    if os.path.exists(hg): os.makedirs('art/chars/pose', exist_ok=True); q = pieces(hg); cut(hg, 'art/chars/pose', [f'{n}_hurt', f'{n}_guard'], max(x[2] for x in q) / (READY * .93))
    ko = f'art/raw/anim/{n}_ko.png'
    if os.path.exists(ko): os.makedirs('art/chars/ko', exist_ok=True); q = pieces(ko); cut(ko, 'art/chars/ko', [f'{n}_1', f'{n}_2'], max(x[1] for x in q) / (READY * 1.12), 6); [trim(f'art/chars/ko/{n}_{i}.png') for i in (1, 2) if os.path.exists(f'art/chars/ko/{n}_{i}.png')]
    b = f'art/raw/bust_{n}.png'
    if os.path.exists(b):
        a = np.asarray(Image.open(b).convert('RGB')).astype(int); r, g, bl = a[..., 0], a[..., 1], a[..., 2]; bg = (r - g > 60) & (bl - g > 60) & (abs(r - bl) < 110); fg = ndi.binary_erosion(~bg, iterations=1)
        lab, k = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, k + 1)); fg = ndi.binary_fill_holes(lab == (1 + int(np.argmax(sizes)))); ys, xs = np.nonzero(fg)
        Image.fromarray(np.dstack([a, np.where(fg, 255, 0)]).astype(np.uint8)).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(f'art/cutin/bust_{n}.png'); print('   半身像', xs.max() - xs.min(), ys.max() - ys.min())
    e = f'art/raw/eyes_{n}.png'
    if os.path.exists(e): Image.open(e).convert('RGB').save(f'art/cutin/eyes_{n}.jpg', quality=93)
    fs = [f'art/chars/{n}_{k}.png' for k in ('ready', 'wind', 'act', 'win')] + [f'art/chars/pose/{n}_hurt.png', f'art/chars/pose/{n}_guard.png', f'art/chars/ko/{n}_1.png', f'art/chars/ko/{n}_2.png']; fs = [f for f in fs if os.path.exists(f)]
    ims = [Image.open(f).convert('RGBA') for f in fs]; H = max(i.height for i in ims); W = sum(i.width for i in ims) + 8 * (len(ims) + 1); sheet = Image.new('RGBA', (W, H + 16), (40, 44, 60, 255)); x = 8
    for im in ims: sheet.paste(im, (x, 8 + H - im.height), im); x += im.width + 8
    os.makedirs('out', exist_ok=True); sheet.resize((W * 2, (H + 16) * 2), Image.NEAREST).save(f'out/check_{n}.png'); print('   檢查圖 out/check_' + n + '.png', [os.path.basename(f)[:-4] + str(Image.open(f).size) for f in fs])

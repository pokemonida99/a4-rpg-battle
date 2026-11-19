"""逐格動作表 → art/chars/anim/名字_walk1~4.png、名字_cast1~4.png
先用 px.py 切成 4 格（一格一像素），再把每格左右補邊，讓「頭」落在圖的正中間——引擎是用圖的底邊中點當腳底位置，
不對齊的話走路時身體會左右抖。也會印出每格高度，跟待機圖差太多就要加 --cell 重切。
走路表可以是 4 格一列（walk）或 8 格兩列（walk8，左右腳輪流）；會量「一步跨多遠」寫進 art/chars/anim/名字.json，引擎照這個距離換格，腳才不會滑。
用法：uv run --with pillow --with numpy --with scipy python tools/anim.py jie walk8 [--cell 5.3]"""
import sys, os, re, json, subprocess, tempfile
import numpy as np
from PIL import Image
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
name, src = sys.argv[1], sys.argv[2]; extra = sys.argv[3:]; N = 8 if src == 'walk8' else 4; kind = 'walk' if src == 'walk8' else src
raw = f'art/raw/anim/{name}_{src}.png'; idle = Image.open(f'art/chars/{name}.png'); H0 = idle.height
tmp = tempfile.mkdtemp(); names = ','.join(f'{name}_{kind}{i}' for i in range(1, N + 1))
def cut(args):
    r = subprocess.run([sys.executable, 'tools/px.py', 'sheet', raw, tmp, names, *args], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-400:]); sys.exit(1)
    m = re.search(r'cell ([\d.]+)', r.stdout); cell = float(m.group(1)) if m else float(args[args.index('--cell') + 1]); return cell, [Image.open(f'{tmp}/{name}_{kind}{i}.png').height for i in range(1, N + 1)]
if '--cell' in extra: cell, hs0 = cut(extra)
else:
    # px.py 自己估的格子大小在動作表上常不準：直接在原圖量每個人有多高，算出「站直＝待機圖高度」的格子大小再切
    from scipy import ndimage as ndi
    a = np.asarray(Image.open(raw).convert('RGB')).astype(int); fg = ~((a[..., 0] - a[..., 1] > 70) & (a[..., 2] - a[..., 1] > 70))
    lab, n = ndi.label(ndi.binary_closing(fg, iterations=3)); objs = [sl for sl in ndi.find_objects(lab) if (sl[0].stop - sl[0].start) > a.shape[0] * .15]
    hh = sorted(sl[0].stop - sl[0].start for sl in objs); ref = hh[-1] if kind == 'walk' else hh[min(1, len(hh) - 1)]      # 走路取最高那格；施法取第二矮的（舉手那格不算）
    cell, hs0 = cut(['--cell', f'{ref / H0:.3f}'])
print('cell', round(cell, 2))
os.makedirs('art/chars/anim', exist_ok=True); hs = []; steps = []
for i in range(1, N + 1):
    im = Image.open(f'{tmp}/{name}_{kind}{i}.png').convert('RGBA'); a = np.asarray(im); al = a[..., 3] > 0
    ys, xs = np.nonzero(al); im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); a = np.asarray(im); al = a[..., 3] > 0; h, w = al.shape
    # 頭的位置：離腳底 78%～97% 待機身高的那一段（舉手的格子不會被手干擾太多）
    y1, y0 = h - int(H0 * .78), max(0, h - int(H0 * .97)); band = al[y0:max(y0 + 1, y1)]
    cx = np.nonzero(band)[1].mean() if band.any() else w / 2
    half = int(np.ceil(max(cx, w - cx))) + 1; out = Image.new('RGBA', (half * 2, h), (0, 0, 0, 0)); out.paste(im, (int(round(half - cx)), 0))
    out.save(f'art/chars/anim/{name}_{kind}{i}.png'); hs.append(h)
    if kind == 'walk' and (i - 1) % (N // 2) == 0:      # 著地格：最下面幾列分成前後兩隻腳，量兩腳中心的距離＝一步的長度
        fx = np.nonzero(al[h - 5:].any(axis=0))[0]; g = np.split(fx, np.nonzero(np.diff(fx) > 3)[0] + 1)
        if len(g) >= 2: steps.append(g[-1].mean() - g[0].mean())
if kind == 'walk':
    mp = f'art/chars/anim/{name}.json'; meta = json.load(open(mp)) if os.path.exists(mp) else {}
    step = float(np.mean(steps)) if steps else 57.0; meta['walk'] = {'n': N, 'cycle': round(2 * step / 77, 3)}      # 77＝引擎的 PPU
    json.dump(meta, open(mp, 'w')); print('step px', round(step, 1), meta)
    for i in range(N + 1, 9):
        f = f'art/chars/anim/{name}_walk{i}.png'
        if os.path.exists(f): os.remove(f)
print(name, kind, 'heights', hs, 'idle', H0)

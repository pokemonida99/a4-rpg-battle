"""合體技的動作圖去背：洋紅 → 透明，裁到人物範圍。洋紅用嚴格的範圍判斷（阿傑帽子上的紫色帶子不能被挖掉），手臂和身體中間的洋紅空隙也要挖掉。
用法：uv run --with pillow --with numpy --with scipy python tools/act.py kui jie
加 --layers：最大的一塊（本人）存成 act_<id>.png，其他大塊（鼠仙女旁邊的老鼠）各存一張 act_<id>_p1.png…，位置寫在 act_<id>.json（以本人那張的左上角為原點、單位是像素），遊戲裡可以讓牠們晚一拍進場"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
layers = '--layers' in sys.argv
q = lambda im: im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)      # 壓成 256 色，檔案小很多（像素圖看不出差別）
for n in [a for a in sys.argv[1:] if not a.startswith('--')]:
    a = np.asarray(Image.open(f'art/raw/act_{n}.png').convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r > 190) & (b > 190) & (g < 110) & (abs(r - b) < 60)
    fg = ~bg
    for _ in range(2):      # 邊緣帶洋紅色的那一圈往內收
        edge = fg & ~ndi.binary_erosion(fg); fg &= ~(edge & (r - g > 70) & (b - g > 70) & (r > 150) & (b > 150))
    lab, k = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, k + 1)); big = [i for i, s in enumerate(sizes, 1) if s >= max(sizes) * .01]      # 小碎片丟掉
    def cut(mask):
        ys, xs = np.nonzero(mask); out = np.dstack([a, np.where(mask, 255, 0)]).astype(np.uint8); return Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), int(xs.min()), int(ys.min())
    if not layers:
        keep = np.isin(lab, big); im, _, _ = cut(keep); q(im).save(f'art/cutin/act_{n}.png', optimize=True); print(n, im.size, '塊數', len(big)); continue
    main = 1 + int(np.argmax(sizes)); im, x0, y0 = cut(lab == main); q(im).save(f'art/cutin/act_{n}.png', optimize=True); parts = []
    for j, i in enumerate([i for i in big if i != main], 1):
        pim, px, py = cut(lab == i); f = f'act_{n}_p{j}.png'; q(pim).save('art/cutin/' + f, optimize=True); parts.append({'file': f, 'x': px - x0, 'y': py - y0, 'w': pim.width, 'h': pim.height})
    json.dump({'w': im.width, 'h': im.height, 'parts': parts}, open(f'art/cutin/act_{n}.json', 'w')); print(n, im.size, '另外的圖層', [(p['file'], p['w'], p['h']) for p in parts])

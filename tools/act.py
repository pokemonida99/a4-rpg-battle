"""合體技的動作圖去背：洋紅 → 透明，裁到人物範圍。洋紅用嚴格的範圍判斷（阿傑帽子上的紫色帶子不能被挖掉），手臂和身體中間的洋紅空隙也要挖掉。
用法：uv run --with pillow --with numpy --with scipy python tools/act.py kui jie"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
for n in sys.argv[1:]:
    a = np.asarray(Image.open(f'art/raw/act_{n}.png').convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r > 190) & (b > 190) & (g < 110) & (abs(r - b) < 60)
    fg = ~bg
    for _ in range(2):      # 邊緣帶洋紅色的那一圈往內收
        edge = fg & ~ndi.binary_erosion(fg); fg &= ~(edge & (r - g > 70) & (b - g > 70) & (r > 150) & (b > 150))
    lab, k = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, k + 1)); keep = np.zeros_like(fg)
    for i, s in enumerate(sizes, 1):
        if s >= max(sizes) * .01: keep |= lab == i      # 小碎片丟掉，留人物本體和跟身體分開的大塊（例如伸出來的手）
    ys, xs = np.nonzero(keep); out = np.dstack([a, np.where(keep, 255, 0)]).astype(np.uint8)
    im = Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); im.save(f'art/cutin/act_{n}.png'); print(n, im.size, '塊數', int((sizes >= max(sizes) * .01).sum()))

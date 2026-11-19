"""半身像去背：洋紅 → 透明（邊緣內縮 1 像素去掉洋紅邊），裁到人物範圍。眼神特寫直接複製。
用法：uv run --with pillow --with numpy --with scipy python tools/bust.py"""
import numpy as np, shutil, os
from PIL import Image
from scipy import ndimage as ndi
os.makedirs('art/cutin', exist_ok=True)
for n in ['kui', 'jie', 'kevin', 'mi', 'vivi']:
    a = np.asarray(Image.open(f'art/raw/bust_{n}.png').convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r - g > 60) & (b - g > 60) & (abs(r - b) < 110); fg = ndi.binary_erosion(~bg, iterations=1)
    lab, k = ndi.label(fg); sizes = ndi.sum(fg, lab, range(1, k + 1)); fg = ndi.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))      # 只留最大的一塊
    out = np.dstack([a, np.where(fg, 255, 0)]).astype(np.uint8); ys, xs = np.nonzero(fg)
    im = Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); im.save(f'art/cutin/bust_{n}.png'); print(n, im.size)
    Image.open(f'art/raw/eyes_{n}.png').convert('RGB').save(f'art/cutin/eyes_{n}.jpg', quality=93)

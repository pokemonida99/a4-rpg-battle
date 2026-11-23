"""11/24 改版的圖示切圖：art/raw/icons3_A.png（道具 4×4）、icons3_B.png（核心強化 4×3）→ art/map/icons/ 透明底 128×128。
照格子切（有些零件離主體太遠，照連通塊切會切錯），只把跟外圍連通的洋紅當背景。
用法：uv run --with pillow --with numpy --with scipy python design/revamp/cut_icons.py [--force]"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
def grid(src, names, cols, rows):
    a = np.asarray(Image.open(src).convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]; bg = (r - g > 60) & (b - g > 60) & (abs(r - b) < 110)
    lab, _ = ndi.label(bg); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}; bg = np.isin(lab, list(edge)) | ((r > 215) & (g < 50) & (b > 215))
    fg = ndi.binary_opening(~bg, iterations=1); H, W = fg.shape
    # 格線：用前景的行列投影找空隙，比平均切準
    def cuts(prof, n): L = len(prof); return [int(round(L * i / n)) for i in range(n + 1)]
    xs, ys = cuts(fg.sum(0), cols), cuts(fg.sum(1), rows)
    for k, nm in enumerate(names):
        i, j = k % cols, k // cols; sl = (slice(ys[j], ys[j + 1]), slice(xs[i], xs[i + 1])); m = fg[sl]
        lb, n = ndi.label(ndi.binary_dilation(m, iterations=6)); 
        if n == 0: print('空格', nm); continue
        sizes = ndi.sum(m, lb, range(1, n + 1)); keep = np.isin(lb, [q + 1 for q in range(n) if sizes[q] > sizes.max() * .04]) & m
        dst = f'art/map/icons/{nm}.png'
        if os.path.exists(dst) and '--force' not in sys.argv: print('已存在，跳過', dst); continue
        rgba = np.dstack([a[sl], np.where(keep, 255, 0)]).astype(np.uint8); im = Image.fromarray(rgba); im = im.crop(im.getbbox()); s = max(im.size); sq = Image.new('RGBA', (s, s)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
        sq.resize((128, 128), Image.LANCZOS).save(dst)
    print(src, len(names))
grid('art/raw/icons3_A.png', ['it_stapler', 'it_knife', 'it_warmer', 'it_coolpatch', 'it_highlighter', 'it_toner', 'it_tape', 'it_poncho', 'it_bandage', 'it_balm', 'it_earplug', 'it_notice', 'it_stamp', 'it_tonic', 'it_usb', 'it_bag'], 4, 4)
grid('art/raw/icons3_B.png', ['up_cosign', 'up_shift', 'up_rota', 'up_express', 'up_recycle', 'up_relay', 'up_seal', 'up_notes', 'up_nap', 'up_drill', 'up_coin', 'up_dice'], 4, 3)

"""動作表 → 單格像素圖（一格一像素），腳底中心對齊到圖的正中間。
用法：uv run --with pillow --with numpy --with scipy python tools/cut.py <raw.png> <outdir> <名1,名2,…> [--cell 6.1] [--gap 3] [--anchor feet|center] [--flip 1,2,3] [--key strict]
會印出每格大小與估到的格子大小；同時輸出 <outdir>/<第一個名字>_meta.json。"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def bg_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r - g > 70) & (b - g > 70) & (np.abs(r - b) < 90)

def estimate_cell(a, lo=3.0, hi=14.0):
    best = (0, 0)
    for axis in (0, 1):
        d = np.abs(np.diff(a, axis=1 - axis)).sum(axis=2)
        prof = (d > 40).sum(axis=axis).astype(float); x = np.arange(len(prof)) + 1
        for p in np.arange(lo, hi, 0.02):
            ph = (x % p) / p * 2 * np.pi
            s = np.hypot((prof * np.cos(ph)).sum(), (prof * np.sin(ph)).sum()) / (prof.sum() + 1e-9)
            if s > best[0]: best = (s, p)
    return best[1], best[0]

def downsample(a, mask, cell):
    h, w = a.shape[:2]; H, W = int(round(h / cell)), int(round(w / cell)); out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        y0 = int((j + 0.3) * cell); y1 = max(int((j + 0.7) * cell), y0 + 1)
        for i in range(W):
            x0 = int((i + 0.3) * cell); x1 = max(int((i + 0.7) * cell), x0 + 1)
            blk = a[y0:y1, x0:x1].reshape(-1, 3); m = mask[y0:y1, x0:x1]
            if blk.size == 0 or m.mean() > 0.5: continue
            fg = blk[~m.reshape(-1)]; q = (fg // 8).astype(np.int64); key = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
            vals, cnt = np.unique(key, return_counts=True); sel = fg[key == vals[cnt.argmax()]]
            out[j, i, :3] = sel.mean(axis=0); out[j, i, 3] = 255
    return out

def split(rgba, gap):
    alpha = rgba[..., 3] > 0; lab, n = ndi.label(ndi.binary_dilation(alpha, iterations=gap)); boxes = []
    for k, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == k) & alpha[sl]
        if m.sum() < 60: continue
        ys, xs = np.where(m); y0, x0 = sl[0].start + ys.min(), sl[1].start + xs.min(); y1, x1 = sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1
        piece = rgba[y0:y1, x0:x1].copy(); piece[..., 3] = np.where(lab[y0:y1, x0:x1] == k, piece[..., 3], 0); boxes.append((y0, x0, y1, x1, piece))
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2); rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[2]) / 2 > max(c[2] for c in cur): rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[1])]

src, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
args = sys.argv[4:]; opt = {args[i][2:]: args[i + 1] for i in range(0, len(args) - 1, 2)}
a = np.asarray(Image.open(src).convert('RGB')).astype(np.int32); mask = bg_mask(a)
if opt.get('key') == 'strict':      # 人物身上有紫色、桃紅色的大色塊（不夜城的招牌）會被當成背景挖掉：改成「跟圖的邊緣連在一起的洋紅」才算背景，中間被包住的只認很純的洋紅
    lab, n = ndi.label(mask); edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}; pure = (a[..., 0] > 215) & (a[..., 1] < 50) & (a[..., 2] > 215)
    mask = np.isin(lab, list(edge)) | pure
cell = float(opt['cell']) if 'cell' in opt else estimate_cell(a)[0]
rgba = downsample(a, mask, cell); pieces = split(rgba, int(opt.get('gap', 3)))
if len(pieces) != len(names): print(f'警告：找到 {len(pieces)} 件，名字有 {len(names)} 個')
os.makedirs(outdir, exist_ok=True); meta = {'cell': round(cell, 2)}
flips = set(int(x) for x in opt.get('flip', '').split(',') if x)
for idx, (nm, (y0, x0, y1, x1, piece)) in enumerate(zip(names, pieces), 1):
    if idx in flips: piece = piece[:, ::-1].copy()
    al = piece[..., 3] > 0; h, w = al.shape
    if opt.get('anchor', 'feet') == 'feet':
        xs = np.nonzero(al[max(0, h - 5):].any(axis=0))[0]; cx = (xs.min() + xs.max() + 1) / 2
    else: cx = w / 2
    half = int(np.ceil(max(cx, w - cx))) + 1; out = Image.new('RGBA', (half * 2, h), (0, 0, 0, 0)); out.paste(Image.fromarray(piece), (int(round(half - cx)), 0))
    out.save(f'{outdir}/{nm}.png'); meta[nm] = [half * 2, h]
json.dump(meta, open(f'{outdir}/{names[0]}_meta.json', 'w')); print(json.dumps(meta))

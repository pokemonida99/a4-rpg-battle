# 像素素材整理：洋紅去背 → 估像素格大小 → 縮成真正的一格一像素 → 依物件切開
# 用法：
#   uv run --with pillow --with numpy --with scipy python tools/px.py sheet <in.png> <outdir> <名1,名2,...> [--cell 6.5] [--gap 14]
#   uv run ... python tools/px.py tex <in.png> <outdir> <名1,名2,名3,名4> [--cell 8]      # 2x2 材質圖
#   uv run ... python tools/px.py one <in.png> <out.png> [--cell 6.5]                    # 整張去背縮小不切
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int32)


def bg_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r - g > 70) & (b - g > 70) & (np.abs(r - b) < 90)


def estimate_cell(a, lo=3.0, hi=14.0):
    """找像素格週期：顏色邊界的位置對週期取餘數，最集中的那個週期就是格子大小。"""
    best = (0, 0)
    for axis in (0, 1):
        d = np.abs(np.diff(a, axis=1 - axis)).sum(axis=2)
        prof = (d > 40).sum(axis=axis).astype(float)  # 每一欄（列）有多少邊界
        n = len(prof)
        x = np.arange(n) + 1
        for p in np.arange(lo, hi, 0.02):
            ph = (x % p) / p * 2 * np.pi
            s = np.hypot((prof * np.cos(ph)).sum(), (prof * np.sin(ph)).sum()) / (prof.sum() + 1e-9)
            if s > best[0]:
                best = (s, p)
    return best[1], best[0]


def downsample(a, mask, cell):
    """每一格取中央區域的眾數顏色。回傳 RGBA。"""
    h, w = a.shape[:2]
    H, W = int(round(h / cell)), int(round(w / cell))
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        y0, y1 = int((j + 0.3) * cell), max(int((j + 0.7) * cell), int((j + 0.3) * cell) + 1)
        for i in range(W):
            x0, x1 = int((i + 0.3) * cell), max(int((i + 0.7) * cell), int((i + 0.3) * cell) + 1)
            blk = a[y0:y1, x0:x1].reshape(-1, 3)
            m = mask[y0:y1, x0:x1]
            if blk.size == 0:
                continue
            if m.mean() > 0.5:
                continue
            fg = blk[~m.reshape(-1)]
            q = (fg // 8).astype(np.int64)
            key = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
            vals, cnt = np.unique(key, return_counts=True)
            sel = fg[key == vals[cnt.argmax()]]
            out[j, i, :3] = sel.mean(axis=0)
            out[j, i, 3] = 255
    return out


def split(rgba, names, gap):
    alpha = rgba[..., 3] > 0
    lab, n = ndi.label(ndi.binary_dilation(alpha, iterations=gap))
    boxes = []
    for k, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == k) & alpha[sl]
        if m.sum() < 40:
            continue
        ys, xs = np.where(m)
        y0, x0 = sl[0].start + ys.min(), sl[1].start + xs.min()
        y1, x1 = sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1
        piece = rgba[y0:y1, x0:x1].copy()
        piece[..., 3] = np.where((lab[y0:y1, x0:x1] == k), piece[..., 3], 0)
        boxes.append((y0, x0, y1, x1, piece))
    # 先依列分組，再由左到右
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[2]) / 2 > max(c[2] for c in cur):
            rows.append(cur); cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[1])]
    return ordered


def main():
    mode, src = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    opt = {args[i][2:]: float(args[i + 1]) for i in range(len(args) - 1) if args[i].startswith("--")}
    pos = [x for i, x in enumerate(args) if not x.startswith("--") and (i == 0 or not args[i - 1].startswith("--"))]
    a = load(src)
    if mode == "tex":
        outdir, names = pos[0], pos[1].split(",")
        os.makedirs(outdir, exist_ok=True)
        cell = opt.get("cell") or estimate_cell(a)[0]
        h, w = a.shape[:2]
        full = downsample(a, np.zeros((h, w), bool), cell)
        H, W = full.shape[:2]
        quads = [(0, 0), (0, 1), (1, 0), (1, 1)]
        for nm, (qy, qx) in zip(names, quads):
            # 內縮 1 格，避開四格交界
            t = full[qy * H // 2 + 1:(qy + 1) * H // 2 - 1, qx * W // 2 + 1:(qx + 1) * W // 2 - 1, :3]
            Image.fromarray(t).save(f"{outdir}/{nm}.png")
            print(nm, t.shape[1], t.shape[0])
        print("cell", round(cell, 2))
        return
    mask = bg_mask(a)
    cell = opt.get("cell")
    if not cell:
        cell, score = estimate_cell(a)
        print("cell", round(cell, 2), "score", round(score, 3))
    rgba = downsample(a, mask, cell)
    if mode == "one":
        ys, xs = np.where(rgba[..., 3] > 0)
        Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(pos[0])
        print(pos[0], xs.max() - xs.min() + 1, ys.max() - ys.min() + 1)
        return
    outdir, names = pos[0], pos[1].split(",")
    os.makedirs(outdir, exist_ok=True)
    pieces = split(rgba, names, int(opt.get("gap", 3)))
    if len(pieces) != len(names):
        print(f"警告：找到 {len(pieces)} 件，名字有 {len(names)} 個")
    meta = {}
    for nm, (y0, x0, y1, x1, piece) in zip(names, pieces):
        Image.fromarray(piece).save(f"{outdir}/{nm}.png")
        meta[nm] = [int(x1 - x0), int(y1 - y0)]
    print(json.dumps(meta, ensure_ascii=False))


main()

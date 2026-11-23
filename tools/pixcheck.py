# 像素圖靜態檢查（でんちゃん C 節標【程】【半】的項目，08-pixel-craft.md）。只看、不改。
# 用法：uv run --with pillow --with numpy python tools/pixcheck.py [圖檔或資料夾 …] [--md 報告.md] [--sheet 對照圖.png]
# 沒給檔案就檢查全部同事的站姿（art/chars/*_ready.png）與敵人的待機（art/enemy/*_idle.png）。
# 每一項給「數值」和「旗標」：⚠＝超出規則建議、·＝在範圍內。門檻是參考值，最後要人看。
import sys, os, glob, colorsys, math
import numpy as np
from PIL import Image

av = sys.argv[1:]; args = [a for i, a in enumerate(av) if not a.startswith('--') and not (i and av[i - 1].startswith('--'))]; opt = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
files = []
for a in args or ['art/chars/*_ready.png', 'art/enemy/*_idle.png']:
    files += sorted(glob.glob(os.path.join(a, '*.png'))) if os.path.isdir(a) else sorted(glob.glob(a))

def lab_L(rgb):      # 近似明度（0～100）：sRGB → 線性 → Y → L*
    c = rgb / 255.0; c = np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4); Y = c @ np.array([.2126, .7152, .0722]); return np.where(Y > .008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)

def check(path):
    im = Image.open(path).convert('RGBA'); a = np.asarray(im).astype(int); H, W = a.shape[:2]; al = a[..., 3]; op = al >= 128; r = {'file': os.path.relpath(path), 'size': f'{W}×{H}'}
    px = a[op][:, :3]; n = len(px)
    if n == 0: return None
    cols, cnt = np.unique(px, axis=0, return_counts=True); r['colors'] = len(cols)
    # 半透明（平滑放大、反鋸齒到背景的痕跡）
    semi = ((al > 8) & (al < 247)).sum() / max(1, (al > 8).sum()); r['semi'] = semi
    # GPT 縮小的圖顏色上千種（雜訊），先合成 32 色再分析明暗（C2～C4 看的是「設計上的色階」，不是雜點）
    q = im.convert('RGB').quantize(32, method=Image.Quantize.MEDIANCUT); qa = np.asarray(q.convert('RGB')).astype(int)[op]; cols, cnt = np.unique(qa, axis=0, return_counts=True)
    r['err32'] = float(np.abs(qa - px).mean())      # 合成 32 色平均差多少（越小代表本來就接近限色）
    # 色相分群：每個色塊（色相 30° 一組、彩度夠的）看有幾階明暗、相鄰兩階差多少、陰影有沒有換色相
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in cols]); L = lab_L(cols.astype(float)); main = cnt >= max(3, n * .004)      # 太少的顏色（雜點）不算
    groups = []
    for hb in range(12):
        sel = main & (hsv[:, 1] > .18) & (((hsv[:, 0] * 360 + 15) % 360 // 30) == hb)
        if sel.sum() < 2: continue
        Ls = np.sort(np.unique(np.round(L[sel] / 4) * 4)); steps = len(Ls); gap = np.diff(Ls).min() if steps > 1 else 99
        hs = hsv[sel]; lo, hi = hs[L[sel].argmin()], hs[L[sel].argmax()]; dh = abs(((lo[0] - hi[0]) * 360 + 180) % 360 - 180)
        groups.append((hb * 30, steps, gap, dh, int(cnt[sel].sum())))
    big = [g for g in groups if g[4] > n * .05]      # 佔 5% 以上的色塊才評
    r['steps'] = max([g[1] for g in big], default=0); r['gap'] = min([g[2] for g in big], default=99)
    r['flat_shadow'] = sum(1 for g in big if g[1] >= 3 and g[3] < 4) / max(1, len(big))      # 陰影只是加黑：最亮到最暗色相幾乎沒變
    # 高彩度純色
    pxh = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in cols]); hot = (pxh[:, 1] > .85) & (pxh[:, 2] > .85); r['hot'] = cnt[hot].sum() / max(1, cnt.sum())
    # 外框：貼著透明的像素有幾成是深色（明度 < 25）；整張統一嗎
    edge = op & ~(np.pad(op, 1)[2:, 1:-1] & np.pad(op, 1)[:-2, 1:-1] & np.pad(op, 1)[1:-1, 2:] & np.pad(op, 1)[1:-1, :-2]); eL = lab_L(a[edge][:, :3].astype(float)); r['outline'] = (eL < 25).mean() if len(eL) else 0
    # 臉部太暗：膚色區塊裡面（不是邊緣）有多少接近黑色的點（眼睛會被算進去，所以只當參考）
    rgb = a[..., :3]; hv = np.zeros((H, W, 3));
    skin = op & (rgb[..., 0] > 170) & (rgb[..., 0] > rgb[..., 1] + 12) & (rgb[..., 1] > rgb[..., 2] - 5) & (rgb[..., 1] > 110)
    sk = np.argwhere(skin)
    if len(sk) > 20:
        y0, x0 = sk.min(0); y1, x1 = sk.max(0); y1 = min(y1, y0 + (H // 3)); box = op[y0:y1 + 1, x0:x1 + 1]; Lb = lab_L(rgb[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3).astype(float)).reshape(box.shape)
        inner = box & ~edge[y0:y1 + 1, x0:x1 + 1]; r['face_dark'] = ((Lb < 18) & inner).sum() / max(1, inner.sum())
    else: r['face_dark'] = None
    # 完全對稱
    m = op & op[:, ::-1]; same = (np.abs(rgb - rgb[:, ::-1]).sum(-1) < 30) & m; r['sym'] = same.sum() / max(1, op.sum())
    # 平滑放大：同一個顏色的最小區塊是不是都 ≥2 格（整數倍放大過）、或邊緣一堆中間色
    r['scaled'] = bool((np.abs(np.diff(rgb, axis=1)).sum(-1)[:, ::2] == 0).mean() > .97 and W > 2)
    return r

def flags(r):
    f = []
    if r['colors'] > 96: f.append(f"顏色 {r['colors']} 種（建議 ≤64，固定調色盤）")
    if r['steps'] > 5: f.append(f"單一色塊 {r['steps']} 階明暗（建議 3～5）")
    if r['gap'] < 6: f.append(f"相鄰明暗只差 {r['gap']:.0f}（縮小後分不出來）")
    if r['flat_shadow'] >= .5: f.append(f"{r['flat_shadow']:.0%} 的主要色塊陰影只是加黑（色相沒變）")
    if r['hot'] > .06: f.append(f"高彩度純色佔 {r['hot']:.0%}")
    if r['outline'] < .55: f.append(f"外框只有 {r['outline']:.0%} 是深色（外框不統一或沒外框）")
    if r['face_dark'] is not None and r['face_dark'] > .3: f.append(f"臉部深色點 {r['face_dark']:.0%}（鼻子嘴巴可能太暗）")
    if r['sym'] > .9: f.append(f"左右幾乎對稱（{r['sym']:.0%}）")
    if r['semi'] > .02: f.append(f"半透明像素 {r['semi']:.0%}（平滑放大或羽化）")
    if r['scaled']: f.append('像是放大過的圖（像素不是 1:1）')
    w, h = map(int, r['size'].split('×'))
    if max(w, h) > 200: f.append(f"尺寸 {r['size']}（超過 200px 就不像像素畫）")
    return f

rows = [x for x in (check(p) for p in files) if x]
out = ['| 檔案 | 尺寸 | 顏色 | 最多階 | 最小階差 | 只加黑 | 純色 | 深色外框 | 臉暗點 | 對稱 | 旗標 |', '|---|---|---|---|---|---|---|---|---|---|---|']
nflag = 0
for r in rows:
    f = flags(r); nflag += bool(f)
    out.append(f"| {r['file'].split('/')[-1]} | {r['size']} | {r['colors']} | {r['steps']} | {r['gap']:.0f} | {r['flat_shadow']:.0%} | {r['hot']:.0%} | {r['outline']:.0%} | {'' if r['face_dark'] is None else format(r['face_dark'], '.0%')} | {r['sym']:.0%} | {'；'.join(f) if f else '·'} |")
summary = f"\n共 {len(rows)} 張，{nflag} 張有旗標。"
txt = '\n'.join(out) + summary
if 'md' in opt: open(opt['md'], 'w').write(txt + '\n')
print(txt)
# 對照圖：實際大小（1×）＋左右翻轉，一排一張（C22 用實際大小看、E 斜臉要翻轉檢查）
if 'sheet' in opt:
    ims = [Image.open(p).convert('RGBA') for p in files]; Hm = max(i.height for i in ims) + 6; per = 12; rows_n = math.ceil(len(ims) / per)
    sheet = Image.new('RGBA', (per * (max(i.width for i in ims) * 2 + 16), rows_n * Hm), (40, 40, 48, 255)); cw = max(i.width for i in ims) * 2 + 16
    for k, im in enumerate(ims):
        x, y = (k % per) * cw, (k // per) * Hm; sheet.alpha_composite(im, (x, y + Hm - im.height - 3)); sheet.alpha_composite(im.transpose(Image.FLIP_LEFT_RIGHT), (x + im.width + 4, y + Hm - im.height - 3))
    sheet.save(opt['sheet'])

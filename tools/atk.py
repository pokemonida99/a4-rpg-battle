"""新夥伴的出招 8 格：art/raw/anim/<id>_a.png（第 1～4 格）、<id>_b.png（第 5～8 格）→ art/chars/anim/<id>_1~8.png。
用法：uv run --with pillow --with numpy --with scipy python tools/atk.py wu you …
GPT 每張圖畫的人物大小不一樣：a 用第 1 格、b 用第 8 格（都是站姿）的高度對齊站姿圖，像素密度才會跟 art/chars/<id>_ready.png 一樣。
加 --sup：切輔助招式的 4 格（art/raw/anim/<id>_s.png → art/chars/anim/<id>_s1~4.png，art/raw/jobs12.sh），檢查圖是 out/sup_<id>.png。
切完輸出 out/atk_<id>.png：站姿＋8 格排在一起，要用眼睛檢查（1）每格都面向左邊（2）大小一致（3）沒有兩格黏在一起或被切掉。"""
import os, sys, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def pieces(path, dil=8):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int); fg = ~((a[..., 0] > 170) & (a[..., 1] < 100) & (a[..., 2] > 170)); lab, n = ndi.label(ndi.binary_dilation(fg, iterations=dil)); out = []
    for sl in ndi.find_objects(lab):
        h, w = sl[0].stop - sl[0].start - 2 * dil, sl[1].stop - sl[1].start - 2 * dil
        if h * w > 9000: out.append((sl[1].start, w, h))
    return sorted(out)
def cut(src, names, cell):
    ok = False
    for g in (5, 3, 2, 1):      # 兩格黏在一起（件數不對）就把分隔縮小再切一次
        r = subprocess.run([sys.executable, 'tools/cut.py', src, 'art/chars/anim', ','.join(names), '--cell', f'{cell:.2f}', '--gap', str(g)], capture_output=True, text=True)
        if r.returncode: print(r.stderr[-300:]); break
        if '警告' not in r.stdout: ok = True; break
    meta = f'art/chars/anim/{names[0]}_meta.json'
    if os.path.exists(meta): os.remove(meta)
    return ok, (r.stdout.strip().splitlines() or [''])[0][:80]
bad = []; SUP = '--sup' in sys.argv
for n in [a for a in sys.argv[1:] if not a.startswith('--')]:
    ready = Image.open(f'art/chars/{n}_ready.png').convert('RGBA'); H0 = ready.height; fine = True
    for part, idx, ref in ((('s', ('s1', 's2', 's3', 's4'), 0),) if SUP else (('a', (1, 2, 3, 4), 0), ('b', (5, 6, 7, 8), -1))):
        src = f'art/raw/anim/{n}_{part}.png'
        if not os.path.exists(src): print(n, part, '還沒生'); fine = False; continue
        p = pieces(src)
        if len(p) != 4: print(n, part, f'找到 {len(p)} 個人（應該 4 個）'); fine = False
        ok, msg = cut(src, [f'{n}_{i}' for i in idx], p[ref][2] / H0); fine = fine and ok
        if not ok: print(n, part, '切不乾淨', msg)
    fs = [f'art/chars/anim/{n}_{i}.png' for i in (('s1', 's2', 's3', 's4') if SUP else range(1, 9))]
    if not all(os.path.exists(f) for f in fs): bad.append(n); continue
    ims = [ready] + [Image.open(f).convert('RGBA') for f in fs]; H = max(i.height for i in ims); W = sum(i.width for i in ims) + 8 * (len(ims) + 1); sheet = Image.new('RGBA', (W, H + 16), (40, 44, 60, 255)); x = 8
    for im in ims: sheet.paste(im, (x, 8 + H - im.height), im); x += im.width + 8
    os.makedirs('out', exist_ok=True); sheet.resize((W * 2, (H + 16) * 2), Image.NEAREST).save(f'out/{"sup" if SUP else "atk"}_{n}.png')
    print(n, '好' if fine else '要看', '站姿', H0, '各格高', [i.height for i in ims[1:]], '寬', [i.width for i in ims[1:]])
    if not fine: bad.append(n)
if bad: print('要重看或重生：', ' '.join(bad))

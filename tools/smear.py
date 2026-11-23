# 軌跡格（smear）：在出招的揮出格疊一道新月形刀光（でんちゃん A4、B 斬擊）。
# 白色前緣＋角色代表色的漸層尾巴，越往尾端越暗、越細，最後用棋盤格點散掉。刀光畫在人物「後面」，頭和身體不會被蓋住。
# 遊戲的貼圖有 alphaTest 0.5，半透明會被切掉，所以「變淡」只能靠換顏色和點散，不能用透明度。
# 圖會往上、左右對稱加寬（人物在貼圖裡是左右置中、腳底對齊，對稱加寬身體才不會跑掉）。
# 用法：uv run --with pillow --with numpy python tools/smear.py <輸入.png> <輸出.png> --pivot 35,40 --a0 -40 --a1 -140 --r 50 [--rin 20] [--pal fire] [--noblade]
#   pivot：握刀的手（像素座標）；a0→a1：刀光從尾巴到前緣的角度（度，0＝右、-90＝上、-180＝左，圖的 y 往下）；r：外半徑
import argparse, math
import numpy as np
from PIL import Image
P = {  # 前緣 → 尾巴
    'fire': [(255, 255, 246), (255, 236, 150), (255, 196, 84), (240, 128, 52), (196, 66, 42), (128, 34, 40)],
    'violet': [(255, 255, 255), (232, 214, 255), (190, 150, 250), (150, 96, 230), (104, 58, 180), (66, 34, 120)],
    'pink': [(255, 255, 255), (255, 222, 240), (255, 168, 214), (236, 110, 180), (184, 64, 140), (120, 36, 96)],
}
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--pivot', required=True); ap.add_argument('--a0', type=float, required=True); ap.add_argument('--a1', type=float, required=True)
ap.add_argument('--r', type=float, required=True); ap.add_argument('--rin', type=float, default=0); ap.add_argument('--pal', default='fire'); ap.add_argument('--noblade', default=''); ap.add_argument('--edge', type=float, default=.16); ap.add_argument('--thick', type=float, default=14)
a = ap.parse_args(); px, py = (float(v) for v in a.pivot.split(',')); pal = P[a.pal]; rin0 = a.rin or a.r * .42
src = Image.open(a.src).convert('RGBA'); W, H = src.size
# 先算刀光會用到的範圍，決定要加寬多少
pts = [(px + a.r * math.cos(math.radians(t)), py + a.r * math.sin(math.radians(t))) for t in np.linspace(a.a0, a.a1, 60)]
left = max(0, -int(min(x for x, _ in pts)) + 2); right = max(0, int(max(x for x, _ in pts)) - W + 3); top = max(0, -int(min(y for _, y in pts)) + 2)
padx = max(left, right); NW, NH = W + 2 * padx, H + top; ox, oy = padx, top
sm = np.zeros((NH, NW, 4), np.uint8)
cx, cy = px + ox, py + oy; span = a.a1 - a.a0
for j in range(NH):
    for i in range(NW):
        dx, dy = i + .5 - cx, j + .5 - cy; d = math.hypot(dx, dy); ang = math.degrees(math.atan2(dy, dx))
        # 角度換成 0（尾）→1（前緣）
        u = (ang - a.a0) / span
        if span < 0 and u < 0: u = (ang + 360 - a.a0) / span if (ang + 360 - a.a0) / span >= 0 else u
        if span > 0 and u < 0: u = (ang + 360 - a.a0) / span
        if not (0 <= u <= 1): continue
        # 新月形：外緣是半徑 r 的圓弧；厚度在前緣最厚（--thick），往尾巴越來越細，尾端細到 1 點
        th = 1 + (a.thick - 1) * u ** 1.4; rout = a.r; rin = rout - th
        if not (rin <= d <= rout): continue
        w = (d - rin) / max(1, th)          # 0＝內緣、1＝外緣（刀尖走過的地方最快、最亮）
        k = (1 - u) * 3.4 + (1 - w) * 2.2
        if u > 1 - a.edge and w > .45: k = 0      # 白色前緣
        idx = min(len(pal) - 1, int(k))
        if u < .3 and (i + j) % 2 == 0: continue      # 尾巴用棋盤格點散掉
        if u < .12 and (i % 3 or j % 2): continue
        sm[j, i] = (*pal[idx], 255)
out = Image.fromarray(sm, 'RGBA')
body = Image.new('RGBA', (NW, NH)); body.paste(src, (ox, oy))
if a.noblade:  # 只畫刀光、不畫刀：把刀身線段（x0,y0→x1,y1，護手前為止）附近 3 點內的像素拿掉
    x0, y0, x1, y1 = (float(v) for v in a.noblade.split(',')); b = np.array(body); L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2
    for j in range(NH):
        for i in range(NW):
            qx, qy = i - ox + .5, j - oy + .5; s = max(0, min(1, ((qx - x0) * (x1 - x0) + (qy - y0) * (y1 - y0)) / L2))
            if math.hypot(qx - x0 - s * (x1 - x0), qy - y0 - s * (y1 - y0)) <= 2.6: b[j, i] = 0
    body = Image.fromarray(b, 'RGBA')
out.alpha_composite(body)      # 人物蓋在刀光上面
out.save(a.out); print(a.out, out.size, '加寬', padx, '加高', top)

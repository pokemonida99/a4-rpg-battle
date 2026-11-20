"""資料卡的「真人版立繪」：有重畫過的上半身圖（art/raw/real/<代號>.png，art/raw/jobs13.sh 用 GPT 生）就用它縮成 640×640；
沒有的話退回舊做法：從角色設定圖（art/raw/refs/<代號>.png，右半邊是真人版或 3D 版的三視圖）裁出正面那一格 → art/cutin/real_<代號>.jpg。
用法：uv run --with pillow --with numpy python tools/real.py   → 另外輸出 out/real_check.jpg（16 張排在一起，要用眼睛確認每張都是正面、臉在上半部）
設定圖左邊是像素小人（洋紅底），右邊才是照片區；FRAC＝正面那一格佔照片區寬度的比例（四格的約 .25、三格的約 .34）。"""
import os
import numpy as np
from PIL import Image
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRAC = dict(jie=.25, kevin=.26, kui=.25, mi=.27, wu=.25, xu=.3, you=.27, fairy=.38, cha=.34, heilun=.34, qiang=.34, senpai=.34, yan=.34, hui=.36, zong=.36, vivi=.44)
OFF = dict(vivi=.17)      # 正面那一格不是從照片區最左邊開始的，往右移這個比例
TRIM = dict(kui=.1, fairy=.1)      # 底下有英文標籤的，裁掉這個比例
KIND = dict(cha='3d', heilun='3d', qiang='3d', senpai='3d', yan='3d', hui='3d', zong='3d')
out = []
for n, fr in FRAC.items():
    if os.path.exists(f'art/raw/real/{n}.png'):      # 重畫過的上半身立繪（art/raw/jobs13.sh，GPT 生的正方形）：直接縮成 640×640
        im = Image.open(f'art/raw/real/{n}.png').convert('RGB'); k = min(im.size); im = im.crop(((im.width - k) // 2, 0, (im.width - k) // 2 + k, k)).resize((640, 640), Image.LANCZOS); im.save(f'art/cutin/real_{n}.jpg', quality=86); out.append((n, im)); print(n, '重畫版', im.size); continue
    im = Image.open(f'art/raw/refs/{n}.png').convert('RGB'); a = np.asarray(im).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 200) & (g < 90) & (b > 200); dark = (r < 60) & (g < 60) & (b < 60); col = (~(mag | dark)).mean(axis=0)      # 每一欄有多少不是洋紅也不是黑邊
    full = n in ('jie', 'kevin', 'kui', 'mi', 'vivi')      # 兩種版型：照片貼滿整張高度的（從 x=281 開始），或四周留洋紅邊的（從 x=464 開始）
    x0, x1 = (281, im.width) if full else (464, int(np.where(col > .5)[0].max()) + 1); rows = np.where((~(mag | dark))[:, x0 + 20:x1 - 20].mean(axis=1) > .5)[0]; y0, y1 = int(rows.min()), int(rows.max()) + 1
    w = round((x1 - x0) * fr); ox = round((x1 - x0) * OFF.get(n, 0)); crop = im.crop((x0 + ox, y0, x0 + w, y1 - round((y1 - y0) * TRIM.get(n, 0)))); k = 640 / crop.height; crop = crop.resize((round(crop.width * k), 640), Image.LANCZOS)
    crop.save(f'art/cutin/real_{n}.jpg', quality=86); out.append((n, crop)); print(n, (x0, y0, x1, y1), crop.size, KIND.get(n, 'real'))
W = sum(c.width for _, c in out[:8]) + 9 * 6; sh = Image.new('RGB', (max(W, sum(c.width for _, c in out[8:]) + 9 * 6), 1300), (30, 30, 30)); x = 6
for i, (n, c) in enumerate(out):
    if i == 8: x = 6
    sh.paste(c, (x, 6 if i < 8 else 654)); x += c.width + 6
os.makedirs('out', exist_ok=True); sh.resize((sh.width // 2, sh.height // 2)).save('out/real_check.jpg', quality=85)

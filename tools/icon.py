"""主畫面圖示：用 Vivi 的半身像（art/cutin/bust_vivi.png，不另外生圖）合成，加黃銅邊框。
用法：uv run --with pillow python tools/icon.py   → icons/icon-512.png、icon-192.png、apple-touch-icon.png（180）、maskable-512.png
做法：先在 128×128 的小畫布上合成，再不平滑放大，顆粒感跟遊戲一致。maskable 版沒有邊框、人物縮小一點（系統會裁成圓形或圓角）。"""
import os
from PIL import Image, ImageDraw
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.makedirs('icons', exist_ok=True)
bust = Image.open('art/cutin/bust_vivi.png').convert('RGBA').crop((70, 0, 710, 640))      # 皇冠到領口
N = 128
def base(framed):
    im = Image.new('RGBA', (N, N), (30, 59, 54, 255)); d = ImageDraw.Draw(im)
    for r, col in ((62, (37, 78, 70)), (50, (47, 99, 89)), (38, (58, 120, 107)), (26, (72, 140, 124))): d.ellipse((N / 2 - r, N * .46 - r, N / 2 + r, N * .46 + r), fill=col + (255,))      # 背景：墨綠，中間亮一點
    k = 104 if framed else 96; b = bust.resize((k, k), Image.LANCZOS); a = b.getchannel('A').point(lambda v: 255 if v > 128 else 0); b.putalpha(a)
    im.alpha_composite(b, ((N - k) // 2, N - k))      # 人物貼齊下緣，不會看到半身像的切邊
    if framed:      # 黃銅邊框：深色外框、黃銅、內側亮線與暗線、四角鉚釘
        d = ImageDraw.Draw(im)
        for i, col in enumerate([(36, 19, 11), (36, 19, 11), (150, 112, 44), (202, 162, 76), (242, 220, 150), (202, 162, 76), (150, 112, 44), (36, 19, 11)]): d.rectangle((i, i, N - 1 - i, N - 1 - i), outline=col + (255,))
        for x, y in ((9, 9), (N - 10, 9), (9, N - 10), (N - 10, N - 10)): d.rectangle((x - 3, y - 3, x + 3, y + 3), fill=(58, 36, 14, 255)); d.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(202, 162, 76, 255)); d.rectangle((x - 2, y - 2, x - 1, y - 1), fill=(250, 236, 180, 255))
    return im
icon = base(True)
icon.resize((512, 512), Image.NEAREST).save('icons/icon-512.png'); icon.resize((192, 192), Image.NEAREST).save('icons/icon-192.png')
icon.resize((512, 512), Image.NEAREST).resize((180, 180), Image.LANCZOS).convert('RGB').save('icons/apple-touch-icon.png')
base(False).resize((512, 512), Image.NEAREST).save('icons/maskable-512.png')
print('ok', os.listdir('icons'))

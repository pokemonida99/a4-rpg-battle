# 關鍵時間點對照：python keys.py <old_dir> <new_dir> <out.jpg> x0 y0 x1 y1 t1,t2,...
import json, sys
from PIL import Image, ImageDraw, ImageFont
od, nd, out = sys.argv[1:4]; box = tuple(int(v) for v in sys.argv[4:8]); ts = [float(v) for v in sys.argv[8].split(',')]
F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
def pick(d, t):
    l = json.load(open(d + '/log.json')); i = min(l, key=lambda x: abs(x[1] - t)); return Image.open(d + '/f%04d.jpg' % i[0]).crop(box), i[1]
W, H = box[2] - box[0], box[3] - box[1]; cw = 240; ch = round(H * cw / W); per = 6; rows = (len(ts) + per - 1) // per
S = Image.new('RGB', (cw * per, (ch + 24) * rows * 2), (20, 20, 24)); d = ImageDraw.Draw(S)
for j, dd in enumerate([od, nd]):
    for k, t in enumerate(ts):
        im, tt = pick(dd, t); r = (k // per) * 2 + j; x = (k % per) * cw; y = r * (ch + 24)
        S.paste(im.resize((cw, ch), Image.LANCZOS), (x, y + 24)); d.text((x + 4, y + 2), ('BEFORE ' if j == 0 else 'AFTER ') + '%dms' % round(tt * 1000), font=F, fill=(180, 200, 255) if j == 0 else (255, 225, 140))
S.save(out, quality=90); print(out, S.size)

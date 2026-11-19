# 把一堆小像素圖放大排成總覽圖：python tools/sheet.py out.png scale bg file...
import sys
from PIL import Image
out, scale, bg = sys.argv[1], int(sys.argv[2]), sys.argv[3]
ims = [Image.open(f).convert("RGBA") for f in sys.argv[4:]]
ims = [im.resize((im.width * scale, im.height * scale), Image.NEAREST) for im in ims]
W = sum(i.width for i in ims) + 20 * (len(ims) + 1); H = max(i.height for i in ims) + 40
sh = Image.new("RGBA", (W, H), bg); x = 20
for im in ims:
    sh.alpha_composite(im, (x, H - 20 - im.height)); x += im.width + 20
sh.convert("RGB").save(out)
print(out, sh.size)

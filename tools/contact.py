"""把幾張像素圖放大排成一張檢查圖：python3 tools/contact.py out.png 倍率 圖1 圖2 …"""
import sys
from PIL import Image
out, k, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGBA') for f in files]; H = max(i.height for i in ims); W = sum(i.width for i in ims) + 8 * (len(ims) + 1)
sheet = Image.new('RGBA', (W, H + 16), (40, 44, 60, 255)); x = 8
for im in ims: sheet.paste(im, (x, 8 + H - im.height), im); x += im.width + 8
sheet.resize((W * k, (H + 16) * k), Image.NEAREST).save(out)

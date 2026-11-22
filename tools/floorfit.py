#!/usr/bin/env python3
"""地板材質收尾：art/raw/floor_<名字>.png → art/tex/floor_<名字>.png（201×201，跟原本的石板 floor3a 一樣大，地板的貼圖座標才不用重算）。
用法：python3 tools/floorfit.py <名字> [...]   取正中間的正方形、縮到 201、對比拉開、收成 40 色（像素畫的顆粒感，不抖色）
生出來的圖偏暗、對比低，鋪在地上被燈光和景深一蓋就只剩一片平的顏色，所以這裡把亮度拉到平均 .3、對比 ×1.7"""
import sys
from PIL import Image, ImageEnhance, ImageStat
for name in sys.argv[1:]:
    im = Image.open(f'art/raw/floor_{name}.png').convert('RGB'); w, h = im.size; s = min(w, h); m = int(s * .04)      # 邊緣 4% 不要（生圖常在邊上留一圈暗邊或框）
    im = im.crop(((w - s) // 2 + m, (h - s) // 2 + m, (w + s) // 2 - m, (h + s) // 2 - m)).resize((201, 201), Image.BOX)
    im = ImageEnhance.Contrast(im).enhance(1.7); mean = sum(ImageStat.Stat(im).mean) / 3 / 255; im = ImageEnhance.Brightness(im).enhance(min(2.4, .3 / max(.05, mean))); im = im.quantize(40, dither=Image.Dither.NONE).convert('RGB')
    im.save(f'art/tex/floor_{name}.png'); print('存好 art/tex/floor_%s.png' % name, (w, h))

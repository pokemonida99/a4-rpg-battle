#!/usr/bin/env python3
"""戰鬥背景收尾：art/raw/bg_<名字>.png → art/bg/<名字>.jpg（1536×1024）。
用法：python3 tools/bgfit.py <名字> [往下移幾像素，負的往上]   不給位移就只印出牆腳線大概在哪（找橫帶下面最明顯的一條橫向邊界）
程式只用正中間 y 327～697 的橫帶，牆腳線要落在 697 上下。平移空出來的邊用最外一行延伸補齊。"""
import sys
import numpy as np
from PIL import Image
name = sys.argv[1]; im = Image.open(f'art/raw/bg_{name}.png').convert('RGB').resize((1536, 1024), Image.LANCZOS); a = np.asarray(im).astype(np.float32)
row = a.mean(axis=(1, 2)); d = np.abs(np.diff(row)); cand = sorted(range(600, 800), key=lambda y: -d[y])[:5]
print(name, '牆腳線候選（亮度落差最大的幾行）：', [(y, round(float(d[y]), 1)) for y in cand])
if len(sys.argv) > 2:
    s = int(sys.argv[2]); b = np.asarray(im)
    if s > 0: b = np.concatenate([np.repeat(b[:1], s, axis=0), b[:-s]], axis=0)
    elif s < 0: b = np.concatenate([b[-s:], np.repeat(b[-1:], -s, axis=0)], axis=0)
    Image.fromarray(b).save(f'art/bg/{name}.jpg', quality=88); print('存好 art/bg/%s.jpg（位移 %d）' % (name, s))

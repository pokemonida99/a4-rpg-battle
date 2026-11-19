"""半身像去掉被頭髮、手臂圍住沒切到的洋紅底色（newchar.py／bust.py 會把封閉的洞整塊保留，夾在裡面的底色就留下來了）。
用法：uv run --with pillow --with numpy --with scipy python tools/bustfix.py [id…]（不給名字＝全部）。夠接近純洋紅、而且連成一片的才挖掉，衣服上的粉紅不會動。"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ids = sys.argv[1:] or [os.path.basename(f)[5:-4] for f in sorted(glob.glob('art/cutin/bust_*.png'))]
for n in ids:
    f = f'art/cutin/bust_{n}.png'; a = np.asarray(Image.open(f).convert('RGBA')).copy(); r, g, b = (a[..., i].astype(int) for i in range(3)); op = a[..., 3] > 0
    core = op & (r > 215) & (g < 70) & (b > 215); near = op & (r - g > 90) & (b - g > 90) & (abs(r - b) < 70) & (r > 170)      # core＝純洋紅；near＝邊緣混到的過渡色
    lab, k = ndi.label(core); sizes = ndi.sum(core, lab, range(1, k + 1)); big = np.isin(lab, 1 + np.nonzero(sizes >= 60)[0])
    kill = big | (near & ndi.binary_dilation(big, iterations=2)); a[kill, 3] = 0
    if kill.sum(): Image.fromarray(a).save(f)
    print(n, '挖掉', int(kill.sum()), '像素', f'（{int((sizes >= 60).sum())} 塊）')

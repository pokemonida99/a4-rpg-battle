# 把兩段慢速截圖照遊戲時間排成 60fps 的左右對照影片＋抽格圖
# uv run --with pillow python abvid.py <old_dir> <new_dir> <out_prefix> <x0> <y0> <x1> <y1> [title]
import json, sys, os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont
od, nd, pre = sys.argv[1:4]; box = tuple(int(v) for v in sys.argv[4:8]); title = sys.argv[8] if len(sys.argv) > 8 else ''
F = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 30) if os.path.exists('/System/Library/Fonts/PingFang.ttc') else ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 30)
Fs = ImageFont.truetype(F.path, 22)
def load(d): return json.load(open(os.path.join(d, 'log.json')))
L = {'old': (od, load(od)), 'new': (nd, load(nd))}
def pick(k, t):
    d, l = L[k]; i = min(l, key=lambda x: abs(x[1] - t)); return Image.open(os.path.join(d, 'f%04d.jpg' % i[0])).crop(box)
W, H = box[2] - box[0], box[3] - box[1]
def frame(t, slow):
    c = Image.new('RGB', (W * 2 + 12, H + 56), (20, 20, 24)); d = ImageDraw.Draw(c)
    for j, (k, lab) in enumerate([('old', '改之前'), ('new', '改之後')]):
        c.paste(pick(k, t), (j * (W + 12), 56)); d.text((j * (W + 12) + 14, 10), lab, font=F, fill=(255, 225, 140))
    d.text((W + 12 + 140, 18), f'{title}  t={t:0.3f}s  {slow}', font=Fs, fill=(220, 220, 220)); return c
def render(name, speed, T=1.5, pad=.4):
    tmp = pre + '_' + name; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    n = int((T + pad) * 60 / speed)
    for i in range(n):
        t = min(T, max(0, i / 60 * speed - .15)); frame(t, '原速' if speed == 1 else f'{speed:g} 倍慢動作').save(f'{tmp}/{i:05d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '60', '-i', f'{tmp}/%05d.png', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', f'{pre}_{name}.mp4'], check=True); shutil.rmtree(tmp)
render('x1', 1); render('slow', .25)
print('ok', pre)

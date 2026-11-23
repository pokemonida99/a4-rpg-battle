# 多段並排對照影片：python abvidn.py <out.mp4> x0 y0 x1 y1 <標題> <資料夾:標籤> ...（照遊戲時間排成 60fps；原速兩次＋0.25 倍慢動作）
import json, sys, os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]; box = tuple(int(v) for v in sys.argv[2:6]); title = sys.argv[6]; src = [a.split(':', 1) for a in sys.argv[7:]]
F = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 26); Fs = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 20)
L = [(d, lab, json.load(open(os.path.join(d, 'log.json')))) for d, lab in src]; W, H = box[2] - box[0], box[3] - box[1]
def frame(t, note):
    c = Image.new('RGB', (W * len(L) + 10 * (len(L) - 1), H + 80), (20, 20, 24)); d = ImageDraw.Draw(c)
    for j, (dd, lab, l) in enumerate(L):
        i = min(l, key=lambda x: abs(x[1] - t)); c.paste(Image.open(os.path.join(dd, 'f%04d.jpg' % i[0])).crop(box), (j * (W + 10), 44)); d.text((j * (W + 10) + 10, 8), lab, font=F, fill=(255, 225, 140))
    d.text((10, H + 50), f'{title}　t={t:0.3f}s　{note}', font=Fs, fill=(220, 220, 220)); return c
tmp = out + '_tmp'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp); n = 0
for speed, rep in [(1, 2), (.25, 1)]:
    for _ in range(rep):
        for i in range(int(1.6 * 60 / speed)):
            t = min(1.3, i / 60 * speed + .1); frame(t, '原速' if speed == 1 else '0.25 倍慢動作').save(f'{tmp}/{n:05d}.png'); n += 1
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '60', '-i', f'{tmp}/%05d.png', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out], check=True); shutil.rmtree(tmp); print(out)

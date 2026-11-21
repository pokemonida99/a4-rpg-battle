# 奧義配音聽檢短片：每句一張字卡＋音檔，接成一支。用法（專案根目錄）：
#   mkdir -p out/vo/tmp && uv run --quiet --with pillow python tools/vo_check.py <PingFang.ttc 的路徑> out/vo/tmp && ffmpeg -y -f concat -safe 0 -i out/vo/tmp/list.txt -c copy out/vo/上班旅人_奧義配音聽檢.mp4
import json, re, sys, subprocess, os
from PIL import Image, ImageDraw, ImageFont
font, out = sys.argv[1], sys.argv[2]
J = json.load(open('audio/vo/ult_extra.json', encoding='utf-8'))['lines']
W, H = 1280, 720
def f(n, i=0): return ImageFont.truetype(font, n, index=i)
segs = []; k = 0; total = len(J) * 2
for cid, v in J.items():
    line = re.sub(r'\[[^\]]*\]\s*', '', v['text'].split('／')[0].replace('_1：', '')).strip()
    for ver in (1, 2):
        k += 1
        im = Image.new('RGB', (W, H), (24, 20, 18)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, W, 8], fill=(196, 150, 70)); d.rectangle([0, H - 8, W, H], fill=(196, 150, 70))
        d.text((80, 60), f'上班旅人　奧義配音聽檢　{k}／{total}', font=f(30), fill=(170, 160, 145))
        d.text((80, 150), v['name'], font=f(110), fill=(245, 236, 215))
        tag = f'第 {ver} 版' + ('　★ 目前遊戲用這版' if v['recommend'] == ver else '')
        d.text((80, 300), tag, font=f(54), fill=(236, 190, 90) if v['recommend'] == ver else (200, 192, 178))
        d.text((80, 420), '「' + line + '」', font=f(60), fill=(255, 255, 255))
        d.text((80, 560), '音色：' + v['voice'], font=f(30), fill=(170, 160, 145))
        d.text((80, 610), '檔名：audio/vo/%s_%d.mp3' % (cid, ver), font=f(26), fill=(130, 122, 110))
        png = f'{out}/c_{k:02d}.png'; im.save(png); seg = f'{out}/s_{k:02d}.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', png, '-i', f'audio/vo/{cid}_{ver}.mp3', '-filter_complex', '[1:a]adelay=500:all=1,apad=pad_dur=0.9[a]', '-map', '0:v', '-map', '[a]', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', seg], check=True)
        segs.append(seg)
open(f'{out}/list.txt', 'w').write(''.join(f"file '{s}'\n" for s in segs))

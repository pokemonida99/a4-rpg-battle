"""合體技兩人台詞的聽檢短片：每一招一張字卡，先播遊戲目前用的那一組（第一句接第二句），停一下，再播另一版。
用法（專案根目錄）：mkdir -p out/vo/tmp && uv run --quiet --with pillow python tools/vo_unite_check.py <PingFang.ttc 的路徑> out/vo/tmp && ffmpeg -y -f concat -safe 0 -i out/vo/tmp/list.txt -c copy out/vo/上班旅人_合體技配音聽檢.mp4"""
import json, sys, subprocess, re
from PIL import Image, ImageDraw, ImageFont
font, out = sys.argv[1], sys.argv[2]
J = json.load(open('audio/vo/unite_vo.json', encoding='utf-8'))['moves']
NAMES = dict(re.findall(r"key: '(u_\w+)', who: \[[^\]]*\], name: '([^']*)'", open('js/rules.js', encoding='utf-8').read()))
W, H = 1280, 720; f = lambda n: ImageFont.truetype(font, n); segs = []
for k, (key, ls) in enumerate(J.items(), 1):
    rec = [l.get('recommend') or 'a' for l in ls]; alt = ['b' if r == 'a' else 'a' for r in rec]
    im = Image.new('RGB', (W, H), (24, 20, 18)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=(196, 150, 70)); d.rectangle([0, H - 8, W, H], fill=(196, 150, 70))
    d.text((80, 50), f'上班旅人　合體技配音聽檢　{k}／{len(J)}', font=f(30), fill=(170, 160, 145))
    d.text((80, 120), '合體技「' + NAMES.get(key, key) + '」', font=f(64), fill=(245, 236, 215))
    for i, l in enumerate(ls):
        y = 250 + i * 150
        d.text((80, y), l['name'], font=f(44), fill=(236, 190, 90)); d.text((300, y - 6), '「' + l['text'] + '」', font=f(56), fill=(255, 255, 255))
        d.text((300, y + 70), f"音色 {l['voice'].split(' - ')[0]}　遊戲用 {rec[i]} 版" + ('　⚠ ' + l['note'][:34] if any(w in l.get('note', '') for w in ['有疑慮', '有問題', '聽成「再開」', '在家嘛']) else ''), font=f(24), fill=(170, 160, 145))
    d.text((80, 600), '先播遊戲目前用的那一組，停一下，再播另一版', font=f(28), fill=(200, 192, 178))
    png = f'{out}/c_{k:02d}.png'; im.save(png); seg = f'{out}/s_{k:02d}.mp4'
    files = [ls[0]['files'][rec[0]]['file'], ls[1]['files'][rec[1]]['file'], ls[0]['files'][alt[0]]['file'], ls[1]['files'][alt[1]]['file']]; delays = [500, 120, 1100, 120]; ins = []; fc = []
    for i, n in enumerate(files): ins += ['-i', 'audio/vo/' + n]; fc.append(f'[{i+1}:a]aresample=44100,adelay={delays[i]}:all=1[a{i}]')
    fc.append(''.join(f'[a{i}]' for i in range(4)) + 'concat=n=4:v=0:a=1,apad=pad_dur=0.9[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', png, *ins, '-filter_complex', ';'.join(fc), '-map', '0:v', '-map', '[a]', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', seg], check=True); segs.append(seg)
open(f'{out}/list.txt', 'w').write(''.join(f"file '{s}'\n" for s in segs))

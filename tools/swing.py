#!/usr/bin/env python3
"""頭目揮擊中間格：art/raw/b2s_<代號>.png（5 格：站姿＋4 格揮擊，art/raw/jobs27.sh）→ art/enemy/anim/<代號>_s1～4.png。
用法：python3 tools/swing.py <代號> [--gap 2] [--key strict]
GPT 每張圖畫的人物大小不一樣，所以先量第 1 格（站姿）多高，算出一個格子大小，讓它切出來跟 art/enemy/<代號>_idle.png 一樣高，
後面 4 格用同一個格子大小切，像素密度就跟原本四張一樣。第 1 格只拿來對大小，不留。"""
import sys, os, json, subprocess, tempfile
from PIL import Image
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
name = sys.argv[1]; extra = sys.argv[2:]; src = f'art/raw/b2s_{name}.png'; names = ','.join(f'{name}_s{i}' for i in range(5))
cut = lambda out, cell: json.loads(subprocess.run(['uv', 'run', '--quiet', '--with', 'pillow', '--with', 'numpy', '--with', 'scipy', 'python', 'tools/cut.py', src, out, names, '--cell', str(cell), *extra], capture_output=True, text=True).stdout.strip().split('\n')[-1])
tmp = tempfile.mkdtemp(); m = cut(tmp, 4); assert len(m) == 6, f'要 5 格，找到 {len(m) - 1} 格：{m}'
idle = Image.open(f'art/enemy/{name}_idle.png').height; cell = round(m[f'{name}_s0'][1] * 4 / idle, 3)
m = cut('art/enemy/anim', cell); os.remove(f'art/enemy/anim/{name}_s0.png'); mj = f'art/enemy/anim/{name}_s0_meta.json'
if os.path.exists(mj): os.remove(mj)
print(name, '格子', cell, '站姿', m[f'{name}_s0'], '（原本', idle, '高）', {k.split('_')[-1]: v for k, v in m.items() if k[-2:] in ('s1', 's2', 's3', 's4')})

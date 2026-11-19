"""混音：照 out/events.json（node export.mjs events 產生）把音效、喊招、配樂排到時間軸上 → out/mix.wav（出片用）、out/preview.mp3（預覽頁用）。
用法：uv run --with numpy python tools/mix.py
找檔規則：音效 audio/sfx/<id>.(mp3|wav)；喊招 'vo/<名字>' → audio/vo/<名字>.mp3，沒有就用 <名字>_1.mp3（可在 audio/pick.json 指定用哪一版，例 {"vo/kui": "kui_2"}）；
配樂 'bgm/<名字>' → audio/bgm/<名字>.mp3。找不到的會列出來並跳過。喊招的時候配樂自動壓低。"""
import json, os, subprocess, sys
import numpy as np
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SR = 48000
ev = json.load(open('out/events.json')); N = int((ev['dur'] + .5) * SR)
pick = json.load(open('audio/pick.json')) if os.path.exists('audio/pick.json') else {}
GAIN = json.load(open('audio/gain.json')) if os.path.exists('audio/gain.json') else {}      # 個別音量微調，例 {"explosion_big": 1.2}
cache = {}
def find(id):
    name = pick.get(id)
    if id.startswith('vo/'): cands = [f'audio/vo/{name or id[3:]}.mp3', f'audio/vo/{id[3:]}_1.mp3', f'audio/vo/{id[3:]}.wav']
    elif id.startswith('bgm/'): cands = [f'audio/bgm/{name or id[4:]}.mp3', f'audio/bgm/{id[4:]}.m4a', f'audio/bgm/{id[4:]}.wav']
    else: cands = [f'audio/sfx/{name or id}.mp3', f'audio/sfx/{id}.wav']
    return next((c for c in cands if os.path.exists(c)), None)
def load(id):
    if id in cache: return cache[id]
    f = find(id); a = None
    if f:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
        a = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
        if not id.startswith('bgm/'):      # 去掉開頭的靜音，音量拉到一致
            env = np.abs(a).max(axis=1); on = np.nonzero(env > .02)[0]
            if len(on): a = a[max(0, on[0] - 200):]
            pk = np.abs(a).max(); a = a / pk * .8 if pk > 0 else a
    cache[id] = a; return a
mixb = np.zeros((N, 2), np.float32); vo_env = np.zeros(N, np.float32); missing = set()
def put(a, t, g):
    i = int(t * SR)
    if i >= N or i < 0: return
    n = min(len(a), N - i); mixb[i:i + n] += a[:n] * g
for e in ev['sfx']:
    a = load(e['id'])
    if a is None: missing.add(e['id']); continue
    vo = e['id'].startswith('vo/'); g = e.get('v', 1) * (1.0 if vo else .62) * GAIN.get(e['id'], 1); put(a, e['t'], g)
    if vo: i = int(e['t'] * SR); vo_env[max(0, i - 2400):min(N, i + len(a) + 7200)] = 1
# 配樂：淡入淡出；喊招時壓到四成
k = np.ones(4800) / 4800; duck = 1 - .6 * np.convolve(vo_env, k, mode='same')
for m in ev.get('music', []):
    a = load(m['id'])
    if a is None: missing.add(m['id']); continue
    i0, i1 = int(m['t0'] * SR), min(N, int(m['t1'] * SR)); n = i1 - i0
    if n <= 0: continue
    if len(a) >= n: seg = a[:n].copy()
    else:      # 配樂比這一段短：頭尾各去掉一點靜音，用 2 秒交叉淡化接成循環
        env = np.abs(a).max(axis=1); on = np.nonzero(env > .02)[0]; body = a[on[0]:on[-1] + 1] if len(on) else a; xf = int(2 * SR); step = len(body) - xf
        seg = np.zeros((n + len(body), 2), np.float32); ramp = np.linspace(0, 1, xf, dtype=np.float32)[:, None]; i = 0; first = True
        while i < n: chunk = body.copy(); chunk[-xf:] *= 1 - ramp; chunk[:xf] *= ramp if not first else 1; seg[i:i + len(chunk)] += chunk; i += step; first = False
        seg = seg[:n]
    pk = np.abs(seg).max() or 1; seg *= .5 / pk
    fi, fo = int(.6 * SR), int(1.4 * SR); seg[:fi] *= np.linspace(0, 1, fi)[:, None]; seg[-fo:] *= np.linspace(1, 0, fo)[:, None]
    mixb[i0:i1] += seg * duck[i0:i1, None] * GAIN.get(m['id'], 1)
mixb = np.tanh(mixb * 1.15) * .92      # 柔性限幅，爆炸疊在一起也不會破音
pcm = (mixb * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', 'out/mix.wav'], input=pcm)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'out/mix.wav', '-b:a', '160k', 'out/preview.mp3'])
print('mix', round(N / SR, 1), '秒；缺的檔：', sorted(missing) or '無')

"""程式合成的暫代配樂（等使用者用 Suno 生的正式版）：戰鬥曲 audio/bgm/battle.wav、勝利結算曲 audio/bgm/victory.wav。
用法：uv run --with numpy python tools/bgm.py
混音時 audio/bgm/<名字>.mp3 會優先於 .wav，所以正式版的 mp3 放進去就會自動取代這兩首，不用刪。
做法：每個樂器是加法合成（幾個泛音疊起來）＋包絡線；各聲部分開算，照設定的比例平衡後加殘響。"""
import os, re, subprocess
import numpy as np
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SR = 48000
rng = np.random.default_rng(7)
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def N(s):
    m = re.match(r'([A-G])([#b]?)(-?\d)$', s); return PC[m[1]] + {'#': 1, 'b': -1, '': 0}[m[2]] + 12 * (int(m[3]) + 1)
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def tone(m, dur, p=1.2, K=16, vib=0, vr=5.6, vdel=.12, cents=0, kdecay=0, odd=False):
    """加法合成：第 k 個泛音音量 1/k^p（p 小＝亮）；vib 顫音深度；kdecay 讓高泛音先消失（撥弦）。"""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m) * 2 ** (cents / 1200); ph = 2 * np.pi * f * t
    if vib: ph = ph + (f * vib / vr) * np.sin(2 * np.pi * vr * t) * np.clip((t - vdel) / .25, 0, 1)
    out = np.zeros(n)
    for k in range(1, K + 1):
        if odd and k % 2 == 0: continue
        if k * f > 15000: break
        h = np.sin(k * ph) / k ** p
        if kdecay: h *= np.exp(-t * kdecay * k)
        out += h
    return out
def adsr(n, a=.005, d=.1, s=.7, r=.05):
    t = np.arange(n) / SR; e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / d)); return e * np.clip((n / SR - t) / r, 0, 1)
def fnoise(n, lo=0, hi=24000):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); X[(f < lo) | (f > hi)] = 0; y = np.fft.irfft(X, n); return y / np.abs(y).max()
def add(buf, sig, t, g=1, pan=0):
    i = int(round(t * SR))
    if i >= len(buf) or i < 0: return
    n = min(len(sig), len(buf) - i); a = (pan + 1) * np.pi / 4; buf[i:i + n, 0] += sig[:n] * g * np.cos(a); buf[i:i + n, 1] += sig[:n] * g * np.sin(a)
def reverb(buf, wet=.2, tau=.33, length=2.2, pre=.02):
    n = int(length * SR); t = np.arange(n) / SR; out = buf.copy(); L = len(buf) + n; d = int(pre * SR)
    for c in range(2):
        ir = fnoise(n, 250, 6500) * np.exp(-t / tau); ir /= np.sqrt((ir ** 2).sum())
        y = np.fft.irfft(np.fft.rfft(buf[:, c], L) * np.fft.rfft(ir, L), L)[:len(buf)]; out[d:, c] += wet * y[:len(buf) - d]
    return out

# ── 樂器 ──
_c = {}
def memo(key, fn):
    if key not in _c: _c[key] = fn()
    return _c[key]
def spicc(m):      # 弦樂跳弓：很短的鋸齒音
    def f(): x = tone(m, .13, 1.15, 14, cents=-6) + tone(m, .13, 1.15, 14, cents=6); t = np.arange(len(x)) / SR; return x * np.minimum(t / .004, 1) * np.exp(-t / .045)
    return memo(('sp', m), f)
def bass(m, dur):
    def f(): x = tone(m, dur, 1.45, 10) + 1.2 * np.sin(2 * np.pi * hz(m) * np.arange(int(dur * SR)) / SR); return x * adsr(len(x), .004, .09, .55, .03)
    return memo(('ba', m, round(dur, 3)), f)
def trumpet(m, dur):
    x = tone(m, dur, 1.05, 18, vib=.004, vdel=.2, cents=-3) + tone(m, dur, 1.05, 18, vib=.004, vdel=.2, cents=3); return x * adsr(len(x), .022, .12, .8, .06)
def horn(m, dur):
    x = tone(m, dur, 1.7, 10, vib=.003, vdel=.3); return x * adsr(len(x), .05, .2, .85, .1)
def violin(m, dur):
    x = sum(tone(m, dur, 1.25, 16, vib=.006, vr=5.2 + .3 * i, vdel=.1, cents=c) for i, c in enumerate((-7, 0, 7))); return x * adsr(len(x), .05, .2, .85, .08)
def pad(m, dur):
    x = sum(tone(m, dur, 1.55, 10, vib=.003, vr=4.8 + .4 * i, cents=c) for i, c in enumerate((-9, 0, 9))); return x * adsr(len(x), .14, .3, 1, .2)
def stab(m): return memo(('st', m), lambda: (lambda x: x * adsr(len(x), .012, .07, .5, .08))(tone(m, .24, 1.0, 18, cents=-4) + tone(m, .24, 1.0, 18, cents=4)))
def pizz(m, tau=.11): return memo(('pz', m, tau), lambda: (lambda x: x * np.minimum(np.arange(len(x)) / SR / .003, 1) * np.exp(-np.arange(len(x)) / SR / tau))(tone(m, tau * 6, 1.5, 10, kdecay=3)))
def harp(m): return memo(('hp', m), lambda: (lambda x: x * np.minimum(np.arange(len(x)) / SR / .003, 1) * np.exp(-np.arange(len(x)) / SR / .5))(tone(m, 1.6, 1.3, 9, kdecay=1.6)))
def flute(m, dur):
    n = int(dur * SR); x = tone(m, dur, 2.2, 4, vib=.005, vr=5.4, vdel=.15) + fnoise(n, 2500, 9000) * .05; return x * adsr(n, .04, .15, .9, .06)
def glock(m):
    def f():
        n = int(1.4 * SR); t = np.arange(n) / SR; f0 = hz(m); return sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, .45), (2.76, .4, .2), (5.4, .15, .08)) if f0 * r < 16000)
    return memo(('gl', m), f)
def _dec(n, tau): return np.exp(-np.arange(n) / SR / tau)
KICK = (lambda n: np.sin(2 * np.pi * np.cumsum(45 + 110 * _dec(n, .035)) / SR) * _dec(n, .11) + fnoise(n, 2000, 8000) * _dec(n, .004) * .3)(int(.3 * SR))
SNARE = (lambda n: fnoise(n, 900, 9000) * _dec(n, .07) * .8 + np.sin(2 * np.pi * 190 * np.arange(n) / SR) * _dec(n, .05) * .6)(int(.28 * SR))
HAT = (lambda n: fnoise(n, 7000, 16000) * _dec(n, .028))(int(.15 * SR))
OHAT = (lambda n: fnoise(n, 6000, 16000) * _dec(n, .11))(int(.5 * SR))
CRASH = (lambda n: fnoise(n, 3500, 15000) * _dec(n, .5))(int(2.2 * SR))
BRUSH = (lambda n: fnoise(n, 1800, 9000) * _dec(n, .035))(int(.2 * SR))
def timp(m):
    def f():
        n = int(1.3 * SR); t = np.arange(n) / SR; f0 = hz(m); return sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, .45), (1.5, .5, .3), (1.99, .35, .25), (2.44, .2, .15))) + fnoise(n, 60, 400) * _dec(n, .02) * .5
    return memo(('tp', m), f)

def parse(s):      # "D5:1.5 F5:.5 | R:4" → 每小節一串 (音高或 None, 拍數)
    bars = []
    for b in s.split('|'):
        notes = [(None if a == 'R' else N(a), float(d)) for a, d in (x.split(':') for x in b.split())]
        assert abs(sum(d for _, d in notes) - 4) < 1e-6, b; bars.append(notes)
    return bars
def finish(stems, levels, wets, name, total):
    """各聲部先拉到指定的相對音量（看均方根），樂器加殘響、鼓和低音少加，最後輕微壓縮。"""
    mix = None
    for k, b in stems.items():
        act = b[np.abs(b).max(axis=1) > 1e-4]; rms = np.sqrt((act ** 2).mean()) if len(act) else 1
        y = reverb(b / rms * levels[k], wets.get(k, .22)); mix = y if mix is None else mix + y
        print(f'  {k:8s} 佔 {len(act) / len(b) * 100:3.0f}% 的時間')
    mix = mix[:int(total * SR)]; mix /= np.abs(mix).max(); mix = np.tanh(mix * 1.7); mix *= .9 / np.abs(mix).max()
    os.makedirs('audio/bgm', exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', f'audio/bgm/{name}.wav'], input=(mix * 32767).astype(np.int16).tobytes())
    print(name, round(total, 1), '秒')

# ── 戰鬥曲：D 小調、每分鐘 160 拍。前奏 2 小節 → A 8 → B 8 → A 8（加厚）→ 過門 4 → A 8（全員）→ 收尾 2，共 40 小節 60 秒 ──
def battle():
    B = 60 / 160; S = B / 4; BAR = 4 * B
    CH = {'Dm': (38, [62, 65, 69]), 'Bb': (34, [62, 65, 70]), 'C': (36, [60, 64, 67]), 'A': (33, [61, 64, 69]), 'Gm': (31, [62, 67, 70]), 'F': (41, [60, 65, 69])}
    PA = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A']; PB = ['Gm', 'Dm', 'Bb', 'F', 'Gm', 'Dm', 'Bb', 'A']
    MA = parse('D5:1.5 F5:.5 A5:1 G5:.5 F5:.5 | E5:.5 F5:.5 D5:2 R:.5 A4:.5 | D5:1.5 F5:.5 Bb5:1.5 A5:.5 | G5:1 E5:1 C5:1 E5:.5 G5:.5 |'
               'A5:1.5 D6:.5 C6:1 A5:1 | G5:.5 A5:.5 F5:2 D5:.5 F5:.5 | G5:1 Bb5:1 A5:1 G5:1 | A5:1.5 G5:.5 E5:1 C#5:1')
    MB = parse('Bb5:1.5 A5:.5 G5:1 D5:1 | F5:1.5 E5:.5 D5:2 | D5:.5 F5:.5 Bb5:1 A5:1 F5:1 | A5:1.5 G5:.5 F5:1 C5:1 |'
               'Bb5:1 D6:1 C6:.5 Bb5:.5 A5:1 | A5:1.5 F5:.5 D5:1 F5:.5 A5:.5 | Bb5:2 A5:1 G5:1 | A5:.5 C#6:.5 E6:3')
    MC = parse('D5:4 | F5:4 | G5:4 | A5:2 C#6:2')
    SEC = [('I', ['Dm', 'Dm'], None), ('A', PA, MA), ('B', PB, MB), ('A2', PA, MA), ('C', ['Dm', 'Bb', 'Gm', 'A'], MC), ('A3', PA, MA), ('E', ['Dm', 'Dm'], None)]
    nb = sum(len(p) for _, p, _ in SEC); L = int((nb * BAR + 3) * SR)
    st = {k: np.zeros((L, 2)) for k in ('lead', 'ost', 'bass', 'drums', 'pad', 'stab')}
    bar = 0
    for sec, prog, mel in SEC:
        for j, ch in enumerate(prog):
            t0 = bar * BAR; root, tn = CH[ch]; last = j == len(prog) - 1; at = lambda s16: t0 + s16 * S
            # 弦樂頑固音型：低音馬蹄節奏＋上方十六分音符分解和弦
            if sec not in ('E',) and not (sec == 'I' and j == 0):
                for s in (0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15): add(st['ost'], spicc(root + 12), at(s), 1.0 if s % 4 == 0 else .6, -.35)
                up = tn + [tn[0] + 12]
                for s, i in enumerate((3, 1, 2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 3, 2, 1, 0)): add(st['ost'], spicc(up[i]), at(s), .75 if s % 4 == 0 else .5, .35)
            # 低音：八分音符，最後一拍跳八度
            if sec not in ('I', 'E'):
                for e in range(8): add(st['bass'], bass(root + (12 if e == 6 else 7 if e == 7 else 0), B / 2 * .92), t0 + e * B / 2, 1 if e % 2 == 0 else .8)
            # 襯底長音；過門段越來越大聲
            g = (.5 + .5 * j / 3) if sec == 'C' else (.4 + .6 * j) if sec == 'I' else 1
            for m in [root + 12] + tn: add(st['pad'], pad(m, BAR * 1.02), t0, g, (m % 5 - 2) * .2)
            # 銅管和弦頓音
            if sec in ('A', 'A2', 'A3', 'B'):
                for s in ((0, 6, 10) if sec == 'A3' else (0, 6)):
                    for m in [root + 12, root + 24] + [x - 12 for x in tn[1:]] + ([tn[0]] if sec != 'A' else []): add(st['stab'], stab(m), at(s), .9 if s == 0 else .7, .1)
            # 鼓
            d = st['drums']
            if sec == 'I':
                for s in ((0, 8, 12, 14) if j == 0 else (0, 4, 8, 10, 12, 13, 14, 15)): add(d, timp(38 if s % 4 else 38), at(s), .5 + .5 * (j * 16 + s) / 32)
                if j == 1:
                    for s in range(16): add(d, SNARE, at(s), .15 + .7 * s / 15)
            elif sec == 'C':
                for s in (0, 4, 8, 12): add(d, KICK, at(s), 1)
                for s in (0, 10): add(d, timp(root + 12 if root < 36 else root), at(s), .9)
                for s in range(0, 16, 2): add(d, HAT, at(s), .35)
                if last:
                    for s in range(32): add(d, SNARE, t0 + s * S / 2, .12 + .75 * s / 31)
            elif sec == 'E':
                if j == 0:
                    for s in (0, 6, 12):
                        add(d, KICK, at(s), 1); add(d, CRASH, at(s), .5); add(d, timp(38), at(s), 1)
                        for m in (38, 50, 62, 65, 69, 74): add(st['stab'], stab(m), at(s), 1)
                else:
                    add(d, CRASH, t0, .8); add(d, KICK, t0, 1)
                    for s in range(32): add(d, timp(38), t0 + s * S / 2, .35 + .5 * abs(np.sin(s * .2)))
                    for m in (50, 62, 65, 69, 74): add(st['lead'], violin(m, BAR), t0, .6)
            else:
                full = sec == 'A3'
                for s in ((0, 3, 6, 8, 11, 14) if full else (0, 6, 8, 11)): add(d, KICK, at(s), 1)
                for s in (4, 12): add(d, SNARE, at(s), 1)
                for s in range(0, 16, 1 if full else 2): add(d, HAT, at(s), .45 if s % 4 == 0 else .28, .25)
                add(d, OHAT, at(14), .35, .25)
                if j == 0: add(d, CRASH, t0, .75, -.2)
                if last:
                    for s in (range(8, 16) if full else range(12, 16)): add(d, SNARE, at(s), .5 + .5 * (s - 8) / 7)
            # 旋律：A 小號；B 小提琴；第二次 A 加法國號低八度與小提琴；最後一次再加高八度
            if mel:
                tt = t0
                for m, beats in mel[j]:
                    dur = beats * B
                    if m is not None:
                        if sec == 'C': add(st['lead'], horn(m - 12, dur), tt, 1.2); add(st['lead'], horn(m, dur), tt, .8, .2)
                        elif sec == 'B': add(st['lead'], violin(m, dur * .98), tt, 1, .15); add(st['lead'], horn(m - 12, dur * .98), tt, .5, -.2)
                        else:
                            add(st['lead'], trumpet(m, dur * .94), tt, 1, -.1)
                            if sec in ('A2', 'A3'): add(st['lead'], horn(m - 12, dur * .96), tt, .7, -.3); add(st['lead'], violin(m, dur * .98), tt, .55, .3)
                            if sec == 'A3': add(st['lead'], violin(m + 12, dur * .98), tt, .3, .35)
                    tt += dur
            bar += 1
    # 前奏第二小節：弦樂音階往上衝
    for s, m in enumerate([N(x) for x in 'A4 Bb4 C5 D5 E5 F5 G5 A5 Bb5 C6 D6 E6 F6 G6 A6 D7'.split()]): add(st['ost'], spicc(m), BAR + s * S, .4 + .6 * s / 15, .2)
    finish(st, dict(lead=1.0, ost=.5, bass=.8, drums=.95, pad=.3, stab=.5), dict(drums=.1, bass=.04, lead=.26, ost=.2, pad=.3, stab=.24), 'battle', nb * BAR + 1.5)

# ── 勝利結算曲：D 大調、每分鐘 120 拍，8 小節主題走兩遍（第二遍加鐘琴），共 16 小節 32 秒 ──
def victory():
    B = .5; BAR = 2.0
    CH = {'D': (38, [62, 66, 69]), 'A/C#': (37, [61, 64, 69]), 'Bm': (35, [62, 66, 71]), 'G': (43, [62, 67, 71]), 'D/F#': (42, [62, 66, 69]), 'Em': (40, [64, 67, 71]), 'A': (45, [61, 64, 69])}
    PR = [('D', 'D'), ('A/C#', 'A/C#'), ('Bm', 'Bm'), ('G', 'G'), ('D/F#', 'D/F#'), ('G', 'G'), ('Em', 'A'), ('D', 'D')]
    M1 = parse('F#5:1 A5:1 D6:1.5 A5:.5 | C#6:1 B5:.5 A5:.5 E5:2 | D5:1 F#5:1 B5:1.5 A5:.5 | G5:1 B5:1 D6:2 |'
               'A5:1 F#5:.5 A5:.5 D6:1 F#6:1 | E6:1 D6:.5 B5:.5 G5:2 | G5:1 B5:1 A5:1 C#6:1 | D6:3 R:1')
    M2 = M1[:6] + parse('E6:1 D6:1 C#6:1 E6:1 | D6:4')
    L = int((17 * BAR + 3) * SR); st = {k: np.zeros((L, 2)) for k in ('lead', 'glock', 'pizz', 'harp', 'bass', 'perc', 'pad')}
    for bar in range(16):
        t0 = bar * BAR; rep = bar // 8; j = bar % 8
        for h in range(2):
            root, tn = CH[PR[j][h]]; th = t0 + h * 2 * B
            add(st['bass'], pizz(root, .22), th, 1); add(st['bass'], pizz(root + 7 if root + 7 < 50 else root - 5, .22), th + B, .6)
            for e in (1, 3):      # 弱拍上的撥弦和弦
                for m in tn: add(st['pizz'], pizz(m, .1), th + e * B / 2, .8, (m % 3 - 1) * .3)
            seq = [tn[0] - 12, tn[2] - 12, tn[1], tn[2]] if h == 0 else [tn[0] + 12, tn[2], tn[1], tn[2] - 12]
            for e, m in enumerate(seq): add(st['harp'], harp(m), th + e * B / 2, .9 if e == 0 else .65, .4 - e * .2)
            for m in [root + 12] + tn: add(st['pad'], pad(m, 2 * B * 1.03), th, 1, (m % 5 - 2) * .2)
        for s in (0, 4, 6, 8, 12, 14, 15): add(st['perc'], BRUSH, t0 + s * B / 4, 1 if s in (4, 12) else .5, .2)
        for s in range(0, 16, 2): add(st['perc'], HAT, t0 + s * B / 4, .35 if s % 4 else .2, -.3)
        if j == 0: add(st['perc'], CRASH, t0, .5)
        tt = t0
        for m, beats in (M2 if rep else M1)[j]:
            dur = beats * B
            if m is not None:
                add(st['lead'], flute(m, dur * .97), tt, 1, -.1)
                if rep: add(st['glock'], glock(m + 12), tt, 1, .3)
            tt += dur
        if not rep: add(st['glock'], glock(CH[PR[j][0]][1][2] + 24), t0, .8, .3); add(st['glock'], glock(CH[PR[j][0]][1][0] + 24), t0 + 3 * B, .5, .3)
    for m in (38, 50, 62, 66, 69, 74): add(st['harp'], harp(m), 16 * BAR, 1); add(st['pad'], pad(m, 2.5), 16 * BAR, 1)
    add(st['glock'], glock(86), 16 * BAR, 1)
    finish(st, dict(lead=1.0, glock=.4, pizz=.5, harp=.5, bass=.75, perc=.3, pad=.28), dict(perc=.1, bass=.06, lead=.25, glock=.3, harp=.25, pizz=.18, pad=.3), 'victory', 16 * BAR + 2.5)

battle(); victory()

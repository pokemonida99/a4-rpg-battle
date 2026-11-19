"""把一首歌做成可以無縫循環的配樂：去掉頭尾靜音、把結尾 2.5 秒交叉淡化接回開頭、音量拉到一致。
用法：uv run --with numpy python tools/loopbgm.py <來源檔> <輸出.mp3>
遊戲裡配樂是整首循環播放，直接接會在結尾（收尾、淡出）和開頭之間斷一下，所以先在檔案裡把接點做順。"""
import subprocess, sys
import numpy as np
src, out = sys.argv[1], sys.argv[2]; SR = 44100
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.float32).reshape(-1, 2).copy(); env = np.abs(a).max(axis=1); on = np.nonzero(env > .01)[0]; a = a[on[0]:on[-1] + 1]
# 結尾如果是淡出，從音量掉到全曲一半以下的地方切掉（不然循環接點會先變小聲）
win = SR; rms = np.sqrt(np.convolve((a ** 2).mean(axis=1), np.ones(win) / win, mode='same')); body = np.median(rms[SR * 10:-SR * 10]); tail = len(a)
while tail > SR * 30 and rms[tail - 1 - SR // 2] < body * .5: tail -= SR // 4
cut = len(a) - tail; a = a[:tail]
xf = int(2.5 * SR); r = np.linspace(0, 1, xf, dtype=np.float32)[:, None]; loop = np.concatenate([a[xf:len(a) - xf], a[len(a) - xf:] * np.sqrt(1 - r) + a[:xf] * np.sqrt(r)])
g = 10 ** (-17 / 20) / np.sqrt((loop ** 2).mean()); loop = np.tanh(loop * g * 1.05) / 1.05; loop *= .89 / np.abs(loop).max() if np.abs(loop).max() > .89 else 1
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '144k', out], input=loop.astype(np.float32).tobytes())
print(out, round(len(loop) / SR, 1), '秒；結尾切掉', round(cut / SR, 1), '秒；均方根', round(20 * np.log10(np.sqrt((loop ** 2).mean())), 1), 'dB')

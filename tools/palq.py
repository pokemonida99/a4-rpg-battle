# 限色試驗（でんちゃん C1～C3）：一個角色的所有圖（站姿、出招 8 格、軌跡格…）共用一組調色盤、不抖色，
# 讓同一個部位在每一格都是同樣幾個顏色——停住的格子就不會整片閃。只輸出到別的資料夾，不覆蓋原圖。
# 用法：uv run --with pillow --with numpy python tools/palq.py <角色代號> [顏色數=32] [輸出資料夾=out/palq]
import sys, os, glob
import numpy as np
from PIL import Image
id = sys.argv[1]; K = int(sys.argv[2]) if len(sys.argv) > 2 else 32; OUT = sys.argv[3] if len(sys.argv) > 3 else 'out/palq'
files = sorted(set(glob.glob(f'art/chars/{id}_*.png') + glob.glob(f'art/chars/anim/{id}_*.png') + glob.glob(f'art/chars/pose/{id}_*.png')))
files = [f for f in files if not f.endswith('_meta.json')]
ims = [Image.open(f).convert('RGBA') for f in files]
# 把所有不透明的像素拼成一條，算共用調色盤（median cut）
px = np.concatenate([np.asarray(im)[np.asarray(im)[..., 3] >= 128][:, :3] for im in ims]).astype(np.uint8)
strip = Image.fromarray(px.reshape(1, -1, 3), 'RGB'); pal = strip.quantize(K, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
os.makedirs(os.path.join(OUT, id), exist_ok=True)
for f, im in zip(files, ims):
    a = np.asarray(im); q = im.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'); b = np.dstack([np.asarray(q), a[..., 3]])
    b[a[..., 3] < 128] = 0; b[a[..., 3] >= 128, 3] = 255
    Image.fromarray(b.astype(np.uint8), 'RGBA').save(os.path.join(OUT, id, os.path.basename(f)))
print(id, len(files), '張', K, '色 →', os.path.join(OUT, id))

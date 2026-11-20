"""第二批圖示的切圖（做法照 tools/mapart.py 的 icons()）：洋紅底格子圖 → 每顆透明底 128×128。
用法：uv run --with pillow --with numpy --with scipy python design/icons2/cut.py
原圖 art/raw/icons2_A～C.png 由 art/raw/jobs18.sh 生。不會覆蓋已經存在的同名圖示。"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = 'art/map/icons'
def icons(src, names, rows):
    if not os.path.exists(src): print('還沒有', src); return
    a = np.asarray(Image.open(src).convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]; bg = (r - g > 60) & (b - g > 60) & (abs(r - b) < 110); fg = ndi.binary_erosion(~bg, iterations=1)
    lab, k = ndi.label(ndi.binary_dilation(fg, iterations=10)); boxes = [sl for sl in ndi.find_objects(lab) if (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start) > 8000]
    boxes.sort(key=lambda s: s[0].start); per = len(boxes) // rows; grid = [sorted(boxes[i * per:(i + 1) * per], key=lambda s: s[1].start) for i in range(rows)]; flat = [s for row in grid for s in row]
    if len(flat) != len(names): print('警告：', src, '找到', len(flat), '顆，名字有', len(names), '個，不切'); return
    for nm, sl in zip(names, flat):
        dst = f'{OUT}/{nm}.png'
        if os.path.exists(dst) and '--force' not in sys.argv: print('已存在，跳過', dst); continue
        m = fg[sl]; rgba = np.dstack([a[sl], np.where(m, 255, 0)]).astype(np.uint8); im = Image.fromarray(rgba); im = im.crop(im.getbbox()); s = max(im.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
        sq.resize((128, 128), Image.LANCZOS).save(dst)
    print(os.path.basename(src), len(flat), '顆')
icons('art/raw/icons2_A.png', ['sk_deadline', 'sk_backup', 'sk_escalate', 'sk_sanitize', 'sk_cover', 'sk_gavel', 'sk_followup', 'sk_disinfect', 'sk_budget', 'sk_morale', 'sk_reschedule', 'sk_minutes', 'sk_fineprint', 'sk_insurance', 'sk_cheer', 'sk_rumor'], 4)
icons('art/raw/icons2_B.png', ['sk_pallet', 'sk_handover', 'sk_attach', 'sk_redact', 'sk_spotlight', 'sk_cooldown', 'sk_spiked', 'sk_outofoffice', 'sk_nightshift', 'sk_snacks', 'sk_doorstop', 'sk_hotpack', 'sk_handoff', 'sk_burnout', 'sk_antidote', 'sk_prescription'], 4)
icons('art/raw/icons2_C.png', ['up_redpen', 'up_cutter', 'up_thermos', 'up_partition', 'up_blanket', 'up_cheatsheet', 'up_mug', 'up_snackdrawer', 'up_fridge', 'up_applause', 'up_countdown', 'up_bell', 'up_tabs', 'up_carbon', 'up_notebook'], 3)

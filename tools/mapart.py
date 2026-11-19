"""大地圖的美術：桌面底圖、藍圖紙上的公司剖面、站點圖示；以及選擇卡片上的小圖示（強化、起始招式）。
用法：uv run --with pillow --with numpy --with scipy python tools/mapart.py
原圖在 art/raw/（map_table、map_blueprint、map_icons、up_icons、skill_icons），由 art/raw/jobs7.sh 生。
圖示表是洋紅底的格子，這裡找出每一顆、照「由上到下、由左到右」排序後各自存成透明底的 128 像素小圖。"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.makedirs('art/map/icons', exist_ok=True)
for n in ('table', 'blueprint'):
    f = f'art/raw/map_{n}.png'
    if os.path.exists(f): im = Image.open(f).convert('RGB'); im.save(f'art/map/{n}.jpg', quality=90); print(n, im.size)
def icons(src, names, rows):
    if not os.path.exists(src): print('還沒有', src); return
    a = np.asarray(Image.open(src).convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]; bg = (r - g > 60) & (b - g > 60) & (abs(r - b) < 110); fg = ndi.binary_erosion(~bg, iterations=1)
    lab, k = ndi.label(ndi.binary_dilation(fg, iterations=10)); boxes = [sl for sl in ndi.find_objects(lab) if (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start) > 8000]
    boxes.sort(key=lambda s: s[0].start); per = len(boxes) // rows; grid = [sorted(boxes[i * per:(i + 1) * per], key=lambda s: s[1].start) for i in range(rows)]; flat = [s for row in grid for s in row]
    if len(flat) != len(names): print('警告：找到', len(flat), '顆，名字有', len(names), '個')
    for nm, sl in zip(names, flat):
        m = fg[sl]; rgba = np.dstack([a[sl], np.where(m, 255, 0)]).astype(np.uint8); im = Image.fromarray(rgba); im = im.crop(im.getbbox()); s = max(im.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
        sq.resize((128, 128), Image.LANCZOS).save(f'art/map/icons/{nm}.png')
    print(os.path.basename(src), len(flat), '顆')
icons('art/raw/map_icons.png', ['battle', 'elite', 'rest', 'gift', 'shop', 'event', 'recruit', 'rescue', 'hunt', 'chief', 'boss', 'clock'], 3)
icons('art/raw/up_icons.png', ['up_raise', 'up_leave', 'up_chair', 'up_drinks', 'up_coffee', 'up_morale', 'up_bento', 'up_learn'], 2)
icons('art/raw/skill_icons.png', ['sk_draft', 'sk_counter', 'sk_sweep', 'sk_burn', 'sk_freeze', 'sk_barrage'], 2)
# 第十一批（art/raw/jobs11.sh）：流派強化的圖示、夥伴招式的圖示
icons('art/raw/up_icons2.png', ['up_ember', 'up_bounty', 'up_riposte', 'up_dossier', 'up_crunch', 'up_tempo', 'up_weakpoint', 'up_firstaid'], 2)
icons('art/raw/skill_icons2.png', ['sk_taunt', 'sk_bash', 'sk_mend', 'sk_soothe', 'sk_treat', 'sk_delay', 'sk_lock', 'sk_mark', 'sk_deal', 'sk_push', 'sk_chat', 'sk_ult'], 3)
icons('art/raw/skill_icons3.png', ['sk_carry', 'sk_box', 'sk_probe', 'sk_expose', 'sk_encore', 'sk_dance', 'sk_slack', 'sk_backdoor', 'sk_mice', 'sk_wand', 'sk_sip', 'sk_news', 'sk_overtime', 'sk_allnight', 'sk_transfer', 'sk_mix'], 4)

#!/bin/zsh
# 像素手藝規則（でんちゃん「ドット絵の学校」，~/claude-tools/skills/arcade-game-maker/references/08-pixel-craft.md）寫成英文句子，
# 給以後的生圖腳本（art/raw/jobs*.sh）接在提示詞後面。用法：在 jobs 腳本開頭 source tools/pixrules.sh，再把 $PX_MOTION 或 $PX_STATIC 接進 P="..."。
# 11/24 定的（第五步）。每一條後面括號是規則編號，改的時候對照 08-pixel-craft.md。

# 出招／動作逐格圖（A 節）
PX_MOTION="Animation craft rules: \
(A1) Build the motion on 3 clear key poses that read instantly even as silhouettes: wind-up, strike, recovery; the other frames are in-betweens between those keys. \
(A2) Ease in and out: frames near the start and the end move only a little, the fastest part of the swing has the fewest frames and the biggest jump between frames. \
(A3) Anticipation: before the strike the body clearly winds up in the OPPOSITE direction (weapon or fist pulled back, body lowered and compressed). \
(A4) On the single fastest frame draw the weapon or limb as a curved motion smear (a crescent arc with a white leading edge fading into the character color, thinner and darker toward the tail) instead of a clear object. \
(A5) Follow-through: hair, scarf, coat, ribbons and loose clothes lag one frame behind the body and keep swinging after the body stops. \
(A6) Squash and stretch on soft bodies: compress on the wind-up frame, stretch on the strike frame. \
(A8) Every frame keeps a clear, readable silhouette; the weapon never hides the body. \
Consistency: the weapon stays in the SAME hand in every frame; the face, outfit, colors and proportions are identical in every frame; parts that do not move keep exactly the same pixels from frame to frame so the held poses do not shimmer. \
Style: thick dark outlines, simplified shapes, flat colors with only 2 to 3 shadow steps per material, no gradients, no blur."

# 單張立繪、圖示、背景物件（C 節）
PX_STATIC="Pixel craft rules: \
(C1) Use a small limited palette, about 32 colors for the whole figure. \
(C2, C3) Each material (skin, hair, cloth, metal) uses only 3 value steps, and neighboring steps are clearly different in brightness so they still read at small size. \
(C4) Shadows shift hue instead of just getting darker: skin shadows lean warm pink, cloth shadows lean toward purple or blue, highlights lean warm yellow. \
(C5) Avoid neon fully saturated colors; keep the overall palette calm. \
(C6) One light source from the upper left; all highlights and shadows agree with it. \
(C7, C8, C9) Clean pixel lines: straight lines are straight, diagonal steps are regular, curves change step length gradually, no doubled pixels at corners. \
(C10, C11) One consistent outline rule: every part has an outline, using a dark shade of that part's own color (dark brown on skin, dark purple on hair), not pure black everywhere. \
(C15) Nose and mouth are only slightly darker than the skin, mouth in a red tone, never near-black. \
(C17) Not perfectly symmetrical: hair, shading and folds differ left and right. \
Crisp square pixels, no anti-aliasing blur, no soft glow."

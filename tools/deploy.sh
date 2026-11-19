#!/bin/zsh
# 把試玩版要用的檔案整理到 dist/，推到 gh-pages 分支（GitHub Pages 從這個分支出）。
# 用法：zsh tools/deploy.sh        （要先 git remote add origin …）
# 只放遊戲跑得到的檔案：不含原圖、參考照、影片輸出、提案圖。網站首頁就是遊戲（game.html → index.html）。
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/js dist/audio/sfx dist/audio/vo dist/audio/bgm dist/art
cp game.html dist/index.html
cp js/engine.js js/room.js js/scene.js js/fx.js js/units.js js/screenfx.js js/ui.js js/battle.js js/rules.js js/game.js dist/js/
cp -R vendor fonts dist/
for d in chars enemy props tex cutin items; do cp -R art/$d dist/art/; done
find dist/art -name '*.json' -delete
cp audio/sfx/*.mp3 audio/sfx/whoosh.wav dist/audio/sfx/ && rm -f dist/audio/sfx/*_alt.mp3
cp audio/vo/*.mp3 dist/audio/vo/ && cp audio/bgm/battle.mp3 audio/bgm/victory.mp3 dist/audio/bgm/ && cp audio/pick.json dist/audio/
[ -f out/shots/game_2_command.jpg ] && ffmpeg -y -v error -i out/shots/game_2_command.jpg -vf "scale=1200:-2,crop=1200:630" -q:v 4 dist/og.jpg
touch dist/.nojekyll
find dist -name .DS_Store -delete
du -sh dist
cd dist && git init -q -b gh-pages && git add -A && git commit -q -m "deploy $(grep -o "VERSION = '[^']*'" js/game.js | cut -d"'" -f2) $(date +%Y%m%d-%H%M)" && git push -q -f "$(git -C .. remote get-url origin)" gh-pages && echo "已推到 gh-pages"

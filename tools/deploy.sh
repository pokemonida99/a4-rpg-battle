#!/bin/zsh
# 把試玩版要用的檔案整理到 dist/，推到 gh-pages 分支（GitHub Pages 從這個分支出）。
# 用法：zsh tools/deploy.sh        （要先 git remote add origin …）；zsh tools/deploy.sh build 只建置到 dist/ 不推
# 只放遊戲跑得到的檔案：不含原圖、參考照、影片輸出、提案圖。網站首頁就是遊戲（game.html → index.html）。
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/js dist/audio/sfx dist/audio/vo dist/audio/bgm dist/art
cp game.html dist/index.html && cp manifest.webmanifest dist/ && cp -R icons dist/
cp js/*.js dist/js/ && rm -f dist/js/main.js      # main.js 是影片預覽用的，遊戲不需要
cp -R vendor dist/ && mkdir -p dist/fonts
# 字型瘦身：只留遊戲程式裡出現過的字（11MB → 幾百 KB），手機載入快很多。程式裡新增文字後重新 deploy 就會帶進去
cat dist/js/*.js dist/index.html > dist/_chars.txt && uv run --quiet --with fonttools pyftsubset fonts/NotoSansTC.ttf --text-file=dist/_chars.txt --output-file=dist/fonts/NotoSansTC.ttf --layout-features='*' --notdef-outline && rm dist/_chars.txt
for d in chars enemy props tex cutin items; do cp -R art/$d dist/art/; done
find dist/art -name '*.json' -delete
cp audio/sfx/*.mp3 audio/sfx/whoosh.wav dist/audio/sfx/ && rm -f dist/audio/sfx/*_alt.mp3
cp audio/vo/*.mp3 dist/audio/vo/ && cp audio/bgm/battle.mp3 audio/bgm/victory.mp3 dist/audio/bgm/ && cp audio/pick.json dist/audio/
[ -f out/shots/game_2_command.jpg ] && ffmpeg -y -v error -i out/shots/game_2_command.jpg -vf "scale=1200:-2,crop=1200:630" -q:v 4 dist/og.jpg
touch dist/.nojekyll
find dist -name .DS_Store -delete
du -sh dist
[ "$1" = build ] && { echo '只建置，沒有推上去'; exit 0; }
cd dist && git init -q -b gh-pages && git add -A && git commit -q -m "deploy $(grep -o "VERSION = '[^']*'" js/game.js | cut -d"'" -f2) $(date +%Y%m%d-%H%M)" && git push -q -f "$(git -C .. remote get-url origin)" gh-pages && echo "已推到 gh-pages"

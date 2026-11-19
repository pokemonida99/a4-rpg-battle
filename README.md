# 不想上班 RPG：討伐奧客總經理（戰鬥畫面試作）

HD-2D 像素奇幻風的 RPG 戰鬥影片（約 94 秒，1920×1080）。腳本與招式看 `SCRIPT.md`。引擎從 `../ai-class-fantasy` 複製過來（`js/engine.js`、`room.js`、`fx.js`、`vendor/`），這裡可以自由改。

## 看與出片
- 預覽：`.claude/launch.json` 的 `a4-rpg-battle`（port 4630）。`http://localhost:4630/?t=20` 從第 20 秒開始；空白鍵播放、左右鍵跳 2 秒。
- 抽格檢查：`node export.mjs stills 7.4 12 55`（沒給時間就每 3 秒一張）→ `out/stills/`，六張拼一張 `sheet_NN.jpg`。
- 出片：`node export.mjs events` → `uv run --with numpy python tools/mix.py` → `node export.mjs video 2` → `out/video.mp4`（錄影約一分鐘）。

## 檔案
- `js/battle.js`：**整場戰鬥都在這裡**——角色設定 `DEFS`（職業、能力值、招式、站位）、時間軸（遭遇→小葵→阿傑→魔王蓄力→Kevin→魔王出手→小米→Vivi 總攻擊→勝利→角色介紹→片尾）、特效、鏡頭、音效事件。用游標 `T` 往後排，改前面後面自動順延。
- `js/ui.js`：介面（行動順序、隊伍狀態、指令選單、傷害數字、**大招斜切眼神特寫 `cutins`**、招式名牌、勝利結算、角色介紹卡）。
- `js/screenfx.js`：全畫面像素特效（480×270 放大四倍）：斜斬、集中線、紙張風暴、閃光、光柱。
- `js/units.js`：像素看板單位（逐格動作、受擊、溶解）與鏡頭軌道。`js/scene.js`：會議大廳場景。
- `tools/gen.sh` GPT 生圖；`tools/cut.py` 動作表 → 單格（腳底對齊）；`tools/bust.py` 半身像去背；`tools/mix.py` 混音。
- 生圖提示詞：`art/raw/jobs1.sh`（職業造型四姿勢、魔王、小兵、道具）、`jobs2.sh`（眼神特寫、半身像）、`jobs3.sh`（大招 8 格動作、魔王揮鎚 8 格）。

## 素材規則
- 角色大招動作一律 **至少 8 格**（使用者要求）：`art/chars/anim/<名字>_1~8.png`，由兩張各 4 格的表切出來（`art/raw/anim/<名字>_a.png`、`_b.png`）。
- GPT 每張表的像素格大小都不一樣，自動估格子常估錯（估到整數倍）。做法：量原圖人物高度，換算成「站姿＝職業造型表的像素高度」的格子大小，用 `--cell` 指定（各表用的值寫在 git 紀錄前先看 `art/chars/*_meta.json`）。
- pixelfx 特效有些會畫一個示範小人（發紅、靈魂、升級字樣）：`fx.js` 已換成空白輪廓；`ui/level-up` 會畫 LEVEL UP 字，不要用。

## 聲音（`audio/`）
清單在 `SCRIPT.md`。音效事件名＝檔名（`audio/sfx/<id>.mp3`），喊招 `audio/vo/<名字>_1.mp3`，配樂 `audio/bgm/battle.mp3`、`victory.mp3`。要換哪一版寫在 `audio/pick.json`，個別音量寫 `audio/gain.json`。

## 配樂
- 目前的 `audio/bgm/battle.wav`、`victory.wav` 是 `tools/bgm.py` 用程式合成的暫代版（`uv run --with numpy python tools/bgm.py`）。
- 正式版由使用者用 Suno 生：把 `battle.mp3`、`victory.mp3` 放進 `audio/bgm/`，混音時 mp3 會優先於 wav。
- 只換聲音不用重錄畫面：`uv run --with numpy python tools/mix.py` 之後
  `ffmpeg -y -i out/video.mp4 -i out/mix.wav -c:v copy -c:a aac -b:a 192k -shortest out/a4-rpg-battle.mp4`
- 喊招用哪一版寫在 `audio/pick.json`，個別音量在 `audio/gain.json`。

## 角色面向
我方站右邊，所有姿勢都要臉朝左（面向敵人）。GPT 生的圖常有幾張朝右：切完圖一定要把待機、勝利、動作 8 格排在一起看面向，朝右的用 `--flip` 或直接左右翻轉（腳底中心就是圖的水平中心，翻轉不影響站位）。
2026-11-19 已翻轉：kevin_ready、kevin_win、anim/kevin_1、jie_ready、jie_win、vivi_ready、vivi_win、anim/vivi_1。

## 字幕
喊招台詞的字幕在 `js/ui.js` 的 `subs()`，內容與每句錄音長度在 `js/battle.js` 的 `LINES`（換錄音要改秒數）。進場：金線展開、逐字浮現；退場：單純淡出。使用者要求：字幕不用破折號。

## 三回合版（2026-11-19）
- 時間軸在 `js/battle.js`「共用的回合零件」之後：`openMenu`（一般指令）、`heroTurn`（奧義）、`useItem`（道具）、`foeAtk`（小兵）、`bossCharge`（魔王蓄力）。舊的一回合版備份在 `js/battle.v1.bak`、`js/ui.v1.bak`。
- 護衛規則用 `S.guard` 軌道；第二批小兵是 `mc`、`md`（一開始隱藏，召喚時 `show`）。
- 傷害與補血都經過 `hurt`／`heal` 記帳，補血數字＝實際補回的量；改數值時記得讓小兵的血剛好被打完。
- 道具圖示在 `art/items/`（原圖 `art/raw/items.png`，`cut.py --gap 12 --anchor center`）。
- 影片較長，出片用背景執行：`nohup sh -c 'node export.mjs video 2 > out/render.log 2>&1; echo $? > out/render.done' &`
- 配樂比戰鬥短時 `tools/mix.py` 會用 2 秒交叉淡化接成循環。

## 試玩版（2026-11-19）
- 入口 `game.html`（影片預覽仍是 `index.html`）。本機：`python3 tools/serve.py 4630` 後開 `http://localhost:4630/game.html`。網址參數：`?mute` 靜音、`?fast=4` 快轉、`?seed=7` 固定亂數。
- `js/rules.js`：純規則（傷害、BP、護衛、破防、魔王 AI、道具），不碰畫面。數值都在檔頭的 `STAT`、`BOSS_ULT`、`ITEMS`。
- `js/game.js`：遊戲時鐘、回合流程、指令選單（滑鼠／觸控／方向鍵＋Enter／Esc 返回）、把規則算出的結果演出來、WebAudio 即時音效。演出沿用影片那套「把事件排在某個時間點」的做法，只是排在「現在之後」。
- `js/battle.js` 的 `setupStage()` 是影片和試玩版共用的場景與素材載入。
- 改數值後跑 `node tools/sim.mjs 1000`：三種打法（會想的、只放奧義不補血、只按攻擊）的勝率與回合數。目前：會想的約 96%、平均 6.5 回合；只放奧義不補血約 93%；只按攻擊必輸。
- 實際操作測試：`node tools/playtest.mjs [seed] [smart|mash] [快轉]`，無頭瀏覽器自動打一場，截圖在 `out/play/`。
- 介面沿用影片版的黑金風格；另一個 session 在 `ui-proposals/` 有改版提案，還沒定案。

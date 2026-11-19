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

## 上線（2026-11-19）
- 遊戲網址：https://pokemonida99.github.io/a4-rpg-battle/ （repo：pokemonida99/a4-rpg-battle，公開）
- `main` 是原始碼；`gh-pages` 是 `zsh tools/deploy.sh` 整理出來的遊戲檔（只放跑得到的素材，首頁就是遊戲）。
- 改版：改 `js/game.js` 的 `VERSION` → commit、push main → `zsh tools/deploy.sh`。上線後用 `PLAY_URL=https://pokemonida99.github.io/a4-rpg-battle/ node tools/playtest.mjs` 測線上版。
- 不上傳：`ref/`（參考照）、`art/raw/`、`out/`、`ui-proposals/`。

## v0.2.0（2026-11-19，依使用者試玩意見）
- 隊伍狀態改成最上面一排五欄（`ui.js` 的 `partyH`，`S.partyMode = 'h'` 才啟用，影片版不受影響），行動順序縮小，不再蓋到右邊的角色。
- 按鈕有按下去的回饋：沉下去、發亮、外框擴散、音效、手機震動，停 0.13 秒才執行；不能按的會左右抖一下。
- 倒下會跪倒再趴在地上：`art/chars/ko/<id>_1.png`（跪倒）、`_2.png`（趴地），原圖 `art/raw/anim/<id>_ko.png`（`art/raw/jobs4.sh`）。切圖後要置中。
- 每人有自己的招式（`rules.js` 的 `SKILLS`，只花 SP 不用 BP）：小葵 橫掃千稿／直球吐槽；Kevin 這個我來（挑釁）／盾擊；阿傑 暗影彈幕／加班詛咒；小米 治癒專線／安撫話術；Vivi 老闆請客。演出在 `game.js` 的 `playSkill`。

## v0.2.1（2026-11-19）小葵的影片抽格揮劍（試驗）
- `art/chars/h3/kui_01..24.png`：用 RunningHub H3 生影片再抽格做的 24 格揮劍（做法與原始檔在 `work/h3-anim-test/`，該資料夾不進版本庫）。
- 試玩版裡小葵的「攻擊」和「直球吐槽」用這組（`game.js` 的 `H3_T`）：每格 1/8 秒照影片原速，蓄力與定格停住的影格只留頭尾。奧義仍是 GPT 的 8 格。
- 網址加 `?h3=0` 切回原本的姿勢，方便對照。其他角色都還是 GPT 逐格版。

## v0.2.2（2026-11-19）
小葵換回原本的 GPT 逐格動作：使用者實際玩過，24 格和 8 格在遊戲裡「沒什麼感覺」，而新版比較慢、衣服會跑掉。影片抽格那組留在 `art/chars/h3/`，網址加 `?h3=1` 才啟用。結論：出招類不值得改用影片抽格；走路、待機這類循環動作之後可以再試。

## v0.3.0（2026-11-19）改名「上班旅人」、新介面、氣勢、受擊與防禦姿勢
- 遊戲名字定為**上班旅人**（副標「討伐奧客總經理」）。repo 與網址沒有改名。
- 介面用使用者選的 5b「董事會」材質：`js/skin.js`（木板、議程紙、銅夾子、紅印章都是程式畫的像素材質）。版位：左上議程紙條排頭像、最上面一塊木板分五欄放隊伍（名字在上面不擋角色）、下方木頭資料夾的索引標籤是指令。`ui.js` 看到 `S.skinHud`／`S.skinBoxes` 就交給它畫，影片版不受影響。
- 個人 BP 拿掉，改成全隊共用的「氣勢」條（`rules.js` 的 `MO`）：行動會加，到 40 可以放奧義，放完扣 40。
- 破防改叫「底氣」：敵人腳下的底氣條，魔王歸零蓋「理虧」章、垂頭一回合。
- 新姿勢：`art/chars/pose/<id>_{hurt,guard}.png`（Vivi 是 cheer、guard）、`art/enemy/boss_{hurt,stun}.png`，原圖 `art/raw/anim/*_hg.png`（`art/raw/jobs5.sh`）。
- 開始畫面與戰鬥中左上有「聲音」「畫質」開關（記在裝置上）；開始畫面太慢會自動切省電畫質（關景深、光暈、陰影）。網址 `?low`、`?mute` 也可以。
- 數值模擬多一個 `casual`（一般玩家）打法。目前：smart 100%、casual 約 71%、rush 約 66%、mash 0%。
- 還沒做：勝利結算畫面、傷害數字仍是舊的黑金風格；新招式的音效仍借用舊的；三關連打。

## v0.4.0（2026-11-19）三關連打
- `rules.js` 的 `STAGES`：第一關「加班大隊」（三隻小兵，教學）→ 第二關「甩鍋課長」（中頭目，沒有護衛，但每回合第一次被打會甩給小兵）→ 第三關「奧客總經理」。頭目共用 `'boss'` 位置，進關時把數值蓋到 `STAT.boss`、小兵名單換到 `MINIONS`。
- 過關：HP 補四成、SP 補一半、倒下的人站起來，再從 `UPGRADES` 隨機三個裡選一個（加薪、特休、人體工學椅、手搖飲團購、新咖啡機、士氣大振、加菜金）。輸了從第一關重來。
- `game.js`：`run`（一輪的進度）＋`state`（一場戰鬥）；`enterStage()` 重設畫面、`startStage()` 開場、`finish()` 分過關／通關／失敗；強化畫面是 `drawPick()`。網址 `?stage=2` 可以直接從第二關開始測。
- 甩鍋課長的圖：`art/enemy/chief_{idle,wind,atk,hurt}.png`（原圖 `art/raw/chief.png`，`art/raw/jobs6.sh`，`cut.py --cell 2.82 --gap 4`）。
- `tools/sim.mjs` 改成跑整輪三關：smart 通關 100%、casual 約 74%、rush 約 90%、mash 過得了第一關但過不了頭目。一輪約 12 回合。
- `tools/deploy.sh`：`js/*.js` 全部帶上（之前漏了 skin.js，靠本機測建置檔抓到）；字型只留程式裡出現的字（11MB → 0.6MB）。`zsh tools/deploy.sh build` 只建置不推，可用 `python3 -m http.server 4631 --directory dist` 加 `PLAY_URL=http://localhost:4631/ node tools/playtest.mjs` 先測。

## v0.4.1（2026-11-19）主畫面圖示與「加到主畫面」提醒
- 圖示是 Vivi：`tools/icon.py` 用 `art/cutin/bust_vivi.png` 合成（不另外生圖），墨綠底＋黃銅邊框 → `icons/`（512、192、apple-touch-icon 180、maskable 512）。
- `manifest.webmanifest`（名稱上班旅人、全螢幕、橫向）＋ `game.html` 的圖示與 apple-mobile-web-app 標籤。沒有做 service worker（不離線快取，更新不會卡舊版）。
- 開始畫面右上角的提醒紙條（`game.js` 的 `a2hs()`）：已經從主畫面開就不顯示；Android Chrome 有安裝事件時點一下直接跳安裝；iPhone 顯示「Safari 的分享鈕 → 加入主畫面」；點一下就不再提醒（記在裝置上）。電腦上不顯示，網址加 `?a2hs` 可以強制看。
- 影片抽格試驗的 24 張圖改成只有 `?h3=1` 才載入。

## v0.5.0（2026-11-19）肉鴿版面（行程表）
- 規則：`rules.js` 的 `MAP`（一層一站，分岔層二選一）＋`STAGES`（改成用名字查：crowd、night、chief、boss）。站的種類：battle 戰鬥、rest 茶水間（HP 回一半、SP 補滿）、gift 福委會（直接三選一）。`newRun`／`enterNode`／`endStage`（打贏補 25% HP、30% SP）／`rest`／`advance`／`isFinal`。
- 畫面：`game.js` 的 `drawHub()`，phase 是 `hub`。左上行程表（亮的站可以按）、右上隊伍、左下強化與道具、右下夥伴名冊（8 格，現在 5 人，空位留給之後的夥伴收集）。流程：開始 → 行程表 → 選站 → 戰鬥／休息／福利 → 回行程表。
- 修 bug：沒有頭目的戰鬥，目標清單不再出現「奧客總經理 HP 0%」；手機上 HP 上限和 SP 重疊（放不下就不畫「／上限」）。
- 按鍵聲改成程式合成的木頭叩擊聲（`uiSound`），不再用 confirm／cursor 音效。
- 普攻發力聲／短台詞：`audio/vo/attack.json` 列出每個人的檔案，`grunt()` 輪流播（發力聲、台詞交錯）。檔案由聲音 session 用 ElevenLabs 生，清單是空的時候就不播。
- `tools/sim.mjs` 改成走行程表（三種走法 × 四種打法）；`tools/playtest.mjs` 用 `HUB=rest` 可以改走茶水間。`?floor=3` 直接從第三站開始。

## v0.5.1（2026-11-20）配樂換成使用者的歌
- 一般戰鬥曲 `audio/bgm/battle.mp3`＝〈月底吃土〉、魔王曲 `audio/bgm/boss.mp3`＝〈幽靈舞步〉，都是使用者用 Suno 做的純音樂版。來源檔放 `audio/bgm_user/`（不進版本庫）。
- `tools/loopbgm.py <來源> <輸出.mp3>`：去頭尾靜音、切掉結尾淡出、2.5 秒交叉淡化接回開頭、音量拉齊，遊戲裡才能無縫循環。
- 遊戲：魔王那一站換成魔王曲（`startStage` 裡的 `playMusic`），其他站和行程表播一般戰鬥曲。勝利曲還是 ElevenLabs 那首。
- 注意：影片版重新混音時 `tools/mix.py` 也會讀到新的 `battle.mp3`；要用舊的就指到 `audio/bgm_elevenlabs/`。

## v0.5.2（2026-11-20）配樂切換與地圖曲
- 切換規則（`game.js`）：行程表與選強化畫面播地圖曲 `bgm/map`；進戰鬥換 `bgm/battle`，魔王站換 `bgm/boss`；戰鬥一結束戰鬥曲馬上淡出（過關、通關都是），號角響完回到行程表才換回地圖曲。
- 地圖曲 `audio/bgm/map.mp3` 暫時借用之前沒用到的程式合成結算曲（`tools/bgm.py` 的 victory.wav 經 `tools/loopbgm.py` 做成 31 秒循環），音量 0.75。使用者之後有自己的地圖曲，放 `audio/bgm/map.mp3` 取代即可。

## v0.6.0（2026-11-20）一人開局、招募夥伴、新大地圖

- **開局**：選小葵或阿傑，三個招式先帶一個（其他靠強化「在職進修」學）。只有一個人出發。
- **夥伴 16 人**：原本五人＋上班啟示錄的小燕、黑輪、茶茶、阿強、學姊＋使用者指定的小蝶（舞孃）、老油條（盜賊）、鼠仙女（召喚師）、棕鼠、灰鼠（社畜老鼠）、許許（櫃檯藥師）。每人兩個招式＋一個奧義，設定在 `js/rules.js`（`STAT`、`SKILLS`、`ULTS`）與 `js/battle.js`（`DEFS`）。
- **行程表改成八站**：招募站（兩人選一）、救援戰（打贏救出一人）、獵頭公司、菁英戰。名冊最多 6 人，前 4 人出戰，大地圖右欄用箭頭調順序。敵人的血與攻擊照上場人數縮放（`SCALE`）。
- **大地圖**：GPT 畫的會議桌（`art/map/table.jpg`）＋公司剖面藍圖（`art/map/blueprint.jpg`）＋站點徽章（`art/map/icons/`）。站的位置寫在 `js/game.js` 的 `STN`（藍圖原圖座標）。點一下看內容，再點一次或按「出發」前進。
- **選卡畫面**（選主角、選招式、招募、強化）共用 `openCards()`／`drawPick()`：角色用半身像，招式與強化用小圖示（`sk_*`、`up_*`）。
- **新夥伴的圖**：`art/raw/jobs7.sh`、`jobs8.sh` 生（每人五張：動作表、受擊防禦、倒地、半身像、眼神），`tools/newchar.py <代號…>` 切圖並出檢查圖 `out/check_<代號>.png`。少一張必要的圖，這個人就不會出現在招募名單。
- **演出**：新夥伴的普攻、招式、奧義先用通用演出（`SKFX` 表、`genericSkill()`、`playUltNew()`），之後再換逐格動畫。
- **夥伴名冊**：遇過的人記在瀏覽器（`localStorage` 的 `met`），大地圖右下顯示。
- 小米的攻擊台詞重做成「恕不受理！」「這通，我掛了！」。
- 測試：`node tools/sim.mjs`（兩個主角 × 三種打法的通關率）、`STAGE=crowd TEAM=wu,fairy,hui node tools/playtest.mjs 11 smart 6`（指定隊伍自動試玩）。
- 接下來要做的事在 `docs/TODO.md`。

## v0.6.1（2026-11-20）載入變快

- v0.6.0 上線後開場要等一分鐘以上：角色圖是一張一張排隊下載（16 人、一百多張）。`js/battle.js` 改成所有人、所有圖同時下載（`Promise.all`），載完再照順序放進場景。
- 線上入口是根網址（`deploy.sh` 把 `game.html` 改名成 `index.html`），測線上版用 `PLAY_URL=https://pokemonida99.github.io/a4-rpg-battle/ node tools/playtest.mjs`。

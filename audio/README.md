# audio/ 聲音素材說明

2026-11-19 用 ElevenLabs 網頁（使用者 Mac 的 Chrome）產生。我聽不到聲音：音效是看波形＋頻譜挑的，人聲的語氣與讀音**請用耳朵確認**，要重生哪句再說。

點數：開工 8,105 → 收工 5,521，共約 2,584 點（音效約 670、人聲約 230、配樂 1,575 — 配樂是在收到「不要生配樂」之前送出的，已從 audio/bgm/ 拿掉，見最後一節）。

## 音效 `sfx/`（ElevenLabs Sound Effects v3，提示詞影響度 30%，每次出 4 版）

處理：開頭靜音裁掉、裁到 SCRIPT.md 的長度、結尾 30 ms 淡出、峰值統一 -1 dBFS，mp3 192k。
備用版一律叫 `<名>_alt.mp3`（因為 `slash_b` 是正式的第二種斬擊）。

| 檔名 | 長度(s) | 用的版本 | 提示詞 |
|---|---|---|---|
| encounter | 1.92 | encounter/v4 | Fantasy RPG battle encounter transition: a fast rising whoosh swell that builds tension, ending in a heavy impact with shattering glass, punchy and clean, no voices, no music |
| boss_appear | 2.38 | boss_appear/v1 | Fantasy RPG boss monster appears: one massive slow heavy footstep thud shaking the ground, followed by a single ominous low brass horn blast, dark and menacing, clean, no voices |
| cursor | 0.30 | cursor2/v3 | Clean 16-bit game menu cursor blip: one short clear high-pitched square-wave beep, bright and audible, dry, no reverb, no voices, no music |
| confirm | 0.49 | confirm/v3 | Menu confirm sound for a fantasy RPG: a bright crisp metallic clink-ding, short sword-ring chime, clean UI sound, no voices, no music |
| cutin | 1.20 | cutin/v3 | Special attack cut-in: a sharp blade slicing through the air with a fast swish, followed by a long ringing metallic shing, anime fantasy RPG style, clean, no voices, no music |
| cutin_alt | 1.20 | cutin/v1 | Special attack cut-in: a sharp blade slicing through the air with a fast swish, followed by a long ringing metallic shing, anime fantasy RPG style, clean, no voices, no music |
| slash | 0.60 | slash/v1 | Sword slash hitting an enemy: one fast heavy blade strike with a meaty impact, fantasy RPG combat, punchy and clean, no voices, no music |
| slash_alt | 0.60 | slash/v3 | Sword slash hitting an enemy: one fast heavy blade strike with a meaty impact, fantasy RPG combat, punchy and clean, no voices, no music |
| slash_b | 0.68 | slash_b/v2 | Heavy greatsword strike: one very heavy sword slash hitting armor, deep impact with a metallic ringing echo tail, fantasy RPG combat, clean, no voices, no music |
| slash_multi | 1.20 | slash_multi/v2 | Rapid combo of five quick sword slashes in a row, fast swishes each ending in a light cutting impact, anime fantasy RPG combat, clean, no voices, no music |
| hit | 0.40 | hit/v4 | Blunt heavy hit impact: a single punchy body blow thud with a short crack, fantasy RPG battle damage sound, clean, no voices, no music |
| hit_alt | 0.40 | hit/v3 | Blunt heavy hit impact: a single punchy body blow thud with a short crack, fantasy RPG battle damage sound, clean, no voices, no music |
| dark_charge | 1.87 | dark_charge2/v1 | Ominous dark energy crescendo: a deep swirling vortex rumble that starts quiet and steadily grows louder and more intense until the very end, black magic charging, no impact, no voices, no music |
| dark_blast | 1.95 | dark_blast/v1 | Dark magic explosion: a deep booming blast of shadow energy with a low rumbling distorted whoosh, fantasy RPG black magic spell, no voices, no music |
| holy_cast | 1.92 | holy_cast/v3 | Holy light spell casting: an ethereal wordless angelic choir pad swelling up with sparkling bells and shimmering chimes, fantasy RPG white magic, no speech, no drums |
| heal | 1.46 | heal/v1 | Healing spell sparkle: a soft gentle rising shimmer of glittering chimes and warm magical twinkles, fantasy RPG cure spell, calm and clean, no voices, no music |
| shield_up | 1.18 | shield_up/v4 | Energy shield activation: a magical force-field barrier powering up with a resonant whoomp hum that expands outward, fantasy RPG, clean, no voices, no music |
| shield_block | 1.00 | shield_block/v1 | Shield blocking a huge attack: a loud metallic clang against a magic barrier followed by a quick energy shockwave wobble, fantasy RPG, clean, no voices, no music |
| boss_charge | 2.00 | boss_charge/v3 | Boss gathering power: a menacing low monstrous growl rumbling under a rising surge of dark energy collecting, fantasy RPG boss, no speech, no music |
| paper_storm | 2.32 | paper_storm/v2 | Paper storm: a howling gust of wind blowing hundreds of paper sheets flying and flapping fast past the listener, rustling whirlwind, no voices, no music |
| buff | 1.48 | buff/v3 | Party power-up buff: a bright rising arpeggio of magical energy tones climbing upward with a sparkling finish, fantasy RPG status boost, clean, no voices, no music |
| explosion | 1.48 | explosion/v2 | Medium explosion: a punchy fiery explosion boom with a short debris crackle tail, fantasy RPG battle, clean, no voices, no music |
| explosion_alt | 1.48 | explosion/v3 | Medium explosion: a punchy fiery explosion boom with a short debris crackle tail, fantasy RPG battle, clean, no voices, no music |
| explosion_big | 3.48 | explosion_big/v1 | Massive finishing explosion: an enormous cinematic blast with a deep sub-bass boom, then rolling rumbling aftershocks and falling debris, fantasy RPG ultimate attack, no voices, no music |
| break | 1.00 | break/v4 | Guard break: a magical glass shield shattering into pieces with a sharp crystal crash and tinkling shards, fantasy RPG, clean, no voices, no music |
| defeat | 1.19 | defeat/v3 | Enemy defeated vanishing: a descending magical dissolve sound, pitch falling down as the monster fades into sparkles and dust, fantasy RPG, clean, no voices, no music |
| boss_down | 3.00 | boss_down/v2 | Giant boss collapsing: a huge heavy body crashing down onto the ground with a deep thud, then crumbling rubble and a magical disintegration, fantasy RPG, no voices, no music |
| fanfare | 5.00 | fanfare/v4 | Victory fanfare: a short triumphant orchestral brass fanfare phrase with trumpets, timpani and cymbal, bright heroic fantasy RPG battle win jingle, ending on a held major chord |
| card | 0.79 | card/v2 | Character card slide-in: a quick light swoosh followed by a tiny bright bell ding, clean game UI transition, no voices, no music |
| stat | 0.20 | stat/v3 | Stat number pop: a single very short soft tick tap, crisp digital UI counter sound, dry, no voices, no music |

備註：
- `cursor` 用重生的 cursor2（第一版四個都太小聲）；`dark_charge` 用重生的 dark_charge2（第一版是先大後小，不是越來越強）。
- `slash_multi` 只有 3 刀；重生的 slash_multi2 四版都只剩 1 刀，所以留原版。要更多刀可以疊 slash／slash_alt。
- `hit` 生成時長度跑成自動（1 秒），已裁成 0.4 秒。
- `whoosh.wav` 是主 session 的檔，不是這次做的。

## 人聲 `vo/`（Eleven v4，穩定度 35%、相似度 75%，每句一次出兩版 → `_1`、`_2`）

全部是聲音庫現成的台灣口音聲音，沒有複製或建立任何聲音。台詞一字未改，只在前面加語氣標記。處理：頭尾靜音裁掉、峰值 -1 dBFS，mp3 192k。

| 檔名 | 長度 _1 / _2 (s) | 聲音 | 送出的文字 |
|---|---|---|---|
| kui | 1.67 / 1.66 | Yu-Ting - Sweet and Bubbly | [excited, shouting] 吐槽——一閃！ |
| jie | 2.45 / 2.45 | Neil Chuang - Deep, Trustworthy and Rich | [low, weary] 深淵…… [shouting, intense] 死線！ |
| kevin | 2.88 / 2.95 | Roy - Taiwanese Youth | [confident, smug] 這個—— [shouting, cocky] 用 AI 擋就好了！ |
| mi | 2.84 / 2.82 | Jessica - Calm & Friendly | [calm, deadpan, polite customer service voice] 聖光專線，很高興為您服務！ |
| vivi | 2.47 / 2.49 | Hsin-Yi - Chic and Confident | [proud, commanding] 全員—— [shouting, triumphant] 準時下班！ |
| boss_intro | 1.67 / 1.66 | Jerry Lin - Deep, Calm & Authoritative | [angry, arrogant, gravelly, shouting] 我要找你們主管！ |
| boss_attack | 1.05 / 1.14 | Jerry Lin - Deep, Calm & Authoritative | [furious, shouting] 再改一版！ |
| boss_down | 3.06 / 2.41 | Jerry Lin - Deep, Calm & Authoritative | [weak, groaning, defeated] 我……要客訴…… |

- 哪一版比較好：沒辦法用聽的判斷，兩版都留，請混音時用耳朵挑。
- 多音字：這 8 句沒有「敕令」；「準時」「為您服務」「一閃」照一般讀法，沒有改寫。仍請聽一下有沒有唸錯或把方括號標記唸出來。

## 配樂（已取消）

使用者要求不要用 ElevenLabs 生配樂（之後用 Suno 自己生）。這個通知到之前已經生成了兩首（Music v2.5、純音樂、各 1 版：battle 70 秒 1,050 點、victory 35 秒 525 點），已從 `audio/bgm/` 移除，沒有再重生；原檔另存在 `audio/bgm_elevenlabs/battle.mp3`、`victory.mp3`（混音不會讀到），要不要用由使用者決定。`audio/bgm/` 裡的 battle.wav、victory.wav 不是這次做的。

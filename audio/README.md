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
| foe_courier | 0.80 | foe_courier/v4 | a short frantic alarm clock ring cut off by a sharp paper slap, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| foe_knight | 0.79 | foe_knight/v4 | a heavy metal filing cabinet drawer slamming shut with a clanging stamp thud, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| foe_intern | 0.89 | foe_intern/v1 | a bottle cap popping off, fizzy soda hiss and a quick gulp-like bubbling, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| foe_audit | 0.95 | foe_audit/v4 | a fast fountain pen scratch across paper ending in a hard rubber stamp thunk with a dark magical sting, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| squeak_1 | 0.44 | squeak_1/v2 | a cartoon mouse giving one short fierce high-pitched angry squeak as it attacks, fantasy RPG combat sound effect, punchy and clean, no music |
| squeak_2 | 0.66 | squeak_2/v3 | a cartoon rat with a quick aggressive hiss followed by a sharp double chitter squeak, fierce rodent attack cry, fantasy RPG combat sound effect, punchy and clean, no music |
| shout_m_1 | 0.42 | 文字轉語音 AMeng - Young Taiwanese male，第 1 版第一聲 | [shouting, short powerful martial arts battle cry] 賀！ |
| shout_m_2 | 0.60 | 文字轉語音 AMeng - Young Taiwanese male，第 1 版第一聲 | [shouting, short powerful martial arts battle cry] 哈！ |
| shout_f_1 | 0.50 | 文字轉語音 Lucy - Friendly Taiwanese Youth，第 1 版 | [shouting, short powerful martial arts battle cry] 賀！ |
| shout_f_2 | 0.49 | 文字轉語音 Lucy - Friendly Taiwanese Youth，第 2 版第一聲 | [shouting, short powerful martial arts battle cry] 哈！ |

備註：
- `cursor` 用重生的 cursor2（第一版四個都太小聲）；`dark_charge` 用重生的 dark_charge2（第一版是先大後小，不是越來越強）。
- `slash_multi` 只有 3 刀；重生的 slash_multi2 四版都只剩 1 刀，所以留原版。要更多刀可以疊 slash／slash_alt。
- `hit` 生成時長度跑成自動（1 秒），已裁成 0.4 秒。
- `whoosh.wav` 是主 session 的檔，不是這次做的。
- 11/20 追加 10 檔（敵人出招 4、老鼠吱吱 2、共用喊聲 4）。喊聲用文字轉語音 Eleven v4，挑了兩個聲音庫現成、沒給主角用過的台灣年輕男女聲；原檔多半連喊兩聲，只留第一聲。`foe_courier` 四版從頻譜看都只有很短的一下拍擊，看不到鬧鐘鈴聲，要人耳確認；從波形看 `squeak_1` 是單聲尖叫、`squeak_2` 是連續吱吱，還沒人耳確認。原清單的夥伴專屬音效改成不做，但改單前已生好 hero_yan、hero_heilun 兩組（花 20 點），沒放進 sfx/，留在暫存區。點數 4,735 → 4,492（243 點：音效 84、喊聲 159）。

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

## 普攻發力聲／短台詞（2026-11-19 追加，20 檔，vo/atk_*.mp3）

ElevenLabs 文字轉語音 Eleven v4，聲音同上面喊招（小葵 Yu-Ting、Kevin Roy、阿傑 Neil Chuang、小米 Jessica、Vivi Hsin-Yi）。每句生一次（網站一次給兩版，挑一版），沒重生。_1、_2 是發力聲（裁成 0.5 秒內，只留第一聲），_3、_4 是短台詞；Vivi 四句是應援。處理：頭尾靜音裁掉、峰值 -1 dB、192k mp3。清單在 `vo/attack.json`。點數 5,521 → 4,877（644 點）。

| 檔 | 秒 | 送出的文字 |
|---|---|---|
| atk_kui_1 | 0.45 | [energetic battle cry, short sharp shout] 喝！ |
| atk_kui_2 | 0.47 | [energetic battle cry, short sharp shout] 哈！ |
| atk_kui_3 | 0.71 | [excited, shouting] 看招！ |
| atk_kui_4 | 1.93 | [exasperated, shouting, teasing] 這樣不行吧！ |
| atk_kevin_1 | 0.46 | [confident, short grunt, shouting] 喝！ |
| atk_kevin_2 | 0.39 | [cocky, short shout] 嘿！ |
| atk_kevin_3 | 0.98 | [confident, smug] 交給我！ |
| atk_kevin_4 | 1.49 | [cocky, relaxed] 輕鬆啦！（第 2 版） |
| atk_jie_1 | 0.49 | [low, weary, dismissive] 哼。 |
| atk_jie_2 | 0.50 | [low, short heavy grunt, shouting] 喝！ |
| atk_jie_3 | 1.08 | [low, weary, bored] 隨便啦。（第 2 版） |
| atk_jie_4 | 1.25 | [low, weary, impatient] 快點結束。 |
| atk_mi_1 | 0.50 | [calm, short light shout] 嘿！ |
| atk_mi_2 | 0.50 | [calm, short light shout] 哈！ |
| atk_mi_3 | 0.97 | [firm, sharp, curt, calm customer service voice, falling tone] 恕不受理！（11/20 重做） |
| atk_mi_4 | 1.49 | [firm, sharp, decisive, calm customer service voice, falling tone] 這通，我掛了！（11/20 重做） |
| atk_vivi_1 | 0.93 | [bright, cheering, energetic] 加油！ |
| atk_vivi_2 | 1.21 | [bright, confident, cheering] 你們可以的！ |
| atk_vivi_3 | 0.63 | [commanding, shouting] 上吧！ |
| atk_vivi_4 | 1.06 | [bright, commanding, confident] 交給你們了！ |

要人耳確認：發力聲原檔多半喊了兩三聲，只留第一聲；阿傑 1、3、4 原音很小聲（拉高 15～22 dB，可能偏氣音或有底噪）；Vivi「上吧」原檔有兩段，只留第一段 0.63 秒，要聽是不是完整的「上吧」。

11/20 小米兩句短台詞重做（使用者嫌不像攻擊）：生成一次兩版、挑第一版；「恕不受理」原檔連說兩遍，只留第一遍。點數 4,877 → 4,735（142 點）。

## 11/21 追加 16 檔（今晚新內容：弱點、護盾、鎖、合體技、狀態、台灣篇頭目機制、新敵人）

一樣是 Sound Effects v3、影響度 30%、每次 4 版；處理照上面（開頭靜音裁掉、聲音結束就切、不超過指定長度、結尾 30 ms 淡出、峰值 -1 dBFS、192k mp3）。實際長度多半比指定的短，因為後面是空白。我聽不到，版本是看波形和頻譜挑的，**請用耳朵確認**。點數 4,439 → 4,249（190 點：16 個各一次 170 點，rage、foe_auntie 重生一次 20 點）。

| 檔名 | 長度(s) | 用的版本 | 提示詞 |
|---|---|---|---|
| weak | 0.37 | weak/v1 | Critical weak point hit: a bright crisp high metallic ding instantly followed by one solid heavy punchy impact, satisfying and powerful, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| ward | 0.67 | ward/v2 | Quick magical ward barrier forming: a soft bright shimmering energy hum that briefly swells open, light and airy, fantasy RPG shield spell, clean, no voices, no music |
| lock_break | 0.40 | lock_break/v2 | A small metal padlock snapping open and breaking: one sharp metallic clack crack, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| lock_all | 0.87 | lock_all/v1 | A huge heavy iron padlock shattering apart with a loud metallic crack, then bright glass-like shards scattering and tinkling to a clean finish, fantasy RPG, no voices, no music |
| unite | 0.97 | unite/v1 | Combo attack start: two quick sharp sword unsheathing shings in a row, then a fast rising surge of magical energy building upward, anime fantasy RPG, clean, no voices, no music |
| poison | 0.45 | poison/v3 | Thick sticky toxic liquid bubbling and gurgling, short gloopy poison bubbles popping, fantasy RPG status effect sound, clean, no voices, no music |
| stun | 0.34 | stun/v2 | Cartoon stun: one comical hollow bonk on the head followed by a short twinkling warble of little stars circling, game sound effect, clean, no voices, no music |
| coin | 0.42 | coin/v3 | Old mechanical cash register cha-ching: a short bright bell ring with a drawer clunk, game shop purchase sound, clean, no voices, no music |
| train | 0.80 | train/v2 | Skill level up sound effect: a short quick rising whoosh ending in a bright sparkling chime burst, game upgrade sound, not a melody, clean, no voices, no music |
| wok_back | 0.86 | wok_back/v4 | A large iron wok struck hard with a loud metallic clang, then a springy boing as it bounces back, comedic fantasy RPG combat sound, clean, no voices, no music |
| sign_off | 0.76 | sign_off/v2 | Neon sign shorting out: crackling electric buzzing and sizzling sparks, then a sudden power cut thunk into silence, clean, no voices, no music |
| layer_down | 0.75 | layer_down/v1 | Corrugated sheet metal roofing panels falling down and crashing with a loud rattling clang, fantasy RPG combat sound effect, punchy and clean, no voices, no music |
| foe_auntie | 0.39 | 拼接：foe_auntie2/v1 ＋ v3（各取一下，間隔 0.14 秒） | two fast separate feather duster whacks on cloth, whap whap, clearly two distinct hits, comedic game combat sound effect, clean, no voices, no music |
| foe_smoker | 0.72 | foe_smoker/v2 | an old man giving one dry raspy cough followed by a breathy puff of exhaled smoke, no words, no speech, fantasy RPG combat sound effect, clean, no music |
| rage | 0.93 | 拼接：rage2/v3 前 0.62 秒（兩下心跳）＋ affix/v4 前 0.38 秒（警示音，壓低 5 dB，0.55 秒進） | 心跳：Two deep low bass heartbeat thumps, the second one coming quicker, followed immediately by one short sharp alarm siren whoop, tense danger warning game sound effect, clean, no voices, no music；警示音同 affix |
| affix | 0.38 | affix/v1 | Short elite enemy warning alert: a quick sharp two-tone warning beep sting, game UI alert sound, clean, no voices, no music |

備註：
- **拼接的兩個**：foe_auntie 第一次（a feather duster swatting fast twice…）和重生（上表提示詞）的 8 版都只有一下拍打，所以拿重生的兩版各一下接成兩下。rage 第一次（Danger warning: two low deep heartbeats…）和重生的 8 版都沒有警報聲，重生的 v3 心跳是清楚的兩下，就接上 affix 沒用到的 v4 單音當警報。
- 頻譜看不太出來、最要人耳確認的：wok_back 有沒有「彈簧」感、stun 有沒有星星顫音（看起來是「咚」加一小段高音尾巴）、coin 像不像收銀機、unite 前面是不是兩聲出鞘。
- sign_off 原音很小聲（峰值 -38 dB，拉高約 37 dB），底噪可能聽得到。
- 原檔和沒選的版本在我的暫存區 raw_s3/，沒放進 audio/。

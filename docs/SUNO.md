# 配樂：需要的曲子與 Suno 提示詞（2026-11-21 更新，v0.45.0）

使用者 11/21 要「列出我們需要的音樂跟 suno 提示詞」。配樂一律由使用者用 Suno 生，ElevenLabs 不生配樂。

## 一、現在遊戲裡有什麼

| 檔名 | 用在哪 | 現況 |
|---|---|---|
| `map.mp3` | 標題畫面、行程表、選強化、福利社、事件 | **暫代**：程式合成的 31 秒循環，很單調 |
| `battle.mp3` | 一般戰鬥、菁英、中頭目 | 使用者的〈月底吃土〉純音樂版 |
| `boss.mp3` | 每條路線最後一站的魔王 | 使用者的〈幽靈舞步〉純音樂版 |
| `victory.mp3` | 通關 | ElevenLabs 當初生的那首（之後不再用 ElevenLabs 生配樂，要換掉） |

台灣篇、地獄分公司、鏡像內戰目前都沿用這四首。

## 二、主線還缺的七首（照優先順序）

共同要求：純音樂（Suno 勾 Instrumental）、不要人聲、頭尾接得起來可以循環、1 分半到 2 分半（號角類的短曲另外寫）。提示詞貼在 Style of Music 欄位。

| 順位 | 檔名 | 什麼時候播 | 為什麼要 |
|---|---|---|---|
| 1 | `map.mp3` | 行程表、選強化 | 玩家停最久的畫面，現在是暫代的 |
| 2 | `title.mp3` | 標題畫面、選路線選主角 | 第一印象；現在跟行程表共用 |
| 3 | `elite.mp3` | 菁英戰、中頭目（甩鍋課長那一站） | 現在跟小兵戰同一首，沒有「這場比較硬」的感覺 |
| 4 | `victory.mp3` | 通關的結案報告 | 換掉 ElevenLabs 那首 |
| 5 | `gameover.mp3` | 打輸的結案報告 | 現在是沒有音樂 |
| 6 | `rest.mp3` | 茶水間、福利社、事件、開場對話 | 現在跟行程表共用，喘口氣的地方沒有區別 |
| 7 | `super.mp3` | 超級化的三回合（二週目起） | 變身後換一首更熱血的，時間到切回原曲；可有可無 |

`title`、`elite`、`gameover`、`rest`、`super` 這五個是新的位置，程式還沒接；檔案到了再接（`map`、`victory` 直接覆蓋就會用）。

**1. map　行程表（辦公室大樓）**
```
instrumental, 16-bit JRPG world map theme, cozy office adventure, walking tempo 100 BPM, pizzicato strings and marimba lead with soft SNES-style synth pads, light brushed drums, typewriter clicks and a small desk bell as percussion accents, warm, hopeful, a little mischievous, memorable simple melody, seamless loop
```

**2. title　標題畫面**
```
instrumental, JRPG title screen theme, heroic but humble, 88 BPM, solo piano intro joined by warm strings, french horn and glockenspiel, 16-bit synth harp arpeggios, feeling of an ordinary office worker setting out on a grand journey at sunrise, bittersweet and uplifting, gentle build, seamless loop
```

**3. elite　菁英戰、中頭目**
```
instrumental, JRPG mid-boss battle theme, 158 BPM, tense and urgent, staccato strings and brass stabs over driving chiptune bass and tight rock drums, ticking clock hi-hats, minor key with a defiant major-key chorus, rubber-stamp-like percussion hits, catchy lead synth melody, seamless loop
```

**4. victory　通關的結案報告**
```
instrumental, JRPG ending results theme, triumphant and relieved, 110 BPM, bright brass fanfare opening that settles into a warm relaxed groove with piano, strings and light funk bass, hand claps, feeling of finally clocking out on Friday evening, joyful, seamless loop
```

**5. gameover　打輸的結案報告**
```
instrumental, JRPG game over theme, short and gentle, 70 BPM, lonely music box and soft piano with low warm strings, tired but not hopeless, a small hopeful rising phrase at the end as if saying try again tomorrow, sparse, seamless loop, about one minute
```

**6. rest　茶水間、福利社、事件**
```
instrumental, JRPG shop and inn theme, cozy office break room, laid-back 92 BPM, bossa nova nylon guitar and electric piano with soft upright bass and brushed drums, clarinet melody, coffee-cup and spoon clinks as light percussion, relaxed, friendly, slightly jazzy, seamless loop
```

**7. super　超級化**
```
instrumental, shonen anime power-up battle theme, 172 BPM, blazing electric guitar lead with soaring brass and choir-like synth pads without words, double-kick drums, rising key change, unstoppable heroic energy, 16-bit synth arpeggios layered on top, punchy and bright, seamless loop
```

## 三、三條支線各自的配樂（已經可以直接放，程式接好了）

**tw_map　台灣篇行程表**
```
instrumental, 16-bit JRPG town theme, Taiwanese night market mood, plucked yueqin and bamboo flute lead over SNES-style synth pads, light temple percussion and small gongs, relaxed 96 BPM, warm, slightly comedic, seamless loop
```

**tw_battle　台灣篇一般戰鬥**
```
instrumental, 16-bit JRPG battle theme, fast 150 BPM, suona and erhu melody over driving chiptune bass and rock drums, firecracker-like percussion hits, energetic and cheeky, temple fair parade energy, seamless loop
```

**tw_boss　台灣篇魔王（颱風天、頂樓加蓋）**
```
instrumental, epic JRPG boss theme, 165 BPM, typhoon storm atmosphere, heavy taiko and metal sheet clangs, distorted guitar with suona lead, tense rising brass, 16-bit synth arpeggios, dramatic key change in the middle, seamless loop
```

**hell_map　地獄分公司行程表**
```
instrumental, 16-bit JRPG dungeon theme, eerie underground office, slow 80 BPM, detuned music box and low organ, distant printer and clock ticking as percussion, dark but slightly humorous, sparse, seamless loop
```

**hell_battle　地獄分公司一般戰鬥**
```
instrumental, dark JRPG battle theme, 145 BPM, harpsichord and pipe organ riffs over chiptune bass and tight drums, minor key, relentless overtime feeling, punchy and catchy, seamless loop
```

**hell_boss　地獄分公司魔王（永續加班總監）**
```
instrumental, final boss JRPG theme, 170 BPM, pipe organ and choir-like synth pads without words, double-kick drums, heavy guitar, ticking clock motif, oppressive and grand, short heroic counter-melody near the end, seamless loop
```

**mirror_battle　鏡像內戰（跟自己打）**
```
instrumental, JRPG rival battle theme, 155 BPM, main melody answered by its own mirrored inversion, glassy bell synths and reversed cymbals, electric piano and tight drums, cool and tense, seamless loop
```

**mirror_boss　鏡像 Vivi**
```
instrumental, regal JRPG boss theme, 160 BPM, harpsichord and strings with glassy mirror-like synth echoes, royal fanfare motif turning dark, driving drums, elegant but menacing, seamless loop
```



## 四、交件方式

生好之後把檔案丟給我（或直接放進 `audio/bgm/`，檔名照上面的表），我來接程式、調音量、用 `tools/loopbgm.py` 處理循環點。一首歌 Suno 通常會出兩版，兩版都給我也可以，我先放一版、另一版留著讓你換。

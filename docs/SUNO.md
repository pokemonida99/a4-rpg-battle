# 配樂：給 Suno 的提示詞（2026-11-21）

遊戲現在只有四首：行程表 `map`、一般戰鬥 `battle`（〈月底吃土〉）、魔王 `boss`（〈幽靈舞步〉）、通關 `victory`。台灣篇、地獄分公司、鏡像內戰都沿用這四首。

程式已經支援「每張地圖自己的配樂」（v0.27 之後）：把 mp3 放進 `audio/bgm/`，檔名照下面的規則，再把檔名（不含 .mp3）加進 `js/game.js` 的 `BGM_EXTRA` 陣列就會用；沒放的就用原本的。

| 檔名 | 什麼時候播 |
|---|---|
| `tw_map.mp3` | 台灣篇的行程表、選強化 |
| `tw_battle.mp3` | 台灣篇一般戰鬥 |
| `tw_boss.mp3` | 台灣篇最後一站（鐵皮增建處長） |
| `hell_map.mp3`／`hell_battle.mp3`／`hell_boss.mp3` | 地獄分公司 |
| `mirror_map.mp3`／`mirror_battle.mp3`／`mirror_boss.mp3` | 鏡像內戰 |

要求：純音樂（Instrumental）、可以循環（頭尾接得起來）、1 分半到 2 分半、不要人聲。行程表的曲子音量會自動降到七成五。

## 提示詞（Style of Music 欄位，直接貼）

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

生好之後把檔案丟給我（或直接放進 `audio/bgm/`），我來接、調音量、確認循環點。

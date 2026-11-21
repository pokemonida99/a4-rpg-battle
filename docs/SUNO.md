# 配樂：需要的曲子與 Suno 提示詞（2026-11-21 第二版，v0.45.1）

配樂一律由使用者用 Suno 生，ElevenLabs 不生配樂。

## 〇、風格基準（最重要）

使用者 11/21：「音樂風格不要差別太大」，並給了戰鬥曲用的提示詞。**整套配樂都照這個家族寫：真的管弦樂團、獨奏小提琴唱主旋律、不用合成器、不用晶片音色、沒有人聲和合唱。** 第一版我寫成 16-bit 晶片風、放克、波薩諾瓦，跟戰鬥曲差太多，已全部重寫。

戰鬥曲的提示詞（使用者提供，當範本）：
```
Orchestral Jrpg Battle Theme, Live Symphonic Orchestra, 160 Bpm, E Minor. A Passionate Solo Violin Carries A Fast, Singable Main Melody Over Driving Staccato Strings And Galloping Snare Drum. Bold French Horn And Trumpet Countermelody, Rapid Piano Runs, Harp Glissandos, Timpani Hits On The Accents. Heroic And Adventurous, A Little Playful. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, Contrasting B Section With Woodwinds, Then A Triumphant Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

每一首共用的東西：
- 開頭 `Orchestral Jrpg … Theme, Live Symphonic Orchestra`，結尾 `Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.`
- 獨奏小提琴當「主角的聲音」，每首都出現；配器只從同一個樂團裡挑（弦樂、法國號、小號、木管、鋼琴、豎琴、定音鼓、小鼓）。
- 調性繞著 E 小調：行程表 G 大調（關係大調）、通關 E 大調、打輸 E 小調、茶水間 C 大調、超級化 E 小調往上轉。
- 支線可以加當地的真樂器當色彩（二胡、嗩吶、月琴、管風琴、大鍵琴），底還是同一個樂團。
- 都勾 Instrumental。Suno 不保證頭尾接得起來，循環點我用 `tools/loopbgm.py` 處理。

## 一、現在遊戲裡有什麼

| 檔名 | 用在哪 | 現況 |
|---|---|---|
| `map.mp3` | 標題畫面、行程表、選強化、福利社、事件 | **暫代**：程式合成的 31 秒循環 |
| `battle.mp3` | 一般戰鬥 | 使用者的歌 |
| `elite.mp3` | 菁英戰、中頭目 | 使用者 11/21 給的，v0.45.1 接上 |
| `boss.mp3` | 每條路線最後一站的魔王 | 使用者的歌 |
| `victory.mp3` | 通關 | ElevenLabs 當初生的那首，要換掉 |

## 二、主線還缺的六首（照優先順序）

| 順位 | 檔名 | 什麼時候播 |
|---|---|---|
| 1 | `map.mp3` | 行程表、選強化（玩家停最久，現在是暫代的） |
| 2 | `title.mp3` | 標題畫面、選路線選主角 |
| 3 | `victory.mp3` | 通關的結案報告 |
| 4 | `gameover.mp3` | 打輸的結案報告（現在沒有音樂） |
| 5 | `rest.mp3` | 茶水間、福利社、事件、開場對話 |
| 6 | `super.mp3` | 超級化的三回合（可有可無） |

`map`、`victory` 放進去就會用；`title`、`gameover`、`rest`、`super` 是新的位置，檔案到了再接。

**map　行程表、選強化**
```
Orchestral Jrpg World Map Theme, Live Symphonic Orchestra, 104 Bpm, G Major. A Warm Solo Violin Carries A Strolling, Singable Melody Over Pizzicato Strings And Light Brushed Snare. Clarinet And Flute Answer The Violin, Gentle French Horn Harmonies, Harp Arpeggios, Glockenspiel Sparkles, Soft Timpani On The Phrase Endings. Hopeful And Curious, A Little Playful, Like Setting Out On A Small Adventure. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, Contrasting B Section With Woodwinds And Pizzicato Only, Then A Fuller Return With Horns. The Last Phrase Stays Open So It Loops Back To The Start. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**title　標題畫面、選路線選主角**
```
Orchestral Jrpg Title Theme, Live Symphonic Orchestra, 84 Bpm, E Minor Rising To G Major. A Solo Violin States A Slow, Noble, Singable Melody Over Sustained Strings And Harp, Then French Horns Take It Up With The Full String Section. Piano Arpeggios, Oboe Countermelody, Timpani Roll Into The Climax, Trumpets Join For One Broad Statement. Bittersweet And Uplifting, Grand But Humble, An Ordinary Person Setting Out At Sunrise. The Melody Starts In The First Bar. Quiet A Section, Growing B Section, Full Orchestra Return, Then It Settles Back To Solo Violin And Harp So It Loops. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**victory　通關的結案報告**
```
Orchestral Jrpg Victory And Results Theme, Live Symphonic Orchestra, 116 Bpm, E Major. A Bright Trumpet And French Horn Fanfare In The First Two Bars, Then A Solo Violin Sings A Relaxed, Joyful, Singable Melody Over Bouncing Pizzicato Strings, Light Snare And Tambourine. Flute And Clarinet Runs, Harp Glissandos, Piano Chords, Timpani On The Accents. Triumphant And Relieved, A Little Playful, Like Finally Going Home After A Long Week. Clear A Section, Gentle B Section With Woodwinds, Then A Warm Return With Full Brass. Loops Smoothly After The Fanfare. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**gameover　打輸的結案報告**
```
Orchestral Jrpg Game Over Theme, Small Section Of A Live Symphonic Orchestra, 66 Bpm, E Minor. A Solo Violin Plays A Slow, Tender, Singable Melody Over Soft Harp And Low Sustained Strings. A Solo Oboe Answers, Quiet French Horn, A Few Piano Notes, No Drums. Tired But Not Hopeless. The Last Phrase Lifts Gently To G Major, As If Saying Try Again Tomorrow. About One Minute, Ends Softly So It Can Loop. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**rest　茶水間、福利社、事件、開場對話**
```
Orchestral Jrpg Inn And Shop Theme, Chamber Group From A Live Symphonic Orchestra, 92 Bpm, C Major. Clarinet And Solo Violin Trade A Cozy, Lilting, Singable Melody Over Pizzicato Cello And Double Bass. Harp, Soft Piano Chords, Light Woodblock And Triangle, A Warm French Horn In The Second Half. Relaxed And Friendly, A Little Playful, A Coffee Break Between Battles. The Melody Starts In The First Bar. Clear A Section, B Section With Flute And Bassoon, Then The A Section Returns. Loops Smoothly. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**super　超級化的三回合**
```
Orchestral Jrpg Power-Up Battle Theme, Live Symphonic Orchestra, 176 Bpm, E Minor Modulating Up To F-Sharp Minor. A Blazing Solo Violin Plays A Fast, Virtuosic, Singable Melody In A High Register, Doubled By Trumpets. Racing Staccato String Ostinato, Galloping Snare Drum, Crash Cymbals, Bold French Horn Fanfares, Piano Octaves, Harp Glissandos, Timpani Hits On Every Accent. Unstoppable, Heroic, Triumphant. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, Short B Section With Low Brass And Timpani, Then A Triumphant Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

## 三、三條支線各自的配樂（選配，程式已接好）

沒放的話沿用主線的曲子。檔名照下面寫，放進 `audio/bgm/`，再把檔名加進 `js/game.js` 的 `BGM_EXTRA`。

**tw_map　台灣篇的行程表**
```
Orchestral Jrpg Town Theme With Taiwanese Folk Color, Live Symphonic Orchestra, 98 Bpm, G Major Pentatonic. A Bamboo Flute And A Solo Violin Share A Strolling, Singable Melody Over Plucked Yueqin And Pizzicato Strings. Small Hand Gongs And Woodblock, Harp, Clarinet Countermelody, Soft French Horns. Warm, Lively, A Little Comedic, An Evening Night Market. The Melody Starts In The First Bar. Clear A Section, B Section With Yueqin And Woodwinds Only, Then A Fuller Return. Loops Smoothly. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**tw_battle　台灣篇一般戰鬥**
```
Orchestral Jrpg Battle Theme With Taiwanese Temple Fair Color, Live Symphonic Orchestra, 160 Bpm, E Minor Pentatonic. A Passionate Solo Violin And An Erhu Trade A Fast, Singable Melody Over Driving Staccato Strings And Galloping Snare Drum. Suona Calls, Temple Gongs And Cymbals On The Accents, Bold French Horns And Trumpets, Rapid Piano Runs, Timpani. Energetic And Cheeky, A Parade In Full Swing. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, B Section With Woodwinds And Erhu, Then A Triumphant Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**tw_boss　台灣篇魔王（颱風天、鐵皮增建處長）**
```
Orchestral Jrpg Boss Theme, Typhoon Night, Live Symphonic Orchestra, 168 Bpm, D Minor. Low Brass And Pounding Bass Drums Open With A Heavy Riff, Then A Fierce Solo Violin And Suona Carry A Fast, Singable Melody Over Storming String Runs. Anvil And Metal Sheet Percussion, Temple Gongs, Timpani Rolls, Snarling French Horns, Piano In The Low Register. Tense And Dramatic With A Stubborn Heroic Streak. No Slow Intro. Clear A Section, Ominous B Section With Low Woodwinds, Then A Furious Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**hell_map　地獄分公司的行程表**
```
Orchestral Jrpg Dungeon Theme, Live Symphonic Orchestra, 78 Bpm, C Minor. A Solo Violin Plays A Slow, Creeping, Singable Melody Over Celesta And Low Pizzicato Strings. Bass Clarinet And Bassoon, A Soft Pipe Organ Drone, Woodblock Ticking Like A Wall Clock, Distant Tubular Bell. Eerie But Slightly Humorous, An Endless Basement Office. The Melody Starts In The First Bar. Sparse A Section, B Section With Muted Brass, Then The A Section Returns. Loops Smoothly. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**hell_battle　地獄分公司一般戰鬥**
```
Orchestral Jrpg Battle Theme, Gothic Color, Live Symphonic Orchestra, 152 Bpm, D Minor. A Frantic Solo Violin Carries A Fast, Singable Melody Over Driving Staccato Strings, Harpsichord Riffs And Galloping Snare Drum. Pipe Organ Chords, Bold French Horn And Trumpet Countermelody, Rapid Piano Runs, Timpani Hits, Woodblock Ticking. Relentless But Catchy, Overtime That Never Ends. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, B Section With Low Woodwinds And Harpsichord, Then A Defiant Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**hell_boss　地獄分公司魔王（永續加班總監）**
```
Orchestral Jrpg Final Boss Theme, Live Symphonic Orchestra With Pipe Organ, 172 Bpm, C Minor. Full Pipe Organ And Low Brass Open With A Crushing Riff, Then A Desperate Solo Violin Carries A Fast, Singable Melody Over Racing Strings And Double-Time Snare. Tubular Bells Toll, Woodblock Clock Motif, Timpani Rolls, Trumpet Fanfares, Piano Octaves, Harp Glissandos. Oppressive And Grand. No Slow Intro. Clear A Section, Dark B Section With Organ Alone, Then A Heroic Return Where The Violin Melody Turns Major For A Few Bars Before The Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**mirror_battle　鏡像內戰（跟自己打）**
```
Orchestral Jrpg Rival Battle Theme, Live Symphonic Orchestra, 156 Bpm, E Minor. Two Solo Violins Duel: The First Plays A Fast, Singable Melody And The Second Answers With The Same Melody Turned Upside Down. Driving Staccato Strings, Galloping Snare, Celesta And Vibraphone Glints, Harp Glissandos, French Horn Countermelody, Timpani On The Accents. Cool And Tense, Fighting Your Own Reflection. The Melody Starts In The First Bar, No Slow Intro. Clear A Section, B Section Where The Two Violins Play In Canon, Then A Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

**mirror_boss　鏡像 Vivi**
```
Orchestral Jrpg Boss Theme, Regal And Dangerous, Live Symphonic Orchestra, 162 Bpm, B Minor. A Royal Trumpet Fanfare Opens And Immediately Turns Dark, Then A Solo Violin And A Solo Cello Trade A Fast, Elegant, Singable Melody Over Harpsichord And Driving Strings. Galloping Snare, Celesta Echoes, Bold French Horns, Timpani, Harp Glissandos. Proud, Elegant, Menacing. No Slow Intro. Clear A Section, B Section As A Twisted Courtly Dance With Woodwinds, Then A Triumphant Return With Full Brass And A Key Change Up. Warm Concert Hall Sound, Real Instruments, No Synths, No Vocals, No Choir. Instrumental.
```

## 四、交件方式

生好之後把檔案丟給我，我來接程式、調音量、處理循環點。Suno 一次出兩版的話兩版都可以給，我先放一版、另一版留著讓你換。

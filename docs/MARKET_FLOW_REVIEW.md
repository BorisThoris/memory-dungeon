# Market flow review (2026-11-14)

Every flow a player meets in the leading premium roguelikes (Balatro, Slay the Spire, Hades, Peglin,
Inscryption, Vampire Survivors, Dicey Dungeons), set against where Memory Dungeon has it. "Leaders"
says what those games commonly do, from their store pages and settings menus; it is a pattern, not
a claim about any one game. Status is one of: **has** (shipped before this review), **added** (filled
in this review, with the commit), **different** (a deliberate choice, with the reason), **owner**
(a decision the owner took, with the date).

## First launch and the menu

| Flow | Leaders | Memory Dungeon | Status |
|---|---|---|---|
| First launch | A short intro or logo, straight to the menu | Startup intro (skippable), then the menu | has |
| Photosensitivity notice | A flashing-light warning on first launch | One-time note with Reduce Motion on the note itself (`FlashingLightsNotice.tsx`) | added, 7db8a11e |
| Graphics for the device | Auto-detected preset on first launch | Tier detected on web and Play since 2026-11-12, on desktop since e00dcae1 (`graphicsTier.ts`) | added, e00dcae1 |
| Continue a run | Mid-run save; Continue on the menu | Run put down on pause, floor change, close or tab switch; Continue with floor and score (`suspendedRun.ts`) | added, 1249b15c |
| New run / mode choice | Pick a character, deck or challenge level | Choose your path: Classic and Pass and Play (only these ship, owner decision) | has |
| Tutorial | A guided first run or a practice mode | Tutorial Hall from the menu, first-run hints on the board | has |

## The run

| Flow | Leaders | Memory Dungeon | Status |
|---|---|---|---|
| Core loop feedback | Juice that climbs with the player's streak | Combo, Fever, room reactions climbing without end | has |
| Pause | Pause menu with resume, settings, abandon | Pause overlay: Resume, Inventory, Settings, Retreat | has |
| Shop | A shop between fights | The store stop every third floor (`STORE_STOP_EVERY_FLOORS`) | has |
| Floor/act transitions | A reward beat between fights | Floor-clear beat, doors before act bosses | has |
| Keyboard shortcuts | Keys for each action, a shortcuts list | Pause, shortcuts list and nine tool keys, list built from the keymap | has; tool keys added af6b50b5 |
| Key rebinding | Common in action games; most card roguelikes keep few, fixed keys | Settings › Controls › Keys: pause, shortcuts list, nine tools; reserved keys refused (`key-bindings.ts`) | added, fea67646 |
| Controller | Full pad support, Steam Deck verified or playable | Pad navigation and the controller gate; Steam Deck viewport in the reachability and fit gates | has |
| Touch | Phone/tablet builds | Web/PWA and the Android TWA | has |
| Run end | Results with stats and a way back | Results screen, the run's best combo replayed, share key | has |

## Meta and progress

| Flow | Leaders | Memory Dungeon | Status |
|---|---|---|---|
| Collection / compendium | Card or relic compendium | Collection, Codex, Inventory | has |
| Profile and stats | Run history and stats | Profile with history and records | has |
| Achievements | Steam achievements | Steam achievements (`src/main/steam.ts`) and in-game honors | has |
| Difficulty ladder | Ascension or heat levels | The Depths | has |
| Daily / seeded runs | Daily challenge, seeded runs | Share keys replay a run's seed; the daily mode was removed | owner: daily removed |
| Leaderboard | Steam or online boards | The world record ("Take the crown") | has |

## Settings

| Flow | Leaders | Memory Dungeon | Status |
|---|---|---|---|
| Audio | Master, music, effects sliders | Master, Music, SFX, Today's Music | has |
| Video | Window mode, scale, quality | Window mode, UI scale, graphics quality, AA | has |
| Screen shake | A toggle or slider | Screen shake slider; Reduce Motion stops it | has |
| Reduce motion | Common in newer releases | Reduce Motion stops movement and room flashing | has |
| Colour-blind support | A mode or symbol-based design | Element symbols on every back, trait colours tested for three deficiencies; said in Settings | has; note added 7db8a11e |
| High contrast | Uncommon in the genre | High Contrast: secondary text at full strength, heavier rules | added, fea67646 |
| Languages | Ten or more languages | English; Chrome's page translation left available, numerals and names protected | owner default, 2026-11-14 |

## Saves, legal and support

| Flow | Leaders | Memory Dungeon | Status |
|---|---|---|---|
| Cloud saves | Steam Cloud | Off; Export/Import under Settings › About moves a profile | owner default, 2026-11-14 |
| Move progress | Through the cloud | Export to a file, import on another device (`saveTransfer.ts`) | added, 7db8a11e |
| Delete progress | A reset in settings | Delete all progress, with a second explicit yes | added, 1249b15c |
| Credits and licences | A credits screen | Credits, AI-assistance note, CC0 sounds, OFL fonts, MIT software | added, 1249b15c |
| Privacy policy | Linked from settings or the store page | Linked from Settings › About, opens in the desktop app too | added, 1249b15c |
| Patch notes | On the store page; in-game varies | Settings › About › What's new, written from the commit log | added, fea67646 |
| Crash reports | Local logs | Crash reports kept locally, named in Settings › About | has |

## Performance on weak devices

A match on a Mali-G57 tablet at Low cost about 15 frames over 70 ms. The cost was the painted room
behind the board at the phone's scale cap; on Low it is now painted at its own size (5ca3493a):
7-12 frames on the live build. A room repainted at half pace measured no gain and was not shipped.
Going lower would take motion out of the room itself, which the owner's art rules forbid.

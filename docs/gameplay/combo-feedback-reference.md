# The combo feedback loop, and the arcade tables it is modelled on

**Status:** living reference for the escalating-feedback system (2026-09-29). Owner's brief: the
side combo meter persists across floors until a miss, and everything gets wilder the higher it
stacks - "think the Chinese 8-ball games". This is what those games do, what this game already
did, and what was built to close the gap. Balance figures live in [BALANCE_NOTES.md](../BALANCE_NOTES.md);
the rendering detail in [epic-board-rendering-assists.md](./epic-board-rendering-assists.md).

## What the reference games do

The mobile pool tables (腾讯桌球 / Tencent Pool, DailyPool 天天台球, Pool King, Billiards City and
the 8 Ball Pool clones that fill Chinese app stores) all run the same escalation loop, and it is
the loop and not any one effect that makes them compulsive:

1. **A streak counter that is the headline.** Consecutive pots are counted in a big number that
   punches on every pot. It is the largest thing on the HUD, bigger than the score.
2. **Ranks with names, stamped across the screen.** Cross a threshold and the whole screen gets a
   word - "Brilliant!", "Excellent!", "On Fire!", "Unstoppable!" - slammed in oversized, held for
   a beat, gone. A sting plays under it and the table shakes. The rank is *reached*, not noticed.
3. **The cue and the ball catch fire.** Past a rank the cue takes a flame trail and the ball a
   comet tail; past the next the pocket erupts. The player's own instrument is what burns, so the
   streak is felt in the hand, not read off a bar.
4. **Everything scales, continuously.** Pot particles, the pocket flash, the shake, the pitch of
   the pot sound, the size and colour of the "+500" - all of it reads the streak, so the
   twentieth pot is visibly and audibly bigger than the tenth. Nothing plateaus.
5. **The loss is loud.** A miss kills the streak with a crash and a screen desaturation, so the
   fear of losing it is what the next shot is played under.
6. **Time bends on the big ones.** The decisive shot slows, the camera pushes in, then it lands.

The design literature says the same thing in fewer words: map every effect off one escalation
tier so the strongest stays rare and keeps meaning something; hit-stop and shake sell weight; juice
echoes the core loop rather than decorating it ([Riot on VFX and clarity](https://www.riotgames.com/en/artedu/visual-effects),
[Juice It or Lose It](https://gdcvault.com/play/1016487/Juice-It-or-Lose), Eiserloh's trauma model
in `boardTrauma.ts`).

## What this game maps them to

| Reference | Memory Dungeon |
| --- | --- |
| Streak counter as the headline | The combo (`stats.currentStreak`) is the big number in the chain column (`RunShell`), bumping on every link, with how much came down the stairs beside it |
| Streak survives the rack | The whole chain ladder crosses floors (`chain-carryover-rules.ts`); a miss is the only end |
| Named ranks stamped on screen | `combo-heat-rules.ts`: warm 3, hot 6, blazing 10, inferno 16, legendary 25. `ScreenCalloutQueue` stamps HOT! / BLAZING! / INFERNO! / LEGENDARY! across the screen on the turn that reaches one - italic on a skew, a sheen swept across the letters, speed lines - with a three-note sting (`playComboStageSfx`) and a shake pulse (`TRAUMA_STAGE_UP`) |
| The bad stamped like the good | The same stamp for a combo of Hot or better lost (COMBO BROKEN ×N), for the bank's last miss (LAST MISS!), and a smaller one for a miss the bank saved (MISS · N left) |
| Prizes stamped in the same currency | A miss banked by five in a row, a pickup claimed with the match, and every store purchase (consumables and relics) get the minor stamp, so what the run hands out reads as part of the combo's feedback and not a separate ledger |
| The cue catches fire | Flames lick up the chain rail; the combo number takes an aura and flickers; from Hot the cards throw embers; lightning through every match and pop forks and thickens |
| Everything scales | Break trauma × (1 + 0.5 × heat); the score floater grows half again and burns in the stage's colour; the room's torches and ring past their Fever levels; a vignette around the whole screen; a sparkle on every match a step up the key per stage |
| The loss is loud | A miss zeroes the combo; COMBO BROKEN is stamped across the screen, the cards gutter (`cardBreakSnuff`), the mismatch sample drops a rung per tier, the ladder reads red as it empties |
| Time bends | The Fever break's hit-stop (`FEVER_WAVE_SLOW`) |

## Rarity, seeds and temperature (round five)

What the leaders do with *rarity* and *variance*, and what was taken from it:

- **Balatro's editions** are cosmetic-plus-mechanical variants rolled per card at 0.3–2%
  (Negative 0.3%, Polychrome 0.3%, Holographic 1.4%, Foil 2%): rare enough that seeing one is
  an event, common enough that a long session sees several. The lesson is the *rate*, not the
  effect.
- **Shiny Pokémon** are the purest case: a palette swap with no mechanical effect, and one of
  the most-hunted things in games. A roguelike can make a shiny cheaply - "palette swapping,
  ridiculous lighting and/or simple animations" - and players will chase it.
- **The pool tables sell the streak's instrument in elements** - Firestorm, Permafrost,
  Lightning cues; an Ice & Fire event with themed tables. The streak looks different depending
  on what you brought, and the elements are the collection.
- **Seeded runs** (Balatro, Spelunky, Slay the Spire) make a variant *shareable*: the same seed
  is the same run for everyone, so a rare one is a thing you can hand to a friend.

Built as **the temper of a run** (`combo-heat-rules.ts`, `comboHeatThemeForSeed`): rolled once
from the run seed, so a shared run has the same temper for everyone.

| Temper | Weight | Stages | What changes |
| --- | --- | --- | --- |
| Ember | 70% | Warm, Hot, Blazing, Inferno, Legendary | The default fire |
| Frost | 18% | Chill, Cold, Frozen, Glacial, Absolute Zero | Icy palette; snow drifts *down* off the cards; the ring turns toward blue |
| Storm | 10% | Charged, Sparking, Storm, Tempest, Godlike | Violet-electric; static sparks fly out of the cards; bolts run white |
| Prismatic | 2% | Shimmer, Gleam, Radiant, Prismatic, Mythic | The shiny: every hue cycling, stamps tagged RARE |

The temper drives the HUD's colours and stage names, the stamps' words and colours, the embers'
colour and motion, the lightning's tint, the room's ring hue and the screen's aura. It changes
nothing a rule reads. The first time a non-ember run warms it stamps itself (FROST RUN), so the
player learns what they drew. Separately, **combo milestones** at 50 and every 100 get their own
stamp (HALF-CENTURY!, CENTURY!) - rare by nature rather than by roll.

## The room itself (round six)

The backdrop was a painting the run lit. Now the run changes the painting, the way the pool
tables freeze over on an ice streak and the shop is a different room (`sceneMood.ts`,
`GameplayScene`):

- **The temper grades the room.** The plate takes a hue/saturation/brightness grade with the
  heat; storm goes violet with white flashes on an irregular beat; prismatic cycles its hue slowly.
- **A frost run freezes, in order, on variables.** Every layer is driven by a scene CSS variable
  the way the light passes are (`--scene-snow`, `--scene-snow-glow`, `--scene-ice`,
  `--scene-ice-cracks`, `--scene-ice-glow`, `--scene-frost`), so the run moves them and nothing
  re-renders. Snow settles first: a mask of the room's upward-facing surfaces
  (`scripts/scene-pipeline/snow_mask.py` derives it from the plate's own downward luminance
  gradient - ledges, torch brackets, the ring's rim, the floor stones) laid over the stone, with a
  blurred plus-lighter copy as its glow. Then a slick pane of ice over the whole screen
  (`IceSheetOverlay`, one inline SVG: a drifting sheen, a frosted rim, and seeded cracks from
  `iceSheet.ts` drawn in by stroke-dashoffset as the cracks variable climbs, glowing pale blue,
  stopping short of the board). A faint rime of crystals (`overlay-frost-v1`) at the very edges.
- **A black hole.** A combo of Inferno or better lost to a miss opens a dark disc at the ring
  that swallows the room; the void plate (`bg-gameplay-void-v1`, the chamber collapsed into a
  black hole) is what is left for the rest of that floor. The stairs are the way out: the next
  floor is the dungeon again.
- **The shop is a place.** While the store stop's sheet is open the room is the merchant's vault
  (`bg-gameplay-shop-v1`), and the sheet's scrim is thinned so it shows; Descend crossfades the
  dungeon back.

All three are derived from run state (the turn event, the floor, the store stop), so a restore
shows the same room and nothing replays on a mount. The plates were rendered with Z-Image-Turbo
from `scripts/card-pipeline/scene-moods.zimage.manifest.json` at the dungeon's camera and size.

### The next rungs, taken (round seven)

- **The storm's room.** Wet stone: the same mask script in `--wet` mode (thinner, bluer,
  fainter) laid on the room's upward faces, shimmering slowly (`--scene-wet`). Lightning through
  the arches: `StormBoltsOverlay`, three seeded bolts in the plate's space (`stormBolts.ts`),
  each striking on its own phase of the storm beat the room's flash already runs on.
- **Frozen through every room.** The snow mask is per plate now (`overlay-snow-shop-v1`,
  `overlay-snow-void-v1`), each shown with its room, and the ice pane is the screen's, so a frost
  run stays frozen through the shop and the void.
- **Back from the void.** The floor after a black hole's opens with one flash of the ring (the
  Fever-arrival layer, keyed to the loss) and a stamp, BACK FROM THE VOID.

## No ceiling, and the shop as a room (round eight)

- **The ladder has no top.** Legendary opens at 25 and every 25 links after it is another
  ascension - Legendary II, III, IV... in the temper's own word (Absolute Zero II, Godlike VIII) -
  without end (`comboAscension`, `comboSurge`). The surge (log2 of the ascension) is what the
  endless effects read: one more strand of lightning per step, embers faster and more of them,
  more bolts through the storm's arches, another ring of aura, a bigger combo number and a wider
  flame up the rail, a stamp for every ascension and for every hundred. Things with a real ceiling
  (the particle budget, quality tiers) clamp it themselves; nothing else does.
- **The store is the room.** No sheet: the merchant's vault is the screen and the things in the
  painting are the things you buy (`StoreVault`, `storeVaultLayout.ts`): a ring of light on the
  coins (another miss), the crystal (a peek), the scales (a shuffle), the bell (a bomb), the
  ledger, the bottles and the two lanterns (the relics), each a real button with the name and
  price beside it and what it does on hover or focus; the trapdoor in the floor is Descend. Still
  a dialog for everyone who is not looking - labelled, focus-trapped, Escape descends, first focus
  on Descend, a receipt in a status line - and the wares sit above the trapdoor so a pad's d-pad
  walks up into them. On a phone the hotspots clamp to the screen's edges.

## The room takes part (round nine): a deep dive into the arcade cabinets

The brief: make the combo and the mechanics *affect the environment* the way the Chinese arcade
and mobile titles do. What those games do, from the cabinets up:

- **捕鱼达人 / Fishing Joy** (65M+ players; the arcade fishing cabinet as a phone game). The
  whole sea is the reward system. A jackpot **rains gold coins across the screen** and the cabinet
  flashes; a boss fish **arrives with a warning banner and the water darkens**; special creatures
  fire **screen-wide events** - the bomb crab's explosion, the electric eel's chain lightning, the
  **freeze that stops every fish** for a beat; a full power gauge hands you a laser that
  annihilates everything; four progressive jackpots sit on rare catches. Nothing happens only on
  the fish you shot - the cabinet takes part.
- **开心消消乐 / Anipop** (the match-3 with 10,000+ levels). Fever is a **state the whole board
  enters**: the background changes, the animals cheer, every clear is bigger, an announcer
  escalates through the ranks of a combo (连消). A big cascade **shakes the whole frame and
  zooms**, not just the tiles.
- **合成大西瓜 / Suika**. The container is the tension: as it fills, the whole field shakes on a
  big merge, and the chain merges are the dopamine - a single mechanic whose *feedback* is the
  content.
- **弹壳特攻队 / Survivor.io**. Power spikes fill the screen; a weapon evolution changes what the
  arena looks like, not only your numbers.
- **The pool tables** (already studied above): the streak sets the table on fire.

The lesson, from all of them: **the environment is a participant, not a backdrop**. Every
system - the combo, the losses, the money, the items - has a room reaction, the reactions stack,
and the biggest of them are rare and whole-screen.

Built as the room's beats (`sceneMood.ts`, every one derived from run state and keyed to the turn
or the purchase that made it, so a restore replays none):

| The cabinet does | The room does here |
| --- | --- |
| Gold rains on a jackpot | **Gold rain** (`GoldRain`): seeded SVG coins fall through the room on a floor's gold, on every purchase, and on every ascension - more the bigger the payout, more the higher the surge, half again with Deep Pockets |
| The frame shakes and zooms on a big hit | **The hit**: the whole plate punches in on a Fever break or an ascension (`data-scene-hit`) |
| The water darkens when you are losing | **The miss**: the room dims and the torches drop for a breath on every miss |
| A boss arrives; the sea goes red | **Peril**: with the bank empty a red edge breathes and the torches burn low until a miss is banked |
| The freeze stops every fish | **The freeze**: a frost stage reached stops the flames, sparks, motes and mist for a beat |
| The cabinet speeds up in frenzy | **Tempo**: the surge past Legendary speeds the room's drift, mist, flames and runes (`--scene-tempo`) |
| Your upgrades change the arena | **Relic fixtures**: Tallow Candle lights the torches hotter, Long Look brightens the ring's light, Gilded Chain turns the runes gold, Deep Pockets deepens the ring and the rain |

With the earlier rounds - the temper's grade, frost's snow and ice, the storm's bolts and wet
stone, the black hole and the void, the shop as a room - the room now answers the combo, the
losses, the money and the items, which is the whole list.

### Refinements (round eleven)

- **The stop stocks its shelves.** `rollStoreStock(runSeed, floor, owned)`: a miss always, a bomb
  always at the first stop, each other consumable in about two stops of three, two of the relics
  not yet owned. Rolled as the stop opens and kept on the run (`storeStock`), so a shared seed
  stocks the same shelves and a replay buys what was there. The vault draws only what is stocked
  (`storeWareGlyphs.tsx`: coins, crystal, scales, bell, ledger, bottles, lanterns as small SVGs on
  their spots); a bare shelf is a bare shelf.
- **Less chrome on a ware.** The dashed rings are gone: a soft glint under the drawing, the
  drawing lifts on hover or focus, a thin outline for the keyboard. The drawings are the wares.
- **A wipe between rooms.** `SceneWipe`: a flipbook of six drawn frames of ink growing in from
  the screen's edges, stepped so it reads as drawn, once on the way into the shop and once on the
  way out (`useSceneWipe`); the room changes underneath while the ink holds.

## Round twelve: the fire changes the game (2026-09-30)

The owner asked for the research to be pushed to its conclusion and for **gameplay itself to
change with the combo**, which reverses one line below. What the leaders do once a streak is hot:

- [NBA Jam](https://www.nba-live.com/ww-why-being-on-fire-was-so-cool-in-nba-jam/): three
  baskets and the player is *on fire* - better accuracy, more speed, a backboard that shatters -
  and one opposing basket puts it out. The hot player plays a different game, and the risk is what
  makes it fair.
- [Peggle](https://peggle.fandom.com/wiki/Game_Mechanics): clearing the orange pegs opens *Extreme
  Fever*, pegs pay twenty times and the bottom of the board becomes score buckets. The board
  itself changes at the top.
- [Tetris Effect](https://blog.playstation.com/2018/06/25/tetris-effect-adds-a-new-strategic-layer-to-the-decades-old-game-and-it-works/):
  the Zone stops time and lets the player clear more than four lines - a rule the base game
  forbids - earned by playing well.
- [Guitar Hero](https://guitarhero.fandom.com/wiki/Star_Power): Star Power doubles the multiplier
  and makes the rock meter easier to fill; earned on the streak, spent by the player.
- [Balatro](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/balatro) and
  [Vampire Survivors](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/vampire-survivors):
  the dogma of the compounding loop - each gain makes the next gain bigger, and the player can feel
  the curve.

The dogma, distilled: **the hot hand gets a different board, never a safer one**. Built as
*heat perks* (`src/shared/combo-heat-perks.ts`), each one an existing rule turned up a notch,
read off the combo the player carries *into* the turn:

- **Afterglow** - from Hot every match lights face-down cards touching it until the next flip: one
  at Hot, two at Blazing, three from Inferno (the lantern hall's light on a shorter wick, through
  the same `resolveLanternLight` with a `maxLit`). Information is what a memory game's hot hand
  should be made of.
- **The wider pop** - from Blazing a break may take one pair over its rung's cap.
- **The longer reach** - from Inferno the first wave walks a step further along the clump.
- **Nothing for the bank.** Runs are punishing: a miss at Legendary costs what it costs at cold and
  ends the combo. `yarn sim:survival` after: 10% misses median floor 37.5 (36 before the perks).

Measured before the pop was widened (`yarn sim:pop-share`, perfect player, eight seeds, floors
1-24): the player matched 0.38 of a floor's pairs by hand before the perks and 0.34 with them; the
biggest break on a floor went from 0.34 of the board to 0.38. A second pair at Legendary read 0.33
and 0.41 - the pop taking the board again - and was cut. The rail says what the fire buys under
the combo ("Afterglow 2 · Pop +1", or "Fire at 6" while cold); the Codex has a topic (v62); the
hall has two rooms (`heat-afterglow`, `heat-pop`); the soak checks the afterglow never lights
more than the heat allows and requires the careful player to run hot.

## Round thirteen: the Zone (2026-09-30)

The owner asked for an entirely new concept built on the leaders' dogma. The two that go
furthest past "louder" are Tetris Effect's Zone (time stops, and a rule the base game forbids -
more than four lines at once - becomes possible) and Guitar Hero's Star Power (earned on the
streak, *spent* by the player). Here the base rule is that a turn is two cards, and the Zone
(`src/shared/zone-rules.ts`) is where it is not:

- **Ignite** (dock tool, offered at Inferno or better with nothing face up): the combo burns to
  zero - NBA Jam's fire dies on one basket, this one is cashed in on purpose - and the Zone
  opens for three pairs (four at Legendary, one more per ascension, six at most).
- **In the Zone** every card turned stays up and nothing resolves; the rail counts the cards
  (`hud-zone`), the room is held under a cold veil, and the last allowed card or **Resolve**
  ends it.
- **The resolve** plays everything face up through the game's own turns: complete pairs first,
  so the chain climbs and the pop widens through them (a perfect Zone leaves a combo standing);
  then the leftovers as misses two at a time, at full price from the bank; a lone leftover for
  nothing. A bonus of 100 × matched² on top, quadratic like the Zone's line clears.
- **The stamps**: IGNITION! when it opens; PERFECT ZONE! or ZONE ×n when it resolves, in the
  miss's red when the leftovers cost the bank.

Never safer: the combo is the entry fee, and a bad Zone costs exactly the misses the same cards
would have cost as turns. What changes is what a turn *is*, for a few seconds, for the player who
earned it. The soak ignites it on half the turns it may and requires a Zone to open and to match
a pair; the `zone` room walks the burn, the free flips, the resolve, the miss and the bonus.

## Round fourteen: the end, stamped (2026-09-30)

The owner asked for the results screen to open the way the in-run stamps do - the duel and
hunt screens of the 2000s (the card cartoons, the demon hunter) - with the choices as stamps you
can press, and then said it plainly: do away with the panels. The end is a cut-scene first
(`RunEndCinematic`): the room goes dark under a burst of speed lines, the verdict word is
plastered across the middle of the screen (slammed in, swept with a sheen, held ~2.3 s, gone), a
flourish gets its own beat, and then the choices take its place one after another as stamped
words you can press - PLAY AGAIN, REMATCH, MAIN MENU and THE RECORD, which opens the ledger of
numbers. Any press or key skips to the choices; Escape still leaves for the menu; reduced motion
opens on the choices with the verdict held small above them. The ledger keeps the earlier
`RunEndStamp` hero:

- **The verdict**, one word by how the run ended, never a verdict on the player: JOURNEY OVER
  (the misses ran out), TIME'S UP, UNTIL NEXT TIME (the player stopped), CONTRACT SEALED, TABLE
  SETTLED; EXPEDITION OVER for a summary from before the reason was recorded. It is the page's
  one h1, slammed in with the sheen, speed lines and a flash, held at rest.
- **The score line** under it: score and floor, in the ledger's gold.
- **A flourish**, a smaller second stamp for the one thing worth one: NEW RECORD! over everything,
  else LEGENDARY / INFERNO / BLAZING RUN by the heat the best chain reached.
- **The choices as stamps**: PLAY AGAIN (in the temper's hottest colour), REMATCH, MAIN MENU,
  each a real button with the ledger's accessible names, skewed at rest, upright and sheened on
  hover or focus, staggered in after the verdict. The ledger keeps Copy result and the next-run
  cards; the run's temper colours the whole thing.

Reduced motion shows it all at rest. The fit contract, the reachability gate and the controller
walk still pass on the results screen; the playtest's results screenshot is the reference.

## Weather on every run (2026-09-30)

The owner reported the environment effects (snow and the rest) as lost. They were not: a probe
of a frost seed at combo 20 had the snow at full opacity and the ice pane up, on desktop and on a
phone, and production served every overlay. What read as lost was two gaps in the design. The
weather belonged only to the rarer tempers (frost 18%, storm 10%), so seven runs in ten, the
ember ones, never had any; and every weather started at zero, so a cold combo - a run's first
turns, and every turn after a miss or an ignition - showed nothing even on a frost run.

Now every run has weather from its first turn (`WEATHER_FLOOR` in `sceneMood.ts`, 0.45), and
the heat builds it from there: a frost run opens on snow on the ledges and rime at the edges, a
storm run on wet stone and the odd far bolt, and an ember or prismatic run on embers drifting up
off the floor (`EmberDriftOverlay`, seeded per run, thicker and faster with the heat, `--scene-ash`).
The ice pane over the board still waits for the heat. The temper stamp names ember runs too, so
every run says what its weather is the first time the combo warms.

## What is deliberately not borrowed

- **A decay timer.** The tables' streaks die on a clock; here the only thing that ends a combo is
  a miss, because the game is about remembering, and a memory does not expire between turns.
- **Rank effects that make the run safer.** Round twelve gave the heat rules of its own (the
  afterglow, the wider pop, the reach), so this line narrowed: what the heat still never buys is
  a miss. Runs are meant to be punishing (`docs/BALANCE_NOTES.md`), and a combo that shielded the
  player from the miss that ends it would undercut the thing it celebrates.
- **Stamps for small ranks.** Warm gets the HUD warming and nothing more; a stamp for three in a
  row is a stamp for nothing, and it would blunt the four that matter.

## Where each piece lives

- Stages and levels: `src/shared/combo-heat-rules.ts` (`comboHeatLevels`, `comboStageReached`).
- The stamps: `src/renderer/components/screenCallouts.ts` (what a turn or a purchase earns) and
  `ScreenCalloutQueue.tsx` (+ `.module.css`), fed from the turn event in `GameScreen.tsx`.
- The sting and the sparkle: `src/renderer/audio/gameSfx.ts` (`playComboStageSfx`, the heat layer
  in `playMatchSfx`).
- The shake: `src/renderer/components/boardTrauma.ts` (`TRAUMA_HEAT_SCALE`, `TRAUMA_STAGE_UP`),
  read off the combo prop's rising edge in `TileBoardScene.tsx`.
- The HUD, cards, room and vignette: see [epic-board-rendering-assists.md](./epic-board-rendering-assists.md).

## Next on the ladder (not built)

- A slow push-in of the camera on a Legendary break, the tables' "big shot" beat.
- A flame trail on the card as it flips from Blazing up - the instrument burning, not the room.
- A run-end card that replays the best combo's stamps.

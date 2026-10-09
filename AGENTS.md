# Memory Dungeon: core rules for every agent

These are the owner's rules for how the game looks and sounds. They hold for every agent working
in this repo (Claude, Codex, anyone else) and override a default or an older doc. The day-to-day
workflow (delivery to `main`, the gate, testing, the hall, the soak, driving the app) is in
[`CLAUDE.md`](CLAUDE.md); the effects style is in the Effects section of
[`docs/design/game-view-redesign.md`](docs/design/game-view-redesign.md). Read both.

## 1. The realm's music is the run's music

- On a floor in a realm, that realm's loop (`src/renderer/assets/audio/music/realm/<realm>-ambience.ogg`)
  **is** the background music: it plays on the music element (`gameplayMusic.ts`, `realmMusicUrl`,
  `musicTrackKey`), so the Settings music volume, the master volume, the Fever duck and the combo's
  music layers all act on it. `run-loop` is only the fallback for a realm without a loop; the menu
  keeps `menu-loop`.
- Moving from one realm to the next crossfades (`MUSIC_CROSSFADE_MS`); it never cuts.
- Every track is preloaded with the run (`preloadGameplayMusic`): nothing streams in play.
- A realm loop is not also played anywhere else (the ambient bed is noise only, and off).
- Any file in `music/realm/` plays, so a new one is chosen before it is installed. Generated audio
  (ACE-Step) is chosen **by measurement** (onset spikiness, brightness, level evenness, clipping, the
  loop seam), not left waiting for someone to listen, and levelled to the run loop (-19.3 LUFS).
  Record the picks and the criteria in the jobs file (`assets/audio/realm-ambience.jobs.json`).

## 2. Everything the combo drives climbs with it, without end

- "Everything needs to scale off combo length infinitely." A surface that answers the combo reads
  **`comboDepth`** (`combo-heat-rules.ts`): log2(1 + links / 6), rising with every single link and
  unbounded. The heat (levels off by forty links) and the surge (starts at the second ascension)
  each leave a plateau; depth has none.
- Something with a budget (a particle count, an alpha, a mix level) goes through **`comboSoftCap`**:
  it approaches its ceiling and keeps rising with every link without reaching it. Something without
  a ceiling (a speed, a filter cutoff, a brightness, how often a sky breaks) takes the depth as it is.
  A surface may cap one quantity only if another of its quantities keeps climbing.
- What does this now: the music layers' drive (`comboMusicDrive`: the voices' brightness, their mix,
  the lead's octave shimmer), a realm room's glow and its overdrive, and a realm room's life (how much
  of it, how fast). A new combo-driven surface joins them, and its test walks the combo out to
  thousands of links and asserts it never stands still.

## 3. A painted room is never still

- Every painted scene ships with the things that move in it, the way the main menu's cathedral has
  its candles, wisps, dust, moths and bats, and the dungeon its torches, mist, dust, drips, bats, eyes
  and spider. A painting with only a glow on it is not finished.
- The minimum for a room: a drift of its own material (snow, sparks, bubbles, rain, spores), a mist
  or fog where its floor or sky is, light that catches now and then (glints, a breathing shaft, a
  flash), and one thing that happens (a creature crossing, a drop, the sky breaking). Placed on the
  painting itself, from the helpers in `sceneAmbient.ts` and the cells of the ambient atlas.
- **What falls lands.** Rain strikes the stone and splashes, snow settles, leaves and cinders come to
  rest, each on its own spot of the room's floor as it is painted (`REALM_FLOORS`, far edge higher and
  smaller), via `landingDraws`. Nothing falls through a floor or wraps back to the top in mid-air.
- **The weather happens in the room.** A storm's lightning comes down out of the clouds onto
  something (the rods, the horizon), branching, lighting the sky and the ground, on more channels
  the deeper the chain (`stormStrikeDraws`). Every room has its equivalent: the ember's eruptions,
  the frost's gusts, the tide's drops and breaking bubbles.
- **Gold is physical.** A payout's coins fall under gravity, bounce lower each time, roll to a stop
  and lie flat with a shadow on that room's floor for as long as the run stays in the room, every
  payout piling on the last (`goldRain.ts`: `goldCoinMotion`, the pile in `GameplayScene`); on water
  they splash and sink. A restore or reduced motion shows the pile lying there.
- **The card itself goes its element's way, and stays out of the way.** A leaving card is a literal
  card transforming (`cardElementFx.ts`): a water card liquefies - wobbles, slumps and runs down in
  drips into a puddle on the floor that drains; a fire card combusts - catches at its foot and burns
  upward, charring and curling behind a glowing edge under rising flames, to ash; a growth card has
  a growth spurt - swells, veins race over its face, leafy vines sprout from its edges, and it
  crumbles into the foliage. Ice shatters into glass and a card with no element into stone chips
  (`cardShards.ts`, `cardShardSystem.ts`). Its material also spills into the room (`roomSpill.ts`).
  Never intrusive: kept to the card's cell, its floor and a little around it, gone in under two and
  a half seconds; loose pieces are thrown back behind the board's plane.
- **High quality on a phone.** A phone held upright shows the middle of a landscape painting across
  its whole height, so the scene canvas there covers only that window (`sceneCanvasWindow`) at the
  screen's own sharpness, under a pixel budget, and the realm rooms' bases are cut at twice the
  painting's size (`upscale_realms.py`, `realm_layers.py --scale 2`). The parts that move the
  painting itself are warped live from that base (`realmRoomWarpDraws`), never baked into a soft
  flipbook. Check a change on phone viewports (390x844 and 844x390 at DPR 3), not only a desktop.
- It climbs with the combo (rule 2), halves on the phone tier (`lean`), and stops entirely under
  reduced motion (`still`).
- The realm rooms do this in `realmRoomLife.ts`; a new room or plate gets the same, a test per room
  (present, more of it deeper, halved on lean, none when still), and a look at it in the browser.

## 4. The board is the cards on the room's floor

- No cell tiles, ground squares or grid behind or between the cards. The element-ground squares
  (`ElementGround.tsx`: wave lines, crack webs and tints blended over each cell) were removed on the
  owner's word (2026-10-09, "that can go away entirely"); the ground rules still run, but nothing
  paints squares on the board. Do not restore them for the ground mechanic's sake: show a mechanic
  on the cards or in the room, not as a tile grid.

## 5. How a change to these is checked

- Unit tests for the rule (monotonic in the combo, present per room, the music key and crossfade).
- A browser look, headless and isolated (see the global rule about the desktop): screenshots of the
  rooms cold and at a deep combo, and the music element's track and volume against the settings.
- `e2e/asset-streaming.spec.ts` still sees nothing requested after the board appears.

# Realms, omens and travel

The owner's brief (2026-09-30): the filler text over the board goes, and **environments become a
prominent factor that changes how a floor plays**. The player picks where to go next, the way Shape
of Dreams hands out its paths, and environment cards on the board change the environment while the
floor is played.

## The loop

1. Every floor is in a **realm** (`src/shared/realm-rules.ts`). A run opens in a seeded, calm one.
2. The realm's **weather** comes on a clock the player winds (resolved turns, match or miss), the
   same shape as the restless floor, and the HUD chip counts it down (`RunShell`, `realmCopy.ts`).
3. The realm also **answers the player's turns** (`realm-weather-rules.ts`).
4. From floor 3 one pair is an **omen** of another realm (`realm-omen-rules.ts`). Matching it sets
   off a named reaction and turns the floor into the omen's realm.
5. At the clear, after the beat (and the store on a store floor), **three doors**: three realms,
   one calm, one wild, one raging (`RealmTravel.tsx`). The realm the floor ended in is always one.
   Harder weather comes sooner and pays more gold at the clear (×1, ×1.25, ×1.5).

## The realms

| Realm | Weather (wild interval) | Answers the player | Pressure / reward |
|-------|-------------------------|--------------------|-------------------|
| Frost - The Frozen Reach | Blizzard (4): one row of face-down cards slides with the wind; their backs are snowed over (suit hidden until turned) | A miss freezes both cards for 2 turns (3 raging): they cannot be turned. A match shatters ice beside it | Holds what you just learned out of reach; erases the suit map |
| Ember - The Cinder Deep | Wildfire (3): a card catches on a 3-turn fuse (at most 4 burning) | Matched in time: doused, +2 gold. Fuse out: -1 gold, spreads to a neighbour | A standing offer that punishes neglect |
| Tide - The Drowned Vault | Current (3): one column cycles down a step, sweeping across the room | - | Predictable movement to track |
| Storm - The Thunder Spire | Lightning (4): two cards swap and stay lit until the next flip | - | Chaos that pays in information |
| Grove - The Overgrown Crypt | Overgrowth (3): vines hold a card (they creep next to vines) | A match beside vines cuts them, +1 gold each | Locks cards; rewards matching where it is overgrown |

Calm adds a turn to the interval, raging takes one away and doubles each event's reach.

## Peaks (every third weather of a floor)

| Realm | Peak | What it does |
|-------|------|--------------|
| Frost | Whiteout | Every face-down card is snowed over: no suit on the board can be read |
| Ember | Firestorm | A new fire, then every fire spreads to a neighbour at once (up to six burning) |
| Tide | Spring Tide | Two columns run at once |
| Storm | Thunderclap | A whole row of face-down cards is lit until the next flip; nothing moves (the peak that pays) |
| Grove | Bloom | The vines flower: a bloom cut by a match beside it pays three gold, not one |

The HUD chip names the peak when it is next, in the realm's colour.

## The elements: your groups cast them (`element-group-rules.ts`, 2026-10-01)

The owner: the cards already carry groups and effects, and the realm system sat on top of them; the effects must come from the cards and their groups, and the groups should be the elements. So the four suits are the elements - **ember is Fire, tide is Water, moss is Grove, bone is Frost** - and every match casts its element from the matched pair and every card its pop took, onto the face-down cards up to two steps away (three when the floor is in that element's realm):

| Element | Cast | What it does to the cards it reaches |
| --- | --- | --- |
| Fire | scorch | burns vines, ice and snow away (pays nothing; a harvest pays because a match cut the vine) |
| Water | wash | puts every fire out and washes the cards it reaches one place along (never a pinned card) |
| Frost | freeze | kills every fire; a popped group freezes the nearest card for one turn |
| Grove | entangle | a popped group snares the nearest card in vines |

Only a group the pop made holds a card, one a cast. Measured with the soak: two holds a cast and two-turn frost cut the average player's run from 8.9 floors to 5.6; the shipped holds cost 8.9 to 8.1 and the careful player nothing. Every match already thaws and cuts what is right beside it, so a cast starts where that ends. A cast that changes the board stamps the element (FIRE!, WATER!, FROST!, GROVE!) in its own colour, jolts and bursts its cards and plays its recording. Counted as `elementCastsThisFloor`. **The realm weather clock runs on raging floors only** (`realmWeatherClockRuns`, the owner's call, 2026-10-01): on a calm or wild floor everything that happens to the board comes from the cards, the HUD chip shows no countdown and the doors say "your matches cast the elements"; on a raging floor the timed weather and its peaks stay as the extra danger, with the backlash. A confluence on a wild door is now two realms at double gold with both answering misses, and no clock.

## The sway: your matches tip the world (`realm-sway-rules.ts`, 2026-10-01)

Each suit belongs to a realm: ember to the Cinder Deep, tide to the Drowned Vault, moss to the Overgrown Crypt, bone to the Frozen Reach. Every pair matched of a suit whose realm the floor is not in, pops included, leans the world toward it (`realmSway`). The lean carries between floors with the combo, and a miss wipes it. At **five** pairs of one suit (`REALM_SWAY_TIP`) the floor tips into that realm with the omen's reaction, keeping its severity, at most once a floor (`realmTipsThisFloor`); a tip empties the lean, clears nothing and pays nothing. An omen matched on the same turn wins. The storm has no suit, by decision: a floor can be leaned out of the Thunder Spire, never into it.

It shows building: from two pairs the realm chip reads "Tide rising 3/5" in the coming realm's colour (pulsing at four), and the leaning suit's face-down backs wear the coming realm over their own, more of it the closer the tip. The tip stamps the reaction's name with "Your matches tip the floor into ...".

The threshold was measured before it was built (a soak observer, 160 runs): a per-floor count tipped 15% of floors at 82% of the way through, too late to matter; carried with the combo, at five, careful play tipped 21% of realm floors, average 7%, sloppy none, around turn three.

## Backlash: a raging realm strikes back (`resolveRealmBacklash`, 2026-10-01)

Frost has always frozen a miss's cards. At the **raging** pitch the other four answer a miss too, on the two cards the player just saw, so the raging door's half-again gold is paid for in more than weather speed:

| Realm | Backlash | What it does to the missed cards |
| --- | --- | --- |
| Ember | Scald | Both catch fire on a two-turn fuse (`SCALD_FUSE`): douse them by matching in time, or they burn a gold and spread |
| Tide | Undertow | Each is dragged one cell down its column, the bottom row wrapping to the top |
| Storm | Static | Each is thrown across the board, swapped with a card of another pair, and not lit |
| Grove | Snare | Both are vined and held until a match beside them cuts them |

Pinned cards stay put, the floor guard still frees vines that would leave no turnable pair, and calm and wild floors keep the old answer (frostbite in the frost, nothing elsewhere). Counted as `realmBacklashesThisFloor`; the soak requires one to happen, and the hall walks each (`realm-scald`, `realm-undertow`, `realm-static`, `realm-snare`).

## Confluence

From floor 4, about one clear in three turns its wild door into a **confluence**: two realms at once
(`RealmDoor.confluence`, `RunState.realmSecondaryId`). The weather alternates between them (the
first realm's, then the second's), both realms answer the player (a miss freezes if either is the
frost), and the clear pays double gold. An omen's reaction settles the floor on the omen's realm.

## Omen reactions

Every pair of realms has a name (`REALM_REACTION_NAMES`): Thaw (frost to ember), Steam (ember to
tide), Wildfire (grove to ember), Whiteout (storm to frost) and so on. A reaction clears what the old
weather left (a gold each, at most five). Two do more: ember through a grove sets every vine alight,
and a storm breaking strikes at once.

## Consequences that carry (`realm-carryover-rules.ts`)

| Carryover | Cause | Effect on the next floor |
|-----------|-------|--------------------------|
| Smoke | Each fire that burnt out (up to 3) | Its study window is 12% shorter per level |
| Chill | Four or more cards frozen on the floor | Two cards (of different pairs) start frozen |
| Attunement | A clean clear by the realm's measure: frost no frostbite, ember no burnout, tide/storm within par, grove two vines cut | +25% gold on that realm's clears per level, up to 3; the doors show it |

The floor-clear beat says what was sent on.

## Safety

- The guard (`releaseRealmHoldsIfStuck`) runs after every turn and every bomb: if frozen and vined
  cards would leave no pair that can be turned, the ice and the vines give way. A realm can make a
  floor harder; it can never leave one that cannot be finished.
- Weather moves face-down cards only, never a pinned one.
- The census and the curve sims build realm-free floors (they measure the pair curve and its par);
  the whole-run soak plays realms through their doors with invariants for the guard, the doors and
  the blocked flips, and requires every answer to happen.

## Presentation

- Card marks (`RealmTileMarks.tsx`): ice with the turns left, snow over the suit, a flame with its
  fuse, vines, and the omen's sigil on both halves.
- Stamps for every weather event and reaction, and one naming the realm as a floor opens
  (`screenCallouts.ts`).
- The room follows the realm: the heat temper is the realm's (`comboHeatThemeForRun`), so frost
  snows, ember drifts sparks, storm flashes, the tide bubbles, the grove sheds spores.

## Removed filler

The caption under the board (the HUD announcer's sentence) is no longer drawn - it stays in the page
for screen readers - and achievement and pickup toasts no longer appear over the board.

## On the board and the screen (2026-10-01)

Every face-down card wears its realm (`RealmAmbientBackPlane`: frost rime, ember char with glowing cracks, tide sheen and droplets, storm static, grove moss), and the screen carries it at the edges (`RealmScreenOverlay`: flames licking up, vines creeping in, rain, rime, charge); both are stronger in a wilder realm, and a confluence shows its second realm too. Any card the weather moves (the current, the blizzard row, lightning) glides to its new cell instead of snapping (`tileCellGlide.ts`).

The cards also move with the realm (`realmCardMotion.ts`). While a realm holds the board, every face-down card sways: the tide bobs it, the grove's wind rolls across the columns, the ember shimmers it, the storm makes it tremble in fits, the frost shivers it now and then. Each event jolts the cards it names: lightning throws them at the camera and rattles them (and its swap snaps instead of gliding), fire hops them, a gust leans them over, a current rolls them, vines drag them down, a thaw or a harvest lifts them. The room takes the same hit (`data-scene-realm-event` on the scene: flash, flare, gust, surge, creep), the screen edges surge with it, and when an omen turns the realm the old overlay burns or melts off the glass as the new one comes on. Depth and rotation only, never sideways, so a card is always under the press that picks it; none of it plays with reduced motion, and the sway is off at low graphics.

## Heard (2026-10-01)

The strikes are **CC0 recordings** (lightning, fire, ice and water impacts by lentikula; an earth spell by qubodup; a fire crackle by AntumDeluge; a wind loop by SketchMan3; sources and processing in `src/renderer/assets/ASSET_SOURCES.md`), taken in turn so one event does not repeat a take; the procedural voices below are their fallback, and the chime and the void stay procedural. Every realm event has a sound (`playRealmEventSfx` in `gameSfx.ts`): lightning and static crack and roll, fire whooshes and crackles, the blizzard howls, frostbite snaps, the current and the undertow surge, vines creak, a harvest or a thaw chimes, a doused fire hisses; a peak is a quarter louder, and the void spitting is an implosion and a burst (`playVoidSpewSfx`). Under them, while a realm holds the board, a quiet weather bed can play (`realmAmbientBed.ts`): rain in the tide, wind in the frost, roar and flutter in the ember, rumble and static in the storm, leaves in the grove; it crossfades when an omen turns the realm. **The bed is off** (`REALM_BED_ENABLED`) until the owner has heard it: the first one buzzed, its noise generator cycling every 4,235 samples (fixed with xorshift32), and its resonant filters whistled. All procedural, so nothing new to preload. Levels were set in a browser against a match cue: the strikes land at one to three times a match, the bed well under it.

## In the air (2026-10-01)

The board's own particles carry the realm (`realmParticles.ts`, through the pooled system in `boardParticleSystem.ts`, free slots only so a match or a bomb is never crowded out): a burning card throws sparks up, a frozen or snowed card sheds frost motes, a vined card drops leaves; a few face-down cards a tick give off the realm itself (embers rising, drops falling, snow, static, leaves); and every realm event bursts on the cards it names in its family's colour. Realm motes are 2.4 times a combo spark. None of it with reduced motion; one mote a tick at low graphics. The canvas counts them in `data-particle-realm-bursts`.

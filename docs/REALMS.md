# Realms, elements and travel

## Current cast contract (rules 57, 2026-10-03)

**Every elemental pair casts and leaves ground.** Connected blocks now conduct the whole cast;
local and amplified reactions use the same six recipes. Fire brings burn pressure, Water moves
cards, Frost freezes cards and Grove binds them with vines. Every match attempts its effect;
blocked attempts show a reason, and holds always retain a free pair. Ground under the matched pair chooses chemistry; adjacent patches cannot change
that choice. The Casts guide retains the actual last result and previews primed reactions.

See [the current rules and verification](gameplay/living-elements.md) for the full contract.
The design history and measurements below describe earlier versions, not current targeting.

The owner's brief (2026-09-30): the filler text over the board goes, and **environments become a
prominent factor that changes how a floor plays**. The player picks where to go next, the way Shape
of Dreams hands out its paths, and environment cards on the board change the environment while the
floor is played.

## The loop

1. Every floor is in a **realm** (`src/shared/realm-rules.ts`). A run opens in a seeded, calm one.
2. The realm's **weather** comes on a clock the player winds (resolved turns, match or miss), the
   same shape as the restless floor, and the HUD chip counts it down (`RunShell`, `realmCopy.ts`).
3. The realm also **answers the player's turns** (`realm-weather-rules.ts`).
4. Every card is its suit's **element** (`element-alchemy-rules.ts`), drawn as the material itself
   (`ElementCardBack.tsx`). Its matches cast it (`element-group-rules.ts`), they lean the floor
   toward its realm until it tips (`realm-sway-rules.ts`), and the card answers any element that
   reaches it (see Alchemy below). The omen cards of 2026-09-30, one pair a floor with another realm's
   sigil in its top corner, were retired on 2026-10-01.
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
frost), and the clear pays double gold. A tip settles the floor on the realm it tipped into.

## Reactions

Every pair of realms has a name (`REALM_REACTION_NAMES`): Thaw (frost to ember), Steam (ember to
tide), Wildfire (grove to ember), Whiteout (storm to frost) and so on. The sway's tip is stamped with
it. A tip clears nothing and pays nothing.

## Alchemy

Whenever an element would act on a face-down card (frostbite, a raging backlash, a matched group's
cast, every weather), the card answers first:

| Card | Drinks (empowered) | Puts out (neutralized) | Open to |
|------|--------------------|------------------------|---------|
| Fire (ember) | fire | frost | water, grove |
| Water (tide) | water | fire | frost, grove |
| Frost (bone) | frost | grove | fire, water |
| Grove (moss) | grove | water | fire, frost |

A card that drinks its own element is **empowered**: it glows and pays a gold when matched. A hold
(a freeze or a snare) spent on a card that answers holds nothing. The storm is no element. Soak, 60
seeds a player: the average player went from 8.7 floors a run to 10.2 (9.5 without the gold).

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
  fuse, vines. The card itself is its element (`ElementCardBack.tsx`), brighter while empowered.
- Stamps for every weather event and reaction, and one naming the realm as a floor opens
  (`screenCallouts.ts`).
- The room follows the realm: the heat temper is the realm's (`comboHeatThemeForRun`), so frost
  snows, ember drifts sparks, storm flashes, the tide bubbles, the grove sheds spores.

## Removed filler

The caption under the board (the HUD announcer's sentence) is no longer drawn - it stays in the page
for screen readers - and achievement and pickup toasts no longer appear over the board.

## On the board and the screen (2026-10-01)

Cards carry their own element as flame, droplet, shard or leaf particles. Arena ambience emits around the ground, while hazards and coatings emit at card edges (`TileBoardParticles`); fuse/freeze counts and harvest/hold badges remain still and legible. The old painted realm veils and full-screen weather drawings are removed. `RealmScreenOverlay` supplies only a quiet room tint. Cards moved by weather still glide to their new cells (`tileCellGlide.ts`).

The cards also move with the realm (`realmCardMotion.ts`). While a realm holds the board, every face-down card sways: the tide bobs it, the grove's wind rolls across the columns, the ember shimmers it, the storm makes it tremble in fits, the frost shivers it now and then. Each event jolts the cards it names: lightning throws them at the camera and rattles them (and its swap snaps instead of gliding), fire hops them, a gust leans them over, a current rolls them, vines drag them down, a thaw or a harvest lifts them. The room takes the same hit (`data-scene-realm-event` on the scene: flash, flare, gust, surge, creep), the screen edges surge with it, and when an omen turns the realm the old overlay burns or melts off the glass as the new one comes on. Depth and rotation only, never sideways, so a card is always under the press that picks it; none of it plays with reduced motion, and the sway is off at low graphics.

## Heard (2026-10-01)

The strikes are **CC0 recordings** (lightning, fire, ice and water impacts by lentikula; an earth spell by qubodup; a fire crackle by AntumDeluge; a wind loop by SketchMan3; sources and processing in `src/renderer/assets/ASSET_SOURCES.md`), taken in turn so one event does not repeat a take; the procedural voices below are their fallback, and the chime and the void stay procedural. Every realm event has a sound (`playRealmEventSfx` in `gameSfx.ts`): lightning and static crack and roll, fire whooshes and crackles, the blizzard howls, frostbite snaps, the current and the undertow surge, vines creak, a harvest or a thaw chimes, a doused fire hisses; a peak is a quarter louder, and the void spitting is an implosion and a burst (`playVoidSpewSfx`). Under them, while a realm holds the board, a quiet weather bed can play (`realmAmbientBed.ts`): rain in the tide, wind in the frost, roar and flutter in the ember, rumble and static in the storm, leaves in the grove; it crossfades when an omen turns the realm. **The bed is off** (`REALM_BED_ENABLED`) until the owner has heard it: the first one buzzed, its noise generator cycling every 4,235 samples (fixed with xorshift32), and its resonant filters whistled. All procedural, so nothing new to preload. Levels were set in a browser against a match cue: the strikes land at one to three times a match, the bed well under it.

## In the air (2026-10-01)

The board's own particles carry the realm (`realmParticles.ts`, through the pooled system in `boardParticleSystem.ts`, free slots only so a match or a bomb is never crowded out): a burning card throws sparks up, a frozen or snowed card sheds frost motes, a vined card drops leaves; a few face-down cards a tick give off the realm itself (embers rising, drops falling, snow, static, leaves); and every realm event bursts on the cards it names in its family's colour. Realm motes are 2.4 times a combo spark. None of it with reduced motion; one mote a tick at low graphics. The canvas counts them in `data-particle-realm-bursts`.

## Resonance, reactions and depth: the elements stack without end (2026-10-02)

The owner's brief: "expand the elemental system even more, make them infinitely stacking. If you keep
picking the same zone/element it should infinitely stack. I wanted the cards to utilize the particle
system we have to show their type ... The alchemy combination system also isn't really impactful.
First of all theory craft this entire system, then implement it." "Zone" here is the realm behind a
door, not the time-stop Zone of `zone-rules.ts`, which this does not touch.

### What was capped, and what was thin

Three things stopped: attunement at three levels (and it was gold only), an empowered card was a
yes or a no worth one gold, and the sway emptied at five. And alchemy only answered where an element
would have *acted* - a fire cast meets a card only if that card wore vines or ice - so on most
turns no card answered anything, a neutralized element did nothing, and nothing happened when two
different elements met. The player can read every card's element off its back and choose the order
of their matches; nothing rewarded the order.

### The theory: three numbers that never stop, one decision a turn

| Layer | Stacks by | Never capped | What it buys | What it costs |
|-------|-----------|--------------|--------------|---------------|
| **Resonance** (per element, the run's) | every pair matched of the element, pops included; plus the charge of every charged card in the match | `elementResonance` | score on that element's matches (+`RESONANCE_SCORE_PER_STACK` a stack, a pair); a **tier** at 2, 6, 12, 20, 30 ... stacks (`resonanceTier`, T at T(T+1)) that widens the element's cast by a step and feeds reactions | a missed card sheds a stack of its element and loses its charge |
| **Streak** (the element in hand) | matching the same element again, floor to floor: a link a turn, however many pairs the pop took | `elementStreak` | at two links it is **primed**: matching a *different* element spends it as a reaction of potency links + half the tier | a miss breaks it |
| **Depth** (per realm: attunement, uncapped) | walking through the same realm's door: +1 a clear, +2 a clean one; every other realm fades by 1 | `realmAttunement` | gold (+25% a level to three, +5% a level after, without end); the realm's element takes over one more pair of the floor a level (to half the floor); its pairs resonate +1 more per three levels | the realm strikes back at misses from **wild** at depth 3 and even **calm** at depth 6 (`realmBacklashRuns`); raging weather reaches one more card per four levels |

So the turn's decision is: **the same element again** (the streak grows, the stack deepens, the cast
widens) or **a different one now** (cash the streak in as a reaction). And the door's decision is:
**the same realm again** (deeper: more of its element on the floor, more gold, a realm that bites
back sooner) or a new one (the depth fades).

### Charge: every cast feeds its own kind

A cast now charges *every* face-down card of its own element a step short of its reach, acted on
or not (`Tile.empowered` is a count, not a flag; no cap). A charged card matched adds its charge to
its element's resonance and pays a gold for every four charges. This is what makes clusters matter: match
fire beside fire and the fire around it is worth more, and wants matching next - which is the streak.

### Reactions: what alchemy does now (`element-resonance-rules.ts`)

Six pairs of elements, six reactions, each a different resource, each scaled by potency *p* (the
primed streak's links + half the spent element's tier + half the storm's depth: the Thunder Spire has no
element, it is the catalyst):

| Elements | Reaction | What it does |
|----------|----------|--------------|
| Fire + Water | **Steam** | lifts the fog: *p* face-down cards nearest the match show their faces until the next flip |
| Fire + Grove | **Blaze** | every vine and bloom on the floor burns away; a gold for every two of *p*, rounded up |
| Fire + Frost | **Thaw** | every card is freed of ice and snow; 25 x *p*² score |
| Water + Frost | **Freeze-over** | the floor holds still for *p* + 1 turns: no weather, no backlash, no frostbite, fuses do not burn down, casts hold nothing |
| Water + Grove | **Flood** | both elements gain *p* resonance |
| Frost + Grove | **Frostbloom** | the *p* face-down cards nearest the match each gain a charge, whatever their element |

The immunities stay (a card still drinks its own element and puts out the one it beats).

### Predicted, then measured

Baseline (soak, 60 seeds a player, before any of this): careful 27.0 floors a run and 15.6 gold a
floor, average 10.2 and 11.6, sloppy 2.4, wild 10.2; no violations. Prediction: reactions and charge
gold lengthen the careful and average runs by one to two floors, depth's backlash takes about half
of that back from players who stay in one realm, sloppy play (no streaks, shed stacks) does not
move. If the average player gains more than two floors the gold terms come down first (charge gold,
the post-three attunement step), not the reactions.

**Measured** (same soak, 60 seeds a player, `yarn soak --seeds=60`):

| Cut | Careful floors / gold a floor | Average | Sloppy | Reactions a turn | Verdict |
|-----|-------------------------------|---------|--------|------------------|---------|
| Before | 27.0 / 15.6 | 10.2 / 11.6 | 2.4 | - | baseline |
| First cut: streak in pairs, charge at full reach, a gold for two charges, Blaze *p* gold, +10% deep step | 27.6 / 38.8 | 9.7 / 19.7 | 2.4 | 42% | survival held but gold was two and a half times: any pop primed the streak, and every card on a small floor was charged every turn |
| Shipped: streak in turns, potency on half the tier, charge a step short of the reach, a gold for four charges, Blaze *p*/2, +5% deep step | 28.5 / 19.5 | 10.0 / 12.8 | 2.5 | 14% careful, 9% average | within the prediction; careful play is paid a quarter more gold for a floor and a half |

No violations in any cut; the soak now also holds that a reaction only ever spends a primed streak
of another element and that a miss leaves no streak. The deepest runs reached resonance 827 in one
element, a card holding ten charges, and depth 15 in one realm: nothing stops.

### Shown

- **Every card gives off its material** through the board's pooled particles (`elementCardMote` in
  `realmParticles.ts`, shapes in `boardParticleSystem.ts`): a fire card licks **flame** tongues up
  from its foot, a water card beads **liquid** drops that hang and fall, a frost card sheds cut
  **ice** shards that glint, a grove card drops **leaves** that tumble. Each is drawn as that
  material by the particle shader (a wavering tongue with a white-hot core; a drop with a hard edge,
  a dark rim and a highlight; a faceted crystal; a leaf with a midrib), not as a tinted dot. A
  charged card gives off more. Free slots only, none with reduced motion, one card a tick at low
  graphics; counted in `data-particle-element-bursts`.
- **The resonance strip** (`ElementResonanceStrip.tsx`) hangs under the realm chip: the four runes
  with their stacks, the element in hand lit with its links, pulsing once primed, and the turns a
  Freeze-over still holds.
- Each reaction stamps its name, the two elements and its potency (`screenCallouts.ts`), jolts its
  cards and plays its element's recording. The doors show the depth as a numeral that keeps
  counting, and warn when a calm or wild door is deep enough to strike back.
- Eight test hall rooms: `element-resonance`, `element-steam`, `element-blaze`, `element-thaw`,
  `element-freezeover`, `element-flood`, `element-frostbloom`, `realm-depth`; and
  `e2e/element-resonance.spec.ts` plays Steam in a browser.

## The pop is the reaction's (2026-10-02, the owner's decision)

Shown the resonance build, the owner: "this should remove the chain reaction of cards
popping/matching together, is what I meant" - and, asked which way, chose **the reactions do the
popping**. Until then every match popped the cards of its element it was touching
(`chunk-break-rules.ts`); `yarn sim:pop-share` put the matched share of a floor at 0.34, so two
pairs in three left without being matched and a reaction was one more thing on a turn that already
cleared the board.

**The rule now, on a realm floor** (every floor of a run):

- A plain match takes its own pair and nothing else. No pop, no drop.
- A match that **reacts** (a primed streak of another element) **bursts** the nearest pairs of the
  two elements that met: as many of each as the reaction's potency, counted in steps from the
  matched pair. Whole pairs only; never the cursed pair, a findable or a singleton. The burst is
  scored, counted for momentum and drawn as a pop at the combo's rung (`resolveReactionBurst`).
- The combo's heat still adds its pair bonus to the burst. The rungs no longer decide reach; they
  multiply what the burst pays. A burst's pairs are stacks of their own elements.
- A run with **no realm** (fixtures, the census and its sims, a save from before realms) keeps the
  contact pop it was built on, so the pair-curve measurements are what they were.

**Measured before it was settled** (`yarn soak --seeds=60`; the soak's players now play the
elements, opening on the element in hand until it is primed and on another after):

| Cut | Careful floors | Average | Sloppy | Wild | Careful turns a floor |
|-----|----------------|---------|--------|------|-----------------------|
| The pop on every match (before) | 28.5 | 10.0 | 2.5 | 10.4 | 8.4 |
| No pop; the reaction pops the matched element's clump by the old contact rule | 26.9 | 8.4 | 1.7 | 6.9 | 10.4 |
| The same with twice the reach and pairs | 26.8 | 8.7 | 1.7 | 7.9 | 10.3 |
| **Shipped**: the reaction bursts the nearest pairs of both elements | 30.8 | 11.2 | 1.7 | 8.8 | 6.9 |

The contact rule was the wrong body for a reaction: 42% of reactions popped nothing, because a
clump holding both halves of a pair was seldom touching the match, and doubling its size changed
nothing. Bursting the nearest pairs, a reaction takes 4.8 pairs for the careful player and 3.1 for
the average one, and 6% take nothing (no pair of either element left). What it does to play: the
player who orders their matches clears faster than before, and the one who does not clears slower -
sloppy play fell from 2.5 floors to 1.7. That is the punishing direction, recorded here so it can
be weighed; the first lever, if it is too hard, is `REACTION_POP_PAIRS_PER_POTENCY`.

The soak holds, every turn, that on a realm floor no turn takes more than its own pair without a
reaction, and requires a reaction to burst a pair. The hover preview runs the same rule
(`clump-read-rules.ts`): "a match here takes its own pair" or "a match here reacts and bursts N".

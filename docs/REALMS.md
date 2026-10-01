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

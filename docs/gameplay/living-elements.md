# Living elements: system review and cast contract

## Problem

The latest main already had four elemental suits, kin charging, counter-immunities, run resonance,
six primed-streak reactions, realm depth, realm sway, weather, backlash and confluences. The missing
link was reliable board impact. Frost and Grove held no card on a single-pair match; even a popped
group could spend its only target on an immune neighbour. Fire mainly removed statuses, so it often
did nothing on a clean board. A cast with no changed cards emitted no event. Most consequences
were attached to cards and disappeared when those cards left.

The resulting player question was reasonable: why did vines appear this time, but not last time?
The new contract is **every elemental match casts and leaves ground**. No random cast chance.

## Layers and ownership

| Layer | Owner | Role |
| --- | --- | --- |
| Suit and identity | `tile-suit-rules.ts`, `tile-identity.ts` | Fire/Water/Frost/Grove are the existing suits. Pair identity never changes. |
| Cast | `element-group-rules.ts` | Every matched pair and its popped group cast from their positions. |
| Alchemy | `element-alchemy-rules.ts` | Cards drink their own element, resist their counter, otherwise receive the effect. Immune candidates do not spend cast targets. |
| Ground | `element-ground-rules.ts` | Cell-bound material remains after removal, movement, shuffles and misses. New floors start empty. |
| Resonance and streak | `element-resonance-rules.ts` | Run-long stacks and charge rewards remain. Two consecutive same-element matches prime the stronger global reaction. |
| Arena | `realm-rules.ts`, `realm-weather-rules.ts` | Bare ground has the arena's material; raging weather and depth backlash remain. |
| Sway and travel | `realm-sway-rules.ts`, `realm-carryover-rules.ts` | Matches can tip the arena; doors and depth affect later floors. A tip now uses its destination's depth immediately. |
| Resolution | `board-turn-transition.ts`, `realm-weather-rules.ts` | Cleanup, ground chemistry, cast, streak reaction, clocks, weather, fairness guard. |
| Presentation | `ElementGround.tsx`, `RealmTileMarks.tsx`, existing realm particles/audio | Persistent ground plus card statuses, burst/motion and sounds. Four instanced ground draws maximum. |
| Explanation | `ElementCastGuide.tsx`, `screenCallouts.ts`, Codex, accessible card labels | Current power, arena interactions, actual cast result and ground under each card. |

## Guaranteed casts and strength

| Element | Every match | Stronger cast |
| --- | --- | --- |
| Fire | Clear reachable ice/snow/vines; ignite one vulnerable card on a 3-turn fuse | Up to two ignitions, maximum four burning cards. Steam/Thaw quench ignition. |
| Water | Douse reachable fires; rotate vulnerable, unanchored cards one place | Carry budget grows by two per added step of reach. |
| Frost | Douse reachable fire; freeze one vulnerable card for one turn | Up to two frozen cards; duration stays one turn. |
| Grove | Snare one vulnerable card; matching beside it cuts the vine for gold | Up to two snares; combo 6 or resonance tier 2 produces blooms worth three gold. |

Base reach is two orthogonal steps, or three in the cast's own arena (either realm of a confluence).
Add one step per three combo already in hand and one per resonance tier. A pop, combo six or
resonance tier two raises the target budget from one to two. Reach can keep growing; actual traversal
is bounded by board size. Target and fire caps prevent high resonance from locking/burning the
whole board. The score multiplier remains an economy rule, rather than silently multiplying holds.

A cast charges kin, searches past immune targets, and always reports the outcome. When no vulnerable
cards remain, it still leaves ground; the feedback says so. Freeze-over deliberately suspends new
holds and ignition, including on its creation turn. Pins and the final-pair guard still apply.

## Ground and local chemistry

Each match paints its source cells and their orthogonal neighbours, including empty cells. Ground
is a fixed-length optional array on `BoardState`, indexed by cell, never by card ID. An absent field
is empty; malformed entries are ignored. It is run-local and does not change the persisted profile
save format.

- Cinders make Fire's work visible after its cards leave.
- Pools make Water's route visible and react with later casts.
- Ice anchors the occupying card against elemental currents, blizzards and lightning; it does **not**
  prevent flipping. Overwriting the patch removes the anchor. Player powers and unrelated mutators
  retain their own movement rules.
- Roots pay one gold when a later match's source occupies planted roots, at most once per turn.
  Planting roots under a match does not pay for itself.

The first different material under a source cell reacts. If source cells do not choose a reaction,
adjacent cells do. Explicit ground takes precedence over the arena. Bare cells use the primary
arena's material, or its secondary material if the primary matches the cast. One local reaction
per cast prevents overlapping patches from multiplying payouts.

| Materials | Local reaction | Board consequence |
| --- | --- | --- |
| Fire + Water | Steam | Douse local fire; reveal up to two neighbouring faces until the next flip. Quench Fire's ignition. |
| Fire + Frost | Thaw | Free local ice/snow; reveal one neighbouring face. Quench Fire's ignition. |
| Fire + Grove | Blaze | Clear local vines/blooms; the Fire cast can kindle vulnerable cards. |
| Water + Frost | Ice bridges | Leave ice ground, anchor its cards immediately, douse local fire. |
| Water + Grove | Irrigation | Leave roots, douse local fire, charge one nearby card. |
| Frost + Grove | Frostbloom | Charge up to two nearby cards. |

Storm conducts every cast into a one-card reveal. Charge uses the same per-turn alchemy ledger as
kin charging so overlapping stages do not double-charge the same card. Local chemistry does not
spend, fake or increment the primed-streak reaction counter. A confluence now also applies both
eligible non-Frost backlashes, fixing the previous primary-only path.

## Presentation and accessibility

Ground appears below the cards and survives their departure: cracked cinders, concentric ripples,
faceted ice and branching roots. Its patterns distinguish materials beyond colour. Four instanced
draws cap draw overhead independently of cell count. Animation stops for reduced motion and low
graphics, while the ground remains readable. Ground meshes do not participate in pointer picking.

The **Casts** guide is available before the first match, works with keyboard/escape/light dismissal,
and describes power and the current arena. Card accessibility labels include their ground and its
rule without exposing hidden pair identities. Cast callouts use the actual cast summary and local
reaction, retaining existing sound and particle event families.
Cast messages are retained separately from weather messages so both appear on a turn where the
arena also acts. Escape dismisses the guide before the gameplay pause shortcut handles it.

## Verification

Targeted tests cover single-pair casts, all six arena chemistries, confluences, immunity retargeting,
root harvest timing, cell anchors after movement, combo/resonance/pop thresholds, high-stack bounds,
input immutability, malformed fields, every-cast events, and immediate Freeze-over protection.
Browser tests play all four single-pair casts and inspect visible field state, card effects, shader
errors, native guide dismissal and phone layout. Browser execution uses a separate headless context
inside the verified noninteractive Windows launcher with one worker and a 25% CPU cap.

The seeded soak exercises all four player profiles and the existing identity, alchemy, completion,
currency, streak and hold invariants. Frequent holds increase the penalty for selecting a card whose
partner is visibly held; comparisons must account for that behaviour in the simulated player.
The final rules-52 sample ran 240 seeded runs (60 per profile), 1,965 cleared floors and 13,710 turns
with zero invariant violations. Mean cleared floors: careful 16.2, average 7.6, sloppy 2.4, wild 6.7.
This is more demanding than the earlier sparse-hold system; the simulator does not avoid opening
the unblocked half of a pair whose partner is held. Holds remain capped at two and the guard always
leaves a playable pair. The soak now resolves pending turns instead of spinning its study action.

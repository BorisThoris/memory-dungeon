# Living elements: current rules (version 56)

Every elemental match casts and paints the field. There is no random activation chance. The card
identity, matched pair, board geometry and next legal pair remain intact. Casts can change resources,
positions, protection, hazards and the chemistry of later matches.

## The four casts

| Match | Benefit | Cost or limitation |
| --- | --- | --- |
| Fire | Burns vines, seeds and ice; ignites vulnerable blocks. Matching a burning pair pays +2 gold. | Burns potential harvests. Each expired fuse costs 1 gold and can spread fire. Steam, Thaw and calm suppress ignition. |
| Water | Douses fire, ripens seeds into 2-gold blooms, rotates vulnerable cards one place. | Changes positions you memorized. Ice, rime and pinned cards anchor against movement. |
| Frost | Douses fire and coats vulnerable blocks in playable rime; matching rime banks a calm turn. | Replaces seeds, losing their harvest. Rime anchors the cards against movement. |
| Grove | Plants playable seeds worth 1 gold each when matched; combo 6 or effective tier 2 creates 2-gold blooms. | Fire destroys the harvest; frost replaces it with protection. |

The incoming element charges cards of its own kind once per turn. Water resists Fire, Fire resists
Frost, Frost resists Grove, Grove resists Water. Other cards receive the cast. Resistance preserves
the card; it does not consume the budget. Combined chemistry bypasses individual card resistance.
Every charge adds resonance when its card is matched; every four charges matched pay one gold.

## Blocks and amplification

Initial reach is two orthogonal steps from every matched source, three in the matching arena (either
half of a confluence). Every three combo and every resonance/focus tier adds a step. Touching cards
of the same element conduct through their entire block, even beyond the initial reach. Empty cells,
matched cards, different elements and diagonal contact break the connection.

Fire, Frost and Grove have a two-card starting budget. Every six combo, two effective tiers, extra
popped pair and multiplier doubling adds one, up to six. The last selected block always finishes:
a two-card budget can affect ten cards when they form one connected block. Water starts at six
cards, plus two for each extra reach step or budget point, also finishing whole blocks. Pins and
existing protection still apply to individual cards. Normal coatings never prevent flipping.

## One chemistry, two scales

Each match paints its source cells and orthogonal neighbours. The two player-selected cards, sorted in board order,
choose the first different material. Neighbour patches and extra burst pairs do not choose chemistry. Painted ground
wins over arena material on that cell. Bare cells use the arena, or its secondary element when the
primary matches the cast. One local reaction occurs per cast, at power 1, affecting nearby cards.

Two consecutive matches of the same element prime the streak. Matching a different element triggers
the same recipe across the board at amplified power: streak length + half the spent element tier
+ half Storm depth, rounded down separately. It also bursts up to that many extra pairs of each
reacting element. A miss breaks the streak and sheds resonance from the missed elements.

| Combination | Recipe at power p | Ground at power 1 |
| --- | --- | --- |
| Fire + Water: Steam | Douse fire; reveal up to p faces until the next flip. | Reveal one neighbouring face; suppress Fire ignition. |
| Fire + Grove: Blaze | Burn vines, seeds and blooms; gain ceil(p / 2) gold. | Clear local growth; +1 gold. |
| Fire + Frost: Thaw | Melt ice, snow and rime; gain 25 × p² score. | Clear local ice; +25 score; suppress Fire ignition. |
| Water + Frost: Freeze-over | Douse fire; calm the arena for p + 1 turns. | Leave ice ground and bank two calm turns. Creation-turn weather and fuse countdown are suppressed too. |
| Water + Grove: Flood | Ripen seeds into 2-gold blooms; both elements gain p resonance. | Leave roots; +1 Water and Grove resonance. |
| Frost + Grove: Frostbloom | Charge up to p cards nearest the match. | Charge one nearby card. Shared turn ledger prevents double charging. |

Ice ground anchors the occupying card against elemental currents, wind and lightning, without
blocking flips. Ground stays with the cell when a card moves. Overwriting ice removes that anchor,
but any rime on the card remains until melted. Matching on previously planted roots harvests +1
gold once per turn. Storm reveals an additional nearby face not already revealed by local chemistry.
Ground lasts until overwritten or the next floor; changing it changes the next local reaction.

## Ordering and feedback

`realm-weather-rules.ts` resolves match harvests and resonance, local ground chemistry, the ordinary
cast, amplified chemistry, clocks, weather and the hold fairness guard. Reactions share
`resolveElementReaction`; their names, rewards and previews share the same definitions. Ground
uses a nearby scope; amplified chemistry supplies the whole floor in nearest-first order. Anchors
are rebuilt after reactions, so melting rime affects the current turn's weather.

`ElementCastGuide` remains available before the first match. It shows the actual last cast receipt,
current strength, all counter relationships, and the name, power, resource outcome and burst size
of each available amplified reaction. The six-combination table and status rules are expandable.
The receipt persists after particles disappear and includes both local and amplified effects.

Terrain, persistent status marks, reaction particles, connected-block beams, counter shields and
charge labels show the same board state. Reduced motion retains static markings. The device-local
Settings → Dev Options → Combo pop effects toggle controls decorative match pops independently.

## Implementation and verification

- `element-group-rules.ts`: reach, block conduction, budget selection and cast consequences.
- `element-alchemy-rules.ts`: immunity, charges and per-turn ledger.
- `element-ground-rules.ts`: source-selected chemistry and cell-bound terrain.
- `element-resonance-rules.ts`: shared six recipes, streak, amplification and preview summaries.
- `realm-weather-rules.ts`: turn ordering, rewards, immediate calm, anchors and fairness.

Tests cover all six recipes in both element orders and both scopes, resource scaling, ground
selection independent of click order, neighbour isolation, large-block propagation, protection,
charge deduplication, harvest payouts and retained tile identity. Authored hall rooms exercise
playable casts, counter/kin blocks and reaction bursts. Browser verification uses real in-game
matches with desktop and phone layouts, headless in a separate context inside the noninteractive
Windows isolation launcher. Run simulations check currency, identity, legal play and progression.

The final rules-56 soak (`tsx scripts/soak-runs.ts --seeds=60 --floors=40 --check`) covered 240
runs, 3,117 floors and 22,681 turns with zero invariant violations. Each run was capped at 40 floors;
34 runs reached that horizon, and the rest exhausted their miss budget. Mean cleared floors were
30.1 careful, 10.2 average, 1.9 sloppy and 9.8 wild. This checks deterministic gameplay invariants,
not human difficulty or universal balance. Authored scenarios and browser play cover what the
simulation cannot: visible blocks, reaction explanations, pop-toggle persistence and responsive UI.

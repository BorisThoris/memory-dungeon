# Elemental finds and the forge

Rules 55 turn the store into a place to shape the same elements the player matches. The game's decision is which pair to remember and match next, in an arena that answers. Purchases should change that decision and its aftermath.

New runs no longer shop for extra misses, peeks, shuffles, bombs, or the four generic relics. Starting tools and the earned miss bank retain their existing role. Rules 54 and earlier keep their original store so an older run is not rewritten midway through it.

## Find, invest, react

Each floor clear awards two essence: one of its final arena's element and one random element. Storm has two random finds. A floor with an elemental reaction awards a third random find. The roll is deterministic from run seed and floor, independent of the board RNG. Clearing again or reopening a shop cannot claim it again. Essence is carried between floors and displayed in the clear payout, Casts guide, inventory and forge.

The forge opens every third floor. All four elements are available; the essence the player found constrains the choice rather than another random stock roll.

| Purchase | Cost | Consequence |
| --- | --- | --- |
| Forge focus | 2 matching essence; 6 gold, then +3 gold per previous rank | A lasting change to that element's casts and +1 effective cast tier per rank |
| Bottle an element | 1 matching essence; 3 gold, then +1 gold per previous bottle of that element | Replace the current streak with two links, ready for the next different elemental match to react |

Only one bottle may be prepared per stop. It does not protect against a miss. Matching its own element extends it normally. Its eventual reaction uses the ordinary arena, resonance, potency and reaction-pop rules; it does not bypass them. Forging does not counterfeit resonance earned through matches.

## Four different investments

- Fire converts up to one burning card reached by the cast per rank into charge. It trades a dangerous fuse for future match power.
- Water reveals up to one card affected by the current per rank until the next flip. Movement becomes information the player can use.
- Frost adds one calm turn per rank when a matched group harvests rime. It rewards choosing protected cards before the arena's next hazard.
- Grove ripens up to one seeded card reached by the cast per rank into a bloom. Harvest it for gold, water other seeds, or sacrifice growth to Fire.

Ranks also add effective cast tiers to the existing reach and target formula. Existing caps on affected targets, counter-element immunity, board fairness and reaction rules remain authoritative. The Casts guide includes forged tiers in its live preview.

Gold, essence and focus belong to the run. There is no permanent profile currency or grind. The choice is immediate preparation versus a lasting elemental specialization, then which arena to enter and which pair to match first.

## Verification

The rules tests cover seeded finds, arena identity, reaction bonuses, exact costs, insufficient funds, one preparation per stop, duplicate clear delivery, next-floor carryover, serialization and actual reaction/cast resolution. The run soak checks essence debits and resource validity on every action, and requires real runs to acquire essence and forge focus. The store browser regression covers keyboard purchase, focus recovery, announcements, accessibility and narrow-screen scrolling.

## Readability

The forge shows an upgrade outcome, duration, cost and any missing resource. The Casts panel starts with four short action summaries and live target/reach counts; precise formulas and status keys are optional details. Arena doors show ground behavior, weather cadence and risks.

Element motion uses the bounded board particle pool. Flat element bodies, thin rims and rune silhouettes remain visible with reduced motion. Flame tongues, droplets, shards and leaves replace the old painted material layers, realm veils and full-screen weather drawings. Coatings and hazards emit distinct edge particles; small badges retain fuse/freeze counts, harvest values and holds. Ground emits at its fixed cells, including after a card leaves. Combo-pop suppression does not suppress elemental particles.

# Back to the base: the game-design dogmas, applied

2026-10-30. The owner, after rules 104 made the crawl (a hero and monsters on the board) the whole
game: "this game is a hot mess now. The o.g. base is really solid, but it was just missing
something. Let's take a few steps back, analyze all video game dogmas and apply them, strip the
needless new bloat." Asked what stays: "bosses and warriors and stuff like that. Card gimmicks,
elements and impactful items work. Perhaps the combo system needs to be made really addictive."
Asked what goes: the crawl. The other recent systems "need to be connected coherently, visible and
easy to understand".

So the brief has three parts: **strip** the crawl (rules 105, done), make the systems we keep
**read as one game**, and make **the combo the hook**. This file is the dogma pass that picks the
changes; each row names what the game does today and the smallest change that applies the rule.
The guard against the reflex that made the mess: every change here works on the flip-two verb or
on how existing systems read. None adds a system.

## What a player sees today (rules 105, after the strip)

- A match pays `20 + 5 x level + 10 x streak` score (`scoring-rules.ts` `calculateMatchScore`): the
  combo adds ten a link. Score buys nothing in the Descent; gold does, and gold comes from floor
  clears, bosses and relics, **never from the combo**.
- The HUD shows the combo **twice, by two rules that disagree**. The left ladder (Lone, Clean,
  Sharp, Fever) is momentum against rungs that scale with the floor's pairs (`chain-tier-rules.ts`:
  Sharp at 55% of the pairs, Fever at 75%). The label under it is the heat stage (Warm 3, Hot 6,
  Blazing 10, Inferno 16, Legendary 25, `combo-heat-rules.ts`) in a temper's words picked per seed,
  so it reads "15 COMBO · STORM". Two ladders with different steps, and a word that changes run to run.
- The big "x8" beside the combo is `chainRungScoreMultiplier`, which multiplies **only the pairs a
  pop takes** (about two at Fever). The player reads x8 as "my matches are worth eight times".
  They are not.
- A miss resets the combo. Outside pass-and-play nothing says what was lost.
- Bosses (the Colossus, the act bosses, the Warden), elements (casts, resonance, reactions) and
  items each keep their own counter and clock. None of them is moved by the combo, so the one thing
  the player is building does not touch the things they fight and buy.

## The dogmas

| # | Dogma (source) | Today | Change |
|---|---|---|---|
| 1 | **The core verb is the game** (Miyamoto: "find the fun" first; Rogers' core loop). Everything feeds or reads the verb. | Flip-two is solid; the crawl replaced it. | Crawl stripped (done). Everything below works on flip-two. |
| 2 | **One number, one meaning** (readability; Peggle's multiplier reads at a glance because it is one meter). | Two combo ladders and a per-seed word. | One ladder **on screen**, not one in the rules. The two rule ladders stay, each for its measured reason: the pop's rungs scale with the floor so Fever stays a peak (`chain-tier-rules.ts`), and the heat stages are fixed counts that climb without end and gate the three board perks (Afterglow, BreakPairBonus, BreakReachBonus). The HUD shows the combo count as the headline, one multiplier beside it, and the pop's rung as a board effect (the rail's ticks and flames). The temper keeps its colours and loses its words on the HUD. |
| 3 | **The HUD tells the truth** (a number the rules do not pay is a lie the player plans around). | x8 is the pop's multiplier, not the match's. | The multiplier shown is the multiplier every match is paid at. |
| 4 | **Multiplicative beats additive** (Balatro chips x mult; Tony Hawk's combo x tricks; Tetris back-to-back). Additive bonuses flatten; multipliers make the long streak the plan. | +10 score a link. The repo's own thesis asked for this (`docs/THESIS_THE_ADDICTIVE_LOOP.md`, recommendation 3) and it was never done. | The match is paid base x the combo's multiplier, a ladder that climbs without end (the owner's rule: `comboDepth`, `comboSoftCap`). |
| 5 | **Rewards must be spendable** (Skinner's variable reward is only a reward if it buys something; Balatro's interest; Slay the Spire's gold). | The combo pays score, and score buys nothing. | The combo pays **gold** at its rungs, so a streak buys the impactful items at the store. Combo -> gold -> items that protect or grow the combo: the loop closes. |
| 6 | **Loss aversion makes a streak tense** (Kahneman; the slot machine's "near miss"; Tony Hawk's bail). The stake must be visible to be felt. | A miss resets silently. | On a miss the combo breaks loudly: the count shatters, and the HUD says what went (the combo and the multiplier). On the rung before the next, the meter leans in (it already has `rung-imminent`). |
| 7 | **Juice on the verb** (Jonasson & Purho, "Juice it or lose it"; Peggle's ascending scale). | Match takes by tier, the pop climbs a scale; the match itself does not climb. | Each link of the combo plays a step higher on the cascade's own scale (A-B-D-E), so the ear counts the streak. |
| 8 | **Systems talk to each other** (Sid Meier's interesting decisions come from systems that touch; Breath of the Wild's chemistry). | Bosses, elements and items each run alone. | The combo is what they read: a Colossus hit at Fever lands twice, an element cast grows with the combo's rung. One system the player builds, the others answer it. |
| 9 | **Teach, test, twist, one idea at a time** (Nintendo's kishotenketsu levels). | Gimmicks arrive on a schedule with a line of text. | Kept: the Codex and the floor's banner. No change this pass. |
| 10 | **The player always knows why they lost** (Spelunky, Slay the Spire's death screen). | The results screen names the miss bank. | Kept; the combo-lost beat in 6 also says why the run turned. |
| 11 | **Flow: challenge rises with skill** (Csikszentmihalyi; Chen). | The miss bank and `gate:warden-reach` hold it. | Kept. Any combo change is re-measured against `gate:warden-reach` and the soak. |
| 12 | **Easy to learn, hard to master** (Bushnell). | Many words on screen at once. | The ladder gets one set of words; the goal line and milestone banner stay out of the way of the board. |

## The plan, in order

1. **Strip the crawl** (rules 105). Done: commit a8562b35, live on main 685121d2.
2. **One combo, told truthfully** (2, 3): a display change, no rules change. The headline combo,
   the multiplier a match is paid at, no per-seed word on the HUD. Test ids (`hud-combo`,
   `hud-combo-stage`, `hud-chain-rung-value`, `hud-chain-meter`) keep their names.
3. **The combo multiplies and pays** (4, 5): the match is paid at the multiplier, and rungs pay
   gold. A rules bump (106). `calculateMatchScore` also feeds Endless's rent
   (`endless-rent-rules.ts`), so re-measure the rent with it, and the Warden gate and the store prices.
   **The owner picks the shape first**: matches paid at the multiplier, the combo pays gold, or both.
4. **The streak is felt** (6, 7): a loud break with what was lost; a rising note per link. Done: the HUD
   holds "Lost 13 · ×11", struck through, as a miss breaks a combo of three or more (`hud-combo-lost`);
   the rising note was already there (`comboVoicing.ts` steps each link up the cascade scale).
5. **The systems answer the combo** (8): the Colossus hit at Fever and the element cast by rung. Done
   in rules 107: a Colossus hit at Fever lands twice (`comboColossusBlows`, hall room `colossus-fever`);
   the element cast already grew with the combo (`elementCastPower`: reach every 3 links, targets every 6).
   A rules bump (107) with the full checklist (graph, census, hall room, soak).

Each step ships on its own, and each gets a look at the playtest screenshots before the next one.

# Endless god-run progression — implementation contract

The requested end state replaces the three capped camp upgrades with randomized, stackable perk builds. Perks must have real advantages, drawbacks and interactions. Long runs must grow into actual million-card fields, with automation and spectacular mass clearing such as meteors. A large number printed above an unchanged 48-card board does not satisfy this objective.

## Player loop

Keep the opening memory lessons. The run then expands into increasingly large card fields. A focused memory hand remains a source of deliberate input: successful matches charge clearing engines and amplify their output. The player can inspect the whole field, focus on playable cards, and aim a meteor at a location. Automated engines eventually sustain the run, while active play accelerates it. Clears create larger fields and higher rewards; later runs can hold millions of live logical cards at once. New waves continue beyond the population milestones rather than ending at a victory screen.

Every third clear offers three seed-random perks with their benefit, drawback, stacking behavior and relevant owned-perk combinations. Gold funds a choice, a priced reroll or immediate supplies. Passing remains possible. Offer generation must not strand a run without a useful engine. Replace the current fixed, three-rank purchase ladder in the live flow. Existing save/replay rule versions retain their deterministic behavior.

Build families to implement and balance:

- Meteors: concentrated bursts, charge/cooldown costs, impact area and secondary strikes.
- Chain reactions: spread clearing beyond the first impact; trade immediate burst for propagation.
- Memory/automation: matched hands feed automatic engines; unattended output has a stated limitation.
- Replication/growth: more live cards and greater income, but more work to clear a wave.
- Greed/glass builds: stronger income or damage in exchange for reduced mistake tolerance or recovery.
- Recovery/control: survival and charge reliability at a damage or income cost.

Combinations must alter simulation results, not just display a combo badge. Examples: meteor impacts feed chain propagation, replicated cards pay amplified harvest income, and active matches temporarily overdrive automatic clearing. No individual engine should be mandatory for a million-card run.

## Scale architecture

Ordinary Tile objects and per-card React meshes remain appropriate for a focused hand, not the entire field. The mass field uses deterministic card identities and a compact alive-pair bitset. Every visible card has a logical cell and pair; mass clearing changes those cells, preserves whole pairs, and awards only newly removed cards. Rendering must read that state and show cleared regions. Effects are batched and bounded independently of the number of cleared cards.

The renderer uses a bounded number of GPU primitives, zoom/pan and density detail appropriate to the screen. A million cards cannot each occupy a legible square on a phone simultaneously, so zooming reveals detail while the full view shows the actual field. Preserve usable touch controls, an accessible focused hand, reduced motion and low-quality fallbacks. Never allocate one DOM node, mesh, timer or particle per mass-field card.

Simulation advances in bounded deterministic steps. Pausing, camp, settings, background tabs and game over cannot create uncontrolled time catch-up. Repeated or overlapping impacts do not duplicate rewards. Run restart resets the build. Serialization and restored state must keep counts, seed, purchases and engine timing consistent.

## Completion evidence required

1. Current normal endless play reaches randomized perk choices with live pros/cons and stack/combo explanations.
2. At least three substantially different builds complete sustained simulated runs and reach million-card populations through the real progression rules.
3. Actual fields of at least 2,097,152 cards support exact counts, seeded identity, mass clearing, overlapping impacts and serialization without per-card objects.
4. Measure engine memory and clear latency at million-card scale. Verify the browser renderer's draw/instance budget and responsiveness at that scale in the isolated session.
5. Meteors and at least one automated clearing engine visibly affect the field, award exact resources and interact with perks. Input and effects remain usable on desktop, portrait phone and landscape phone.
6. Verify real UI flow from fresh run through a camp, build changes, field growth and restart; verify late-game UI using a state produced by simulation rather than an arbitrary displayed counter.
7. Update current guides, practice rooms, simulations and repository model. Run appropriate tests, type checks, production build and relevant audits.
8. Push the completed change to main, deploy, and verify that production serves the built assets. Do not mark this goal complete while any of these requirements is unproven.

## Implemented player rules (59)

Solo endless play keeps the first three memory floors, then opens the constellation forge. Legacy rules, wild runs and shared-table runs keep their previous flow. Every third mass-field clear returns to the forge. Skipping a purchase is allowed, and every offer includes an engine. Perks stack beyond rank three; each card explains its benefit, downside, stacking and combinations with owned perks.

The 12 perks are Comet Core, Archive Swarm, Focused Memory, Orbital Echo, Static Lattice, Overclock, Replicator, Midas Ash, Greed Contract, Glass Mind, Deep Memory and Living Roots. Their numerical effects live in `god-run-perks.ts`, and all are consumed by `god-run-engine.ts`. Golden Crater adds a further 25% burst income, Working Memory overdrives archivists for five seconds after a match, Tempered Glass heals after a sufficiently large meteor, and echo impacts feed the same chain propagation as primary impacts.

Waves begin with 64 cards and double. Wave 16 reaches 2,097,152 cards without Replicator. The bounded field reaches 67,108,864 at wave 21; wave number, build stacks and gold value continue beyond it. Replicator reaches population milestones earlier. Beyond the density limit, gold per cleared pair doubles each wave. Whole gold and fractional microgold use decimal integer strings and BigInt arithmetic, so the economy does not overflow JavaScript's safe integer range.

At a forge, a perk costs `floor(8 × 2^wave × (100 + 35 × owned rank) / 100)` gold. One perk can be bought per stop. Rerolls cost `3 × 2^wave × (1 + rerolls this stop)`; a restored miss costs `4 × 2^wave × (1 + supplies this stop)`. Prices are visible before spending. Higher ranks can require saving across stops. A clear restores one miss up to build capacity; the first wave carries the opening run's miss bank. A mismatch on an already empty bank ends the run.

The focused hand contains up to six real surviving pairs. Matching releases a spatial burst and earns charge. Automatic clears can remove hand cards; invalid pending flips are cancelled without duplicate rewards or penalties, and exhausted hands receive a fresh study window. Meteors unlock at wave 3 or immediately with Comet Core. Tap the field to aim, or use **Aim at survivors**, then **Call meteor**. Zoom and directional buttons inspect the field without pointer lock. Keyboard users can tab through every card and control, and activate with Enter or Space.

The field uses one integer alive texture and two triangles. At full view, a pixel samples four actual field cells; zoom resolves individual cards. There are at most eight simultaneous impact records, procedural sparks and shockwaves, and one current callout. New callouts replace old ones; there is no text queue. Reduced motion removes traveling sparks and expanding rings. Low quality caps field resolution. WebGL2 failure or context loss switches to a pixel-bounded canvas view of the same live cells.

Pause, settings, the forge and hidden tabs stop simulation work. A single time step is capped at 250 ms, so returning to a background tab does not replay an unbounded backlog. Checkpoints use IndexedDB, with one current constellation slot, saved at the forge, on pause/background, every 15 seconds and explicitly with **Save & leave**. The main menu offers **Resume constellation**. Save failures remain visible; checkpoints include the real field, hand, pending turn, build, currency and engine clocks. Restart begins with no perks.

## Scale measurements and repeatable verification

Run `node node_modules/tsx/dist/cli.mjs scripts/benchmark-god-run.ts` for accounting assertions and host timing. The October 4 Windows run measured:

| Actual cards | Conservative live-array bytes | GPU bitset bytes | Sample spatial impact | 10% automatic clear |
| ---: | ---: | ---: | ---: | ---: |
| 2,097,152 | 262,144 | 131,072 | 2.75 ms | 0.83 ms |
| 16,777,216 | 2,097,152 | 1,048,576 | 35.76 ms | 2.25 ms |
| 67,108,864 | 8,388,608 | 4,194,304 | 328.40 ms | 12.26 ms |

These are single-host engine measurements, not phone frame-rate promises. Very large partial spatial strikes still visit millions of cells and can take a long frame at the upper density bound; full-field clears and automation use the word path. Storage is bounded independently of the lifetime harvest total.

The same benchmark drove three seeded perfect-memory players through real offer purchases, hand flips, charge generation and wave transitions into wave 22. All reached 67,108,864 live cards and continued past the density limit:

| Build preference | Purchased build at wave 22 | Meteors used | Cards harvested |
| --- | --- | ---: | ---: |
| Comet | Comet Core ×2, Midas Ash ×2, Glass Mind, Orbital Echo ×2, Focused Memory | 28 | 134,217,664 |
| Archive | Archive Swarm ×3, Static Lattice ×2, Overclock | 16 | 134,217,664 |
| Memory | Greed Contract, Replicator ×2, Focused Memory ×4, Glass Mind | 54 | 201,326,016 |

These validate distinct viable builds and exact progression, not human difficulty or retention. The simulator is shared with browser fixtures so late-game screenshots use an earned field rather than a fabricated counter.

`card-field.test.ts`, `god-run-engine.test.ts` and `god-run-save.test.ts` cover pair bijections, meteor geometry against a cell oracle, overlap, automated exhaustion, tradeoffs, uncapped ranks, exact money, hand resolution, pauses, bounded effects, long progression and malformed/round-tripped checkpoints. `e2e/god-run.spec.ts` exercises the opening-to-forge flow, purchase, hand, actual million-card renderer, meteor, responsive layouts and save/resume. Browser work on this Windows machine runs headlessly through the verified noninteractive isolation launcher.

The test hall adds `endless-forge` and `million-card-field`; `store-stop` explicitly remains a rules-58 legacy fixture.

The isolated Chromium flow passed at 1280×800, 390×844, 320×568 and 812×375. It verified a single draw/two triangles and fewer than 180 DOM nodes for a 2,097,152-card field, live meteor rewards, touch zoom, pause, persisted resume, context-loss canvas fallback, recorded final depth and a clean restart. Scoped forge accessibility reported no serious or critical issues. Screenshots are stored locally under `output/playwright/god-*.png`. Final depth and manual-memory records flow through the existing profile summary; automated cards are not counted as remembered matches.

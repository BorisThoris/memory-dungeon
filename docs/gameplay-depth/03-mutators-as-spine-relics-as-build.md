# Mutators as spine, relics as build

## Thesis

**Mutators** change the rules of the puzzle each run (or floor). **Relics** and **contracts** should answer: “Given these rules, what kind of player am I this run?”

Stacking raw numbers alone is less memorable than **combos that rename the strategy** (“Short-memorize build,” “No-destroy scholar,” “Shard racer”).

## Research backbone

### Modifiers as depth without new assets

Gameplay **modifiers** that pair an upside with a downside (or reshape rules) are a standard way to add replayability without strictly increasing content volume ([Kircode — gameplay modifiers](https://kircode.com/en/post/adding-depth-and-replayability-using-gameplay-modifiers), citing examples like *Citadelic*). Your **mutators** already behave like rule modifiers; **contracts** are closer to “hard vows” with compensation potential.

**Design takeaway:** prefer mutators that change **how you think** (information shape, cadence, risk) over mutators that only tweak a scalar, unless that scalar creates a new decision (e.g. parasite cadence changing when you accept a mismatch).

### Roguelite synergy expectations

Players in the *Isaac* / *Risk of Rain* lineage are trained that **combinations** of items can explode in power ([Parry Everything — everything stacks](https://parryeverything.com/2021/12/03/everything-stacks-with-everything-ft-risk-of-rain-binging-of-isaac-etc/)). That culture increases appetite for **build stories**—but your core is a **perfect-information memory puzzle** with a small action set, not real-time combat.

**Tension to manage**

- **Too many exceptions** → extraneous cognitive load (players must read a rulebook in their head).
- **Too few interactions** → relics feel like +1 charges with no fantasy.

**Sweet spot for this project:** *bounded* synergy—each relic interacts with **at most one** mutator tag or contract flag in a predictable way, documented in `RELIC_SYNERGY_PLAYTEST.md` style. Save “Isaac-grade” chaos for optional **Wild** modes if desired.

### Draft as “build episode”

Roguelite engagement articles emphasize **procedural blessings** and category variety (resource, exploration, utility) so runs diverge ([e.g. Wayline on blessing roulette](https://www.wayline.io/blog/blessing-roulette-boosts-roguelite-engagement)). Your relic draft at floors 3/6/9 is already an episode structure; strengthening **mutator-conditioned** offers makes each draft answer the floor spine (see doc 01).

## Current shipped pieces

- **Mutators:** `MutatorId` list on `RunState.activeMutators` — see `MUTATORS.md` hook matrix.  
- **Relics:** `RelicId` on `relicIds`, drafted at floors 3/6/9 — see `RELIC_ROSTER.md`.  
- **Contracts:** `ContractFlags` — `noShuffle`, `noDestroy`, `maxMismatches` (hard constraints that beg for compensating relics or habits).

Forgiveness systems (grace, shards, memorize bonus on life loss) intentionally avoid overlapping relic jobs per `RELIC_ROSTER.md`; new synergy design should **respect that boundary**.

## Synergy patterns (design vocabulary)

### A. Relic that unlocks under a mutator

The relic is weak or neutral baseline, but **strong when** a mutator is active.

| Example | Mutic | Relic hook | Fantasy |
|---------|-------|------------|---------|
| Speed reader | `short_memorize` | `memorize_bonus_ms` amplified only when `short_memorize` active | “I drafted for the daily pain.” |
| Parasite buffer | `score_parasite` | extra parasite floor tolerance or shard-on-parasite-tick | “I’m managing a second clock.” |

Implementation note: either **conditional math** in memorize / advance paths in `game.ts`, or a **new RelicId** with explicit mutator checks via `hasMutator`.

### B. Contract forces a playstyle; relics compensate

Scholar-style contracts already exist (`noShuffle`, `noDestroy`). Builds emerge when **relic offers** skew toward the remaining tools:

- `noDestroy` + `destroy_bank_plus_one` should not drop (invalid); offers must be **filtered** for legality (likely already implied by roster; verify in `relics.ts` when expanding).

**New contract ideas (spec only):**

- **Pacifist** — no destroy; +shard step or higher chain heal cap.  
- **Minimalist** — max N pins total per run; higher score multiplier.  
- **Timer oath** — memorize cap reduced globally; bigger score on clean clears.

### C. Mutator pairs as “archetype spine”

Two mutators that **share a verb** in player language:

- `wide_recall` + `category_letters` → “Reading room” (semantic + label load).  
- `n_back_anchor` + `distraction_channel` (opt-in) → “Split attention lab.”

Relics should not fix everything; they should **accent** one axis (e.g. `combo_shard_plus_step` for chain-heavy mutator sets).

### D. Anti-synergy on purpose

Some relics **get worse** under certain mutators if you want run texture:

- `first_shuffle_free_per_floor` is useless under `noShuffle` contract — draft pool must exclude or swap.  
- Destroy-bank relics under `glass_floor` need crystal-clear decoy rules (already noted in `RELIC_SYNERGY_PLAYTEST.md`).

## Relic expansion candidates (aligned with this doc)

From `RELIC_ROSTER.md`, “second pin slot” and raw score multipliers were deferred. Better fits for **build fantasy**:

- **Anchor buddy** — every N anchor refreshes (under `n_back_anchor` only), or peek charge.  
- **Row/swap shuffler** — improves `rows_only` shuffle or grants a free row shuffle / tile swap (Search tier).
- **Parasite ward** — one-time ignore of parasite life loss (narrow, test vs `MAX_LIVES`).

Each should be checked against the forgiveness deep dive so we do not double-heal the same failure mode.

## Content pipeline

1. **Tag mutators** with design tags in data (`pressure: time | space | sequence | information | economy`).  
2. **Tag relics** with `tags: ['memorize', 'shuffle', 'destroy', 'shards']` and optional `requiresMutator` / `forbiddenWithContract`.  
3. **Draft filtering** — when opening `relicOffer`, filter options by `activeContract` + `activeMutators` + already-owned relics.  
4. **Telemetry (future)** — pick rates conditional on mutator presence to validate synergy feel.

## Risks

- **Complexity ceiling** — too many conditional relics → unreadable draft. Cap **one** conditional rule per relic.  
- **Balance whack-a-mole** — conditional multipliers need caps (`MEMORIZE_MIN_MS` already guards memorize floor).  
- **Daily fairness** — daily runs with a single mutator should still offer **at least two** understandable relic paths.

## Open questions

- Should synergistic relics appear **more often** when mutator matches, or stay rare for excitement?  
- Is it OK for a relic to be **dead** on some floors if later mutators rotate in (if using floor-scripted mutators from doc 01)?

## Worked example: three “build stories” (paper design)

These are **narratives** players might tell; use them to audit whether mutators + relics + contracts can support them.

1. **Scholar of entropy** — Contract: `noDestroy`. Mutators: `sticky_fingers`, `wide_recall`. Relics: `first_shuffle_free_per_floor`, `extra_shuffle_charge`. Story: “I rearrange the board constantly because I can’t remove pairs.”

2. **Parasite accountant** — Mutator: `score_parasite`. Relics: `combo_shard_plus_step`, `destroy_bank_plus_one`. Story: “I’m racing the parasite clock and using shards/heals as buffer.” *Requires* clear UI on parasite ticks (tension/release per [Game Developer — tension](https://www.gamedeveloper.com/design/addressing-conflict-tension-and-release-in-games)).

3. **Speed demon** — Mutators: `short_memorize`, `category_letters`. Relics: `memorize_bonus_ms`. Story: “Letters punish lazy visual memory; I bought time at the draft.”

If a story has **no** supporting relic path in practice, either add a narrow relic or **don’t** combine those mutators in generation.

## Further reading

- [RELIC_SYNERGY_PLAYTEST.md](../RELIC_SYNERGY_PLAYTEST.md) — keep this matrix updated as conditional relics ship.
- [Roguelite design analysis (Anchor)](https://anchor.blot.im/roguelite-design-analysis/) — general pacing / run arc vocabulary (secondary to your own docs).

**Repo backlog:** concrete tickets **R-01–R-03**, **C-01** → [05-app-specific-idea-backlog.md](./05-app-specific-idea-backlog.md).

# Game Forgiveness Code Audit

## Scope
This document audits [docs/GAME_FORGIVENESS_DEEP_DIVE.md](./GAME_FORGIVENESS_DEEP_DIVE.md) against the current runtime implementation in `src/`.

Goal:
- confirm what the older deep dive still gets right,
- call out what is now outdated,
- explain why players are still likely to stall around floors 4-5,
- and leave an implementation-ready recommendation.

Audit date: 2026-04-03

---

## Current Runtime Snapshot

### Progression and fail pressure
- Pair count still scales as `min(level + 1, 26)`.
  - Source: `src/shared/game.ts:173-188`
- Memorize duration still scales as `max(MEMORIZE_MIN_MS, MEMORIZE_BASE_MS - MEMORIZE_STEP_MS * (level - 1))`.
  - Source: `src/shared/game.ts:124-125`
- Current tuning constants are still:
  - `INITIAL_LIVES = 4`
  - `MAX_LIVES = 5`
  - `MEMORIZE_BASE_MS = 1200`
  - `MEMORIZE_STEP_MS = 60`
  - `MEMORIZE_MIN_MS = 450`
  - Source: `src/shared/contracts.ts:2-8`
- A normal mismatch still costs one life if no protection is active.
  - Source: `src/shared/game.ts:356-372`

### Skill-reward systems already present
- Perfect clears still grant `+1` life, capped by `MAX_LIVES`.
  - Source: `src/shared/game.ts:252-260`
- Match score still scales with level and streak.
  - Source: `src/shared/game.ts:137-142`, `src/shared/game.ts:329-332`
- Streaks now have real survival utility:
  - every 4-match streak grants a guard token,
  - every 8-match streak restores one life,
  - guard tokens are capped at 2.
  - Source: `src/shared/contracts.ts:9-11`, `src/shared/game.ts:324-328`
- Guard tokens persist between floors, but `currentStreak` resets on floor transition.
  - Source: `src/shared/game.ts:401-407`

---

## What The Older Deep Dive Still Gets Right

The following parts of `docs/GAME_FORGIVENESS_DEEP_DIVE.md` remain accurate:

- The core difficulty curve description is still correct.
  - Board size rises every floor.
  - Memorize time compresses every floor.
  - Source: `src/shared/game.ts:124-125`, `src/shared/game.ts:173-188`
- The life envelope is still narrow at `4` starting lives and `5` max lives.
  - Source: `src/shared/contracts.ts:2-3`
- The recommendation to soften the memorize curve is still sensible and still low-risk.
- The recommendation to broaden recovery beyond perfect-only play is still sensible.
- The recommendation to add tests around mismatch protection and floor transitions is still correct.

In short: the original diagnosis of a mid-game difficulty cliff still mostly holds.

---

## What Is Outdated Or Contradicted By Current Code

### 1. "Streaks increase score but do not protect lives" is no longer true
The old document says streaks only affect score.

That is outdated. Current code already gives streak-based protection and sustain:
- guard token on every 4th streak,
- life heal on every 8th streak,
- guard token consumed before life on mismatch.

Sources:
- `src/shared/contracts.ts:9-11`
- `src/shared/game.ts:324-328`
- `src/shared/game.ts:357-367`
- Tests: `src/shared/game.test.ts:72-94`, `src/shared/game.test.ts:152-187`

### 2. "Phase 2: add streak-to-survival mechanic" is partially already shipped
The old rollout treats streak-based survival as a future phase.

That is also outdated. The active game already has a streak-to-survival mechanic through guards and chain-heal.

### 3. The doc understates why current streak rewards are not solving the floor-4 wall
The document is directionally right that players still feel punished, but it misses an important runtime nuance:
- the first guard only arrives at streak 4,
- the first heal only arrives at streak 8,
- and streak reset on every floor (fixed at Gen 262: `chain-carryover-rules.ts` carries one link across the stairs, so a clear no longer wipes the chain).

That means early and mid-game players often die before the reward system becomes relevant.

### 4. The document has encoding artifacts
There are multiple mojibake sequences like `вЂњ` and `вЂќ` in the markdown. The content is readable, but the file should be cleaned up if it remains user-facing or team-facing.

Source:
- `docs/GAME_FORGIVENESS_DEEP_DIVE.md`

---

## Why Floors 4-5 Still Feel Harsh

The main issue is not that the game lacks rewards for skill.

The issue is that the meaningful rewards are backloaded.

### Practical threshold problem

| Floor | Pairs | Guard reachable? | Heal reachable? | What that means |
|---|---:|---|---|---|
| 1 | 2 | No | No | No survival reward exists yet |
| 2 | 3 | No | No | Still pure life-loss gameplay |
| 3 | 4 | Yes, but only at the end of a flawless floor | No | First guard is too late to help that floor |
| 4 | 5 | Yes, late in floor | No | Players struggling here still pay most mistakes with lives |
| 5 | 6 | Yes, once | No | Reward exists, but arrives after several already-correct reads |
| 6 | 7 | Yes, once | No | Still no heal access |
| 7 | 8 | Yes | Yes, only on a full 8 streak | First life-heal floor is already late-game for most players |

This is why the game can already contain "skill rewards" and still feel unforgiving:
- the rewards are real,
- but they mostly help players who are already performing well enough to survive into later floors.

### Simultaneous pressure ramps
By floor 4 the player is already at:
- `5` pairs / `10` tiles,
- roughly `1020ms` memorize time.

By floor 5:
- `6` pairs / `12` tiles,
- roughly `960ms` memorize time.

That is exactly where average players start paying encoding errors with immediate life loss.

Sources:
- `src/shared/game.ts:124-125`
- `src/shared/game.ts:173-188`

---

## Player-Facing Reward Surface Today

### What players currently get
- Score growth from level and streak.
- Guard tokens in-run.
- Life restoration from:
  - perfect clear,
  - 8-streak chain-heal.
- Meta achievements and run-summary stats.

Sources:
- `src/shared/game.ts:252-260`
- `src/shared/game.ts:324-348`
- `src/shared/achievements.ts:37-61`
- `src/shared/game.ts:468-479`

### What does not currently happen
- Achievements do not feed power back into the run.
- There is no relic, perk, inventory, or choice-based reward system in the active `src/` app.
- The active level-clear modal does not explain why a life was or was not restored.

Sources:
- `src/shared/achievements.ts:37-61`
- `src/renderer/components/GameScreen.tsx:230-261`

### Communication gap
The menu/onboarding already teaches guards and chain-heal:
- `src/renderer/components/MainMenu.tsx:107`
- `src/renderer/components/MainMenu.tsx:131`

But the active gameplay HUD mostly shows state, not rule explanation:
- HUD shows lives, guards, and score.
- Clear modal shows rating, mistakes, lives, and total.
- No active rule copy explains forgiveness or reward logic in play.

Sources:
- `src/renderer/components/GameScreen.tsx:136-145`
- `src/renderer/components/GameScreen.tsx:236-261`

---

## Recommended Updated v1 Bundle

The original deep dive's v1 bundle is still the right direction, but it should now be framed as:

1. Soften memory compression.
2. Add an early-floor safety valve.
3. Broaden floor-clear recovery.
4. Leave existing guard/heal systems intact for now.

### Recommended changes

#### A. Memorize curve softening
Change:
- `MEMORIZE_BASE_MS: 1200 -> 1300`
- `MEMORIZE_STEP_MS: 60 -> 50`
- `MEMORIZE_MIN_MS: 450 -> 600`

Why:
- Lowest-risk tuning change.
- Gives more read time where the wall currently happens.

Files:
- `src/shared/contracts.ts`

#### B. First mismatch each floor is life-free
Rule:
- First mismatch still increments `tries`.
- First mismatch still increments `mismatches`.
- First mismatch still breaks streak.
- First mismatch does not consume life unless a separate guard rule should intentionally take priority.

Why:
- Immediate relief exactly where the current system is weakest.
- Uses existing per-floor `tries` reset, so it needs no persistence changes.

Files:
- `src/shared/game.ts`
- `src/shared/game.test.ts`

Implementation note:
- The mismatch branch already computes `tries = run.stats.tries + 1`.
- A clean implementation can derive a `hasGraceMismatch = run.stats.tries === 0` before life subtraction.

Source area:
- `src/shared/game.ts:356-381`

#### C. Clean-clear life restore
Rule:
- Keep perfect clear identity.
- Grant `+1` life for `mistakes <= 1`, capped by `MAX_LIVES`.
- Keep perfect clear score bonus separate.

Why:
- Makes recovery available to disciplined players, not only flawless ones.
- Preserves the meaning of S++ / perfect floors.

Files:
- `src/shared/game.ts`
- `src/shared/game.test.ts`

Source area:
- `src/shared/game.ts:252-283`

#### D. Copy updates
Minimal updates:
- Level clear modal should explicitly state when a life was restored and why.
- Gameplay screen should surface the first-miss grace rule if shipped.

Files:
- `src/renderer/components/GameScreen.tsx`

---

## Alternatives If You Want More "Skill Reward" Instead Of Raw Forgiveness

If the goal is specifically "reward skill" rather than "make the game easier," these are the lowest-complexity options in the current architecture:

### Option 1. Lower the first guard threshold
Change:
- `COMBO_GUARD_STREAK_STEP: 4 -> 3`

Why:
- Makes skill reward arrive before the player is already nearly done with the floor.
- Reuses the existing guard system.

Risk:
- Stronger snowballing if combined with first-miss grace and clean-clear life gain.

### Option 2. Use floor-quality rewards instead of more starting lives
Rule ideas:
- `mistakes === 0`: +1 life
- `mistakes <= 1`: +1 guard
- `rating === A or better`: bonus score burst

Why:
- Rewards strong play directly.
- Easier to explain than a full relic system.

### Option 3. Add lightweight run modifiers every 2-3 floors
Examples:
- +1 starting guard next floor
- +10% match score for next 2 floors
- one extra grace mismatch on next floor only

Why:
- Adds roguelike flavor without reviving the archived inventory stack.

Risk:
- Requires new state and clearer UI language.

---

## Implementation Checklist

### Code
- Update constants in `src/shared/contracts.ts`.
- Update mismatch resolution in `src/shared/game.ts`.
- Update level-finalization life award logic in `src/shared/game.ts`.
- Update level-clear and HUD copy in `src/renderer/components/GameScreen.tsx`.

### Tests
- Add/adjust tests in `src/shared/game.test.ts` for:
  - first mismatch on floor does not reduce life,
  - second mismatch does reduce life,
  - clean clear grants life,
  - perfect clear still grants life and score bonus,
  - floor transition resets grace state through `tries`.
- Consider a light store-level timer flow regression in `src/renderer/store/useAppStore.test.ts` if the UI messaging depends on run-state transitions.

### Docs
- Update or replace `docs/GAME_FORGIVENESS_DEEP_DIVE.md` once the implementation direction is chosen.
- Clean the mojibake in that older file if it remains the canonical note.

---

## Final Recommendation

Do not start by adding a full reward system.

The active game already has score rewards, guard rewards, heal rewards, achievements, and run-summary stats. The problem is that the survival-relevant rewards arrive too late for the players who need them.

Ship this first:
- soften memorize timing,
- make the first mismatch on each floor life-free,
- grant life on clean clears,
- and explain the rule clearly in the gameplay UI.

If that is still not enough, the next best move is not more lives. It is making the existing skill reward arrive earlier, most likely by lowering the guard threshold from 4 to 3.

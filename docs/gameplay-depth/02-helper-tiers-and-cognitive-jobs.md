# Helper tiers and cognitive jobs

## Problem

Powers that only **fix logistics** (shuffle, pin, destroy) can feel like quiet menu actions. Grouping them by **cognitive job** helps players build a mental loadout and helps designers tune **fantasy, feedback, and tradeoffs** per tier.

## Research backbone

### Game feel and “juice” make verbs legible

**Game feel** (Steve Swink, *Game Feel*, 2009) is often summarized as the subconscious quality of **real-time control**—input latency, motion, collision, polish. Even in a **turn-ish** memory game, the *moment* of using a power shares the same design space: players should **feel** the difference between Recall, Search, and Damage control.

Industry distillations describe **juice** as layered feedback: motion, sound, particles, animation **contrast** so important actions pop ([Game Developer — Game feel overview](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient); [juice primer](https://www.slashskill.com/game-feel-and-juice-the-complete-guide-to-making-your-game-satisfying/)).

**Implication for helpers**

- Same *duration* of animation is not enough; **tier-specific** color, SFX, and camera/board micro-motion sell the fantasy.
- **Disabled** states should be as readable as enabled ones—you already pattern this with shuffle destroy strings in `GameScreen.tsx`; extend the *voice* per tier (“No targets for Recall” vs “Search needs 2+ hidden pairs”).

### Cognitive job = different mental subroutine

Cognitive load writeups stress **one new concept at a time** and reducing extraneous UI noise ([cognitive load + games](https://medium.com/@somogybourizk/game-design-and-cognitive-load-4a6dfaa949f2)). Tiering powers by job matches how players **chunk** strategy:

- **Recall** — re-encode or hold information in WM.
- **Search** — reduce spatial uncertainty without changing symbol identities.
- **Damage control** — rewrite state / undo commitment / pay cost to reduce variance.

When a button’s job matches the player’s *current* failure mode (“I forgot where” vs “I’m lost in layout” vs “I’m about to lose a life”), the helper feels **smart**, not like a generic cheat.

### Meaningful choice = informed tradeoff (brief)

Sid Meier’s “interesting choices” mantra (often paraphrased in design talks) boils down to: multiple viable options where **what you give up** is clear. Damage-control tier powers should always telegraph **opportunity cost**—score, charges, parasite tick, achievement flags (`powersUsedThisRun`), etc.—so spamming them feels like a *build decision*, not housekeeping.

## Three tiers

### Recall

**Job:** Bring information back into working memory without clearing the puzzle.

- **Pin** (`pinnedTileIds`, cap `MAX_PINNED_TILES`) — holds known locations.
- **Peek** (`peekCharges`, `peekRevealedTileIds`) — ephemeral reveal; already distinct from committed flips.
- **Extensions (ideas)**  
  - **Flash pair** — reveal one random *unmatched* pair for T ms (noise vs value; high skill ceiling if players track context).  
  - **Echo emphasis** — lean on existing `echoFeedbackEnabled` / mismatch timing as a “recall assist” narrative.

**Design lever:** Recall tools should feel **time-bound** or **slot-bound** so spam does not replace memory.

### Search

**Job:** Change **where** to look or **how** tiles are arranged, not what they are.

- **Shuffle** (`shuffleCharges`, `shuffleNonce`, `applyShuffle`) — full reorder.
- **Weaker shuffle** (`weakerShuffleMode`: `full` vs `rows_only`) — already a search-space knob.
- **Extensions (ideas)**  
  - **Region shuffle** — only permute tiles in a rectangle or row band (keeps some spatial memory valid).  
  - **Sort once** — deterministic ordering by category or pair key (one charge per run); strong for letter sets (`category_letters`) but readable.  
  - **Focus assist** — existing `tileFocusAssist` in settings is a passive search aid; could tie to a relic tier.

**Design lever:** Search tools should **telegraph scope** (“this row only”) so the button press is a visible event.

### Damage control

**Job:** Undo bad outcomes or skip painful states; usually the highest **moral hazard** tier.

- **Destroy pair** (`destroyPairCharges`, `applyDestroyPair`) — removes a pair for no score; gated with `glass_floor` decoy rules.
- **Undo** (`undoUsesThisFloor` on `RunState`) — limited per floor.
- **Stray remove** (`RunState.strayRemoveCharges`; transient renderer `strayRemoveArmed`) — narrow escape hatch for specific tile pressure without durable UI intent.
- **Gambit / wild** (`gambitAvailableThisFloor`, `wildTileId`, `wildMatchesRemaining`) — risk/reward shape.

**Design lever:** Tie these to **visible systems** so the press feels like a save or a gamble:

- **Streak / chain** — “Using destroy now costs your next shard milestone” or “resets combo counter” (tune to forgiveness doc).
- **Score parasite** — “Destroy pauses parasite for 1 floor” vs “Destroy advances parasite” (readable tension).
- **Glass floor** — destroy on decoy already special-cased; surface in UI copy when decoy is on board.

## UI and juice (non-mechanical but high impact)

- **One-line tier hint** in FTUE or codex: Recall / Search / Damage — matches how you already explain powers in `GameScreen.tsx` hints.
- **Distinct SFX + micro-animation** per tier so players **hear** recall vs search vs damage control.
- **Disabled reason strings** already pattern well (`shuffleTitle`, destroy disabled); extend with tier-flavored reasons (“No pairs left to flash”).

## Implementation sketch for new powers

1. Add charge or cooldown fields on `RunState` in `contracts.ts` if persistent across floors.  
2. Single implementation site in `game.ts` (mirror destroy/shuffle patterns).  
3. Renderer: must respect `reduceMotion` and hidden vs flipped state.  
4. Tests: softlock, daily seed reproducibility, contract `noDestroy` / `noShuffle` interaction.  
5. Bump `GAME_RULES_VERSION` if save payload or generation changes.

## Anti-patterns

- **Pure stat sticks** with no timing decision (“+10% memorize”) — boring unless build-defining over many floors (prefer relics for that).  
- **Search tools that accidentally solve recall** — e.g. shuffle that only shuffles **unmatched** tiles into obvious clusters without cost.  
- **Damage control with no telegraphed cost** — players spam and wonder why the run feels empty.

## Advanced: “noisy” Recall tools (flash pair)

A **random unmatched pair flash** is cognitively interesting because it mirrors **partial cueing** in memory research: extra information can help or **interfere**, depending on attention and timing. Design knobs:

- **Signal** — duration, size, whether both tiles flash together or sequentially.
- **Noise** — pair is random, not player-chosen; strong players extract value anyway.
- **Cost** — charge, score tax, or “advances distraction tick” so it’s not free AP.

Prototype in **practice / wild** first; daily competitive integrity needs explicit rules (seeded pair choice vs true random).

## Open questions

- Should tier be **explicit in HUD** (icons) or left implicit in copy?
- Is “flash random pair” acceptable in ranked/daily, or practice-only?

## Further reading

- Steve Swink, *Game Feel: A Game Designer’s Guide to Virtual Sensation* (2009) — metrics for virtual sensation; adapt feedback timing to flip / match resolution windows.
- [Game Developer — Principles of Virtual Sensation](https://www.gamedeveloper.com/design/principles-of-virtual-sensation) — short article series touchpoint.

**Repo backlog:** concrete tickets **H-01–H-03** → [05-app-specific-idea-backlog.md](./05-app-specific-idea-backlog.md).

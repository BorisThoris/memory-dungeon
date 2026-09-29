# The combo feedback loop, and the arcade tables it is modelled on

**Status:** living reference for the escalating-feedback system (2026-09-29). Owner's brief: the
side combo meter persists across floors until a miss, and everything gets wilder the higher it
stacks - "think the Chinese 8-ball games". This is what those games do, what this game already
did, and what was built to close the gap. Balance figures live in [BALANCE_NOTES.md](../BALANCE_NOTES.md);
the rendering detail in [epic-board-rendering-assists.md](./epic-board-rendering-assists.md).

## What the reference games do

The mobile pool tables (腾讯桌球 / Tencent Pool, DailyPool 天天台球, Pool King, Billiards City and
the 8 Ball Pool clones that fill Chinese app stores) all run the same escalation loop, and it is
the loop and not any one effect that makes them compulsive:

1. **A streak counter that is the headline.** Consecutive pots are counted in a big number that
   punches on every pot. It is the largest thing on the HUD, bigger than the score.
2. **Ranks with names, stamped across the screen.** Cross a threshold and the whole screen gets a
   word - "Brilliant!", "Excellent!", "On Fire!", "Unstoppable!" - slammed in oversized, held for
   a beat, gone. A sting plays under it and the table shakes. The rank is *reached*, not noticed.
3. **The cue and the ball catch fire.** Past a rank the cue takes a flame trail and the ball a
   comet tail; past the next the pocket erupts. The player's own instrument is what burns, so the
   streak is felt in the hand, not read off a bar.
4. **Everything scales, continuously.** Pot particles, the pocket flash, the shake, the pitch of
   the pot sound, the size and colour of the "+500" - all of it reads the streak, so the
   twentieth pot is visibly and audibly bigger than the tenth. Nothing plateaus.
5. **The loss is loud.** A miss kills the streak with a crash and a screen desaturation, so the
   fear of losing it is what the next shot is played under.
6. **Time bends on the big ones.** The decisive shot slows, the camera pushes in, then it lands.

The design literature says the same thing in fewer words: map every effect off one escalation
tier so the strongest stays rare and keeps meaning something; hit-stop and shake sell weight; juice
echoes the core loop rather than decorating it ([Riot on VFX and clarity](https://www.riotgames.com/en/artedu/visual-effects),
[Juice It or Lose It](https://gdcvault.com/play/1016487/Juice-It-or-Lose), Eiserloh's trauma model
in `boardTrauma.ts`).

## What this game maps them to

| Reference | Memory Dungeon |
| --- | --- |
| Streak counter as the headline | The combo (`stats.currentStreak`) is the big number in the chain column (`RunShell`), bumping on every link, with how much came down the stairs beside it |
| Streak survives the rack | The whole chain ladder crosses floors (`chain-carryover-rules.ts`); a miss is the only end |
| Named ranks stamped on screen | `combo-heat-rules.ts`: warm 3, hot 6, blazing 10, inferno 16, legendary 25. `ScreenCalloutQueue` stamps HOT! / BLAZING! / INFERNO! / LEGENDARY! across the screen on the turn that reaches one - italic on a skew, a sheen swept across the letters, speed lines - with a three-note sting (`playComboStageSfx`) and a shake pulse (`TRAUMA_STAGE_UP`) |
| The bad stamped like the good | The same stamp for a combo of Hot or better lost (COMBO BROKEN ×N), for the bank's last miss (LAST MISS!), and a smaller one for a miss the bank saved (MISS · N left) |
| Prizes stamped in the same currency | A miss banked by five in a row, a pickup claimed with the match, and every store purchase (consumables and relics) get the minor stamp, so what the run hands out reads as part of the combo's feedback and not a separate ledger |
| The cue catches fire | Flames lick up the chain rail; the combo number takes an aura and flickers; from Hot the cards throw embers; lightning through every match and pop forks and thickens |
| Everything scales | Break trauma × (1 + 0.5 × heat); the score floater grows half again and burns in the stage's colour; the room's torches and ring past their Fever levels; a vignette around the whole screen; a sparkle on every match a step up the key per stage |
| The loss is loud | A miss zeroes the combo; COMBO BROKEN is stamped across the screen, the cards gutter (`cardBreakSnuff`), the mismatch sample drops a rung per tier, the ladder reads red as it empties |
| Time bends | The Fever break's hit-stop (`FEVER_WAVE_SLOW`) |

## What is deliberately not borrowed

- **A decay timer.** The tables' streaks die on a clock; here the only thing that ends a combo is
  a miss, because the game is about remembering, and a memory does not expire between turns.
- **Rank effects that change the rules.** The pool tables hand out power at high ranks. The heat
  here is presentation only: what a break takes is still the floor's own rungs. Runs are meant to
  be punishing (`docs/BALANCE_NOTES.md`), and a combo that made the game easier would undercut
  the thing it celebrates.
- **Stamps for small ranks.** Warm gets the HUD warming and nothing more; a stamp for three in a
  row is a stamp for nothing, and it would blunt the four that matter.

## Where each piece lives

- Stages and levels: `src/shared/combo-heat-rules.ts` (`comboHeatLevels`, `comboStageReached`).
- The stamps: `src/renderer/components/screenCallouts.ts` (what a turn or a purchase earns) and
  `ScreenCalloutQueue.tsx` (+ `.module.css`), fed from the turn event in `GameScreen.tsx`.
- The sting and the sparkle: `src/renderer/audio/gameSfx.ts` (`playComboStageSfx`, the heat layer
  in `playMatchSfx`).
- The shake: `src/renderer/components/boardTrauma.ts` (`TRAUMA_HEAT_SCALE`, `TRAUMA_STAGE_UP`),
  read off the combo prop's rising edge in `TileBoardScene.tsx`.
- The HUD, cards, room and vignette: see [epic-board-rendering-assists.md](./epic-board-rendering-assists.md).

## Next on the ladder (not built)

- A slow push-in of the camera on a Legendary break, the tables' "big shot" beat.
- A flame trail on the card as it flips from Blazing up - the instrument burning, not the room.
- A run-end card that replays the best combo's stamps.

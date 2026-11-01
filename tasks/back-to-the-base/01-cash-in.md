# Cash in: the combo as push your luck (prototype, 2026-11-01)

The owner was offered four shapes for a combo that changes what a player decides on a turn (cash
in, a called shot, combo as fuel, feel only) and picked **Cash in**. It is built behind a URL flag
so it can be played before it ships: **`?combo2=1`** on any deployment, for example
`https://memory-dungeon-git.pages.dev/?combo2=1`. A run without the flag plays exactly as before.

## The rule (`src/shared/combo-cash-in-rules.ts`)

- A match banks what it would have paid at x1. What the ladder's multiplier adds on top, and the
  gold a rung pays, go into the **pot**, shown under the combo ("Pot 406 · 3 gold").
- **Bank** (a dock button, between turns, while the pot holds something) pays the pot into score
  and gold and ends the combo: the ladder is climbed again from Lone. Stamp: CASHED IN!
- A **miss** that breaks the combo **loses the pot**. The HUD's lost line names it
  ("Lost 9 · ×4 · pot 1,667") and a POT LOST stamp follows COMBO BROKEN.
- Ignite (the Zone) ends the combo by choice, so it banks the pot first. Clearing the Warden banks
  it. The pot crosses floors with its combo. Floor-clear pay, bosses and relics bank as before.

So the hot streak finally has something on the table, and each turn at heat asks: do I know the
next pair, or do I bank?

## Measured (a scratch sim, 30 seeds, 12 floors, a player who banks at combo K and misses at rate p)

| Miss rate | No cash-in (today) | K=3 | K=5 | K=8 | K=12 | K=20 | Never bank |
|---|---|---|---|---|---|---|---|
| 10% | 56,637 | 24,127 | 27,038 | 35,330 | **41,773** | 36,405 | 35,379 |
| 15% | 43,916 | 16,619 | 21,391 | 26,778 | 30,332 | **31,661** | 30,166 |
| 20% | 30,425 | 11,916 | 21,108 | 23,510 | **25,242** | 22,397 | 21,470 |

- **There is a real decision**: banking early (K=3) roughly halves the score, because it throws
  the multiplier away; never banking loses about a sixth to misses. The best fixed point is around
  a combo of 12-20, and a player who banks when they are unsure of the next pair (not on a fixed
  count) should beat every row.
- **Survival does not move**: floors reached and gold are within a few percent of today at the good
  thresholds (10%: gold 306 at K=12 vs 309), so `gate:warden-reach` is not at stake. Banking very
  early costs some gold and the combo's earned misses.
- Score is lower than today under cash-in because pots are lost. Score buys nothing in the Descent,
  so this is a feel question, not a balance one; if it reads as stingy, the pot could pay a bonus
  on banking (say +10%) to make the bank itself a reward.

## Checked

Unit tests (`combo-cash-in-rules.test.ts`): nothing changes without the flag; the pot plus the bank
equals what today's run pays; Bank pays and resets; a miss takes the pot; not offered mid-turn;
Ignite banks. In an isolated headless browser on a real run with `?combo2=1`: the pot built to 406
and 3 gold by combo 6, Bank paid exactly that and dropped the combo to 0, and a miss on a second pot
took it.

## Not done until the owner's verdict

The full mechanic checklist (graph node, census counter, ledger entry, hall room, soak invariant
and a soak player who banks, Codex text, rules version) is paid only if the owner keeps it.

# Contact, not distance: what a pop is allowed to reach

Gen 197. Rules version 45 → 46.

## The complaint

> "right now when we get gaps from the missing cards, lets not pop chains if theres a gap between
> them. like a visible gap. Lets pop only cards that are actually touching and are same type"

That is the whole brief, and it was correct. This is the record of what was measured, what changed,
and what it cost.

## What was actually happening

The flood fill that finds a break's region has always walked through **live cards of the matched
suit only** — a cleared cell blocks it, so the region itself never crossed a gap. That part was
never broken, which is why the complaint was easy to disbelieve and worth measuring instead.

Two other rules were doing the reaching, and neither went through the region at all.

**The partner reach.** From Clean upward, a pair went when *one* of its halves was in the region.
The other half could be anywhere on the board: a card on the far side would shatter because its twin
happened to be in the clump you hit. Nothing on screen connected the two.

**The Fever halo.** A Fever break took every hidden card bordering its region, whatever the suit.
Those cards were adjacent — no gap — but they were not the same type, and from the player's seat a
Fever break looked like a blast radius rather than a clump going up.

Measured over 2367 breaks on real generated floors (five seeds, twelve levels, every whole pair
matched at each of the four rungs), the share of a break's cards that were **not** reachable from
the match through live same-suit cards:

| Tier | cards a break | off-clump share | of which drop | partner reach | halo |
|---|---|---|---|---|---|
| none | 3.95 | 0.054 | 0.054 | 0.000 | 0.000 |
| clean | 5.75 | 0.161 | 0.058 | 0.104 | 0.000 |
| sharp | 6.17 | 0.188 | 0.014 | 0.174 | 0.000 |
| fever | 16.36 | 0.699 | 0.085 | 0.063 | **0.552** |

At chain zero the only cards arriving from off-clump were the **severance drop**, which is a
different beat with its own name, its own copy and its own "Drop" tag — a stranded suit falling, not
a pop reaching. Everything else in that table is the two rules above.

## What changed

**The partner reach is gone.** At every tier a pair goes only when the wave holds *both* halves. A
pop can therefore never orphan a partner and never take a card the player cannot trace back to the
match by eye.

**The halo is gone.**

Both were removed rather than zeroed, per the repository's standing rule about mechanics whose rule
has gone.

That left the ladder with nothing to sell, and the measurement said so immediately: capped at one
suit clump — three or four pairs on these boards — the four rungs paid **1.46 / 2.10 / 2.20 / 2.66**
pairs, a spread of 1.21 against the 6.13 it had before, with Sharp worth **0.10 pairs** over Clean.
That is the thin middle rung that Gen 168 and Gen 189 both exist to have fixed.

Depth alone cannot fix it, because the clump runs out. So the ladder was rebuilt out of three levers,
every one of which stays inside the rule:

| Rung | what it buys |
|---|---|
| **Pop** (no chain) | the wave walks **two steps** along the clump |
| **Clean** | the wave walks **four** — the same pop, in the same place, twice as far |
| **Sharp** | the **reaction runs**, and the **bridge**: the wave crosses into the one clump it was touching |
| **Fever** | three clumps rather than one, and the wave walks **diagonally**, so corners connect |

The **bridge** is the new idea and the one that carries the top of the ladder. When a wave finishes
a suit, the cards it took hand the next wave whatever they were *in contact with* — the neighbour of
another suit at the clump's edge — and that neighbour's own clump is the next wave. It is Puyo's
chain: fire spreading from clump to clump across contacts. It never crosses a gap, because every
card it reaches is touching a card that just broke.

It is counted, because an uncounted bridge is not a rung, it is the board. Unbounded, a Sharp break
took **8.26** pairs against Clean's 2.10 — a clump touches several others at once, so the fire caught
all of them and ran until the floor was gone. Sharp catches one neighbouring clump, Fever three, and
the bridge fires on one wave only.

No tier walks a whole region in a single wave any more. That is what made the ripple decorative at
the top before: an unbounded first wave leaves the reaction nothing to run into. Bounded everywhere,
the reaction is the thing that covers distance — Sharp's twelve waves walk the clump Sharp used to
swallow whole, but outward, a step at a time, which is what the shatter animation has always drawn.

## What it costs

| | Lone match | Clean | Sharp | Fever | Spread | Rippled breaks | Severance floors |
|---|---|---|---|---|---|---|---|
| Gen 196 | 1.46 | 2.62 (+1.16) | 3.05 (+0.43) | 7.59 (+4.54) | 6.13 | 0.16 | 0.583 |
| Gen 197 | 1.46 | 2.10 (+0.65) | 5.79 (+3.69) | 8.46 (+2.67) | 7.00 | **0.25** | **0.779** |

Three things to note, none of them incidental.

**The ladder is better graded than it was**, not worse. The old middle rung paid 0.43 pairs; the new
one pays 3.69. Sharp is now the rung where a break stops being one clump and becomes two, and the
pairs say so on their own rather than needing the multiplier to hide a flat spot. `CHAIN_RUNG_PAIRS`
was re-baselined from `{1, 3, 3, 8}` to `{1, 2, 6, 8}` — Clean and Sharp no longer round to the same
number, which they had done since Gen 186.

**The ripple got real.** Breaks with more than one wave went from 0.16 to 0.25 of all breaks, because
bounding the reach at every tier gives the reaction somewhere to go.

**The severance drop got much busier**: 0.583 → 0.779 of floors. That follows directly — a pop that
takes only what it touches strands more suits, and the drop is the rule that exists to clear a
stranded suit. It is still inside its cadence band. Watch it: if it climbs toward every floor it stops
being a surprise and becomes a second, quieter pop, and the lever then is `SEVERANCE_DROP_MAX_PAIRS`.

## The line this draws

**Contact, not distance.** A pop may spread anywhere it is touching. It may not reach a card across
empty space, whatever the chain behind it. A future mechanic that wants to take a card at a distance
has to clear that bar first, and the answer will usually be that it should spread through contact
instead.

Two authored lessons moved with the rule. Floor 3's **split pair** used to teach the partner reach:
match inside the clump at Clean and the far half flew out from across the board. It now teaches the
rule that replaced it — a pop takes what it is touching, and a pair you have pulled apart is yours to
remember. The **Chain reaction** achievement's three waves used to come from a suit laid as islands
that the partner reach jumped between; it now comes from a long clump that takes three waves to walk.
Both are still reachable on real boards, which `achievement-reachability.test.ts` proves.

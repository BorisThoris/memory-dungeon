# Elemental agency and visual hierarchy

Historical design review. The owner subsequently requested real freeze and vine attempts on every match; rules 57 supersede the ordinary-coating design below. See [current rules](living-elements.md). Whole-cohort ambiguity, a free pair, clear feedback and reduced-motion support still apply.

## Evidence, not a universal formula

Riot's [Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/)
describes three useful principles: make gameplay understandable, preserve a hierarchy of importance,
and limit visual noise. Its examples tie the prominence of an effect to its gameplay significance.
Applied here, an ordinary match needs a short response; a board-wide diagram on every match erases
that hierarchy. This is a transfer of design principles, not evidence that a memory game should copy a MOBA.

Christian Karrs' first-person account of [mobile puzzle level design](https://www.gamedeveloper.com/design/the-player-s-progress-designing-levels-for-mobile-puzzle-games)
connects satisfying board progression with actions that open useful space and create later opportunities.
His examples include adjacent matches increasing piece value. This supports exploring preparation and
harvest effects instead of making every element another way to remove legal moves.

Zhou and Forbes' [Data Feel](https://arxiv.org/abs/2210.03800) surveys effects that help players reason
about game state. For this game, feedback should distinguish a successful application, absorption and
a counter. Increasing particle counts without communicating those outcomes does not satisfy that goal.

None of these sources establishes a universal two-pair lockdown rule. That requirement comes from the
owner and this game's hidden identities. Marking precisely two cards as a complete locked pair reveals
their relationship. A common treatment covering at least four cards from two pairs preserves ambiguity.

## Intended rules

- Fire remains cleansing plus a timed risk/reward opportunity; Water remains positional control.
- Frost casts should stabilize card positions without preventing flips. Grove casts should plant a
  future harvest that can be cultivated or consumed by other elements. Ordinary matching stays available.
- Hard arena holds must cover complete real pairs, at least two pairs sharing one visual treatment,
  while leaving another pair playable. No hold when those requirements cannot be met.
- Expiry, cutting, bombs and other removals must release incomplete pairs and dissolve a hold cohort
  before it dwindles to a single identifiable pair. No pair-specific beams, colors or timing.
- Immunity and kin charging remain consistent. Card materials, terrain and arena effects must be
  described together, with tests of meaningful decisions rather than only the number of statuses.

## Visual implementation

Replace the dedicated canvas overlay, huge source titles, per-card labels and persistent beam web with
the existing pooled board particles. A cast emits a bounded source/contact response plus a few short
staggered trails. Material shapes convey the element; gold motes convey absorption and muted sparks
convey resistance. These use free slots, so casts cannot evict match feedback. Repeated state updates,
mounts and reduced-motion settings must not replay a cast. Existing status marks, ground and the Casts
guide retain the lasting information after particles fade.

## Implemented choices

Frost applies rime without blocking flips. Rime anchors cards against elemental movement and arena
holds; matching any rimed card banks one calm turn. Grove plants seeds worth one gold per card when
matched. Combo six or resonance tier two plants two-gold blooms; Water cultivates ordinary seeds
into blooms. Fire consumes vulnerable coatings without collecting their reward. Material immunity
still applies, and rime resists Grove planting until cleansed or matched.

Arena holds are reconciled after weather and carryover, and cleaned up after cuts and bombs.
Existing cohorts keep priority; new ice joins their remaining duration rather than extending it.
Incomplete cohorts release instead of recruiting replacements during cleanup.

## Verification, 2026-10-02

- Full suite: 492 files, 3,417 tests exercised. Three stale version/guide/cadence expectations were
  corrected; the subsequent focused run passed all 144 tests across eight files.
- Rules 54 census measured Peek on 90.8% of reference-player run floors. Its diagnostic cadence
  is now core under the unchanged 90% threshold; Peek grants and behavior were not changed.
- Soak: 240 runs, 3,817 floors and 30,838 turns, zero invariant violations. This includes complete
  hold pairs, minimum cohort size, uniform ice expiry and a remaining playable pair.
- Seven headless browser checks passed using the verified noninteractive Windows launcher, one
  worker and a 25% CPU cap. All four single-pair casts, reduced motion, amplified affected/counter/
  absorbed contacts, and desktop/phone guide flows were exercised.
- Inspected desktop and phone amplified-cast captures and individual Frost/Grove captures.
  Rime reads as a thin icy border, seeds as corner sprouts, and cast particles leave the card
  materials visible. Large full-board labels and beam webs are removed.
- TypeScript app and browser-test checks, changed-file lint and particle-budget tests passed.

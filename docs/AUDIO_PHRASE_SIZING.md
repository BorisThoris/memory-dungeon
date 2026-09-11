# Keying the cascade to the music: what is done and what it would take

**Source:** Peggle 2's audio team (Audio Gang), verified 3-0 in `docs/RESEARCH_NOTES.md` §2. Two
claims, and this game can only act on one of them today.

1. **Successive hits play the next step of an ascending scale.** Done, Gen 225.
2. **The scale is chosen to harmonise with the music phrase CURRENTLY PLAYING, re-keying when the
   phrase turns — including mid-shot — while still continuing to ascend.** Blocked, and this file is
   the sizing the task asked for before anyone starts it.

## What was wrong, and what is fixed

The break's phrase was `720 + index * 46` Hz per pair, each note gliding from 720 to 1080 while the
next one began. That is a straight line through frequency space, and pitch is logarithmic: the steps
run 107 cents, then 101, then 96, down to 75 by the ninth note. Measured against the notes the run
loop actually plays, **none of the nine landed on one** — `musicalScale.test.ts` asserts that as a
negative control, and it is zero out of nine rather than "mostly off".

It is now four pitch classes the run loop was **measured** to contain (`yarn audit:music-key`
re-derives the chroma from `run-loop.wav`; the script is in `gate:systems`), each note held rather
than swept, climbing two octaves over a nine-pair break. The three chain-milestone accents moved
onto the same notes: one of them was 1680 Hz, near G#6, and G# is the pitch class this loop has
least of (0.008 of the chroma) — the one note in the piece that is not in the piece.

## What the measurement would not settle

The loop's tonic is **A**, decisively: 0.300 of the chroma against D's 0.170 and nothing else over
0.10. Its **third is a tie** — C and C# both at 0.0737 — and the Krumhansl-Schmuckler correlation
flips between A major and A minor depending on the analysis window (A minor 0.792 / A major 0.775
under one; A major 0.782 / A minor 0.716 under another). Its **seventh is missing**: G at 0.019 and
G# at 0.008.

So the cascade uses **A, B, D, E** — shared by both candidate keys, clear of the contested third and
the absent seventh. A full seven-note scale would have meant picking a side in a tie and calling it
measurement. The cost is stated where it is paid: four notes to the octave means most breaks (two to
four pairs) now sound *lower* than the ramp did, because the phrase opens at A4 rather than at
720 Hz so that the long ones have somewhere to climb.

## The blocked half, sized

`gameplayMusic.ts` plays **one 24-second `run-loop.ogg`** through an HTML `<audio>` element, started
and stopped by a React hook. There are no phrases, no stems, no matrix, no transport, and no way to
know where in the bar the music is. Every part of claim 2 needs all of that. What it would take:

| Step | Kind | Notes |
|---|---|---|
| Re-author the score as phrase chunks | **Asset** | The source describes a two-axis matrix: per-instrument stems crossed with short phrase chunks. One level runs 7 phrases before resolving. This is composition work, not code, and it is the long pole. |
| Decide the phrase count and its arc | Design | The source's 7 phrases per level is a ready-made arc budget, and this game's chain ladder (none → Clean → Sharp → Fever) is a close cousin of Peggle's own Fever terminal state. A floor is the unit that would map to a level. |
| Replace the `<audio>` element with a scheduler | Code | Phrase-accurate switching needs Web Audio buffer sources scheduled against `AudioContext.currentTime`, not an element whose `currentTime` drifts. This also gives the cascade something to ask "which phrase is playing". |
| Key per phrase | Code | Each phrase chunk declares its own pitch-class set; `musicalScale.ts` takes it as a parameter instead of a constant. The climb must carry its DEGREE across a re-key rather than restart, which is the part the source calls out explicitly. |
| Re-measure | Gate | `audit:music-key` currently measures one file. It would measure each phrase chunk and check each declares the set it actually contains. |

**Order:** the scheduler and the per-phrase key are a few days of code and are useless without the
assets; the assets are the decision. Nothing should start until someone commits to re-authoring the
score, and if that never happens, what shipped at Gen 225 is the whole of what this research can buy
— which is why the fixed set is written as a fixed set rather than as a `currentPhrase` parameter
that would always return the same answer.

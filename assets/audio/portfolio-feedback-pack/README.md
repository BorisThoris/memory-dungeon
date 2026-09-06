# Portfolio Feedback Pack

Tiny procedural audio cues (plus one ACE-Step ambience bed) for the Memory Dungeon portfolio audio layer.

- `match-success.ogg` (`.wav` master): successful pair resolve
- `mistake.ogg` (`.wav` master): failed pair resolve
- `relic-offer-shimmer.ogg` (`.wav` master): relic draft appears
- `countdown-pressure.ogg` (`.wav` master): final gauntlet seconds
- `floor-clear.ogg` (`.wav` master): floor complete sting
- `demo-ambience-loop.ogg` (`.wav` master): subtle looped run bed (ACE-Step 1.5 XL turbo render, `scripts/audio-pipeline/jobs.portfolio-ambience.json`, seamless-looped with `make-seamless-loop.py`). `gameplayMusic.ts` prefers this file over `music/run-loop.ogg`, so it is the in-run music in every build; the earlier procedural master had rendered as 12 s of digital silence.

Renderer playback imports OGG runtime files. WAV masters are retained for regeneration/reference.

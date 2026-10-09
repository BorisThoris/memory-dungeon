# Background music (`assets/audio/music`)

| File | Notes |
|------|-------|
| `menu-loop.wav` | Procedural menu loop from `yarn audio:placeholders` styled for vault darkness, ember warmth, and crystal accents. Replace with the `menu-loop` render from `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` after curation. |
| `run-loop.wav` | Procedural active-run loop from `yarn audio:placeholders`, slightly faster and more tense than the menu loop. Replace with the `run-loop` render from `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` after curation. |
| `realm/<realm>-ambience.ogg` | Each realm's music: on a floor in that realm it is the run music, on the music element (`gameplayMusic.ts`, `realmMusicUrl`), so the settings' music volume governs it and the combo's layers play over it; `run-loop` is the fallback for a realm without one. Levelled to the run loop's -19.3 LUFS. ACE-Step renders of `assets/audio/realm-ambience.jobs.json`, cut with `make-seamless-loop.py`; the picks and how they were chosen are in that file's notes. Any file here plays, so a replacement is listened to first. |

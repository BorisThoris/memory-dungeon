# Background music (`assets/audio/music`)

| File | Notes |
|------|-------|
| `menu-loop.wav` | Procedural menu loop from `yarn audio:placeholders` styled for vault darkness, ember warmth, and crystal accents. Replace with the `menu-loop` render from `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` after curation. |
| `run-loop.wav` | Procedural active-run loop from `yarn audio:placeholders`, slightly faster and more tense than the menu loop. Replace with the `run-loop` render from `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` after curation. |
| `realm/<realm>-ambience.ogg` | Each realm's ambience loop (`realmAmbientBed.ts`), played under that realm's floors at `REALM_RECORDING_LEVEL` instead of the noise bed. ACE-Step renders of `assets/audio/realm-ambience.jobs.json`, cut with `make-seamless-loop.py`; the picks and how they were chosen are in that file's notes. Any file here plays, so a replacement is listened to first. |

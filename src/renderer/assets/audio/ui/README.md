# UI and menu SFX (`assets/audio/ui`)

`manifest.json` lists logical keys to runtime filenames. These OGG files are loaded through the shared renderer `AudioContext` and use `masterVolume * sfxVolume`. WAV files in this folder are source masters and are intentionally ignored by the eager runtime glob.

| Key | File | Use |
|-----|------|-----|
| ui-click | `ui-click.ogg` | Low-stakes menu/settings selection |
| ui-confirm | `ui-confirm.ogg` | Save/import/accept actions |
| ui-back | `ui-back.ogg` | Back/cancel/discard actions |
| ui-counter | `ui-counter.ogg` | Small counter/status ticks |
| menu-open | `menu-open.ogg` | Opening menu/meta screens |
| run-start | `run-start.ogg` | Starting or restarting a run |
| intro-sting | `intro-sting.ogg` | Startup intro completion / skip resolve |
| pause-open | `pause-open.ogg` | Pause overlay entry |
| pause-resume | `pause-resume.ogg` | Resume from pause |
| game-over-open | `game-over-open.ogg` | Game-over screen reveal |
| ui-copy | `ui-copy.ogg` | Successful copy/share feedback |

Generated candidates should come from `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json`, then be trimmed/normalized before replacing these placeholders.

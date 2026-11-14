# Turning on Steam Cloud (owner, 2026-11-14)

The owner chose to ship cloud saves on Steam. The game needs no code for it: Steam Auto-Cloud syncs
the save file while the game is closed. Three steps, in this order.

## 1. Steamworks: the Auto-Cloud rows

Steamworks › your app › Application › Steam Cloud. Set a byte quota (1 MB is plenty: a full save
with a long run history is well under that) and a file count of 1, turn on Auto-Cloud, and add one
root override row per platform:

| Platform | Root | Subdirectory | Pattern |
|---|---|---|---|
| Windows | WinAppDataRoaming | Memory Dungeon | memory-dungeon-save.json |
| macOS | MacAppSupport | Memory Dungeon | memory-dungeon-save.json |
| Linux | LinuxXdgConfigHome | Memory Dungeon | memory-dungeon-save.json |

`yarn steam:cloud-config` prints these rows from the constants the game writes its save with
(`src/shared/save-location.ts`), so they cannot drift. Only the save syncs: `crash-logs/` beside it
stays on each machine. Publish the change on the Partner site.

## 2. Build with the flag

Package the Steam build with `VITE_FEATURE_CLOUD_SAVE=1` (for example
`cross-env VITE_FEATURE_CLOUD_SAVE=1 yarn package:win`). The flag only changes what the game tells
the player (Settings › About and the profile's save row stop saying "this device only"); set it only
after step 1 is published, so no build claims cloud saves Steam does not keep.

## 3. Prove it once

Play on one machine, quit, start on a second machine signed into the same Steam account, and check
the profile and best score arrived. This is the release checklist's `cloud-save-round-trip` row; no
configuration proves it.

A run left mid-way does not travel: the suspended run (`suspendedRun.ts`) is kept in the
renderer's local storage, Electron's own folder beside the save, which the rows above do not match.
The profile, records and settings travel; Continue stays on the machine the run was left on.
Export/Import under Settings › About stays available for moving a profile without Steam.

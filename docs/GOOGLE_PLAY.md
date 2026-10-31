# Google Play (Android) release

The Android app is a Trusted Web Activity: a small Android shell that opens
`https://memory-dungeon-git.pages.dev/` full screen. The web game is the product; the shell only
needs a new build when its manifest (name, colours, icons, start URL, version) changes. A web
deploy (`yarn deploy:pages`) updates what the app plays.

|                 |                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Play account    | "Bobakaa" (personal), developer id `8334845062002802235`                                          |
| App             | Memory Dungeon, app id `4975914845803594785`, created 2026-10-31 (Game, Free, English en-US)     |
| Package         | `com.boristhoris.memorydungeon` (permanent)                                                       |
| Closed testing  | track "Closed testing - Alpha" (`4699539823287937491`), tester list "Ringer 3D team"             |
| Upload key      | `D:\agent-work\memory-dungeon\play-secrets\upload.jks` + `keystore.properties` (outside the repository; back it up) |
| App signing     | Play App Signing; its SHA-256 and the upload key's are in `public/.well-known/assetlinks.json`   |
| Privacy policy  | `public/privacy.html`, served at `https://memory-dungeon-git.pages.dev/privacy` (Pages drops the `.html`) |
| Status          | Release 1 (1.0.0), the store listing and every declaration sent for review 2026-10-31; 178 countries; rated Everyone / 3+ with "Users Interact" |

## Console automation

The Play Console steps that set this up (create app, declarations, content rating, data safety, listing,
track, submit) are Playwright step files in `D:\agent-work\memory-dungeon\2026-10-31-play\console\`, run
headless on the signed-in launcher profile through `run-when-free.ps1`. Data safety is easiest through
**Export to CSV**, editing the response column and **Import from CSV** (it asks twice before overwriting).
The store graphics (icon, 1024x500 feature graphic, five 1080x1920 phone screenshots) are in
`D:\agent-work\memory-dungeon\2026-10-31-play\store\upload\`.

## Build

From a work folder outside the repository (Gradle caches are bulky):

```powershell
$w = 'D:\agent-work\memory-dungeon\<date>-play'
New-Item -ItemType Directory -Force $w; Set-Location $w
npm init -y; npm install @bubblewrap/core@1.27.0
Copy-Item <repo>\scripts\play\generate-twa.mjs .
node generate-twa.mjs
powershell -File <repo>\scripts\play\build-aab.ps1 -WorkDir $w
```

`generate-twa.mjs` holds the TWA manifest; raise `appVersionCode` for every upload. It is copied
rather than run in place because `@bubblewrap/core` resolves from the script's folder and is not a
repository dependency. The generated project signs release builds with the upload key named by
`MEMORY_DUNGEON_KEYSTORE_PROPS` (default `D:\agent-work\memory-dungeon\play-secrets\keystore.properties`).
Gradle 8.11 needs a JDK from 17 to 23; the script uses JDK 18.

## Verified link

The TWA hides the browser bar only when the origin serves `/.well-known/assetlinks.json` with the
Play app signing key's fingerprint (Play Console › Protected with Play › App signing). Until the
deploy that carries it is live, the app opens in a Custom Tab with a URL bar.

## What the account allows

A personal developer account cannot publish to production until a closed test with at least 12
opted-in testers has run for 14 days. The store listing, content rating, data safety, target
audience and privacy policy are the owner's claims; the answers given on 2026-10-31 were approved
by the owner: no ads, no sign-in, no advertising ID, no government, financial or health features,
13 and over, an optional public nickname and score sent to the global record, and the IP address
kept up to an hour by the record service for spam limits.

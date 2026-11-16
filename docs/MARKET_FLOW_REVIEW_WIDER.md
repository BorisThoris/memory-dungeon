# Market flow review, wider (2026-11-16)

`MARKET_FLOW_REVIEW.md` set Memory Dungeon against the leading premium roguelikes. This review does
the same against market leaders **outside** roguelikes that share the audience: mobile puzzle/match
(Candy Crush Saga, Royal Match, Two Dots, Monument Valley), card and solitaire (Microsoft Solitaire
Collection, Solitaire Grand Harvest, Hearthstone, Marvel Snap) and brain training (Lumosity,
Elevate, Peak). Rows already settled in the roguelike review (photosensitivity notice, graphics
tier, key rebinding, credits, patch notes, delete progress) are not repeated.

Rules for the competitor cells: every claim comes from a source below; a cell with no source says
**not found** (it does not mean the product lacks the flow). Store listings differ by storefront and
version; where sources disagree the disagreement is shown, not resolved. Sources marked
**(snippet)** were seen only as search-result summaries, not fetched and read; treat those cells as
weaker. Store-listing wording is paraphrased.

Owner decisions that filter every gap (not proposed as changes): runs are punishing (miss bank); the
store is a stop every third floor, not a menu screen; only `classic` and `pass_and_play` ship;
mutators iterate during play; the daily mode was removed (`REMOVED_MODES.md`, roguelike review);
no ads, IAP, energy or pay-to-win (`src/shared/premium-economy-policy.ts`, REG-054).

Translation (en, zh-Hans, ru, es, pt-BR, de, fr) is **in progress** in a separate task
(`docs/LOCALIZATION_PLAN.md`, `tr.s` already in `src/renderer/copy/aboutCopy.ts`); it is not
listed as a gap.

## Sources

Mobile puzzle / match
- Candy Crush Saga, App Store (US): https://apps.apple.com/us/app/candy-crush-saga/id553834731
- King community, Candy Crush Friends Saga accessibility article (snippet; the page returned 404
  when fetched): https://community.king.com/en/kb/articles/2697-play-your-way-new-accessibility-features-in-candy-crush-friends-saga
- King community thread asking for colour-blind settings in Saga (snippet): https://community.king.com/en/candy-crush-saga/discussion/comment/750706
- Royal Match, App Store (US): https://apps.apple.com/us/app/royal-match/id1482155847
- Royal Match, Wikipedia, offline play (snippet): https://www.wikipedia.org/wiki/Royal_Match
- Two Dots, App Store (US): https://apps.apple.com/us/app/two-dots-fun-dot-game/id880178264
- Monument Valley, Family Gaming Database accessibility page (snippet): https://www.familygamingdatabase.com/accessibility/Monument+Valley
- Monument Valley 3 launched on Netflix without ads or IAP (snippet; a search result also says it later left Netflix for other platforms in 2025, unverified): https://gamedeveloper.com/business/monument-valley-3-is-heading-to-netflix-games-to-avoid-app-store-compromise-

Card / solitaire
- Microsoft Solitaire Collection, App Store (US): https://apps.apple.com/us/app/microsoft-solitaire-collection/id1103438575
- Microsoft Solitaire Collection, Xbox achievement list (snippet): https://www.exophase.com/game/microsoft-solitaire-collection-xbox-one/achievements/
- Solitaire Grand Harvest, App Store (US) (snippet): https://apps.apple.com/us/app/-/id1223338261
- Hearthstone new player experience, wiki (snippet): https://hearthstone.wiki.gg/wiki/New_player_experience
- Hearthstone Catch-Up Packs, community summary of Blizzard's announcement (snippet): https://www.hearthstonetopdecks.com/introducing-catch-up-packs-containing-up-to-50-cards-per-pack/
- Marvel Snap onboarding, Second Dinner via mobilegamer.biz: https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/
- Marvel Snap onboarding analysis, play before an account (snippet): https://alliance.xyz/essays/removing-web3s-friction-pt-1-progressive-onboarding-and-games

Brain training
- Lumosity, App Store (US): https://apps.apple.com/us/app/lumosity-brain-training/id577232024
- Lumosity, AppAdvice listing, seven languages (snippet): https://appadvice.com/app/lumosity-mobile/577232024
- Lumosity help, "The new Lumosity", streaks more visible (snippet): https://lumositybeta.zendesk.com/hc/en-us/articles/33395618060951-The-New-Lumosity-What-s-Changed-and-Why
- Elevate, App Store (US): https://apps.apple.com/us/app/id875063456
- Elevate help, streak freeze (snippet): https://support.elevateapp.com/hc/en-us/articles/28507604797595-What-is-a-streak-freeze
- Elevate help, training reminder time (snippet; title only): https://support.elevateapp.com/hc/en-us/articles/4402971596699-Can-I-change-the-time-I-receive-my-training-reminder
- Elevate help, reset progress (snippet; title only): https://support.elevateapp.com/hc/en-us/articles/4402925241115-Can-I-reset-my-progress
- Peak, App Store (US): https://apps.apple.com/us/app/peak-brain-games-training/id806223188

Platform
- Chrome, "What's new for Web In Play" (TWA quality criteria, Chrome 86): https://developer.chrome.com/docs/android/trusted-web-activity/whats-new
- Chrome, Offline-first Trusted Web Activities: https://developer.chrome.com/docs/android/trusted-web-activity/offline-first
- Chromium blog, changes to quality criteria for PWAs using TWA, 2020-06-25 (body not retrieved): https://blog.chromium.org/2020/06/changes-to-quality-criteria-for-pwas.html
- Google Play In-App Review API: https://developer.android.com/guide/playcore/in-app-review

## Per-product flows

"nf" = not found in the sources above.

| Flow | Candy Crush Saga | Royal Match | Two Dots | Monument Valley | MS Solitaire Collection | Solitaire Grand Harvest | Hearthstone / Marvel Snap | Lumosity | Elevate | Peak |
|---|---|---|---|---|---|---|---|---|---|---|
| First run / tutorial | nf | nf | nf | nf | nf | nf | HS: three practice matches, playable or skippable, then the Apprentice Track. Snap: the whole tutorial without an account; a simplified first match; Quicksilver guaranteed in the opening hand instead of a mulligan | nf | nf | nf |
| Daily return loop | Daily login for free boosters and lives | nf | Seasonal events | nf | Daily Challenges, five new each day; monthly badges | Daily free gifts on return | nf | Daily workout; streaks made more visible, one game a day keeps a streak | Workout calendar logs streaks; two streak freezes, earned or bought | Daily workouts |
| Progression / meta | Time-limited events | Events, Royal Pass, collections | 5000+ levels, scavenger-hunt maps | nf | Star Club packs, events, XP | Farm built with earned gems | HS: Apprentice Track rewards; Snap: card unlocks ordered to teach card interactions | Progress toward goals, insights | Adaptive difficulty | Progress insights and statistics |
| Accessibility | No declared App Store features; colour-blind settings requested by players. Sister game Friends Saga: reduce shake, limit effects, hints off | None declared | None declared; the description says a colour-blind mode is free to all | Not yet assessed by Family Gaming Database | None declared | nf | nf | None declared | None declared | None declared |
| Languages | English + 28 | English + 12 | English + 12 | nf | English + 14 | nf | nf | Conflict: English only (US App Store) vs seven languages (AppAdvice) | English only | English + 13 |
| Save / sync | Optional Facebook connection syncs progress | nf | nf | nf | Microsoft/Xbox account saves progress, cross-platform | nf | nf | nf | Help article on resetting progress (title only) | nf |
| Social | Share lives, compare with friends, tournaments, leaderboards | Team events (user review) | Friends, Game Center leaderboards and achievements | nf | Compete with others (signed in) | Challenge friends; Game Center leaderboards | nf | nf | nf | nf |
| Store / monetization | IAP: gold bars, moves, lives, boosters | IAP bundles, Royal Pass | IAP: moves, lives, currency; random items | MV3 launched on Netflix, no ads or IAP (may be stale) | Ads; Premium removes ads | nf | nf | Subscription | nf | Subscription (Peak Pro) |
| Notifications / reminders | nf | nf | nf | nf | nf | nf | nf | nf (third-party reviews only) | Help article on changing the reminder time (title only) | nf |
| Offline | Offline play stated | Playable offline; competitive events online | nf | nf | A persistent connection is required | nf | nf | nf | nf | nf |
| Achievements | nf | nf | Game Center | nf | 75+ Xbox achievements | Game Center | nf | Badges | nf | nf |
| Help / support | nf | nf | nf | nf | nf | nf | nf | Help centre | Help centre | nf |
| Controller | nf | nf | nf | nf | nf | nf | nf | nf | nf | nf |
| Rating prompt | nf | nf | nf | nf | nf | nf | nf | nf | nf | nf |
| Account deletion | nf | nf | nf | nf | nf | nf | nf | nf | nf | nf |

What the sources agree on: the free-to-play leaders run a **daily return reason** (gift, challenge
or workout) and a **streak** with forgiveness (Elevate's freezes); the puzzle and card titles ship in **13 to 29 languages** (the brain-training apps vary: Elevate
English only, Lumosity in dispute); the puzzle leaders that mention it **play offline**, while
Microsoft Solitaire Collection requires a connection; accessibility is mostly undeclared on store pages, with
colour-blind modes the most named feature. The brain-training leaders sell a subscription and are
held to claims rules (the FTC settlement already noted in `MARKET_SIMILAR_GAMES_RESEARCH.md`).

## Memory Dungeon: have / partial / missing

| Flow | Status | Evidence |
|---|---|---|
| First run | have | Startup intro, `FlashingLightsNotice.tsx`, then the menu; play without any account (no sign-in at all, `public/privacy.html`) |
| Tutorial | have | `src/renderer/components/TutorialHall.tsx`, first-run hints (`tutorialHallContext.ts`, `ElementCastGuide.tsx`) |
| Daily return loop | owner decision | Daily mode removed with its streak and grace (`docs/REMOVED_MODES.md`; `playerStats.dailyStreakGraceAvailable` survives only as a retired save field in `src/shared/save-field-policy.ts`). Today's Music changes per player per day (`src/shared/daily-music-composer.ts`) |
| Calendar / login rewards | rejected | Conflicts with premium, no-energy economy (`premium-economy-policy.ts`) |
| Progression meta | partial | Descent to the Warden, the Depths, Collection, Profile records (`descent-record.ts`, `ProfileScreen.tsx`, `CollectionScreen.tsx`); no map view of the Descent in a run (no such component found under `src/renderer`) |
| Colour-blind | have | Element symbols on backs, trait colours tested for three deficiencies (`src/shared/color-vision.ts`, `tileBoardReadability.ts`) |
| Reduce motion, screen shake, high contrast | have | Settings › Accessibility (`SettingsScreen.tsx`) |
| Text size | partial | UI Scale only, capped per viewport (`src/renderer/uiScaleLimits.ts`); no separate text size |
| One-hand / left-handed | partial | 44 px minimum targets next to the board (`src/renderer/gameplay/regPhase4PlayContract.ts`); no handedness option (none found) |
| Haptics | partial | `src/renderer/input/touchHaptics.ts` taps on phones; off only through Reduce Motion, no own switch |
| Localization | in progress | `docs/LOCALIZATION_PLAN.md` (seven languages, a Settings language control that saves and reloads); the separate translation task owns it |
| Save / cloud | partial | Desktop: Steam Auto-Cloud pending the owner (`docs/STEAM_CLOUD_SETUP.md`). Web/Android: local only, Export/Import (`src/renderer/saveTransfer.ts`) |
| Social | have (local) | One global record (`GlobalRecord.tsx`), share key on results (`GameOverScreen.tsx`), pass and play (`social-play-scope.ts`); online boards deferred (`docs/LEADERBOARDS_DEFERRAL.md`) |
| Store / monetization | different | Premium, no ads/IAP (`premium-economy-policy.ts`); Play app is Free with no IAP (`docs/GOOGLE_PLAY.md`) |
| Notifications | missing (by design) | `enableNotifications: false` in `scripts/play/generate-twa.mjs`; no Notification API use in `src/` |
| Offline: desktop | have | Electron serves the bundled game from `app://game` (commit ebbb49ae) |
| Offline: web and Android TWA | **missing** | No service worker anywhere (no `navigator.serviceWorker`, no `sw.js`, no PWA plugin; `playwright.config.ts` sets `serviceWorkers: 'block'`); `public/site.webmanifest` only. No doc records a decision against one. The v1 bar's "Local / offline play" (`docs/product/COMPLETE_PRODUCT_DEFINITION_OF_DONE.md`) means no accounts or servers, which holds once loaded, but the web build still needs the network to start |
| Controller | have | `src/renderer/input/gamepadNavigation.ts`, controller gate (roguelike review) |
| Achievements | partial | Steam achievements (`src/main/steam.ts`, `steam-achievement-api-names.ts`) and in-game honors; nothing on Android (no Play Games Services) |
| Help / rules | have | Codex (`CodexScreen.tsx`), shortcuts list, Tutorial Hall |
| Support contact | partial | Only through Settings › About › "Privacy policy and contact" (`aboutCopy.ts`), which opens `privacy.html` with an email; no in-game "report a problem" carrying version and crash log |
| Account / data deletion | have | No accounts; Delete all progress with a second yes (`SettingsScreen.tsx`, `ABOUT_COPY.deleteTitle`); record nickname removal by email (`privacy.html`) |
| Privacy policy coverage | partial | `privacy.html` covers "the web and the Android app" and says saves "are not sent anywhere"; the Steam build and Steam Cloud upload are not covered, yet the desktop links the same page |
| Rating prompt | missing | No in-app review or "rate us" link (no match in `src/`) |
| Android back button | partial (to verify on device) | No `popstate`/`pushState` handling in `src/renderer`; a run is put down on close (`src/renderer/store/suspendedRun.ts`), so back is not data loss, but it is not a pause either |

## What was built (2026-11-16)

- **P0 offline:** `public/sw.js` (network-first page, cache-first hashed assets, cached media
  ranges), registered by `src/renderer/serviceWorker.ts` on production web builds only;
  `gate:offline` (`e2e/offline.spec.ts` on `vite preview`) reloads the game with no connection
  and fails on any request that needed the network. A first launch with no connection, before the
  worker is installed, still needs the TWA launcher change described below.
- **P1 privacy:** `public/privacy.html` now covers the Steam build, its local save and crash logs,
  achievements and Steam Cloud.
- **P1 back button:** `src/renderer/hooks/useHardwareBack.ts` in the Android app and installed web apps (a browser tab keeps its own back), checked by `e2e/hardware-back.spec.ts`.
- **P1 support:** Settings > About > Report a problem (`src/renderer/supportReport.ts`).
- **Localization:** the seven owner-chosen languages (`docs/LOCALIZATION_PLAN.md`).

## Prioritized gaps

### P0: production blockers

1. **Web/Android has no offline handling.** Chrome's "What's new for Web In Play" page says that
   Chrome 86 changed the TWA quality criteria, and lists failing to answer an offline request with
   HTTP 200, and an HTTP 404 or 5xx in the app, among the cases an app should handle so it does not
   crash; it says a service worker can handle them. Memory Dungeon has no service worker, so with
   no connection the Play app should land on Chrome's error page (documented behaviour; verify on
   the tablet before and after the fix). The puzzle leaders whose listings mention it play offline
   (Candy Crush, Royal Match); Microsoft Solitaire Collection is the exception and requires a
   connection. Small fix: a hand-written service worker (no new dependency): the Vite build's
   hashed assets cache-first, navigations network-first with the cached `index.html` as fallback
   (so a `yarn deploy:pages` update still reaches players), registered from `main.tsx` only on
   `https:` web builds (never in Electron or the dev server). The global record already degrades
   (`GlobalRecord.tsx` sets `offline`). Files: new `public/sw.js` (or a small Vite plugin writing
   the precache list at build time, `vite.config.ts`), `src/renderer/main.tsx`, an offline reload
   spec under `e2e/` (`context.setOffline(true)`, with service workers allowed for that project in
   `playwright.config.ts`), `docs/GOOGLE_PLAY.md`. A first launch with no connection, before the
   worker is installed, needs the custom launcher activity the offline-first guide describes; that
   is a later change to the TWA shell.

### P1

2. **Privacy policy does not cover the Steam build.** Before Steam Cloud is switched on, say what
   the desktop app stores and that Steam Cloud copies the save to Valve. Files: `public/privacy.html`
   (scope line and a Steam section), `docs/STEAM_CLOUD_SETUP.md` (a step to publish it first).
3. **Android back button.** Push one history entry when a run starts and on each overlay, and turn
   `popstate` into the pause overlay (or close the open sheet); back on the menu leaves the app.
   Verify first on the tablet (`live-device-checks`). Files: `src/renderer/App.tsx`,
   `src/renderer/components/GameScreen.tsx`, a unit test beside them.
4. **A support line in the game.** Settings › About: "Report a problem" opening a `mailto:` with
   the version, platform and graphics tier filled in, and the crash-log location named. Files:
   `src/renderer/copy/aboutCopy.ts`, `src/renderer/components/SettingsScreen.tsx`, its test.
### P2

5. **Rate the game.** After a Warden win or the Nth finished run, a quiet "Rate on Google Play /
   Steam" link on the results screen, at most once. The native In-App Review API is Play Core code
   and would need a bridge in the TWA shell; a store link needs none. Files: `GameOverScreen.tsx`,
   `src/renderer/copy/gameOverScreen.ts`, `src/shared/save-data.ts` (asked-once flag).
6. **A haptics switch** separate from Reduce Motion (players who want motion but not buzz). Files:
   `touchHaptics.ts`, `SettingsScreen.tsx`, `save-data.ts`.
7. **Text size** apart from UI Scale (body and Codex text one step up), within the existing fit
   ceilings. Files: `src/renderer/styles/theme.ts`, `uiScaleLimits.ts`, `SettingsScreen.tsx`.
8. **A Descent map** on pause or the floor-clear beat: floors cleared, act bosses and the Warden
   ahead. Files: a new component under `src/renderer/components/`, reading `descent-pace-rules.ts`
   and `descent-length-rules.ts`.
9. **Android achievements** through Play Games Services: needs the native shell; only if the Play
    release is promoted to production.
10. **A daily seed** inside the one mode, only if the owner reopens it (the removed daily mode is an
    owner decision; `REMOVED_MODES.md` names a seed, not a mode, as the way it could return).

### Rejected (conflicts with premium or with the owner's decisions)

Login calendars and gift wheels, lives/energy, purchasable streak freezes, IAP and ads, team events,
push reminders to return, a store screen in the menu.

Note: a new `docs/*.md` file needs a row in `docs/internal-wiki/DOCS_CATALOG.md`; this review did
not add it.

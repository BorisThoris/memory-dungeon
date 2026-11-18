# Production audit, redone from scratch (2026-11-18)

The market reviews (`MARKET_FLOW_REVIEW.md`, `MARKET_FLOW_REVIEW_WIDER.md`) grew out of their own
framing. To check them, an independent audit read the shipped source and e2e tests with no access to
those documents and listed every flow a premium web, Android and Steam game is expected to have:
present, partial or missing. Every finding below was then re-read in the code before anything was
changed; none turned out to be false.

The audit found the game covers more than a typical pre-launch title: run suspend and Continue,
offline play, save export and import, delete progress, hardware back, controller navigation, seven
languages, an error boundary and WebGL context recovery all exist. What it found was mostly the
desktop build's surfaces showing on web and Android, and weak points in data safety.

A fresh playtest run stalled on the boot screen. Eight timed fresh loads showed the cause: the dev
server took up to two minutes to serve modules while other projects loaded the PC (no page errors;
the live build boots in seconds, checked headless on 2026-11-17). Not a player-facing defect.

## Findings and what happened to each

| # | Finding | Status | Where |
|---|---|---|---|
| P0-1 | The global record, shown on every menu, accepted any score from one request; nothing could undo a forged one | **Fixed, within limits** (owner: harden + admin reset). Scores above 10 billion refused (near-perfect simulated play: 24.6 million by floor 80); the last 500 submissions logged with floor, share key, rules and a hashed sender; `RECORD_ADMIN_TOKEN` lists the log and clears the record. Still client reported: there is no run replay a server could check. | `leaderboard/worker.mjs`, `leaderboard/README.md`, `src/renderer/records/globalRecord.ts` |
| P0-2 | Web/Android "Start a fresh profile" overwrote an unreadable save while the notice said it was kept | **Fixed.** The unreadable text is set aside under its own key first (newest three kept); if it cannot be kept, nothing is overwritten. | `src/renderer/desktop-client.ts` |
| P1-3 | Window Mode saved but never applied on web/Android | **Fixed.** Shown only in the desktop build. | `SettingsScreen.tsx` |
| P1-4 | Show save file did nothing, the crash-log line and the crash screen spoke of logs nobody writes, on web/Android | **Fixed.** Desktop only; the web crash screen no longer claims a report. | `SettingsScreen.tsx`, `initRendererShell.tsx` |
| P1-5 | No way to leave a run and keep it; Retreat always ended it | **Fixed.** The Retreat dialog offers Save and leave beside Abandon; Continue picks the run up. | `GameScreen.tsx`, `useAppStore.ts` (`leaveRunForLater`) |
| P1-6 | The offline cache kept every deploy's hashed files forever | **Fixed.** The build writes `asset-manifest.json`; each visit drops cached `/assets/` files not on it. Persistent-storage requests and a rolling save backup were not added. | `public/sw.js`, `vite.config.mts` |
| P1-7 | A continued run that throws would come back as Continue after every reload | **Fixed.** A crash within 15 s of Continue drops the kept run. A version stamp on the snapshot was not added; `SUSPENDED_RUN_FORMAT` is still bumped by hand. | `store/suspendedRun.ts`, `AppErrorBoundary.tsx` |
| P1-8 | Pair-distance hints (on by default) were not recorded, and hinted runs sat on the global record | **Fixed as the owner chose:** hints stay on by default; a run with them on at any point is marked Assisted in history and on the results screen, and does not offer the global record. With the default, most runs are now assisted. | `store/runAssist.ts`, `run-history-log.ts`, `GameOverScreen.tsx` |
| P1-9 | The desktop build does not pause on alt-tab or the Steam overlay | **Deferred:** Steam is out of the production scope (owner, 2026-11-17). | `useAppStore.ts` (`putTheRunDown`) |
| P2-10 | Volume sliders give no preview until Save; a language change drops other unsaved settings; Reset has no confirm and forgets the detected graphics tier | **Open** (polish). | `SettingsScreen.tsx`, `LanguageRow.tsx` |
| P2-11 | Save-import errors English only; the app manifest sold run modes and a Steam build; a nested `<main>` on the menu | **Fixed.** | `saveTransfer.ts`, `public/site.webmanifest`, `MainMenu.tsx` |
| P2-12 | A tab open across a deploy could crash loading a renamed chunk; no "what's new" after an update | **Half fixed.** One reload (once per session) on `vite:preloadError`; no what's-new prompt. | `serviceWorker.ts` |

New player-facing strings are in all seven languages, drafted by the local qwen3.8 27B model against
the existing glossary and corrected in review (machine drafts, as the rest).

## Open after this pass

- P2-10's settings polish, a what's-new prompt, persistent-storage and a rolling save backup on web.
- The desktop build's focus pause (with Steam).
- A server-side replay check for the global record, which would need the game to record its moves.

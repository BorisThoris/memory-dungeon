# Pass 12: First-Run-To-First-Win

## Design Map
- Fresh save has `onboardingDismissed=false` and `powersFtueSeen=false`.
- Main menu How To Play dismiss sets `onboardingDismissed=true`, which also suppresses in-run onboarding.
- Playable onboarding is light: first match, recovery, handoff.
- First floor can include wide recall, exit, mirror decoy, shuffle snare, findable, and guided pair.
- First clear immediately asks for route selection.

## Weak Spots
- Menu help dismiss effectively skips all onboarding.
- Copy references replay/reset onboarding, but no clear replay control exists.
- First board is overloaded for beginners.
- First onboarding target can be a hazard pair.
- First-run E2E stops at floor clear and does not prove route choice/floor 2 arrival.
- Floor 2 can spike with short memorize.
- “First win” is really first clear; no beginner campaign endpoint exists.

## Task Candidates
- Split menu help dismiss from tutorial skip.
- Add reset/replay onboarding control.
- Create a first-run board profile with no hazards/mirror decoy and controlled exit timing.
- Extend onboarding through first route choice.
- Add beginner game-over diagnostics and Safe-route recommendation.

## Verification
- Fresh-profile e2e through first clear, route choice, and floor 2.
- Unit tests that onboarding target is never hazard/exit/decoy.

## Refinement Notes
- `Confirmed`: onboarding is more implemented than the original pass implied; playable prompts, help center rows, component tests, mobile tests, and first-clear E2E exist.
- `Confirmed`: menu How To Play dismiss still suppresses in-run playable onboarding, despite copy implying guided prompts can continue.
- `Needs Repro`: first onboarding target can plausibly be a hazard/special pair because target selection filters only matched/decoy/wild, but a proving seed was not captured.
- `Confirmed`: first-run E2E stops at first clear; route choice, floor 2 playable arrival, and reload persistence remain uncovered in the same path.
- `Confirmed`: floor 2 has `short_memorize`, so the beginner spike concern is current.

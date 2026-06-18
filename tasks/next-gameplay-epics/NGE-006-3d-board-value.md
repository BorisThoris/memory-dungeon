# NGE-006 3D Board Value

## Goal

Keep the 3D board because it can communicate physical dungeon state, but make every 3D feature earn its readability cost.

## Acceptance

- Locks, levers, shops, hazards, and exits have readable spatial treatment.
- Trait chips and card symbols remain the first visual priority.
- Motion respects reduced-motion settings.
- Desktop and mobile screenshot checks catch blank, cropped, or overlapping board states.

## Implemented Slice

- Dungeon utility cards now expose non-text WebGL readability glyphs for exits, locks, levers, and shops.
- Trait rails remain bottom-weighted so symbols and card identity keep priority.
- DOM telemetry exports stable marker contract states for exit, lock, lever, shop, and trait audits.
- Trait-combo opportunities now have a distinct telemetry state so comboable traits can be audited separately from raw trait presence.
- Trap resolution status copy leads with the mechanic family (`Trap resolved`) while preserving the specific card label.
- Stage performance estimates now include static utility glyphs and trait rail draw-call budgets.
- `yarn test:e2e:board-3d-value` checks desktop and mobile board stages for nonblank rendering, viewport bounds, and screenshot detail.

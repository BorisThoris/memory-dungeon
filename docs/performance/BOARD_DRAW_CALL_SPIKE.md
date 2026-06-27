# TileBoard Draw-Call Spike Notes

Dev-only performance notes for the `TileBoardScene` draw path.

Manual Chromium DevTools audit:

- Open Performance, enable screenshots and WebGL, then record while shuffling a 48+ tile board on medium quality.
- Track draw calls, GPU time, and JS `useFrame` cost.
- Use `perfBoard` / `perfBoardVerbose` localStorage flags for local instrumentation.

Future instancing prototype:

- Candidate: replace invisible per-tile pick slabs in `TileBezel` with one `InstancedMesh`.
- Use `instanceMatrix` plus a map from `instanceId` to `tileId` for raycast lookup.
- Rim and hover rings share materials but not meshes today; merging them likely needs an atlas or multi-material instancing.

Current decision: keep per-tile meshes until `boardSceneDrawCalls` is consistently above roughly 200 on target hardware.

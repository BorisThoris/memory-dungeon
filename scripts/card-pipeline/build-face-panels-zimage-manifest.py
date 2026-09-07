#!/usr/bin/env python3
"""
Writes `face-panels.zimage.manifest.json` for batch_local_zimage.py: 80 tarot illustration
mats (48 common / 24 uncommon / 8 rare) in the same slot order the runtime weighted strip
expects (`weightedFacePanelPool.ts` slices 0-48 / 48-72 / 72-80).

Renders are ~2.2x the runtime mat (1136x1296) so the Z-Image-Turbo output is still sharp after
install_zimage_picks.py crops the edge inset and downscales it to the 520x592 PNG master.

  py -3.12 scripts/card-pipeline/build-face-panels-zimage-manifest.py
  yarn face-panels:local:zimage
"""

from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "face-panels.zimage.manifest.json"

# Runtime mat is 520x592 (see cross-repo batch_local_face_panels.py). Render ~2.2x on the 16 px grid and
# let install_zimage_picks.py crop CROP_INSET off every side before the Lanczos downsample: Z-Image likes to
# paint a thin frame or margin right at the canvas edge, and the runtime draws its own ornate frame.
GEN_W = 1136
GEN_H = 1296
CROP_INSET = 0.06

# Positive phrasing only: with guidance_scale=0 the turbo model has no negative prompt, and "no card, no
# faces" wording pulls those very things in. "Tarot" is deliberately absent - it made the model paint a
# bordered card with a figure on it instead of a full-bleed illustration of the object.
STYLE = (
    "a dark fantasy concept painting that fills the whole image edge to edge, the deep midnight blue-black "
    "void stone background and drifting arcane mist reaching all four borders with nothing framing them, "
    "the single inanimate subject centered and glowing in antique gold and cool cyan light, painterly "
    "brushwork, vertical composition, cropped like a detail of a larger mural, "
)

TIER_STYLE = {
    "common": "clean readable shapes.",
    "uncommon": "intricate luminous detail.",
    "rare": "mythic radiant jewel glow, masterpiece quality.",
}

# Same 80 motifs as the SDXL batch so the tier slots keep their meaning.
COMMON = [
    "a glowing crystal obelisk",
    "a crowned crescent moon sigil",
    "two crossed blades over a smoldering ember",
    "a golden chalice holding a flame",
    "a stone tower struck by a violet arc of lightning",
    "a serpent ouroboros ring",
    "an hourglass with sand spiraling upward",
    "an anchor sinking into deep blue mist",
    "a broken mask beneath scattered stars",
    "a lantern hanging in a fog-filled archway",
    "a winged scarab jewel",
    "a thorned rose under a glass dome",
    "a set of glowing balance scales",
    "an arcane horn of plenty spilling light",
    "a spiral shell relic",
    "a sun disk behind rolling clouds",
    "an eclipse ring with a corona",
    "a mirror portal shard",
    "a locked grimoire with a heavy clasp",
    "a compass rose in a storm",
    "a torch at a cavern entrance",
    "a stone well whose water is filled with stars",
    "an ancient stone bridge arching over a misty abyss",
    "a stag skull with antlers wearing a golden crown",
    "a kraken tentacle wrapped around an orb",
    "a phoenix rising in a spiral of ash",
    "a fractured crown of ice",
    "an iron heart inside a furnace",
    "a loom strung with silver thread",
    "a tower of bone dice",
    "a throne overgrown with vine roots",
    "cyan light streaming through a tall gothic window",
    "a ship in a bottle filled with nebula",
    "an old brass lantern glowing on a winding stone path",
    "two silk ribbons knotted together in a golden loop",
    "a chariot wheel throwing sparks",
    "an upright ceremonial sword standing point-down in stone",
    "a fountain of stars shooting upward",
    "a luna moth under the moon",
    "a golden ring with a tiny glowing planet suspended inside it",
    "a black raven feather quill resting on a golden inkwell",
    "a silver key in mist",
    "a copper beetle charm",
    "a frost rose sigil",
    "an ember lotus in bloom",
    "a lantern holding a void spark",
    "a lock wrapped in ivy chain",
    "a salt circle with a single spark",
]

UNCOMMON = [
    "a twin serpent crown set with a ruby",
    "an obsidian throne in silhouette",
    "a celestial brass orrery",
    "a shattered iron helm visor with cyan light leaking through the cracks",
    "a sandglass swirling with nebula",
    "a silver harp with glowing strings",
    "a frozen crown bleeding light",
    "an antique bronze compass with a thin red blood-line marked across its face",
    "a red wax seal stamped with an eye sigil on aged parchment",
    "a thorn-wrapped cathedral spire",
    "a jar holding a blue inferno",
    "a moonlit pool rippling with a rune",
    "an ornate golden gate of tall bars standing half open in thick fog",
    "a cracked adamant pillar",
    "a spirit bell ringing with visible resonance",
    "a spindle of woven fate",
    "a dragon tooth pendant",
    "a brass incense burner releasing a spiral of glowing smoke",
    "a fractal crown of shards",
    "a lone lantern on the prow of an empty wooden ferry on a black river",
    "a pillar of verdict flame",
    "a ring of ornate daggers suspended point-down in the air",
    "a crystallized teardrop",
    "an empty cloak of night sky woven from stars, hanging in the air",
]

RARE = [
    "an apex crown with a void heart",
    "a colossal carved stone gateway opening onto a swirling singularity of light",
    "a world tree root holding a spark",
    "an empty obsidian throne beneath a total eclipse",
    "an ancient stone fountain basin with a column of light rising from it",
    "an obsidian grail erupting in a nova",
    "a golden reliquary box crowned with a pair of sculpted seraph wings",
    "a tall ornate iron lantern burning with a bright cyan flame on a dark cliff edge, the horizon glowing behind it",
]


# Slots re-rolled after review (seed 52000+n painted a paper margin or missed the motif).
REROLL_SEEDS = {5: 52205, 56: 52256, 61: 52261, 74: 52274, 80: 52280}


def main() -> None:
    entries: list[dict] = []
    n = 1
    for tier, motifs in (("common", COMMON), ("uncommon", UNCOMMON), ("rare", RARE)):
        for motif in motifs:
            entries.append(
                {
                    "id": f"face-panel-{n:02d}",
                    "tier": tier,
                    "target": f"src/renderer/assets/cards/illustrations/face-panel-{n:02d}.png",
                    "targetSize": [520, 592],
                    "cropInset": CROP_INSET,
                    "seed": REROLL_SEEDS.get(n, 52000 + n),
                    "prompt": f"{motif}, {STYLE}{TIER_STYLE[tier]}",
                }
            )
            n += 1
    assert n == 81, n
    manifest = {
        "$comment": "Generated by build-face-panels-zimage-manifest.py. Slots 01-48 common, 49-72 uncommon, 73-80 rare (weightedFacePanelPool.ts). Render at ~2.2x, then install_zimage_picks.py crops cropInset per side and downsamples to 520x592 masters.",
        "defaults": {"width": GEN_W, "height": GEN_H, "steps": 8, "candidates": 1},
        "entries": entries,
    }
    OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(entries)} entries)")


if __name__ == "__main__":
    main()

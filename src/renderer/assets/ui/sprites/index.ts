import cathedralCandles from './bg-main-menu-cathedral-v2-sprites.json';
import dungeonFlames from './bg-gameplay-dungeon-ring-v2-sprites.json';
import portalVortex from './bg-mode-classic-v2-sprites.json';

/**
 * Animated cut-outs of a painted backdrop, from `scripts/scene-pipeline/cut_sprites.py`: each one
 * a flipbook strip (frames side by side, straight alpha) that the game composites additively at
 * its box on the plate. Positions are fractions of the plate so any cover-fit of the painting
 * puts the flame back on its torch.
 */
export interface SceneSpriteDef {
    id: string;
    /** Box on the plate, fractions of its width and height. */
    x: number;
    y: number;
    w: number;
    h: number;
    frames: number;
    fps: number;
    /** Resolved URL of the strip. */
    sheet: string;
}

export interface SceneSpriteSet {
    /** The plate the boxes were measured on, in pixels: fixes the aspect ratio of the cover-fit. */
    plate: readonly [number, number];
    kind: string;
    sprites: readonly SceneSpriteDef[];
}

interface SceneSpriteManifest {
    plate: number[];
    kind: string;
    sprites: Array<Omit<SceneSpriteDef, 'sheet'> & { sheet: string }>;
}

const sheetUrls = import.meta.glob<string>('./*.webp', {
    eager: true,
    query: '?url',
    import: 'default'
});

/** A strip that failed to ship is dropped: the painting simply keeps that flame still. */
export const resolveSceneSpriteSet = (manifest: SceneSpriteManifest): SceneSpriteSet => ({
    plate: [manifest.plate[0] ?? 1, manifest.plate[1] ?? 1],
    kind: manifest.kind,
    sprites: manifest.sprites.flatMap((sprite) => {
        const sheet = sheetUrls[`./${sprite.sheet}`];
        return sheet ? [{ ...sprite, sheet }] : [];
    })
});

export const SCENE_SPRITES = {
    /** The candles on the nave's stands (`CathedralScene`: main menu, game over). */
    cathedralCandles: resolveSceneSpriteSet(cathedralCandles),
    /** The six torches of the relightable room (`GameplayScene`). */
    gameplayFlames: resolveSceneSpriteSet(dungeonFlames),
    /** The vortex in the portal's arch (`PortalScene`): one feathered disc the scene spins, not a flipbook. */
    portalVortex: resolveSceneSpriteSet(portalVortex)
} as const;

export type SceneSpriteSetKey = keyof typeof SCENE_SPRITES;

export const getSceneSpriteSheetUrls = (): string[] =>
    Object.values(SCENE_SPRITES).flatMap((set) => set.sprites.map((sprite) => sprite.sheet));

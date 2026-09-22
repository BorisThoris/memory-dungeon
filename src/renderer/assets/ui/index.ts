import brandCrestUrl from './brand-crest.svg';
import dividerOrnamentUrl from './divider-ornament.svg';
import menuEmblemUrl from './menu-emblem.svg';
import menuSealUrl from './menu-seal.svg';
import stageRingUrl from './stage-ring.svg';
import { resolveUiBackgroundUrl } from './modeArt';

export const UI_ART = {
    brandCrest: brandCrestUrl,
    /** Choose Your Path — a painted haze of mist and candlelight, drifting over the stage. */
    choosePathAmbient: resolveUiBackgroundUrl('bg-choose-path-stage-ambient-v2.webp', ''),
    /** Choose Your Path — soft-light texture layer over gameplay base (`sceneLayer` in `ChooseYourPathScreen`). */
    choosePathScene: resolveUiBackgroundUrl('bg-choose-path-stage-v1.webp'),
    dividerOrnament: dividerOrnamentUrl,
    gameplayScene: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v1.webp'),
    /** The relightable room (`GameplayScene`): the dark base and its additive light layers, from `scripts/scene-pipeline/`. */
    gameplaySceneBase: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-base.webp'),
    gameplaySceneGlowRing: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-glow-ring.webp', ''),
    gameplaySceneGlowRunes: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-glow-runes.webp', ''),
    gameplaySceneGlowTorches: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-glow-torches.webp', ''),
    gameplaySceneLightRing: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-light-ring.webp', ''),
    gameplaySceneLightTorchesL: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-light-torches-l.webp', ''),
    gameplaySceneLightTorchesR: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v2-light-torches-r.webp', ''),
    gameplayWorkshopScene: resolveUiBackgroundUrl('bg-gameplay-arcane-workshop-v1.webp'),
    gameplayWorkshopTable: resolveUiBackgroundUrl('bg-board-arcane-table-v1.webp'),
    menuEmblem: menuEmblemUrl,
    menuScene: resolveUiBackgroundUrl('bg-main-menu-cathedral-v1.webp'),
    /** The cathedral as a relightable nave (`CathedralScene`): base plus additive light layers, from `scripts/scene-pipeline/cathedral.sh`. */
    menuSceneBase: resolveUiBackgroundUrl('bg-main-menu-cathedral-v2-base.webp'),
    menuSceneGlowCandles: resolveUiBackgroundUrl('bg-main-menu-cathedral-v2-glow-candles.webp', ''),
    menuSceneGlowWisps: resolveUiBackgroundUrl('bg-main-menu-cathedral-v2-glow-wisps.webp', ''),
    menuSeal: menuSealUrl,
    /** The portal clearing (the Classic poster) as a living scene (`PortalScene`, behind Choose Your Path), from `scripts/scene-pipeline/portal.sh`. */
    portalSceneBase: resolveUiBackgroundUrl('bg-mode-classic-v2-base.webp'),
    portalSceneGlowMoon: resolveUiBackgroundUrl('bg-mode-classic-v2-glow-moon.webp', ''),
    portalSceneGlowRunes: resolveUiBackgroundUrl('bg-mode-classic-v2-glow-runes.webp', ''),
    portalSceneStars: resolveUiBackgroundUrl('bg-mode-classic-v2-stars.webp', ''),
    stageRing: stageRingUrl
} as const;

export type UiArtKey = keyof typeof UI_ART;

export const UI_ART_KEYS = [
    'brandCrest',
    'choosePathAmbient',
    'choosePathScene',
    'dividerOrnament',
    'gameplayScene',
    'gameplaySceneBase',
    'gameplaySceneGlowRing',
    'gameplaySceneGlowRunes',
    'gameplaySceneGlowTorches',
    'gameplaySceneLightRing',
    'gameplaySceneLightTorchesL',
    'gameplaySceneLightTorchesR',
    'gameplayWorkshopScene',
    'gameplayWorkshopTable',
    'menuEmblem',
    'menuScene',
    'menuSceneBase',
    'menuSceneGlowCandles',
    'menuSceneGlowWisps',
    'menuSeal',
    'portalSceneBase',
    'portalSceneGlowMoon',
    'portalSceneGlowRunes',
    'portalSceneStars',
    'stageRing'
] as const satisfies readonly UiArtKey[];

export interface UiArtRow {
    key: UiArtKey;
    assetUrl: string;
}

export const getUiArtRows = (): UiArtRow[] =>
    UI_ART_KEYS.map((key) => ({
        key,
        assetUrl: UI_ART[key]
    }));

export { MODE_CARD_ART, MODE_POSTER_KEYS, resolveModePosterUrl } from './modeArt';

import brandCrestUrl from './brand-crest.svg';
import dividerOrnamentUrl from './divider-ornament.svg';
import menuEmblemUrl from './menu-emblem.svg';
import menuSealUrl from './menu-seal.svg';
import stageRingUrl from './stage-ring.svg';
import { resolveUiBackgroundUrl } from './modeArt';

export const UI_ART = {
    brandCrest: brandCrestUrl,
    /** Choose Your Path — soft-light texture layer over gameplay base (`sceneLayer` in `ChooseYourPathScreen`). */
    choosePathScene: resolveUiBackgroundUrl('bg-choose-path-stage-v1.webp'),
    dividerOrnament: dividerOrnamentUrl,
    gameplayScene: resolveUiBackgroundUrl('bg-gameplay-dungeon-ring-v1.webp'),
    gameplayWorkshopScene: resolveUiBackgroundUrl('bg-gameplay-arcane-workshop-v1.webp'),
    gameplayWorkshopTable: resolveUiBackgroundUrl('bg-board-arcane-table-v1.webp'),
    menuEmblem: menuEmblemUrl,
    menuScene: resolveUiBackgroundUrl('bg-main-menu-cathedral-v1.webp'),
    menuSeal: menuSealUrl,
    stageRing: stageRingUrl
} as const;

export type UiArtKey = keyof typeof UI_ART;

export { MODE_CARD_ART, resolveModePosterUrl } from './modeArt';

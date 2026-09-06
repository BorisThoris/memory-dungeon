type AssetRightsStatus = 'authored' | 'ai_generated_project' | 'generated_pipeline' | 'placeholder' | 'licensed_required';
type AssetDropInRisk = 'low' | 'medium' | 'high';

interface AssetDropInCategory {
    id: 'ui_scenes' | 'mode_posters' | 'logo_emblems' | 'card_textures' | 'audio_sfx' | 'store_media';
    label: string;
    authoritativePath: string;
    acceptedFormats: readonly string[];
    namingExample: string;
    manifestOrBarrel: string;
    fallbackBehavior: string;
    rightsStatus: AssetRightsStatus;
    dropInRisk: AssetDropInRisk;
    verification: readonly string[];
}

export const ASSET_DROP_IN_CATEGORIES: readonly AssetDropInCategory[] = [
    {
        id: 'ui_scenes',
        label: 'Menu/gameplay/Choose Path scenes',
        authoritativePath: 'src/renderer/assets/ui/backgrounds/',
        acceptedFormats: ['png', 'webp'],
        namingExample: 'bg-main-menu-cathedral-v2.webp',
        manifestOrBarrel: 'src/renderer/assets/ui/index.ts UI_ART',
        fallbackBehavior: 'Components keep procedural/gradient chrome and layout if scene art is swapped or omitted.',
        rightsStatus: 'ai_generated_project',
        dropInRisk: 'medium',
        verification: ['yarn audit:renderer-assets', 'yarn test:e2e:visual:smoke']
    },
    {
        id: 'mode_posters',
        label: 'Choose Path mode posters',
        authoritativePath: 'src/renderer/assets/ui/backgrounds/',
        acceptedFormats: ['png', 'webp'],
        namingExample: 'bg-mode-gauntlet-v1.webp',
        manifestOrBarrel: 'src/renderer/assets/ui/modeArt.ts MODE_CARD_ART',
        fallbackBehavior: 'Unknown or unfinished poster keys resolve to bg-mode-placeholder-v1.webp and show fallback badges.',
        rightsStatus: 'ai_generated_project',
        dropInRisk: 'low',
        verification: ['yarn vitest run src/renderer/assets/ui/modeArt.test.ts']
    },
    {
        id: 'logo_emblems',
        label: 'Brand crest, seal, divider, emblems',
        authoritativePath: 'src/renderer/assets/ui/',
        acceptedFormats: ['svg'],
        namingExample: 'brand-crest-v2.svg',
        manifestOrBarrel: 'src/renderer/assets/ui/index.ts UI_ART',
        fallbackBehavior: 'Hero copy remains text-readable; SVG swaps must preserve transparent bounds.',
        rightsStatus: 'authored',
        dropInRisk: 'medium',
        verification: ['yarn audit:renderer-assets', 'yarn typecheck']
    },
    {
        id: 'card_textures',
        label: 'Card backs/fronts and material maps',
        authoritativePath: 'src/renderer/assets/textures/cards/',
        acceptedFormats: ['svg', 'png', 'webp'],
        namingExample: 'authored-card-back.svg',
        manifestOrBarrel: 'src/renderer/components/tileTextures.ts',
        fallbackBehavior: 'Card rendering treats front/back SVGs as atomic layers; optional authored-card assets remain shelf stock.',
        rightsStatus: 'generated_pipeline',
        dropInRisk: 'high',
        verification: ['yarn test:e2e:illustration-regression', 'yarn test:e2e:renderer-qa']
    },
    {
        id: 'audio_sfx',
        label: 'SFX, UI cues, and music loops',
        authoritativePath: 'src/renderer/assets/audio/',
        acceptedFormats: ['wav', 'ogg', 'json'],
        namingExample: 'sfx/flip.ogg',
        manifestOrBarrel: 'src/renderer/assets/audio/**/manifest.json',
        fallbackBehavior: 'sampledSfx/uiSfx fall back to procedural Web Audio when files are missing or decode fails.',
        rightsStatus: 'generated_pipeline',
        dropInRisk: 'medium',
        verification: ['yarn vitest run src/renderer/audio/gameSfx.test.ts src/renderer/audio/uiSfx.test.ts']
    },
    {
        id: 'store_media',
        label: 'Steam capsule, screenshots, trailer, store art',
        authoritativePath: 'build/ or release/store-media/ (future)',
        acceptedFormats: ['png', 'jpg', 'webp', 'mp4'],
        namingExample: 'steam-capsule-main-616x353.png',
        manifestOrBarrel: 'REG-061 store readiness ledger',
        fallbackBehavior: 'Not bundled in runtime; missing files block release packaging only when REG-061 activates.',
        rightsStatus: 'licensed_required',
        dropInRisk: 'high',
        verification: ['REG-061 platform/store checklist', 'package smoke on release machine']
    }
];

export const getAssetDropInCategories = (): readonly AssetDropInCategory[] => ASSET_DROP_IN_CATEGORIES;

/** REG-113: single inventory handle for third-wave/ship placeholder slots (alias of the readiness table). */
export const REG113_PLACEHOLDER_INVENTORY: readonly AssetDropInCategory[] = [...ASSET_DROP_IN_CATEGORIES];

export const assetDropInCategoryById = (id: AssetDropInCategory['id']): AssetDropInCategory | null =>
    ASSET_DROP_IN_CATEGORIES.find((category) => category.id === id) ?? null;

export const assetDropInReadinessSummary = (): {
    categories: number;
    placeholderCount: number;
    licensedRequiredCount: number;
    verificationCommands: string[];
} => {
    const commands = new Set<string>();
    for (const category of ASSET_DROP_IN_CATEGORIES) {
        for (const command of category.verification) {
            commands.add(command);
        }
    }
    return {
        categories: ASSET_DROP_IN_CATEGORIES.length,
        placeholderCount: ASSET_DROP_IN_CATEGORIES.filter((category) => category.rightsStatus === 'placeholder').length,
        licensedRequiredCount: ASSET_DROP_IN_CATEGORIES.filter((category) => category.rightsStatus === 'licensed_required').length,
        verificationCommands: [...commands]
    };
};

export const assetDropInReadinessComplete = (): boolean =>
    ASSET_DROP_IN_CATEGORIES.every(
        (category) =>
            category.authoritativePath.length > 0 &&
            category.manifestOrBarrel.length > 0 &&
            category.fallbackBehavior.length > 0 &&
            category.verification.length > 0
    );

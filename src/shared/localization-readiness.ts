export type LocalizationReadinessStatus = 'english_source' | 'deferred' | 'excluded';

export interface LocalizationReadinessRow {
    id: 'shipping_locale' | 'copy_modules' | 'shared_catalogs' | 'concat_policy' | 'mechanics_version';
    label: string;
    status: LocalizationReadinessStatus;
    owner: 'shared' | 'renderer' | 'docs';
    guidance: string;
}

export const LOCALIZATION_READINESS_ROWS: readonly LocalizationReadinessRow[] = [
    {
        id: 'shipping_locale',
        label: 'Shipping locale',
        status: 'english_source',
        owner: 'docs',
        guidance: 'Steam demo v1 ships English only; UI must not promise non-English locales before an i18n stack exists.'
    },
    {
        id: 'copy_modules',
        label: 'Renderer copy modules',
        status: 'english_source',
        owner: 'renderer',
        guidance: 'New large player-facing UI copy should prefer src/renderer/copy/* or small shared domain modules over inline JSX blocks.'
    },
    {
        id: 'shared_catalogs',
        label: 'Shared catalogs',
        status: 'english_source',
        owner: 'shared',
        guidance: 'Mechanics, achievements, relics, mutators, modes, and progression rows keep stable ids with English fallback strings.'
    },
    {
        id: 'concat_policy',
        label: 'Interpolation policy',
        status: 'deferred',
        owner: 'docs',
        guidance: 'Avoid complex player-facing string concatenation; future react-i18next keys should use interpolation placeholders.'
    },
    {
        id: 'mechanics_version',
        label: 'Mechanics copy version',
        status: 'english_source',
        owner: 'shared',
        guidance: 'Meaningful mechanics/Codex text changes must keep encyclopedia tests current and bump ENCYCLOPEDIA_VERSION when semantics change.'
    }
];

export const getLocalizationReadinessRows = (): readonly LocalizationReadinessRow[] => LOCALIZATION_READINESS_ROWS;

export const localizationReadinessHasNoLocalePromise = (copy: string): boolean =>
    !/\b(localized|translations?|français|deutsch|español|日本語|coming (?:soon|later) in (?:multiple )?languages)\b/i.test(copy);

export const LOCALIZATION_FOUNDATION_DECISION = {
    shippingLocale: 'en',
    uiPromise: 'english_only_v1',
    futureStack: 'react-i18next',
    nonEnglishUiPromised: false
} as const;

export interface LocalizationCopySurfaceRow {
    surface: 'mechanics' | 'game_over' | 'inventory' | 'relic_draft' | 'component_inline';
    owner: string;
    stableIds: boolean;
}

export const getLocalizationCopySurfaceRows = (): LocalizationCopySurfaceRow[] => [
    { surface: 'mechanics', owner: 'src/shared/mechanics-encyclopedia.ts', stableIds: true },
    { surface: 'game_over', owner: 'src/renderer/copy/gameOverScreen.ts', stableIds: true },
    { surface: 'inventory', owner: 'src/renderer/components/inventoryScreenModel.ts', stableIds: true },
    { surface: 'relic_draft', owner: 'src/renderer/copy/relicDraftOffer.ts', stableIds: true },
    // Not a file: components may no longer carry prose at all (`scripts/copy-locality.ts` holds
    // that at zero), so what is left inline is short labels rather than a surface anyone owns.
    { surface: 'component_inline', owner: 'no owning module: short labels only', stableIds: true }
];

export const localizationReadyForNewCopy = (path: string, copy: string): boolean => {
    if (!localizationReadinessHasNoLocalePromise(copy)) {
        return false;
    }
    if (path.includes('/components/') || path.includes('src/renderer/components/')) {
        return copy.length <= 12;
    }
    if (path.includes('/copy/') || path.includes('/shared/')) {
        return true;
    }
    return copy.length <= 24;
};

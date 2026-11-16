export type LocalizationReadinessStatus = 'english_source' | 'shipping' | 'deferred' | 'excluded';

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
        label: 'Shipping locales',
        status: 'shipping',
        owner: 'docs',
        guidance: 'English, Simplified Chinese, Russian, Spanish, Brazilian Portuguese, German and French (owner, 2026-11-16; docs/LOCALIZATION_PLAN.md). Non-English text is machine-drafted and unreviewed; store pages must not claim more.'
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
        guidance: 'Mechanics, achievements, mutators, modes, and progression rows keep stable ids with English fallback strings.'
    },
    {
        id: 'concat_policy',
        label: 'Interpolation policy',
        status: 'shipping',
        owner: 'docs',
        guidance: 'Player-facing text goes through tr (src/shared/i18n.ts): one template per sentence, placeholders for values, plural() for counts; never build a sentence from translated fragments.'
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

/** Copy must not promise a language the game does not ship (Japanese, or "more languages soon"). */
export const localizationReadinessHasNoLocalePromise = (copy: string): boolean =>
    !/(日本語|한국어|\bcoming (?:soon|later) in (?:multiple |more )?languages\b)/iu.test(copy);

export const LOCALIZATION_FOUNDATION_DECISION = {
    sourceLocale: 'en',
    shippingLocales: ['en', 'zh-Hans', 'ru', 'es', 'pt-BR', 'de', 'fr'],
    stack: 'tr tagged template, English text as key (src/shared/i18n.ts)',
    translationsReviewedByNativeSpeakers: false
} as const;

export interface LocalizationCopySurfaceRow {
    surface: 'mechanics' | 'game_over' | 'inventory' | 'component_inline';
    owner: string;
    stableIds: boolean;
}

export const getLocalizationCopySurfaceRows = (): LocalizationCopySurfaceRow[] => [
    { surface: 'mechanics', owner: 'src/shared/mechanics-encyclopedia.ts', stableIds: true },
    { surface: 'game_over', owner: 'src/renderer/copy/gameOverScreen.ts', stableIds: true },
    { surface: 'inventory', owner: 'src/renderer/components/inventoryScreenModel.ts', stableIds: true },
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

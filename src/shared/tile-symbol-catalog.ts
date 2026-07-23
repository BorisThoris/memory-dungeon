/**
 * Read-only tile face symbols for gallery + gameplay (pair generation imports from here).
 *
 * Symbol band floor thresholds and balance process: `docs/BALANCE_NOTES.md` (section *Symbol band thresholds*).
 */
import { runNonNegativeInteger } from './run-number-guards';

/** Inclusive last floor level for the numeric (two-digit rank) symbol band. See `docs/BALANCE_NOTES.md`. */
export const SYMBOL_BAND_LAST_LEVEL_NUMERIC = 8;
/** Inclusive last floor level for the letter / digit-mixed band before callsigns. See `docs/BALANCE_NOTES.md`. */
export const SYMBOL_BAND_LAST_LEVEL_LETTER = 16;

export interface TileSymbolEntry {
    symbol: string;
    label: string;
}

export type SymbolBandId = 'numeric' | 'letter_hybrid' | 'callsign';
export type SymbolBandDifficulty = 'early_readable' | 'mid_discrimination' | 'late_callsign';

export interface SymbolBandReadabilityProfile {
    id: SymbolBandId;
    title: string;
    levelRange: string;
    difficulty: SymbolBandDifficulty;
    purpose: string;
    mobileReadability: string;
    distractorPolicy: string;
    maxRecommendedLabelLength: number;
}

export const LETTER_SYMBOLS: TileSymbolEntry[] = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    '1',
    '2',
    '3',
    '4'
].map((value) => ({ symbol: value, label: value }));

export const NUMBER_SYMBOLS: TileSymbolEntry[] = Array.from({ length: 30 }, (_value, index) => {
    const next = String(index + 1).padStart(2, '0');
    return { symbol: next, label: next };
});

export const CALLSIGN_SYMBOLS: TileSymbolEntry[] = [
    ['AL', 'Alder'],
    ['BR', 'Briar'],
    ['CR', 'Crown'],
    ['DK', 'Dusk'],
    ['EL', 'Ember'],
    ['FL', 'Flare'],
    ['GL', 'Gale'],
    ['HR', 'Harbor'],
    ['IV', 'Ivory'],
    ['JN', 'Juniper'],
    ['KT', 'Kestrel'],
    ['LN', 'Lantern'],
    ['MR', 'Meteor'],
    ['NV', 'Nova'],
    ['OR', 'Oracle'],
    ['PR', 'Prism'],
    ['QT', 'Quartz'],
    ['RV', 'Raven'],
    ['SL', 'Signal'],
    ['TR', 'Torrent'],
    ['UL', 'Umber'],
    ['VL', 'Velvet'],
    ['WR', 'Whisper'],
    ['XR', 'Xylo'],
    ['YS', 'Yonder'],
    ['ZT', 'Zephyr'],
    ['C1', 'Cipher'],
    ['D2', 'Drift'],
    ['E3', 'Echo'],
    ['F4', 'Fathom']
].map(([symbol, label]) => ({ symbol, label }));

/**
 * Symbol bands for gallery / mutators. Default level play rotates bands by floor (see {@link getSymbolSetIndexForLevel}).
 * Tuning table: `docs/BALANCE_NOTES.md`.
 */
export const TILE_SYMBOL_SETS = [NUMBER_SYMBOLS, LETTER_SYMBOLS, CALLSIGN_SYMBOLS] as const;
const DEFAULT_SYMBOL_BAND_ID: SymbolBandId = 'numeric';
const SYMBOL_SETS_BY_BAND_ID: Record<SymbolBandId, readonly TileSymbolEntry[]> = {
    numeric: NUMBER_SYMBOLS,
    letter_hybrid: LETTER_SYMBOLS,
    callsign: CALLSIGN_SYMBOLS
};

export const ALL_TILE_SYMBOLS_FOR_GALLERY: TileSymbolEntry[] = [
    ...LETTER_SYMBOLS,
    ...NUMBER_SYMBOLS,
    ...CALLSIGN_SYMBOLS
];

/**
 * Staged band index: numeric glyphs early, mixed letters mid, callsigns later (caps at last band).
 * Thresholds are balance-owned; see `docs/BALANCE_NOTES.md`.
 */
export const getSymbolSetIndexForLevel = (level: number): number => {
    const L = Math.max(1, runNonNegativeInteger(level));
    if (L <= SYMBOL_BAND_LAST_LEVEL_NUMERIC) {
        return 0;
    }
    if (L <= SYMBOL_BAND_LAST_LEVEL_LETTER) {
        return 1;
    }
    return 2;
};

export const getSymbolSetForLevel = (level: number): readonly TileSymbolEntry[] =>
    TILE_SYMBOL_SETS[getSymbolSetIndexForLevel(level)] ?? SYMBOL_SETS_BY_BAND_ID[DEFAULT_SYMBOL_BAND_ID];

export const SYMBOL_BAND_READABILITY_PROFILES: readonly SymbolBandReadabilityProfile[] = [
    {
        id: 'numeric',
        title: 'Numeric ranks',
        levelRange: `1-${SYMBOL_BAND_LAST_LEVEL_NUMERIC}`,
        difficulty: 'early_readable',
        purpose: 'Low-language, high-contrast two-digit ranks for early floors and mobile tile sizes.',
        mobileReadability: 'Two glyphs, numeric silhouette, short label; intended to remain legible on small boards.',
        distractorPolicy: 'Dense but ordered; avoid single-digit O/0 or I/1 ambiguity by padding to two digits.',
        maxRecommendedLabelLength: 2
    },
    {
        id: 'letter_hybrid',
        title: 'Letter / digit hybrid',
        levelRange: `${SYMBOL_BAND_LAST_LEVEL_NUMERIC + 1}-${SYMBOL_BAND_LAST_LEVEL_LETTER}`,
        difficulty: 'mid_discrimination',
        purpose: 'Step-up band that mixes letters and a few digits before callsign labels arrive.',
        mobileReadability: 'Single glyph label keeps tile faces large; confusable glyphs are known pressure, not color-only.',
        distractorPolicy: 'Contains intentional letter/digit distractors; `category_letters` forces this band as a readable mutator identity.',
        maxRecommendedLabelLength: 1
    },
    {
        id: 'callsign',
        title: 'Callsign pairs',
        levelRange: `${SYMBOL_BAND_LAST_LEVEL_LETTER + 1}+`,
        difficulty: 'late_callsign',
        purpose: 'Late-run semantic labels add memory load without increasing pair count alone.',
        mobileReadability: 'Two-character symbol plus short word label; labels should stay compact and pronounceable.',
        distractorPolicy: 'Avoid same-prefix words with identical silhouette when adding new callsigns.',
        maxRecommendedLabelLength: 8
    }
];

export interface SymbolBandReadabilityIssue {
    bandId: SymbolBandId;
    severity: 'error' | 'warning';
    message: string;
    symbols: string[];
}

const CONFUSABLE_SYMBOL_GROUPS: readonly (readonly string[])[] = [
    ['0', 'O'],
    ['1', 'I', 'L'],
    ['2', 'Z'],
    ['5', 'S'],
    ['8', 'B']
];

const duplicateValues = (values: readonly string[]): string[] => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) {
            dupes.add(value);
        }
        seen.add(value);
    }
    return [...dupes].sort();
};

export const auditSymbolBandReadability = (): SymbolBandReadabilityIssue[] => {
    const issues: SymbolBandReadabilityIssue[] = [];
    SYMBOL_BAND_READABILITY_PROFILES.forEach((profile) => {
        const bandId = profile.id;
        const entries = SYMBOL_SETS_BY_BAND_ID[bandId] ?? SYMBOL_SETS_BY_BAND_ID[DEFAULT_SYMBOL_BAND_ID];
        const symbols = entries.map((entry) => entry.symbol);
        const labels = entries.map((entry) => entry.label);
        const duplicateSymbols = duplicateValues(symbols);
        if (duplicateSymbols.length > 0) {
            issues.push({
                bandId,
                severity: 'error',
                message: 'Duplicate symbols would make pair identity ambiguous.',
                symbols: duplicateSymbols
            });
        }
        const duplicateLabels = duplicateValues(labels);
        if (duplicateLabels.length > 0) {
            issues.push({
                bandId,
                severity: 'error',
                message: 'Duplicate labels would break screen-reader and memory identity.',
                symbols: duplicateLabels
            });
        }
        const longLabels = entries
            .filter((entry) => entry.label.length > profile.maxRecommendedLabelLength)
            .map((entry) => entry.label);
        if (longLabels.length > 0) {
            issues.push({
                bandId,
                severity: 'warning',
                message: `Labels exceed recommended length ${profile.maxRecommendedLabelLength} for this band.`,
                symbols: longLabels
            });
        }
        for (const group of CONFUSABLE_SYMBOL_GROUPS) {
            const present = group.filter((symbol) => symbols.includes(symbol));
            if (present.length > 1) {
                issues.push({
                    bandId,
                    severity: 'warning',
                    message: 'Potentially confusable glyphs are present; keep this band intentionally placed and documented.',
                    symbols: present
                });
            }
        }
    });
    return issues;
};

export const getSymbolBandReadabilityRows = (): {
    band: 'numeric' | 'letters' | 'callsigns';
    maxLabelLength: number;
    forbiddenConfusables: string[];
}[] =>
    SYMBOL_BAND_READABILITY_PROFILES.map((profile) => {
        const entries = SYMBOL_SETS_BY_BAND_ID[profile.id] ?? SYMBOL_SETS_BY_BAND_ID[DEFAULT_SYMBOL_BAND_ID];
        const warnings = auditSymbolBandReadability().filter(
            (issue) => issue.bandId === profile.id && issue.message.includes('confusable')
        );
        return {
            band: profile.id === 'letter_hybrid' ? 'letters' : profile.id === 'callsign' ? 'callsigns' : 'numeric',
            maxLabelLength: Math.max(...entries.map((entry) => entry.label.length)),
            forbiddenConfusables: warnings.flatMap((warning) => warning.symbols).filter((symbol) => symbol === '0' || symbol === 'O')
        };
    });

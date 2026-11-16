/**
 * Translation of player-facing copy (docs/LOCALIZATION_PLAN.md).
 *
 * The English text is the key. `` tr`Floor ${n} cleared.` `` looks up `Floor {0} cleared.` in the
 * active catalog and fills the placeholders; with no catalog installed (English, every test, the
 * soak, node scripts) it returns exactly the English it was given. The catalog is installed once at
 * boot, before the app's modules evaluate, so module-level copy constants are already translated.
 *
 * Rule code never calls this: only copy does, and the locale never reaches a seed, a share key,
 * the journal or a record.
 */

export const SHIPPING_LOCALES = ['en', 'zh-Hans', 'ru', 'es', 'pt-BR', 'de', 'fr'] as const;
export type ShippingLocale = (typeof SHIPPING_LOCALES)[number];
/** Accented, lengthened English: finds unwrapped strings and clipping. Never offered to players. */
export const PSEUDO_LOCALE = 'en-XA' as const;
export type Locale = ShippingLocale | typeof PSEUDO_LOCALE;

/** Each language named in itself, as a picker must show it. */
export const LOCALE_NATIVE_NAMES: Record<ShippingLocale, string> = {
    en: 'English',
    'zh-Hans': '简体中文',
    ru: 'Русский',
    es: 'Español',
    'pt-BR': 'Português (Brasil)',
    de: 'Deutsch',
    fr: 'Français'
};

export type MessageCatalog = Readonly<Record<string, string>>;

let activeLocale: Locale = 'en';
let activeCatalog: MessageCatalog | null = null;
let pluralRules = new Intl.PluralRules('en');

export const getActiveLocale = (): Locale => activeLocale;

/** Install a catalog (null for English). Called at boot; tests may call it and must reset after. */
export const setActiveLocale = (locale: Locale, catalog: MessageCatalog | null): void => {
    activeLocale = locale;
    activeCatalog = locale === 'en' ? null : catalog;
    pluralRules = new Intl.PluralRules(locale === PSEUDO_LOCALE ? 'en' : locale);
};

const isShippingLocale = (value: string): value is ShippingLocale =>
    (SHIPPING_LOCALES as readonly string[]).includes(value);

/** The best shipping locale for a list of BCP 47 tags, in the player's order of preference. */
export const matchShippingLocale = (preferred: readonly string[]): ShippingLocale => {
    for (const raw of preferred) {
        const tag = raw.trim();
        if (!tag) {
            continue;
        }
        if (isShippingLocale(tag)) {
            return tag;
        }
        const lower = tag.toLowerCase();
        if (lower.startsWith('zh')) {
            // Traditional-script tags are not served Simplified; they fall through to the next choice.
            if (/^zh-(hant|tw|hk|mo)\b/u.test(lower)) {
                continue;
            }
            return 'zh-Hans';
        }
        if (lower.startsWith('pt')) {
            return 'pt-BR';
        }
        const base = lower.split('-')[0];
        const match = SHIPPING_LOCALES.find((locale) => locale === base);
        if (match) {
            return match;
        }
    }
    return 'en';
};

export const parseStoredLocale = (value: string | null | undefined): Locale | null => {
    if (!value) {
        return null;
    }
    if (value === PSEUDO_LOCALE || isShippingLocale(value)) {
        return value;
    }
    return null;
};

/** `Floor {0} cleared.` from the template's literal parts. */
export const templateKey = (strings: readonly string[]): string =>
    strings.reduce((key, part, index) => (index === 0 ? part : `${key}{${index - 1}}${part}`), '');

const fill = (pattern: string, values: readonly unknown[]): string =>
    pattern.replace(/\{(\d+)\}/gu, (whole, digits: string) => {
        const index = Number(digits);
        return index < values.length ? String(values[index]) : whole;
    });

const PSEUDO_MAP: Record<string, string> = {
    a: 'á', e: 'é', i: 'ï', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', y: 'ý',
    A: 'Å', E: 'É', I: 'Ï', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ', Y: 'Ý'
};

/** Accent every letter outside a placeholder and pad by about 40%, in brackets so cut-offs show. */
export const pseudoLocalize = (text: string): string => {
    const accented = text.replace(/\{\d+\}|[aeiouycnAEIOUYCN]/gu, (part) => PSEUDO_MAP[part] ?? part);
    const pad = '~'.repeat(Math.max(1, Math.round(text.length * 0.4)));
    return `[${accented}${pad}]`;
};

const translatePattern = (key: string): string => {
    if (activeLocale === PSEUDO_LOCALE) {
        return pseudoLocalize(key);
    }
    return activeCatalog?.[key] ?? key;
};

/** Translate a plain string: `tr.s('Descend')`. */
const translateString = (text: string): string => {
    if (!activeCatalog && activeLocale !== PSEUDO_LOCALE) {
        return text;
    }
    const translated = translatePattern(text);
    rememberEnglish(translated, text);
    return translated;
};

type Tr = ((strings: TemplateStringsArray, ...values: unknown[]) => string) & { s: (text: string) => string };

/*
 * Some HUD code reads meaning out of announcement text it did not write (gameScreenFeedback.ts
 * watches for "pickup cashout"). It reads the English: every translated line remembers the English
 * it stands for, its translated parts mapped back too, in a small bounded memory.
 */
const ENGLISH_MEMORY_LIMIT = 600;
const englishByTranslation = new Map<string, string>();

const rememberEnglish = (translated: string, english: string): void => {
    if (translated === english) {
        return;
    }
    englishByTranslation.delete(translated);
    englishByTranslation.set(translated, english);
    if (englishByTranslation.size > ENGLISH_MEMORY_LIMIT) {
        const oldest = englishByTranslation.keys().next().value;
        if (oldest !== undefined) {
            englishByTranslation.delete(oldest);
        }
    }
};

/** The English a translated line was made from, or the text itself when it is not a remembered translation. */
export const englishOf = (text: string): string => englishByTranslation.get(text) ?? text;

const englishFill = (strings: readonly string[], values: readonly unknown[]): string => {
    let out = strings[0] ?? '';
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        out += (typeof value === 'string' ? englishOf(value) : String(value)) + (strings[index + 1] ?? '');
    }
    return out;
};

const translateTemplate = (strings: TemplateStringsArray, ...values: unknown[]): string => {
    if (!activeCatalog && activeLocale !== PSEUDO_LOCALE) {
        // English: rebuild exactly what the untagged template would have produced.
        let out = strings[0] ?? '';
        for (let index = 0; index < values.length; index += 1) {
            out += String(values[index]) + (strings[index + 1] ?? '');
        }
        return out;
    }
    const translated = fill(translatePattern(templateKey(strings)), values);
    rememberEnglish(translated, englishFill(strings, values));
    return translated;
};

export const tr: Tr = Object.assign(translateTemplate, { s: translateString });

/**
 * For code that recognises copy another module made (a label it branches on): true for the English
 * or its translation, so the branch still fires in every language.
 */
export const isCopy = (value: string | null | undefined, english: string): boolean =>
    value != null && (value === english || value === translateString(english));

/** Whether `value` begins the way the catalog's `key` begins, up to its first placeholder. */
export const startsWithCopyPrefix = (value: string | null | undefined, key: string): boolean => {
    if (value == null) {
        return false;
    }
    const prefix = (text: string): string => text.slice(0, text.search(/\{\d+\}/u) >= 0 ? text.search(/\{\d+\}/u) : text.length);
    const english = prefix(key);
    const translated = prefix(translatePattern(key));
    return (english !== '' && value.startsWith(english)) || (translated !== '' && value.startsWith(translated));
};

export interface PluralForms {
    one: string;
    other: string;
    zero?: string;
    two?: string;
    few?: string;
    many?: string;
}

/**
 * Pick the plural form for `count` and fill `{0}` with it. Every form is itself a key, so a
 * catalog translates `{0} pair` and `{0} pairs` and supplies its own `few`/`many` under the key
 * `{0} pairs#few` / `{0} pairs#many` (Russian needs both).
 */
export const plural = (count: number, forms: PluralForms, ...values: unknown[]): string => {
    const category = pluralRules.select(count) as keyof PluralForms;
    const englishCategory = new Intl.PluralRules('en').select(count) === 'one' ? forms.one : forms.other;
    const args = [count, ...values];
    if (!activeCatalog && activeLocale !== PSEUDO_LOCALE) {
        return fill(englishCategory, args);
    }
    const keyed = activeCatalog?.[`${forms.other}#${category}`];
    const translated = keyed ? fill(keyed, args) : fill(translatePattern(englishCategory), args);
    rememberEnglish(translated, englishFill([englishCategory], []).replace(/\{(\d+)\}/gu, (whole, digits: string) => {
        const value = args[Number(digits)];
        return value === undefined ? whole : typeof value === 'string' ? englishOf(value) : String(value);
    }));
    return translated;
};

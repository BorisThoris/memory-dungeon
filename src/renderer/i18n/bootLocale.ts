import { getActiveLocale, matchShippingLocale, parseStoredLocale, PSEUDO_LOCALE, setActiveLocale, type Locale, type MessageCatalog } from '../../shared/i18n';

/**
 * The player's language, chosen at boot (docs/LOCALIZATION_PLAN.md).
 *
 * Kept in localStorage rather than the save: it must be readable synchronously before any module
 * that holds copy evaluates, and the save loads later and asynchronously (over IPC on desktop).
 * This module imports nothing that holds copy, which is what lets `main.tsx` run it first.
 */
export const LOCALE_STORAGE_KEY = 'memory-dungeon.locale';

/*
 * Each language is a plain JSON file in the build, fetched once at boot: an English player
 * downloads none, anyone else exactly one (the bundle budget counts it that way). As data rather
 * than JS chunks they never touch the script budget or the CSP's script-src.
 */
const CATALOG_URLS = import.meta.glob<string>(['../../locales/*.json', '!../../locales/en.json'], { query: '?url', import: 'default' });

const catalogLoaderFor = (locale: Locale): (() => Promise<{ default: MessageCatalog }>) | undefined => {
    const urlLoader = CATALOG_URLS[`../../locales/${locale}.json`];
    if (!urlLoader) {
        return undefined;
    }
    return async () => {
        const response = await fetch(await urlLoader());
        if (!response.ok) {
            throw new Error(`catalog ${locale}: HTTP ${response.status}`);
        }
        return { default: (await response.json()) as MessageCatalog };
    };
};

const readStoredLocale = (): Locale | null => {
    try {
        return parseStoredLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
        return null;
    }
};

/** `?lang=de` (or `?lang=en-XA`) wins for one session, for testing; otherwise the saved choice, else the system's. */
export const resolveBootLocale = (search: string, stored: Locale | null, systemLanguages: readonly string[]): Locale => {
    const fromQuery = parseStoredLocale(new URLSearchParams(search).get('lang'));
    if (fromQuery) {
        return fromQuery;
    }
    if (stored) {
        return stored;
    }
    return matchShippingLocale(systemLanguages);
};

export const loadBootLocale = async (): Promise<Locale> => {
    const locale = resolveBootLocale(
        window.location.search,
        readStoredLocale(),
        navigator.languages?.length ? navigator.languages : [navigator.language]
    );
    let catalog: MessageCatalog | null = null;
    if (locale !== 'en' && locale !== PSEUDO_LOCALE) {
        const loader = catalogLoaderFor(locale);
        try {
            catalog = loader ? (await loader()).default : null;
        } catch (error) {
            console.error('[i18n] catalog failed to load; continuing in English', error);
        }
    }
    if (locale !== 'en' && locale !== PSEUDO_LOCALE && !catalog) {
        setActiveLocale('en', null);
    } else {
        setActiveLocale(locale, catalog);
    }
    document.documentElement.lang = getActiveLocale() === PSEUDO_LOCALE ? 'en' : getActiveLocale();
    return getActiveLocale();
};

/** Save a new choice and reload: copy constants evaluate once, at boot. */
export const chooseLocaleAndReload = (locale: Locale): void => {
    try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
        // A blocked storage still lets the reload pick it up from the query for this session.
        const url = new URL(window.location.href);
        url.searchParams.set('lang', locale);
        window.location.replace(url.toString());
        return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('lang');
    window.location.replace(url.toString());
};

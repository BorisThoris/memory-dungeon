import { COMPONENT_PROSE } from '../copy/componentProse';
import { getActiveLocale, LOCALE_NATIVE_NAMES, PSEUDO_LOCALE, SHIPPING_LOCALES, tr, type ShippingLocale } from '../../shared/i18n';
import { chooseLocaleAndReload } from '../i18n/bootLocale';
import styles from './SettingsScreen.module.css';

/**
 * The language choice (docs/LOCALIZATION_PLAN.md). Copy is built once at boot, so a change saves
 * and restarts the screen; inside a run that would drop the board, so it waits for the menu.
 */
export const LanguageRow = ({ inRun }: { inRun: boolean }) => {
    const active = getActiveLocale();
    const value: ShippingLocale = active === PSEUDO_LOCALE ? 'en' : active;
    return (
        <label className={styles.languageRow}>
            <span className={styles.languageLabel}>{tr.s('Language')}</span>
            <select
                className={styles.categorySelect}
                data-testid="settings-language"
                disabled={inRun}
                lang={value}
                onChange={(event) => chooseLocaleAndReload(event.target.value as ShippingLocale)}
                value={value}
            >
                {SHIPPING_LOCALES.map((locale) => (
                    <option key={locale} lang={locale} value={locale}>
                        {LOCALE_NATIVE_NAMES[locale]}
                    </option>
                ))}
            </select>
            <span className={styles.languageHint}>
                {inRun
                    ? COMPONENT_PROSE.languageRowChangeTheLanguageFrom
                    : COMPONENT_PROSE.languageRowTheGameRestartsIn}
            </span>
        </label>
    );
};

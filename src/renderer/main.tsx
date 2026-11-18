import { loadBootLocale } from './i18n/bootLocale';
import { rememberAndroidAppSession } from './rateGame';
import { registerServiceWorker, reloadOnStaleChunk } from './serviceWorker';

registerServiceWorker();
reloadOnStaleChunk();
rememberAndroidAppSession();

/*
 * The language first, then everything else: copy modules build their text when they evaluate, so
 * the catalog has to be installed before any of them is imported (docs/LOCALIZATION_PLAN.md).
 */
void loadBootLocale()
    .catch((error: unknown) => console.error('[i18n] boot locale failed; continuing in English', error))
    .then(() => import('./mainAfterLocale'));

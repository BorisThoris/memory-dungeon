import { GAME_RULES_VERSION } from '../shared/contracts';
import { getActiveLocale } from '../shared/i18n';

/**
 * Settings > About > Report a problem (docs/MARKET_FLOW_REVIEW_WIDER.md, P1): a mail to the
 * address the privacy policy already publishes, with what a bug report needs filled in. Nothing is
 * sent by the game; the player's own mail app opens with the draft.
 */
export const SUPPORT_EMAIL = 'modaxxx009@yahoo.com';

export type SupportPlatform = 'desktop' | 'android' | 'web';

export const detectSupportPlatform = (env: { hasDesktop: boolean; referrer: string; standalone: boolean }): SupportPlatform =>
    env.hasDesktop ? 'desktop' : env.referrer.startsWith('android-app://') || env.standalone ? 'android' : 'web';

export interface SupportReportContext {
    platform: SupportPlatform;
    userAgent: string;
    viewport: string;
    locale: string;
}

/** The mailto link; the facts are English for whoever reads the report, the subject names the game. */
export const buildSupportMailto = (context: SupportReportContext): string => {
    const body = [
        'What happened:',
        '',
        'What you expected:',
        '',
        '---',
        `Rules version: ${GAME_RULES_VERSION}`,
        `Platform: ${context.platform}`,
        `Language: ${context.locale}`,
        `Screen: ${context.viewport}`,
        `Browser: ${context.userAgent}`,
        context.platform === 'desktop' ? 'Crash logs: %APPDATA%\\Memory Dungeon\\crash-logs (attach any from today)' : ''
    ]
        .filter((line, index, lines) => line !== '' || index < lines.length - 1)
        .join('\n');
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Memory Dungeon problem report')}&body=${encodeURIComponent(body)}`;
};

export const currentSupportContext = (): SupportReportContext => ({
    platform: detectSupportPlatform({
        hasDesktop: typeof window !== 'undefined' && window.desktop != null,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        standalone: typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
    }),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x` : 'unknown',
    locale: getActiveLocale()
});

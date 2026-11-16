import { describe, expect, it } from 'vitest';
import { buildSupportMailto, detectSupportPlatform, SUPPORT_EMAIL } from './supportReport';

describe('report a problem', () => {
    it('drafts a mail to the published address with the facts a report needs', () => {
        const link = buildSupportMailto({ platform: 'desktop', userAgent: 'UA/1', viewport: '1280x720 @1x', locale: 'de' });
        expect(link.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
        const body = decodeURIComponent(link.split('&body=')[1] ?? '');
        expect(body).toContain('Rules version: ');
        expect(body).toContain('Platform: desktop');
        expect(body).toContain('Language: de');
        expect(body).toContain('crash-logs');
    });

    it('names the platform from what the page can see', () => {
        expect(detectSupportPlatform({ hasDesktop: true, referrer: '', standalone: false })).toBe('desktop');
        expect(detectSupportPlatform({ hasDesktop: false, referrer: 'android-app://com.boristhoris.memorydungeon/', standalone: false })).toBe('android');
        expect(detectSupportPlatform({ hasDesktop: false, referrer: '', standalone: false })).toBe('web');
    });
});

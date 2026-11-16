import { describe as describeBack, expect as expectBack, it as itBack } from 'vitest';
import { hardwareBackApplies } from './useHardwareBack';

describeBack('where the back guard runs', () => {
    itBack('runs in the Android app, an installed web app, or with ?backGuard=1, never in a browser tab', () => {
        expectBack(hardwareBackApplies({ referrer: 'android-app://com.boristhoris.memorydungeon/', standalone: false, search: '' })).toBe(true);
        expectBack(hardwareBackApplies({ referrer: '', standalone: true, search: '' })).toBe(true);
        expectBack(hardwareBackApplies({ referrer: '', standalone: false, search: '?backGuard=1' })).toBe(true);
        expectBack(hardwareBackApplies({ referrer: 'https://example.com/', standalone: false, search: '' })).toBe(false);
    });
});

import { tr } from '../../shared/i18n';
/** The menu's one-time word about flashing light (`FlashingLightsNotice.tsx`). */
export const FLASHING_NOTICE_STORAGE_KEY = 'memory-dungeon.flashing-notice-seen';

export const FLASHING_NOTICE_COPY = {
    title: tr.s('Flashing light'),
    body: tr.s('Storms flash, and so do the big moments of a run. Reduce Motion stops the flashing and the movement; it is in Settings › Accessibility too.'),
    reduce: tr.s('Turn on Reduce Motion'),
    dismiss: tr.s('Got it')
} as const;

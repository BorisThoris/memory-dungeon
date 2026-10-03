import type { CSSProperties } from 'react';
import type { RealmId } from '../../shared/contracts';
import styles from './RealmScreenOverlay.module.css';
import { useBeat } from './useSceneBeat';

export interface RealmScreenOverlayProps {
    realm: RealmId;
    strength: number;
    seed: number;
    reduceMotion: boolean;
    /** The realm's latest event: the edges surge with it, flames leaping, rain sheeting, charge going white. */
    surgeKey?: string | null;
    /** The realm the board just left (the sway tipped it): it burns, melts or washes off the glass. */
    leaving?: boolean;
}

/** Room tint only. Weather and elemental motion belong to the board's particle pool. */
export function RealmScreenOverlay({ realm, strength, reduceMotion, surgeKey = null, leaving = false }: RealmScreenOverlayProps) {
    const surging = useBeat(surgeKey, 1300);
    return <div aria-hidden="true" className={styles.overlay}
        data-leaving={leaving ? 'true' : 'false'} data-surge={surging && !leaving ? 'true' : 'false'}
        data-realm={realm} data-reduce-motion={reduceMotion ? 'true' : 'false'}
        data-testid={leaving ? 'realm-screen-overlay-leaving' : 'realm-screen-overlay'}
        style={{ '--realm-strength': strength } as CSSProperties}>
        <span className={styles.vignette} />
    </div>;
}

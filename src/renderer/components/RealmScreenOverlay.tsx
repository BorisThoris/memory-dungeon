import type { CSSProperties } from 'react';
import type { RealmId } from '../../shared/contracts';
import styles from './RealmScreenOverlay.module.css';
import { REALMS } from '../../shared/realm-rules';
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

const EDGE_PATHS: Record<RealmId, readonly string[]> = {
    ember: ['M0 200 Q45 154 13 103 Q64 128 36 56 Q96 122 42 171 Q98 146 69 103 Q132 159 79 200', 'M2 200 Q10 144 3 91 M34 196 Q74 168 60 140'],
    tide: ['M-10 28 Q90 65 15 99 T14 170 T33 225', 'M-10 44 Q67 69 2 105 T3 180 T47 224', 'M-20 112 Q95 158 34 196 T126 216'],
    frost: ['M0 200 L13 133 L34 154 L43 75 L66 144 L115 139 L79 172 L155 197 Z', 'M8 194 L44 150 L44 89 M44 150 L68 169 L105 147 M68 169 L96 192'],
    grove: ['M0 200 C76 161 1 107 33 35 M9 187 Q69 183 112 199 M28 127 Q73 111 58 75', 'M29 119 Q-2 105 9 86 Q32 89 29 119 M57 101 Q84 85 73 69 Q53 74 57 101 M64 187 Q75 151 94 163 Q96 185 64 187'],
    storm: ['M0 200 L44 147 L19 130 L69 81 L52 72 L85 24', 'M44 147 L72 151 L94 127 M69 81 L26 62 L39 39']
};

/** Weather silhouettes live at the room's edges. The playable center remains clear. */
export function RealmScreenOverlay({ realm, strength, reduceMotion, surgeKey = null, leaving = false }: RealmScreenOverlayProps) {
    const surging = useBeat(surgeKey, 1300);
    return <div aria-hidden="true" className={styles.overlay}
        data-leaving={leaving ? 'true' : 'false'} data-surge={surging && !leaving ? 'true' : 'false'}
        data-realm={realm} data-reduce-motion={reduceMotion ? 'true' : 'false'}
        data-testid={leaving ? 'realm-screen-overlay-leaving' : 'realm-screen-overlay'}
        style={{ '--realm-strength': strength, '--realm-edge-color': REALMS[realm].color } as CSSProperties}>
        <span className={styles.vignette} />
        {['left', 'right'].map(side => <svg key={side} className={styles.edge} data-side={side} viewBox="0 0 180 210" fill="none">
            {EDGE_PATHS[realm].map((d, index) => <path key={index} d={d} />)}
        </svg>)}
    </div>;
}

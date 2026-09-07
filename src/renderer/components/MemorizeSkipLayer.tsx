import { useCallback, useRef, type MouseEvent, type ReactElement } from 'react';
import { MEMORIZE_SKIP_COPY } from '../copy/runDialogCopy';
import {
    createMemorizeSkipTapState,
    registerMemorizeSkipTap,
    type MemorizeSkipTapState
} from './memorizeSkipGesture';
import styles from './GameScreen.module.css';

interface MemorizeSkipLayerProps {
    onSkip: () => void;
}

/**
 * The layer that lets a player end the study period.
 *
 * It sits over the board only while the board is being studied, which is exactly the stretch in
 * which the board itself takes no presses, so nothing is stolen from the tiles underneath. A
 * pointer needs the deliberate double tap; a keyboard press is already deliberate, so one
 * activation is enough there — `detail === 0` is how the browser says the click came from a key
 * rather than a finger.
 */
export const MemorizeSkipLayer = ({ onSkip }: MemorizeSkipLayerProps): ReactElement => {
    const tapStateRef = useRef<MemorizeSkipTapState>(createMemorizeSkipTapState());

    const handleClick = useCallback(
        (event: MouseEvent<HTMLButtonElement>): void => {
            if (event.detail === 0) {
                onSkip();
                return;
            }
            const result = registerMemorizeSkipTap(tapStateRef.current, Date.now());
            tapStateRef.current = result.state;
            if (result.skip) {
                onSkip();
            }
        },
        [onSkip]
    );

    return (
        <button
            aria-label={MEMORIZE_SKIP_COPY.label}
            className={styles.memorizeSkipLayer}
            data-testid="memorize-skip-layer"
            onClick={handleClick}
            type="button"
        >
            <span aria-hidden="true" className={styles.memorizeSkipHint}>
                {MEMORIZE_SKIP_COPY.hint}
            </span>
        </button>
    );
};

export default MemorizeSkipLayer;

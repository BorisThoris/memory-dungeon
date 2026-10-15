import type { ReactElement } from 'react';
import { testHallRoom, type TestHallRoomId } from '../../shared/test-hall-rooms';
import styles from './TestHall.module.css';

/**
 * Dev only: which test hall room the game is standing in, and the way back to the hall. On a phone
 * the full line sat over the HUD's score and gold, so there it folds to "↩ <room>" on one line.
 */
const TestHallBadge = ({ roomId }: { roomId: TestHallRoomId }): ReactElement => (
    <aside aria-label="Test hall room" className={styles.badge} data-testid="test-hall-badge">
        <span className={styles.badgeTitle}>
            <span className={styles.badgeLong}>Test hall: </span>
            {testHallRoom(roomId).title}
        </span>
        <a aria-label="Back to the hall" className={styles.link} href="/__hall">
            <span className={styles.badgeLong}>Back to the hall</span>
            <span aria-hidden="true" className={styles.badgeShort}>↩</span>
        </a>
    </aside>
);

export default TestHallBadge;

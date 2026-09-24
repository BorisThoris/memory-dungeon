import type { ReactElement } from 'react';
import { testHallRoom, type TestHallRoomId } from '../../shared/test-hall-rooms';
import styles from './TestHall.module.css';

/** Dev only: which test hall room the game is standing in, and the way back to the hall. */
const TestHallBadge = ({ roomId }: { roomId: TestHallRoomId }): ReactElement => (
    <aside aria-label="Test hall room" className={styles.badge} data-testid="test-hall-badge">
        <span>Test hall: {testHallRoom(roomId).title}</span>
        <a className={styles.link} href="/__hall">
            Back to the hall
        </a>
    </aside>
);

export default TestHallBadge;

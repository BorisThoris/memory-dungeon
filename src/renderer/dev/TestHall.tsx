import { useMemo, useState, type ReactElement } from 'react';
import { gameplayInteractionGraph } from '../../shared/gameplay-interaction-graph';
import { TEST_HALL_ROOMS, walkTestHallRoom, type TestHallRoomReport } from '../../shared/test-hall-rooms';
import { TEST_HALL_ROOM_PARAM } from './testHallLoader';
import styles from './TestHall.module.css';

/**
 * The test hall (dev only, `/__hall`): every authored room, what it is for, what to try in it and
 * how its walkthrough goes, with a Play link that loads the room straight into the game.
 *
 * "Run all" plays every room's script in this tab through the game's own rules - the same sweep the
 * unit suite runs - so a room that breaks shows up here before anyone walks into it. The coverage
 * panel lists the interaction graph's mechanics that no room exercises yet: the parts of the game
 * nobody can stand in front of.
 */
const TestHall = (): ReactElement => {
    const [reports, setReports] = useState<Record<string, TestHallRoomReport> | null>(null);
    const covered = useMemo(() => new Set(TEST_HALL_ROOMS.flatMap((hallRoom) => hallRoom.graphMechanicIds)), []);
    const uncovered = gameplayInteractionGraph.mechanics.filter((mechanic) => !covered.has(mechanic.id));
    const failing = reports ? Object.values(reports).filter((report) => report.failures.length > 0).length : 0;

    const runAll = (): void => {
        setReports(Object.fromEntries(TEST_HALL_ROOMS.map((hallRoom) => [hallRoom.id, walkTestHallRoom(hallRoom)])));
    };

    return (
        <section aria-label="Test hall" className={styles.hall} data-testid="test-hall">
            <header className={styles.head}>
                <h1 className={styles.title}>Test hall</h1>
                <p className={styles.lead}>
                    One room per mechanic. Play a room to stand in it; run all to play every room&apos;s script through the rules.
                </p>
                <div className={styles.actions}>
                    <button className={styles.button} data-testid="test-hall-run-all" onClick={runAll} type="button">
                        Run all walkthroughs
                    </button>
                    {reports ? (
                        <span className={styles.summary} data-failing={failing} data-testid="test-hall-summary">
                            {failing === 0 ? `All ${TEST_HALL_ROOMS.length} rooms pass` : `${failing} of ${TEST_HALL_ROOMS.length} rooms fail`}
                        </span>
                    ) : null}
                    <a className={styles.link} href="/">
                        Back to the game
                    </a>
                </div>
            </header>

            <ol className={styles.rooms}>
                {TEST_HALL_ROOMS.map((hallRoom) => {
                    const report = reports?.[hallRoom.id];
                    return (
                        <li className={styles.room} data-result={report ? (report.failures.length === 0 ? 'pass' : 'fail') : 'unrun'} data-testid={`test-hall-room-${hallRoom.id}`} key={hallRoom.id}>
                            <div className={styles.roomHead}>
                                <h2 className={styles.roomTitle}>{hallRoom.title}</h2>
                                <a className={styles.play} data-testid={`test-hall-play-${hallRoom.id}`} href={`/?${TEST_HALL_ROOM_PARAM}=${hallRoom.id}`}>
                                    Play
                                </a>
                            </div>
                            <p className={styles.mechanic}>{hallRoom.mechanic}</p>
                            <p className={styles.try}>
                                <strong>Try this:</strong> {hallRoom.tryThis}
                            </p>
                            <ol className={styles.script}>
                                {hallRoom.script.map((line, index) => (
                                    <li key={index}>{line.says}</li>
                                ))}
                            </ol>
                            <p className={styles.graph}>
                                Graph: {hallRoom.graphMechanicIds.join(', ')}
                            </p>
                            {report && report.failures.length > 0 ? (
                                <ul className={styles.failures}>
                                    {report.failures.map((failure) => (
                                        <li key={failure}>{failure}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </li>
                    );
                })}
            </ol>

            <section aria-label="Graph coverage" className={styles.coverage} data-testid="test-hall-coverage">
                <h2 className={styles.roomTitle}>
                    Graph coverage: {gameplayInteractionGraph.mechanics.length - uncovered.length} of {gameplayInteractionGraph.mechanics.length} mechanics
                    have a room
                </h2>
                <p className={styles.mechanic}>No room walks through these yet:</p>
                <ul className={styles.uncovered}>
                    {uncovered.map((mechanic) => (
                        <li key={mechanic.id}>
                            <code>{mechanic.id}</code> {mechanic.label}
                        </li>
                    ))}
                </ul>
            </section>
        </section>
    );
};

export default TestHall;

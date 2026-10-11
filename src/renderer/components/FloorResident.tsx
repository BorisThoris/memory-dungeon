import { useRef } from 'react';
import type { RunState } from '../../shared/contracts';
import { getFloorCurio, type FloorCurioId } from '../../shared/floor-curio-rules';
import { canGreetFloorCurio, floorCurioGreetingReply, runFloorCurioGreeting } from '../../shared/floor-curio-greeting-rules';
import styles from './FloorResident.module.css';

const portraitPaths: Record<FloorCurioId, string> = {
    lost_sock: 'M14 5h12v17l7 8c3 4-2 9-6 7L12 29V16h2z M14 10h12 M12 23l8 5',
    nervous_torchbearer: 'M17 38V25l-5-7 3-8h10l3 8-5 7v13 M17 19h6 M31 38V20 M27 20h8 M31 17c-8-5-2-11 0-14 1 6 7 9 0 14z',
    hoarding_rat: 'M9 29c0-9 7-16 17-13l8 10-8 8H13z M16 17c-8-8-13 0-7 6 M24 17c-3-11-13-9-9 0 M29 24h1 M30 28l8-2 M29 30l8 3 M11 32c-14 10-10-7-4-6',
    gossiping_skull: 'M10 25C0 9 13 3 21 5c15 0 19 13 10 21v10H13v-9z M13 18h4v5h-4z M25 18h4v5h-4z M21 24l-2 4h4z M18 31v5 M24 31v5',
    off_duty_guard: 'M11 18l2-11h17l3 11 M9 18h26 M13 20v10l8 8 9-8V20 M17 24h8 M8 38l5-8 M30 30l5 8 M20 7v10',
    sticky_toffee: 'M12 13l-8-4v9l8-1 M30 13l8-4v9l-8-1 M12 12h18v18H12z M12 27l-8 4v-9l8 1 M30 27l8 4v-9l-8 1 M18 16v10 M24 16v10'
};

/** A resident stays identifiable on the floor; their conversation is opened deliberately. */
export default function FloorResident({ run, onGreet }: { run: RunState; onGreet: () => void }) {
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const curio = getFloorCurio(run.floorCurioId as FloorCurioId);
    const greeting = runFloorCurioGreeting(run);
    if (!curio || !greeting) return null;
    const close = () => {
        if (detailsRef.current) {
            detailsRef.current.open = false;
            detailsRef.current.querySelector('summary')?.focus();
        }
    };
    return (
        <details className={styles.resident} data-testid="floor-resident" ref={detailsRef}
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
            <summary aria-label={`Meet ${curio.name.toLowerCase()}`} className={styles.summary}>
                <svg aria-hidden="true" className={styles.portrait} viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={portraitPaths[curio.id]} /></svg>
                <span className={styles.name}>{curio.name}</span>
            </summary>
            <div className={styles.conversation} data-testid="resident-conversation">
                <p className={styles.eyebrow}>On this floor</p>
                <h2 className={styles.title}>{curio.name}</h2>
                <p>{curio.line}</p>
                {run.board && run.board.level > 1 ? <p className={styles.gift}>{curio.effectSummary}</p> : null}
                {run.floorCurioGreeted ? <div data-testid="resident-reply"><p>{floorCurioGreetingReply(greeting, run)}</p><p className={styles.gift}>{greeting.gained}</p></div> : null}
                <div className={styles.actions}>
                    {!run.floorCurioGreeted ? <button data-testid="tool-greet" disabled={!canGreetFloorCurio(run)} onClick={onGreet} type="button">Say hello · free</button> : null}
                    <button onClick={close} type="button">Back to cards</button>
                </div>
            </div>
        </details>
    );
}

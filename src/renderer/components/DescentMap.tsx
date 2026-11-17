import { plural, tr } from '../../shared/i18n';
import type { RunState } from '../../shared/contracts';
import { descentMapFor } from './descentMapModel';
import styles from './DescentMap.module.css';

/**
 * The Descent's road on the pause sheet (`descentMapModel.ts`): one bar per act, as long as the act,
 * filled as far as the run has cleared it, with the act's floors and the boss at its end; under it
 * where the run stands and what it is walking toward.
 */
export const DescentMap = ({ run }: { run: Pick<RunState, 'board' | 'stats'> & Partial<Pick<RunState, 'runRulesVersion'>> }) => {
    const map = descentMapFor(run);
    return (
        <section aria-label={tr.s('The Descent')} className={styles.map} data-testid="descent-map">
            <ol className={styles.track}>
                {map.acts.map((act) => (
                    <li
                        className={styles.act}
                        data-state={act.state}
                        data-testid={`descent-map-act-${act.id}`}
                        key={act.id}
                        style={{ flexGrow: act.lastLevel - act.firstLevel + 1 }}
                    >
                        <span aria-hidden="true" className={styles.bar}>
                            <span className={styles.fill} style={{ width: `${Math.round(act.cleared * 100)}%` }} />
                        </span>
                        <span className={styles.title}>{act.title}</span>
                        <span className={styles.floors}>
                            {`${act.firstLevel}–${act.lastLevel}`}
                            {act.bossName ? <span className={styles.boss}>{act.bossName}</span> : null}
                        </span>
                    </li>
                ))}
            </ol>
            <p className={styles.caption} data-testid="descent-map-caption">
                {map.endless
                    ? tr`Endless, floor ${map.floor}: the Warden fell on floor ${map.wardenFloor}.`
                    : map.next.floorsAway === 0
                      ? tr`Floor ${map.floor} of ${map.wardenFloor}: ${map.next.name} on this floor.`
                      : plural(
                            map.next.floorsAway,
                            { one: 'Floor {1} of {2}: {3} in {0} floor.', other: 'Floor {1} of {2}: {3} in {0} floors.' },
                            map.floor,
                            map.wardenFloor,
                            map.next.name
                        )}
            </p>
        </section>
    );
};

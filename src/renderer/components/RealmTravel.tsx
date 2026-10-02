import { useEffect, useId, useRef, type CSSProperties, type ReactElement } from 'react';
import type { RealmDoor, RealmId } from '../../shared/contracts';
import { REALMS } from '../../shared/realm-rules';
import { acquireToolbarRovingPause } from '../a11y/toolbarRoving';
import { REALM_TRAVEL_COPY } from '../copy/realmCopy';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import styles from './RealmTravel.module.css';

interface RealmTravelProps {
    doors: readonly RealmDoor[];
    /** The realm the floor ended in: its door is the way you came (the sway may have tipped it). */
    endedIn: RealmId | null;
    /** Floors this run has cleared in each realm, to say where the player has been. */
    floorsIn: Partial<Record<RealmId, number>>;
    /** Attunement each realm has earned with clean clears (`realm-carryover-rules.ts`). */
    attunement: Partial<Record<RealmId, number>>;
    onChoose: (index: number) => void;
}

const SIGILS: Readonly<Record<RealmId, string>> = {
    frost: '❄',
    ember: '▲',
    tide: '≈',
    storm: 'ϟ',
    grove: '♣'
};

/**
 * The travel doors (`realm-rules.ts`), after every floor clear and the store stop when there is
 * one: three ways down, each a realm and how hard its weather blows. Shape of Dreams hands out its
 * paths this way, and it is the owner's brief: where you go next is a choice, and the place you
 * choose changes how the next floor plays.
 *
 * A dialog for everyone who is not looking: labelled, focus-trapped, the first door focused. No
 * Escape: a floor has to be somewhere, and Escape picking a door for the player would be a door
 * they did not choose.
 */
const RealmTravel = ({ attunement, doors, endedIn, floorsIn, onChoose }: RealmTravelProps): ReactElement => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const firstRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();
    const subtitleId = useId();
    useModalFocusTrap({ containerRef: rootRef, onActivate: acquireToolbarRovingPause });
    useEffect(() => {
        firstRef.current?.focus();
    }, []);
    return (
        <div
            aria-describedby={subtitleId}
            aria-labelledby={titleId}
            aria-modal="true"
            className={styles.travel}
            data-testid="realm-travel"
            ref={rootRef}
            role="dialog"
        >
            <div className={styles.head}>
                <h2 className={styles.title} id={titleId}>
                    {REALM_TRAVEL_COPY.title}
                </h2>
                <p className={styles.subtitle} id={subtitleId}>
                    {REALM_TRAVEL_COPY.subtitle}
                </p>
            </div>
            <div className={styles.doors}>
                {doors.map((door, index) => {
                    const realm = REALMS[door.realmId];
                    const been = floorsIn[door.realmId] ?? 0;
                    return (
                        <button
                            aria-label={REALM_TRAVEL_COPY.choose(door)}
                            className={styles.door}
                            data-modal-initial-focus={index === 0 ? true : undefined}
                            data-realm={door.realmId}
                            data-confluence={door.confluence ? 'true' : undefined}
                            data-severity={door.severity}
                            data-testid={`realm-door-${index}`}
                            key={`${door.realmId}:${door.severity}`}
                            onClick={() => onChoose(index)}
                            ref={index === 0 ? firstRef : undefined}
                            style={{ '--realm-color': realm.color, '--door-index': index } as CSSProperties}
                            type="button"
                        >
                            <span aria-hidden="true" className={styles.arch} data-confluence={door.confluence ? 'true' : undefined}>
                                <span className={styles.sigil}>{SIGILS[door.realmId]}</span>
                                {door.confluence ? (
                                    <span className={styles.sigil} style={{ '--realm-color': REALMS[door.confluence].color } as CSSProperties}>
                                        {SIGILS[door.confluence]}
                                    </span>
                                ) : null}
                            </span>
                            <span className={styles.kicker}>{REALM_TRAVEL_COPY.doorKicker(door, endedIn)}</span>
                            <span className={styles.place}>{REALM_TRAVEL_COPY.placeLine(door)}</span>
                            {REALM_TRAVEL_COPY.attunedLine(attunement[door.realmId] ?? 0) ? (
                                <span className={styles.attuned} data-testid={`realm-door-${index}-attuned`}>
                                    {REALM_TRAVEL_COPY.attunedLine(attunement[door.realmId] ?? 0)}
                                </span>
                            ) : null}
                            {REALM_TRAVEL_COPY.depthWarning(door, attunement[door.realmId] ?? 0) ? (
                                <span className={styles.attuned} data-testid={`realm-door-${index}-depth-warning`}>
                                    {REALM_TRAVEL_COPY.depthWarning(door, attunement[door.realmId] ?? 0)}
                                </span>
                            ) : null}
                            <span className={styles.severity} data-severity={door.severity}>
                                {REALM_TRAVEL_COPY.severityLine(door)}
                            </span>
                            <span className={styles.weather}>{REALM_TRAVEL_COPY.weatherLine(door)}</span>
                            <span className={styles.rules}>
                                {(door.confluence
                                    ? [REALM_TRAVEL_COPY.confluenceRule(door)!, realm.rules[0], REALMS[door.confluence].rules[0]]
                                    : [...realm.rules, `${realm.peak}: ${realm.peakRule}`]
                                ).map((rule) => (
                                    <span className={styles.rule} key={rule}>
                                        {rule}
                                    </span>
                                ))}
                            </span>
                            {been > 0 ? <span className={styles.been}>{`${been} ${been === 1 ? 'floor' : 'floors'} here this run`}</span> : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RealmTravel;

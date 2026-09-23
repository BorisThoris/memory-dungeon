import { memo, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { GameShellLayout } from '../gameShellLayout';
import type { RunState } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { parTurnsForRun, turnsTakenThisFloor } from '../../shared/floor-par';
import { missesLeft } from '../../shared/miss-bank';
import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import { handleHorizontalToolbarKeyDown, syncToolbarTabIndices } from '../a11y/toolbarRoving';
import { GameplayMenuIcon } from '../ui/gameplayIcons';
import { useCountUp } from '../hooks/useCountUp';
import styles from './RunShell.module.css';
import { MEMORIZE_SKIP_COPY, RUN_SHELL_LABELS, RUN_SHELL_LINE_COPY, RUN_SHELL_PAR_COPY } from '../copy/runDialogCopy';
import { PASS_AND_PLAY_COPY } from '../copy/passAndPlay';
import { CHAIN_BEAT_COPY, CHAIN_TIER_LABELS } from '../copy/chainBeat';
import { chainRungScoreMultiplier } from '../../shared/chain-rung-value-rules';
import {
    chainRungApproach,
    chainTierRungs,
    runChainMeter,
    runChainTier
} from '../../shared/chain-tier-rules';
import { playStudyClosingTickSfx } from '../audio/gameSfx';
import { tapStudyClosing } from '../input/touchHaptics';
import { memorizeUrgency } from './memorizeUrgency';
import { isPassAndPlayRun, PASS_AND_PLAY_FLOORS } from '../../shared/pass-and-play-rules';

/**
 * The HTML layer over the 3D board during a run: "The Margin".
 *
 * The chrome is type and hairlines, nothing boxed. A running head along the top carries the
 * floor, the par and the score on one rule, the way a page carries its title and folio. The chain
 * is a ladder in the left margin on a desktop — four rungs, a marker climbing them, the rung's
 * multiplier set large beside it — and one short line under the head on a phone. The run line is
 * a caption under the board, kicker over sentence, and the tools are set into the same bottom
 * rule, glyph over word. Nothing else is drawn over the board.
 */

export interface RunShellTool {
    id: string;
    label: string;
    /** Accessible name when the short dock label is not it (e.g. "Fit board" for "Fit"). */
    name?: string;
    glyph: ReactElement;
    charges?: number;
    armed?: boolean;
    disabled?: boolean;
    title?: string;
    onClick: () => void;
}

export interface RunShellProps {
    run: RunState;
    /**
     * True once this run's floor passes the profile's deepest on record and the run counts. The
     * marker is the one piece of the profile the head shows, because the moment it appears is the
     * moment the run became the best one.
     */
    personalBestDepth: boolean;
    /** The one line under the board. Feedback wins over the first-run instruction. */
    feedback?: string | null;
    feedbackPriority?: 'info' | 'error';
    /** First-run instruction, shown only until the first clear. */
    onboardingLine?: string | null;
    /** Screen-reader status line, unchanged from the previous HUD's contract. */
    politeAnnouncement?: string;
    /** Reduced motion: the score total changes on the frame rather than counting up. */
    reduceMotion?: boolean;
    /**
     * Sfx gain for the study clock's last ticks. 0 or omitted is silence, which is what a screen
     * with no run behind it and a player with the volume down both get.
     */
    sfxGain?: number;
    /**
     * The shell's layout, so the head can leave out what a layout has no room for instead of
     * hiding it: a phone upright has one row for the head and the mutator's name is the lane that
     * does not fit (the pause dialog states it in full). A cell that is not drawn is not in the DOM.
     */
    shellLayout?: GameShellLayout;
    tools: readonly RunShellTool[];
    onPause: () => void;
}

/** How long the ladder reads as draining after a chain drops. */
const CHAIN_METER_DROP_MS = 700;

/** How long the ladder holds its arrival at Fever; longer than the drop, because it is earned. */
const CHAIN_METER_FEVER_MS = 1100;

/** How often the memorize count in the head is refreshed. Four ticks a second reads as a clock. */
const MEMORIZE_TICK_MS = 250;

/**
 * The chain-drop beat on the ladder. When momentum falls from Clean or better to nothing, the
 * fill drains red for a beat instead of snapping empty: the loss is half of the loop, and a
 * meter that vanished silently taught nothing. Timer-set so the render never sets state.
 */
const useChainMeterDrop = (momentum: number, cleanRung: number): boolean => {
    const [dropping, setDropping] = useState(false);
    const previousRef = useRef(momentum);
    useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = momentum;
        if (!(previous >= cleanRung && momentum === 0)) {
            return undefined;
        }
        const start = window.setTimeout(() => setDropping(true), 0);
        const end = window.setTimeout(() => setDropping(false), CHAIN_METER_DROP_MS);
        return () => {
            window.clearTimeout(start);
            window.clearTimeout(end);
        };
    }, [momentum, cleanRung]);
    return dropping;
};

/**
 * The arrival at Fever on the ladder.
 *
 * Losing a chain had a beat here and reaching the top did not, so the ladder said more about
 * failing than about the thing a run is played for — while the board and the room both flash on
 * arrival. This is the ladder's half of that moment: the rail lights once as the meter fills.
 *
 * It fires on the rising edge only, so a run that sits at Fever is not strobed, and again if the
 * chain is lost and taken back. Timer-set like the drop, so the render never sets state.
 */
const useChainMeterFeverArrival = (full: boolean): boolean => {
    const [arriving, setArriving] = useState(false);
    const previousRef = useRef(full);
    useEffect(() => {
        const previous = previousRef.current;
        previousRef.current = full;
        if (!full || previous) {
            return undefined;
        }
        const start = window.setTimeout(() => setArriving(true), 0);
        const end = window.setTimeout(() => setArriving(false), CHAIN_METER_FEVER_MS);
        return () => {
            window.clearTimeout(start);
            window.clearTimeout(end);
        };
    }, [full]);
    return arriving;
};

/**
 * The beat under the closing study window: a tick, and a tap on a device that can.
 *
 * Fires once per whole second, only while the window is genuinely closing, and never twice for the
 * same second — the countdown re-reads four times a second, so keying this on the seconds value
 * rather than on the tick is what keeps it a clock instead of a buzz.
 *
 * Both channels fire together on purpose, because they miss different people. The sound misses a
 * muted phone; the HUD bar beside them misses anyone actually watching the board, which is what
 * memorizing *is*. A player gets whichever of the three reaches them, and a desktop with the sound
 * on and no vibration hardware simply hears the tick.
 */
const useStudyClosingBeats = (
    seconds: number | null,
    closing: boolean,
    gain: number,
    reduceMotion: boolean
): void => {
    const lastTickedRef = useRef<number | null>(null);
    useEffect(() => {
        if (!closing || seconds === null || seconds <= 0) {
            lastTickedRef.current = null;
            return;
        }
        if (lastTickedRef.current === seconds) {
            return;
        }
        lastTickedRef.current = seconds;
        playStudyClosingTickSfx(gain, seconds);
        tapStudyClosing(reduceMotion);
    }, [closing, seconds, gain, reduceMotion]);
};

interface MemorizeCountdown {
    /** Whole seconds left, rounded up so the head never reads 0 while the board is still shown. */
    seconds: number;
    /** 0..1 of the study period spent; the bar drawn along the head's rule. */
    progress: number;
    /**
     * How long this stretch of study is, in whole seconds, fixed from the moment it began. The
     * sentence under the board says how long the faces show; handed `seconds` instead, it counted
     * down beside the head's own count, ended on "shows for 0 seconds", and - being the dock's
     * `role="status"` line - was read out again by a screen reader every second of the study.
     */
    windowSeconds: number;
}

/**
 * The study period as a count. The store keeps the remaining time only as a scheduled timer and a
 * snapshot on the run (`timerState.memorizeRemainingMs`, refreshed on pause and resume), so the
 * head keeps its own clock from that snapshot while the status is `memorize`. Entering the status
 * again — a new floor, or a resume — restarts it from the fresh snapshot.
 */
const useMemorizeCountdown = (run: RunState): MemorizeCountdown | null => {
    const memorizing = run.status === 'memorize';
    const snapshotMs = run.timerState.memorizeRemainingMs;
    const [countdown, setCountdown] = useState<MemorizeCountdown | null>(null);
    useEffect(() => {
        if (!memorizing) {
            const clear = window.setTimeout(() => setCountdown(null), 0);
            return () => window.clearTimeout(clear);
        }
        const startedAt = Date.now();
        const totalMs = Math.max(0, snapshotMs ?? 0);
        const read = (): MemorizeCountdown => {
            const elapsed = Math.max(0, Date.now() - startedAt);
            const remaining = Math.max(0, totalMs - elapsed);
            return {
                seconds: Math.ceil(remaining / 1000),
                progress: totalMs > 0 ? Math.min(1, elapsed / totalMs) : 1,
                windowSeconds: Math.ceil(totalMs / 1000)
            };
        };
        // Timer-set so the render never sets state; the first read lands on the next tick.
        const first = window.setTimeout(() => setCountdown(read()), 0);
        const tick = window.setInterval(() => setCountdown(read()), MEMORIZE_TICK_MS);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(tick);
        };
    }, [memorizing, snapshotMs]);
    if (!memorizing) {
        return null;
    }
    const snapshotSeconds = Math.ceil(Math.max(0, snapshotMs ?? 0) / 1000);
    return countdown ?? { seconds: snapshotSeconds, progress: 0, windowSeconds: snapshotSeconds };
};

const RunShell = ({
    run,
    personalBestDepth,
    feedback,
    feedbackPriority = 'info',
    onboardingLine,
    politeAnnouncement,
    tools,
    onPause,
    reduceMotion = false,
    sfxGain = 0,
    shellLayout = 'desktop'
}: RunShellProps): ReactElement => {
    const mutatorTitles = run.activeMutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id);
    // The total counts up to what a break paid (thesis §45.2): the rise is the part the player
    // watches land, and a number that snaps from 70 to 575 gives it nothing to look at.
    const shownScore = useCountUp(runNonNegativeInteger(run.stats.totalScore), { reduceMotion });
    const meter = runChainMeter(run);
    const tier = runChainTier(run);
    const chain = runNonNegativeInteger(run.stats.currentStreak);
    const rungs = chainTierRungs(run.board?.pairCount ?? null);
    // One rule for what the chain is climbing toward, so the ladder, the goal copy and the lean-in
    // below can never disagree about which rung is next or how far off it is.
    const approach = chainRungApproach(meter.momentum, run.board?.pairCount ?? null);
    const nextTier = approach.next;
    const nextTierLabel = CHAIN_BEAT_COPY.goalLabel(approach.away, nextTier);
    const chainMeterDropping = useChainMeterDrop(meter.momentum, rungs.clean);
    const chainMeterArriving = useChainMeterFeverArrival(meter.full);
    const memorize = useMemorizeCountdown(run);
    // The window closing is the one thing the study period never said. Only the HUD answers it:
    // the player's task right now is looking at the board, so the stage must not be touched.
    const urgency = memorizeUrgency(memorize?.progress ?? 0);
    useStudyClosingBeats(memorize?.seconds ?? null, urgency.closing, sfxGain, reduceMotion);
    const turnsTaken = turnsTakenThisFloor(run);
    const parTurns = parTurnsForRun(run);
    // The run's remaining life, in the only currency that can end it while the player keeps
    // playing: misses before one ends the run (`miss-bank.ts`). A run with no bank shows none.
    const missesRemaining = missesLeft(run);
    const pairCount = run.board?.pairCount ?? 0;

    // The caption under the board: a kicker naming the moment, then the one sentence about it. The
    // announcer clears its line to an empty string between beats, which is no line at all.
    const said = feedback || null;
    const line = memorize
        ? said ?? RUN_SHELL_LINE_COPY.study(pairCount, memorize.windowSeconds)
        : said ?? onboardingLine ?? null;
    const lineTone = said ? feedbackPriority : 'info';
    const kicker = memorize
        ? RUN_SHELL_LINE_COPY.studyKicker
        : lineTone === 'error'
          ? RUN_SHELL_LINE_COPY.missKicker
          : !said && onboardingLine
            ? RUN_SHELL_LINE_COPY.firstFloorKicker
            : RUN_SHELL_LINE_COPY.chainKicker(chain, CHAIN_TIER_LABELS[tier]);
    const kickerTier = memorize || lineTone === 'error' || (!said && onboardingLine) ? 'none' : tier;
    const visibleTools = tools.filter((tool) => tool.charges === undefined || tool.charges > 0 || tool.armed);

    /*
     * One tab stop for the dock, re-synced on every render.
     *
     * Keying this on the visible tool ids was not enough, measured in a real run: the dock held
     * FOUR tab stops on arrival and only fell to one after a modal had opened and closed. A tool
     * stays mounted and goes `disabled` when its charges run out, so the id list never changed
     * while the set of buttons roving applies to did - `getToolbarButtons` skips disabled ones, and
     * the ones it skipped kept the `tabIndex 0` React gave them.
     *
     * Every render, then, and the current stop is passed back in so a player arrowing along the
     * dock is not yanked to the first tool by the next score tick. When that stop is gone -
     * spent, hidden - `syncToolbarTabIndices` falls back to the first button, which is where a
     * fresh Tab into a toolbar belongs.
     */
    const dockRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const root = dockRef.current;
        if (!root) {
            return;
        }
        const current = root.querySelector<HTMLElement>('button[tabindex="0"]:not([disabled])');
        syncToolbarTabIndices(root, current);
    });

    const ladderStyle = {
        '--chain-meter-clean': `${(meter.ticks.clean * 100).toFixed(1)}%`,
        '--chain-meter-sharp': `${(meter.ticks.sharp * 100).toFixed(1)}%`,
        '--chain-meter-fill': `${(meter.fill * 100).toFixed(1)}%`,
        '--chain-meter-fill-n': meter.fill.toFixed(3)
    } as CSSProperties;

    const rung = (
        tierName: 'fever' | 'sharp' | 'clean' | 'none',
        label: string,
        position: string
    ): ReactElement => (
        <span
            aria-hidden="true"
            className={styles.rung}
            data-rung={tierName}
            data-rung-reached={tierName === 'none' || meter.momentum >= rungs[tierName] ? 'true' : 'false'}
            /* The rung being climbed to, and whether it is one pair off. A rung the chain is merely
               heading for is marked all the way up; only the last step is a moment. */
            data-rung-next={tierName === nextTier ? 'true' : undefined}
            data-rung-imminent={tierName === nextTier && approach.imminent ? 'true' : undefined}
            style={{ '--rung-at': position } as CSSProperties}
        >
            <span className={styles.rungTick} />
            <span className={styles.rungLabel}>
                {label}
                <span className={styles.rungMultiplier}>×{chainRungScoreMultiplier(tierName)}</span>
            </span>
        </span>
    );

    return (
        <div className={styles.shell} data-chain-tier={tier} data-memorize={memorize ? 'true' : 'false'} data-testid="run-shell">
            <header className={styles.head} data-testid="game-hud">
                <div className={styles.stats} role="group" aria-label="Run stats">
                    <div className={styles.identity}>
                        {/* A shared game runs to an agreed number of floors, so the floor count is a
                            progress reading rather than a depth reading. */}
                        <span
                            className={styles.floor}
                            data-personal-best={personalBestDepth ? 'true' : undefined}
                            data-testid="hud-floor"
                        >
                            <span className={styles.floorWord}>Floor</span>{' '}
                            <span className={styles.floorNumber}>
                                {isPassAndPlayRun(run.passAndPlay)
                                    ? PASS_AND_PLAY_COPY.floorProgress(run.board?.level ?? 1, PASS_AND_PLAY_FLOORS)
                                    : String(run.board?.level ?? 1)}
                            </span>
                            {personalBestDepth ? (
                                <span
                                    aria-label={RUN_SHELL_LABELS.personalBestAria}
                                    className={styles.personalBest}
                                    data-testid="hud-personal-best"
                                    role="img"
                                >
                                    {RUN_SHELL_LABELS.personalBest}
                                </span>
                            ) : null}
                        </span>
                        {/* The par: a visible goal at every moment. Turns resolved on this floor over
                            the turns a competent player needs; beating it pays the floor-end
                            efficiency bonus, missing it costs nothing else. The ceiling, three times
                            the par, is where the run ends if the floor is still open (§42.2), and the
                            pressure of thesis §43 reads here once it is two turns away.

                            The count beside it is what the run has left before that ceiling, and it
                            is the only thing in the head that says the run can end at all. Lives
                            went in Gen 183 and the ceiling that replaced them was spoken to a
                            screen reader and drawn to nobody; a player watching a number climb
                            toward a limit they were never shown is not being given the pressure,
                            only the surprise. It falls rather than climbs, because that is the half
                            of a life counter worth keeping. */}
                        <span
                            className={styles.par}
                            data-ceiling-near={missesRemaining != null && missesRemaining <= 1 ? 'true' : undefined}
                            data-testid="hud-par"
                        >
                            <span
                                aria-label={RUN_SHELL_PAR_COPY.aria(turnsTaken, parTurns, missesRemaining)}
                                role="img"
                                title={RUN_SHELL_PAR_COPY.title}
                            >
                                <span className={styles.parNumbers}>
                                    {turnsTaken} of {parTurns}
                                </span>
                                <span className={styles.parWord}> turns</span>
                                {missesRemaining != null ? (
                                    <span className={styles.parLeft} data-testid="hud-misses-left">
                                        <span className={styles.parLeftNumber}>{missesRemaining}</span>{' '}
                                        {RUN_SHELL_PAR_COPY.leftWord(missesRemaining)}
                                    </span>
                                ) : null}
                            </span>
                        </span>
                        {mutatorTitles.length > 0 && shellLayout !== 'phone-portrait' ? (
                            <span className={styles.mutator} data-testid="hud-mutators" title="Mutator">
                                {mutatorTitles.join(' · ')}
                            </span>
                        ) : null}
                        {/* Only on a shared game. The run's own score stays: the table is still playing
                            one run together, and these say who has earned which part of it. */}
                        {isPassAndPlayRun(run.passAndPlay) ? (
                            <span aria-label={PASS_AND_PLAY_COPY.seatsLabel} className={styles.seats} data-testid="hud-pass-and-play" role="group">
                                {run.passAndPlay.seats.map((seat, index) => (
                                    <span
                                        aria-label={PASS_AND_PLAY_COPY.seatAnnouncement(seat.label, seat.score, seat.bestChain)}
                                        className={styles.seat}
                                        data-active={index === run.passAndPlay?.activeSeatIndex ? 'true' : 'false'}
                                        data-testid={`hud-seat-${seat.id}`}
                                        key={seat.id}
                                        role="img"
                                    >
                                        {/* Both names ship and CSS picks one: the row has to narrow
                                            without the seat count changing what it means, and the
                                            aria-label carries the full name either way. */}
                                        <span aria-hidden="true" className={styles.seatLabel}>
                                            <span className={styles.seatLabelLong}>{seat.label}</span>
                                            <span className={styles.seatLabelShort}>
                                                {PASS_AND_PLAY_COPY.seatShortLabel(index + 1)}
                                            </span>
                                        </span>
                                        <span aria-hidden="true" className={styles.seatScore}>
                                            {seat.score.toLocaleString()}
                                        </span>
                                    </span>
                                ))}
                            </span>
                        ) : null}
                    </div>

                    {/* The rule the head is set on. During the study period it carries the clock as
                        a bar, and the count sits on it where the eye lands first. */}
                    <span aria-hidden="true" className={styles.headRule}>
                        {memorize ? (
                            <span
                                className={styles.memorizeBar}
                                data-closing={urgency.closing ? 'true' : undefined}
                                data-testid="hud-memorize-bar"
                                style={
                                    {
                                        width: `${(memorize.progress * 100).toFixed(1)}%`,
                                        '--memorize-urgency': urgency.level
                                    } as CSSProperties
                                }
                            />
                        ) : null}
                    </span>

                    <span className={styles.score} data-testid="hud-score">
                        <span className={styles.scoreLabel}>Score</span>
                        <span className={styles.scoreValue}>{shownScore.toLocaleString()}</span>
                    </span>

                    {/* The ladder you are climbing. Peggle's multiplier reads at a glance because it
                        is a meter; this is that meter turned on its side, with the rungs named and
                        the rung's worth — the multiplier a break here is scored with — set beside the
                        marker (thesis §30.3a). A tier that only exists in the rules is a tier the
                        player never planned around. */}
                    <div
                        className={styles.chain}
                        data-chain-tier={tier}
                        data-meter-arrive={chainMeterArriving ? 'true' : 'false'}
                        data-meter-drop={chainMeterDropping ? 'true' : 'false'}
                        data-meter-full={meter.full ? 'true' : 'false'}
                        data-testid="hud-chain"
                        style={ladderStyle}
                    >
                        <span
                            aria-label={CHAIN_BEAT_COPY.meterLabel(meter.momentum, meter.feverAt, meter.full, meter.tier)}
                            className={styles.ladder}
                            data-chain-tier={meter.tier}
                            data-meter-drop={chainMeterDropping ? 'true' : 'false'}
                            data-meter-fill={meter.fill.toFixed(3)}
                            data-meter-full={meter.full ? 'true' : 'false'}
                            data-testid="hud-chain-meter"
                            role="img"
                        >
                            <span className={styles.ladderRail} />
                            {rung('fever', CHAIN_TIER_LABELS.fever, '100%')}
                            {rung('sharp', CHAIN_TIER_LABELS.sharp, 'var(--chain-meter-sharp)')}
                            {rung('clean', CHAIN_TIER_LABELS.clean, 'var(--chain-meter-clean)')}
                            {rung('none', 'Lone', '0%')}
                            <span className={styles.ladderFill} />
                            <span className={styles.ladderMarker} />
                        </span>
                        <div className={styles.chainRead}>
                            <span
                                aria-label={CHAIN_BEAT_COPY.rungValue(tier)}
                                className={styles.rungValue}
                                data-chain-tier={tier}
                                data-rung-multiplier={chainRungScoreMultiplier(tier)}
                                data-testid="hud-chain-rung-value"
                                role="img"
                            >
                                {`×${chainRungScoreMultiplier(tier)}`}
                            </span>
                            <span
                                className={styles.chainDepth}
                                data-chain-tier={tier}
                                title={`${CHAIN_BEAT_COPY.momentumHint(
                                    chain,
                                    runNonNegativeInteger(run.chunkPairsThisChain),
                                    runNonNegativeInteger(run.skipMomentumThisChain),
                                    rungs
                                )} ${CHAIN_BEAT_COPY.rungLadder()}`}
                            >
                                {CHAIN_TIER_LABELS[tier] ? `Chain ${chain} · ${CHAIN_TIER_LABELS[tier]}` : `Chain ${chain}`}
                            </span>
                            <span className={styles.chainGoal} data-chain-tier={nextTier ?? 'fever'} data-testid="hud-chain-goal">
                                <em>{nextTierLabel}</em>
                                <span className={styles.chainGoalValue}>×{chainRungScoreMultiplier(nextTier ?? 'fever')} per pair</span>
                            </span>
                        </div>
                    </div>
                </div>

                {memorize ? (
                    <div
                        className={styles.memorizeHead}
                        data-closing={urgency.closing ? 'true' : undefined}
                        data-testid="hud-memorize"
                        style={{ '--memorize-urgency': urgency.level } as CSSProperties}
                    >
                        <span className={styles.memorizeTitle}>
                            Memorize <span className={styles.memorizeCount}>· {memorize.seconds}</span>
                        </span>
                        <span className={styles.memorizeHint}>{MEMORIZE_SKIP_COPY.hint}</span>
                    </div>
                ) : null}
            </header>

            <footer className={styles.foot} data-testid="game-action-dock">
                {line ? (
                    <div className={styles.caption}>
                        <span className={styles.kicker} data-chain-tier={kickerTier}>
                            {kicker}
                        </span>
                        <p
                            className={`${styles.line} ${lineTone === 'error' ? styles.lineError : ''}`.trim()}
                            data-run-shell-line-tone={lineTone}
                            data-testid="run-shell-line"
                            role="status"
                        >
                            {line}
                        </p>
                    </div>
                ) : null}
                <span aria-hidden="true" className={styles.footRule} />
                {/*
                  * The one `role="toolbar"` this game ships, and until Gen 258 it declared the role
                  * and wired none of the pattern: measured in a real run, all nine dock buttons
                  * carried `tabIndex 0` - nine tab stops where the role promises one - and
                  * ArrowRight on the first tool left focus exactly where it was. Opening and
                  * closing any modal then rearranged them, because `acquireToolbarRovingPause`
                  * releases by INSTALLING the roving indices it was meant to be restoring.
                  * `a11y/toolbarRoving.ts` had implemented all of this, with tests, reached by
                  * nothing.
                  */}
                <div
                    aria-label="Game controls"
                    className={styles.dock}
                    onKeyDown={handleHorizontalToolbarKeyDown}
                    ref={dockRef}
                    role="toolbar"
                >
                    {visibleTools.map((tool) => (
                        <button
                            aria-label={tool.name ?? tool.title ?? tool.label}
                            aria-pressed={tool.armed !== undefined ? tool.armed : undefined}
                            className={`${styles.tool} ${tool.armed ? styles.toolArmed : ''}`.trim()}
                            data-testid={`tool-${tool.id}`}
                            disabled={tool.disabled}
                            key={tool.id}
                            onClick={tool.onClick}
                            title={tool.title}
                            type="button"
                        >
                            <span className={styles.toolGlyph}>{tool.glyph}</span>
                            <span className={styles.toolLabel}>{tool.label}</span>
                            {tool.charges !== undefined && tool.charges > 0 ? (
                                <span aria-hidden="true" className={styles.toolCount}>
                                    {tool.charges}
                                </span>
                            ) : null}
                        </button>
                    ))}
                    {visibleTools.length > 0 ? <span aria-hidden="true" className={styles.dockDivider} /> : null}
                    <button
                        aria-label={RUN_SHELL_LABELS.pause}
                        className={`${styles.tool} ${styles.toolPause}`}
                        data-testid="game-toolbar-main-menu"
                        onClick={onPause}
                        title="Pause (P / Esc)"
                        type="button"
                    >
                        <span className={styles.toolGlyph}>
                            <GameplayMenuIcon />
                        </span>
                        <span className={styles.toolLabel}>Pause</span>
                    </button>
                </div>
            </footer>

            <div
                aria-atomic="true"
                aria-live="polite"
                className={styles.srOnly}
                data-testid="hud-polite-live-region"
                role="status"
            >
                {politeAnnouncement}
            </div>
        </div>
    );
};

export default memo(RunShell);

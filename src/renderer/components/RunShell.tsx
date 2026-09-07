import { memo, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { RunState } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { getGameplayFeedbackObjectiveSnapshot } from '../../shared/gameplay-feedback-facts';
import { MUTATOR_CATALOG } from '../../shared/mechanics-encyclopedia';
import { describeRunModeIdentity, runModeIdentityText } from '../../shared/run-mode-identity';
import { GameplayMenuIcon } from '../ui/gameplayIcons';
import styles from './RunShell.module.css';
import type { PerfectMemoryStatus } from '../../shared/perfect-memory-status';
import { PERFECT_MEMORY_COPY, RUN_SHELL_LABELS } from '../copy/runDialogCopy';
import { PASS_AND_PLAY_COPY } from '../copy/passAndPlay';
import { CHAIN_BEAT_COPY, CHAIN_TIER_LABELS } from '../copy/chainBeat';
import { chainTierRungs, runChainMeter, runChainTier } from '../../shared/chain-tier-rules';
import { isPassAndPlayRun, PASS_AND_PLAY_FLOORS } from '../../shared/pass-and-play-rules';

/**
 * The HTML layer over the 3D board during a run.
 *
 * One bar across the top carries the four numbers a player reads mid-run; one dock along
 * the bottom carries the tools they can actually use right now; one line between them says
 * what just happened or what to do first. Nothing else is drawn over the board. The
 * previous layer stacked up to 28 panels here; this one is budgeted at 8.
 */

export interface RunShellTool {
    id: string;
    label: string;
    glyph: ReactElement;
    charges?: number;
    armed?: boolean;
    disabled?: boolean;
    title?: string;
    onClick: () => void;
}

export interface RunShellProps {
    run: RunState;
    /** Precomputed from the host clock, or null when the gauntlet is off. */
    gauntletRemainingMs: number | null;
    /** Null when the perfect-clear achievement is not live stakes for this run. */
    perfectMemory?: PerfectMemoryStatus | null;
    /** The one line under the bar. Feedback wins over the standing objective. */
    feedback?: string | null;
    feedbackPriority?: 'info' | 'error';
    /** First-run instruction, shown only until the first clear. */
    onboardingLine?: string | null;
    /** Screen-reader status line, unchanged from the previous HUD's contract. */
    politeAnnouncement?: string;
    tools: readonly RunShellTool[];
    onPause: () => void;
}

const formatTimer = (ms: number): string => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** How long the meter reads as draining after a chain drops. */
const CHAIN_METER_DROP_MS = 700;

/**
 * The chain-drop beat on the meter. When momentum falls from Clean or better to nothing, the
 * bar drains red for a beat instead of snapping empty: the loss is half of the loop, and a
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

const Stat = ({
    label,
    children,
    meter = null,
    primary = false,
    testId
}: {
    label: string;
    children: ReactElement | string;
    /** A bar under the value, the stat's full width; only the Chain stat carries one. */
    meter?: ReactElement | null;
    primary?: boolean;
    testId: string;
}): ReactElement => (
    <div className={`${styles.stat} ${primary ? styles.statPrimary : ''}`.trim()} data-testid={testId}>
        <span className={styles.label}>{label}</span>
        <span className={`${styles.value} ${primary ? styles.valuePrimary : ''}`.trim()}>{children}</span>
        {meter}
    </div>
);

const RunShell = ({
    run,
    gauntletRemainingMs,
    perfectMemory = null,
    feedback,
    feedbackPriority = 'info',
    onboardingLine,
    politeAnnouncement,
    tools,
    onPause
}: RunShellProps): ReactElement => {
    const maxLives = Math.max(run.lives, 5);
    const objective = getGameplayFeedbackObjectiveSnapshot(run);
    const mutatorTitles = run.activeMutators.map((id) => MUTATOR_CATALOG[id]?.title ?? id);
    const modeIdentity = describeRunModeIdentity(run);
    const chainMeterView = runChainMeter(run);
    const chainMeterDropping = useChainMeterDrop(chainMeterView.momentum, chainTierRungs(run.board?.pairCount ?? null).clean);
    const line = feedback ?? onboardingLine ?? (objective ? `${objective.label}: ${objective.progress}/${objective.required}` : null);
    const lineTone = feedback ? feedbackPriority : onboardingLine ? 'info' : 'objective';
    const visibleTools = tools.filter((tool) => tool.charges === undefined || tool.charges > 0 || tool.armed);

    return (
        <div className={styles.shell} data-testid="run-shell">
            <header className={styles.bar} data-testid="game-hud">
                {/* Identity, not a number: which run this is and the one rule that bends it. It sits
                    above the stat row rather than inside it so the numbers stay a row of numbers. */}
                {/* No aria-label: a paragraph prohibits one, and the text below already reads the
                    whole thing. `title` is the hover affordance, not the accessible name. */}
                <p className={styles.modeIdentity} data-testid="hud-mode-identity" title={runModeIdentityText(modeIdentity)}>
                    <span className={styles.modeIdentityName}>{modeIdentity.label}</span>
                    {modeIdentity.detail === null ? null : (
                        <span className={styles.modeIdentityDetail}>{modeIdentity.detail}</span>
                    )}
                    {perfectMemory === null ? null : (
                        <span
                            className={styles.perfectMemory}
                            data-state={perfectMemory}
                            data-testid="hud-perfect-memory"
                        >
                            {PERFECT_MEMORY_COPY.label}{' '}
                            {perfectMemory === 'eligible' ? PERFECT_MEMORY_COPY.eligible : PERFECT_MEMORY_COPY.locked}
                        </span>
                    )}
                </p>
                <div className={styles.stats} role="group" aria-label="Run stats">
                {/* A shared game runs to an agreed number of floors, so the floor count is a
                    progress reading rather than a depth reading. */}
                <Stat label="Floor" testId="hud-floor">
                    {isPassAndPlayRun(run.passAndPlay)
                        ? PASS_AND_PLAY_COPY.floorProgress(run.board?.level ?? 1, PASS_AND_PLAY_FLOORS)
                        : String(run.board?.level ?? 1)}
                </Stat>
                <Stat label="Lives" testId="hud-lives">
                    {/* role="img": every heart inside is aria-hidden, so the label is the only text a screen
                        reader has. Without a role, aria-label is prohibited here and gets ignored — the
                        life count then reads as nothing at all. */}
                    <span aria-label={`${run.lives} of ${maxLives} lives`} className={styles.hearts} role="img">
                        {Array.from({ length: maxLives }, (_, index) => (
                            <span
                                aria-hidden="true"
                                className={index < run.lives ? styles.heart : styles.heartLost}
                                key={index}
                            >
                                &#9829;
                            </span>
                        ))}
                    </span>
                </Stat>
                <Stat label="Score" primary testId="hud-score">
                    {runNonNegativeInteger(run.stats.totalScore).toLocaleString()}
                </Stat>
                {/* Only on a shared game. The run's own score stays: the table is still playing one
                    run together, and these say who has earned which part of it. */}
                {isPassAndPlayRun(run.passAndPlay) ? (
                    <div className={styles.seats} data-testid="hud-pass-and-play">
                        <span className={styles.label}>{PASS_AND_PLAY_COPY.seatsLabel}</span>
                        <span className={styles.seatRow}>
                            {run.passAndPlay.seats.map((seat, index) => (
                                <span
                                    aria-label={PASS_AND_PLAY_COPY.seatAnnouncement(seat.label, seat.score, seat.bestChain)}
                                    className={styles.seat}
                                    data-active={index === run.passAndPlay?.activeSeatIndex ? 'true' : 'false'}
                                    data-testid={`hud-seat-${seat.id}`}
                                    key={seat.id}
                                    role="img"
                                >
                                    {/* Both names ship and CSS picks one. The row has to narrow
                                        without the seat count changing what it means, and the
                                        aria-label above carries the full name either way. */}
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
                    </div>
                ) : null}
                {/* The ladder you are climbing. Depth plus the rung's name, because a tier that only
                    exists in the rules is a tier the player never planned around. */}
                <Stat
                    label="Chain"
                    meter={(() => {
                        // The ladder as a bar. Peggle's multiplier reads at a glance because it is a
                        // meter; ours was a number, a word and a hover hint. Ticks at Clean and Sharp,
                        // full at Fever, and it stays full until the chain drops.
                        const meter = chainMeterView;
                        return (
                            <span
                                aria-label={CHAIN_BEAT_COPY.meterLabel(meter.momentum, meter.feverAt, meter.full)}
                                className={styles.chainMeter}
                                data-chain-tier={meter.tier}
                                data-meter-drop={chainMeterDropping ? 'true' : 'false'}
                                data-meter-fill={meter.fill.toFixed(3)}
                                data-meter-full={meter.full ? 'true' : 'false'}
                                data-testid="hud-chain-meter"
                                role="img"
                                style={
                                    {
                                        '--chain-meter-clean': `${(meter.ticks.clean * 100).toFixed(1)}%`,
                                        '--chain-meter-sharp': `${(meter.ticks.sharp * 100).toFixed(1)}%`
                                    } as CSSProperties
                                }
                            >
                                <span className={styles.chainMeterFill} style={{ width: `${(meter.fill * 100).toFixed(1)}%` }} />
                            </span>
                        );
                    })()}
                    testId="hud-chain"
                >
                    <span
                        data-chain-tier={runChainTier(run)}
                        title={CHAIN_BEAT_COPY.momentumHint(
                            runNonNegativeInteger(run.stats.currentStreak),
                            runNonNegativeInteger(run.chunkPairsThisChain),
                            chainTierRungs(run.board?.pairCount ?? null)
                        )}
                    >
                        {`×${runNonNegativeInteger(run.stats.currentStreak)}${
                            CHAIN_TIER_LABELS[runChainTier(run)]
                                ? ` ${CHAIN_TIER_LABELS[runChainTier(run)]}`
                                : ''
                        }`}
                    </span>
                </Stat>
                <Stat label="Shards" testId="hud-combo-shards">
                    {String(run.stats.comboShards)}
                </Stat>
                {run.stats.guardTokens > 0 ? (
                    <Stat label="Guards" testId="hud-guards">
                        {String(run.stats.guardTokens)}
                    </Stat>
                ) : null}
                {gauntletRemainingMs !== null ? (
                    <Stat label="Clock" testId="hud-gauntlet-timer">
                        <span
                            className={`${styles.timer} ${gauntletRemainingMs <= 30_000 ? styles.timerLow : ''}`.trim()}
                            role="timer"
                        >
                            {formatTimer(gauntletRemainingMs)}
                        </span>
                    </Stat>
                ) : null}
                {mutatorTitles.length > 0 ? (
                    <Stat label="Mutator" testId="hud-mutators">
                        <span style={{ fontSize: '0.95rem', letterSpacing: '0.04em' }}>{mutatorTitles.join(' · ')}</span>
                    </Stat>
                ) : null}
                </div>
            {line ? (
                <p
                    className={`${styles.feedback} ${lineTone === 'error' ? styles.feedbackError : ''} ${lineTone === 'objective' ? styles.feedbackObjective : ''}`.trim()}
                    data-testid="run-shell-line"
                    data-run-shell-line-tone={lineTone}
                    role="status"
                >
                    {line}
                </p>
            ) : null}
            </header>

            <div className={styles.dock} data-testid="game-action-dock" role="toolbar" aria-label="Game controls">
                {visibleTools.map((tool) => (
                    <button
                        aria-label={tool.title ?? tool.label}
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
                    className={styles.tool}
                    data-testid="game-toolbar-main-menu"
                    onClick={onPause}
                    title="Pause (P / Esc)"
                    type="button"
                >
                    <span className={styles.toolGlyph}>
                        <GameplayMenuIcon />
                    </span>
                    <span className={styles.toolLabel}>Menu</span>
                </button>
            </div>

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

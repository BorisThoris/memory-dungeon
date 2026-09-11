/**
 * Three accessibility targets this game can be measured against, and what it actually does about
 * each. Run: yarn audit:accessibility [--check]
 *
 * These are not house style. Each is written down somewhere outside this repository, in words that
 * can be checked, and all three were verified 3-0 in `docs/RESEARCH_NOTES.md` §3 - which is what
 * makes them gateable rather than matters of taste. A fourth set of claims from the same pass was
 * REFUTED 0-3 (disabling all moving content, per-effect intensity sliders as cited best practice,
 * a gameplay-core exemption, and a tiering of colour-alone guidance); they sound authoritative and
 * are deliberately absent here.
 *
 * What this file is for is the gap between a target being met and a target being ANSWERED. A
 * declaration on a store page is self-reported and unaudited, so the honesty is entirely on us; an
 * accessibility setting that exists is worth nothing if it does not reach the thing it names. Both
 * failures were sitting here when this was written, and both are recorded below rather than
 * quietly fixed and forgotten.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SETTINGS_HINTS } from '../src/renderer/copy/settingsHints';
import { SETTINGS_NUMERIC_RANGES } from '../src/shared/save-data';
import { UI_SCALE_MAX } from '../src/renderer/uiScaleLimits';

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

export type AccessibilityTargetStatus = 'met' | 'open';

export interface AccessibilityTarget {
    id: string;
    /** Where the requirement is written down, outside this repository. */
    source: string;
    /** The requirement, in its own words where they are short enough to quote. */
    asks: string;
    status: AccessibilityTargetStatus;
    /** What the game does, in one sentence a reader can check against the evidence below. */
    answer: string;
    /** Facts read out of the game's own files, so the answer cannot go stale in silence. */
    evidence: () => string[];
    /** For an open target: the task that closes it. An open target with no task is a wish. */
    blockedBy?: string;
}

/**
 * Steam's Camera Comfort declaration covers screen shake, camera bob and motion blur, and is
 * satisfied either by offering a control or by not using the effects at all. So the answer has to
 * be given effect by effect: an effect that exists needs a control, and an effect that does not
 * exist needs to stay that way or acquire one.
 */
const CAMERA_COMFORT_EFFECTS = [
    {
        control: 'reduceMotion',
        effect: 'screen shake',
        // `advanceBoardTrauma` and `computeTileBoardTraumaState` both return 0 under reduce motion.
        offWhen: /reduceMotion\) \{\n\s+return \{ previous: nextPrevious, trauma: 0 \};/u,
        source: 'src/renderer/components/boardTrauma.ts'
    },
    {
        control: 'reduceMotion',
        effect: 'camera bob',
        // The board's idle drift: the breathing a still board does between turns.
        offWhen: /idleDrift: reduceMotion \? 0/u,
        source: 'src/renderer/components/tileBoardInteractionMotionState.ts'
    }
] as const;

/** Motion blur: the third effect the declaration names, and one this game does not have. */
export const MOTION_BLUR_PATTERN = /motion-?blur/iu;

export const readMotionBlurUses = (files: readonly string[]): string[] =>
    files.filter((file) => MOTION_BLUR_PATTERN.test(read(file)));

export const ACCESSIBILITY_TARGETS: readonly AccessibilityTarget[] = [
    {
        id: 'steam.camera_comfort',
        source: 'Steam store-page accessibility feature declaration',
        asks: 'Screen shake, camera bob and motion blur are adjustable, or are not used.',
        status: 'met',
        answer:
            'Reduce Motion turns off both effects this game has, and it has no motion blur. The ' +
            'declaration is true as written and is generated from these facts rather than typed ' +
            'into a web form from memory.',
        evidence: () => [
            ...CAMERA_COMFORT_EFFECTS.map(({ control, effect, offWhen, source }) => {
                const covered = offWhen.test(read(source));
                return `${effect}: ${covered ? `off under ${control}` : `NOT covered by ${control}`} (${source})`;
            }),
            `motion blur: not used (${readMotionBlurUses(['src/renderer/components/gameplayVisualConfig.ts']).length} declarations)`,
            // A control credited with covering an effect has to say so where the player reads it.
            `hint names the shake: ${/shake/iu.test(SETTINGS_HINTS.reduceMotion) ? 'yes' : 'NO'}`,
            `hint: "${SETTINGS_HINTS.reduceMotion}"`
        ]
    },
    {
        id: 'xag.adjust_game_speed',
        source: 'Xbox Accessibility Guidelines, Motor, Basic tier',
        asks: 'Let the player adjust the game speed, and do not make precise timing the only path.',
        status: 'met',
        answer:
            'One slider moves every clock the game has. It reaches runs through `applyRunSettings`, ' +
            'and above 1 it also lengthens the memorize window - the game’s only timed gate - by ' +
            'half again. Nothing else in the game is scored against a clock: there is no run timer ' +
            '(Gen 178) and par counts turns, not seconds.',
        evidence: () => [
            `resolveDelayMultiplier range: ${SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.min} to ` +
                `${SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.max}`,
            `reaches the run: ${/resolveDelayMultiplier: settings.resolveDelayMultiplier/u.test(read('src/shared/run-settings-rules.ts')) ? 'yes' : 'NO'} (run-settings-rules.ts)`,
            `moves the memorize window: ${/run.resolveDelayMultiplier > 1/u.test(read('src/shared/scoring-rules.ts')) ? 'yes' : 'NO'} (scoring-rules.ts)`,
            `hint names the memorize window: ${/memorize/iu.test(SETTINGS_HINTS.resolveDelayMultiplier) ? 'yes' : 'NO'}`,
            `hint: "${SETTINGS_HINTS.resolveDelayMultiplier}"`
        ]
    },
    {
        id: 'xag.text_scaling',
        source: 'Xbox Accessibility Guidelines, text minimums',
        asks: 'Text is at least 18px at 1080p on PC, and scalable to 200%.',
        status: 'open',
        answer:
            'Neither half is met, and the second is further away than it looks. The declaration floor ' +
            'is 12px (`MIN_TYPE_PX`), chosen for a fitted layout read at arm’s length on a Deck ' +
            'rather than for a 1080p monitor; and the scale stops at ' +
            `${UI_SCALE_MAX}×, not because 200% was judged unnecessary but because the main menu ` +
            'loses a row of controls above it. That is a defect with a task, not a design position.',
        blockedBy: 'task #245 - the main menu has no layout below ~700px of container height',
        evidence: () => [
            `uiScale ceiling: ${UI_SCALE_MAX} (src/renderer/uiScaleLimits.ts, measured by e2e/ui-scale-ceiling.spec.ts)`,
            `slider range: ${SETTINGS_NUMERIC_RANGES.uiScale.min} to ${SETTINGS_NUMERIC_RANGES.uiScale.max}`,
            `declaration floor: ${/export const MIN_TYPE_PX = 12/u.test(read('scripts/min-type-size.ts')) ? '12px' : 'moved'} (scripts/min-type-size.ts)`
        ]
    }
];

export const judgeAccessibilityTargets = (): string[] => {
    const issues: string[] = [];
    for (const target of ACCESSIBILITY_TARGETS) {
        const evidence = target.evidence();
        for (const line of evidence) {
            if (/\bNOT\b|\bNO\b|moved/u.test(line)) {
                issues.push(`${target.id}: ${line}`);
            }
        }
        if (target.status === 'open' && !target.blockedBy) {
            issues.push(`${target.id} is open with nothing named to close it`);
        }
        if (target.status === 'met' && target.blockedBy) {
            issues.push(`${target.id} is met and still names a blocker: ${target.blockedBy}`);
        }
    }
    return issues;
};

const main = (): void => {
    for (const target of ACCESSIBILITY_TARGETS) {
        process.stdout.write(`\n${target.status === 'met' ? 'MET ' : 'OPEN'}  ${target.id}\n`);
        process.stdout.write(`      source: ${target.source}\n`);
        process.stdout.write(`      asks:   ${target.asks}\n`);
        process.stdout.write(`      answer: ${target.answer}\n`);
        for (const line of target.evidence()) {
            process.stdout.write(`      - ${line}\n`);
        }
        if (target.blockedBy) {
            process.stdout.write(`      closed by: ${target.blockedBy}\n`);
        }
    }
    const met = ACCESSIBILITY_TARGETS.filter((target) => target.status === 'met').length;
    process.stdout.write(`\ntargets: ${ACCESSIBILITY_TARGETS.length}, met: ${met}, open: ${ACCESSIBILITY_TARGETS.length - met}\n`);
    const issues = judgeAccessibilityTargets();
    if (issues.length > 0) {
        process.stdout.write(`\nEvidence that stopped holding:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
    }
    if (process.argv.includes('--check')) {
        if (issues.length > 0) {
            process.stderr.write('Accessibility target check failed\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('\nAccessibility target check passed\n');
    }
};

if (process.argv[1]?.includes('accessibility-targets')) {
    main();
}

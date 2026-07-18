import { getChainTargetFeedback } from '../../shared/chain-targets';

type MismatchFloaterContext = {
    brokenChainDepth?: number;
    brokenChainRewardCue?: {
        distanceLabel: string;
        label: string;
    };
};

const normalizeBrokenChainDepth = (context: MismatchFloaterContext = {}): number => {
    const depth = context.brokenChainDepth ?? 0;
    return Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;
};

const chainBreakLiveText = (context: MismatchFloaterContext = {}): string =>
    normalizeBrokenChainDepth(context) >= 2 ? ` Chain x${normalizeBrokenChainDepth(context)} broken.` : '';

const chainBreakRecoveryValue = (context: MismatchFloaterContext = {}): string =>
    normalizeBrokenChainDepth(context) >= 2 ? `x${normalizeBrokenChainDepth(context)} lost` : 'Chain reset';

const chainBreakRewardLossText = (context: MismatchFloaterContext = {}): string =>
    normalizeBrokenChainDepth(context) >= 2 && context.brokenChainRewardCue
        ? ` Lost reward target: ${context.brokenChainRewardCue.label} in ${context.brokenChainRewardCue.distanceLabel}.`
        : '';

const chainBreakTargetText = (context: MismatchFloaterContext = {}): string =>
    normalizeBrokenChainDepth(context) >= 2
        ? ` Next chase: ${getChainTargetFeedback(normalizeBrokenChainDepth(context)).value}.`
        : '';

const RECOVERY_LANE_LIVE_ACTIONS: Readonly<Record<string, string>> = {
    Lost: 'Save cashout',
    Tool: 'Trigger tool',
    Risk: 'Route away'
};

const enrichRecoveryLaneMapLiveText = (text: string): string => {
    const withChainActions = text.replace(/(Chain:\s+(\d+)\.\s+)(?!Reset chain\.|Rebuild chain\.)/gu, (_match, prefix, count) => {
        const action = Number(count) > 1 ? 'Rebuild chain' : 'Reset chain';
        return `${prefix}${action}. `;
    });
    const withRecoverActions = withChainActions.replace(
        /(Recover:\s+\d+\.\s+)(?!Confirm pair\.|Stabilize route\.)([^.]+)\./gu,
        (_match, prefix, cue) => {
            const action = cue === 'Safe pair' ? 'Confirm pair' : 'Stabilize route';
            return `${prefix}${action}. ${cue}.`;
        }
    );
    return Object.entries(RECOVERY_LANE_LIVE_ACTIONS).reduce((current, [lane, action]) => {
        const lanePattern = new RegExp(`(${lane}:\\s+\\d+\\.\\s+)(?!${action.replace(/\s+/gu, '\\s+')}\\.)`, 'gu');
        return current.replace(lanePattern, `$1${action}. `);
    }, withRecoverActions);
};

/**
 * Mismatch floater live region (`aria-live`). Centralized for a11y review and future i18n.
 */
export function mismatchFloaterLiveRegionText(
    traitInteractionTexts: readonly string[] = [],
    recoveryHint: string | null = mismatchFloaterRecoveryHint(traitInteractionTexts),
    context: MismatchFloaterContext = {},
    recoveryLaneMapText?: string,
    recoveryCrescendoText?: string
): string {
    const nextAction = mismatchFloaterNextAction(traitInteractionTexts, context);
    const nextActionText = ` Next action: ${nextAction.arcadeCue}: ${nextAction.value}.`;
    const sequence = mismatchFloaterRecoverySequence(traitInteractionTexts, context);
    const sequenceText = ` Recovery sequence: First ${sequence.first}. Then ${sequence.then}. Keep ${sequence.keep}.`;
    const laneMapText = recoveryLaneMapText
        ? ` ${enrichRecoveryLaneMapLiveText(recoveryLaneMapText).replace(/[.!?]+$/u, '')}.`
        : '';
    const crescendoText = recoveryCrescendoText ? ` ${recoveryCrescendoText.replace(/[.!?]+$/u, '')}.` : '';
    if (traitInteractionTexts.length === 0) {
        return `No match.${chainBreakLiveText(context)}${chainBreakRewardLossText(context)}${chainBreakTargetText(context)}${nextActionText}${sequenceText}${laneMapText}${crescendoText} Recover with a safe match. ${chainBreakRecoveryValue(context)}`;
    }
    const traitLead = traitInteractionTexts.length >= 2 ? `Trait surge: ${traitInteractionTexts.length} risks.` : 'Trait penalty.';
    const recoveryHintText = recoveryHint ? `. ${recoveryHint}${laneMapText ? '.' : ''}` : '';
    return `${traitLead} No match.${chainBreakLiveText(context)}${chainBreakRewardLossText(context)}${chainBreakTargetText(context)}${nextActionText}${sequenceText} ${traitInteractionTexts.join('. ')}${
        recoveryHintText
    }${laneMapText}${crescendoText}`;
}

/** Visible label on the board-stage floater (`aria-hidden`); keep short for layout. */
export function mismatchFloaterVisualLabel(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): string {
    if (traitInteractionTexts.length > 0) {
        return 'Penalty';
    }
    return normalizeBrokenChainDepth(context) >= 3 ? 'Break' : 'Miss';
}

/** Short recovery cue shown on trait-penalty misses. */
export function mismatchFloaterRecoveryHint(traitInteractionTexts: readonly string[] = []): string | null {
    if (traitInteractionTexts.length === 0) {
        return 'Recover - safe match';
    }
    const text = traitInteractionTexts.join(' ').toLowerCase();
    if (text.includes('buffered')) {
        return 'Buffered - open a safe match';
    }
    if (text.includes('blocked') || text.includes('lock')) {
        return 'Next - choose another opener';
    }
    if (text.includes('volatile') || text.includes('cursed')) {
        return 'Recover - peek or route away';
    }
    if (text.includes('sealed')) {
        return 'Recover - peek before Sealed';
    }
    return 'Recover - prime with tools';
}

type MismatchFloaterSignal = {
    label: 'Miss' | 'Risk' | 'Break';
    tone: 'miss' | 'penalty' | 'break';
};

/** Compact signal chip shown above mismatch floaters. */
export function mismatchFloaterSignal(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterSignal {
    if (traitInteractionTexts.length > 0) {
        return { label: 'Risk', tone: 'penalty' };
    }
    return normalizeBrokenChainDepth(context) >= 3 ? { label: 'Break', tone: 'break' } : { label: 'Miss', tone: 'miss' };
}

export type MismatchFloaterRecoveryChip = {
    id: 'action' | 'payoff' | 'surge' | 'target' | 'tool' | 'tempo';
    arcadeCue: string;
    label: string;
    urgency?: 'future' | 'one-away' | 'setup';
    value: string;
    tone: 'chain' | 'recover' | 'tool' | 'tempo' | 'risk';
};

export type MismatchFloaterRecoveryLaneId = 'recover' | 'lost' | 'chain' | 'tool' | 'risk';

export type MismatchFloaterRecoveryLaneMapEntry = {
    id: MismatchFloaterRecoveryLaneId;
    label: 'Recover' | 'Lost' | 'Chain' | 'Tool' | 'Risk';
    count: number;
    cue: string;
};

type MismatchFloaterRecoveryBurst = {
    label: 'Recover' | 'Chain broken' | 'Reward lost' | 'Route risk' | 'Trait surge';
    value: string;
    tier: 'recover' | 'break' | 'lost-reward' | 'risk';
};

type MismatchFloaterNextAction = {
    arcadeCue: 'Safe pair' | 'Recover route' | 'Rebuild chase' | 'Save cashout';
    label: 'Recover now' | 'Recover route' | 'Rebuild chain' | 'Save streak';
    value: string;
    tone: 'recover' | 'risk' | 'lost-reward';
};

type MismatchFloaterRecoveryStack = {
    label: 'Recovery stack' | 'Risk stack' | 'Lost reward stack';
    value: string;
    detail: string;
    tone: 'recover' | 'risk' | 'lost-reward' | 'break';
};

type MismatchFloaterRecoverySequence = {
    first: string;
    keep: string;
    label: 'Recovery sequence';
    then: string;
    tone: 'recover' | 'risk' | 'lost-reward' | 'break';
};

type MismatchFloaterRecoveryCrescendo = {
    beatCount: 2 | 3 | 4 | 5;
    detail: string;
    label: 'Recover beat' | 'Break beat' | 'Risk beat' | 'Lost reward burst' | 'Trait surge burst';
    screenCue: 'pulse' | 'snap' | 'burst' | 'super';
    tier: 'recover' | 'break' | 'risk' | 'lost-reward' | 'trait-surge';
};

const stripRecoveryPrefix = (value: string): string =>
    value.replace(/^Recover - /, '').replace(/^Next - /, '').replace(/^Buffered - /, '');

const lostRewardUrgency = (context: MismatchFloaterContext): MismatchFloaterRecoveryChip['urgency'] => {
    const label = context.brokenChainRewardCue?.distanceLabel.toLowerCase() ?? '';
    if (!label) {
        return undefined;
    }
    return label.startsWith('1 match') ? 'one-away' : label.startsWith('2 match') ? 'setup' : 'future';
};

const traitRiskHeadline = (traitInteractionTexts: readonly string[]): string =>
    traitInteractionTexts[0]?.split(':')[0]?.trim() || 'Trait risk';

/** One-line stack summary for misses that combine chain loss, reward loss, or trait pressure. */
export function mismatchFloaterRecoveryStack(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterRecoveryStack | null {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    const hasTraitRisk = traitInteractionTexts.length > 0;
    const target = brokenChainDepth >= 2 ? getChainTargetFeedback(brokenChainDepth).value : null;
    const hint = stripRecoveryPrefix(mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools');

    if (brokenChainDepth >= 2 && context.brokenChainRewardCue) {
        return {
            label: hasTraitRisk ? 'Risk stack' : 'Lost reward stack',
            value: hasTraitRisk ? 'Trait risk + Chain break + Lost reward' : 'Chain break + Lost reward + Next chase',
            detail: `x${brokenChainDepth} lost -> ${context.brokenChainRewardCue.label}${target ? ` -> ${target}` : ''}`,
            tone: 'lost-reward'
        };
    }
    if (hasTraitRisk && brokenChainDepth >= 2) {
        return {
            label: 'Risk stack',
            value: 'Trait risk + Chain break + Recover',
            detail: `${traitRiskHeadline(traitInteractionTexts)} -> x${brokenChainDepth} lost${target ? ` -> ${target}` : ''}`,
            tone: 'break'
        };
    }
    if (brokenChainDepth >= 2) {
        return {
            label: 'Recovery stack',
            value: 'Chain break + Next chase',
            detail: `x${brokenChainDepth} lost${target ? ` -> ${target}` : ''}`,
            tone: 'break'
        };
    }
    if (hasTraitRisk) {
        const traitSurge = traitInteractionTexts.length >= 2;
        return {
            label: 'Risk stack',
            value: traitSurge ? 'Trait surge + Tool + Recover' : 'Trait risk + Tool + Recover',
            detail: traitSurge ? `${traitInteractionTexts.length} trait risks -> ${hint}` : `${traitRiskHeadline(traitInteractionTexts)} -> ${hint}`,
            tone: 'risk'
        };
    }
    return null;
}

/** First/then/keep rhythm for the recovery UI after a miss. */
export function mismatchFloaterRecoverySequence(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterRecoverySequence {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    const hasTraitRisk = traitInteractionTexts.length > 0;
    const hint = stripRecoveryPrefix(mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools');
    if (brokenChainDepth >= 2 && context.brokenChainRewardCue) {
        return {
            first: hasTraitRisk ? hint : 'Safe match',
            keep: getChainTargetFeedback(brokenChainDepth).value,
            label: 'Recovery sequence',
            then: `Rebuild toward ${context.brokenChainRewardCue.label}`,
            tone: 'lost-reward'
        };
    }
    if (brokenChainDepth >= 2) {
        return {
            first: hasTraitRisk ? hint : 'Safe match',
            keep: 'Protect next streak',
            label: 'Recovery sequence',
            then: getChainTargetFeedback(brokenChainDepth).value,
            tone: hasTraitRisk ? 'risk' : 'break'
        };
    }
    if (hasTraitRisk) {
        return {
            first: hint,
            keep: 'Avoid repeat risk',
            label: 'Recovery sequence',
            then: traitInteractionTexts.length >= 2 ? 'Route away from surge' : 'Prime with tool',
            tone: 'risk'
        };
    }
    return {
        first: 'Safe match',
        keep: 'Re-prime chain',
        label: 'Recovery sequence',
        then: 'Prime x3 loop',
        tone: 'recover'
    };
}

/** Compact rhythm signal for arcade-style post-miss feedback. */
export function mismatchFloaterRecoveryCrescendo(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterRecoveryCrescendo {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    const hasLostReward = brokenChainDepth >= 2 && Boolean(context.brokenChainRewardCue);
    const traitSurge = traitInteractionTexts.length >= 2;
    const hasTraitRisk = traitInteractionTexts.length > 0;

    if (hasLostReward && traitSurge && context.brokenChainRewardCue) {
        return {
            beatCount: 5,
            detail: `Lost ${context.brokenChainRewardCue.label} while ${traitInteractionTexts.length} trait risks spiked`,
            label: 'Trait surge burst',
            screenCue: 'super',
            tier: 'trait-surge'
        };
    }
    if (hasLostReward && context.brokenChainRewardCue) {
        return {
            beatCount: 4,
            detail: `Rebuild toward ${context.brokenChainRewardCue.label}`,
            label: 'Lost reward burst',
            screenCue: 'burst',
            tier: 'lost-reward'
        };
    }
    if (traitSurge) {
        return {
            beatCount: 4,
            detail: `${traitInteractionTexts.length} trait risks; route away before chasing`,
            label: 'Trait surge burst',
            screenCue: 'burst',
            tier: 'trait-surge'
        };
    }
    if (brokenChainDepth >= 2) {
        return {
            beatCount: 3,
            detail: `${chainBreakRecoveryValue(context)}; ${getChainTargetFeedback(brokenChainDepth).value}`,
            label: 'Break beat',
            screenCue: 'snap',
            tier: 'break'
        };
    }
    if (hasTraitRisk) {
        return {
            beatCount: 3,
            detail: stripRecoveryPrefix(mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools'),
            label: 'Risk beat',
            screenCue: 'snap',
            tier: 'risk'
        };
    }
    return {
        beatCount: 2,
        detail: 'Safe match then prime x3 loop',
        label: 'Recover beat',
        screenCue: 'pulse',
        tier: 'recover'
    };
}

export function mismatchFloaterRecoveryCrescendoLabel(
    label: string,
    crescendo: MismatchFloaterRecoveryCrescendo
): string {
    return `${label}: ${crescendo.label}. ${crescendo.beatCount} beats. ${crescendo.detail}.`;
}

/** Punchy post-miss action callout; shown before the detailed recovery chips. */
export function mismatchFloaterNextAction(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterNextAction {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    if (brokenChainDepth >= 2 && context.brokenChainRewardCue) {
        return {
            arcadeCue: 'Save cashout',
            label: 'Save streak',
            value: `Rebuild toward ${context.brokenChainRewardCue.label}`,
            tone: 'lost-reward'
        };
    }
    if (brokenChainDepth >= 2) {
        const target = getChainTargetFeedback(brokenChainDepth);
        return {
            arcadeCue: 'Rebuild chase',
            label: 'Rebuild chain',
            value: target.value,
            tone: 'risk'
        };
    }
    if (traitInteractionTexts.length > 0) {
        return {
            arcadeCue: 'Recover route',
            label: 'Recover route',
            value: (mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools')
                .replace(/^Recover - /, '')
                .replace(/^Next - /, ''),
            tone: 'risk'
        };
    }
    return {
        arcadeCue: 'Safe pair',
        label: 'Recover now',
        value: 'Safe match',
        tone: 'recover'
    };
}

/** Larger recovery pulse for misses where the next action should be obvious at a glance. */
export function mismatchFloaterRecoveryBurst(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterRecoveryBurst {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    if (brokenChainDepth >= 2 && context.brokenChainRewardCue) {
        return {
            label: 'Reward lost',
            value: context.brokenChainRewardCue.label,
            tier: 'lost-reward'
        };
    }
    if (brokenChainDepth >= 2) {
        return {
            label: 'Chain broken',
            value: `x${brokenChainDepth} lost`,
            tier: 'break'
        };
    }
    if (traitInteractionTexts.length > 0) {
        const hint = mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools';
        return {
            label: traitInteractionTexts.length >= 2 ? 'Trait surge' : 'Route risk',
            value: traitInteractionTexts.length >= 2
                ? `${traitInteractionTexts.length} risks`
                : hint.replace(/^Recover - /, '').replace(/^Next - /, ''),
            tier: 'risk'
        };
    }
    return {
        label: 'Recover',
        value: 'Safe match',
        tier: 'recover'
    };
}

/** Compact visible chips that keep misses actionable instead of only punitive. */
export function mismatchFloaterRecoveryChips(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterRecoveryChip[] {
    if (traitInteractionTexts.length === 0) {
        const chips: MismatchFloaterRecoveryChip[] = [
            { id: 'action', arcadeCue: 'Safe pair', label: 'Recover', value: 'Safe match', tone: 'recover' },
            {
                id: 'tempo',
                arcadeCue: normalizeBrokenChainDepth(context) >= 2 ? 'Chain lost' : 'Reset',
                label: 'Tempo',
                value: chainBreakRecoveryValue(context),
                tone: 'tempo'
            }
        ];
        if (normalizeBrokenChainDepth(context) >= 2 && context.brokenChainRewardCue) {
            chips.push({
                id: 'payoff',
                arcadeCue: 'Lost cashout',
                label: 'Lost reward',
                urgency: lostRewardUrgency(context),
                value: context.brokenChainRewardCue.label,
                tone: 'risk'
            });
        }
        if (normalizeBrokenChainDepth(context) >= 2) {
            chips.push({
                id: 'target',
                arcadeCue: 'Rebuild chase',
                label: 'Next chase',
                value: getChainTargetFeedback(normalizeBrokenChainDepth(context)).value,
                tone: 'chain'
            });
        }
        return chips;
    }
    const hint = mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools';
    const text = traitInteractionTexts.join(' ').toLowerCase();
    const tool = text.includes('volatile') || text.includes('cursed')
        ? 'Peek / route'
        : text.includes('sealed')
          ? 'Peek first'
          : text.includes('blocked') || text.includes('lock')
            ? 'New opener'
            : 'Prime tool';
    const chips: MismatchFloaterRecoveryChip[] = [
        {
            id: 'action',
            arcadeCue: 'Recover route',
            label: 'Recover',
            value: hint.replace(/^Recover - /, '').replace(/^Next - /, ''),
            tone: 'recover'
        },
        { id: 'tool', arcadeCue: 'Use tool', label: 'Tool', value: tool, tone: 'tool' },
        {
            id: 'tempo',
            arcadeCue: normalizeBrokenChainDepth(context) >= 2 ? 'Chain lost' : 'Avoid repeat',
            label: normalizeBrokenChainDepth(context) >= 2 ? 'Break' : 'Risk',
            value: normalizeBrokenChainDepth(context) >= 2 ? chainBreakRecoveryValue(context) : 'Avoid repeat',
            tone: 'risk'
        }
    ];
    if (traitInteractionTexts.length >= 2) {
        chips.splice(1, 0, {
            id: 'surge',
            arcadeCue: 'Risk spike',
            label: 'Trait surge',
            value: `${traitInteractionTexts.length} risks`,
            tone: 'risk'
        });
    }
    if (normalizeBrokenChainDepth(context) >= 2 && context.brokenChainRewardCue) {
        chips.push({
            id: 'payoff',
            arcadeCue: 'Lost cashout',
            label: 'Lost reward',
            urgency: lostRewardUrgency(context),
            value: context.brokenChainRewardCue.label,
            tone: 'risk'
        });
    }
    if (normalizeBrokenChainDepth(context) >= 2) {
        chips.push({
            id: 'target',
            arcadeCue: 'Rebuild chase',
            label: 'Next chase',
            value: getChainTargetFeedback(normalizeBrokenChainDepth(context)).value,
            tone: 'chain'
        });
    }
    return chips;
}

const MISMATCH_RECOVERY_LANE_ORDER: MismatchFloaterRecoveryLaneId[] = ['recover', 'lost', 'chain', 'tool', 'risk'];

const MISMATCH_RECOVERY_LANE_LABELS: Record<
    MismatchFloaterRecoveryLaneId,
    MismatchFloaterRecoveryLaneMapEntry['label']
> = {
    chain: 'Chain',
    lost: 'Lost',
    recover: 'Recover',
    risk: 'Risk',
    tool: 'Tool'
};

const mismatchRecoveryLaneId = (chip: MismatchFloaterRecoveryChip): MismatchFloaterRecoveryLaneId => {
    if (chip.id === 'payoff') {
        return 'lost';
    }
    if (chip.id === 'tool') {
        return 'tool';
    }
    if (chip.id === 'surge' || chip.tone === 'risk') {
        return 'risk';
    }
    if (chip.id === 'target' || chip.id === 'tempo') {
        return 'chain';
    }
    return 'recover';
};

export function mismatchFloaterRecoveryLaneMap(
    chips: readonly MismatchFloaterRecoveryChip[]
): MismatchFloaterRecoveryLaneMapEntry[] | null {
    const laneState = new Map<MismatchFloaterRecoveryLaneId, { count: number; cue: string }>();
    chips.forEach((chip) => {
        const laneId = mismatchRecoveryLaneId(chip);
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: chip.arcadeCue });
    });
    const lanes = MISMATCH_RECOVERY_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        return state ? [{ id, label: MISMATCH_RECOVERY_LANE_LABELS[id], count: state.count, cue: state.cue }] : [];
    });
    return lanes.length >= 2 ? lanes : null;
}

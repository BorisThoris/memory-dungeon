import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS_DIR = join(process.cwd(), 'src', 'renderer', 'components');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type BeatPipRule = {
    fileName: string;
    className: string;
    element: 'i' | 's' | 'u';
};

const readComponentCssFiles = () =>
    readdirSync(COMPONENTS_DIR)
        .filter((fileName) => fileName.endsWith('.module.css'))
        .map((fileName) => ({
            fileName,
            text: readFileSync(join(COMPONENTS_DIR, fileName), 'utf8')
        }));

const readComponentSourceFiles = () =>
    readdirSync(COMPONENTS_DIR)
        .filter((fileName) => /\.(ts|tsx)$/.test(fileName))
        .map((fileName) => ({
            fileName,
            text: readFileSync(join(COMPONENTS_DIR, fileName), 'utf8')
        }));

const findBeatPipRules = (): BeatPipRule[] => {
    const rules: BeatPipRule[] = [];
    const baseRulePattern = /(?:^|,)\s*\.([A-Za-z0-9_-]*BeatPips)\s+([isu])(?=[\s,{])/gm;

    for (const { fileName, text } of readComponentCssFiles()) {
        for (const match of text.matchAll(baseRulePattern)) {
            rules.push({
                fileName,
                className: match[1]!,
                element: match[2] as 'i' | 's' | 'u'
            });
        }
    }

    return rules;
};

const findBeatPipUsages = (): string[] => {
    const usages = new Set<string>();

    for (const { text } of readComponentSourceFiles()) {
        for (const match of text.matchAll(/styles\.([A-Za-z0-9_]*BeatPips)/g)) {
            usages.add(match[1]!);
        }
    }

    return [...usages].sort();
};

type PrimaryCueMetadataGap = {
    fileName: string;
    lineNumber: number;
    hasAudio: boolean;
    hasScreenCue: boolean;
};

type SignalCueMetadataGap = {
    fileName: string;
    lineNumber: number;
    hasAudio: boolean;
    hasScreenCue: boolean;
};

type BeatCueMetadataGap = {
    fileName: string;
    lineNumber: number;
    kind: 'burst' | 'lane' | 'payoff';
    hasAudio: boolean;
    hasScreenCue: boolean;
};

type BeatFocusMetadataGap = {
    attr: string;
    expectedFocusAttr: string;
    fileName: string;
    lineNumber: number;
};

type HardHiddenFeedbackMap = {
    fileName: string;
    selector: string;
};

type ScreenCueSelectorGap = {
    attr: string;
    fileName: string;
    lineNumber: number;
};

type AudioScreenCueMetadataGap = {
    attr: string;
    expectedScreenCueAttr: string;
    fileName: string;
    lineNumber: number;
};

type ActionFeedbackLaneRoleSelectorGap = {
    attr: string;
    role: string;
};

type OpportunityLaneRoleSelectorGap = {
    attr: string;
    role: string;
};

type TraitInteractionLaneRoleSelectorGap = {
    attr: string;
    role: string;
};

type VisibleToneSelectorGap = {
    attr: string;
    value: string;
};

type VisibleStateSelectorGap = {
    attr: string;
    value: string;
};

type VisiblePrefixSelectorGap = {
    attr: string;
    prefix: string;
};

type VisiblePackedValueSelectorGap = {
    attr: string;
    value: string;
};

type MeterFillVariableGap = {
    attr: string;
    cssVariable: string;
    fileName: string;
};

type ProgressReadabilityGap = {
    fileName: string;
    lineNumber: number;
};

type FeedbackSummaryReadabilityGap = {
    fileName: string;
    lineNumber: number;
    testId: string;
};

type NamedFeedbackCueReadabilityGap = {
    fileName: string;
    lineNumber: number;
    testId: string;
};

type CardFeedbackRowReadabilityGap = {
    attrs: string[];
    fileName: string;
    lineNumber: number;
};

type PlaySurfaceLaneRowReadabilityGap = {
    fileName: string;
    lineNumber: number;
};

type MeterReadabilityGap = {
    fileName: string;
    lineNumber: number;
};

const findPrimaryCueMetadataGaps = (): PrimaryCueMetadataGap[] => {
    const gaps: PrimaryCueMetadataGap[] = [];
    const primaryCueElementPattern =
        /<[A-Za-z][^<>]*(?:data-[A-Za-z0-9-]*primary[A-Za-z0-9-]*-(?:action|beats)\b)[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles()) {
        for (const match of text.matchAll(primaryCueElementPattern)) {
            const tag = match[0]!;
            if (/data-[A-Za-z0-9-]*primary[A-Za-z0-9-]*-beat\b/.test(tag)) {
                continue;
            }

            const hasAudio = /data-[A-Za-z0-9-]*primary[A-Za-z0-9-]*-audio\b/.test(tag);
            const hasScreenCue = /data-[A-Za-z0-9-]*primary[A-Za-z0-9-]*-screen-cue\b/.test(tag);

            if (!hasAudio || !hasScreenCue) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length,
                    hasAudio,
                    hasScreenCue
                });
            }
        }
    }

    return gaps;
};

const findSignalCueMetadataGaps = (): SignalCueMetadataGap[] => {
    const gaps: SignalCueMetadataGap[] = [];
    const signalCueElementPattern = /<[A-Za-z][^<>]*data-[A-Za-z0-9-]*signal-beats\b[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles()) {
        for (const match of text.matchAll(signalCueElementPattern)) {
            const tag = match[0]!;
            const hasAudio = /data-[A-Za-z0-9-]*signal-audio\b/.test(tag);
            const hasScreenCue = /data-[A-Za-z0-9-]*signal-screen-cue\b/.test(tag);

            if (!hasAudio || !hasScreenCue) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length,
                    hasAudio,
                    hasScreenCue
                });
            }
        }
    }

    return gaps;
};

const findBeatCueMetadataGaps = (): BeatCueMetadataGap[] => {
    const gaps: BeatCueMetadataGap[] = [];
    const patterns: Array<{ kind: BeatCueMetadataGap['kind']; pattern: RegExp }> = [
        { kind: 'burst', pattern: /<[A-Za-z][^<>]*data-[A-Za-z0-9-]*burst-beats\b[^<>]*>/gs },
        { kind: 'lane', pattern: /<[A-Za-z][^<>]*data-[A-Za-z0-9-]*lane-beats\b[^<>]*>/gs },
        { kind: 'payoff', pattern: /<[A-Za-z][^<>]*data-[A-Za-z0-9-]*payoff-beats\b[^<>]*>/gs }
    ];

    for (const { fileName, text } of readComponentSourceFiles()) {
        for (const { kind, pattern } of patterns) {
            for (const match of text.matchAll(pattern)) {
                const tag = match[0]!;
                const hasAudio = /data-[A-Za-z0-9-]*audio\b/.test(tag);
                const hasScreenCue = /data-[A-Za-z0-9-]*screen-cue\b/.test(tag);

                if (!hasAudio || !hasScreenCue) {
                    gaps.push({
                        fileName,
                        lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length,
                        kind,
                        hasAudio,
                        hasScreenCue
                    });
                }
            }
        }
    }

    return gaps;
};

const findBeatFocusMetadataGaps = (): BeatFocusMetadataGap[] => {
    const gaps: BeatFocusMetadataGap[] = [];
    const beatPipPattern = /<[isu]\b[^<>]*\b(data-[A-Za-z0-9-]*-beat)(?=[\s=>])[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(beatPipPattern)) {
            const tag = match[0]!;
            const attr = match[1]!;
            const expectedFocusAttr = `${attr}-focus`;

            if (!tag.includes(expectedFocusAttr)) {
                gaps.push({
                    attr,
                    expectedFocusAttr,
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findHardHiddenFeedbackMaps = (): HardHiddenFeedbackMap[] => {
    const gaps: HardHiddenFeedbackMap[] = [];
    const hardHiddenBlockPattern = /([^{}]+)\{[^{}]*display\s*:\s*none\s*!important[^{}]*\}/g;
    const feedbackMapPattern = /\.(?:[A-Za-z0-9_-]*(?:ShotMap|BeatMap|CadenceMap|LaneBeatMap))/;

    for (const { fileName, text } of readComponentCssFiles()) {
        for (const match of text.matchAll(hardHiddenBlockPattern)) {
            const selector = match[1]!.trim();
            if (feedbackMapPattern.test(selector)) {
                gaps.push({ fileName, selector });
            }
        }
    }

    return gaps;
};

const findScreenCueSelectorGaps = (): ScreenCueSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const gaps: ScreenCueSelectorGap[] = [];

    for (const { fileName, text } of readComponentSourceFiles()) {
        for (const match of text.matchAll(/\b(data-[A-Za-z0-9-]*screen-cue)\b/g)) {
            const attr = match[1]!;
            if (!cssText.includes(`[${attr}`)) {
                gaps.push({
                    attr,
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findAudioScreenCueMetadataGaps = (): AudioScreenCueMetadataGap[] => {
    const gaps: AudioScreenCueMetadataGap[] = [];

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(/\b(data-[A-Za-z0-9-]*audio)\b/g)) {
            const attr = match[1]!;
            const expectedScreenCueAttr = attr.replace(/-audio$/, '-screen-cue');
            if (!text.includes(expectedScreenCueAttr)) {
                gaps.push({
                    attr,
                    expectedScreenCueAttr,
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findActionFeedbackLaneRoleSelectorGaps = (): ActionFeedbackLaneRoleSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const roleContracts: Record<string, readonly string[]> = {
        'data-action-feedback-primary-lane-role': ['Cashout', 'Protect', 'Recover', 'Route', 'Trait'],
        'data-action-feedback-primary-lane-role-id': ['cashout', 'protect', 'recover', 'route', 'trait'],
        'data-action-feedback-lane-role': ['Cashout', 'Protect', 'Recover', 'Route', 'Trait'],
        'data-action-feedback-lane-role-id': ['cashout', 'protect', 'recover', 'route', 'trait']
    };

    return Object.entries(roleContracts).flatMap(([attr, roles]) =>
        roles
            .filter((role) => !cssText.includes(`[${attr}='${role}']`) && !cssText.includes(`[${attr}="${role}"]`))
            .map((role) => ({ attr, role }))
    );
};

const findOpportunityLaneRoleSelectorGaps = (): OpportunityLaneRoleSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const roleContracts: Record<string, readonly string[]> = {
        'data-opportunity-primary-lane-role': ['Cashout', 'Claim', 'Perk', 'Prime', 'Recover', 'Risk', 'Study', 'Tool'],
        'data-opportunity-primary-lane-role-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-lane-role': ['Cashout', 'Claim', 'Perk', 'Prime', 'Recover', 'Risk', 'Study', 'Tool'],
        'data-opportunity-lane-role-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool']
    };

    return Object.entries(roleContracts).flatMap(([attr, roles]) =>
        roles
            .filter((role) => !cssText.includes(`[${attr}='${role}']`) && !cssText.includes(`[${attr}="${role}"]`))
            .map((role) => ({ attr, role }))
    );
};

const findTraitInteractionLaneRoleSelectorGaps = (): TraitInteractionLaneRoleSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const roleAttrs = ['data-trait-interaction-lane-primary-role', 'data-trait-interaction-lane-role'];
    const roles = ['Block', 'Cashout', 'Protect', 'Recall', 'Risk', 'Tool'];

    return roleAttrs.flatMap((attr) =>
        roles
            .filter((role) => !cssText.includes(`[${attr}='${role}']`) && !cssText.includes(`[${attr}="${role}"]`))
            .map((role) => ({ attr, role }))
    );
};

const findVisibleToneSelectorGaps = (): VisibleToneSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const visibleToneContracts: Record<string, readonly string[]> = {
        'data-active-power-action': ['clear', 'pin', 'recall', 'remove', 'swap'],
        'data-active-power-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-active-power-tier': ['control', 'memory', 'route'],
        'data-active-power-tone': ['control', 'recall', 'setup'],
        'data-active-power-step-tone': ['control', 'recall', 'setup'],
        'data-board-chain-reward-lead-tone': ['guard', 'heal', 'reward'],
        'data-chain-armed-perk-tone': ['armed', 'payoff'],
        'data-chain-callout-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-combo-surge-band-tone': ['surge'],
        'data-chain-examples-tone': ['cashout', 'forecast', 'setup'],
        'data-chain-followup-tone': ['route'],
        'data-chain-hot-band-tone': ['cashout', 'ready'],
        'data-chain-hot-band-action': ['cashout', 'hold'],
        'data-chain-hot-band-beats': ['3', '5'],
        'data-chain-hot-band-screen-cue': ['burst', 'guard'],
        'data-chain-hot-band-tier': ['hot', 'ready'],
        'data-chain-lines-tone': ['cashout', 'ready', 'setup'],
        'data-chain-accessibility-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-meter-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-meter-route-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-milestone-screen-cue': ['burst', 'pulse', 'tick'],
        'data-chain-milestone-tier': ['build', 'cashout', 'hold', 'prime'],
        'data-chain-milestone-tone': ['building', 'chain', 'combo', 'surge'],
        'data-chain-momentum-tone': ['cashout', 'followup', 'ready', 'setup', 'surge'],
        'data-chain-next-action-tone': ['cashout', 'ready', 'setup'],
        'data-chain-opportunity-callout-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-opportunity-milestone-screen-cue': ['burst', 'pulse', 'tick'],
        'data-chain-opportunity-milestone-tier': ['build', 'cashout', 'hold', 'prime'],
        'data-chain-opportunity-milestone-tone': ['building', 'chain', 'combo', 'surge'],
        'data-chain-opportunity-next-action-tone': ['cashout', 'ready', 'setup'],
        'data-chain-opportunity-tone': ['ready', 'setup'],
        'data-chain-opportunity-surge-tone': ['surge'],
        'data-chain-reward-hot-tone': ['cashout'],
        'data-chain-reward-tone': ['cashout', 'forecast'],
        'data-chain-reward-urgency-tone': ['cashout', 'forecast'],
        'data-chain-reward-lead-tone': ['guard', 'heal', 'reward'],
        'data-chain-sequence-step-tone': ['cashout', 'followup', 'setup'],
        'data-chain-sequence-tone': ['cashout', 'followup', 'setup'],
        'data-chain-surge-band-tone': ['surge'],
        'data-chain-surge-band-action': ['surge'],
        'data-chain-surge-band-beats': ['4'],
        'data-chain-surge-band-screen-cue': ['burst'],
        'data-chain-surge-band-tier': ['combo'],
        'data-chain-target-plan-tone': ['cashout', 'ready', 'setup'],
        'data-chain-target-tone': ['cashout', 'ready', 'setup'],
        'data-choice-lane-role-id': ['bank', 'claim', 'prime', 'risk', 'route', 'stack'],
        'data-choice-primary-lane-role-id': ['bank', 'claim', 'prime', 'risk', 'route', 'stack'],
        'data-dungeon-combat-log-tone': ['danger', 'success'],
        'data-dungeon-current-tone': ['boss', 'danger', 'mystery', 'neutral', 'reward', 'safe'],
        'data-dungeon-node-tone': ['boss', 'danger', 'mystery', 'neutral', 'reward', 'safe'],
        'data-dungeon-status-chip-tone': ['danger', 'info', 'neutral', 'success', 'warning'],
        'data-forecast-action-tone': ['action', 'defense', 'risk'],
        'data-forecast-signal-tone': ['action', 'defense', 'risk'],
        'data-objective-signal-tone': ['objective', 'progress', 'reward', 'risk'],
        'data-action-feedback-detail': ['chain', 'guard', 'objective', 'reward', 'risk', 'trait'],
        'data-hud-action-lane': ['cash', 'chain', 'recover', 'route', 'utility'],
        'data-hud-action-stack': ['chain', 'combo', 'reward', 'risk', 'trait'],
        'data-hud-action-stack-summary': ['chain', 'combo', 'reward', 'risk', 'trait'],
        'data-hud-action-stack-tone': ['build', 'cashout', 'reward', 'risk', 'trait'],
        'data-impact-tone': ['cosmetic', 'deferred', 'owned', 'ready'],
        'data-opportunity-payoff-stack-tone': ['build', 'cashout', 'followup', 'setup'],
        'data-opportunity-payoff-stack-cue-id': ['cashout', 'followup', 'prime', 'super'],
        'data-opportunity-tone': [
            'chain',
            'control',
            'hazard',
            'lost-reward',
            'perk',
            'pickup',
            'recall',
            'recover',
            'risk',
            'setup',
            'trait'
        ],
        'data-opportunity-best-tone': [
            'chain',
            'control',
            'hazard',
            'lost-reward',
            'perk',
            'pickup',
            'recall',
            'recover',
            'risk',
            'setup',
            'trait'
        ],
        'data-opportunity-compass-best-tone': [
            'chain',
            'control',
            'hazard',
            'lost-reward',
            'perk',
            'pickup',
            'recall',
            'recover',
            'risk',
            'setup',
            'trait'
        ],
        'data-opportunity-compass-summary-tone': [
            'chain',
            'control',
            'hazard',
            'lost-reward',
            'perk',
            'pickup',
            'recall',
            'recover',
            'risk',
            'setup',
            'trait'
        ],
        'data-payoff-stack-tone': ['build', 'cashout', 'followup', 'setup'],
        'data-payoff-stack-cue-id': ['cashout', 'followup', 'prime', 'super'],
        'data-payoff-burst-tone': ['build', 'chain', 'reward', 'risk'],
        'data-payoff-burst-stack-tone': ['chain', 'reward', 'super'],
        'data-payoff-sequence-tone': ['chain', 'reward', 'super'],
        'data-pickup-sequence-tone': ['cashout', 'reward'],
        'data-pickup-sequence-phase-tone': ['cashout', 'reward'],
        'data-pickup-sequence-value-tone': ['cashout', 'reward'],
        'data-preview-density-tone': ['cashout', 'hazard', 'ready', 'setup', 'surge', 'trait'],
        'data-preview-action-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-preview-cashout-tone': ['cashout'],
        'data-preview-line-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-preview-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-primary-reward-tone': ['guard', 'heal', 'reward'],
        'data-payoff-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-payoff-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-reward-perk-lane-role-id': ['cashout', 'control', 'key', 'prime', 'route', 'trait'],
        'data-reward-perk-primary-lane-role-id': ['control', 'key', 'prime', 'trait'],
        'data-recent-run-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-recent-run-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-run-payoff-tone': ['build', 'chain', 'reward', 'risk'],
        'data-run-payoff-burst-tone': ['chain', 'reward', 'super'],
        'data-run-payoff-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-run-payoff-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-run-payoff-sequence-tone': ['chain', 'reward', 'super'],
        'data-match-payoff-primary-lane-tone': ['chain', 'pickup', 'reward', 'route', 'trait'],
        'data-momentum-recap-tone': ['build', 'chain', 'reward', 'risk'],
        'data-route-next-action-tone': ['build', 'memory', 'reward', 'risk', 'route'],
        'data-route-primary-payoff-tone': ['build', 'memory', 'reward', 'risk', 'route'],
        'data-route-recommendation-tone': ['memory'],
        'data-shop-offer-lane-role-id': ['bank', 'buy', 'cashout', 'open', 'prime', 'stack'],
        'data-shop-primary-offer-lane-role-id': ['bank', 'buy', 'cashout', 'open', 'prime', 'stack'],
        'data-power-intent': ['combo', 'control', 'empty', 'locked', 'recall', 'reward'],
        'data-power-payoff': ['combo', 'control', 'empty', 'locked', 'recall'],
        'data-power-recommendation': ['best-tool', 'route-setup'],
        'data-power-role': ['control', 'recall', 'risk', 'search'],
        'data-tool-payoff-stack-tone': ['combo', 'control', 'empty', 'locked', 'recall'],
        'data-trait-mode-action': ['cashout', 'followup', 'match', 'prime', 'surge'],
        'data-trait-mode-screen-cue': ['burst', 'pulse', 'tick'],
        'data-trait-mode-tier': ['cashout', 'prime', 'route', 'surge'],
        'data-trait-mode-tone': ['cashout', 'ready', 'setup', 'surge']
    };

    return Object.entries(visibleToneContracts).flatMap(([attr, values]) =>
        values
            .filter((value) => !cssText.includes(`[${attr}='${value}']`) && !cssText.includes(`[${attr}="${value}"]`))
            .map((value) => ({ attr, value }))
    );
};

const findVisibleStateSelectorGaps = (): VisibleStateSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const visibleStateContracts: Record<string, readonly string[]> = {
        'data-board-chain-reward-focus': ['primary', 'support'],
        'data-board-chain-reward-ladder-focus': ['next', 'soon'],
        'data-board-chain-reward-ladder-summary-action': ['cashout', 'hold', 'prime'],
        'data-board-chain-reward-ladder-summary-beats': ['2', '3', '4', '5'],
        'data-board-chain-reward-ladder-summary-screen-cue': ['burst', 'pulse', 'tick'],
        'data-board-chain-reward-ladder-summary-tier': ['later', 'next', 'soon'],
        'data-board-chain-reward-lead-tier': ['later', 'next', 'soon'],
        'data-board-chain-reward-screen-cue': ['burst', 'pulse', 'tick'],
        'data-board-chain-reward-lead-screen-cue': ['burst', 'pulse', 'tick'],
        'data-board-chain-reward-urgency': ['later', 'next', 'soon'],
        'data-active-power-step': ['first', 'then'],
        'data-active-power-step-beat-phase': ['first', 'then'],
        'data-hud-priority': ['secondary', 'tertiary'],
        'data-card-beat-tier': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-beat-primary-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-beat-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-beat-map-summary-action': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-beat-map-summary-beats': ['2', '3', '4', '5'],
        'data-card-beat-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-beat-map-summary-tier': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-cadence': ['cashout', 'follow-up', 'prime', 'route', 'surge'],
        'data-card-cadence-primary-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-map-summary-action': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-map-summary-beats': ['2', '3', '4', '5'],
        'data-card-cadence-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-cadence-map-summary-tier': ['cashout', 'follow-up', 'prime', 'route', 'surge'],
        'data-card-action-primary-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-feedback-primary-action-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-primary-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-summary-action': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-summary-beats': ['2', '3', '4', '5'],
        'data-chain-shot-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-chain-shot-map-summary-tier': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-feedback-trait-lane-primary-role': ['Block', 'Cashout', 'Protect', 'Recall', 'Risk', 'Tool'],
        'data-card-feedback-trait-lane-primary-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-feedback-trait-lane-primary-screen-cue': ['burst', 'guard', 'pulse', 'risk'],
        'data-card-feedback-primary-beat': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-feedback-primary-cadence': ['cashout', 'follow-up', 'prime', 'route', 'surge'],
        'data-card-feedback-primary-shot-focus': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-feedback-primary-shot-screen-cue': ['burst', 'guard', 'pulse'],
        'data-card-primary-shot-focus': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-primary-shot-screen-cue': ['burst', 'guard', 'pulse'],
        'data-card-trait-lane-primary-screen-cue': ['burst', 'guard', 'pulse', 'risk'],
        'data-card-trait-lane-primary-role': ['Block', 'Cashout', 'Protect', 'Recall', 'Risk', 'Tool'],
        'data-card-trait-lane-primary-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-primary-role': ['Block', 'Cashout', 'Protect', 'Recall', 'Risk', 'Tool'],
        'data-card-trait-lane-beat-primary-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-role': ['Block', 'Cashout', 'Protect', 'Recall', 'Risk', 'Tool'],
        'data-card-trait-lane-beat-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-screen-cue': ['burst', 'guard', 'pulse', 'risk'],
        'data-card-trait-lane-beat-map-summary-action': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-map-summary-beats': ['2', '3', '4', '5'],
        'data-card-trait-lane-beat-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'risk'],
        'data-card-trait-lane-beat-map-summary-tier': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-map-summary-pip-action': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-trait-interaction-lane-primary-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-trait-interaction-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-action-priority-focus': ['primary', 'support'],
        'data-card-action-primary-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-card-action-primary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-action-priority-summary-action': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority-summary-beats': ['2', '3', '4', '5'],
        'data-card-action-priority-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-action-priority-summary-tier': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority': ['bank-lane', 'build-lane', 'cash-now', 'follow-up', 'perk-cash', 'route-setup'],
        'data-card-action-priority-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-card-action-priority-role-id': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-action-primary-role-id': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-feedback-primary-action-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-card-feedback-primary-action-role-id': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-feedback-primary-action-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-beat-focus': ['primary', 'support'],
        'data-card-beat-primary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-beat-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-cadence-focus': ['primary', 'support'],
        'data-card-cadence-primary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-cadence-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-trait-lane-beat-focus': ['primary', 'support'],
        'data-chain-priority': ['best', 'followup', 'ready', 'setup'],
        'data-chain-beat-tier': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-chain-beat-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-chain-followup-screen-cue': ['pulse'],
        'data-chain-marker-key-action': ['cashout', 'followup', 'perk', 'prime', 'route', 'surge'],
        'data-chain-marker-key-beats': ['2', '3', '4', '5'],
        'data-chain-marker-key-screen-cue': ['burst', 'pulse', 'tick'],
        'data-chain-marker-key-tier': ['cashout', 'perk', 'ready', 'setup', 'stack', 'surge'],
        'data-chain-marker-focus': ['primary', 'support'],
        'data-chain-marker-intensity-chip': ['cashout', 'ready', 'setup', 'stack', 'surge'],
        'data-chain-momentum-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-chain-momentum-tier': ['hot', 'primed', 'ready', 'setup'],
        'data-chain-marker-shape': [
            'combo-surge',
            'followup-target',
            'linked-route',
            'payoff-bar',
            'payoff-stack',
            'perk-armed-bar',
            'swap-target-crossbar'
        ],
        'data-chain-next-action': ['cashout', 'follow-up', 'match-route', 'prime-route'],
        'data-chain-next-action-tier': ['now', 'prime', 'route', 'tap'],
        'data-chain-opportunity-next-action': ['cashout', 'follow-up', 'match-route', 'prime-route'],
        'data-chain-opportunity-reward-urgency-tier': ['later', 'next', 'soon'],
        'data-chain-reward-urgency': ['later', 'next', 'soon'],
        'data-chain-reward-urgency-screen-cue': ['burst', 'pulse', 'tick'],
        'data-chain-reward-urgency-tier': ['later', 'next', 'soon'],
        'data-chain-opportunity-beat-action-id': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-chain-beat-action-id': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-chain-opportunity-beat-pip-action': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-chain-opportunity-beat-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-chain-opportunity-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-chain-opportunity-surge-screen-cue': ['burst'],
        'data-chain-reward-screen-cue': ['pulse', 'super'],
        'data-chain-shot-map-focus': ['primary', 'support'],
        'data-chain-shot-map-lane': ['bank-lane', 'build-lane', 'cash-now', 'follow-up', 'perk-cash', 'route-setup'],
        'data-chain-shot-map-primary-role-id': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-primary-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-chain-shot-map-primary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-chain-shot-map-role-id': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-chain-shot-map-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-chain-lines-action': ['cashout', 'follow-up', 'match-route', 'prime-route'],
        'data-chain-lines-tier': ['now', 'prime', 'route', 'tap'],
        'data-chain-target-action': ['cashout', 'follow-up', 'match-route', 'prime-route'],
        'data-chain-target-plan-action': ['cashout', 'follow-up', 'match-route', 'prime-route'],
        'data-chain-target-plan-tier': ['now', 'prime', 'route', 'tap'],
        'data-chain-target-tier': ['now', 'prime', 'route', 'tap'],
        'data-dungeon-node-status': ['cleared', 'current', 'hidden', 'locked', 'revealed', 'skipped'],
        'data-forecast-action-beats': ['2', '3', '4'],
        'data-forecast-action-screen-cue': ['guard', 'pulse', 'risk'],
        'data-forecast-signal-beats': ['2', '3', '4'],
        'data-forecast-signal-screen-cue': ['guard', 'pulse', 'risk'],
        'data-hud-risk-wager-beats': ['3', '4'],
        'data-hud-risk-wager-screen-cue': ['guard', 'risk'],
        'data-impact-level': ['high', 'low', 'medium'],
        'data-burst-tier': ['chain', 'combo', 'reward', 'risk', 'trait'],
        'data-impact-screen-cue': ['burst', 'guard', 'pulse', 'recover', 'risk'],
        'data-hud-action-impact-beats': ['2', '3', '4'],
        'data-hud-action-impact-screen-cue': ['burst', 'guard', 'pulse', 'recover', 'risk'],
        'data-hud-action-stack-beats': ['2', '3', '4'],
        'data-hud-action-lane-beats': ['2', '3', '4'],
        'data-hud-action-lane-focus': ['primary', 'support'],
        'data-hud-action-lane-screen-cue': ['burst', 'guard', 'pulse', 'recover'],
        'data-hud-action-primary-lane-beats': ['2', '3', '4'],
        'data-hud-action-primary-lane-screen-cue': ['burst', 'guard', 'pulse', 'recover'],
        'data-hazard-opportunity-action': ['avoid', 'claim', 'inspect', 'weigh'],
        'data-hazard-opportunity-family': ['dual', 'penalty', 'reward'],
        'data-hazard-opportunity-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-hazard-opportunity-tier': ['danger', 'mixed', 'reward', 'watch'],
        'data-hazard-opportunity-trigger': ['flip', 'match', 'match_or_mismatch', 'mismatch'],
        'data-match-trait-primary-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-match-trait-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-status': ['in_progress', 'missing', 'owned'],
        'data-opportunity-best-heat': ['cashout', 'normal', 'prime', 'surge'],
        'data-opportunity-best-action-id': [
            'cashout',
            'claim',
            'followup',
            'match',
            'prime',
            'recover',
            'risk',
            'route',
            'study',
            'tool'
        ],
        'data-opportunity-best-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-opportunity-compass-best-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-opportunity-compass-hot': ['cashout', 'ready'],
        'data-opportunity-compass-heat': ['cashout', 'normal', 'prime', 'surge'],
        'data-opportunity-compass-priority': ['best', 'single'],
        'data-opportunity-compass-summary-action': ['cashout', 'claim', 'prime', 'recover', 'risk', 'route', 'tool'],
        'data-opportunity-compass-summary-beat-action': ['cashout', 'claim', 'prime', 'recover', 'risk', 'route', 'tool'],
        'data-opportunity-compass-summary-beats': ['2', '3', '4', '5'],
        'data-opportunity-compass-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-opportunity-compass-summary-tier': ['cashout', 'prime', 'recover', 'risk', 'route', 'tool'],
        'data-opportunity-compass-surge': ['true'],
        'data-opportunity-heat': ['cashout', 'normal', 'prime', 'surge'],
        'data-opportunity-action-id': [
            'cashout',
            'claim',
            'followup',
            'match',
            'prime',
            'recover',
            'risk',
            'route',
            'study',
            'tool'
        ],
        'data-opportunity-impact-cue-id': [
            'avoid-penalty',
            'chain-cashout',
            'combo-surge',
            'perk-armed',
            'pickup-cashout',
            'prime-cashout',
            'rebuild-chase',
            'recover-route',
            'route-cashout',
            'safe-pair',
            'save-cashout',
            'stack-cashout',
            'stack-prime',
            'super-stack',
            'trait-combo-surge',
            'trait-stack-surge'
        ],
        'data-objective-signal-beats': ['2', '3', '4'],
        'data-objective-signal-screen-cue': ['burst', 'guard', 'pulse', 'snap', 'tick'],
        'data-opportunity-lane-map-action': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-lane-map-beats': ['2', '3', '4', '5'],
        'data-opportunity-lane-map-screen-cue': ['burst', 'guard', 'pulse', 'recover', 'risk'],
        'data-opportunity-lane-map-tier': ['build', 'cashout', 'recover', 'reward', 'risk', 'tool'],
        'data-opportunity-lane-action-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-lane-role-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-payoff-crescendo-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-opportunity-payoff-crescendo-tier': ['cashout', 'prime', 'stack', 'super'],
        'data-opportunity-primary-lane-action-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-primary-lane-focus': ['build', 'cashout', 'recover', 'reward', 'risk', 'tool'],
        'data-opportunity-primary-lane-role-id': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-primary-lane-screen-cue': ['burst', 'guard', 'pulse', 'recover', 'risk'],
        'data-opportunity-lane-screen-cue': ['burst', 'guard', 'pulse', 'recover', 'risk'],
        'data-opportunity-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-payoff-stack-crescendo-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-payoff-stack-crescendo-tier': ['cashout', 'prime', 'stack', 'super'],
        'data-payoff-burst-screen-cue': ['burst', 'guard', 'pulse', 'snap'],
        'data-payoff-crescendo-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-payoff-crescendo-tier': ['cashout', 'prime', 'stack', 'super'],
        'data-payoff-primary-lane-screen-cue': ['burst', 'build', 'cashout', 'risk'],
        'data-payoff-lane-screen-cue': ['burst', 'build', 'cashout', 'risk'],
        'data-payoff-stack-heat': ['cashout', 'prime'],
        'data-pickup-opportunity-focus': ['cashout', 'reward'],
        'data-pickup-opportunity-action': ['bank', 'cashout', 'stack'],
        'data-pickup-opportunity-beats': ['3', '4'],
        'data-pickup-opportunity-screen-cue': ['burst', 'pulse', 'tick'],
        'data-pickup-opportunity-tier': ['cashout', 'multi', 'reward'],
        'data-pickup-sequence-beat-phase': ['first', 'keep', 'then'],
        'data-pickup-sequence-phase': ['first', 'keep', 'then'],
        'data-pickup-sequence-value-phase': ['first', 'keep', 'then'],
        'data-preview-action-kind': ['hazard', 'pickup', 'trait'],
        'data-preview-cashout-kind': ['trait'],
        'data-preview-kind': ['hazard', 'pickup', 'trait'],
        'data-preview-line-kind': ['hazard', 'pickup', 'trait'],
        'data-preview-line-focus': ['primary', 'support'],
        'data-preview-screen-cue': ['burst', 'guard', 'pulse', 'snap'],
        'data-preview-summary-action': ['combo', 'reward', 'risk', 'stack'],
        'data-preview-summary-density-tone': ['cashout', 'hazard', 'ready', 'setup', 'surge', 'trait'],
        'data-preview-summary-kind': ['hazard', 'pickup', 'trait'],
        'data-preview-summary-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-primary-reward-beats': ['2', '3', '4'],
        'data-primary-reward-screen-cue': ['burst', 'pulse', 'tick'],
        'data-primary-reward-urgency': ['later', 'next', 'soon'],
        'data-trap-resolution-screen-cue': ['burst', 'pulse', 'snap'],
        'data-trait-interaction-lane-focus': ['primary', 'support'],
        'data-run-payoff-screen-cue': ['burst', 'guard', 'pulse', 'snap'],
        'data-run-payoff-crescendo-screen-cue': ['burst', 'pulse', 'snap', 'super'],
        'data-run-payoff-crescendo-tier': ['cashout', 'prime', 'stack', 'super'],
        'data-run-payoff-primary-lane-screen-cue': ['burst', 'build', 'cashout', 'risk'],
        'data-run-payoff-lane-screen-cue': ['burst', 'build', 'cashout', 'risk'],
        'data-mode-lane-role-id': ['build', 'locked', 'practice', 'pressure', 'reward'],
        'data-mode-primary-lane-role-id': ['build', 'locked', 'practice', 'pressure', 'reward'],
        'data-loop-cue-tone': ['build', 'chain', 'locked', 'practice', 'pressure', 'route'],
        'data-mode-signal-tone': ['constraint', 'locked', 'pace', 'payoff', 'practice', 'pressure'],
        'data-start-action-tone': ['build', 'chain', 'locked', 'practice', 'pressure', 'route'],
        'data-power-payoff-beats': ['0', '1', '2', '3', '4'],
        'data-power-screen-cue': ['burst', 'guard', 'locked', 'none', 'pulse', 'snap'],
        'data-mode-signal-beats': ['2', '3', '4'],
        'data-mode-signal-screen-cue': ['burst', 'guard', 'locked', 'pulse', 'snap'],
        'data-mode-primary-lane-screen-cue': ['burst', 'guard', 'locked', 'reward', 'snap'],
        'data-tool-crescendo-screen-cue': ['burst', 'none', 'pulse', 'snap'],
        'data-tool-crescendo-tier': ['cashout', 'none', 'prime', 'stack']
    };

    return Object.entries(visibleStateContracts).flatMap(([attr, values]) =>
        values
            .filter((value) => !cssText.includes(`[${attr}='${value}']`) && !cssText.includes(`[${attr}="${value}"]`))
            .map((value) => ({ attr, value }))
    );
};

const findVisiblePrefixSelectorGaps = (): VisiblePrefixSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const visiblePrefixContracts: Record<string, readonly string[]> = {
        'data-card-feedback-primary-card-cue': ['bank-lane:cashout', 'cash-now:cashout', 'perk-cash:cashout']
    };

    return Object.entries(visiblePrefixContracts).flatMap(([attr, prefixes]) =>
        prefixes
            .filter((prefix) => !cssText.includes(`[${attr}^='${prefix}']`) && !cssText.includes(`[${attr}^="${prefix}"]`))
            .map((prefix) => ({ attr, prefix }))
    );
};

const findVisiblePackedValueSelectorGaps = (): VisiblePackedValueSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const visiblePackedValueContracts: Record<string, readonly string[]> = {
        'data-card-feedback-action-cues': ['bank-lane', 'build-lane', 'cash-now', 'follow-up', 'perk-cash', 'route-setup'],
        'data-card-feedback-marker-shapes': [
            'combo-surge',
            'followup-target',
            'linked-route',
            'payoff-bar',
            'payoff-stack',
            'perk-armed-bar',
            'swap-target-crossbar'
        ],
        'data-card-feedback-route-glyphs': [
            'cashout-crown',
            'linked-route',
            'next-tap',
            'payoff-stack',
            'prime-cross',
            'surge-burst'
        ],
        'data-card-feedback-trait-route-intensities': ['cashout', 'ready', 'setup', 'stack', 'surge']
    };

    return Object.entries(visiblePackedValueContracts).flatMap(([attr, values]) =>
        values
            .filter((value) => !cssText.includes(`[${attr}*='${value}:']`) && !cssText.includes(`[${attr}*="${value}:"]`))
            .map((value) => ({ attr, value }))
    );
};

const findMeterFillVariableGaps = (): MeterFillVariableGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const gaps: MeterFillVariableGap[] = [];

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        const attrs = new Set([...text.matchAll(/\b(data-[A-Za-z0-9-]*-meter-fill)\b/g)].map((match) => match[1]!));

        for (const attr of attrs) {
            const cssVariable = `--${attr.slice('data-'.length)}`;
            if (cssText.includes(cssVariable) && !text.includes(cssVariable)) {
                gaps.push({ attr, cssVariable, fileName });
            }
        }
    }

    return gaps;
};

const findProgressReadabilityGaps = (): ProgressReadabilityGap[] => {
    const gaps: ProgressReadabilityGap[] = [];
    const progressElementPattern =
        /<[A-Za-z][^<>]*\bdata-[A-Za-z0-9-]*progress(?:-[A-Za-z0-9-]+)?\b[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(progressElementPattern)) {
            const tag = match[0]!;
            const hasReadableContract =
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\brole=(?:"progressbar"|'progressbar')/.test(tag);

            if (!hasReadableContract) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findFeedbackSummaryReadabilityGaps = (): FeedbackSummaryReadabilityGap[] => {
    const gaps: FeedbackSummaryReadabilityGap[] = [];
    const feedbackSummaryElementPattern =
        /<[A-Za-z][^<>]*\bdata-testid=(?:"([^"]*summary[^"]*)"|\{`([^`]*summary[^`]*)`\})[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(feedbackSummaryElementPattern)) {
            const tag = match[0]!;
            const testId = match[1] ?? match[2] ?? 'summary';
            const carriesFeedbackState =
                /\bdata-[A-Za-z0-9-]*(?:action|priority|urgency|heat|tier|tone|screen-cue|meter-fill|fill|count)\b/.test(tag);
            const hasReadableContract =
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\btitle=/.test(tag);

            if (carriesFeedbackState && !hasReadableContract) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length,
                    testId
                });
            }
        }
    }

    return gaps;
};

const findNamedFeedbackCueReadabilityGaps = (): NamedFeedbackCueReadabilityGap[] => {
    const gaps: NamedFeedbackCueReadabilityGap[] = [];
    const namedFeedbackCueElementPattern =
        /<[A-Za-z][^<>]*\bdata-testid=(?:"([^"]*(?:cue|impact|action|crescendo|intensity)[^"]*)"|\{`([^`]*(?:cue|impact|action|crescendo|intensity)[^`]*)`\})[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(namedFeedbackCueElementPattern)) {
            const tag = match[0]!;
            const testId = match[1] ?? match[2] ?? 'feedback-cue';
            const carriesFeedbackState =
                /\bdata-[A-Za-z0-9-]*(?:audio|screen-cue|beats|action|tone|tier|intensity)\b/.test(tag);
            const hasReadableContract =
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\btitle=/.test(tag) ||
                /\baria-hidden="true"/.test(tag);

            if (carriesFeedbackState && !hasReadableContract) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length,
                    testId
                });
            }
        }
    }

    return gaps;
};

const findCardFeedbackRowReadabilityGaps = (): CardFeedbackRowReadabilityGap[] => {
    const gaps: CardFeedbackRowReadabilityGap[] = [];
    const cardFeedbackRowElementPattern = /<[A-Za-z][^<>]*\bdata-card-[A-Za-z0-9-]+[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(cardFeedbackRowElementPattern)) {
            const tag = match[0]!;
            if (/\bpip\b/.test(tag) || /\baria-hidden="true"/.test(tag)) {
                continue;
            }

            const carriesRowFeedbackState =
                /\bdata-card-[A-Za-z0-9-]*(?:action|role|screen-cue|tone|tier|cadence|beat)\b/.test(tag);
            const hasReadableContract =
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\btitle=/.test(tag);

            if (carriesRowFeedbackState && !hasReadableContract) {
                gaps.push({
                    attrs: [...tag.matchAll(/\bdata-card-[A-Za-z0-9-]+/g)].map((attrMatch) => attrMatch[0]!),
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findPlaySurfaceLaneRowReadabilityGaps = (): PlaySurfaceLaneRowReadabilityGap[] => {
    const gaps: PlaySurfaceLaneRowReadabilityGap[] = [];
    const activePlaySurfaceFiles = new Set(['GameScreen.tsx', 'GameplayHudBar.tsx', 'TileBoard.tsx']);
    const rowAttrPattern =
        /\bdata-(?:reward-perk-lane|chain-reward-lane|chain-reward-ladder|chain-reward-arcade|hud-action-lane|match-payoff-lane|match-trait-lane|mismatch-recovery-lane|trait-interaction-lane|opportunity-lane)(?:=|-action\b|-audio\b|-beats\b|-count\b|-role\b|-role-id\b|-screen-cue\b|-tone\b|-urgency\b|-filled\b|-total\b)/;
    const ignoredRowPattern = /summary|primary|map|actions|roles|role-ids|pip|\baria-hidden="true"/;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => activePlaySurfaceFiles.has(fileName))) {
        for (const match of text.matchAll(/<[A-Za-z][^<>]*>/gs)) {
            const tag = match[0]!;
            const hasReadableContract =
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\btitle=/.test(tag);

            if (rowAttrPattern.test(tag) && !ignoredRowPattern.test(tag) && !hasReadableContract) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const findMeterReadabilityGaps = (): MeterReadabilityGap[] => {
    const gaps: MeterReadabilityGap[] = [];
    const meterElementPattern = /<[A-Za-z][^<>]*\bdata-[A-Za-z0-9-]*(?:meter-fill|fill)\b[^<>]*>/gs;

    for (const { fileName, text } of readComponentSourceFiles().filter(({ fileName }) => !fileName.includes('.test.'))) {
        for (const match of text.matchAll(meterElementPattern)) {
            const tag = match[0]!;
            const hasReadableContract =
                /\brole="progressbar"/.test(tag) ||
                /\baria-label=/.test(tag) ||
                /\baria-labelledby=/.test(tag) ||
                /\btitle=/.test(tag) ||
                /\baria-hidden="true"/.test(tag);

            if (!hasReadableContract) {
                gaps.push({
                    fileName,
                    lineNumber: text.slice(0, match.index ?? 0).split(/\r?\n/).length
                });
            }
        }
    }

    return gaps;
};

const selectorHasDeclaration = (
    text: string,
    className: string,
    element: 'i' | 's' | 'u',
    declaration: string
): boolean => {
    const selectorPattern = new RegExp(`\\.${escapeRegExp(className)}\\s+${element}(?=[\\s,{])`, 'g');

    for (const match of text.matchAll(selectorPattern)) {
        const selectorStart = match.index ?? 0;
        const blockStart = text.indexOf('{', selectorStart);
        const blockEnd = blockStart >= 0 ? text.indexOf('}', blockStart) : -1;
        if (blockStart >= 0 && blockEnd >= 0 && text.slice(blockStart + 1, blockEnd).includes(`${declaration}:`)) {
            return true;
        }
    }

    return false;
};

describe('feedback beat pip CSS coverage', () => {
    it('keeps beat pip indicators animated and reduced-motion safe', () => {
        const cssFiles = readComponentCssFiles();
        const textByFile = new Map(cssFiles.map(({ fileName, text }) => [fileName, text]));
        const rules = findBeatPipRules();
        const rulesByClassName = new Map<string, BeatPipRule[]>();

        expect(rules.length).toBeGreaterThan(0);

        for (const rule of rules) {
            rulesByClassName.set(rule.className, [...(rulesByClassName.get(rule.className) ?? []), rule]);
        }

        for (const className of findBeatPipUsages()) {
            expect(rulesByClassName.get(className)?.length ?? 0, `${className} should have beat pip CSS coverage`).toBeGreaterThan(0);
        }

        for (const rule of rules) {
            const text = textByFile.get(rule.fileName)!;
            expect(
                selectorHasDeclaration(text, rule.className, rule.element, 'animation'),
                `${rule.fileName} .${rule.className} ${rule.element} should have animation coverage`
            ).toBe(true);
            expect(
                text.includes(`[data-reduce-motion='true']) .${rule.className} ${rule.element}`) ||
                    text.includes(`[data-reduce-motion="true"]) .${rule.className} ${rule.element}`),
                `${rule.fileName} .${rule.className} ${rule.element} should have app reduced-motion coverage`
            ).toBe(true);
        }
    });

    it('keeps primary feedback cue elements paired with audio and screen-cue metadata', () => {
        expect(
            findPrimaryCueMetadataGaps(),
            'primary cue elements with action/beats metadata should expose matching audio and screen-cue metadata'
        ).toEqual([]);
    });

    it('keeps signal cue rows paired with audio and screen-cue metadata', () => {
        expect(
            findSignalCueMetadataGaps(),
            'signal rows with beat metadata should expose matching audio and screen-cue metadata'
        ).toEqual([]);
    });

    it('keeps lane, payoff, and burst beat cues paired with audio and screen-cue metadata', () => {
        expect(
            findBeatCueMetadataGaps(),
            'lane, payoff, and burst rows with beat metadata should expose matching audio and screen-cue metadata'
        ).toEqual([]);
    });

    it('keeps beat pip elements marked with primary/support focus metadata', () => {
        expect(
            findBeatFocusMetadataGaps(),
            'beat pip elements should expose primary/support focus metadata so CSS can emphasize the lead beat'
        ).toEqual([]);
    });

    it('keeps emitted screen-cue metadata wired to CSS selectors', () => {
        expect(
            findScreenCueSelectorGaps(),
            'screen-cue attributes should have a matching CSS selector so cue metadata becomes visible feedback'
        ).toEqual([]);
    });

    it('keeps pickup opportunity 3-beat and 4-beat cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".pickupOpportunityChip[data-pickup-opportunity-beats='3'] .pickupOpportunityChipBeatPips i");
        expect(cssText).toContain(".pickupOpportunityChip[data-pickup-opportunity-beats='4'] .pickupOpportunityChipBeatPips i");
        expect(
            cssText,
            '3-beat pickup cues should be softer than 4-beat pickup cues'
        ).toMatch(/data-pickup-opportunity-beats='3'[\s\S]*?opacity:\s*0\.78/);
        expect(
            cssText,
            '4-beat pickup cues should read hotter than 3-beat pickup cues'
        ).toMatch(/data-pickup-opportunity-beats='4'[\s\S]*?animation-duration:\s*0\.82s/);
    });

    it('keeps pickup opportunity meters visually distinct by payoff state', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout pickup meters should read as immediate reward progress'
        ).toMatch(/data-pickup-opportunity-focus='cashout'[\s\S]*?\.pickupOpportunityMeterFill[\s\S]*?var\(--theme-success\) 70%/);
        expect(
            cssText,
            'multi pickup meters should read as stack-building progress'
        ).toMatch(/data-pickup-opportunity-tier='multi'[\s\S]*?\.pickupOpportunityMeterFill[\s\S]*?var\(--theme-cyan-bright\) 58%/);
        expect(
            cssText,
            'bank pickup meters should read as calmer reward progress'
        ).toMatch(/data-pickup-opportunity-action='bank'[\s\S]*?\.pickupOpportunityMeterFill[\s\S]*?var\(--theme-gold-bright\) 56%/);
        expect(
            cssText,
            'quiet pickup meter fills should stay visually calmer'
        ).toMatch(/data-pickup-opportunity-screen-cue='tick'[\s\S]*?\.pickupOpportunityMeterFill[\s\S]*?opacity:\s*0\.82/);
    });

    it('keeps pickup sequence phase and tone beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'first pickup sequence beats should stay quieter and slower'
        ).toMatch(/data-pickup-sequence-beat-phase='first'[\s\S]*?animation-duration:\s*1\.04s/);
        expect(
            cssText,
            'then pickup sequence beats should read as the active step'
        ).toMatch(/data-pickup-sequence-beat-phase='then'[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'keep pickup sequence beats should read as held reward retention'
        ).toMatch(/data-pickup-sequence-beat-phase='keep'[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'cashout pickup sequence beats should be faster than reward upkeep'
        ).toMatch(/data-pickup-sequence-tone='cashout'[\s\S]*?\.pickupOpportunitySequenceBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'reward pickup sequence beats should use calmer success pacing'
        ).toMatch(/data-pickup-sequence-tone='reward'[\s\S]*?\.pickupOpportunitySequenceBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
    });

    it('keeps active power screen cues visually distinct on the board chip', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".activePowerBoardChip[data-active-power-screen-cue='burst'] .activePowerBoardChipBeatPips i");
        expect(cssText).toContain(".activePowerBoardChip[data-active-power-screen-cue='guard'] .activePowerBoardChipBeatPips i");
        expect(cssText).toContain(".activePowerBoardChip[data-active-power-screen-cue='tick'] .activePowerBoardChipBeatPips i");
        expect(
            cssText,
            'burst active power cues should read as fast payoff beats'
        ).toMatch(/data-active-power-screen-cue='burst'[\s\S]*?animation-duration:\s*0\.78s/);
        expect(
            cssText,
            'guard active power cues should read as taller defensive beats'
        ).toMatch(/data-active-power-screen-cue='guard'[\s\S]*?height:\s*0\.24rem/);
        expect(
            cssText,
            'tick active power cues should stay quiet and slower than burst cues'
        ).toMatch(/data-active-power-screen-cue='tick'[\s\S]*?opacity:\s*0\.62/);
    });

    it('keeps active power step tone beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'setup active power steps should use taller slower setup beats'
        ).toMatch(/data-active-power-tone='setup'[\s\S]*?\.activePowerBoardStepBeatPips i[\s\S]*?animation-duration:\s*1\.12s/);
        expect(
            cssText,
            'control active power steps should use quicker wider control beats'
        ).toMatch(/data-active-power-tone='control'[\s\S]*?\.activePowerBoardStepBeatPips i[\s\S]*?animation-duration:\s*0\.82s/);
        expect(
            cssText,
            'recall active power steps should use low route-like recall beats'
        ).toMatch(/data-active-power-tone='recall'[\s\S]*?\.activePowerBoardStepBeatPips i[\s\S]*?height:\s*0\.1rem/);
    });

    it('keeps active power meters visually distinct by armed tool role', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'setup active power meters should read as route-building tools'
        ).toMatch(/data-active-power-tone='setup'[\s\S]*?\.activePowerBoardChipMeter[\s\S]*?var\(--theme-cyan-bright\) 34%/);
        expect(
            cssText,
            'control active power meters should read as board-clearing tools'
        ).toMatch(/data-active-power-tone='control'[\s\S]*?\.activePowerBoardChipMeterFill[\s\S]*?var\(--theme-ember\) 84%/);
        expect(
            cssText,
            'recall active power meters should read as memory-routing tools'
        ).toMatch(/data-active-power-tone='recall'[\s\S]*?\.activePowerBoardChipMeterFill[\s\S]*?var\(--theme-violet-bright\) 82%/);
        expect(
            cssText,
            'guard active power meter tracks should carry caution framing'
        ).toMatch(/data-active-power-screen-cue='guard'[\s\S]*?\.activePowerBoardChipMeter[\s\S]*?var\(--theme-danger\) 30%/);
        expect(
            cssText,
            'quiet tick active power meters should remain calmer'
        ).toMatch(/data-active-power-screen-cue='tick'[\s\S]*?\.activePowerBoardChipMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps toolbar power payoff screen-cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'burst power payoff cues should read as immediate high value'
        ).toMatch(/data-power-screen-cue='burst'[\s\S]*?\.powerPayoffBeatPips i[\s\S]*?animation-duration:\s*0\.66s/);
        expect(
            cssText,
            'snap power payoff cues should read as quick setup actions'
        ).toMatch(/data-power-screen-cue='snap'[\s\S]*?\.powerPayoffBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'pulse power payoff cues should stay readable but quieter'
        ).toMatch(/data-power-screen-cue='pulse'[\s\S]*?\.powerPayoffBeatPips i[\s\S]*?animation-duration:\s*0\.94s/);
        expect(
            cssText,
            'guard power payoff cues should use taller caution beats'
        ).toMatch(/data-power-screen-cue='guard'[\s\S]*?\.powerPayoffBeatPips i[\s\S]*?height:\s*0\.22rem/);
    });

    it('keeps toolbar crescendo tier and screen-cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout tool crescendos should use fast payout beats'
        ).toMatch(/data-tool-crescendo-tier='cashout'[\s\S]*?\.toolCrescendoPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'stack tool crescendos should use the fastest stacked payoff beats'
        ).toMatch(/data-tool-crescendo-tier='stack'[\s\S]*?\.toolCrescendoPips i[\s\S]*?animation-duration:\s*0\.62s/);
        expect(
            cssText,
            'prime tool crescendos should use slower setup beats'
        ).toMatch(/data-tool-crescendo-tier='prime'[\s\S]*?\.toolCrescendoPips i[\s\S]*?animation-duration:\s*0\.98s/);
        expect(
            cssText,
            'burst tool crescendos should use highest-emphasis pips'
        ).toMatch(/data-tool-crescendo-screen-cue='burst'[\s\S]*?\.toolCrescendoPips i[\s\S]*?animation-duration:\s*0\.58s/);
    });

    it('keeps action feedback crescendo tier and screen-cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'prime action feedback crescendos should stay slower and quieter'
        ).toMatch(/data-action-feedback-crescendo-tier='prime'[\s\S]*?\.actionFeedbackCrescendoPips i[\s\S]*?animation-duration:\s*0\.98s/);
        expect(
            cssText,
            'cashout action feedback crescendos should read as fast reward beats'
        ).toMatch(/data-action-feedback-crescendo-tier='cashout'[\s\S]*?\.actionFeedbackCrescendoPips i[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'stack action feedback crescendos should use larger payoff beats'
        ).toMatch(/data-action-feedback-crescendo-tier='stack'[\s\S]*?\.actionFeedbackCrescendoPips i[\s\S]*?height:\s*0\.3rem/);
        expect(
            cssText,
            'super action feedback crescendos should use maxed beat timing'
        ).toMatch(/data-action-feedback-crescendo-tier='super'[\s\S]*?\.actionFeedbackCrescendoPips i[\s\S]*?animation-duration:\s*0\.54s/);
        expect(
            cssText,
            'super screen cues should be the widest fastest action feedback pips'
        ).toMatch(/data-action-feedback-crescendo-screen-cue='super'[\s\S]*?\.actionFeedbackCrescendoPips i[\s\S]*?animation-duration:\s*0\.5s/);
    });

    it('keeps hazard opportunity families visually distinct in beat pips', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'avoid hazard opportunities should read as defensive vertical beats'
        ).toMatch(/data-hazard-opportunity-action='avoid'[\s\S]*?height:\s*0\.24rem/);
        expect(
            cssText,
            'claim hazard opportunities should use quicker reward beat timing'
        ).toMatch(/data-hazard-opportunity-action='claim'[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'weigh hazard opportunities should use wider mixed-choice beats'
        ).toMatch(/data-hazard-opportunity-action='weigh'[\s\S]*?width:\s*0\.22rem/);
    });

    it('keeps dungeon forecast signal beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'risk forecast signals should use urgent taller beats'
        ).toMatch(/data-forecast-signal-tone='risk'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'defense forecast signals should use guarded slower beats'
        ).toMatch(/data-forecast-signal-tone='defense'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'action forecast signals should use readable active pacing'
        ).toMatch(/data-forecast-signal-tone='action'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*0\.86s/);
        expect(
            cssText,
            'guard forecast screen cues should share the defensive beat language'
        ).toMatch(/data-forecast-signal-screen-cue='guard'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*1\.08s/);
        expect(
            cssText,
            'pulse forecast screen cues should share the active beat language'
        ).toMatch(/data-forecast-signal-screen-cue='pulse'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?opacity:\s*0\.9/);
    });

    it('keeps dungeon forecast action cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'risk forecast action cues should use urgent compact beats'
        ).toMatch(/data-forecast-action-tone='risk'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'defense forecast action cues should use guarded slower beats'
        ).toMatch(/data-forecast-action-tone='defense'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'action forecast action cues should use readable active pacing'
        ).toMatch(/data-forecast-action-tone='action'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*0\.84s/);
        expect(
            cssText,
            'guard forecast action screen cues should share defensive beats'
        ).toMatch(/data-forecast-action-screen-cue='guard'[\s\S]*?\.dungeonStatusForecastBeatPips i[\s\S]*?animation-duration:\s*1\.06s/);
    });

    it('keeps run mode signal beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'payoff mode signals should use fast reward beats'
        ).toMatch(/data-mode-signal-tone='payoff'[\s\S]*?\.modeSignalBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'pace mode signals should use active readable beats'
        ).toMatch(/data-mode-signal-tone='pace'[\s\S]*?\.modeSignalBeatPips i[\s\S]*?animation-duration:\s*0\.86s/);
        expect(
            cssText,
            'pressure mode signals should use taller guarded beats'
        ).toMatch(/data-mode-signal-tone='pressure'[\s\S]*?\.modeSignalBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'constraint mode signals should use low snap beats'
        ).toMatch(/data-mode-signal-tone='constraint'[\s\S]*?\.modeSignalBeatPips i[\s\S]*?height:\s*0\.12rem/);
        expect(
            cssText,
            'locked mode signals should stay small and slow'
        ).toMatch(/data-mode-signal-tone='locked'[\s\S]*?\.modeSignalBeatPips i[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps HUD objective signal beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'objective signals should use steady chase-target beats'
        ).toMatch(/data-objective-signal-tone='objective'[\s\S]*?\.hudObjectiveSignalBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'progress signals should use quieter build-up beats'
        ).toMatch(/data-objective-signal-tone='progress'[\s\S]*?\.hudObjectiveSignalBeatPips i[\s\S]*?height:\s*0\.12rem/);
        expect(
            cssText,
            'reward objective signals should use fast payoff beats'
        ).toMatch(/data-objective-signal-tone='reward'[\s\S]*?\.hudObjectiveSignalBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'risk objective signals should use urgent taller beats'
        ).toMatch(/data-objective-signal-tone='risk'[\s\S]*?\.hudObjectiveSignalBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'tick objective screen cues should stay quiet and slow'
        ).toMatch(/data-objective-signal-screen-cue='tick'[\s\S]*?\.hudObjectiveSignalBeatPips i[\s\S]*?animation-duration:\s*1\.32s/);
    });

    it('keeps trait cashout and surge modes visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".traitModeCue[data-trait-mode-tone='cashout']");
        expect(cssText).toContain(".traitModeCue[data-trait-mode-tone='surge']");
        expect(
            cssText,
            'cashout trait mode should preserve gold payout language'
        ).toMatch(/data-trait-mode-action='cashout'[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'surge trait mode should shift to cyan route-building language'
        ).toMatch(/data-trait-mode-action='surge'[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'surge trait mode label should not share the cashout strong color'
        ).toMatch(/data-trait-mode-tone='surge'\] strong[\s\S]*?var\(--theme-cyan-bright\)/);
    });

    it('keeps chain momentum screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityMomentum[data-chain-momentum-screen-cue='burst'] .chainOpportunityMomentumBeatPips i");
        expect(cssText).toContain(".chainOpportunityMomentum[data-chain-momentum-screen-cue='guard'] .chainOpportunityMomentumBeatPips i");
        expect(cssText).toContain(".chainOpportunityMomentum[data-chain-momentum-screen-cue='pulse'] .chainOpportunityMomentumBeatPips i");
        expect(cssText).toContain(".chainOpportunityMomentum[data-chain-momentum-screen-cue='tick'] .chainOpportunityMomentumBeatPips i");
        expect(
            cssText,
            'burst chain momentum should read as urgent cashout timing'
        ).toMatch(/data-chain-momentum-screen-cue='burst'[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'guard chain momentum should use taller defensive beats'
        ).toMatch(/data-chain-momentum-screen-cue='guard'[\s\S]*?height:\s*0\.24rem/);
        expect(
            cssText,
            'pulse chain momentum should sit between burst and tick timing'
        ).toMatch(/data-chain-momentum-screen-cue='pulse'[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'tick chain momentum should stay smaller and quieter'
        ).toMatch(/data-chain-momentum-screen-cue='tick'[\s\S]*?opacity:\s*0\.58/);
    });

    it('keeps chain momentum setup and surge meter language distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'setup momentum should have its own cyan meter fill instead of inheriting ready/surge language'
        ).toMatch(/data-chain-momentum-tone='setup'[\s\S]*?\.chainOpportunityMomentumMeterFill[\s\S]*?var\(--theme-cyan-bright\)/);
        expect(
            cssText,
            'surge momentum should carry violet route-building background language'
        ).toMatch(/data-chain-momentum-tone='surge'[\s\S]*?radial-gradient[\s\S]*?var\(--theme-violet-bright\)/);
    });

    it('keeps top chain cue beats tied to opportunity tone', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'ready chain cues should use fast reward-toned beats'
        ).toMatch(/data-chain-opportunity-tone='ready'[\s\S]*?\.chainOpportunityCueBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'setup chain cues should use taller slower setup beats'
        ).toMatch(/data-chain-opportunity-tone='setup'[\s\S]*?\.chainOpportunityCueBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'cashout next actions should override top cue pips with immediate payout beats'
        ).toMatch(/data-chain-opportunity-next-action='cashout'[\s\S]*?\.chainOpportunityCueBeatPips i[\s\S]*?animation-duration:\s*0\.66s/);
        expect(
            cssText,
            'eyebrow beats should follow the same cashout next-action language'
        ).toMatch(/data-chain-opportunity-next-action='cashout'[\s\S]*?\.chainOpportunityEyebrowBeatPips i[\s\S]*?width:\s*0\.28rem/);
    });

    it('keeps chain next-action meters tied to next-action language', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout next-action meters should read as immediate reward payoff'
        ).toMatch(/data-chain-next-action='cashout'[\s\S]*?\.chainOpportunityNextActionMeterFill[\s\S]*?var\(--theme-gold-bright\) 92%/);
        expect(
            cssText,
            'follow-up next-action meters should keep continuation progress distinct'
        ).toMatch(/data-chain-next-action='follow-up'[\s\S]*?\.chainOpportunityNextActionMeterFill[\s\S]*?var\(--theme-cyan-bright\) 84%/);
        expect(
            cssText,
            'route next-action meters should use violet/cyan route-building language'
        ).toMatch(/data-chain-next-action='match-route'[\s\S]*?\.chainOpportunityNextActionMeterFill[\s\S]*?var\(--theme-violet-bright\) 74%/);
        expect(
            cssText,
            'prime next-action meters should stay quieter than cashout progress'
        ).toMatch(/data-chain-next-action='prime-route'[\s\S]*?\.chainOpportunityNextActionMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps chain marker key action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout marker key beats should read as quick payout beats'
        ).toMatch(/data-chain-marker-key-action='cashout'[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'surge marker key beats should read as faster combo acceleration'
        ).toMatch(/data-chain-marker-key-action='surge'[\s\S]*?animation-duration:\s*0\.62s/);
        expect(
            cssText,
            'route marker key beats should stay horizontal route guidance'
        ).toMatch(/data-chain-marker-key-action='route'[\s\S]*?width:\s*0\.16rem/);
        expect(
            cssText,
            'prime marker key beats should use a taller setup shape than route'
        ).toMatch(/data-chain-marker-key-action='prime'[\s\S]*?height:\s*0\.16rem/);
        expect(
            cssText,
            'perk marker key beats should carry reward utility language'
        ).toMatch(/data-chain-marker-key-action='perk'[\s\S]*?var\(--theme-success\)/);
    });

    it('keeps chain marker key screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityMarkerKeySummary[data-chain-marker-key-screen-cue='burst'] .chainOpportunityMarkerKeySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityMarkerKeySummary[data-chain-marker-key-screen-cue='pulse'] .chainOpportunityMarkerKeySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityMarkerKeySummary[data-chain-marker-key-screen-cue='tick'] .chainOpportunityMarkerKeySummaryBeatPips i");
        expect(
            cssText,
            'burst marker cues should stay high-emphasis'
        ).toMatch(/data-chain-marker-key-screen-cue='burst'[\s\S]*?opacity:\s*0\.98/);
        expect(
            cssText,
            'pulse marker cues should keep mid-tempo guidance'
        ).toMatch(/data-chain-marker-key-screen-cue='pulse'[\s\S]*?animation-duration:\s*0\.94s/);
        expect(
            cssText,
            'tick marker cues should stay quiet and slow'
        ).toMatch(/data-chain-marker-key-screen-cue='tick'[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps chain marker key meters tied to marker action language', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout marker key meters should carry high-payoff gold fill language'
        ).toMatch(/data-chain-marker-key-action='cashout'[\s\S]*?\.chainOpportunityMarkerKeyMeterFill[\s\S]*?var\(--theme-gold-bright\) 90%/);
        expect(
            cssText,
            'surge marker key meters should use violet acceleration language'
        ).toMatch(/data-chain-marker-key-action='surge'[\s\S]*?\.chainOpportunityMarkerKeyMeterFill[\s\S]*?var\(--theme-violet-bright\) 84%/);
        expect(
            cssText,
            'route and followup marker key meters should use cyan pathing language'
        ).toMatch(/data-chain-marker-key-action='route'[\s\S]*?\.chainOpportunityMarkerKeyMeterFill[\s\S]*?var\(--theme-cyan-bright\) 82%/);
        expect(
            cssText,
            'setup marker key meters should stay quieter than ready and cashout states'
        ).toMatch(/data-chain-marker-key-action='prime'[\s\S]*?\.chainOpportunityMarkerKeyMeterFill[\s\S]*?opacity:\s*0\.78/);
        expect(
            cssText,
            'perk marker key meters should carry utility reward language'
        ).toMatch(/data-chain-marker-key-action='perk'[\s\S]*?\.chainOpportunityMarkerKeyMeterFill[\s\S]*?var\(--theme-success\) 72%/);
    });

    it('keeps opportunity compass summary action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout compass summary beats should read as quick payout beats'
        ).toMatch(/data-opportunity-compass-summary-beat-action='cashout'[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'route compass summary beats should stay horizontal guidance'
        ).toMatch(/data-opportunity-compass-summary-beat-action='route'[\s\S]*?width:\s*0\.2rem/);
        expect(
            cssText,
            'prime compass summary beats should use a taller setup shape than route'
        ).toMatch(/data-opportunity-compass-summary-beat-action='prime'[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'risk compass summary beats should read as defensive vertical caution'
        ).toMatch(/data-opportunity-compass-summary-beat-action='risk'[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'tool compass summary beats should carry utility timing'
        ).toMatch(/data-opportunity-compass-summary-beat-action='tool'[\s\S]*?animation-duration:\s*0\.84s/);
    });

    it('keeps opportunity compass summary screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".opportunityCompassSummary[data-opportunity-compass-summary-screen-cue='burst'] .opportunityCompassSummaryBeatPips i");
        expect(cssText).toContain(".opportunityCompassSummary[data-opportunity-compass-summary-screen-cue='guard'] .opportunityCompassSummaryBeatPips i");
        expect(cssText).toContain(".opportunityCompassSummary[data-opportunity-compass-summary-screen-cue='pulse'] .opportunityCompassSummaryBeatPips i");
        expect(cssText).toContain(".opportunityCompassSummary[data-opportunity-compass-summary-screen-cue='tick'] .opportunityCompassSummaryBeatPips i");
        expect(
            cssText,
            'burst compass summary cues should stay high-emphasis'
        ).toMatch(/data-opportunity-compass-summary-screen-cue='burst'[\s\S]*?opacity:\s*0\.98/);
        expect(
            cssText,
            'guard compass summary cues should use taller defensive beats'
        ).toMatch(/data-opportunity-compass-summary-screen-cue='guard'[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'pulse compass summary cues should use mid-tempo guidance'
        ).toMatch(/data-opportunity-compass-summary-screen-cue='pulse'[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'tick compass summary cues should stay quiet and slow'
        ).toMatch(/data-opportunity-compass-summary-screen-cue='tick'[\s\S]*?animation-duration:\s*1\.38s/);
    });

    it('keeps opportunity compass priority states visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'best compass summaries should read as ranked recommendations'
        ).toMatch(/data-opportunity-compass-priority='best'[\s\S]*?\.opportunityCompassSummary[\s\S]*?var\(--theme-gold-bright\)/);
        expect(
            cssText,
            'best compass beat pips should have active recommendation timing'
        ).toMatch(/data-opportunity-compass-priority='best'[\s\S]*?\.opportunityCompassSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.82s/);
        expect(
            cssText,
            'single compass summaries should stay cyan and calmer'
        ).toMatch(/data-opportunity-compass-priority='single'[\s\S]*?\.opportunityCompassSummary[\s\S]*?var\(--theme-cyan-bright\)/);
    });

    it('keeps opportunity compass meter heat states visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout compass meters should read as immediate payoff progress'
        ).toMatch(/data-opportunity-compass-heat='cashout'[\s\S]*?\.opportunityCompassMeterFill[\s\S]*?var\(--theme-success\) 66%/);
        expect(
            cssText,
            'cashout compass tracks should frame immediate payoff progress'
        ).toMatch(/data-opportunity-compass-heat='cashout'[\s\S]*?\.opportunityCompassMeter[\s\S]*?border-color:[\s\S]*?var\(--theme-gold-bright\) 42%/);
        expect(
            cssText,
            'surge compass meters should blend gold with cyan/violet acceleration'
        ).toMatch(/data-opportunity-compass-heat='surge'[\s\S]*?\.opportunityCompassMeterFill[\s\S]*?var\(--theme-violet-bright\) 24%/);
        expect(
            cssText,
            'surge compass tracks should read as acceleration lanes'
        ).toMatch(/data-opportunity-compass-heat='surge'[\s\S]*?\.opportunityCompassMeter[\s\S]*?var\(--theme-cyan-bright\) 38%/);
        expect(
            cssText,
            'prime compass meters should use setup-progress cyan/violet'
        ).toMatch(/data-opportunity-compass-heat='prime'[\s\S]*?\.opportunityCompassMeterFill[\s\S]*?var\(--theme-violet-bright\) 58%/);
        expect(
            cssText,
            'prime compass tracks should frame setup-progress cyan/violet'
        ).toMatch(/data-opportunity-compass-heat='prime'[\s\S]*?\.opportunityCompassMeter[\s\S]*?var\(--theme-violet-bright\) 34%/);
        expect(
            cssText,
            'normal compass meters should stay quieter than cashout and surge'
        ).toMatch(/data-opportunity-compass-heat='normal'[\s\S]*?\.opportunityCompassMeterFill[\s\S]*?opacity:\s*0\.82/);
        expect(
            cssText,
            'normal compass tracks should remain visually quieter'
        ).toMatch(/data-opportunity-compass-heat='normal'[\s\S]*?\.opportunityCompassMeter[\s\S]*?var\(--theme-text-muted\) 24%/);
    });

    it('keeps opportunity compass row action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout compass rows should read as quick horizontal payout beats'
        ).toMatch(/data-opportunity-action-id='cashout'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'prime compass rows should use taller setup beats'
        ).toMatch(/data-opportunity-action-id='prime'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'route compass rows should stay horizontal route guidance'
        ).toMatch(/data-opportunity-action-id='route'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?animation-duration:\s*0\.88s/);
        expect(
            cssText,
            'tool compass rows should keep utility beats square and mid-tempo'
        ).toMatch(/data-opportunity-action-id='tool'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?var\(--theme-violet-bright\)/);
        expect(
            cssText,
            'claim and recover compass rows should use success payoff beats'
        ).toMatch(/data-opportunity-action-id='claim'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?var\(--theme-success\)/);
        expect(
            cssText,
            'study compass rows should use slower planning beats'
        ).toMatch(/data-opportunity-action-id='study'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?animation-duration:\s*1s/);
        expect(
            cssText,
            'risk compass rows should use tall caution beats'
        ).toMatch(/data-opportunity-action-id='risk'[\s\S]*?\.opportunityCompassBeatPips i[\s\S]*?height:\s*0\.24rem/);
    });

    it('keeps opportunity lane map summary action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout and claim lane map actions should read as quick payout beats'
        ).toMatch(/data-opportunity-lane-map-action='cashout'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'perk lane map actions should use reward utility geometry'
        ).toMatch(/data-opportunity-lane-map-action='perk'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'prime lane map actions should use taller setup beats'
        ).toMatch(/data-opportunity-lane-map-action='prime'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'study lane map actions should stay horizontal planning beats'
        ).toMatch(/data-opportunity-lane-map-action='study'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?width:\s*0\.2rem/);
        expect(
            cssText,
            'risk lane map actions should use taller caution beats'
        ).toMatch(/data-opportunity-lane-map-action='risk'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'tool lane map actions should keep utility timing'
        ).toMatch(/data-opportunity-lane-map-action='tool'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.84s/);
    });

    it('keeps opportunity lane map summary screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".opportunityLaneMapSummary[data-opportunity-lane-map-screen-cue='burst'] .opportunityLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".opportunityLaneMapSummary[data-opportunity-lane-map-screen-cue='guard'] .opportunityLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".opportunityLaneMapSummary[data-opportunity-lane-map-screen-cue='pulse'] .opportunityLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".opportunityLaneMapSummary[data-opportunity-lane-map-screen-cue='recover'] .opportunityLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".opportunityLaneMapSummary[data-opportunity-lane-map-screen-cue='risk'] .opportunityLaneMapSummaryBeatPips i");
        expect(
            cssText,
            'burst lane map cues should stay fastest and high-emphasis'
        ).toMatch(/data-opportunity-lane-map-screen-cue='burst'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'guard lane map cues should use taller defensive beats'
        ).toMatch(/data-opportunity-lane-map-screen-cue='guard'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'pulse lane map cues should use mid-tempo guidance'
        ).toMatch(/data-opportunity-lane-map-screen-cue='pulse'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'recover lane map cues should carry success-colored beats'
        ).toMatch(/data-opportunity-lane-map-screen-cue='recover'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?var\(--theme-success\)/);
        expect(
            cssText,
            'risk lane map cues should use taller caution beats'
        ).toMatch(/data-opportunity-lane-map-screen-cue='risk'[\s\S]*?\.opportunityLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.22rem/);
    });

    it('keeps chain planning summary action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'card action priority cashout should read as fast payout beats'
        ).toMatch(/data-card-action-priority-summary-action='cashout'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'card action priority followup should stay horizontal route guidance'
        ).toMatch(/data-card-action-priority-summary-action='followup'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?width:\s*0\.2rem/);
        expect(
            cssText,
            'card action priority perk should use reward utility geometry'
        ).toMatch(/data-card-action-priority-summary-action='perk'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'card action priority bank should use taller hold beats'
        ).toMatch(/data-card-action-priority-summary-action='bank'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'chain shot map cashout should read as fast payout beats'
        ).toMatch(/data-chain-shot-map-summary-action='cashout'[\s\S]*?\.chainOpportunityShotMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'chain shot map setup should keep slower setup beats'
        ).toMatch(/data-chain-shot-map-summary-action='setup'[\s\S]*?\.chainOpportunityShotMapSummaryBeatPips i[\s\S]*?animation-duration:\s*1s/);
    });

    it('keeps chain planning summary screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityActionPrioritySummary[data-card-action-priority-summary-screen-cue='burst'] .chainOpportunityActionPrioritySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityActionPrioritySummary[data-card-action-priority-summary-screen-cue='guard'] .chainOpportunityActionPrioritySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityActionPrioritySummary[data-card-action-priority-summary-screen-cue='pulse'] .chainOpportunityActionPrioritySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityActionPrioritySummary[data-card-action-priority-summary-screen-cue='tick'] .chainOpportunityActionPrioritySummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityShotMapSummary[data-chain-shot-map-summary-screen-cue='burst'] .chainOpportunityShotMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityShotMapSummary[data-chain-shot-map-summary-screen-cue='guard'] .chainOpportunityShotMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityShotMapSummary[data-chain-shot-map-summary-screen-cue='pulse'] .chainOpportunityShotMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityShotMapSummary[data-chain-shot-map-summary-screen-cue='tick'] .chainOpportunityShotMapSummaryBeatPips i");
        expect(
            cssText,
            'card action priority burst cues should stay fastest and high-emphasis'
        ).toMatch(/data-card-action-priority-summary-screen-cue='burst'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?animation-duration:\s*0\.66s/);
        expect(
            cssText,
            'card action priority guard cues should use taller defensive beats'
        ).toMatch(/data-card-action-priority-summary-screen-cue='guard'[\s\S]*?\.chainOpportunityActionPrioritySummaryBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'chain shot map pulse cues should use mid-tempo guidance'
        ).toMatch(/data-chain-shot-map-summary-screen-cue='pulse'[\s\S]*?\.chainOpportunityShotMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'chain shot map tick cues should stay quiet and slow'
        ).toMatch(/data-chain-shot-map-summary-screen-cue='tick'[\s\S]*?\.chainOpportunityShotMapSummaryBeatPips i[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps card beat map summary meters visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout beat-map summary meters should frame immediate payout progress'
        ).toMatch(/data-card-beat-map-summary-action='cashout'[\s\S]*?\.chainOpportunityBeatMapSummaryMeterFill[\s\S]*?var\(--theme-gold-bright\) 88%/);
        expect(
            cssText,
            'surge beat-map summary meters should read as acceleration'
        ).toMatch(/data-card-beat-map-summary-action='surge'[\s\S]*?\.chainOpportunityBeatMapSummaryMeterFill[\s\S]*?var\(--theme-violet-bright\) 78%/);
        expect(
            cssText,
            'route beat-map summary meters should use violet/cyan routing'
        ).toMatch(/data-card-beat-map-summary-action='route'[\s\S]*?\.chainOpportunityBeatMapSummaryMeter[\s\S]*?var\(--theme-violet-bright\) 34%/);
        expect(
            cssText,
            'quiet beat-map summary meters should stay visually calmer'
        ).toMatch(/data-card-beat-map-summary-screen-cue='tick'[\s\S]*?\.chainOpportunityBeatMapSummaryMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps trait interaction map summary role beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'trait cashout summaries should read as fast payout beats'
        ).toMatch(/data-trait-interaction-lane-primary-role-id='cashout'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'trait protect summaries should use taller defensive beats'
        ).toMatch(/data-trait-interaction-lane-primary-role-id='protect'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'trait tool summaries should keep utility timing'
        ).toMatch(/data-trait-interaction-lane-primary-role-id='tool'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.84s/);
        expect(
            cssText,
            'trait risk summaries should use taller caution beats'
        ).toMatch(/data-trait-interaction-lane-primary-role-id='risk'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'trait recall summaries should stay horizontal memory beats'
        ).toMatch(/data-trait-interaction-lane-primary-role-id='recall'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?width:\s*0\.22rem/);
    });

    it('keeps trait lane beat map summary meters visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout trait-lane beat meters should read as payout progress'
        ).toMatch(/data-card-trait-lane-beat-map-summary-action='cashout'[\s\S]*?\.chainOpportunityTraitLaneBeatMapMeterFill[\s\S]*?var\(--theme-gold-bright\) 88%/);
        expect(
            cssText,
            'protect trait-lane beat meters should read as defensive progress'
        ).toMatch(/data-card-trait-lane-beat-map-summary-action='protect'[\s\S]*?\.chainOpportunityTraitLaneBeatMapMeterFill[\s\S]*?var\(--theme-success, #8edb9b\) 76%/);
        expect(
            cssText,
            'risk and block trait-lane beat meters should carry caution language'
        ).toMatch(/data-card-trait-lane-beat-map-summary-action='risk'[\s\S]*?\.chainOpportunityTraitLaneBeatMapMeterFill[\s\S]*?var\(--theme-warning, #f2bc6b\) 62%/);
        expect(
            cssText,
            'pulse trait-lane beat meters should stay calmer than burst'
        ).toMatch(/data-card-trait-lane-beat-map-summary-screen-cue='pulse'[\s\S]*?\.chainOpportunityTraitLaneBeatMapMeterFill[\s\S]*?opacity:\s*0\.9/);
    });

    it('keeps trait interaction map summary screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityTraitLaneMap[data-trait-interaction-lane-primary-screen-cue='burst'] .chainOpportunityTraitLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityTraitLaneMap[data-trait-interaction-lane-primary-screen-cue='guard'] .chainOpportunityTraitLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityTraitLaneMap[data-trait-interaction-lane-primary-screen-cue='pulse'] .chainOpportunityTraitLaneMapSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityTraitLaneMap[data-trait-interaction-lane-primary-screen-cue='risk'] .chainOpportunityTraitLaneMapSummaryBeatPips i");
        expect(
            cssText,
            'trait burst summaries should stay fastest and high-emphasis'
        ).toMatch(/data-trait-interaction-lane-primary-screen-cue='burst'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'trait guard summaries should use taller defensive beats'
        ).toMatch(/data-trait-interaction-lane-primary-screen-cue='guard'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'trait pulse summaries should use mid-tempo guidance'
        ).toMatch(/data-trait-interaction-lane-primary-screen-cue='pulse'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'trait risk summaries should use taller caution beats'
        ).toMatch(/data-trait-interaction-lane-primary-screen-cue='risk'[\s\S]*?\.chainOpportunityTraitLaneMapSummaryBeatPips i[\s\S]*?height:\s*0\.22rem/);
    });

    it('keeps payoff stack tones visually distinct in board beat pips', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout payoff stacks should read as fast horizontal payout beats'
        ).toMatch(/data-payoff-stack-tone='cashout'[\s\S]*?\.opportunityPayoffStackBeatPips i[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'build payoff stacks should read as taller prime setup beats'
        ).toMatch(/data-payoff-stack-tone='build'[\s\S]*?\.opportunityPayoffStackBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'followup payoff stacks should keep mid-tempo route timing'
        ).toMatch(/data-payoff-stack-tone='followup'[\s\S]*?\.opportunityPayoffStackBeatPips i[\s\S]*?animation-duration:\s*0\.92s/);
        expect(
            cssText,
            'super payoff stacks should read as the fastest widest payout stack'
        ).toMatch(/data-payoff-stack-cue-id='super'[\s\S]*?\.opportunityPayoffStackBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'cashout payoff stack meters should read hot even without reading copy'
        ).toMatch(/data-payoff-stack-tone='cashout'[\s\S]*?\.opportunityPayoffStackMeter[\s\S]*?var\(--theme-gold-bright\) 92%/);
        expect(
            cssText,
            'super payoff stack meters should add violet stack energy'
        ).toMatch(/data-payoff-stack-cue-id='super'[\s\S]*?\.opportunityPayoffStackMeter[\s\S]*?var\(--theme-violet-bright\) 24%/);
        expect(
            cssText,
            'follow-up payoff stack meters should keep route-progress cyan'
        ).toMatch(/data-payoff-stack-tone='followup'[\s\S]*?\.opportunityPayoffStackMeter[\s\S]*?var\(--theme-cyan-bright\) 82%/);
        expect(
            cssText,
            'prime payoff stack meters should read as setup progress'
        ).toMatch(/data-payoff-stack-heat='prime'[\s\S]*?\.opportunityPayoffStackMeter[\s\S]*?var\(--theme-violet-bright\) 72%/);
    });

    it('keeps payoff stack crescendo cues and tiers visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'prime crescendo should use slower setup beat timing'
        ).toMatch(/data-payoff-stack-crescendo-tier='prime'[\s\S]*?\.opportunityPayoffCrescendo strong i[\s\S]*?animation-duration:\s*1\.08s/);
        expect(
            cssText,
            'snap crescendo should use quick cashout beat timing'
        ).toMatch(/data-payoff-stack-crescendo-screen-cue='snap'[\s\S]*?\.opportunityPayoffCrescendo strong i[\s\S]*?animation-duration:\s*0\.78s/);
        expect(
            cssText,
            'stack crescendo should use wider stacked payoff beats'
        ).toMatch(/data-payoff-stack-crescendo-tier='stack'[\s\S]*?\.opportunityPayoffCrescendo strong i[\s\S]*?width:\s*0\.26rem/);
        expect(
            cssText,
            'super crescendo should use the fastest highest-emphasis beats'
        ).toMatch(/data-payoff-stack-crescendo-tier='super'[\s\S]*?\.opportunityPayoffCrescendo strong i[\s\S]*?animation-duration:\s*0\.58s/);
    });

    it('keeps HUD stacked payoff badge beats visually distinct by stack size', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            '2-stack payoff badges should read as active but not maxed'
        ).toMatch(/data-chain-stack-beats='2'[\s\S]*?\.hudChainStackedPayoffBadgeBeatPips i[\s\S]*?animation-duration:\s*0\.86s/);
        expect(
            cssText,
            '3-stack payoff badges should read hotter'
        ).toMatch(/data-chain-stack-beats='3'[\s\S]*?\.hudChainStackedPayoffBadgeBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'maxed stack payoff badges should use the fastest payoff beat'
        ).toMatch(/data-chain-stack-beats='4'[\s\S]*?\.hudChainStackedPayoffBadgeBeatPips i[\s\S]*?animation-duration:\s*0\.62s/);
    });

    it('keeps trait preview summary kinds visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'trait preview summary should use taller setup beats'
        ).toMatch(/data-preview-summary-kind='trait'[\s\S]*?\.traitPreviewSummaryBeatPips i[\s\S]*?height:\s*0\.16rem/);
        expect(
            cssText,
            'pickup preview summary should use fast horizontal reward beats'
        ).toMatch(/data-preview-summary-kind='pickup'[\s\S]*?\.traitPreviewSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'hazard preview summary should use taller caution beats'
        ).toMatch(/data-preview-summary-kind='hazard'[\s\S]*?\.traitPreviewSummaryBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'stack preview summaries should read as hot cashout states'
        ).toMatch(/data-preview-summary-action='stack'[\s\S]*?var\(--theme-violet-bright\) 44%/);
        expect(
            cssText,
            'cashout density summaries should use fast horizontal payoff beats'
        ).toMatch(/data-preview-summary-density-tone='cashout'[\s\S]*?\.traitPreviewSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'surge density summaries should read faster than setup'
        ).toMatch(/data-preview-summary-density-tone='surge'[\s\S]*?\.traitPreviewSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.8s/);
        expect(
            cssText,
            'setup and trait summary tones should stay visibly calmer than cashout'
        ).toMatch(/data-preview-summary-tone='setup'[\s\S]*?var\(--theme-violet-bright\) 18%/);
    });

    it('keeps trait preview density meter tracks visually distinct by density tone', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout density tracks should frame hot payoff previews'
        ).toMatch(/data-preview-density-tone='cashout'[\s\S]*?\.traitPreviewDensityMeter[\s\S]*?var\(--theme-gold-bright\) 48%/);
        expect(
            cssText,
            'surge density tracks should frame accelerating combo previews'
        ).toMatch(/data-preview-density-tone='surge'[\s\S]*?\.traitPreviewDensityMeter[\s\S]*?var\(--theme-border-cyan\) 24%/);
        expect(
            cssText,
            'hazard density tracks should retain caution framing'
        ).toMatch(/data-preview-density-tone='hazard'[\s\S]*?\.traitPreviewDensityMeter[\s\S]*?var\(--theme-danger\) 38%/);
        expect(
            cssText,
            'setup density tracks should stay calmer than cashout'
        ).toMatch(/data-preview-density-tone='setup'[\s\S]*?\.traitPreviewDensityMeter[\s\S]*?var\(--theme-violet-bright\) 18%/);
    });

    it('keeps trait preview kind and action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'pickup previews should read as quick reward beats'
        ).toMatch(/data-preview-kind='pickup'[\s\S]*?\.traitPreviewBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'hazard previews should read as taller defensive beats'
        ).toMatch(/data-preview-kind='hazard'[\s\S]*?\.traitPreviewBeatPips i[\s\S]*?height:\s*0\.24rem/);
        expect(
            cssText,
            'trait previews should read as setup beats'
        ).toMatch(/data-preview-tone='trait'[\s\S]*?\.traitPreviewBeatPips i[\s\S]*?animation-duration:\s*0\.98s/);
        expect(
            cssText,
            'pickup preview actions should carry faster action pips'
        ).toMatch(/data-preview-action-kind='pickup'[\s\S]*?\.traitPreviewActionBeatPips i[\s\S]*?animation-duration:\s*0\.76s/);
        expect(
            cssText,
            'hazard preview actions should carry taller caution pips'
        ).toMatch(/data-preview-action-kind='hazard'[\s\S]*?\.traitPreviewActionBeatPips i[\s\S]*?height:\s*0\.2rem/);
    });

    it('keeps trait preview signal meters visually distinct by payoff state', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'pickup and cashout signal meters should read as reward progress'
        ).toMatch(/data-preview-tone='cashout'[\s\S]*?\.traitPreviewSignalMeterFill[\s\S]*?var\(--theme-success\) 66%/);
        expect(
            cssText,
            'trait setup signal meters should read as combo setup progress'
        ).toMatch(/data-preview-tone='setup'[\s\S]*?\.traitPreviewSignalMeterFill[\s\S]*?var\(--theme-violet-bright\) 58%/);
        expect(
            cssText,
            'hazard signal meters should keep caution colors in both track and fill'
        ).toMatch(/data-preview-tone='hazard'[\s\S]*?\.traitPreviewSignalMeter[\s\S]*?var\(--theme-danger\) 34%/);
        expect(
            cssText,
            'guard signal meters should frame risky previews with caution'
        ).toMatch(/data-preview-screen-cue='guard'[\s\S]*?\.traitPreviewSignalMeterFill[\s\S]*?var\(--theme-warning, #f2bc6b\) 68%/);
        expect(
            cssText,
            'snap signal meters should stay calmer than burst previews'
        ).toMatch(/data-preview-screen-cue='snap'[\s\S]*?\.traitPreviewSignalMeterFill[\s\S]*?opacity:\s*0\.9/);
    });

    it('keeps trait preview screen cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".traitPreviewChip[data-preview-screen-cue='burst'] .traitPreviewBeatPips i");
        expect(cssText).toContain(".traitPreviewChip[data-preview-screen-cue='snap'] .traitPreviewBeatPips i");
        expect(cssText).toContain(".traitPreviewChip[data-preview-screen-cue='pulse'] .traitPreviewBeatPips i");
        expect(cssText).toContain(".traitPreviewChip[data-preview-screen-cue='guard'] .traitPreviewBeatPips i");
        expect(
            cssText,
            'burst preview cues should stay fastest and high-emphasis'
        ).toMatch(/data-preview-screen-cue='burst'[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'snap preview cues should use quick reward timing'
        ).toMatch(/data-preview-screen-cue='snap'[\s\S]*?animation-duration:\s*0\.78s/);
        expect(
            cssText,
            'pulse preview cues should use mid-tempo guidance'
        ).toMatch(/data-preview-screen-cue='pulse'[\s\S]*?animation-duration:\s*0\.94s/);
        expect(
            cssText,
            'guard preview cues should use taller defensive beats'
        ).toMatch(/data-preview-screen-cue='guard'[\s\S]*?height:\s*0\.24rem/);
    });

    it('keeps chain target plan action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout target plans should read as immediate payout beats'
        ).toMatch(/data-chain-target-plan-action='cashout'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'follow-up target plans should use mid-tempo tap beats'
        ).toMatch(/data-chain-target-plan-action='follow-up'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'match-route target plans should use wide route beats'
        ).toMatch(/data-chain-target-plan-action='match-route'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?width:\s*0\.24rem/);
        expect(
            cssText,
            'prime-route target plans should use taller setup beats'
        ).toMatch(/data-chain-target-plan-action='prime-route'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?height:\s*0\.18rem/);
    });

    it('keeps chain target plan tiers and tones visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'now target plans should stay fastest and high-emphasis'
        ).toMatch(/data-chain-target-plan-tier='now'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'tap target plans should use mid-tempo beats'
        ).toMatch(/data-chain-target-plan-tier='tap'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'route target plans should stay wide and readable'
        ).toMatch(/data-chain-target-plan-tier='route'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?width:\s*0\.24rem/);
        expect(
            cssText,
            'prime target plans should use taller setup beats'
        ).toMatch(/data-chain-target-plan-tier='prime'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'setup target tone should keep slower setup timing'
        ).toMatch(/data-chain-target-plan-tone='setup'[\s\S]*?\.chainOpportunityTargetPlanBeatPips i[\s\S]*?animation-duration:\s*1\.08s/);
    });

    it('keeps chain hot band action and tier beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'hot band cashout should read as fast wide payoff beats'
        ).toMatch(/data-chain-hot-band-action='cashout'[\s\S]*?\.chainOpportunityHotBandBeatPips i[\s\S]*?animation-duration:\s*0\.66s/);
        expect(
            cssText,
            'hot band hold should use taller guarded beats'
        ).toMatch(/data-chain-hot-band-action='hold'[\s\S]*?\.chainOpportunityHotBandBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'hot tier should stay fastest and high-emphasis'
        ).toMatch(/data-chain-hot-band-tier='hot'[\s\S]*?\.chainOpportunityHotBandBeatPips i[\s\S]*?animation-duration:\s*0\.64s/);
        expect(
            cssText,
            'ready tier should use guarded vertical beats'
        ).toMatch(/data-chain-hot-band-tier='ready'[\s\S]*?\.chainOpportunityHotBandBeatPips i[\s\S]*?height:\s*0\.22rem/);
    });

    it('keeps chain hot band meters visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout hot-band meters should frame immediate payout'
        ).toMatch(/data-chain-hot-band-action='cashout'[\s\S]*?\.chainOpportunityHotBandMeterFill[\s\S]*?var\(--theme-gold-bright\) 92%/);
        expect(
            cssText,
            'hot tier meters should keep high-emphasis payout colors'
        ).toMatch(/data-chain-hot-band-tier='hot'[\s\S]*?\.chainOpportunityHotBandMeter[\s\S]*?var\(--theme-gold-bright\) 52%/);
        expect(
            cssText,
            'hold hot-band meters should read as guarded setup'
        ).toMatch(/data-chain-hot-band-action='hold'[\s\S]*?\.chainOpportunityHotBandMeterFill[\s\S]*?var\(--theme-cyan-bright\) 82%/);
        expect(
            cssText,
            'ready hot-band meters should stay calmer than hot cashout'
        ).toMatch(/data-chain-hot-band-tier='ready'[\s\S]*?\.chainOpportunityHotBandMeter[\s\S]*?var\(--theme-cyan-bright\) 42%/);
    });

    it('keeps chain surge band combo beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'surge action should use wide accelerated beats'
        ).toMatch(/data-chain-surge-band-action='surge'[\s\S]*?\.chainOpportunitySurgeBandBeatPips i[\s\S]*?width:\s*0\.34rem/);
        expect(
            cssText,
            'surge tone should speed up beyond the base surge action'
        ).toMatch(/data-chain-surge-band-tone='surge'[\s\S]*?\.chainOpportunitySurgeBandBeatPips i[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'combo tier should read as the fastest surge payoff'
        ).toMatch(/data-chain-surge-band-tier='combo'[\s\S]*?\.chainOpportunitySurgeBandBeatPips i[\s\S]*?animation-duration:\s*0\.62s/);
        expect(
            cssText,
            'burst surge cues should stay high-emphasis'
        ).toMatch(/data-chain-surge-band-screen-cue='burst'[\s\S]*?\.chainOpportunitySurgeBandBeatPips i[\s\S]*?opacity:\s*0\.98/);
    });

    it('keeps chain surge band meters visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'surge action meters should read as acceleration progress'
        ).toMatch(/data-chain-surge-band-action='surge'[\s\S]*?\.chainOpportunitySurgeBandMeterFill[\s\S]*?var\(--theme-violet-bright\) 88%/);
        expect(
            cssText,
            'combo tier surge meters should keep payoff heat'
        ).toMatch(/data-chain-surge-band-tier='combo'[\s\S]*?\.chainOpportunitySurgeBandMeter[\s\S]*?var\(--theme-gold-bright\) 20%/);
        expect(
            cssText,
            'burst surge meters should use the same high-emphasis fill'
        ).toMatch(/data-chain-surge-band-screen-cue='burst'[\s\S]*?\.chainOpportunitySurgeBandMeterFill[\s\S]*?var\(--theme-gold-bright\) 62%/);
    });

    it('keeps chain milestone tier beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout milestones should read as fast wide payout beats'
        ).toMatch(/data-chain-milestone-tier='cashout'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'prime milestones should use taller setup beats'
        ).toMatch(/data-chain-milestone-tier='prime'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?height:\s*0\.2rem/);
        expect(
            cssText,
            'hold milestones should stay slower and guarded'
        ).toMatch(/data-chain-milestone-tier='hold'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*1\.18s/);
        expect(
            cssText,
            'build milestones should stay quiet and slow'
        ).toMatch(/data-chain-milestone-tier='build'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*1\.28s/);
    });

    it('keeps chain milestone meters visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout milestone meters should read as immediate payout progress'
        ).toMatch(/data-chain-milestone-tier='cashout'[\s\S]*?\.chainOpportunityMilestoneMeterFill[\s\S]*?var\(--theme-gold-bright\) 90%/);
        expect(
            cssText,
            'prime milestone meters should read as setup progress'
        ).toMatch(/data-chain-milestone-tier='prime'[\s\S]*?\.chainOpportunityMilestoneMeterFill[\s\S]*?var\(--theme-green-bright\) 62%/);
        expect(
            cssText,
            'hold milestone meters should carry guarded hold colors'
        ).toMatch(/data-chain-milestone-tier='hold'[\s\S]*?\.chainOpportunityMilestoneMeterFill[\s\S]*?var\(--theme-violet-bright\) 52%/);
        expect(
            cssText,
            'build milestone meters should stay quieter than cashout'
        ).toMatch(/data-chain-milestone-tier='build'[\s\S]*?\.chainOpportunityMilestoneMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps chain milestone tone and screen cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityMilestone[data-chain-milestone-screen-cue='burst'] .chainOpportunityMilestoneBeatPips i");
        expect(cssText).toContain(".chainOpportunityMilestone[data-chain-milestone-screen-cue='pulse'] .chainOpportunityMilestoneBeatPips i");
        expect(cssText).toContain(".chainOpportunityMilestone[data-chain-milestone-screen-cue='tick'] .chainOpportunityMilestoneBeatPips i");
        expect(
            cssText,
            'surge milestones should use fast wide acceleration beats'
        ).toMatch(/data-chain-milestone-tone='surge'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'combo milestones should use fastest payoff beats'
        ).toMatch(/data-chain-milestone-tone='combo'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'chain milestones should use mid-tempo continuation beats'
        ).toMatch(/data-chain-milestone-tone='chain'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'tick milestone cues should stay narrow and slow'
        ).toMatch(/data-chain-milestone-screen-cue='tick'[\s\S]*?\.chainOpportunityMilestoneBeatPips i[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps chain surge callout beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunitySurge[data-chain-opportunity-surge-screen-cue='burst'] .chainOpportunitySurgeBeatPips i");
        expect(
            cssText,
            'surge callouts should use fast wide acceleration beats'
        ).toMatch(/data-chain-opportunity-surge-tone='surge'[\s\S]*?\.chainOpportunitySurgeBeatPips i[\s\S]*?animation-duration:\s*0\.66s/);
        expect(
            cssText,
            'burst surge callouts should stay fastest and high-emphasis'
        ).toMatch(/data-chain-opportunity-surge-screen-cue='burst'[\s\S]*?\.chainOpportunitySurgeBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
    });

    it('keeps chain armed perk payoff beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'armed perk state should use guarded setup beats'
        ).toMatch(/data-chain-armed-perk-tone='armed'[\s\S]*?\.chainOpportunityArmedPerkBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'payoff perk state should use quick payout beats'
        ).toMatch(/data-chain-armed-perk-tone='payoff'[\s\S]*?\.chainOpportunityArmedPerkBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
    });

    it('keeps chain armed perk meters visually distinct by payoff state', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'armed perk meters should read as ready utility setup'
        ).toMatch(/data-chain-armed-perk-tone='armed'[\s\S]*?\.chainOpportunityArmedPerkMeterFill[\s\S]*?var\(--theme-cyan-bright\) 84%/);
        expect(
            cssText,
            'armed perk meters should stay visually quieter than payoff'
        ).toMatch(/data-chain-armed-perk-tone='armed'[\s\S]*?\.chainOpportunityArmedPerkMeterFill[\s\S]*?opacity:\s*0\.84/);
        expect(
            cssText,
            'payoff perk meters should read as immediate reward payoff'
        ).toMatch(/data-chain-armed-perk-tone='payoff'[\s\S]*?\.chainOpportunityArmedPerkMeterFill[\s\S]*?var\(--theme-gold-bright\) 92%/);
        expect(
            cssText,
            'payoff perk tracks should get a stronger reward frame'
        ).toMatch(/data-chain-armed-perk-tone='payoff'[\s\S]*?\.chainOpportunityArmedPerkMeter[\s\S]*?var\(--theme-gold-bright\) 54%/);
    });

    it('keeps chain arcade callout tone beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout callouts should read as quick payout beats'
        ).toMatch(/data-chain-callout-tone='cashout'[\s\S]*?\.chainOpportunityArcadeCalloutBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'surge callouts should use fastest wide acceleration beats'
        ).toMatch(/data-chain-callout-tone='surge'[\s\S]*?\.chainOpportunityArcadeCalloutBeatPips i[\s\S]*?animation-duration:\s*0\.62s/);
        expect(
            cssText,
            'ready callouts should use guarded vertical beats'
        ).toMatch(/data-chain-callout-tone='ready'[\s\S]*?\.chainOpportunityArcadeCalloutBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'setup callouts should use slower setup beats'
        ).toMatch(/data-chain-callout-tone='setup'[\s\S]*?\.chainOpportunityArcadeCalloutBeatPips i[\s\S]*?animation-duration:\s*1\.16s/);
    });

    it('keeps chain priority beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'best priority should read as fast wide payout beats'
        ).toMatch(/data-chain-priority='best'[\s\S]*?\.chainOpportunityPriorityBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'followup priority should use mid-tempo route beats'
        ).toMatch(/data-chain-priority='followup'[\s\S]*?\.chainOpportunityPriorityBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'ready priority should use guarded vertical beats'
        ).toMatch(/data-chain-priority='ready'[\s\S]*?\.chainOpportunityPriorityBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'setup priority should use slower setup beats'
        ).toMatch(/data-chain-priority='setup'[\s\S]*?\.chainOpportunityPriorityBeatPips i[\s\S]*?animation-duration:\s*1\.16s/);
    });

    it('keeps chain follow-up cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'route follow-up cues should use low route beats'
        ).toMatch(/data-chain-followup-tone='route'[\s\S]*?\.chainOpportunityFollowupBeatPips i[\s\S]*?height:\s*0\.12rem/);
        expect(
            cssText,
            'pulse follow-up cues should use quicker active beats'
        ).toMatch(/data-chain-followup-screen-cue='pulse'[\s\S]*?\.chainOpportunityFollowupBeatPips i[\s\S]*?animation-duration:\s*0\.82s/);
        expect(
            cssText,
            'ready follow-up cues should read as immediate next-tap beats'
        ).toMatch(/data-chain-followup-ready='true'[\s\S]*?\.chainOpportunityFollowupBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'full follow-up meters should keep the same immediate beat language'
        ).toMatch(/data-chain-followup-meter-fill='100'[\s\S]*?\.chainOpportunityFollowupBeatPips i[\s\S]*?height:\s*0\.18rem/);
    });

    it('keeps HUD trait route urgency states visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'setup route urgency should read as a quieter priming state'
        ).toMatch(/\.hudTraitRoutePill\[data-trait-route-urgency='setup'\][\s\S]*?var\(--theme-violet-bright\) 9%/);
        expect(
            cssText,
            'ready and building route urgency should read as active route progress'
        ).toMatch(/\.hudTraitRoutePill\[data-trait-route-urgency='ready'\],[\s\S]*?\.hudTraitRoutePill\[data-trait-route-urgency='building'\][\s\S]*?var\(--theme-cyan-bright\) 14%/);
        expect(
            cssText,
            'next route urgency should read as an immediate cashout'
        ).toMatch(/\.hudTraitRoutePill\[data-trait-route-urgency='next'\][\s\S]*?var\(--theme-gold-bright\) 20%/);
        expect(
            cssText,
            'paid route urgency should read as a claimed success state'
        ).toMatch(/\.hudTraitRoutePill\[data-trait-route-urgency='paid'\][\s\S]*?var\(--theme-success\) 16%/);
    });

    it('keeps primary trait-lane role beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout trait lanes should read as fast wide payout beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='cashout'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'protect trait lanes should use vertical defensive beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='protect'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'tool trait lanes should use mid-tempo utility beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='tool'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'block trait lanes should use guarded blocker beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='block'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.82s/);
        expect(
            cssText,
            'risk trait lanes should use urgent thin risk beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='risk'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'recall trait lanes should use low route-like recall beats'
        ).toMatch(/data-card-trait-lane-primary-role-id='recall'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?height:\s*0\.1rem/);
    });

    it('keeps primary trait-lane screen cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'burst trait-lane cues should stay fast and high-emphasis'
        ).toMatch(/data-card-trait-lane-primary-screen-cue='burst'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.6s/);
        expect(
            cssText,
            'guard trait-lane cues should use vertical defensive beats'
        ).toMatch(/data-card-trait-lane-primary-screen-cue='guard'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'pulse trait-lane cues should use calmer readable beats'
        ).toMatch(/data-card-trait-lane-primary-screen-cue='pulse'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'risk trait-lane cues should use urgent thin risk beats'
        ).toMatch(/data-card-trait-lane-primary-screen-cue='risk'[\s\S]*?\.chainOpportunityPrimaryTraitLanePips i[\s\S]*?animation-duration:\s*0\.68s/);
    });

    it('keeps primary shot focus beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout primary shots should read as fast wide payout beats'
        ).toMatch(/data-card-primary-shot-focus='cashout'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'surge primary shots should use the fastest acceleration beats'
        ).toMatch(/data-card-primary-shot-focus='surge'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*0\.6s/);
        expect(
            cssText,
            'follow-up primary shots should use mid-tempo continuation beats'
        ).toMatch(/data-card-primary-shot-focus='follow-up'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'route primary shots should use low route beats'
        ).toMatch(/data-card-primary-shot-focus='route'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?height:\s*0\.1rem/);
        expect(
            cssText,
            'setup primary shots should use taller slower setup beats'
        ).toMatch(/data-card-primary-shot-focus='setup'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*1\.12s/);
    });

    it('keeps primary shot screen cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'burst primary shot cues should stay fastest and high-emphasis'
        ).toMatch(/data-card-primary-shot-screen-cue='burst'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'guard primary shot cues should use vertical defensive beats'
        ).toMatch(/data-card-primary-shot-screen-cue='guard'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'pulse primary shot cues should use calmer readable beats'
        ).toMatch(/data-card-primary-shot-screen-cue='pulse'[\s\S]*?\.chainOpportunityPrimaryShotBeatPips i[\s\S]*?animation-duration:\s*0\.88s/);
    });

    it('keeps chain lines action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout chain lines should read as immediate payout beats'
        ).toMatch(/data-chain-lines-action='cashout'[\s\S]*?\.chainOpportunityLinesBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'follow-up chain lines should use mid-tempo continuation beats'
        ).toMatch(/data-chain-lines-action='follow-up'[\s\S]*?\.chainOpportunityLinesBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'route chain lines should use low route beats'
        ).toMatch(/data-chain-lines-action='match-route'[\s\S]*?\.chainOpportunityLinesBeatPips i[\s\S]*?height:\s*0\.1rem/);
        expect(
            cssText,
            'prime-route chain lines should use taller slower setup beats'
        ).toMatch(/data-chain-lines-action='prime-route'[\s\S]*?\.chainOpportunityLinesBeatPips i[\s\S]*?animation-duration:\s*1\.12s/);
    });

    it('keeps chain lines meters tied to next-action language', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout chain line meters should read as payoff-ready progress'
        ).toMatch(/data-chain-lines-action='cashout'[\s\S]*?\.chainOpportunityLinesMeterFill[\s\S]*?var\(--theme-gold-bright\) 90%/);
        expect(
            cssText,
            'follow-up chain line meters should keep continuation timing distinct from cashout'
        ).toMatch(/data-chain-lines-action='follow-up'[\s\S]*?\.chainOpportunityLinesMeterFill[\s\S]*?#fff7c4 82%/);
        expect(
            cssText,
            'route chain line meters should carry cyan pathing progress'
        ).toMatch(/data-chain-lines-action='match-route'[\s\S]*?\.chainOpportunityLinesMeterFill[\s\S]*?var\(--theme-cyan-bright\) 82%/);
        expect(
            cssText,
            'prime-route chain line meters should stay quieter and setup-toned'
        ).toMatch(/data-chain-lines-action='prime-route'[\s\S]*?\.chainOpportunityLinesMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps chain examples tone beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cashout examples should read as fast reward examples'
        ).toMatch(/data-chain-examples-tone='cashout'[\s\S]*?\.chainOpportunityExamplesBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'forecast examples should use calmer build-up beats'
        ).toMatch(/data-chain-examples-tone='forecast'[\s\S]*?\.chainOpportunityExamplesBeatPips i[\s\S]*?animation-duration:\s*0\.96s/);
        expect(
            cssText,
            'setup examples should use taller slower setup beats'
        ).toMatch(/data-chain-examples-tone='setup'[\s\S]*?\.chainOpportunityExamplesBeatPips i[\s\S]*?height:\s*0\.2rem/);
    });

    it('keeps chain recipe density beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'single recipe density should stay quieter and slower'
        ).toMatch(/data-chain-recipe-meter-fill='33'[\s\S]*?\.chainOpportunityRecipeBeatPips i[\s\S]*?animation-duration:\s*1\.08s/);
        expect(
            cssText,
            'two recipe density should use mid-tempo readable beats'
        ).toMatch(/data-chain-recipe-meter-fill='67'[\s\S]*?\.chainOpportunityRecipeBeatPips i[\s\S]*?animation-duration:\s*0\.9s/);
        expect(
            cssText,
            'full recipe density should read as fast high-opportunity beats'
        ).toMatch(/data-chain-recipe-meter-fill='100'[\s\S]*?\.chainOpportunityRecipeBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'single recipe density meters should stay visibly quieter'
        ).toMatch(/data-chain-recipe-meter-fill='33'[\s\S]*?\.chainOpportunityRecipeMeterFill[\s\S]*?opacity:\s*0\.72/);
        expect(
            cssText,
            'two recipe density meters should brighten into route progress'
        ).toMatch(/data-chain-recipe-meter-fill='67'[\s\S]*?\.chainOpportunityRecipeMeterFill[\s\S]*?var\(--theme-gold-bright\) 62%/);
        expect(
            cssText,
            'full recipe density meters should read as cashout-ready'
        ).toMatch(/data-chain-recipe-meter-fill='100'[\s\S]*?\.chainOpportunityRecipeMeterFill[\s\S]*?var\(--theme-success\) 62%/);
    });

    it('keeps trap resolution signal beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'resolved trap signals should read as quick resolved beats'
        ).toMatch(/data-trap-resolution-signal='resolved'[\s\S]*?\.trapResolutionBeatPips i[\s\S]*?animation-duration:\s*0\.82s/);
        expect(
            cssText,
            'effect trap signals should read as faster wider payout beats'
        ).toMatch(/data-trap-resolution-signal='effect'[\s\S]*?\.trapResolutionBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'continue trap signals should read as taller next-step beats'
        ).toMatch(/data-trap-resolution-signal='continue'[\s\S]*?\.trapResolutionBeatPips i[\s\S]*?height:\s*0\.18rem/);
    });

    it('keeps trap resolution screen cue beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".trapResolutionSignals > span[data-trap-resolution-screen-cue='burst'] .trapResolutionBeatPips i");
        expect(cssText).toContain(".trapResolutionSignals > span[data-trap-resolution-screen-cue='snap'] .trapResolutionBeatPips i");
        expect(cssText).toContain(".trapResolutionSignals > span[data-trap-resolution-screen-cue='pulse'] .trapResolutionBeatPips i");
        expect(
            cssText,
            'burst trap resolution cues should stay fastest and high-emphasis'
        ).toMatch(/data-trap-resolution-screen-cue='burst'[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'snap trap resolution cues should use quick reward timing'
        ).toMatch(/data-trap-resolution-screen-cue='snap'[\s\S]*?animation-duration:\s*0\.78s/);
        expect(
            cssText,
            'pulse trap resolution cues should use calmer next-step timing'
        ).toMatch(/data-trap-resolution-screen-cue='pulse'[\s\S]*?animation-duration:\s*1s/);
    });

    it('keeps board reward burst tier beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'stack reward bursts should use wide fast payoff beats'
        ).toMatch(/data-reward-burst-tier='stack'[\s\S]*?\.boardFloaterRewardBurstBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'mega reward bursts should use max-emphasis beat timing'
        ).toMatch(/data-reward-burst-tier='mega'[\s\S]*?\.boardFloaterRewardBurstBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'super reward burst cues should use the fastest widest pips'
        ).toMatch(/data-reward-burst-screen-cue='super'[\s\S]*?\.boardFloaterRewardBurstBeatPips i[\s\S]*?animation-duration:\s*0\.5s/);
    });

    it('keeps board cascade tier beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'reward cascade cues should use fast horizontal reward beats'
        ).toMatch(/data-cascade-tier='reward'[\s\S]*?\.boardFloaterCascadeBeatPips i[\s\S]*?animation-duration:\s*0\.76s/);
        expect(
            cssText,
            'combo cascade cues should use larger faster combo beats'
        ).toMatch(/data-cascade-tier='combo'[\s\S]*?\.boardFloaterCascadeBeatPips i[\s\S]*?height:\s*0\.22rem/);
    });

    it('keeps mismatch next-action cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'recover next actions should use explicit positive recovery styling'
        ).toMatch(/data-mismatch-next-action='recover'[\s\S]*?var\(--theme-success\)/);
        expect(
            cssText,
            'risk next actions should remain caution-toned'
        ).toMatch(/data-mismatch-next-action='risk'[\s\S]*?var\(--theme-gold-bright\)/);
        expect(
            cssText,
            'lost reward next actions should remain danger-toned'
        ).toMatch(/data-mismatch-next-action='lost-reward'[\s\S]*?var\(--theme-danger\)/);
    });

    it('keeps mismatch recovery urgency beats visually distinct and motion safe', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'one-away lost cashout recovery should use urgent fast beats'
        ).toMatch(/data-mismatch-recovery-urgency='one-away'[\s\S]*?\.boardFloaterChipBeats i[\s\S]*?animation:\s*mismatchRecoveryBeatPulse 0\.68s/);
        expect(
            cssText,
            'setup lost cashout recovery should use slower rebuild beats'
        ).toMatch(/data-mismatch-recovery-urgency='setup'[\s\S]*?\.boardFloaterChipBeats i[\s\S]*?animation:\s*mismatchRecoveryBeatPulse 0\.94s/);
        expect(cssText).toContain("[data-reduce-motion='true']) .boardFloaterChipBeats i");
    });

    it('keeps chain reward urgency tiers visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'next reward urgency should read as immediate fast reward beats'
        ).toMatch(/data-chain-reward-urgency='next'[\s\S]*?\.chainOpportunityRewardUrgencyBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'soon reward urgency should read as mid-tempo forecast beats'
        ).toMatch(/data-chain-reward-urgency='soon'[\s\S]*?\.chainOpportunityRewardUrgencyBeatPips i[\s\S]*?animation-duration:\s*0\.96s/);
        expect(
            cssText,
            'later reward urgency should stay quiet and slower'
        ).toMatch(/data-chain-reward-urgency='later'[\s\S]*?\.chainOpportunityRewardUrgencyBeatPips i[\s\S]*?animation-duration:\s*1\.38s/);
        expect(
            cssText,
            'next reward urgency meters should reinforce immediate cashout'
        ).toMatch(/data-chain-reward-urgency='next'[\s\S]*?\.chainOpportunityRewardUrgencyMeterFill[\s\S]*?var\(--theme-success\) 66%/);
        expect(
            cssText,
            'soon reward urgency meters should reinforce active forecast progress'
        ).toMatch(/data-chain-reward-urgency='soon'[\s\S]*?\.chainOpportunityRewardUrgencyMeterFill[\s\S]*?var\(--theme-cyan-bright\) 80%/);
        expect(
            cssText,
            'later reward urgency meters should stay visibly quieter than immediate cashouts'
        ).toMatch(/data-chain-reward-urgency='later'[\s\S]*?\.chainOpportunityRewardUrgencyMeterFill[\s\S]*?opacity:\s*0\.78/);
    });

    it('keeps chain reward cue and payoff burst beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'forecast reward cues should use calmer build-toward-cashout beats'
        ).toMatch(/data-chain-reward-tone='forecast'[\s\S]*?\.chainOpportunityRewardCueBeatPips i[\s\S]*?animation-duration:\s*0\.96s/);
        expect(
            cssText,
            'pulse reward cues should stay forecast-paced instead of payoff-fast'
        ).toMatch(/data-chain-reward-screen-cue='pulse'[\s\S]*?\.chainOpportunityRewardCueBeatPips i[\s\S]*?height:\s*0\.12rem/);
        expect(
            cssText,
            'cashout payoff bursts should use fast wide reward beats'
        ).toMatch(/data-chain-reward-tone='cashout'[\s\S]*?\.chainOpportunityPayoffBeatPips i[\s\S]*?animation-duration:\s*0\.58s/);
        expect(
            cssText,
            'super reward screen cues should keep high-emphasis payoff beats'
        ).toMatch(/data-chain-reward-screen-cue='super'[\s\S]*?\.chainOpportunityPayoffBeatPips i[\s\S]*?height:\s*0\.2rem/);
    });

    it('keeps chain reward lead tiers and tones visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'next reward lead should use fast reward beats'
        ).toMatch(/data-board-chain-reward-lead-tier='next'[\s\S]*?\.chainOpportunityRewardLeadBeatPips i[\s\S]*?animation-duration:\s*0\.74s/);
        expect(
            cssText,
            'soon reward lead should use mid-tempo beats'
        ).toMatch(/data-board-chain-reward-lead-tier='soon'[\s\S]*?\.chainOpportunityRewardLeadBeatPips i[\s\S]*?animation-duration:\s*0\.98s/);
        expect(
            cssText,
            'later reward lead should stay smaller and slower'
        ).toMatch(/data-board-chain-reward-lead-tier='later'[\s\S]*?\.chainOpportunityRewardLeadBeatPips i[\s\S]*?animation-duration:\s*1\.42s/);
        expect(
            cssText,
            'guard reward lead should use taller defensive beats'
        ).toMatch(/data-board-chain-reward-lead-tone='guard'[\s\S]*?\.chainOpportunityRewardLeadBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'heal reward lead should carry success-colored beats'
        ).toMatch(/data-board-chain-reward-lead-tone='heal'[\s\S]*?\.chainOpportunityRewardLeadBeatPips i[\s\S]*?var\(--theme-success\)/);
    });

    it('keeps HUD chain reward lane beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'cash-next reward lanes should read as immediate payoff'
        ).toMatch(/data-chain-reward-lane-action='Cash next'[\s\S]*?\.hudChainRewardLaneBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'prime reward lanes should read as setup'
        ).toMatch(/data-chain-reward-lane-action='Prime cashout'[\s\S]*?\.hudChainRewardLaneBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'hold-streak reward lanes should read as slower future payoff'
        ).toMatch(/data-chain-reward-lane-action='Hold streak'[\s\S]*?\.hudChainRewardLaneBeatPips i[\s\S]*?animation-duration:\s*1\.24s/);
        expect(
            cssText,
            'guard reward lanes should use taller protected beats'
        ).toMatch(/data-chain-reward-lane='guard'[\s\S]*?\.hudChainRewardLaneBeatPips i[\s\S]*?height:\s*0\.22rem/);
        expect(
            cssText,
            'heal reward lanes should keep a recovery-shaped beat'
        ).toMatch(/data-chain-reward-lane='heal'[\s\S]*?\.hudChainRewardLaneBeatPips i[\s\S]*?animation-duration:\s*0\.96s/);
    });

    it('keeps HUD chain reward ladder urgency beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'next reward ladder entries should read as immediate cashout'
        ).toMatch(/data-chain-reward-ladder-urgency='next'[\s\S]*?\.hudChainRewardBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'soon reward ladder entries should read as mid-tempo setup'
        ).toMatch(/data-chain-reward-ladder-urgency='soon'[\s\S]*?\.hudChainRewardBeatPips i[\s\S]*?height:\s*0\.14rem/);
        expect(
            cssText,
            'later reward ladder entries should stay slower and quieter'
        ).toMatch(/data-chain-reward-ladder-urgency='later'[\s\S]*?\.hudChainRewardBeatPips i[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps chain reward ladder summary action beats visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(
            cssText,
            'reward ladder cashout should read as fast wide payout beats'
        ).toMatch(/data-board-chain-reward-ladder-summary-action='cashout'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.72s/);
        expect(
            cssText,
            'reward ladder prime should use taller setup beats'
        ).toMatch(/data-board-chain-reward-ladder-summary-action='prime'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?height:\s*0\.18rem/);
        expect(
            cssText,
            'reward ladder hold should stay slower and lower-emphasis'
        ).toMatch(/data-board-chain-reward-ladder-summary-action='hold'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*1\.28s/);
    });

    it('keeps chain reward ladder summary tiers and screen cues visually distinct', () => {
        const cssText = readComponentCssFiles()
            .map(({ text }) => text)
            .join('\n');

        expect(cssText).toContain(".chainOpportunityRewardLadderSummary[data-board-chain-reward-ladder-summary-screen-cue='burst'] .chainOpportunityRewardLadderSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityRewardLadderSummary[data-board-chain-reward-ladder-summary-screen-cue='pulse'] .chainOpportunityRewardLadderSummaryBeatPips i");
        expect(cssText).toContain(".chainOpportunityRewardLadderSummary[data-board-chain-reward-ladder-summary-screen-cue='tick'] .chainOpportunityRewardLadderSummaryBeatPips i");
        expect(
            cssText,
            'next reward ladder summaries should use immediate fast beats'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='next'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.7s/);
        expect(
            cssText,
            'soon reward ladder summaries should use mid-tempo beats'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='soon'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.96s/);
        expect(
            cssText,
            'later reward ladder summaries should stay quiet and slow'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='later'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*1\.4s/);
        expect(
            cssText,
            'next reward ladder summary meters should read as cashout-ready'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='next'[\s\S]*?\.chainOpportunityRewardLadderSummaryMeterFill[\s\S]*?var\(--theme-success\) 64%/);
        expect(
            cssText,
            'soon reward ladder summary meters should read as active reward progress'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='soon'[\s\S]*?\.chainOpportunityRewardLadderSummaryMeterFill[\s\S]*?var\(--theme-cyan-bright\) 80%/);
        expect(
            cssText,
            'later reward ladder summary meters should stay quieter than cashout-ready meters'
        ).toMatch(/data-board-chain-reward-ladder-summary-tier='later'[\s\S]*?\.chainOpportunityRewardLadderSummaryMeterFill[\s\S]*?opacity:\s*0\.76/);
        expect(
            cssText,
            'burst reward ladder cues should stay fastest and high-emphasis'
        ).toMatch(/data-board-chain-reward-ladder-summary-screen-cue='burst'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*0\.68s/);
        expect(
            cssText,
            'tick reward ladder cues should stay narrow and slow'
        ).toMatch(/data-board-chain-reward-ladder-summary-screen-cue='tick'[\s\S]*?\.chainOpportunityRewardLadderSummaryBeatPips i[\s\S]*?animation-duration:\s*1\.34s/);
    });

    it('keeps emitted audio cue metadata paired with same-stem screen cues', () => {
        expect(
            findAudioScreenCueMetadataGaps(),
            'audio cue attributes should expose a same-stem screen-cue attribute so cross-modal feedback remains visible'
        ).toEqual([]);
    });

    it('keeps feedback map components from being globally hard-hidden', () => {
        expect(
            findHardHiddenFeedbackMaps(),
            'feedback maps should be conditionally collapsed, not globally hidden with display: none !important'
        ).toEqual([]);
    });

    it('keeps action feedback lane roles wired to visible CSS selectors', () => {
        expect(
            findActionFeedbackLaneRoleSelectorGaps(),
            'action feedback role metadata should drive visible lane styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps opportunity lane roles wired to visible CSS selectors', () => {
        expect(
            findOpportunityLaneRoleSelectorGaps(),
            'board opportunity role metadata should drive visible lane styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps trait interaction lane roles wired to visible CSS selectors', () => {
        expect(
            findTraitInteractionLaneRoleSelectorGaps(),
            'trait interaction role metadata should drive visible lane styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps visible board and HUD tone metadata wired to CSS selectors', () => {
        expect(
            findVisibleToneSelectorGaps(),
            'visible tone metadata should drive styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps visible board state metadata wired to CSS selectors', () => {
        expect(
            findVisibleStateSelectorGaps(),
            'visible state metadata should drive styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps packed primary card cue prefixes wired to visible CSS selectors', () => {
        expect(
            findVisiblePrefixSelectorGaps(),
            'packed primary card cue prefixes should drive styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps packed route glyph values wired to visible CSS selectors', () => {
        expect(
            findVisiblePackedValueSelectorGaps(),
            'packed route glyph values should drive styling instead of only telemetry'
        ).toEqual([]);
    });

    it('keeps CSS-consumed meter-fill metadata wired to matching custom properties', () => {
        expect(
            findMeterFillVariableGaps(),
            'meter-fill metadata consumed by CSS should set the same-stem CSS custom property'
        ).toEqual([]);
    });

    it('keeps progress metadata paired with readable progress semantics', () => {
        expect(
            findProgressReadabilityGaps(),
            'progress metadata should expose a readable label or progressbar semantics instead of only visual telemetry'
        ).toEqual([]);
    });

    it('keeps feedback summary chips paired with readable labels', () => {
        expect(
            findFeedbackSummaryReadabilityGaps(),
            'feedback summary chips with state metadata should expose a readable label instead of only fragmented child text'
        ).toEqual([]);
    });

    it('keeps named feedback cue chips paired with readable labels', () => {
        expect(
            findNamedFeedbackCueReadabilityGaps(),
            'named feedback cue chips with state metadata should expose a readable label instead of only fragmented child text'
        ).toEqual([]);
    });

    it('keeps row-level card feedback markers paired with readable labels', () => {
        expect(
            findCardFeedbackRowReadabilityGaps(),
            'row-level card feedback markers should expose a readable label instead of only telemetry attributes'
        ).toEqual([]);
    });

    it('keeps active play lane and reward rows paired with readable labels', () => {
        expect(
            findPlaySurfaceLaneRowReadabilityGaps(),
            'active play lane and reward rows should expose a readable label instead of only telemetry attributes'
        ).toEqual([]);
    });

    it('keeps visible meter-fill feedback paired with readable semantics', () => {
        expect(
            findMeterReadabilityGaps(),
            'visible meter-fill feedback should expose a readable label or progressbar semantics'
        ).toEqual([]);
    });

    it('keeps stateful chain cue feedback paired with readable semantics', () => {
        const tileBoardSource = readComponentSourceFiles()
            .find(({ fileName }) => fileName === 'TileBoard.tsx')
            ?.text;
        const targetPlanTag = tileBoardSource?.match(/<span[^<>]*data-testid="chain-opportunity-target-plan"[^<>]*>/s)?.[0];
        const surgeTag = tileBoardSource?.match(/<span[^<>]*data-testid="chain-opportunity-surge"[^<>]*>/s)?.[0];

        expect(targetPlanTag, 'chain target plan should keep a stable test id for feedback coverage').toBeDefined();
        expect(targetPlanTag, 'chain target plan should expose its action and plan text to assistive tech').toContain('aria-label=');
        expect(targetPlanTag, 'chain target plan should keep action state visible to CSS and tests').toContain('data-chain-target-plan-action=');
        expect(targetPlanTag, 'chain target plan should keep tier state visible to CSS and tests').toContain('data-chain-target-plan-tier=');
        expect(targetPlanTag, 'chain target plan should keep tone state visible to CSS and tests').toContain('data-chain-target-plan-tone=');
        expect(surgeTag, 'chain surge cue should keep a stable test id for feedback coverage').toBeDefined();
        expect(surgeTag, 'chain surge cue should expose its payoff text to assistive tech').toContain('aria-label=');
        expect(surgeTag, 'chain surge cue should keep screen-cue state visible to CSS and tests').toContain('data-chain-opportunity-surge-screen-cue=');
        expect(surgeTag, 'chain surge cue should keep tone state visible to CSS and tests').toContain('data-chain-opportunity-surge-tone=');
    });
});

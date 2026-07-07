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
        'data-preview-summary-kind': ['hazard', 'pickup', 'trait'],
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
});

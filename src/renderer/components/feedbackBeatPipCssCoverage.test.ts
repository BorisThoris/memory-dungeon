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
        'data-chain-hot-band-beats': ['5'],
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
        'data-chain-opportunity-milestone-screen-cue': ['burst', 'pulse', 'tick'],
        'data-chain-opportunity-milestone-tier': ['build', 'cashout', 'hold', 'prime'],
        'data-chain-opportunity-milestone-tone': ['building', 'chain', 'combo', 'surge'],
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
        'data-pickup-sequence-tone': ['cashout', 'reward'],
        'data-pickup-sequence-phase-tone': ['cashout', 'reward'],
        'data-pickup-sequence-value-tone': ['cashout', 'reward'],
        'data-preview-density-tone': ['cashout', 'hazard', 'ready', 'setup', 'surge', 'trait'],
        'data-preview-action-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-preview-cashout-tone': ['cashout'],
        'data-preview-line-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-preview-tone': ['cashout', 'hazard', 'pickup', 'setup', 'trait'],
        'data-payoff-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-payoff-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-reward-perk-lane-role-id': ['cashout', 'control', 'key', 'prime', 'route', 'trait'],
        'data-reward-perk-primary-lane-role-id': ['control', 'key', 'prime', 'trait'],
        'data-recent-run-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-recent-run-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-run-payoff-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-run-payoff-primary-lane-role-id': ['build', 'cashout', 'protect', 'recover', 'stack'],
        'data-route-recommendation-tone': ['memory'],
        'data-shop-offer-lane-role-id': ['bank', 'buy', 'cashout', 'open', 'prime', 'stack'],
        'data-shop-primary-offer-lane-role-id': ['bank', 'buy', 'cashout', 'open', 'prime', 'stack'],
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
        'data-board-chain-reward-ladder-summary-beats': ['4', '5'],
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
        'data-card-beat-map-summary-beats': ['4', '5'],
        'data-card-beat-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-beat-map-summary-tier': ['cashout', 'follow-up', 'route', 'setup', 'surge'],
        'data-card-cadence': ['cashout', 'follow-up', 'prime', 'route', 'surge'],
        'data-card-cadence-primary-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-tone': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-map-summary-action': ['cashout', 'followup', 'route', 'setup', 'surge'],
        'data-card-cadence-map-summary-beats': ['4', '5'],
        'data-card-cadence-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-cadence-map-summary-tier': ['cashout', 'follow-up', 'prime', 'route', 'surge'],
        'data-card-action-primary-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-feedback-primary-action-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-primary-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-tone': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-summary-action': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-chain-shot-map-summary-beats': ['4', '5'],
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
        'data-card-trait-lane-beat-map-summary-beats': ['4', '5'],
        'data-card-trait-lane-beat-map-summary-screen-cue': ['burst', 'guard', 'pulse', 'risk'],
        'data-card-trait-lane-beat-map-summary-tier': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-trait-lane-beat-map-summary-pip-action': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-trait-interaction-lane-primary-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-trait-interaction-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-card-action-priority-focus': ['primary', 'support'],
        'data-card-action-primary-role': ['Bank', 'Cashout', 'Follow-up', 'Perk', 'Setup'],
        'data-card-action-primary-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-card-action-priority-summary-action': ['bank', 'cashout', 'followup', 'perk', 'setup'],
        'data-card-action-priority-summary-beats': ['4', '5'],
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
        'data-chain-marker-key-beats': ['4', '5'],
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
        'data-hazard-opportunity-action': ['avoid', 'claim', 'inspect', 'weigh'],
        'data-hazard-opportunity-family': ['dual', 'penalty', 'reward'],
        'data-hazard-opportunity-screen-cue': ['burst', 'guard', 'pulse', 'tick'],
        'data-hazard-opportunity-tier': ['danger', 'mixed', 'reward', 'watch'],
        'data-hazard-opportunity-trigger': ['flip', 'match', 'match_or_mismatch', 'mismatch'],
        'data-match-trait-primary-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
        'data-match-trait-lane-role-id': ['block', 'cashout', 'protect', 'recall', 'risk', 'tool'],
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
        'data-opportunity-compass-summary-beats': ['4', '5'],
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
        'data-opportunity-lane-map-action': ['cashout', 'claim', 'perk', 'prime', 'recover', 'risk', 'study', 'tool'],
        'data-opportunity-lane-map-beats': ['4', '5'],
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
        'data-trap-resolution-screen-cue': ['burst', 'pulse', 'snap'],
        'data-trait-interaction-lane-focus': ['primary', 'support'],
        'data-mode-lane-role-id': ['build', 'locked', 'practice', 'pressure', 'reward'],
        'data-mode-primary-lane-role-id': ['build', 'locked', 'practice', 'pressure', 'reward']
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
});

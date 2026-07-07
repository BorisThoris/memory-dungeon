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

type VisibleToneSelectorGap = {
    attr: string;
    value: string;
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
    const roleAttrs = ['data-action-feedback-primary-lane-role', 'data-action-feedback-lane-role'];
    const roles = ['Cashout', 'Protect', 'Recover', 'Route', 'Trait'];

    return roleAttrs.flatMap((attr) =>
        roles
            .filter((role) => !cssText.includes(`[${attr}='${role}']`) && !cssText.includes(`[${attr}="${role}"]`))
            .map((role) => ({ attr, role }))
    );
};

const findOpportunityLaneRoleSelectorGaps = (): OpportunityLaneRoleSelectorGap[] => {
    const cssText = readComponentCssFiles()
        .map(({ text }) => text)
        .join('\n');
    const roleAttrs = ['data-opportunity-primary-lane-role', 'data-opportunity-lane-role'];
    const roles = ['Cashout', 'Claim', 'Perk', 'Prime', 'Recover', 'Risk', 'Study', 'Tool'];

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
        'data-board-chain-reward-lead-tone': ['guard', 'heal', 'reward'],
        'data-chain-combo-surge-band-tone': ['surge'],
        'data-chain-meter-tone': ['cashout', 'ready', 'setup', 'surge'],
        'data-chain-milestone-tone': ['building', 'chain', 'combo', 'surge'],
        'data-chain-next-action-tone': ['cashout', 'ready', 'setup'],
        'data-chain-opportunity-surge-tone': ['surge'],
        'data-chain-reward-lead-tone': ['guard', 'heal', 'reward'],
        'data-chain-surge-band-tone': ['surge']
    };

    return Object.entries(visibleToneContracts).flatMap(([attr, values]) =>
        values
            .filter((value) => !cssText.includes(`[${attr}='${value}']`) && !cssText.includes(`[${attr}="${value}"]`))
            .map((value) => ({ attr, value }))
    );
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

    it('keeps visible board and HUD tone metadata wired to CSS selectors', () => {
        expect(
            findVisibleToneSelectorGaps(),
            'visible tone metadata should drive styling instead of only telemetry'
        ).toEqual([]);
    });
});

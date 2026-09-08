import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    DUNGEON_DETERMINISM_CONTRACT,
    DUNGEON_NON_REPLAY_CHANGES,
    DUNGEON_REPLAY_AFFECTING_CHANGES,
    DUNGEON_RULES_VERSION_POLICY_VERSION,
    classifyDungeonRulesChange
} from './dungeon-versioning';
import { assessVersionGate } from './version-gate';

describe('DNG-003 dungeon rules versioning policy', () => {
    it('classifies replay-affecting dungeon changes as GAME_RULES_VERSION work', () => {
        expect(DUNGEON_RULES_VERSION_POLICY_VERSION).toBe('dng-003-dng-004-v1');

        for (const changeKind of DUNGEON_REPLAY_AFFECTING_CHANGES) {
            const decision = classifyDungeonRulesChange(changeKind);
            expect(decision.replayAffecting, changeKind).toBe(true);
            expect(decision.requiresGameRulesVersion, changeKind).toBe(true);
            expect(decision.requiredVerification.join(' '), changeKind).toContain('game.test.ts');
        }

        for (const changeKind of DUNGEON_NON_REPLAY_CHANGES) {
            const decision = classifyDungeonRulesChange(changeKind);
            expect(decision.replayAffecting, changeKind).toBe(false);
            expect(decision.requiresGameRulesVersion, changeKind).toBe(false);
        }
    });

    it('aligns route graph changes with the global version gate', () => {
        const dungeonDecision = classifyDungeonRulesChange('route_graph');
        const gateDecision = assessVersionGate({
            kinds: ['gameplay_rules'],
            touchedContracts: ['RunState'],
            playerVisibleRuleChange: true
        });

        expect(dungeonDecision.requiresGameRulesVersion).toBe(true);
        expect(gateDecision.requiredBumps).toContain('game_rules');
    });
});

describe('DNG-004 dungeon determinism contract', () => {
    it('names the persisted or derivable inputs needed for deterministic dungeon replay', () => {
        expect(DUNGEON_DETERMINISM_CONTRACT.requiredSeedInputs).toEqual(expect.arrayContaining([
            'runSeed',
            'runRulesVersion',
            'gameMode',
            'floor',
            'route choice id'
        ]));
        expect(DUNGEON_DETERMINISM_CONTRACT.allowedNondeterminism).toContain('animation timing');
    });

    it('keeps dungeon generation modules free of unseeded randomness and wall-clock rules input', () => {
        const checkedFiles = [
            'src/shared/run-map.ts',
            'src/shared/bonus-rewards.ts',
            'src/shared/relics.ts',
            'src/shared/floor-mutator-schedule.ts'
        ];
        const forbidden = /\b(Math\.random|Date\.now|performance\.now|new Date)\b/;

        for (const relativePath of checkedFiles) {
            const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
            expect(source, relativePath).not.toMatch(forbidden);
        }
    });
});

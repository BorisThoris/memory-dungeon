import { describe, expect, it } from 'vitest';
import { audioCoverageCueIsKnown } from './audioInteractionCoverage';
import { getReg114DuckRow } from './audioMixDuckingPolicy';
import {
    DUNGEON_AUDIO_EVENT_COVERAGE,
    getDungeonAudioEventCoverage,
    getDungeonAudioEventRow,
    type DungeonAudioEventId
} from './dungeonAudioEventCoverage';

describe('DNG-063 dungeon audio event coverage', () => {
    const criticalEvents: DungeonAudioEventId[] = [
        'dungeon_contact',
        'dungeon_reveal',
        'dungeon_trap_trigger',
        'dungeon_enemy_defeat',
        'dungeon_boss_defeat',
        'dungeon_treasure',
        'dungeon_shop_purchase',
        'dungeon_exit_open',
        'dungeon_route_choice'
    ];

    it('covers every critical dungeon event with a known non-silent cue', () => {
        expect(getDungeonAudioEventCoverage().map((row) => row.id)).toEqual(criticalEvents);
        expect(DUNGEON_AUDIO_EVENT_COVERAGE.every((row) => audioCoverageCueIsKnown(row.cue))).toBe(true);
        expect(DUNGEON_AUDIO_EVENT_COVERAGE.every((row) => String(row.cue) !== 'none')).toBe(true);
    });

    it('documents settings gain, ducking, and merge policy for each row', () => {
        for (const row of DUNGEON_AUDIO_EVENT_COVERAGE) {
            expect(row.respectsSettingsGain).toBe(true);
            expect(row.gainMultiplier).toBeGreaterThan(0);
            expect(row.gainMultiplier).toBeLessThanOrEqual(1);
            expect(row.mergePolicy.length).toBeGreaterThan(12);
            expect(row.semanticMoment.length).toBeGreaterThan(0);
            expect(getReg114DuckRow(row.ducking)).toBeDefined();
        }
    });

    it('keeps high-priority resolution events on the run-critical ducking lane', () => {
        expect(getDungeonAudioEventRow('dungeon_contact')?.ducking).toBe('run_critical_sfx');
        expect(getDungeonAudioEventRow('dungeon_contact')?.cue).toBe('mismatch');
        expect(getDungeonAudioEventRow('dungeon_contact')?.finalAssetStatus).toBe(
            'existing_sample_or_procedural_fallback'
        );
        expect(getDungeonAudioEventRow('dungeon_trap_trigger')?.cue).toBe('mismatch');
        expect(getDungeonAudioEventRow('dungeon_trap_trigger')?.mergePolicy).toMatch(/wins/i);
        expect(getDungeonAudioEventRow('dungeon_trap_trigger')?.callsite).toMatch(/playTrapSfx/i);
        expect(getDungeonAudioEventRow('dungeon_trap_trigger')?.finalAssetStatus).toBe(
            'existing_sample_or_procedural_fallback'
        );
        expect(getDungeonAudioEventRow('dungeon_route_choice')?.semanticMoment).toBe('route_choice');
        expect(getDungeonAudioEventRow('dungeon_boss_defeat')?.mergePolicy).toMatch(/suppresses/i);
        expect(getDungeonAudioEventRow('dungeon_shop_purchase')?.ducking).toBe('ui_click');
        expect(getDungeonAudioEventRow('dungeon_exit_open')?.finalAssetStatus).toBe(
            'existing_sample_or_procedural_fallback'
        );
    });
});

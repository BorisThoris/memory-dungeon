import type { Reg114DuckId } from './audioMixDuckingPolicy';
import type { AudioSemanticMoment } from './audioInteractionCoverage';
import type { SfxSampleKey } from './sampledSfx';
import type { UiSfxCue } from './uiSfx';

export type DungeonAudioEventId =
    | 'dungeon_contact'
    | 'dungeon_reveal'
    | 'dungeon_trap_trigger'
    | 'dungeon_enemy_defeat'
    | 'dungeon_boss_defeat'
    | 'dungeon_treasure'
    | 'dungeon_shop_purchase'
    | 'dungeon_exit_open'
    | 'dungeon_route_choice';

type DungeonAudioCue = SfxSampleKey | UiSfxCue;

interface DungeonAudioEventCoverageRow {
    id: DungeonAudioEventId;
    label: string;
    cue: DungeonAudioCue;
    callsite: string;
    semanticMoment: AudioSemanticMoment;
    gainMultiplier: number;
    ducking: Reg114DuckId;
    mergePolicy: string;
    respectsSettingsGain: true;
    finalAssetStatus: 'existing_sample_or_procedural_fallback' | 'placeholder_mapping';
}

export const DUNGEON_AUDIO_EVENT_COVERAGE: readonly DungeonAudioEventCoverageRow[] = [
    {
        id: 'dungeon_contact',
        label: 'Enemy contact resolves',
        cue: 'mismatch',
        callsite: 'useAppStore.pressTile enemy contact branch -> mismatch/danger resolve feedback',
        semanticMoment: 'fail',
        gainMultiplier: 0.95,
        ducking: 'run_critical_sfx',
        mergePolicy: 'contact suppresses reveal tick in the same resolution step',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_reveal',
        label: 'Dungeon card or patrol information reveals',
        cue: 'flip',
        callsite: 'Tile flip / preview reveal paths',
        semanticMoment: 'reveal',
        gainMultiplier: 0.72,
        ducking: 'ui_click',
        mergePolicy: 'merge repeated reveal ticks under flip category polyphony',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_trap_trigger',
        label: 'Trap card triggers',
        cue: 'mismatch',
        callsite: 'runSurfaceState trap delta -> tilePressAudioCues -> playTrapSfx',
        semanticMoment: 'fail',
        gainMultiplier: 0.9,
        ducking: 'run_critical_sfx',
        mergePolicy: 'trap trigger wins over generic mismatch when both occur',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_enemy_defeat',
        label: 'Enemy patrol defeated or pacified',
        cue: 'match-tier-low',
        callsite: 'enemy lifecycle defeat/pacify inventory row',
        semanticMoment: 'disarm',
        gainMultiplier: 0.82,
        ducking: 'run_critical_sfx',
        mergePolicy: 'defeat merges with match reward bloom, no extra rapid layer',
        respectsSettingsGain: true,
        finalAssetStatus: 'placeholder_mapping'
    },
    {
        id: 'dungeon_boss_defeat',
        label: 'Boss defeated',
        cue: 'floor-clear',
        callsite: 'defeat-boss objective completion / floor clear path',
        semanticMoment: 'reward',
        gainMultiplier: 1,
        ducking: 'run_critical_sfx',
        mergePolicy: 'boss defeat owns the resolution step and suppresses minor reward ticks',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_treasure',
        label: 'Treasure, cache, or secret reward claimed',
        cue: 'relic-pick',
        callsite: 'treasure/cache reward claim inventory row',
        semanticMoment: 'reward',
        gainMultiplier: 0.86,
        ducking: 'run_critical_sfx',
        mergePolicy: 'treasure claim merges duplicate currency pips into one reward cue',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_shop_purchase',
        label: 'Dungeon shop purchase or stock reroll succeeds',
        cue: 'confirm',
        callsite: 'typed ShopScreen purchase and reroll feedback',
        semanticMoment: 'commit',
        gainMultiplier: 0.78,
        ducking: 'ui_click',
        mergePolicy: 'one confirm per accepted shop command',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_exit_open',
        label: 'Exit opens or lock resolves',
        cue: 'power-arm',
        callsite: 'exit activation / lock resolution power-arm feedback',
        semanticMoment: 'lock',
        gainMultiplier: 0.84,
        ducking: 'run_critical_sfx',
        mergePolicy: 'exit open takes priority over reveal tick',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    },
    {
        id: 'dungeon_route_choice',
        label: 'Route choice confirmed',
        cue: 'confirm',
        callsite: 'ChooseYourPathScreen route confirmation',
        semanticMoment: 'route_choice',
        gainMultiplier: 0.74,
        ducking: 'ui_click',
        mergePolicy: 'single UI confirm, no additional board cue',
        respectsSettingsGain: true,
        finalAssetStatus: 'existing_sample_or_procedural_fallback'
    }
] as const;

export const getDungeonAudioEventCoverage = (): readonly DungeonAudioEventCoverageRow[] => DUNGEON_AUDIO_EVENT_COVERAGE;

export const getDungeonAudioEventRow = (id: DungeonAudioEventId): DungeonAudioEventCoverageRow | undefined =>
    DUNGEON_AUDIO_EVENT_COVERAGE.find((row) => row.id === id);

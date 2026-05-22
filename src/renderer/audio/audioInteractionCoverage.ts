import type { SfxSampleKey } from './sampledSfx';
import type { UiSfxCue } from './uiSfx';

export type AudioCoverageDomain = 'startup' | 'menu' | 'settings' | 'gameplay' | 'overlay' | 'meta';
export type AudioCoverageDecision = 'sampled_with_fallback' | 'procedural_only' | 'silent';
export type AudioSemanticMoment =
    | 'arm'
    | 'commit'
    | 'reveal'
    | 'reward'
    | 'fail'
    | 'disarm'
    | 'lock'
    | 'resolve'
    | 'floor_clear'
    | 'pressure'
    | 'route_choice'
    | 'navigation'
    | 'ambient';
type AudioCue = SfxSampleKey | UiSfxCue | 'none';

const GAMEPLAY_CUES = new Set<string>([
    'flip',
    'gambit-commit',
    'match-tier-low',
    'match-tier-mid',
    'match-tier-high',
    'mismatch',
    'power-arm',
    'destroy-pair',
    'peek-power',
    'stray-power',
    'shuffle-full',
    'shuffle-quick',
    'floor-clear',
    'relic-offer-open',
    'countdown-pressure',
    'relic-pick',
    'wager-arm'
]);

const UI_CUES = new Set<string>([
    'click',
    'confirm',
    'back',
    'counter',
    'menuOpen',
    'runStart',
    'introSting',
    'pauseOpen',
    'pauseResume',
    'gameOverOpen',
    'copy'
]);

export interface AudioInteractionCoverageRow {
    id: string;
    domain: AudioCoverageDomain;
    interaction: string;
    cue: AudioCue;
    callsite: string;
    semanticMoment: AudioSemanticMoment;
    decision: AudioCoverageDecision;
    cooldownPolicy: string;
    mixRole: string;
    reducedMotionSafe: boolean;
}

/**
 * REG-037: machine-readable mirror of docs/AUDIO_INTERACTION_MATRIX.md for the shippable
 * v1 call-site surface. It deliberately records semantic cue roles, not raw asset filenames.
 */
export const AUDIO_INTERACTION_COVERAGE: readonly AudioInteractionCoverageRow[] = [
    {
        id: 'startup_intro_complete',
        domain: 'startup',
        interaction: 'Startup intro completes or skip resolves',
        cue: 'introSting',
        callsite: 'StartupIntro.completeIntro',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'once per boot intro',
        mixRole: 'ceremonial relic sting',
        reducedMotionSafe: true
    },
    {
        id: 'menu_navigation',
        domain: 'menu',
        interaction: 'Main menu and Choose Path navigation',
        cue: 'menuOpen',
        callsite: 'MainMenu / ChooseYourPathScreen buttons',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'UI/menu polyphony cap',
        mixRole: 'panel reveal',
        reducedMotionSafe: true
    },
    {
        id: 'settings_adjust',
        domain: 'settings',
        interaction: 'Settings category/subsection/toggle/slider adjustment',
        cue: 'counter',
        callsite: 'SettingsScreen.patchSettings',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'counter tick throttled by SettingsScreen',
        mixRole: 'restrained settings tick',
        reducedMotionSafe: true
    },
    {
        id: 'tile_flip',
        domain: 'gameplay',
        interaction: 'Tile flip or gambit setup',
        cue: 'flip',
        callsite: 'useAppStore.pressTile -> playFlipSfx',
        semanticMoment: 'commit',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'flip category polyphony cap',
        mixRole: 'tactile card tick',
        reducedMotionSafe: true
    },
    {
        id: 'resolve_match',
        domain: 'gameplay',
        interaction: 'Successful pair resolve',
        cue: 'match-tier-low',
        callsite: 'applyResolveBoardTurn -> playResolveSfx',
        semanticMoment: 'reward',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'match category polyphony cap; tiered by streak depth',
        mixRole: 'reward bloom',
        reducedMotionSafe: true
    },
    {
        id: 'resolve_mismatch',
        domain: 'gameplay',
        interaction: 'Failed pair resolve',
        cue: 'mismatch',
        callsite: 'applyResolveBoardTurn -> playResolveSfx',
        semanticMoment: 'fail',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'mismatch category polyphony cap',
        mixRole: 'soft fail',
        reducedMotionSafe: true
    },
    {
        id: 'board_power',
        domain: 'gameplay',
        interaction: 'Arm or use board powers',
        cue: 'power-arm',
        callsite: 'useAppStore power actions',
        semanticMoment: 'arm',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'power category polyphony cap',
        mixRole: 'affirmative charge chirp',
        reducedMotionSafe: true
    },
    {
        id: 'floor_clear',
        domain: 'overlay',
        interaction: 'Floor clear overlay opens',
        cue: 'floor-clear',
        callsite: 'applyResolvedRun levelComplete transition',
        semanticMoment: 'floor_clear',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'deferred macrotask; shuffle/match caps still apply',
        mixRole: 'floor reward flourish',
        reducedMotionSafe: true
    },
    {
        id: 'gauntlet_pressure',
        domain: 'gameplay',
        interaction: 'Final gauntlet countdown seconds',
        cue: 'countdown-pressure',
        callsite: 'GameScreen gauntletRemainingMs effect',
        semanticMoment: 'pressure',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'one pulse per visible final second; pressure category polyphony cap',
        mixRole: 'low countdown pulse',
        reducedMotionSafe: true
    },
    {
        id: 'pause_resume',
        domain: 'overlay',
        interaction: 'Pause and resume',
        cue: 'pauseOpen',
        callsite: 'useAppStore.pause / useAppStore.resume',
        semanticMoment: 'navigation',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'menu category polyphony cap',
        mixRole: 'suspend/release chime',
        reducedMotionSafe: true
    },
    {
        id: 'relic_draft',
        domain: 'overlay',
        interaction: 'Relic offer opens and relic is picked',
        cue: 'relic-offer-open',
        callsite: 'GameScreen relic offer effect / useAppStore.pickRelic',
        semanticMoment: 'reward',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'power category polyphony cap',
        mixRole: 'mystical reveal and reward bloom',
        reducedMotionSafe: true
    },
    {
        id: 'game_over_open',
        domain: 'meta',
        interaction: 'Game over screen enters',
        cue: 'gameOverOpen',
        callsite: 'GameOverScreen mount',
        semanticMoment: 'resolve',
        decision: 'sampled_with_fallback',
        cooldownPolicy: 'once per post-run screen mount',
        mixRole: 'elegant downward close',
        reducedMotionSafe: true
    },
    {
        id: 'passive_scroll',
        domain: 'meta',
        interaction: 'Passive scroll and in-page anchors',
        cue: 'none',
        callsite: 'MetaScreen body scroll / TOC anchors',
        semanticMoment: 'ambient',
        decision: 'silent',
        cooldownPolicy: 'intentionally silent',
        mixRole: 'avoid UI fatigue',
        reducedMotionSafe: true
    }
];

export const getAudioCoverageRows = (): readonly AudioInteractionCoverageRow[] => AUDIO_INTERACTION_COVERAGE;

export const audioCoverageRowsByDomain = (domain: AudioCoverageDomain): AudioInteractionCoverageRow[] =>
    AUDIO_INTERACTION_COVERAGE.filter((row) => row.domain === domain);

export const audioCoverageCueIsKnown = (cue: AudioCue): boolean =>
    cue === 'none' || GAMEPLAY_CUES.has(cue) || UI_CUES.has(cue);

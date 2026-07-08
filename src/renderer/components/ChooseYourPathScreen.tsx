import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactElement
} from 'react';
import { getHubShellFitPadding } from '../hooks/hubShellFit';
import { useFitShellZoom } from '../hooks/useFitShellZoom';
import { useDragScroll } from '../hooks/useDragScroll';
import { isNarrowShortLandscapeForMenuStack, isShortLandscapeViewport, VIEWPORT_MOBILE_MAX } from '../breakpoints';
import { useViewportSize } from '../hooks/useViewportSize';
import { useShallow } from 'zustand/react/shallow';
import type { MutatorId } from '../../shared/contracts';
import { getChallengeModeGateRows } from '../../shared/challenge-progression';
import { MUTATOR_CATALOG } from '../../shared/mutators';
import {
    choosePathHeroModes,
    choosePathLibraryModes,
    RUN_MODE_GROUP_LABEL,
    type RunModeDefinition
} from '../../shared/run-mode-catalog';
import { isModePosterFallback, resolveModePosterUrl } from '../assets/ui/modeArt';
import { UI_ART } from '../assets/ui';
import { Eyebrow, MetaFrame, ScreenTitle, UiButton } from '../ui';
import {
    playMenuOpenSfx,
    playUiBackSfx,
    playUiClickSfx,
    playUiCounterSfx,
    resumeUiSfxContext,
    uiSfxGainFromSettings
} from '../audio/uiSfx';
import { useAppStore } from '../store/useAppStore';
import OverlayModal from './OverlayModal';
import metaStyles from './MetaScreen.module.css';
import styles from './ChooseYourPathScreen.module.css';

const MEDITATION_PICK_MUTATOR_IDS = (Object.keys(MUTATOR_CATALOG) as MutatorId[]).sort((a, b) =>
    MUTATOR_CATALOG[a]!.title.localeCompare(MUTATOR_CATALOG[b]!.title)
);

type ModeChoiceSignalTone = 'pace' | 'payoff' | 'pressure' | 'constraint' | 'practice' | 'locked';
type ModeLoopCueTone = 'chain' | 'route' | 'build' | 'pressure' | 'practice' | 'locked';

interface ModeChoiceSignal {
    label: string;
    value: string;
    tone: ModeChoiceSignalTone;
}

interface ModeLoopCue {
    detail: string;
    headline: string;
    tone: ModeLoopCueTone;
}

type ModeChoiceLaneId = 'chain' | 'reward' | 'pressure' | 'practice' | 'locked';

interface ModeChoiceLaneMapEntry {
    id: ModeChoiceLaneId;
    label: string;
    count: number;
    cue: string;
}

const MODE_CHOICE_LANE_ORDER: readonly ModeChoiceLaneId[] = ['chain', 'reward', 'pressure', 'practice', 'locked'];

const MODE_CHOICE_LANE_LABEL: Record<ModeChoiceLaneId, string> = {
    chain: 'Chain',
    reward: 'Reward',
    pressure: 'Pressure',
    practice: 'Practice',
    locked: 'Locked'
};

const MODE_CHOICE_SIGNALS: Record<string, readonly ModeChoiceSignal[]> = {
    classic: [
        { label: 'Pace', value: 'Escalating floors', tone: 'pace' },
        { label: 'Payoff', value: 'Shops + relics', tone: 'payoff' },
        { label: 'Pressure', value: 'Route choices', tone: 'pressure' }
    ],
    daily: [
        { label: 'Pace', value: 'UTC seed', tone: 'pace' },
        { label: 'Payoff', value: 'Fair compare', tone: 'payoff' },
        { label: 'Pressure', value: 'Daily mutators', tone: 'pressure' }
    ],
    dungeon_showcase: [
        { label: 'Pace', value: 'Immediate dungeon', tone: 'pace' },
        { label: 'Payoff', value: 'Dungeon systems', tone: 'payoff' },
        { label: 'Pressure', value: 'Boss + locks', tone: 'pressure' }
    ],
    endless: [
        { label: 'Status', value: 'Future mode', tone: 'locked' },
        { label: 'Focus', value: 'Fatigue tuning', tone: 'constraint' },
        { label: 'Payoff', value: 'Not live yet', tone: 'locked' }
    ],
    gauntlet: [
        { label: 'Pace', value: 'Timer', tone: 'pressure' },
        { label: 'Payoff', value: 'Timed clears', tone: 'payoff' },
        { label: 'Pressure', value: 'Countdown', tone: 'pressure' }
    ],
    puzzle_starter: [
        { label: 'Pace', value: 'Fixed board', tone: 'practice' },
        { label: 'Payoff', value: 'Solve route', tone: 'payoff' },
        { label: 'Pressure', value: 'No sprawl', tone: 'practice' }
    ],
    puzzle_mirror: [
        { label: 'Pace', value: 'Mirror layout', tone: 'practice' },
        { label: 'Payoff', value: 'Pattern read', tone: 'payoff' },
        { label: 'Pressure', value: 'Intermediate', tone: 'pressure' }
    ],
    puzzle_glyph_cross: [
        { label: 'Pace', value: '4x2 glyphs', tone: 'practice' },
        { label: 'Payoff', value: 'Route proof', tone: 'payoff' },
        { label: 'Pressure', value: 'Advanced', tone: 'pressure' }
    ],
    wild: [
        { label: 'Pace', value: 'Fast chaos', tone: 'pressure' },
        { label: 'Payoff', value: 'Power discovery', tone: 'payoff' },
        { label: 'Pressure', value: 'Swingy floors', tone: 'pressure' }
    ],
    practice: [
        { label: 'Pace', value: 'Low pressure', tone: 'practice' },
        { label: 'Payoff', value: 'Learn tools', tone: 'payoff' },
        { label: 'Pressure', value: 'No mastery chase', tone: 'practice' }
    ],
    scholar: [
        { label: 'Pace', value: 'Pure recall', tone: 'constraint' },
        { label: 'Payoff', value: 'Extra relic choice', tone: 'payoff' },
        { label: 'Constraint', value: 'No rescue tools', tone: 'constraint' }
    ],
    pin_vow: [
        { label: 'Pace', value: 'Mark budget', tone: 'constraint' },
        { label: 'Payoff', value: 'Clean planning', tone: 'payoff' },
        { label: 'Constraint', value: '10 pins', tone: 'constraint' }
    ],
    meditation: [
        { label: 'Pace', value: 'Calm study', tone: 'practice' },
        { label: 'Payoff', value: 'Longer memorize', tone: 'payoff' },
        { label: 'Pressure', value: 'Optional mutators', tone: 'practice' }
    ]
};

const fallbackModeChoiceSignals = (def: RunModeDefinition): readonly ModeChoiceSignal[] => [
    { label: 'Pace', value: RUN_MODE_GROUP_LABEL[def.group], tone: 'pace' },
    { label: 'Payoff', value: def.identityTag ?? 'Mode rules', tone: 'payoff' },
    {
        label: def.availability === 'available' ? 'Pressure' : 'Status',
        value: def.availability === 'available' ? 'Unique loop' : 'Unavailable',
        tone: def.availability === 'available' ? 'pressure' : 'locked'
    }
];

const getModeChoiceSignals = (def: RunModeDefinition): readonly ModeChoiceSignal[] =>
    MODE_CHOICE_SIGNALS[def.id] ?? fallbackModeChoiceSignals(def);

const modeChoiceSignalAria = (signals: readonly ModeChoiceSignal[]): string =>
    signals.map((signal) => `${signal.label}: ${signal.value}`).join('. ');

const modeChoiceSignalBeatCount = (signal: ModeChoiceSignal): 2 | 3 | 4 => {
    if (signal.tone === 'payoff') {
        return 4;
    }
    if (signal.tone === 'pressure' || signal.tone === 'constraint') {
        return 3;
    }
    return 2;
};

const modeChoiceSignalAction = (
    signal: ModeChoiceSignal
): 'Build chain' | 'Chase reward' | 'Read pressure' | 'Practice route' | 'Preview lock' => {
    if (signal.tone === 'payoff') {
        return 'Chase reward';
    }
    if (signal.tone === 'pressure' || signal.tone === 'constraint') {
        return 'Read pressure';
    }
    if (signal.tone === 'practice') {
        return 'Practice route';
    }
    if (signal.tone === 'locked') {
        return 'Preview lock';
    }
    return 'Build chain';
};

const modeChoiceSignalAudioCue = (
    signal: ModeChoiceSignal
): 'mode-signal-chain' | 'mode-signal-reward' | 'mode-signal-pressure' | 'mode-signal-practice' | 'mode-signal-locked' => {
    if (signal.tone === 'payoff') {
        return 'mode-signal-reward';
    }
    if (signal.tone === 'pressure' || signal.tone === 'constraint') {
        return 'mode-signal-pressure';
    }
    if (signal.tone === 'practice') {
        return 'mode-signal-practice';
    }
    if (signal.tone === 'locked') {
        return 'mode-signal-locked';
    }
    return 'mode-signal-chain';
};

const modeChoiceSignalScreenCue = (signal: ModeChoiceSignal): 'pulse' | 'burst' | 'guard' | 'snap' | 'locked' => {
    if (signal.tone === 'payoff') {
        return 'burst';
    }
    if (signal.tone === 'pressure' || signal.tone === 'constraint') {
        return 'guard';
    }
    if (signal.tone === 'practice') {
        return 'snap';
    }
    if (signal.tone === 'locked') {
        return 'locked';
    }
    return 'pulse';
};

const modeChoiceLaneId = (signal: ModeChoiceSignal): ModeChoiceLaneId => {
    if (signal.tone === 'payoff') {
        return 'reward';
    }
    if (signal.tone === 'pressure' || signal.tone === 'constraint') {
        return 'pressure';
    }
    if (signal.tone === 'practice') {
        return 'practice';
    }
    if (signal.tone === 'locked') {
        return 'locked';
    }
    return 'chain';
};

const buildModeChoiceLaneMap = (signals: readonly ModeChoiceSignal[]): ModeChoiceLaneMapEntry[] => {
    const lanes = new Map<ModeChoiceLaneId, { count: number; cue: string }>();
    for (const signal of signals) {
        const lane = modeChoiceLaneId(signal);
        const existing = lanes.get(lane);
        lanes.set(lane, {
            count: (existing?.count ?? 0) + 1,
            cue: existing?.cue ?? signal.value
        });
    }
    return MODE_CHOICE_LANE_ORDER.flatMap((id) => {
        const lane = lanes.get(id);
        return lane ? [{ id, label: MODE_CHOICE_LANE_LABEL[id], count: lane.count, cue: lane.cue }] : [];
    });
};

const modeChoiceLaneMapAttr = (laneMap: readonly ModeChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${entry.count}`).join('>');

const modeChoiceLaneAction = (lane: ModeChoiceLaneMapEntry): string => {
    switch (lane.id) {
        case 'chain':
            return 'Build chain';
        case 'reward':
            return 'Chase reward';
        case 'pressure':
            return 'Read pressure';
        case 'practice':
            return 'Practice route';
        case 'locked':
            return 'Preview lock';
        default:
            return 'Read mode';
    }
};

const modeChoiceLaneBeatCount = (lane: ModeChoiceLaneMapEntry): 1 | 2 | 3 | 4 => {
    switch (lane.id) {
        case 'chain':
        case 'reward':
            return 4;
        case 'pressure':
            return 3;
        case 'practice':
            return 2;
        case 'locked':
            return 1;
        default:
            return 2;
    }
};

const modeChoiceLaneAudioCue = (
    lane: ModeChoiceLaneMapEntry
): 'mode-lane-chain' | 'mode-lane-reward' | 'mode-lane-pressure' | 'mode-lane-practice' | 'mode-lane-locked' => {
    switch (lane.id) {
        case 'reward':
            return 'mode-lane-reward';
        case 'pressure':
            return 'mode-lane-pressure';
        case 'practice':
            return 'mode-lane-practice';
        case 'locked':
            return 'mode-lane-locked';
        default:
            return 'mode-lane-chain';
    }
};

const modeChoiceLaneScreenCue = (lane: ModeChoiceLaneMapEntry): 'burst' | 'reward' | 'guard' | 'snap' | 'locked' => {
    switch (lane.id) {
        case 'reward':
            return 'reward';
        case 'pressure':
            return 'guard';
        case 'practice':
            return 'snap';
        case 'locked':
            return 'locked';
        default:
            return 'burst';
    }
};

const modeChoiceLaneActionMapAttr = (laneMap: readonly ModeChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${modeChoiceLaneAction(entry)}:${entry.count}`).join('>');

const modeChoiceLaneRole = (entry: ModeChoiceLaneMapEntry): 'Build' | 'Locked' | 'Practice' | 'Pressure' | 'Reward' => {
    switch (entry.id) {
        case 'reward':
            return 'Reward';
        case 'pressure':
            return 'Pressure';
        case 'practice':
            return 'Practice';
        case 'locked':
            return 'Locked';
        case 'chain':
        default:
            return 'Build';
    }
};

const modeChoiceLaneRoleMapAttr = (laneMap: readonly ModeChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${modeChoiceLaneRole(entry)}:${entry.count}`).join('>');

const modeChoiceLaneRoleId = (entry: ModeChoiceLaneMapEntry): 'build' | 'locked' | 'practice' | 'pressure' | 'reward' => {
    switch (entry.id) {
        case 'reward':
            return 'reward';
        case 'pressure':
            return 'pressure';
        case 'practice':
            return 'practice';
        case 'locked':
            return 'locked';
        case 'chain':
        default:
            return 'build';
    }
};

const modeChoiceLaneRoleIdMapAttr = (laneMap: readonly ModeChoiceLaneMapEntry[]): string =>
    laneMap.map((entry) => `${entry.id}:${modeChoiceLaneRoleId(entry)}:${entry.count}`).join('>');

const modeChoiceLaneMapLabel = (
    def: RunModeDefinition,
    placement: 'launch' | 'tile' | 'detail',
    laneMap: readonly ModeChoiceLaneMapEntry[]
): string => {
    const rows = laneMap
        .map((entry) => `${entry.label} ${modeChoiceLaneRole(entry)} x${entry.count}. ${modeChoiceLaneAction(entry)}. ${entry.cue}`)
        .join('. ');
    return rows ? `${def.title} ${placement} lane map. ${rows}.` : `${def.title} ${placement} lane map.`;
};

const MODE_LOOP_CUES: Record<string, ModeLoopCue> = {
    classic: {
        headline: 'Chain into route rewards',
        detail: 'Clear clean pairs, pick the next room, then turn shops and relic milestones into a stronger board plan.',
        tone: 'build'
    },
    daily: {
        headline: 'One seed, clean proof',
        detail: 'Every decision is comparable: build streaks, preserve resources, and post a fair local score.',
        tone: 'chain'
    },
    dungeon_showcase: {
        headline: 'Read locks before pressure spikes',
        detail: 'Practice enemies, keys, traps, shops, and bosses with the dungeon vocabulary visible from the first floor.',
        tone: 'route'
    },
    endless: {
        headline: 'Long-form balance lab',
        detail: 'Reserved for fatigue, reward, and scaling passes after Classic proves the core run loop.',
        tone: 'locked'
    },
    gauntlet: {
        headline: 'Timed streak sprint',
        detail: 'Fast matches matter more than perfect routing; every chain is racing the clock.',
        tone: 'pressure'
    },
    puzzle_starter: {
        headline: 'Solve the visible pattern',
        detail: 'A fixed board turns the loop into proof: read, match, and finish without procedural noise.',
        tone: 'practice'
    },
    puzzle_mirror: {
        headline: 'Mirror the route in memory',
        detail: 'Use symmetry to compress the board and prove the intermediate pattern.',
        tone: 'practice'
    },
    puzzle_glyph_cross: {
        headline: 'Advanced pattern route',
        detail: 'Small board, higher precision: plan the glyph sequence before committing matches.',
        tone: 'practice'
    },
    wild: {
        headline: 'Power spikes every floor',
        detail: 'Jokers, pickups, and volatile rules make route payoff loud and swingy.',
        tone: 'build'
    },
    practice: {
        headline: 'Rehearse without stakes',
        detail: 'Try tools, traits, and routes without achievement pressure or mastery pollution.',
        tone: 'practice'
    },
    scholar: {
        headline: 'Pure recall contract',
        detail: 'No rescue tools: the payoff is clean memory, clean routes, and fewer excuses.',
        tone: 'chain'
    },
    pin_vow: {
        headline: 'Mark only what matters',
        detail: 'Limited pins make every safe match and every route prime a deliberate commitment.',
        tone: 'route'
    },
    meditation: {
        headline: 'Slow-read build lab',
        detail: 'Longer memorize windows let you study traits, mutators, and board routes before pressure returns.',
        tone: 'practice'
    }
};

const fallbackModeLoopCue = (def: RunModeDefinition): ModeLoopCue => ({
    headline: def.availability === 'available' ? def.identityTag ?? 'Unique run loop' : 'Not available yet',
    detail: def.promise ?? def.outcomeSummary ?? def.shortDescription,
    tone: def.availability === 'available' ? 'route' : 'locked'
});

const getModeLoopCue = (def: RunModeDefinition): ModeLoopCue => MODE_LOOP_CUES[def.id] ?? fallbackModeLoopCue(def);

function cardsPerPageFromWidth(widthPx: number): number {
    if (widthPx <= 0) {
        return 1;
    }
    if (widthPx < 640) {
        return 2;
    }
    if (widthPx < 1100) {
        return 4;
    }
    return 5;
}

function LibrarySearchMagnifierIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
            <circle cx="10.5" cy="10.5" fill="none" r="6.75" stroke="currentColor" strokeWidth="2" />
            <path d="M16.25 16.25 21 21" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
    );
}

function BackChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 16 16" aria-hidden>
            <path
                d="M9.75 3.25 5 8l4.75 4.75"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
            />
        </svg>
    );
}

const ChooseYourPathScreen = () => {
    const {
        closeSubscreen,
        openSettings,
        startDailyRun,
        startDungeonShowcaseRun,
        startGauntletRun,
        startMeditationRun,
        startMeditationRunWithMutators,
        startPinVowRun,
        startPracticeRun,
        startPuzzleRun,
        startRun,
        startScholarContractRun,
        startWildRun,
        saveData,
        settings
    } = useAppStore(
        useShallow((state) => ({
            closeSubscreen: state.closeSubscreen,
            openSettings: state.openSettings,
            startDailyRun: state.startDailyRun,
            startDungeonShowcaseRun: state.startDungeonShowcaseRun,
            startGauntletRun: state.startGauntletRun,
            startMeditationRun: state.startMeditationRun,
            startMeditationRunWithMutators: state.startMeditationRunWithMutators,
            startPinVowRun: state.startPinVowRun,
            startPracticeRun: state.startPracticeRun,
            startPuzzleRun: state.startPuzzleRun,
            startRun: state.startRun,
            startScholarContractRun: state.startScholarContractRun,
            startWildRun: state.startWildRun,
            saveData: state.saveData,
            settings: state.settings
        }))
    );
    const pathFitMeasureRef = useRef<HTMLDivElement | null>(null);
    const librarySearchInputRef = useRef<HTMLInputElement | null>(null);
    const libraryScrollerRef = useRef<HTMLDivElement | null>(null);
    const {
        onPointerDownCapture: onLibraryDragPointerDown,
        onKeyDownCapture: onLibraryScrollerKeyDownCapture,
        tabIndex: libraryScrollerTabIndex
    } = useDragScroll(libraryScrollerRef);
    const { height: vpH, width: vpW } = useViewportSize();
    const isPhoneViewport = vpW <= VIEWPORT_MOBILE_MAX;
    const isShortLandscapeShell = isShortLandscapeViewport(vpW, vpH);
    const pathFitPadding = getHubShellFitPadding(vpW, vpH, 'choosePath');
    const pathTouchCompact = isPhoneViewport || isNarrowShortLandscapeForMenuStack(vpW, vpH);
    const presetButtonSize = pathTouchCompact ? 'sm' : 'md';
    const { fitZoom: rawPathFitZoom } = useFitShellZoom({
        enabled: true,
        measureRef: pathFitMeasureRef,
        viewportWidth: vpW,
        viewportHeight: vpH,
        padding: pathFitPadding
    });
    const pathShellFitZoom = rawPathFitZoom;
    const uiGain = uiSfxGainFromSettings(settings.masterVolume, settings.sfxVolume);
    const playUiClick = useCallback((): void => {
        resumeUiSfxContext();
        playUiClickSfx(uiGain);
    }, [uiGain]);
    const playUiCounter = useCallback((): void => {
        resumeUiSfxContext();
        playUiCounterSfx(uiGain);
    }, [uiGain]);
    const playUiBack = useCallback((): void => {
        resumeUiSfxContext();
        playUiBackSfx(uiGain);
    }, [uiGain]);
    const playMenuOpen = useCallback((): void => {
        resumeUiSfxContext();
        playMenuOpenSfx(uiGain);
    }, [uiGain]);

    const [libraryQuery, setLibraryQuery] = useState('');
    const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
    const [browseOpen, setBrowseOpen] = useState(true);
    const [cardsPerPage, setCardsPerPage] = useState(2);
    const [libraryPageIndex, setLibraryPageIndex] = useState(0);

    const [libraryDetailMode, setLibraryDetailMode] = useState<RunModeDefinition | null>(null);
    const [meditationOpen, setMeditationOpen] = useState(false);
    const [meditationSelection, setMeditationSelection] = useState<Set<MutatorId>>(() => new Set());
    const challengeGateRows = getChallengeModeGateRows(saveData);

    const heroModes = useMemo((): readonly RunModeDefinition[] => choosePathHeroModes(), []);
    const launchMode = useMemo((): RunModeDefinition | null => {
        const preferredLaunchId = saveData.onboardingDismissed ? 'dungeon_showcase' : 'classic';
        return (
            heroModes.find((mode) => mode.id === preferredLaunchId && mode.availability === 'available') ??
            heroModes.find((mode) => mode.availability === 'available') ??
            null
        );
    }, [heroModes, saveData.onboardingDismissed]);
    const browseModes = useMemo(
        (): readonly RunModeDefinition[] => [
            ...heroModes.filter((mode) => mode.id !== launchMode?.id),
            ...choosePathLibraryModes()
        ],
        [heroModes, launchMode?.id]
    );

    const filteredLibraryModes = useMemo(() => {
        const q = libraryQuery.trim().toLowerCase();
        const base = browseModes;
        if (!q) {
            return base;
        }
        return base.filter(
            (m) => m.title.toLowerCase().includes(q) || m.shortDescription.toLowerCase().includes(q)
        );
    }, [browseModes, libraryQuery]);
    const libraryPages = useMemo(() => {
        if (filteredLibraryModes.length === 0 || cardsPerPage < 1) {
            return [];
        }
        const chunks: RunModeDefinition[][] = [];
        for (let i = 0; i < filteredLibraryModes.length; i += cardsPerPage) {
            chunks.push(filteredLibraryModes.slice(i, i + cardsPerPage));
        }
        return chunks;
    }, [filteredLibraryModes, cardsPerPage]);

    const libraryPageCount = libraryPages.length;
    const hasLibrarySearchQuery = libraryQuery.trim().length > 0;
    const selectedMode = libraryDetailMode ?? launchMode;

    useLayoutEffect(() => {
        const el = libraryScrollerRef.current;
        if (!el) {
            return undefined;
        }
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? el.clientWidth;
            setCardsPerPage(cardsPerPageFromWidth(Math.min(w, vpW)));
        });
        ro.observe(el);
        setCardsPerPage(cardsPerPageFromWidth(Math.min(el.clientWidth, vpW)));
        return () => {
            ro.disconnect();
        };
    }, [browseOpen, filteredLibraryModes.length, vpW]);

    useEffect(() => {
        const el = libraryScrollerRef.current;
        if (el) {
            el.scrollLeft = 0;
        }
        queueMicrotask(() => {
            setLibraryPageIndex(0);
        });
    }, [libraryQuery, filteredLibraryModes.length]);

    const onLibraryScroll = useCallback((): void => {
        const el = libraryScrollerRef.current;
        if (!el) {
            return;
        }
        const w = el.clientWidth;
        if (w <= 0 || libraryPageCount <= 0) {
            setLibraryPageIndex(0);
            return;
        }
        setLibraryPageIndex(Math.min(libraryPageCount - 1, Math.max(0, Math.round(el.scrollLeft / w))));
    }, [libraryPageCount]);

    useEffect(() => {
        if (!librarySearchOpen) {
            return undefined;
        }
        const id = window.requestAnimationFrame(() => {
            librarySearchInputRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [librarySearchOpen]);

    useEffect(() => {
        if (!librarySearchOpen) {
            return undefined;
        }
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setLibrarySearchOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [librarySearchOpen]);

    const toggleMeditationMutator = (id: MutatorId): void => {
        playUiCounter();
        setMeditationSelection((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const runModeAction = (def: RunModeDefinition): void => {
        const { action } = def;
        switch (action.type) {
            case 'startRun':
                startRun();
                return;
            case 'startDungeonShowcaseRun':
                startDungeonShowcaseRun();
                return;
            case 'startDailyRun':
                startDailyRun();
                return;
            case 'locked':
                return;
            case 'gauntlet':
                return;
            case 'puzzle':
                startPuzzleRun(action.puzzleId);
                return;
            case 'startWildRun':
                startWildRun();
                return;
            case 'startPracticeRun':
                startPracticeRun();
                return;
            case 'startScholarContractRun':
                startScholarContractRun();
                return;
            case 'startPinVowRun':
                startPinVowRun();
                return;
            case 'meditationSetup':
                playMenuOpen();
                setMeditationOpen(true);
                return;
        }
    };

    const closeLibraryDetail = useCallback((): void => {
        playUiBack();
        setLibraryDetailMode(null);
    }, [playUiBack]);

    const openBrowse = useCallback((): void => {
        playMenuOpen();
        setBrowseOpen(true);
    }, [playMenuOpen]);

    const closeBrowse = useCallback((): void => {
        playUiBack();
        setBrowseOpen(false);
        setLibrarySearchOpen(false);
        setLibraryQuery('');
    }, [playUiBack]);

    const cardVariantClass = (def: RunModeDefinition): string => {
        if (def.id === 'classic') {
            return styles.cardClassic;
        }
        if (def.id === 'daily') {
            return styles.cardDaily;
        }
        if (def.id === 'endless') {
            return `${styles.cardEndless} ${styles.cardDisabled}`;
        }
        if (def.action.type === 'gauntlet') {
            return styles.cardGauntlet;
        }
        return styles.cardMode;
    };

    const renderModeSignalStrip = (
        def: RunModeDefinition,
        placement: 'launch' | 'tile' | 'detail'
    ): ReactElement => {
        const signals = getModeChoiceSignals(def);
        const signalText = modeChoiceSignalAria(signals);
        const laneMap = buildModeChoiceLaneMap(signals);
        const primaryModeLane = laneMap[0] ?? null;
        const laneMapAttr = modeChoiceLaneMapAttr(laneMap);
        const laneRoleMapAttr = modeChoiceLaneRoleMapAttr(laneMap);
        const laneRoleIdMapAttr = modeChoiceLaneRoleIdMapAttr(laneMap);
        return (
            <span
                aria-label={`${def.title} ${placement} signals. ${signalText}`}
                className={`${styles.modeSignalStrip} ${styles[`modeSignalStrip_${placement}`]}`}
                data-mode-lane-actions={modeChoiceLaneActionMapAttr(laneMap)}
                data-mode-lane-map={laneMapAttr}
                data-mode-lane-role-ids={laneRoleIdMapAttr}
                data-mode-lane-roles={laneRoleMapAttr}
                data-testid={`choose-path-mode-signals-${def.id}`}
            >
                {laneMap.length > 1 ? (
                    <span
                        aria-label={modeChoiceLaneMapLabel(def, placement, laneMap)}
                        className={styles.modeLaneMap}
                        data-mode-lane-actions={modeChoiceLaneActionMapAttr(laneMap)}
                        data-mode-lane-map={laneMapAttr}
                        data-mode-lane-role-ids={laneRoleIdMapAttr}
                        data-mode-lane-roles={laneRoleMapAttr}
                        data-mode-primary-lane={primaryModeLane?.id ?? 'none'}
                        data-mode-primary-lane-action={primaryModeLane ? modeChoiceLaneAction(primaryModeLane) : 'none'}
                        data-mode-primary-lane-audio={primaryModeLane ? modeChoiceLaneAudioCue(primaryModeLane) : 'none'}
                        data-mode-primary-lane-beats={primaryModeLane ? modeChoiceLaneBeatCount(primaryModeLane) : 0}
                        data-mode-primary-lane-cue={primaryModeLane?.cue ?? 'none'}
                        data-mode-primary-lane-role={primaryModeLane ? modeChoiceLaneRole(primaryModeLane) : 'none'}
                        data-mode-primary-lane-role-id={primaryModeLane ? modeChoiceLaneRoleId(primaryModeLane) : 'none'}
                        data-mode-primary-lane-screen-cue={primaryModeLane ? modeChoiceLaneScreenCue(primaryModeLane) : 'none'}
                        data-testid={`choose-path-mode-lane-map-${def.id}-${placement}`}
                    >
                        <i
                            aria-label={`Mode lane summary. ${laneMap.length} ${
                                laneMap.length === 1 ? 'lane' : 'lanes'
                            }. ${primaryModeLane ? `${modeChoiceLaneRole(primaryModeLane)} ${primaryModeLane.label}` : 'No lead lane'}.`}
                            className={styles.modeLaneMapSummary}
                            data-mode-lane-count={laneMap.length}
                            data-mode-lane-summary-primary={primaryModeLane?.id ?? 'none'}
                            data-mode-lane-summary-primary-action={primaryModeLane ? modeChoiceLaneAction(primaryModeLane) : 'none'}
                            data-mode-lane-summary-primary-audio={primaryModeLane ? modeChoiceLaneAudioCue(primaryModeLane) : 'none'}
                            data-mode-lane-summary-primary-role={primaryModeLane ? modeChoiceLaneRole(primaryModeLane) : 'none'}
                            data-mode-lane-summary-primary-role-id={primaryModeLane ? modeChoiceLaneRoleId(primaryModeLane) : 'none'}
                            data-mode-lane-summary-primary-screen-cue={
                                primaryModeLane ? modeChoiceLaneScreenCue(primaryModeLane) : 'none'
                            }
                            data-testid={`choose-path-mode-lane-map-summary-${def.id}-${placement}`}
                        >
                            <small>Lanes</small>
                            <strong>
                                {laneMap.length} {laneMap.length === 1 ? 'lane' : 'lanes'}
                            </strong>
                            <b>{primaryModeLane ? `${modeChoiceLaneRole(primaryModeLane)} ${primaryModeLane.label}` : 'No lead lane'}</b>
                            <span aria-hidden="true" className={styles.modeLaneMapSummaryBeatPips}>
                                {Array.from({ length: Math.max(2, Math.min(5, laneMap.length + 1)) }, (_, beatIndex) => (
                                    <s
                                        data-mode-lane-map-summary-beat={beatIndex + 1}
                                        data-mode-lane-map-summary-beat-focus={
                                            beatIndex === 0 ? primaryModeLane?.id ?? 'none' : 'support'
                                        }
                                        data-mode-lane-map-summary-beat-role-id={
                                            primaryModeLane ? modeChoiceLaneRoleId(primaryModeLane) : 'none'
                                        }
                                        data-mode-lane-map-summary-beat-screen-cue={
                                            primaryModeLane ? modeChoiceLaneScreenCue(primaryModeLane) : 'none'
                                        }
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </i>
                        {primaryModeLane ? (
                            <i
                                aria-label={`Primary mode lane. ${modeChoiceLaneRole(primaryModeLane)} ${primaryModeLane.label}: ${modeChoiceLaneAction(primaryModeLane)}. ${primaryModeLane.cue}. ${modeChoiceLaneBeatCount(primaryModeLane)} beats.`}
                                className={styles.modePrimaryLaneCue}
                                data-mode-primary-lane={primaryModeLane.id}
                                data-mode-primary-lane-action={modeChoiceLaneAction(primaryModeLane)}
                                data-mode-primary-lane-audio={modeChoiceLaneAudioCue(primaryModeLane)}
                                data-mode-primary-lane-beats={modeChoiceLaneBeatCount(primaryModeLane)}
                                data-mode-primary-lane-cue={primaryModeLane.cue}
                                data-mode-primary-lane-role={modeChoiceLaneRole(primaryModeLane)}
                                data-mode-primary-lane-role-id={modeChoiceLaneRoleId(primaryModeLane)}
                                data-mode-primary-lane-screen-cue={modeChoiceLaneScreenCue(primaryModeLane)}
                                data-testid={`choose-path-mode-primary-lane-${def.id}-${placement}`}
                            >
                                <small>Launch loop</small>
                                <strong>{modeChoiceLaneRole(primaryModeLane)}</strong>
                                <b>{modeChoiceLaneAction(primaryModeLane)}</b>
                                <em>{primaryModeLane.cue}</em>
                                <span aria-hidden="true" className={styles.modePrimaryLaneBeatPips}>
                                    {Array.from({ length: modeChoiceLaneBeatCount(primaryModeLane) }, (_, beatIndex) => (
                                        <s
                                            data-mode-primary-lane-beat={beatIndex + 1}
                                            data-mode-primary-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                            key={beatIndex}
                                        />
                                    ))}
                                </span>
                            </i>
                        ) : null}
                        {laneMap.map((lane) => (
                            <i
                                data-mode-lane={lane.id}
                                data-mode-lane-action={modeChoiceLaneAction(lane)}
                                data-mode-lane-role={modeChoiceLaneRole(lane)}
                                data-mode-lane-role-id={modeChoiceLaneRoleId(lane)}
                                key={lane.id}
                            >
                                <small>{lane.label}</small>
                                <strong>{modeChoiceLaneRole(lane)}</strong>
                                <b>{modeChoiceLaneAction(lane)}</b>
                                <em>
                                    x{lane.count} / {lane.cue}
                                </em>
                            </i>
                        ))}
                    </span>
                ) : null}
                {signals.map((signal) => {
                    const beatCount = modeChoiceSignalBeatCount(signal);
                    return (
                        <span
                            data-mode-signal-action={modeChoiceSignalAction(signal)}
                            data-mode-signal-audio={modeChoiceSignalAudioCue(signal)}
                            data-mode-signal-beats={beatCount}
                            data-mode-signal-screen-cue={modeChoiceSignalScreenCue(signal)}
                            data-mode-signal-tone={signal.tone}
                            key={`${def.id}-${signal.label}-${signal.value}`}
                        >
                            <small>{signal.label}</small>
                            <strong>{signal.value}</strong>
                            <b>{modeChoiceSignalAction(signal)}</b>
                            <span aria-hidden="true" className={styles.modeSignalBeatPips}>
                                {Array.from({ length: beatCount }, (_, beatIndex) => (
                                    <i
                                        data-mode-signal-beat={beatIndex + 1}
                                        data-mode-signal-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={beatIndex}
                                    />
                                ))}
                            </span>
                        </span>
                    );
                })}
            </span>
        );
    };

    const renderModeLoopCue = (def: RunModeDefinition, placement: 'launch' | 'detail'): ReactElement => {
        const cue = getModeLoopCue(def);
        return (
            <div
                aria-label={`${def.title} gameplay loop. ${cue.headline}. ${cue.detail}`}
                className={`${styles.modeLoopCue} ${styles[`modeLoopCue_${placement}`]}`}
                data-loop-cue-tone={cue.tone}
                data-testid={`choose-path-mode-loop-${def.id}`}
            >
                <small>Run loop</small>
                <strong>{cue.headline}</strong>
                <span>{cue.detail}</span>
            </div>
        );
    };

    const renderLaunchPanel = (def: RunModeDefinition): ReactElement => {
        const poster = resolveModePosterUrl(def.posterKey);
        const canStart = def.availability === 'available' && def.action.type !== 'gauntlet';
        const freshClassicLaunch = def.id === 'classic' && !saveData.onboardingDismissed;
        const signalText = modeChoiceSignalAria(getModeChoiceSignals(def));
        const startActionCue = getModeLoopCue(def);
        const summary =
            freshClassicLaunch
                ? 'Start with a guided first room: match the marked pair, clear the floor, then choose what the next room changes.'
                : def.id === 'classic'
                  ? 'A clean dungeon descent with procedural floors, route choices, shops, and relic milestones.'
                : def.shortDescription;

        return (
            <section aria-label="Recommended run" className={styles.launchSection} data-testid="choose-path-launcher">
                <div className={styles.launchPanel}>
                    <span className={styles.launchPoster} aria-hidden="true">
                        <img alt="" src={poster} />
                    </span>
                    <div className={styles.launchContent}>
                        <Eyebrow className={styles.launchEyebrow} tone="menu">
                            Recommended
                        </Eyebrow>
                        <ScreenTitle as="h2" className={styles.launchModeTitle} role="screenMd">
                            {def.title}
                        </ScreenTitle>
                        <p className={styles.launchSummary}>{summary}</p>
                        {renderModeLoopCue(def, 'launch')}
                        {renderModeSignalStrip(def, 'launch')}
                        {freshClassicLaunch ? (
                            <ol className={styles.launchFirstRunBeats} data-testid="choose-path-first-run-beats">
                                <li>Match the marked pair.</li>
                                <li>Clear the room for score and streak.</li>
                                <li>Pick Safe, Greed, or Mystery for room two.</li>
                            </ol>
                        ) : null}
                        <div className={styles.launchActions}>
                            <UiButton
                                className={styles.launchPrimaryButton}
                                disabled={!canStart}
                                size={pathTouchCompact ? 'md' : 'lg'}
                                type="button"
                                variant="primary"
                                aria-label={`Start ${def.title}. ${signalText}.`}
                                data-start-action-cue={startActionCue.headline}
                                data-start-action-tone={startActionCue.tone}
                                onClick={() => runModeAction(def)}
                            >
                                <span className={styles.launchButtonContent}>
                                    <span>Start run</span>
                                    <small>{startActionCue.headline}</small>
                                </span>
                            </UiButton>
                            <UiButton
                                aria-controls="choose-path-more-modes"
                                aria-expanded={browseOpen}
                                className={styles.launchSecondaryButton}
                                size={pathTouchCompact ? 'md' : 'lg'}
                                type="button"
                                variant="secondary"
                                onClick={browseOpen ? closeBrowse : openBrowse}
                            >
                                {browseOpen ? 'Hide modes' : 'Browse modes'}
                            </UiButton>
                        </div>
                    </div>
                </div>
            </section>
        );
    };

    const renderLibraryModeTile = (def: RunModeDefinition): ReactElement => {
        const poster = resolveModePosterUrl(def.posterKey);
        const variant = cardVariantClass(def);
        const groupLabel = RUN_MODE_GROUP_LABEL[def.group];
        const isSelected = def.id === selectedMode?.id;
        const signalText = modeChoiceSignalAria(getModeChoiceSignals(def));
        return (
            <button
                aria-label={`${def.title}. ${signalText}. Open details.`}
                className={`${styles.card} ${styles.libraryTileCard} ${variant}`}
                data-selected-mode={isSelected ? 'true' : undefined}
                data-testid={def.testId}
                type="button"
                onClick={() => {
                    playMenuOpen();
                    setLibraryDetailMode(def);
                }}
            >
                <span
                    className={styles.cardPoster}
                    aria-hidden="true"
                    data-mode-art-fallback={isModePosterFallback(def.posterKey) ? 'true' : 'false'}
                >
                    <img alt="" src={poster} />
                </span>
                <span className={styles.cardBodyWrap}>
                    <span className={styles.libraryTileKicker}>
                        {groupLabel}
                        {isModePosterFallback(def.posterKey) ? ' · emblem art' : ''}
                    </span>
                    {def.availability === 'locked' ? <span className={styles.libraryTileState}>Locked</span> : null}
                    <span className={`${styles.cardTitle} ${styles.libraryTileTitle}`}>{def.title}</span>
                    {renderModeSignalStrip(def, 'tile')}
                    <p className={`${styles.cardBody} ${styles.libraryTileBody}`}>{def.shortDescription}</p>
                </span>
            </button>
        );
    };

    const buildLibraryDetailModalActions = (def: RunModeDefinition) => {
        const closeAct = { label: 'Close', onClick: closeLibraryDetail, variant: 'secondary' as const };
        if (def.availability !== 'available') {
            return [closeAct];
        }
        if (def.action.type === 'gauntlet') {
            return [closeAct];
        }
        switch (def.action.type) {
            case 'meditationSetup':
                return [
                    {
                        label: 'Set up run…',
                        onClick: (): void => {
                            closeLibraryDetail();
                            playMenuOpen();
                            setMeditationOpen(true);
                        },
                        variant: 'primary' as const
                    },
                    closeAct
                ];
            default:
                return [
                    {
                        label: 'Play',
                        onClick: (): void => {
                            closeLibraryDetail();
                            runModeAction(def);
                        },
                        variant: 'primary' as const
                    },
                    closeAct
                ];
        }
    };

    return (
        <section
            aria-label="Choose Your Path"
            className={`${metaStyles.shell} ${styles.pathShell} ${pathTouchCompact ? styles.compactPathShell : ''} ${isShortLandscapeShell ? styles.shortTouchLandscapeShell : ''}`.trim()}
            role="region"
        >
            <div
                aria-hidden="true"
                className={styles.sceneBaseLayer}
                data-testid="choose-path-scene-layer"
                style={{ backgroundImage: `url(${UI_ART.gameplayScene})` }}
            />
            <div
                aria-hidden="true"
                className={styles.sceneLayer}
                data-testid="choose-path-scene-texture"
                style={{ backgroundImage: `url(${UI_ART.choosePathScene})` }}
            />
            <div aria-hidden="true" className={styles.scrim} />
            <div className={styles.pathFitViewport}>
                <div ref={pathFitMeasureRef} className={styles.pathFitMeasureOuter}>
                    <div className={styles.pathFitZoomInner} style={{ zoom: pathShellFitZoom }}>
                        <div className={styles.pathFitStack}>
                            <header className={`${metaStyles.header} ${styles.pathStackHeader}`}>
                                <div className={`${metaStyles.headerText} ${styles.pathHeaderText}`}>
                                    <div className={styles.pathHeaderTopRow}>
                                        <button
                                            className={styles.pathBackButton}
                                            data-testid="choose-path-inline-back"
                                            type="button"
                                            onClick={() => {
                                                playUiBack();
                                                closeSubscreen();
                                            }}
                                        >
                                            <BackChevronIcon className={styles.pathBackIcon} />
                                            <span>Back</span>
                                        </button>
                                        <button
                                            className={styles.pathBackButton}
                                            data-testid="choose-path-settings"
                                            type="button"
                                            onClick={() => {
                                                playMenuOpen();
                                                openSettings('modeSelect');
                                            }}
                                        >
                                            <span>Settings</span>
                                        </button>
                                    </div>
                                    <Eyebrow tone="menu">Start a run</Eyebrow>
                                    <ScreenTitle as="h1" className={styles.pathTitle} role="display">
                                        Choose Your Path
                                    </ScreenTitle>
                                    <p className={`${metaStyles.subtitle} ${styles.pathSubtitle}`}>
                                        Start the recommended run now, or browse the full mode library when you want a
                                        different rule set.
                                    </p>
                                </div>
                            </header>

                            <div className={`${metaStyles.body} ${styles.pathBody}`}>
                                {launchMode ? renderLaunchPanel(launchMode) : null}

                                {browseOpen ? (
                                    <section
                                        aria-label="Browse modes"
                                        className={styles.librarySection}
                                        data-testid="choose-path-more-modes"
                                        id="choose-path-more-modes"
                                    >
                                    <Eyebrow className={styles.sectionEyebrow} tone="menu">
                                        Browse modes
                                    </Eyebrow>
                                    {filteredLibraryModes.length === 0 ? (
                                        <>
                                            <div className={styles.libraryToolbar}>
                                                <div className={`${styles.librarySearchRail} ${styles.librarySearchRailWide}`}>
                                                    <div className={styles.librarySearchFieldLead}>
                                                        <span className={styles.librarySearchLeadIcon} aria-hidden>
                                                            <LibrarySearchMagnifierIcon className={styles.librarySearchIconGlyph} />
                                                        </span>
                                                        <label className={styles.libraryFilterLabel} htmlFor="choose-path-mode-filter">
                                                            Filter modes
                                                        </label>
                                                        <input
                                                            ref={librarySearchInputRef}
                                                            autoComplete="off"
                                                            className={`${styles.libraryFilterInput} ${styles.libraryFilterInputInset}`}
                                                            id="choose-path-mode-filter"
                                                            onChange={(e) => setLibraryQuery(e.target.value)}
                                                            placeholder="Search by name or description…"
                                                            type="search"
                                                            value={libraryQuery}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <p className={styles.libraryEmpty} role="status">
                                                No modes match this search.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div
                                                className={`${styles.libraryToolbar} ${librarySearchOpen ? styles.libraryToolbarSearchOpen : ''}`.trim()}
                                            >
                                                <div
                                                    className={`${styles.librarySearchRail} ${librarySearchOpen ? styles.librarySearchRailOpen : styles.librarySearchRailCollapsed}`}
                                                >
                                                    <button
                                                        aria-controls="choose-path-library-search-panel"
                                                        aria-expanded={librarySearchOpen}
                                                        aria-label={
                                                            librarySearchOpen
                                                                ? 'Close search'
                                                                : hasLibrarySearchQuery
                                                                  ? 'Edit search filter'
                                                                  : 'Search modes'
                                                        }
                                                        className={`${styles.librarySearchIconBtn} ${hasLibrarySearchQuery && !librarySearchOpen ? styles.librarySearchIconBtnFiltered : ''}`.trim()}
                                                        type="button"
                                                        onClick={() => {
                                                            playUiClick();
                                                            setLibrarySearchOpen((open) => !open);
                                                        }}
                                                    >
                                                        <LibrarySearchMagnifierIcon className={styles.librarySearchIconGlyph} />
                                                    </button>
                                                    {librarySearchOpen ? (
                                                        <div className={styles.librarySearchExpand} id="choose-path-library-search-panel">
                                                            <label className={styles.libraryFilterLabel} htmlFor="choose-path-mode-filter">
                                                                Filter modes
                                                            </label>
                                                            <input
                                                                ref={librarySearchInputRef}
                                                                autoComplete="off"
                                                                className={styles.libraryFilterInput}
                                                                id="choose-path-mode-filter"
                                                                onChange={(e) => setLibraryQuery(e.target.value)}
                                                                placeholder="Search by name or description…"
                                                                type="search"
                                                                value={libraryQuery}
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                                {libraryPageCount > 1 ? (
                                                    <div aria-label="Library pages" className={styles.libraryDotsWrap} role="group">
                                                        {libraryPages.map((_, i) => (
                                                            <button
                                                                key={i}
                                                                aria-current={i === libraryPageIndex ? 'true' : undefined}
                                                                aria-label={`Page ${i + 1} of ${libraryPageCount}`}
                                                                className={`${styles.libraryDot} ${i === libraryPageIndex ? styles.libraryDotActive : ''}`}
                                                                type="button"
                                                                onClick={() => {
                                                                    playUiClick();
                                                                    const el = libraryScrollerRef.current;
                                                                    if (!el) {
                                                                        return;
                                                                    }
                                                                    el.scrollTo({
                                                                        left: i * el.clientWidth,
                                                                        behavior: 'smooth'
                                                                    });
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className={styles.libraryScrollerWrap}>
                                                <div
                                                    ref={libraryScrollerRef}
                                                    aria-label="More modes library, swipe or drag sideways to browse pages, or use arrow keys when this region is focused"
                                                    className={styles.libraryScroller}
                                                    onKeyDownCapture={onLibraryScrollerKeyDownCapture}
                                                    onPointerDownCapture={onLibraryDragPointerDown}
                                                    onScroll={onLibraryScroll}
                                                    tabIndex={libraryScrollerTabIndex}
                                                >
                                                    {libraryPages.map((pageModes, pageIndex) => (
                                                        <div
                                                            key={pageIndex}
                                                            className={styles.libraryPage}
                                                            data-library-page-index={pageIndex}
                                                            style={
                                                                {
                                                                    '--path-library-cols': Math.min(
                                                                        cardsPerPage,
                                                                        pageModes.length
                                                                    )
                                                                } as CSSProperties
                                                            }
                                                        >
                                                            {pageModes.map((def) => (
                                                            <div
                                                                key={def.id}
                                                                className={styles.libraryCardCell}
                                                                data-library-card-cell
                                                                data-mode-group={def.group}
                                                                data-poster-key={def.posterKey}
                                                            >
                                                                    <MetaFrame
                                                                        className={
                                                                            def.availability === 'locked'
                                                                                ? `${styles.cardFrame} ${styles.cardFrameMuted}`
                                                                                : styles.cardFrame
                                                                        }
                                                                    >
                                                                        {renderLibraryModeTile(def)}
                                                                    </MetaFrame>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    </section>
                                ) : null}

                                {browseOpen ? (
                                    <p className={styles.pathFooterNote} data-testid="choose-path-offline-note">
                                    Offline-first v1: local runs and share strings only. Pass-and-play and online
                                    challenges stay deferred — see <strong>Profile</strong> for save scope and trust
                                    copy.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {libraryDetailMode ? (
                <OverlayModal
                    actions={buildLibraryDetailModalActions(libraryDetailMode)}
                    onEscape={closeLibraryDetail}
                    subtitle={RUN_MODE_GROUP_LABEL[libraryDetailMode.group]}
                    testId="library-mode-detail-modal"
                    title={libraryDetailMode.title}
                >
                    <p className={styles.libraryDetailDescription}>{libraryDetailMode.shortDescription}</p>
                    {renderModeLoopCue(libraryDetailMode, 'detail')}
                    <div className={styles.libraryDetailSignals}>
                        {renderModeSignalStrip(libraryDetailMode, 'detail')}
                    </div>
                    {libraryDetailMode.startContract ? (
                        <p
                            className={styles.libraryDetailIdentity}
                            data-start-contract-testid={libraryDetailMode.startContract.testId}
                            data-testid="choose-path-start-contract"
                        >
                            <strong>{libraryDetailMode.startContract.label}:</strong> {libraryDetailMode.startContract.signal}
                        </p>
                    ) : null}
                    {libraryDetailMode.identityTag ? (
                        <p className={styles.libraryDetailIdentity}>{libraryDetailMode.identityTag}</p>
                    ) : null}
                    {libraryDetailMode.promise ? (
                        <p className={styles.libraryDetailPromise}>{libraryDetailMode.promise}</p>
                    ) : null}
                    {libraryDetailMode.eligibilityNote ? (
                        <p className={styles.libraryDetailMuted}>{libraryDetailMode.eligibilityNote}</p>
                    ) : null}
                    {libraryDetailMode.availabilityDetail ? (
                        <p className={styles.libraryDetailIdentity}>{libraryDetailMode.availabilityDetail}</p>
                    ) : null}
                    {challengeGateRows.find((row) => row.modeId === libraryDetailMode.id) ? (
                        <p className={styles.libraryDetailIdentity}>
                            Gate: {challengeGateRows.find((row) => row.modeId === libraryDetailMode.id)?.entryCondition} ·{' '}
                            {challengeGateRows.find((row) => row.modeId === libraryDetailMode.id)?.progress.current}/
                            {challengeGateRows.find((row) => row.modeId === libraryDetailMode.id)?.progress.target} ·{' '}
                            {challengeGateRows.find((row) => row.modeId === libraryDetailMode.id)?.status === 'available'
                                ? 'Unlocked locally'
                                : 'Locked locally'}
                        </p>
                    ) : null}
                    {libraryDetailMode.availability !== 'available' ? (
                        <p className={styles.libraryDetailMuted}>
                            This mode is intentionally locked for v1. Classic Run is the playable escalating local
                            descent; this card reserves a future ultra-long ruleset after balance, relic cadence, and
                            route/shop pacing are final.
                        </p>
                    ) : null}
                    {libraryDetailMode.action.type === 'gauntlet' && libraryDetailMode.availability === 'available' ? (
                        <div aria-label="Gauntlet duration" className={styles.libraryDetailGauntlet} role="group">
                            {libraryDetailMode.action.presets.map((p) => (
                                <UiButton
                                    key={p.label}
                                    size={presetButtonSize}
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        closeLibraryDetail();
                                        startGauntletRun(p.durationMs);
                                    }}
                                >
                                    {p.label}
                                </UiButton>
                            ))}
                        </div>
                    ) : null}
                </OverlayModal>
            ) : null}
            {meditationOpen ? (
                <OverlayModal
                    actions={[
                        {
                            label: 'Cancel',
                            onClick: () => {
                                playUiBack();
                                setMeditationOpen(false);
                            },
                            variant: 'secondary'
                        },
                        {
                            label: 'Calm (no mutators)',
                            onClick: () => {
                                startMeditationRun();
                                setMeditationOpen(false);
                            },
                            variant: 'secondary'
                        },
                        {
                            label: 'Start with selection',
                            onClick: () => {
                                startMeditationRunWithMutators([...meditationSelection]);
                                setMeditationOpen(false);
                            },
                            variant: 'primary'
                        }
                    ]}
                    onEscape={() => {
                        playUiBack();
                        setMeditationOpen(false);
                    }}
                    subtitle="Toggle mutators for a focused study run, or start calm with a clean ruleset."
                    title="Meditation setup"
                >
                    <ul className={styles.meditationMutatorList}>
                        {MEDITATION_PICK_MUTATOR_IDS.map((id) => {
                            const def = MUTATOR_CATALOG[id]!;
                            const inputId = `choose-path-meditation-mutator-${id}`;
                            return (
                                <li className={styles.meditationMutatorRow} key={id}>
                                    <input
                                        checked={meditationSelection.has(id)}
                                        id={inputId}
                                        onChange={() => toggleMeditationMutator(id)}
                                        type="checkbox"
                                    />
                                    <label className={styles.meditationMutatorLabel} htmlFor={inputId}>
                                        <strong>{def.title}</strong>
                                        <span>{def.description}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                </OverlayModal>
            ) : null}
        </section>
    );
};

export default ChooseYourPathScreen;

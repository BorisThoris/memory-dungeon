import {
    GameplayBombIcon,
    GameplayCrucibleIcon,
    GameplayStormGlassIcon,
    GameplayPurseIcon,
    GameplayBellIcon,
    GameplayExitIcon,
    GameplayFitIcon,
    GameplayGreetIcon,
    GameplayIgniteIcon,
    GameplayHoldIcon,
    GameplayCarveIcon,
    GameplayRepriseIcon,
    GameplayPeekIcon,
    GameplayPinIcon,
    GameplayShuffleIcon,
    GameplayUndoIcon
} from '../ui/gameplayIcons';

/** Glyphs for the run shell's dock, one per board power. */
export const RUN_SHELL_GLYPHS = {
    shuffle: <GameplayShuffleIcon />,
    pin: <GameplayPinIcon />,
    peek: <GameplayPeekIcon />,
    bomb: <GameplayBombIcon />,
    crucible: <GameplayCrucibleIcon />,
    storm_glass: <GameplayStormGlassIcon />,
    misers_purse: <GameplayPurseIcon />,
    still_bell: <GameplayBellIcon />,
    ignite: <GameplayIgniteIcon />,
    hold: <GameplayHoldIcon />,
    carve: <GameplayCarveIcon />,
    reprise: <GameplayRepriseIcon />,
    undo: <GameplayUndoIcon />,
    greet: <GameplayGreetIcon />,
    fit: <GameplayFitIcon />,
    exit: <GameplayExitIcon />
} as const;

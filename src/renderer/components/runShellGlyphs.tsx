import {
    GameplayDestroyIcon,
    GameplayExitIcon,
    GameplayGreetIcon,
    GameplayPeekIcon,
    GameplayPinIcon,
    GameplayShuffleIcon,
    GameplayStoreIcon,
    GameplayStrayIcon,
    GameplayUndoIcon
} from '../ui/gameplayIcons';

/** Glyphs for the run shell's dock, one per board power. */
export const RUN_SHELL_GLYPHS = {
    shuffle: <GameplayShuffleIcon />,
    pin: <GameplayPinIcon />,
    destroy: <GameplayDestroyIcon />,
    peek: <GameplayPeekIcon />,
    undo: <GameplayUndoIcon />,
    stray: <GameplayStrayIcon />,
    greet: <GameplayGreetIcon />,
    exit: <GameplayExitIcon />,
    store: <GameplayStoreIcon />
} as const;

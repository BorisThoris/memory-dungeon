import {
    GameplayDestroyIcon,
    GameplayGreetIcon,
    GameplayPeekIcon,
    GameplayPinIcon,
    GameplayShuffleIcon,
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
    greet: <GameplayGreetIcon />
} as const;

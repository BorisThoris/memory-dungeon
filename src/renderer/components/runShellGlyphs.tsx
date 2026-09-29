import {
    GameplayBombIcon,
    GameplayExitIcon,
    GameplayFitIcon,
    GameplayGreetIcon,
    GameplayIgniteIcon,
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
    ignite: <GameplayIgniteIcon />,
    undo: <GameplayUndoIcon />,
    greet: <GameplayGreetIcon />,
    fit: <GameplayFitIcon />,
    exit: <GameplayExitIcon />
} as const;

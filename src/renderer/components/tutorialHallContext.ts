import { createContext, useContext } from 'react';

/** Available from the menu and optional in-run references; practice owns a separate run. */
export const TutorialHallContext = createContext<((lessonId?: string) => void) | null>(null);
export const useTutorialHall = () => useContext(TutorialHallContext);

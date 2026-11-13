import { DEFAULT_KEY_BINDINGS, type KeyBindings } from '../../shared/key-bindings';
import { useAppStore } from '../store/useAppStore';

/** The bindings in force right now, for a key handler that must not wait on a render. */
export const currentKeyBindings = (): KeyBindings => useAppStore.getState().settings.keyBindings ?? DEFAULT_KEY_BINDINGS;

/** The bindings as a component reads them, so its labels follow a rebind. */
export const useKeyBindings = (): KeyBindings => useAppStore((state) => state.settings.keyBindings) ?? DEFAULT_KEY_BINDINGS;

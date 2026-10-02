import { create } from 'zustand/react';

const COMBO_POP_KEY = 'memory-dungeon.dev.combo-pop-effects';
const readComboPopEffects = (): boolean => {
    try { return window.localStorage.getItem(COMBO_POP_KEY) !== 'off'; }
    catch { return true; }
};

/** Device-local visual switches, separate from run rules and exported saves. */
export const useDevOptions = create<{
    comboPopEffects: boolean;
    setComboPopEffects: (enabled: boolean) => void;
}>((set) => ({
    comboPopEffects: readComboPopEffects(),
    setComboPopEffects: (enabled) => {
        try { window.localStorage.setItem(COMBO_POP_KEY, enabled ? 'on' : 'off'); }
        catch { /* The switch still works for this session if storage is unavailable. */ }
        set({ comboPopEffects: enabled });
    }
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  primaryColor: string;
  /**
   * Canvas background override, or null to follow the light/dark theme.
   * Kept separate from the theme's own value so switching modes still works:
   * clearing this hands the canvas back to whichever palette is active.
   */
  canvasColor: string | null;
  setMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
  setCanvasColor: (color: string | null) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      primaryColor: '#6366f1',
      canvasColor: null,
      setMode: (mode) => set({ mode }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setCanvasColor: (canvasColor) => set({ canvasColor }),
      toggleMode: () => set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'mindforge-theme' },
  ),
);

import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import i18n, { applyLocalePreference } from '../i18n';
import { syncNativeMenu } from '../i18n/syncNativeMenu';
import { applyCanvasPalette } from '../utils/canvasPalette';
import { useThemeStore } from '../store/theme';
import { useUiStore } from '../store/ui';
import { installWorkspaceAutosave } from '../document/workspace';

const EditorPage = lazy(() => import('./pages/EditorPage').then((module) => ({ default: module.EditorPage })));

function darken(hex: string, amount = 25): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-300">
      {t('common.loading')}
    </div>
  );
}

export default function AppRoot() {
  const { mode, primaryColor, canvasColor } = useThemeStore();
  const localePreference = useUiStore((s) => s.locale);

  useEffect(() => {
    installWorkspaceAutosave();
  }, []);

  // Keep i18n + native menu aligned after zustand rehydrate / preference changes.
  useEffect(() => {
    void applyLocalePreference(localePreference).then(() => syncNativeMenu());
  }, [localePreference]);

  useEffect(() => {
    const onLanguageChanged = () => {
      void syncNativeMenu();
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', mode === 'light');
    root.style.setProperty('--accent', primaryColor);
    root.style.setProperty('--accent-hover', darken(primaryColor));
    applyCanvasPalette(root, canvasColor);
  }, [mode, primaryColor, canvasColor]);

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/editor" element={<Navigate to="/" replace />} />
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="/vaults" element={<Navigate to="/" replace />} />
          <Route path="/vaults/:id" element={<Navigate to="/" replace />} />
          <Route path="/local-unlock" element={<Navigate to="/" replace />} />
          <Route path="/mindmap/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

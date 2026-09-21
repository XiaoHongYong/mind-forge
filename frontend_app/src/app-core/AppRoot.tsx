import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { applyCanvasPalette } from '../utils/canvasPalette';
import { useThemeStore } from '../store/theme';
import { installWorkspaceAutosave, restoreWorkspaceOnce } from '../document/workspace';

const EditorPage = lazy(() => import('./pages/EditorPage').then((module) => ({ default: module.EditorPage })));
const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })));

/** First visit to `/` restores the last tab set; later visits stay on Home. */
let workspaceBootFinished = false;

function darken(hex: string, amount = 25): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function EntryGate() {
  const [phase, setPhase] = useState<'pending' | 'editor' | 'home'>(
    workspaceBootFinished ? 'home' : 'pending',
  );

  useEffect(() => {
    if (workspaceBootFinished) return;
    let cancelled = false;
    void restoreWorkspaceOnce().then((restored) => {
      workspaceBootFinished = true;
      if (!cancelled) setPhase(restored ? 'editor' : 'home');
    }).catch(() => {
      workspaceBootFinished = true;
      if (!cancelled) setPhase('home');
    });
    return () => { cancelled = true; };
  }, []);

  if (phase === 'pending') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-300">
        Loading…
      </div>
    );
  }
  if (phase === 'editor') return <Navigate to="/editor" replace />;
  return <HomePage />;
}

export default function AppRoot() {
  const { mode, primaryColor, canvasColor } = useThemeStore();

  useEffect(() => {
    installWorkspaceAutosave();
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
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-300">Loading…</div>}>
        <Routes>
          <Route path="/" element={<EntryGate />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="/vaults" element={<Navigate to="/" replace />} />
          <Route path="/vaults/:id" element={<Navigate to="/editor" replace />} />
          <Route path="/local-unlock" element={<Navigate to="/" replace />} />
          <Route path="/mindmap/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

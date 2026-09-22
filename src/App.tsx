import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useMatomoPageViews } from './analytics';
import { unlockAudio } from './audio/sfx';
import { BreathProvider } from './breath/BreathProvider';
import { useLang } from './i18n';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { GamesScreen } from './screens/GamesScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MapScreen } from './screens/MapScreen';
import { ParentsScreen } from './screens/ParentsScreen';
import { PlayScreen } from './screens/PlayScreen';
import { actions, getAppState, selectCurrentProfile, useAppState } from './store/store';

/** Redirects to the home screen if no profile is selected. */
function RequireProfile({ children }: { children: ReactNode }) {
  const profile = selectCurrentProfile(useAppState());
  if (!profile) return <Navigate to="/" replace />;
  return children;
}

/** Reports each route change to Matomo (must live inside the router). */
function Analytics() {
  useMatomoPageViews();
  return null;
}

/** Reflects the current language on <html lang> (screen readers, hyphenation). */
function HtmlLang() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

/** Browsers only allow audio after a gesture: we unlock on the first one. */
function AudioUnlock() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
    };
  }, []);
  return null;
}

export default function App() {
  return (
    <BreathProvider
      initialSourceKind={getAppState().settings.inputSource}
      initialMicDeviceId={getAppState().settings.micDeviceId}
      onSourceKindChange={actions.setInputSource}
      onMicDeviceIdChange={actions.setMicDeviceId}
    >
      <HtmlLang />
      <AudioUnlock />
      <BrowserRouter>
        <Analytics />
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/parents" element={<ParentsScreen />} />
          <Route
            path="/calibration"
            element={
              <RequireProfile>
                <CalibrationScreen />
              </RequireProfile>
            }
          />
          <Route
            path="/map"
            element={
              <RequireProfile>
                <MapScreen />
              </RequireProfile>
            }
          />
          <Route
            path="/games"
            element={
              <RequireProfile>
                <GamesScreen />
              </RequireProfile>
            }
          />
          <Route
            path="/play/:gameId/:levelId"
            element={
              <RequireProfile>
                <PlayScreen />
              </RequireProfile>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BreathProvider>
  );
}

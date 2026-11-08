import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from './store/app';
import { db } from './data/db';
import { Surface } from './components/riso';
import Onboarding from './screens/onboarding/Onboarding';
import Today from './screens/today/Today';
import Train from './screens/train/Train';
import Body from './screens/body/Body';
import Spotters from './screens/spotters/Spotters';
import Profile from './screens/profile/Profile';

const TABS = [
  { to: '/today', label: 'Today' },
  { to: '/train', label: 'Log' },
  { to: '/body', label: 'Body' },
  { to: '/spotters', label: 'Spotter' },
  { to: '/profile', label: 'Me' },
];

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const profile = useLiveQuery(() => db.profile.get('me'));
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!profile) return null;
  if (!profile.onboarded) {
    return (
      <Surface style="riso" className="min-h-screen">
        <div className="mx-auto min-h-screen max-w-[480px] px-4 pt-4 pb-16">
          <Onboarding />
        </div>
      </Surface>
    );
  }

  const style = pathname.startsWith('/spotters') ? 'riso' : 'lab';
  return (
    <Surface style={style} className="min-h-screen">
      <div className="mx-auto min-h-screen max-w-[480px] pb-44">
        <main className="px-4 pt-3">
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today/*" element={<Today />} />
            <Route path="/train/*" element={<Train />} />
            <Route path="/body/*" element={<Body />} />
            <Route path="/spotters/*" element={<Spotters />} />
            <Route path="/profile/*" element={<Profile />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </main>
        <RestTimer />
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-ink bg-page" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto grid max-w-[480px] grid-cols-5">
            {TABS.map((t, i) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex min-h-14 items-center justify-center font-mono text-[11px] font-bold uppercase tracking-wide ${i ? 'border-l-2 border-ink' : ''} ${isActive ? 'bg-ink text-page' : 'text-ink'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </Surface>
  );
}

function RestTimer() {
  const { restEndsAt, restTotal, adjustRest, stopRest } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);
  const left = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const done = !!restEndsAt && left === 0;
  useEffect(() => {
    if (done) navigator.vibrate?.([200, 100, 200]);
  }, [done]);
  if (!restEndsAt) return null;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  const frac = restTotal > 0 ? Math.min(1, left / restTotal) : 0;

  // Read mid-set: clean, max contrast, no grain.
  return (
    <div className="fixed inset-x-0 z-20 mx-auto max-w-[480px] px-4" style={{ bottom: 'calc(3.5rem + 3px + env(safe-area-inset-bottom) + 8px)' }}>
      <div className={`border-2 border-ink p-3 ${done ? 'bg-ink text-page' : 'bg-page text-ink'}`}>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wide">{done ? '[REST DONE]' : 'REST'}</div>
            <div className="font-mono text-6xl leading-none font-bold tabular-nums" role="timer" aria-live="polite">
              {mmss}
            </div>
          </div>
          <button className="min-h-14 min-w-14 border-2 border-current px-2 font-mono font-bold" onClick={() => adjustRest(-15)}>
            −15
          </button>
          <button className="min-h-14 min-w-14 border-2 border-current px-2 font-mono font-bold" onClick={() => adjustRest(15)}>
            +15
          </button>
          <button className="min-h-14 border-2 border-current px-3 font-mono text-sm font-bold uppercase" onClick={stopRest}>
            {done ? 'Close' : 'Skip'}
          </button>
        </div>
        <div className="mt-2 h-[3px] w-full border-0">
          <div className="h-[3px] bg-current" style={{ width: `${frac * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

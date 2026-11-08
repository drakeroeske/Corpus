import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from './store/app';
import { db } from './data/db';
import Onboarding from './screens/onboarding/Onboarding';
import Today from './screens/today/Today';
import Train from './screens/train/Train';
import Body from './screens/body/Body';
import Spotters from './screens/spotters/Spotters';
import Profile from './screens/profile/Profile';

const TABS = [
  { to: '/today', label: 'Today' },
  { to: '/train', label: 'Train' },
  { to: '/body', label: 'Body' },
  { to: '/spotters', label: 'Spotters' },
  { to: '/profile', label: 'Profile' },
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
      <div className="mx-auto min-h-screen max-w-[480px] px-4 pt-6 pb-16">
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] pb-40">
      <main className="px-4 pt-6">
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
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-[480px]">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => `flex min-h-14 flex-1 items-center justify-center text-sm ${isActive ? 'font-bold text-lime' : 'text-mute'}`}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function RestTimer() {
  const { restEndsAt, adjustRest, stopRest } = useApp();
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

  return (
    <div className="fixed inset-x-0 z-20 mx-auto max-w-[480px] px-4" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 8px)' }}>
      <div className={`flex items-center gap-2 rounded-2xl border p-2 ${done ? 'border-lime bg-lime text-bg' : 'border-line bg-surface'}`}>
        <div className="flex-1 pl-2">
          <div className="text-xs uppercase tracking-wide opacity-70">{done ? 'Rest done' : 'Rest'}</div>
          <div className="font-mono text-2xl">{mmss}</div>
        </div>
        <button className="min-h-11 min-w-11 rounded-lg border border-current px-2 font-mono" onClick={() => adjustRest(-15)}>
          −15
        </button>
        <button className="min-h-11 min-w-11 rounded-lg border border-current px-2 font-mono" onClick={() => adjustRest(15)}>
          +15
        </button>
        <button className="min-h-11 rounded-lg border border-current px-3" onClick={stopRest}>
          {done ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  );
}

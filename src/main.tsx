import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { db } from './data/db';
import { applyTemplate, ensureProfile } from './data/repo';

async function boot() {
  await ensureProfile();
  if ((await db.programDays.count()) === 0) await applyTemplate('corpus-5');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
boot();

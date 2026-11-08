import { useEffect, useRef, useState } from 'react';
import { todayKey } from '../../data/db';
import { useData } from '../../data/repo';
import { coachContext } from '../../data/coachContext';
import { aiCoach } from '../../services/aiCoach';
import { Button, PageHeader, TextInput } from '../../components/ui';

const SUGGESTIONS = ['Why did my bench stall?', 'Why is my readiness low?', 'Do I need a deload?', 'How was my week?', 'What should I lift today?'];

export default function AiCoachChat() {
  const data = useData();
  const [msgs, setMsgs] = useState<{ from: 'me' | 'coach'; text: string }[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);
  if (!data) return null;

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { from: 'me', text }]);
    setQ('');
    setBusy(true);
    const answer = await aiCoach.ask(text, coachContext(data, todayKey()));
    setMsgs((m) => [...m, { from: 'coach', text: answer }]);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="AI Coach" section="COACH" back sub="Answers built from your own data. Simulated for now." />
      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] border-2 border-ink px-4 py-3 font-mono text-sm ${m.from === 'me' ? 'ml-auto bg-ink text-page' : 'bg-page'}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="font-mono text-xs uppercase">[COMPUTING…]</div>}
        <div ref={end} />
      </div>
      {!msgs.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="min-h-11 border-2 border-ink px-3 text-left font-mono text-xs uppercase" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <TextInput placeholder="Ask about your training" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" disabled={busy || !q.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../../data/db';
import { exById } from '../../data/plan';
import { adherencePct, clientFlags, type Client } from '../../engine';
import { Button, Card, PageHeader, Stepper, TextInput, prettyDate } from '../../components/ui';
import { ExercisePicker } from '../train/ProgramBuilder';
import { LabTable, Tag } from '../../components/riso';
import { Empty } from '../../components/diagrams';

export function CoachDashboard() {
  const nav = useNavigate();
  const clients = useLiveQuery(() => db.clients.toArray());
  if (!clients) return null;
  return (
    <div className="space-y-3">
      <PageHeader title="Clients" section="COACH" back sub={`${clients.length} clients`} />
      <LabTable
        head={['Client', 'Adh.', 'Ready']}
        align={['l', 'r', 'r']}
        bold={[2]}
        rows={clients.map((c) => {
          const flags = clientFlags(c);
          return {
            key: c.id,
            onClick: () => nav(`/profile/coach/${c.id}`),
            cells: [
              <div>
                <div className="font-bold uppercase">{c.name}</div>
                <div className="text-[10px] uppercase">
                  Last: {c.lastSessionTitle}, {prettyDate(c.lastSession)}
                </div>
                {flags.map((f) => (
                  <div key={f} className="text-[10px] uppercase">
                    <Tag>FLAG</Tag> {f}
                  </div>
                ))}
              </div>,
              `${adherencePct(c)}%`,
              c.readiness[c.readiness.length - 1],
            ],
          };
        })}
      />
      {!clients.length && <Empty>No clients yet. Load demo data from Profile to see examples.</Empty>}
    </div>
  );
}

export function ClientDetail() {
  const { clientId } = useParams();
  const client = useLiveQuery(() => db.clients.get(clientId!), [clientId]);
  const notes = useLiveQuery(() => db.coachNotes.where('clientId').equals(clientId!).toArray(), [clientId]);
  const [text, setText] = useState('');
  const [picking, setPicking] = useState<number | null>(null);
  if (!client || !notes) return null;
  const flags = clientFlags(client);
  const save = (c: Client) => db.clients.put(c);

  return (
    <div className="space-y-4">
      <PageHeader title={client.name} section="COACH" back sub={`Adherence ${adherencePct(client)}% · ${client.done}/${client.planned} sessions (14 days)`} />
      {flags.length > 0 && (
        <div className="hatch border-2 border-ink p-1">
          <div className="space-y-1 bg-page p-3">
            {flags.map((f) => (
              <div key={f} className="font-mono text-sm uppercase">
                <Tag>FLAG</Tag> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      <Card>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase">FIG. 01 — Readiness / 7 days</div>
        <div className="flex h-20 items-end gap-1">
          {client.readiness.map((r, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className={`w-full border-2 border-ink ${r < 50 ? 'hatch' : 'bg-ink'}`} style={{ height: `${r * 0.6}px` }} />
              <span className="font-mono text-[10px] text-ink">{r}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 font-mono text-xs uppercase">
          Last session: {client.lastSessionTitle}, {prettyDate(client.lastSession)}
        </div>
      </Card>

      <div>
        <h2 className="display mb-2 text-4xl">Program.</h2>
        <div className="space-y-2">
          {client.program.map((d, di) => (
            <Card key={d.id}>
              <div className="mb-1 border-b-[3px] border-ink pb-1 font-mono text-sm font-bold uppercase">{d.name}</div>
              {d.exercises.map((e, ei) => (
                <div key={ei} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{exById(e.exerciseId).name}</span>
                  <div className="w-36">
                    <Stepper
                      value={e.sets}
                      min={1}
                      step={1}
                      suffix="sets"
                      onChange={(v) => {
                        const program = client.program.map((x, i) => (i !== di ? x : { ...x, exercises: x.exercises.map((y, j) => (j === ei ? { ...y, sets: v } : y)) }));
                        save({ ...client, program });
                      }}
                    />
                  </div>
                  <button
                    className="min-h-11 min-w-11 border-2 border-ink font-bold"
                    aria-label="Remove exercise"
                    onClick={() => {
                      const program = client.program.map((x, i) => (i !== di ? x : { ...x, exercises: x.exercises.filter((_, j) => j !== ei) }));
                      save({ ...client, program });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button variant="ghost" className="mt-1 w-full text-sm" onClick={() => setPicking(di)}>
                Add exercise
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="display mb-2 text-4xl">Notes.</h2>
        <form
          className="mb-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await db.coachNotes.add({ id: uid(), clientId: client.id, time: Date.now(), text: text.trim() });
            setText('');
          }}
        >
          <TextInput placeholder="Leave a note" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit">Add</Button>
        </form>
        {[...notes]
          .sort((a, b) => b.time - a.time)
          .map((n) => (
            <Card key={n.id} className="mb-2 py-2">
              <div className="font-mono text-[10px] font-bold uppercase">[NOTE] {new Date(n.time).toLocaleString()}</div>
              <div className="font-mono text-sm">{n.text}</div>
            </Card>
          ))}
      </div>

      {picking !== null && (
        <ExercisePicker
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const program = client.program.map((x, i) =>
              i !== picking ? x : { ...x, exercises: [...x.exercises, { exerciseId: id, sets: 3, repMin: 8, repMax: 12, increment: 5, technique: 'none' as const }] },
            );
            save({ ...client, program });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

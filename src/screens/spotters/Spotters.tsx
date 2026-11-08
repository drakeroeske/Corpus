import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveProfile, useData } from '../../data/repo';
import { crewStats, matches, myBests, myCrewLog, myDots, mySplit, social, spotterBests, syncMeNow, useSocial, type FeedItem } from '../../services/social';
import { LB_PER_KG, dots, toKg, type Spotter } from '../../engine';
import { Button, Card, Label, PageHeader, Segmented, SubTabs, TextInput, fmtDuration } from '../../components/ui';

type Tab = 'feed' | 'crews' | 'gym' | 'find' | 'boards';

export default function Spotters() {
  const [tab, setTab] = useState<Tab>('feed');
  const account = useSocial((s) => s.account());
  const pending = useSocial((s) => s.pendingCount());

  useEffect(() => {
    if (account) syncMeNow();
  }, [account]);

  if (account === undefined) return null;
  if (account === null) return <SignIn />;

  return (
    <div>
      <PageHeader title="Spotters" sub={social.kind === 'simulated' ? 'Demo mode: simulated Spotters' : account.email} />
      <InviteHandler />
      {!!pending && <p className="mb-3 text-xs text-info">{pending} update{pending > 1 ? 's' : ''} waiting to send — they go out when you're back online.</p>}
      <SubTabs
        tabs={[
          { id: 'feed', label: 'Feed' },
          { id: 'crews', label: 'Crews' },
          { id: 'gym', label: 'Gym' },
          { id: 'find', label: 'Find' },
          { id: 'boards', label: 'Leaderboards' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'feed' && <Feed />}
      {tab === 'crews' && <Crews />}
      {tab === 'gym' && <Gym />}
      {tab === 'find' && <Find myId={account.id} />}
      {tab === 'boards' && <Boards />}
      {social.kind === 'supabase' && (
        <Button variant="ghost" className="mt-6 w-full text-sm" onClick={() => social.signOut()}>
          Sign out of Spotters
        </Button>
      )}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (f: () => Promise<void>, ok?: () => void) => {
    setMsg('');
    try {
      await f();
      ok?.();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Spotters" sub="Sign in to train with friends. Your training data stays on this phone — only what you choose to share goes online." />
      <Card className="space-y-3">
        {!sent ? (
          <>
            <Label>Email</Label>
            <TextInput type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-full" disabled={!email.includes('@')} onClick={() => run(() => social.sendSignInCode(email.trim()), () => setSent(true))}>
              Email me a sign-in code
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">Check {email}. Type the code from the email, or tap the link in it on this device.</p>
            <TextInput inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button className="w-full" disabled={code.trim().length < 6} onClick={() => run(() => social.verifySignInCode(email.trim(), code))}>
              Sign in
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </>
        )}
        {msg && <p className="text-sm text-warn">{msg}</p>}
      </Card>
    </div>
  );
}

/** Opening an invite link (#/spotters?add=<id>) offers to add that person. */
function InviteHandler() {
  const [params, setParams] = useSearchParams();
  const add = params.get('add');
  useEffect(() => {
    if (!add) return;
    (async () => {
      const me = await social.account();
      if (me && add !== me.id && confirm('Add this person as a Spotter?')) await social.addSpotter(add);
      setParams({}, { replace: true });
    })();
  }, [add, setParams]);
  return null;
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

function Feed() {
  const feed = useSocial((s) => s.feed());
  if (!feed) return null;
  return (
    <div className="space-y-3">
      {feed.stale && <p className="text-xs text-warn">Offline — showing your last saved feed.</p>}
      {!feed.items.length && <p className="text-mute">Finish a workout and it shows up here.</p>}
      {feed.items.map((p) => (
        <Post key={p.id} p={p} />
      ))}
    </div>
  );
}

function Post({ p }: { p: FeedItem }) {
  const [text, setText] = useState('');
  const liked = p.likes.includes('me');
  return (
    <Card>
      <div className="flex justify-between text-sm">
        <span className="font-bold">{p.authorName}</span>
        <span className="text-mute">{p.pending ? 'sending…' : ago(p.time)}</span>
      </div>
      <div className="mt-1 text-lg font-bold">{p.title}</div>
      <div className="font-mono text-xs text-mute">{fmtDuration(p.durationSec)}</div>
      <div className="mt-2 space-y-0.5 font-mono text-sm">
        {p.topSets.map((s) => (
          <div key={s}>{s}</div>
        ))}
        {p.prs.map((s) => (
          <div key={s} className="text-lime">
            PR · {s}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className={`min-h-11 rounded-lg border px-3 text-sm ${liked ? 'border-lime text-lime' : 'border-line text-mute'}`} onClick={() => social.toggleLike(p.id, liked)}>
          Respect · {p.likes.length}
        </button>
        <span className="text-xs text-mute">{p.comments.length} comments</span>
      </div>
      {p.comments.map((c) => (
        <div key={c.id} className="mt-1 text-sm">
          <span className="font-bold">{c.authorName}</span> {c.text}
        </div>
      ))}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) social.comment(p.id, text);
          setText('');
        }}
      >
        <TextInput placeholder="Comment" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="ghost" disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}

function Crews() {
  const data = useData();
  const crews = useSocial((s) => s.crews());
  const spotters = useSocial((s) => s.spotters());
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  if (!data || !crews || !spotters) return null;
  const me = myCrewLog(data.days, data.sessions);
  const friends = spotters.filter((s) => s.isFriend);
  const nameOf = (id: string) => (id === 'me' ? 'You' : spotters.find((s) => s.id === id)?.name ?? 'Spotter');

  return (
    <div className="space-y-3">
      {crews.map((c) => {
        const st = crewStats(c, me);
        return (
          <Card key={c.id}>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold">{c.name}</span>
              <span className="font-mono text-lime">{st.streak} day streak</span>
            </div>
            <div className="mb-2 text-xs text-mute">Breaks if anyone misses a planned session.</div>
            <Label>Consistency · 28 days</Label>
            {st.board.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2 py-0.5 text-sm">
                <span className="w-4 font-mono text-mute">{i + 1}</span>
                <span className="w-20 shrink-0 truncate">{nameOf(m.id)}</span>
                <div className="h-2 flex-1 rounded bg-line">
                  <div className={`h-2 rounded ${m.id === 'me' ? 'bg-lime' : 'bg-info'}`} style={{ width: `${m.pct}%` }} />
                </div>
                <span className="w-10 text-right font-mono">{m.pct}%</span>
              </div>
            ))}
          </Card>
        );
      })}

      <Card className="space-y-2">
        <div className="font-bold">New crew (2–8 people)</div>
        <TextInput placeholder="Crew name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {friends.map((f) => {
            const on = picked.includes(f.id);
            return (
              <button
                key={f.id}
                className={`min-h-11 rounded-xl border px-3 text-sm ${on ? 'border-lime text-lime' : 'border-line'}`}
                onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : picked.length < 7 ? [...picked, f.id] : picked)}
              >
                {f.name}
              </button>
            );
          })}
          {!friends.length && <span className="text-sm text-mute">Add Spotters in Find first.</span>}
        </div>
        <Button
          className="w-full"
          disabled={!name.trim() || !picked.length}
          onClick={async () => {
            await social.createCrew(name.trim(), picked);
            setName('');
            setPicked([]);
          }}
        >
          Create crew
        </Button>
      </Card>
    </div>
  );
}

function Gym() {
  const data = useData();
  const spotters = useSocial((s) => s.spotters());
  const last = useSocial((s) => s.lastGymCheckIn());
  const [gym, setGym] = useState<string | null>(null);
  if (!data || !spotters || last === undefined) return null;
  const current = gym ?? data.profile.gym ?? '';
  const here = last && Date.now() - last.time < 3 * 3600_000 ? last.gym : null;
  const there = here ? spotters.filter((s) => s.trainingNow && s.gym.toLowerCase() === here.toLowerCase()) : [];

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <Label>Your gym</Label>
        <TextInput value={current} placeholder="e.g. Iron Works Downtown" onChange={(e) => setGym(e.target.value)} />
        <Button
          className="w-full"
          disabled={!current.trim()}
          onClick={async () => {
            await saveProfile({ gym: current.trim() });
            await social.checkInAtGym(current.trim());
            syncMeNow();
          }}
        >
          I'm at {current.trim() || 'the gym'}
        </Button>
      </Card>
      {here && (
        <Card>
          <div className="mb-2 font-bold">Training at {here} now</div>
          {there.length ? (
            there.map((s) => (
              <div key={s.id} className="flex justify-between py-1 text-sm">
                <span>{s.name}</span>
                <span className="text-mute">{s.split}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-mute">No Spotters here right now.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function Find({ myId }: { myId: string }) {
  const data = useData();
  const spotters = useSocial((s) => s.spotters());
  const [copied, setCopied] = useState(false);
  if (!data || !spotters) return null;
  const me = {
    gym: data.profile.gym ?? '',
    schedule: [...new Set(data.days.flatMap((d) => d.weekdays))],
    split: mySplit(data.days),
    dots: myDots(data.sessions, data.profile),
  };
  const list = matches(spotters, me);
  const invite = `${location.origin}${location.pathname}#/spotters?add=${myId}`;

  return (
    <div className="space-y-2">
      {social.kind === 'supabase' && (
        <Card className="space-y-2">
          <div className="font-bold">Invite a friend</div>
          <div className="text-xs text-mute">Send this link. When they open it and sign in, they can add you.</div>
          <Button
            variant="ghost"
            className="w-full"
            onClick={async () => {
              if (navigator.share) await navigator.share({ title: 'Spot me on Corpus', url: invite }).catch(() => {});
              else {
                await navigator.clipboard.writeText(invite);
                setCopied(true);
              }
            }}
          >
            {copied ? 'Link copied' : 'Share invite link'}
          </Button>
        </Card>
      )}
      {!list.length && <p className="text-mute">No new Spotters to suggest right now.</p>}
      {list.map(({ s, score, reasons }) => (
        <Card key={s.id} className="flex items-center gap-3">
          <div className="w-14 shrink-0 text-center font-mono text-2xl text-lime">{score}%</div>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{s.name}</div>
            <div className="text-xs text-mute">
              {s.gym || 'No gym set'} · {s.split}
            </div>
            <div className="text-xs">{reasons.join(' · ') || 'different setup'}</div>
          </div>
          <Button variant="ghost" onClick={() => social.addSpotter(s.id)}>
            Add
          </Button>
        </Card>
      ))}
    </div>
  );
}

function Boards() {
  const data = useData();
  const spotters = useSocial((s) => s.spotters());
  const [lift, setLift] = useState<'squat' | 'bench' | 'deadlift'>('squat');
  if (!data || !spotters) return null;
  const { profile, sessions } = data;
  const myBw = toKg(profile.bodyWeight, profile.units);
  const mine = myBests(sessions, profile);
  const toUser = (kg: number) => Math.round((profile.units === 'kg' ? kg : kg * LB_PER_KG) * 10) / 10;

  const rows = [
    { id: 'me', name: 'You', kg: mine[lift], score: dots(mine[lift], myBw, profile.sex) },
    ...spotters.filter((s: Spotter) => s.isFriend).map((s) => ({ id: s.id, name: s.name, kg: spotterBests(s)[lift], score: dots(spotterBests(s)[lift], s.bodyWeightKg, s.sex) })),
  ]
    .filter((r) => r.kg > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      <Segmented options={['squat', 'bench', 'deadlift'] as const} labels={['Squat', 'Bench', 'Deadlift']} value={lift} onChange={(v) => v && setLift(v)} />
      <p className="text-xs text-mute">Ranked by DOTS: best e1RM adjusted for body weight. Your total DOTS: {myDots(sessions, profile)}</p>
      <Card>
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-2 py-1.5 ${r.id === 'me' ? 'text-lime' : ''}`}>
            <span className="w-5 font-mono text-mute">{i + 1}</span>
            <span className="flex-1">{r.name}</span>
            <span className="font-mono text-sm text-mute">
              {toUser(r.kg)} {profile.units}
            </span>
            <span className="w-16 text-right font-mono">{r.score}</span>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-mute">No {lift} logged yet.</p>}
      </Card>
    </div>
  );
}

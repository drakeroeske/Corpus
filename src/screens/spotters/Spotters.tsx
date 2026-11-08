import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveProfile, useData } from '../../data/repo';
import { crewStats, matches, myBests, myCrewLog, myDots, mySplit, social, spotterBests, syncMeNow, useSocial, type FeedItem } from '../../services/social';
import { LB_PER_KG, dots, toKg, type Spotter } from '../../engine';
import { Button, Card, Label, Segmented, SubTabs, TextInput, fmtDuration } from '../../components/ui';
import { CornerLabels, Grain, LabTable, Tag, pad3, useHeaderMeta } from '../../components/riso';
import { Empty, Silhouette } from '../../components/diagrams';
import type { ReactNode } from 'react';

/** Riso header: corner labels on bone, pink band with SPOTTER in Archivo Black. */
function SpotterHeader({ section, sub }: { section: string; sub?: ReactNode }) {
  const meta = useHeaderMeta();
  return (
    <div className="-mx-4 mb-4">
      <div className="px-4 pt-1 pb-2">
        <CornerLabels left={`SPOTTER // ${section}`} center={meta.center} right={meta.status} />
      </div>
      <div className="relative border-y-[3px] border-ink bg-signal px-4 pt-4 pb-3">
        <Grain />
        <h1 className="display relative text-[clamp(48px,18vw,76px)] text-ink">SPOTTER.</h1>
        {sub && <div className="relative mt-1 text-sm font-bold text-ink uppercase">{sub}</div>}
      </div>
    </div>
  );
}

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
      <SpotterHeader section={tab === 'feed' ? 'FEED' : tab === 'crews' ? 'CREW' : tab === 'gym' ? 'GYM' : tab === 'find' ? 'FIND' : 'BOARDS'} sub={social.kind === 'simulated' ? '[DEMO] Simulated Spotters' : account.email} />
      <InviteHandler />
      {!!pending && <p className="mb-3 text-xs uppercase"><span className="font-bold">[QUEUED]</span> {pending} update{pending > 1 ? 's' : ''} waiting to send — they go out when you're back online.</p>}
      <SubTabs
        tabs={[
          { id: 'feed', label: 'Feed' },
          { id: 'crews', label: 'Crew' },
          { id: 'gym', label: 'Gym' },
          { id: 'find', label: 'Find partner' },
          { id: 'boards', label: 'Boards' },
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
      <SpotterHeader section="SIGN IN" sub="Sign in to train with friends. Your training data stays on this phone — only what you choose to share goes online." />
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
        {msg && <p className="text-sm uppercase"><span className="font-bold">[ERROR]</span> {msg}</p>}
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
  const prOrder = [...feed.items].filter((x) => x.prs.length).sort((a, b) => a.time - b.time).map((x) => x.id);
  return (
    <div className="space-y-4">
      {feed.stale && <p className="text-xs uppercase"><span className="font-bold">[OFFLINE]</span> Showing your last saved feed.</p>}
      {!feed.items.length && <Empty>Finish a workout and it shows up here.</Empty>}
      {feed.items.map((p) => (
        <Post key={p.id} p={p} prNo={p.prs.length ? prOrder.indexOf(p.id) + 1 : 0} />
      ))}
    </div>
  );
}

/** Pull the headline load ("180 KG") out of a PR or top-set line. */
function headline(p: FeedItem): string | null {
  const m = (p.prs[0] ?? p.topSets[0] ?? '').match(/(\d+(?:\.\d+)?)\s*(kg|lb)/i);
  return m ? `${m[1]} ${m[2].toUpperCase()}` : null;
}

const handle = (name: string) => '@' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '');

function Post({ p, prNo }: { p: FeedItem; prNo: number }) {
  const [text, setText] = useState('');
  const liked = p.likes.includes('me');
  const big = headline(p);
  const lift = (p.prs[0] ?? p.topSets[0] ?? '').replace(/\s*(e1RM)?\s*\d.*$/i, '');
  return (
    <article className="relative border-2 border-ink bg-page">
      <Grain />
      <div className="relative flex justify-between border-b-2 border-ink px-3 py-2 text-[10px] font-bold uppercase">
        <span>
          {p.authorId === 'me' ? '@YOU' : handle(p.authorName)} · {p.pending ? 'SENDING…' : ago(p.time).toUpperCase()}
        </span>
        <span>{prNo ? `PR CARD Nº ${pad3(prNo)}` : fmtDuration(p.durationSec).toUpperCase()}</span>
      </div>
      <div className="relative flex items-center gap-3 px-3 pt-3">
        <div className={`shrink-0 border-2 border-ink p-1 ${p.prs.length ? 'bg-signal' : ''}`}>
          <Silhouette height={96} marks />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase">
            {p.title} {p.prs.length > 0 && <Tag signal>PR</Tag>}
          </div>
          {big && <div className="display mt-1 text-5xl">{big}</div>}
          {lift && <div className="text-xs uppercase">{lift}</div>}
        </div>
      </div>
      <div className="relative px-3 pt-2 text-xs uppercase">
        {p.topSets.map((t) => (
          <div key={t}>{t}</div>
        ))}
        {p.prs.map((t) => (
          <div key={t} className="font-bold">
            {t} · VERIFIED BY CORPUS
          </div>
        ))}
      </div>
      <div className="relative flex gap-2 px-3 pt-3">
        <Button variant="social" className="flex-1" onClick={() => social.toggleLike(p.id, liked)}>
          {liked ? 'Respected' : 'Respect'} ↑ {p.likes.length}
        </Button>
        {p.authorId !== 'me' && (
          <Button variant="ghost" onClick={() => social.comment(p.id, `[CHALLENGE] Coming for that ${lift || p.title}.`)}>
            Challenge
          </Button>
        )}
      </div>
      <div className="relative px-3 pt-2 pb-3">
        {p.comments.map((c) => (
          <div key={c.id} className="border-t border-dashed border-ink py-1 text-sm">
            <span className="font-bold uppercase">{c.authorName}</span> {c.text}
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
      </div>
    </article>
  );
}

/** Streak cells: filled = trained, dashed = planned but missed, blank = rest. */
function StreakCells({ log }: { log: { date: string; planned: boolean; done: boolean }[] }) {
  return (
    <div className="flex gap-[3px]" aria-label={`${log.filter((d) => d.done).length} sessions in ${log.length} days`}>
      {log.map((d) => (
        <div key={d.date} className={`h-4 flex-1 border border-ink ${d.done ? 'bg-ink' : d.planned ? 'border-dashed' : 'border-transparent'}`} />
      ))}
    </div>
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
            <div className="flex items-start justify-between gap-2">
              <span className="display text-4xl">{c.name}.</span>
              {st.streak > 0 ? <Tag signal>{st.streak} DAY STREAK</Tag> : <Tag>NO STREAK</Tag>}
            </div>
            <div className="mb-3 text-[10px] uppercase">Breaks if anyone misses a planned session.</div>
            <Label>Consistency · 14 days</Label>
            {st.board.map((m, i) => (
              <div key={m.id} className="border-t border-dashed border-ink py-2 text-xs uppercase first:border-t-0">
                <div className="mb-1 flex justify-between">
                  <span className="font-bold">
                    {String(i + 1).padStart(2, '0')} {nameOf(m.id)}
                  </span>
                  <span className="font-bold">{m.pct}%</span>
                </div>
                <StreakCells log={(m.id === 'me' ? me : c.log[m.id] ?? []).slice(-14)} />
              </div>
            ))}
          </Card>
        );
      })}

      <Card className="space-y-2">
        <div className="text-xs font-bold uppercase">New crew (2–8 people)</div>
        <TextInput placeholder="Crew name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {friends.map((f) => {
            const on = picked.includes(f.id);
            return (
              <button
                key={f.id}
                aria-pressed={on} className={`min-h-11 border-2 border-ink px-3 text-xs font-bold uppercase ${on ? 'bg-ink text-page' : ''}`}
                onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : picked.length < 7 ? [...picked, f.id] : picked)}
              >
                {f.name}
              </button>
            );
          })}
          {!friends.length && <span className="text-xs uppercase">Add Spotters in Find partner first.</span>}
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
          <div className="mb-2 flex justify-between text-[10px] font-bold uppercase">
            <span>{here}</span>
            <Tag>LIVE</Tag>
          </div>
          {there.length ? (
            <LabTable head={['Spotter', 'Split']} align={['l', 'r']} rows={there.map((s) => ({ key: s.id, cells: [<span className="font-bold uppercase">{s.name}</span>, s.split] }))} />
          ) : (
            <Empty>No Spotters here right now.</Empty>
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
          <div className="text-xs font-bold uppercase">Invite a friend</div>
          <div className="text-xs">Send this link. When they open it and sign in, they can add you.</div>
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
      {!list.length && <Empty>No new Spotters to suggest right now.</Empty>}
      {list.map(({ s, score, reasons }) => (
        <Card key={s.id} className="flex items-center gap-3">
          <div className="display w-20 shrink-0 text-center text-4xl">{score}%</div>
          <div className="min-w-0 flex-1">
            <div className="font-bold uppercase">{s.name}</div>
            <div className="text-[10px] uppercase">
              {s.gym || 'No gym set'} · {s.split}
            </div>
            <div className="text-xs uppercase">{reasons.join(' · ') || 'different setup'}</div>
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
      <p className="text-xs uppercase">Ranked by DOTS: best e1RM adjusted for body weight. Your total DOTS: {myDots(sessions, profile)}</p>
      <LabTable
        head={['Rk', 'Spotter', `e1RM ${profile.units}`, 'DOTS']}
        align={['l', 'l', 'r', 'r']}
        bold={[3]}
        rows={rows.map((r, i) => ({
          key: r.id,
          cells: [String(i + 1).padStart(2, '0'), <span className={`uppercase ${r.id === 'me' ? 'font-bold' : ''}`}>{r.name}</span>, toUser(r.kg), r.score],
        }))}
      />
      {!rows.length && <Empty>No {lift} logged yet.</Empty>}
    </div>
  );
}

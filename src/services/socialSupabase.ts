// Real social backend on Supabase (auth + Postgres + realtime).
// Writes go through the offline outbox; the signed-in user's id is shown to the UI as 'me'.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { addDays, type Crew, type CrewDay, type GymCheckIn, type Sex, type Spotter } from '../engine';
import { db, todayKey, uid, type OutboxOp } from '../data/db';
import { applyPending, enqueue, flush, pendingOps, PermanentError } from './outbox';
import { makeEmitter, type FeedItem, type SocialService } from './socialTypes';

const CACHE_KEY = 'corpus-feed-cache';
const NOW_WINDOW_MS = 3 * 3600_000;

export function createSupabaseSocial(url: string, anonKey: string): SocialService {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const ev = makeEmitter();
  let myId: string | null = null;

  sb.auth.getSession().then(({ data }) => {
    myId = data.session?.user.id ?? null;
    if (myId) sync();
  });
  sb.auth.onAuthStateChange((_e, session) => {
    myId = session?.user.id ?? null;
    ev.emit();
    if (myId) sync();
  });

  const toView = (id: string) => (id === myId ? 'me' : id);
  const toServer = (id: string) => (id === 'me' ? myId! : id);
  const must = <T>(r: { data: T; error: { message: string; code?: string } | null }): T => {
    if (r.error) {
      // 42501 = blocked by access rules, 23505 = duplicate, 23503 = missing reference: retrying won't help.
      if (r.error.code && ['42501', '23505', '23503', '22P02'].includes(r.error.code)) throw new PermanentError(r.error.message);
      throw new Error(r.error.message);
    }
    return r.data;
  };

  async function send(op: OutboxOp) {
    if (!myId) throw new Error('signed out');
    const p = op.payload;
    switch (op.kind) {
      case 'post':
        must(await sb.from('posts').upsert({ id: p.id, author_id: myId, time: new Date(p.time).toISOString(), title: p.title, duration_sec: p.durationSec, top_sets: p.topSets, prs: p.prs }));
        break;
      case 'deletePost':
        must(await sb.from('posts').delete().eq('id', p.id));
        break;
      case 'like':
        must(await sb.from('likes').upsert({ post_id: p.postId, user_id: myId }, { ignoreDuplicates: true }));
        break;
      case 'unlike':
        must(await sb.from('likes').delete().eq('post_id', p.postId).eq('user_id', myId));
        break;
      case 'comment':
        must(await sb.from('comments').upsert({ id: p.id, post_id: p.postId, author_id: myId, time: new Date(op.time).toISOString(), text: p.text }));
        break;
      case 'checkin':
        must(await sb.from('gym_checkins').insert({ id: p.id, user_id: myId, gym: p.gym, time: new Date(op.time).toISOString() }));
        break;
      case 'follow':
        must(await sb.from('follows').upsert({ follower: myId, followee: p.id }, { ignoreDuplicates: true }));
        break;
      case 'crew':
        must(await sb.from('crews').upsert({ id: p.id, name: p.name, created_by: myId }));
        must(await sb.from('crew_members').upsert([myId, ...p.memberIds].map((user_id: string) => ({ crew_id: p.id, user_id })), { ignoreDuplicates: true }));
        break;
      case 'syncMe':
        must(
          await sb.from('profiles').upsert({
            id: myId, name: p.name, gym: p.gym, schedule: p.schedule, split: p.split, body_weight_kg: p.bodyWeightKg,
            sex: p.sex ?? null, bests: p.bests, discoverable: p.discoverable, updated_at: new Date().toISOString(),
          }),
        );
        must(await sb.from('training_days').upsert((p.trainingLog as CrewDay[]).map((d) => ({ user_id: myId, date: d.date, planned: d.planned, done: d.done }))));
        break;
    }
  }

  async function sync() {
    if (!myId || !navigator.onLine) return;
    const sent = await flush(send).catch(() => 0);
    if (sent) ev.emit();
  }

  const queue = async (kind: OutboxOp['kind'], payload: unknown) => {
    await enqueue(kind, payload);
    ev.emit();
    sync();
  };

  window.addEventListener('online', () => {
    sync().then(() => ev.emit());
  });

  sb.channel('corpus-social')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => ev.emit())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => ev.emit())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => ev.emit())
    .subscribe();

  async function myName() {
    if (!myId) return 'You';
    const r = await sb.from('profiles').select('name').eq('id', myId).maybeSingle();
    return (r.data?.name as string) ?? 'You';
  }

  return {
    kind: 'supabase',

    async account() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email } : null;
    },
    async sendSignInCode(email) {
      must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }));
    },
    async verifySignInCode(email, code) {
      must(await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' }));
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async feed() {
      const ops = await pendingOps();
      try {
        const rows = must(
          await sb
            .from('posts')
            .select(
              'id, author_id, time, title, duration_sec, top_sets, prs, author:profiles!posts_author_id_fkey(name), likes(user_id), comments(id, author_id, time, text, author:profiles!comments_author_id_fkey(name))',
            )
            .order('time', { ascending: false })
            .limit(50),
        ) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        const items: FeedItem[] = rows.map((r) => ({
          id: r.id,
          authorId: toView(r.author_id),
          authorName: r.author_id === myId ? 'You' : r.author?.name ?? 'Someone',
          time: Date.parse(r.time),
          title: r.title ?? 'Workout',
          durationSec: r.duration_sec ?? 0,
          topSets: r.top_sets ?? [],
          prs: r.prs ?? [],
          likes: (r.likes ?? []).map((l: { user_id: string }) => toView(l.user_id)),
          comments: (r.comments ?? [])
            .map((c: any) => ({ id: c.id, postId: r.id, authorId: toView(c.author_id), authorName: c.author_id === myId ? 'You' : c.author?.name ?? 'Someone', time: Date.parse(c.time), text: c.text })) // eslint-disable-line @typescript-eslint/no-explicit-any
            .sort((a: { time: number }, b: { time: number }) => a.time - b.time),
        }));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(items));
        } catch {
          /* storage unavailable */
        }
        return { items: applyPending(items, ops), stale: false };
      } catch {
        let cached: FeedItem[] = [];
        try {
          cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
        } catch {
          /* ignore */
        }
        return { items: applyPending(cached, ops), stale: true };
      }
    },

    async spotters() {
      if (!myId) return [];
      const since = new Date(Date.now() - NOW_WINDOW_MS).toISOString();
      const [profiles, follows, checkins] = await Promise.all([
        sb.from('profiles').select('*').neq('id', myId),
        sb.from('follows').select('followee').eq('follower', myId),
        sb.from('gym_checkins').select('user_id, gym, time').gte('time', since),
      ]);
      const friends = new Set(((follows.data ?? []) as { followee: string }[]).map((f) => f.followee));
      const ops = await pendingOps();
      for (const o of ops) if (o.kind === 'follow') friends.add(o.payload.id);
      const here = (checkins.data ?? []) as { user_id: string; gym: string }[];
      return ((profiles.data ?? []) as any[]).map( // eslint-disable-line @typescript-eslint/no-explicit-any
        (p): Spotter => ({
          id: p.id,
          name: p.name ?? 'Lifter',
          gym: here.find((c) => c.user_id === p.id)?.gym ?? p.gym ?? '',
          schedule: p.schedule ?? [],
          split: p.split ?? '',
          bodyWeightKg: Number(p.body_weight_kg) || 75,
          sex: (p.sex as Sex) ?? 'male',
          bests: p.bests ?? {},
          isFriend: friends.has(p.id),
          trainingNow: here.some((c) => c.user_id === p.id),
        }),
      );
    },

    async crews() {
      if (!myId) return [];
      const r = await sb.from('crews').select('id, name, crew_members(user_id)');
      const crews = (r.data ?? []) as { id: string; name: string; crew_members: { user_id: string }[] }[];
      const ids = [...new Set(crews.flatMap((c) => c.crew_members.map((m) => m.user_id)))];
      const days = ids.length
        ? (((await sb.from('training_days').select('user_id, date, planned, done').in('user_id', ids).gte('date', addDays(todayKey(), -27))).data ?? []) as {
            user_id: string;
            date: string;
            planned: boolean;
            done: boolean;
          }[])
        : [];
      return crews.map(
        (c): Crew => ({
          id: c.id,
          name: c.name,
          memberIds: c.crew_members.map((m) => toView(m.user_id)),
          log: Object.fromEntries(
            c.crew_members
              .filter((m) => m.user_id !== myId)
              .map((m) => [m.user_id, days.filter((d) => d.user_id === m.user_id).map((d) => ({ date: d.date, planned: d.planned, done: d.done }))]),
          ),
        }),
      );
    },

    async lastGymCheckIn() {
      const pending = (await pendingOps()).filter((o) => o.kind === 'checkin').pop();
      if (pending) return { id: pending.payload.id, gym: pending.payload.gym, time: pending.time, userId: 'me' };
      if (!myId) return null;
      const r = await sb.from('gym_checkins').select('id, gym, time').eq('user_id', myId).order('time', { ascending: false }).limit(1).maybeSingle();
      return r.data ? ({ id: r.data.id, gym: r.data.gym, time: Date.parse(r.data.time), userId: 'me' } as GymCheckIn) : null;
    },

    pendingCount: () => pendingOps().then((o) => o.length),

    postWorkout: (post) => queue('post', post),
    deletePost: (id) => queue('deletePost', { id }),
    toggleLike: (postId, liked) => queue(liked ? 'unlike' : 'like', { postId }),
    comment: (postId, text) => queue('comment', { id: uid(), postId, text: text.trim() }),
    checkInAtGym: (gym) => queue('checkin', { id: uid(), gym }),
    addSpotter: (id) => queue('follow', { id: toServer(id) }),
    createCrew: (name, memberIds) => queue('crew', { id: uid(), name, memberIds: memberIds.map(toServer) }),
    async syncMe(me) {
      // Replace any older queued snapshot rather than piling them up.
      for (const o of await pendingOps()) if (o.kind === 'syncMe') await db.outbox.delete(o.id);
      await queue('syncMe', { ...me, name: me.name || (await myName()) });
    },

    subscribe: ev.subscribe,
  };
}

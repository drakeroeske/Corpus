// Simulated social backend: everything lives in local Dexie tables (demo Spotters, crews…).
import { db, uid } from '../data/db';
import type { Spotter } from '../engine';
import { makeEmitter, type SocialService } from './socialTypes';

const nameOf = (spotters: Spotter[], id: string) => (id === 'me' ? 'You' : spotters.find((s) => s.id === id)?.name ?? 'Someone');
const ev = makeEmitter();
const write = async (f: () => Promise<unknown>) => {
  await f();
  ev.emit();
};

export const localSocial: SocialService = {
  kind: 'simulated',
  account: async () => ({ id: 'me' }),
  sendSignInCode: async () => {},
  verifySignInCode: async () => {},
  signOut: async () => {},

  async feed() {
    const [posts, comments, spotters] = await Promise.all([db.posts.orderBy('time').reverse().toArray(), db.comments.toArray(), db.spotters.toArray()]);
    const items = posts.map((p) => ({
      ...p,
      authorName: nameOf(spotters, p.authorId),
      comments: comments
        .filter((c) => c.postId === p.id)
        .sort((a, b) => a.time - b.time)
        .map((c) => ({ ...c, authorName: nameOf(spotters, c.authorId) })),
    }));
    return { items, stale: false };
  },
  spotters: () => db.spotters.toArray(),
  crews: () => db.crews.toArray(),
  async lastGymCheckIn() {
    const all = await db.gymCheckins.orderBy('time').reverse().toArray();
    return all.find((c) => c.userId === 'me') ?? null;
  },
  pendingCount: async () => 0,

  postWorkout: (post) => write(() => db.posts.put({ ...post, authorId: 'me', likes: [] })),
  deletePost: (id) => write(() => db.posts.delete(id)),
  toggleLike: (postId, liked) =>
    write(async () => {
      const p = await db.posts.get(postId);
      if (p) await db.posts.update(postId, { likes: liked ? p.likes.filter((x) => x !== 'me') : [...p.likes, 'me'] });
    }),
  comment: (postId, text) => write(() => db.comments.add({ id: uid(), postId, authorId: 'me', time: Date.now(), text: text.trim() })),
  checkInAtGym: (gym) => write(() => db.gymCheckins.add({ id: uid(), gym, time: Date.now(), userId: 'me' })),
  addSpotter: (id) => write(() => db.spotters.update(id, { isFriend: true })),
  createCrew: (name, memberIds) => write(() => db.crews.add({ id: uid(), name, memberIds: ['me', ...memberIds], log: {} })),
  syncMe: async () => {},
  subscribe: ev.subscribe,
};

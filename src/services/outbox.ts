// Offline queue for social writes: ops are stored on the device and sent in order when online.
import { db, uid, type OutboxOp } from '../data/db';
import type { FeedItem } from './socialTypes';

export async function enqueue(kind: OutboxOp['kind'], payload: unknown) {
  await db.outbox.add({ id: uid(), time: Date.now(), kind, payload });
}

export const pendingOps = () => db.outbox.orderBy('time').toArray();

/** Error that will never succeed on retry (e.g. rejected by access rules): the op is dropped. */
export class PermanentError extends Error {}

let flushing: Promise<number> | null = null;

/** Send queued ops oldest-first. Stops at the first temporary failure. Returns how many were sent. */
export function flush(send: (op: OutboxOp) => Promise<void>): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (const op of await pendingOps()) {
      try {
        await send(op);
        sent++;
      } catch (e) {
        if (!(e instanceof PermanentError)) break;
        console.warn('Dropping social op', op.kind, e.message);
      }
      await db.outbox.delete(op.id);
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Show queued posts, likes and comments in the feed before the server has them. */
export function applyPending(items: FeedItem[], ops: OutboxOp[], myName = 'You'): FeedItem[] {
  let out = items.map((p) => ({ ...p, likes: [...p.likes], comments: [...p.comments] }));
  for (const op of ops) {
    const p = op.payload;
    if (op.kind === 'post' && !out.some((x) => x.id === p.id)) {
      out.push({ ...p, authorId: 'me', authorName: myName, likes: [], comments: [], pending: true });
    } else if (op.kind === 'deletePost') {
      out = out.filter((x) => x.id !== p.id);
    } else if (op.kind === 'like' || op.kind === 'unlike') {
      const post = out.find((x) => x.id === p.postId);
      if (post) post.likes = op.kind === 'like' ? [...new Set([...post.likes, 'me'])] : post.likes.filter((u) => u !== 'me');
    } else if (op.kind === 'comment') {
      const post = out.find((x) => x.id === p.postId);
      if (post && !post.comments.some((c) => c.id === p.id)) {
        post.comments.push({ id: p.id, postId: p.postId, authorId: 'me', authorName: myName, time: op.time, text: p.text });
      }
    }
  }
  return out.sort((a, b) => b.time - a.time);
}

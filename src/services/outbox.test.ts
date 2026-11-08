import { describe, expect, it } from 'vitest';
import { applyPending } from './outbox';
import type { FeedItem } from './socialTypes';
import type { OutboxOp } from '../data/db';

const post = (id: string, time: number, likes: string[] = []): FeedItem => ({
  id, authorId: 'u1', authorName: 'Maya', time, title: 'Upper', durationSec: 3000, topSets: [], prs: [], likes, comments: [],
});
const op = (kind: OutboxOp['kind'], payload: unknown, time = 0): OutboxOp => ({ id: `${kind}-${time}`, time, kind, payload });

describe('Offline outbox merge', () => {
  it('shows a queued workout post at the top, marked pending', () => {
    const out = applyPending([post('a', 100)], [op('post', { id: 'mine', time: 200, title: 'Legs', durationSec: 3600, topSets: [], prs: [] }, 200)]);
    expect(out[0]).toMatchObject({ id: 'mine', authorId: 'me', pending: true });
  });
  it('applies queued likes, unlikes, comments and deletes', () => {
    const out = applyPending(
      [post('a', 100), post('b', 50, ['me'])],
      [op('like', { postId: 'a' }, 1), op('unlike', { postId: 'b' }, 2), op('comment', { id: 'c1', postId: 'a', text: 'nice' }, 3)],
    );
    expect(out.find((p) => p.id === 'a')!.likes).toEqual(['me']);
    expect(out.find((p) => p.id === 'b')!.likes).toEqual([]);
    expect(out.find((p) => p.id === 'a')!.comments[0]).toMatchObject({ text: 'nice', authorId: 'me' });
    expect(applyPending([post('a', 1)], [op('deletePost', { id: 'a' })])).toEqual([]);
  });
  it('does not duplicate a post the server already has', () => {
    const out = applyPending([post('a', 100)], [op('post', { id: 'a', time: 100 })]);
    expect(out).toHaveLength(1);
    expect(out[0].pending).toBeUndefined();
  });
});

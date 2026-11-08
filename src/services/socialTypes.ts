import type { Comment, Crew, CrewDay, FeedPost, GymCheckIn, Sex, Spotter } from '../engine';

/** Everything is expressed from the viewer's side: the signed-in user is always 'me'. */
export interface FeedItem extends FeedPost {
  authorName: string;
  comments: (Comment & { authorName: string })[];
  pending?: boolean; // queued offline, not yet on the server
}

/** What I share about myself with Spotters. */
export interface MeSnapshot {
  name: string;
  gym: string;
  schedule: number[];
  split: string;
  bodyWeightKg: number;
  sex?: Sex;
  bests: Record<string, number>; // 'back-squat' | 'bench-press' | 'deadlift' → e1RM kg
  discoverable: boolean;
  trainingLog: CrewDay[]; // last 28 days, for crew streaks
}

export interface Account {
  id: string;
  email?: string;
}

export interface SocialService {
  kind: 'simulated' | 'supabase';
  account(): Promise<Account | null>; // null = signed out
  sendSignInCode(email: string): Promise<void>;
  verifySignInCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  feed(): Promise<{ items: FeedItem[]; stale: boolean }>;
  spotters(): Promise<Spotter[]>; // friends (isFriend) + discoverable suggestions
  crews(): Promise<Crew[]>;
  lastGymCheckIn(): Promise<GymCheckIn | null>;
  pendingCount(): Promise<number>;

  postWorkout(post: Omit<FeedPost, 'authorId' | 'likes'>): Promise<void>;
  deletePost(id: string): Promise<void>;
  toggleLike(postId: string, currentlyLiked: boolean): Promise<void>;
  comment(postId: string, text: string): Promise<void>;
  checkInAtGym(gym: string): Promise<void>;
  addSpotter(id: string): Promise<void>;
  createCrew(name: string, memberIds: string[]): Promise<void>;
  syncMe(me: MeSnapshot): Promise<void>;

  /** Called whenever social data may have changed (local write, server push, back online). */
  subscribe(cb: () => void): () => void;
}

export function makeEmitter() {
  const subs = new Set<() => void>();
  return {
    emit: () => subs.forEach((f) => f()),
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

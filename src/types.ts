export type Stage = 'pending' | 'in-progress' | 'committed' | 'released' | 'done';

export type EffectiveStage = Stage | 'pushed';

export interface Task {
  id: string;
  description: string;
  stage: Stage;
  /** Unique event ID written when transitioning to 'committed'. Used to find
   *  the closing commit in git history so `pushed` derivation is accurate even
   *  when the user calls `update --stage committed` before making the commit. */
  committedEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export const STAGES: Stage[] = ['pending', 'in-progress', 'committed', 'released', 'done'];

export const DONE_STAGES: Stage[] = ['done'];

export const DERIVED_STAGES = ['pushed'] as const;

export type Stage =
  | 'pending'
  | 'in-progress'
  | 'implemented'
  | 'verified'
  | 'committed'
  | 'pushed'
  | 'pr-created'
  | 'merged'
  | 'released'
  | 'published'
  | 'done';

export interface Task {
  id: string;
  description: string;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
}

export const STAGES: Stage[] = [
  'pending',
  'in-progress',
  'implemented',
  'verified',
  'committed',
  'pushed',
  'pr-created',
  'merged',
  'released',
  'published',
  'done',
];

export const DONE_STAGES: Stage[] = ['done'];

import type {
  FoundationCapabilities,
  FoundationLifecycle,
  RhythmAutomation
} from '../../../src/domain/capabilities.ts';
import type { MoneyGoal } from './money-goals.ts';

export type FoundationPreview = {
  id: string;
  category: 'Marriage' | 'Finances';
  name: string;
  description: string;
  capabilities: FoundationCapabilities;
  lifecycle: FoundationLifecycle;
  sampleOnly?: boolean;
};

export type GoalPreview = MoneyGoal;

export type RhythmPreview = {
  id: string;
  title: string;
  cadence: string;
  timeLabel: string;
  automation: RhythmAutomation;
  status: 'Not confirmed' | 'Due today';
  description: string;
};

export const areas = [
  { id: 'faith', label: 'Faith' },
  { id: 'marriage', label: 'Marriage' },
  { id: 'parenting', label: 'Parenting' },
  { id: 'health', label: 'Health & Fitness' },
  { id: 'finances', label: 'Finances' },
  { id: 'friendships', label: 'Friendships' }
] as const;

export const marriageFoundation: FoundationPreview = {
  id: 'marriage-connection',
  category: 'Marriage',
  name: 'Connection',
  description: 'An ongoing foundation supported by small, intentional investments.',
  capabilities: {
    rhythms: true,
    numericGoals: false,
    completion: 'ongoing'
  },
  lifecycle: 'active'
};

export const financeFoundation: FoundationPreview = {
  id: 'finance-example-milestone',
  category: 'Finances',
  name: 'Emergency reserve · example milestone',
  description: 'A sample completable milestone. This is illustrative, not a finalized Finances taxonomy.',
  capabilities: {
    rhythms: true,
    numericGoals: true,
    completion: 'milestone'
  },
  lifecycle: 'active',
  sampleOnly: true
};

export const goals: GoalPreview[] = [
  {
    id: 'sample-savings',
    title: 'Starter reserve',
    currency: 'USD',
    direction: 'increase',
    startingBalanceMinor: 100000,
    startDate: '2026-10-01',
    targetBalanceMinor: 500000,
    targetDate: '2027-06-30',
    checkIns: [
      { id: 'sample-savings-check-in-1', effectiveDate: '2026-10-08', balanceMinor: 112500 },
      { id: 'sample-savings-check-in-2', effectiveDate: '2026-10-18', balanceMinor: 125000 }
    ],
    correctionHistory: []
  },
  {
    id: 'sample-debt',
    title: 'Debt payoff',
    currency: 'USD',
    direction: 'decrease',
    startingBalanceMinor: 750000,
    startDate: '2026-10-01',
    targetBalanceMinor: 400000,
    targetDate: '2027-12-31',
    checkIns: [
      { id: 'sample-debt-check-in-1', effectiveDate: '2026-10-08', balanceMinor: 700000 },
      { id: 'sample-debt-check-in-2', effectiveDate: '2026-10-18', balanceMinor: 680000 }
    ],
    correctionHistory: []
  }
];

export const rhythms: RhythmPreview[] = [
  {
    id: 'sample-transfer',
    title: 'Monthly savings transfer',
    cadence: 'Monthly · 1st',
    timeLabel: 'Monthly',
    automation: 'external',
    status: 'Not confirmed',
    description: 'External setup is only a label; Tend does not verify a transfer or change a balance.'
  }
];

export const todayRhythms: RhythmPreview[] = [
  {
    id: 'sample-pray-together',
    title: 'Pray together',
    cadence: 'Daily',
    timeLabel: 'Morning',
    automation: 'manual',
    status: 'Due today',
    description: 'Take a quiet moment to pray together and begin the day connected.'
  },
  {
    id: 'sample-connect',
    title: 'Daily connection',
    cadence: 'Daily',
    timeLabel: 'Evening',
    automation: 'manual',
    status: 'Due today',
    description: 'Set aside a few minutes to share how your day went.'
  },
  {
    id: 'sample-walk',
    title: 'Take a walk',
    cadence: '3 times a week',
    timeLabel: 'Afternoon',
    automation: 'manual',
    status: 'Due today',
    description: 'Get outside for a short walk and a little fresh air.'
  }
];

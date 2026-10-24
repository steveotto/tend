import type {
  FoundationCapabilities,
  FoundationLifecycle,
  RhythmAutomation
} from '../../../src/domain/capabilities.ts';
import type { MoneyGoal } from './money-goals.ts';
import type { RhythmSchedule, RhythmScoringMetadata, RhythmTimeValue } from './rhythm-schedule.ts';

export type FoundationPreview = {
  id: string;
  category: 'Marriage' | 'Finances';
  name: string;
  description: string;
  capabilities: FoundationCapabilities;
  lifecycle: FoundationLifecycle;
  sampleOnly?: boolean;
  iconId?: string;
  illustrativeScore?: number | null;
};

export type GoalPreview = MoneyGoal;

export type MarriageRhythmGroupId = 'daily' | 'weekly' | 'seasonal';

export type PersonPreview = {
  id: PersonId;
  displayName: string;
  avatarUrl?: string;
};

export type PersonId = 'sample-person-avery' | 'sample-person-morgan' | 'sample-person-jordan';
export type PersonPickerGroupId = 'marriage' | 'parenting' | 'friends';

export type PersonPickerGroup = {
  id: PersonPickerGroupId;
  label: string;
  memberIds: readonly PersonId[];
};

const syntheticPeopleById = {
  'sample-person-avery': { id: 'sample-person-avery', displayName: 'Avery Brooks' },
  'sample-person-morgan': { id: 'sample-person-morgan', displayName: 'Morgan Reed' },
  'sample-person-jordan': { id: 'sample-person-jordan', displayName: 'Jordan Bell' }
} satisfies Record<PersonId, PersonPreview>;

export const syntheticPeople = Object.values(syntheticPeopleById);

export const syntheticPersonPickerGroups: readonly PersonPickerGroup[] = [
  { id: 'marriage', label: 'Marriage', memberIds: ['sample-person-avery', 'sample-person-morgan'] },
  { id: 'parenting', label: 'Parenting', memberIds: ['sample-person-morgan', 'sample-person-jordan'] },
  { id: 'friends', label: 'Friends', memberIds: ['sample-person-avery', 'sample-person-jordan'] }
];

export function personById(id: PersonId): PersonPreview {
  return syntheticPeopleById[id];
}

export type RhythmPreview = {
  id: string;
  title: string;
  cadence?: string | undefined;
  timeLabel?: string | undefined;
  automation: RhythmAutomation;
  status: 'Not confirmed' | 'Due today';
  description?: string | undefined;
  primaryFoundationId?: string;
  secondaryFoundationIds?: readonly string[];
  completionHistory?: readonly RhythmCompletion[] | undefined;
  marriageGroup?: MarriageRhythmGroupId;
  iconId?: string;
  illustrativeScore?: number | null | undefined;
  personIds?: readonly PersonId[];
  categoryIds?: readonly ('faith' | 'marriage' | 'parenting' | 'health' | 'finances' | 'friendships')[];
  schedule?: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
  timeOfDay?: RhythmTimeValue;
  personal?: boolean;
};

export type RhythmCompletion = {
  id: string;
  effectiveDate: string;
  localTime?: string;
  timeZone?: string;
  completedAt?: string;
  recordedAt?: string;
  memory?: string;
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

const ongoingMarriageCapabilities: FoundationCapabilities = {
  rhythms: true,
  numericGoals: false,
  completion: 'ongoing'
};

export type MarriageExampleId = 'populated' | 'empty';

export type MarriageFixture = {
  id: MarriageExampleId;
  summary: {
    overallScore: number | null;
    rhythmScore: number | null;
    foundationScore: number | null;
  };
  foundations: FoundationPreview[];
  rhythms: RhythmPreview[];
  today: {
    topic: string;
    prompt: string;
  } | null;
  week: {
    startDate: string;
    todayDate: string;
    target: number;
  };
};

const marriageFoundationDetails = [
  {
    id: 'connection',
    category: 'Marriage',
    name: 'Connection',
    description: 'Feeling known, loved, and emotionally close.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'connection'
  },
  {
    id: 'communication',
    category: 'Marriage',
    name: 'Communication',
    description: 'Listening, understanding, and navigating life together.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'communication'
  },
  {
    id: 'fun-adventure',
    category: 'Marriage',
    name: 'Fun & Adventure',
    description: 'Enjoying life together, laughter, and shared experiences.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'fun-adventure'
  },
  {
    id: 'spiritual-growth',
    category: 'Marriage',
    name: 'Spiritual Growth',
    description: 'Shared faith, prayer, and spiritual growth.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'spiritual-growth'
  },
  {
    id: 'partnership',
    category: 'Marriage',
    name: 'Partnership',
    description: 'Teamwork, support, and shared responsibilities.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'partnership'
  },
  {
    id: 'intimacy',
    category: 'Marriage',
    name: 'Intimacy',
    description: 'Affection, romance, and physical closeness.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'intimacy'
  }
] satisfies FoundationPreview[];

const marriageFoundationScores: Record<string, number | null> = {
  connection: 82,
  communication: 76,
  'fun-adventure': 88,
  'spiritual-growth': 64,
  partnership: null,
  intimacy: 72
};

const populatedMarriageFoundations: FoundationPreview[] = marriageFoundationDetails.map(foundation => ({
  ...foundation,
  illustrativeScore: marriageFoundationScores[foundation.id] ?? null
}));

const populatedMarriageRhythms: RhythmPreview[] = [
  {
    id: 'sample-marriage-connection',
    title: 'Daily Connection',
    cadence: '5 times a week',
    timeLabel: 'Anytime',
    automation: 'manual',
    status: 'Due today',
    description: 'Make a little room each day to connect in a way that fits your life.',
    iconId: 'daily-connection',
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    illustrativeScore: 82,
    marriageGroup: 'daily',
    primaryFoundationId: 'connection',
    secondaryFoundationIds: ['communication', 'intimacy'],
    completionHistory: [
      { id: 'sample-marriage-connection-2026-10-20', effectiveDate: '2026-10-20' },
      { id: 'sample-marriage-connection-2026-10-18', effectiveDate: '2026-10-18' },
      { id: 'sample-marriage-connection-2026-10-17', effectiveDate: '2026-10-17' }
    ]
  },
  {
    id: 'sample-marriage-date-night',
    title: 'Date Night',
    cadence: 'Weekly',
    timeLabel: 'Evening',
    automation: 'manual',
    status: 'Not confirmed',
    description: 'Enjoy intentional time together beyond responsibilities and logistics.',
    iconId: 'date-night',
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    illustrativeScore: 68,
    marriageGroup: 'weekly',
    primaryFoundationId: 'fun-adventure',
    secondaryFoundationIds: ['connection'],
    completionHistory: [
      { id: 'sample-marriage-date-night-2026-10-16', effectiveDate: '2026-10-16' },
      { id: 'sample-marriage-date-night-2026-10-09', effectiveDate: '2026-10-09' }
    ]
  },
  {
    id: 'sample-marriage-prayer',
    title: 'Pray Together',
    cadence: 'Daily',
    timeLabel: 'Evening',
    automation: 'manual',
    status: 'Due today',
    description: 'Bring gratitude and needs before God together.',
    iconId: 'pray-together',
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    illustrativeScore: 0,
    primaryFoundationId: 'spiritual-growth',
    secondaryFoundationIds: ['connection'],
    completionHistory: [],
    marriageGroup: 'daily'
  },
  {
    id: 'sample-marriage-dream',
    title: 'Dream Together',
    cadence: 'Quarterly',
    timeLabel: 'Anytime',
    automation: 'manual',
    status: 'Not confirmed',
    description: 'Talk about hopes, plans, and the next season of life.',
    iconId: 'dream-together',
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    illustrativeScore: null,
    primaryFoundationId: 'partnership',
    secondaryFoundationIds: ['fun-adventure'],
    completionHistory: [
      { id: 'sample-marriage-dream-2026-10-12', effectiveDate: '2026-10-12' }
    ],
    marriageGroup: 'seasonal'
  }
];

export const marriageExampleFixtures: Record<MarriageExampleId, MarriageFixture> = {
  populated: {
    id: 'populated',
    summary: { overallScore: 78, rhythmScore: 68, foundationScore: 81 },
    foundations: populatedMarriageFoundations,
    rhythms: populatedMarriageRhythms,
    today: {
      topic: 'Unhurried conversation',
      prompt: 'What has been taking up the most space in your mind lately?'
    },
    week: { startDate: '2026-10-18', todayDate: '2026-10-21', target: 5 }
  },
  empty: {
    id: 'empty',
    summary: { overallScore: null, rhythmScore: null, foundationScore: null },
    foundations: marriageFoundationDetails.map(foundation => ({
      ...foundation,
      illustrativeScore: null
    })),
    rhythms: [],
    today: null,
    week: { startDate: '2026-10-18', todayDate: '2026-10-21', target: 5 }
  }
};

export const todayAreaIllustrativeScores: Partial<Record<(typeof areas)[number]['id'], number | null>> = {
  marriage: marriageExampleFixtures.populated.summary.overallScore
};

export function todayAreaScore(
  areaId: (typeof areas)[number]['id'],
  marriageExampleId: MarriageExampleId
): number | null {
  return areaId === 'marriage'
    ? marriageExampleFixtures[marriageExampleId].summary.overallScore
    : todayAreaIllustrativeScores[areaId] ?? null;
}

export const todayOverallIllustrativeScore = 87;

export const marriageFoundations = marriageExampleFixtures.populated.foundations;
export const marriageRhythms = marriageExampleFixtures.populated.rhythms;

export const marriageRhythmGroups: { id: MarriageRhythmGroupId; title: string }[] = [
  { id: 'daily', title: 'Daily Connection' },
  { id: 'weekly', title: 'Weekly Investment' },
  { id: 'seasonal', title: 'Seasonal & Annual' }
];

export function marriageFoundationCoverage(fixture: MarriageFixture, foundationId: string) {
  const associated = rhythmsSupportingFoundation(fixture.rhythms, foundationId);
  return {
    scored: associated.filter(rhythm => rhythm.illustrativeScore !== null && rhythm.illustrativeScore !== undefined).length,
    total: associated.length
  };
}

export function peopleForRhythm(rhythm: Pick<RhythmPreview, 'personIds'>): PersonPreview[] {
  return (rhythm.personIds ?? []).map(personById);
}

export function marriageScoreCoverage(scores: readonly (number | null | undefined)[]) {
  return {
    scored: scores.filter(score => score !== null && score !== undefined).length,
    total: scores.length
  };
}

export function marriageWeekDays(fixture: MarriageFixture) {
  const dailyConnection = fixture.rhythms.find(rhythm => rhythm.id === 'sample-marriage-connection');
  const completedDates = new Set((dailyConnection?.completionHistory ?? []).map(event => event.effectiveDate));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${fixture.week.startDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    const effectiveDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
    return {
      date: effectiveDate,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      state: effectiveDate === fixture.week.todayDate
        ? completedDates.has(effectiveDate) ? 'today-sample' as const : 'today' as const
        : completedDates.has(effectiveDate) ? 'sample' as const : 'quiet' as const
    };
  });
}

export function rhythmsSupportingFoundation(
  rhythmsToSelect: readonly RhythmPreview[],
  foundationId: string
): RhythmPreview[] {
  return rhythmsToSelect.filter(rhythm =>
    rhythm.primaryFoundationId === foundationId ||
    rhythm.secondaryFoundationIds?.includes(foundationId) === true
  );
}

export function orderedCompletions(
  history: readonly RhythmCompletion[] | undefined
): RhythmCompletion[] {
  return [...(history ?? [])].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate) || a.id.localeCompare(b.id)
  );
}

export function rhythmLastTendedLabel(
  rhythm: Pick<RhythmPreview, 'completionHistory' | 'status'>,
  completedToday = false
): string {
  if (completedToday) return 'Tended today';
  const latest = orderedCompletions(rhythm.completionHistory)[0];
  if (latest) {
    return `Last tended ${new Date(`${latest.effectiveDate}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })}`;
  }
  return rhythm.status === 'Due today' ? 'Due today' : 'Not yet tended';
}

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
    personIds: ['sample-person-avery'],
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
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    description: 'Take a quiet moment to pray together and begin the day connected.'
  },
  {
    id: 'sample-connect',
    title: 'Daily connection',
    cadence: 'Daily',
    timeLabel: 'Evening',
    automation: 'manual',
    status: 'Due today',
    personIds: ['sample-person-avery', 'sample-person-morgan'],
    description: 'Set aside a few minutes to share how your day went.',
    completionHistory: [
      { id: 'sample-connect-2026-10-20', effectiveDate: '2026-10-20' },
      { id: 'sample-connect-2026-10-18', effectiveDate: '2026-10-18' },
      { id: 'sample-connect-2026-10-17', effectiveDate: '2026-10-17' }
    ]
  },
  {
    id: 'sample-walk',
    title: 'Take a walk',
    cadence: '3 times a week',
    timeLabel: 'Afternoon',
    automation: 'manual',
    status: 'Due today',
    personIds: ['sample-person-avery', 'sample-person-jordan'],
    description: 'Get outside for a short walk and a little fresh air.'
  }
];

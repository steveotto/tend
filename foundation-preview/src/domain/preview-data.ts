import type {
  FoundationCapabilities,
  FoundationLifecycle,
  RhythmAutomation
} from '../../../src/domain/capabilities.ts';
import type { MoneyGoal } from './money-goals.ts';
import type {
  RhythmFrequencyRecommendation,
  RhythmSchedule,
  RhythmScoringMetadata,
  RhythmTimeValue
} from './rhythm-schedule.ts';
import { effectiveRhythmSchedule } from './rhythm-schedule.ts';
import { selectNextScheduledOccurrence } from './rhythm-occurrences.ts';

export type FoundationPreview = {
  id: string;
  category: 'Faith' | 'Marriage' | 'Parenting' | 'Finances';
  categoryId: CategoryId;
  name: string;
  description: string;
  capabilities: FoundationCapabilities;
  lifecycle: FoundationLifecycle;
  sampleOnly?: boolean;
  iconId?: string;
  illustrativeScore?: number | null;
};

export type CategoryId = 'faith' | 'marriage' | 'parenting' | 'health' | 'finances' | 'friendships';

export type FoundationTerminology = {
  singular: string;
  plural: string;
};

const foundationTerminology: FoundationTerminology = {
  singular: 'Foundation',
  plural: 'Foundations'
};

const faithPracticeTerminology: FoundationTerminology = {
  singular: 'Practice',
  plural: 'Practices'
};

export function foundationTerminologyForCategory(categoryId?: string): FoundationTerminology {
  return categoryId === 'faith' ? faithPracticeTerminology : foundationTerminology;
}

export const marriageFoundationIds = [
  'connection',
  'communication',
  'fun-adventure',
  'spiritual-growth',
  'partnership',
  'intimacy'
] as const;

export type MarriageFoundationId = (typeof marriageFoundationIds)[number];

export function isMarriageFoundationId(value: unknown): value is MarriageFoundationId {
  return typeof value === 'string' && marriageFoundationIds.some(id => id === value);
}

export type GoalPreview = MoneyGoal;

export type MarriageRhythmGroupId = 'daily' | 'weekly' | 'seasonal';
export type MarriageRhythmSuggestion = {
  templateId: string;
  rhythm: RhythmPreview;
  scheduleHint: string;
  recommendedFrequency: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
  sourceSampleRhythmId?: string;
};

export type CategoryRhythmSuggestionGroupDefinition = {
  id: string;
  title: string;
  subtitle: string;
};

export type CategoryRhythmSuggestionTemplate = {
  sourceId: string;
  groupId: string;
  title: string;
  description: string;
  cadence: string;
  scheduleHint: string;
  recommendedFrequency: RhythmFrequencyRecommendation;
  iconId: string;
  primaryFoundationId: string;
  secondaryFoundationIds: readonly string[];
  frequencyGuidance?: string;
};

export const parentingRhythmSuggestionGroups: readonly CategoryRhythmSuggestionGroupDefinition[] = [
  { id: 'daily-connection', title: 'Daily Connection', subtitle: 'Small moments of attention and conversation.' },
  { id: 'weekly-regular', title: 'Weekly & Regular', subtitle: 'Make room for steady connection and support.' },
  { id: 'seasonal-annual', title: 'Seasonal & Annual', subtitle: 'Plan for meaningful time and milestones.' }
];

export const parentingRhythmSuggestions: readonly CategoryRhythmSuggestionTemplate[] = [
  {
    sourceId: 'parenting.daily-connection',
    groupId: 'daily-connection',
    title: 'Daily Connection',
    description: 'Give your child a little undivided attention.',
    cadence: 'Daily',
    scheduleHint: 'Daily · Flexible',
    recommendedFrequency: 'daily',
    iconId: 'parenting-connection-belonging',
    primaryFoundationId: 'parenting-connection-belonging',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'parenting.walk-together',
    groupId: 'weekly-regular',
    title: 'Walk Together',
    description: 'Take a walk and make room for easy conversation.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'parenting-connection-belonging',
    primaryFoundationId: 'parenting-connection-belonging',
    secondaryFoundationIds: ['parenting-communication-trust']
  },
  {
    sourceId: 'parenting.prayer-conversation',
    groupId: 'daily-connection',
    title: 'Prayer & Conversation',
    description: 'Share a prayer and talk about what matters.',
    cadence: 'Daily',
    scheduleHint: 'Daily · Flexible',
    recommendedFrequency: 'daily',
    iconId: 'parenting-spiritual-growth',
    primaryFoundationId: 'parenting-spiritual-growth',
    secondaryFoundationIds: ['parenting-communication-trust']
  },
  {
    sourceId: 'parenting.one-on-one-time',
    groupId: 'weekly-regular',
    title: 'One-on-One Time',
    description: 'Spend intentional time together doing something they enjoy.',
    cadence: 'Every 2 weeks',
    scheduleHint: 'Every 2 weeks · Flexible',
    recommendedFrequency: 'every-two-weeks',
    iconId: 'parenting-connection-belonging',
    primaryFoundationId: 'parenting-connection-belonging',
    secondaryFoundationIds: ['parenting-fun-memories']
  },
  {
    sourceId: 'parenting.encouraging-text',
    groupId: 'weekly-regular',
    title: 'Encouraging Text',
    description: 'Send a thoughtful message that recognizes their strengths or effort.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'parenting-encouragement-affirmation',
    primaryFoundationId: 'parenting-encouragement-affirmation',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'parenting.call-catch-up',
    groupId: 'weekly-regular',
    title: 'Call & Catch Up',
    description: 'Make space to listen and hear how life is going.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'parenting-communication-trust',
    primaryFoundationId: 'parenting-communication-trust',
    secondaryFoundationIds: ['parenting-connection-belonging']
  },
  {
    sourceId: 'parenting.special-outing',
    groupId: 'seasonal-annual',
    title: 'Special Outing',
    description: 'Plan an outing and make a memory together.',
    cadence: 'Quarterly',
    scheduleHint: 'Quarterly · Flexible',
    recommendedFrequency: 'quarterly',
    iconId: 'parenting-fun-memories',
    primaryFoundationId: 'parenting-fun-memories',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'parenting.teach-life-skill',
    groupId: 'seasonal-annual',
    title: 'Teach a Life Skill',
    description: 'Practice a useful skill together and share what you know.',
    cadence: 'Quarterly',
    scheduleHint: 'Quarterly · Flexible',
    recommendedFrequency: 'quarterly',
    iconId: 'parenting-guidance-equipping',
    primaryFoundationId: 'parenting-guidance-equipping',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'parenting.life-stage-check-in',
    groupId: 'weekly-regular',
    title: 'Life-Stage Check-In',
    description: 'Listen and offer support through a change or new responsibility.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible recommendation',
    recommendedFrequency: 'weekly',
    frequencyGuidance: 'Weekly is a starting recommendation. Choose the day that works for you.',
    iconId: 'parenting-guidance-equipping',
    primaryFoundationId: 'parenting-guidance-equipping',
    secondaryFoundationIds: ['parenting-communication-trust']
  },
  {
    sourceId: 'parenting.trip-together',
    groupId: 'seasonal-annual',
    title: 'Trip Together',
    description: 'Set aside a day or overnight for time away together.',
    cadence: 'Yearly',
    scheduleHint: 'Yearly · Flexible',
    recommendedFrequency: 'yearly',
    iconId: 'parenting-fun-memories',
    primaryFoundationId: 'parenting-fun-memories',
    secondaryFoundationIds: ['parenting-connection-belonging']
  }
];

export const faithRhythmSuggestionGroups: readonly CategoryRhythmSuggestionGroupDefinition[] = [
  { id: 'daily-regular', title: 'Daily & Regular', subtitle: 'Make room for daily practices and regular reflection.' },
  { id: 'weekly', title: 'Weekly', subtitle: 'Set aside time for worship, fasting and service.' },
  { id: 'monthly', title: 'Monthly', subtitle: 'Choose a recurring time for generous and faithful witness.' }
];

export const faithRhythmSuggestions: readonly CategoryRhythmSuggestionTemplate[] = [
  {
    sourceId: 'faith.sabbath',
    groupId: 'weekly',
    title: 'Sabbath',
    description: 'A full day of rest, delight, and presence with God and others.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'faith-sabbath',
    primaryFoundationId: 'faith-sabbath',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.pray-together',
    groupId: 'daily-regular',
    title: 'Pray Together',
    description: 'Share gratitude and prayer requests.',
    cadence: 'Daily',
    scheduleHint: 'Daily · Flexible',
    recommendedFrequency: 'daily',
    iconId: 'faith-prayer',
    primaryFoundationId: 'faith-prayer',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.fasting',
    groupId: 'weekly',
    title: 'Fasting',
    description: 'Voluntarily abstain from food to create space for God.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'faith-fasting',
    primaryFoundationId: 'faith-fasting',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.solitude-silence',
    groupId: 'daily-regular',
    title: 'Solitude & Silence',
    description: 'Withdraw from noise and distractions to be alone with God.',
    cadence: 'Select Days',
    scheduleHint: 'Select Days · Flexible',
    recommendedFrequency: 'select-days',
    iconId: 'faith-solitude',
    primaryFoundationId: 'faith-solitude',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.generosity-practice',
    groupId: 'monthly',
    title: 'Generosity Practice',
    description: 'Give money, time, or resources as an act of worship.',
    cadence: 'Monthly',
    scheduleHint: 'Monthly · Flexible',
    recommendedFrequency: 'monthly',
    iconId: 'faith-generosity',
    primaryFoundationId: 'faith-generosity',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.community-gathering',
    groupId: 'weekly',
    title: 'Community Gathering',
    description: 'Gather for worship, teaching, and life together.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'faith-community',
    primaryFoundationId: 'faith-community',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.serve-someone',
    groupId: 'weekly',
    title: 'Serve Someone',
    description: 'Use your gifts and time to serve others in love.',
    cadence: 'Weekly',
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly',
    iconId: 'faith-service',
    primaryFoundationId: 'faith-service',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.share-your-story',
    groupId: 'monthly',
    title: 'Share Your Story',
    description: 'Share your faith through words and actions.',
    cadence: 'Monthly',
    scheduleHint: 'Monthly · Flexible',
    recommendedFrequency: 'monthly',
    iconId: 'faith-witness',
    primaryFoundationId: 'faith-witness',
    secondaryFoundationIds: []
  },
  {
    sourceId: 'faith.bible-reading',
    groupId: 'daily-regular',
    title: 'Bible Reading',
    description: 'Read and reflect on Scripture, optionally following a reading plan.',
    cadence: 'Daily',
    scheduleHint: 'Daily · Flexible',
    recommendedFrequency: 'daily',
    iconId: 'faith-scripture',
    primaryFoundationId: 'faith-scripture',
    secondaryFoundationIds: []
  }
];

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
  primaryFoundationId?: string | null;
  secondaryFoundationIds?: readonly string[];
  suggestionSourceId?: string;
  completionHistory?: readonly RhythmCompletion[] | undefined;
  marriageGroup?: MarriageRhythmGroupId;
  iconId?: string;
  illustrativeScore?: number | null | undefined;
  personIds?: readonly PersonId[];
  categoryIds?: readonly CategoryId[];
  schedule?: RhythmSchedule;
  scoring?: RhythmScoringMetadata;
  createdLocalDate?: string;
  createdTimeZone?: string;
  dailyBackfillAllowed?: boolean;
  timeOfDay?: RhythmTimeValue;
  personal?: boolean;
  healthLogCapability?: 'weight' | 'cardio';
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
  categoryId: 'marriage',
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
    categoryId: 'marriage',
    name: 'Connection',
    description: 'Feeling known, loved, and emotionally close.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'connection'
  },
  {
    id: 'communication',
    category: 'Marriage',
    categoryId: 'marriage',
    name: 'Communication',
    description: 'Listening, understanding, and navigating life together.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'communication'
  },
  {
    id: 'fun-adventure',
    category: 'Marriage',
    categoryId: 'marriage',
    name: 'Fun & Adventure',
    description: 'Enjoying life together, laughter, and shared experiences.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'fun-adventure'
  },
  {
    id: 'spiritual-growth',
    category: 'Marriage',
    categoryId: 'marriage',
    name: 'Spiritual Growth',
    description: 'Shared faith, prayer, and spiritual growth.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'spiritual-growth'
  },
  {
    id: 'partnership',
    category: 'Marriage',
    categoryId: 'marriage',
    name: 'Partnership',
    description: 'Teamwork, support, and shared responsibilities.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'partnership'
  },
  {
    id: 'intimacy',
    category: 'Marriage',
    categoryId: 'marriage',
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

export const parentingFoundations: readonly FoundationPreview[] = [
  {
    id: 'parenting-connection-belonging',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Connection & Belonging',
    description: 'Helping your child feel loved, included and connected.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-connection-belonging'
  },
  {
    id: 'parenting-communication-trust',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Communication & Trust',
    description: 'Listening well and making room for honest conversation.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-communication-trust'
  },
  {
    id: 'parenting-fun-memories',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Fun & Memories',
    description: 'Enjoying time together and making meaningful memories.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-fun-memories'
  },
  {
    id: 'parenting-spiritual-growth',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Spiritual Growth',
    description: 'Sharing prayer, Scripture and conversations about faith.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-spiritual-growth'
  },
  {
    id: 'parenting-guidance-equipping',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Guidance & Equipping',
    description: 'Offering practical skills, support and wisdom for life.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-guidance-equipping'
  },
  {
    id: 'parenting-encouragement-affirmation',
    category: 'Parenting',
    categoryId: 'parenting',
    name: 'Encouragement & Affirmation',
    description: 'Recognizing your child’s strengths, effort and growth.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'parenting-encouragement-affirmation'
  }
];

export const faithPractices: readonly FoundationPreview[] = [
  {
    id: 'faith-sabbath',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Sabbath',
    description: 'Make room for rest, delight and time with God.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-sabbath'
  },
  {
    id: 'faith-prayer',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Prayer',
    description: 'Build a steady rhythm of prayer and listening.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-prayer'
  },
  {
    id: 'faith-fasting',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Fasting',
    description: 'Create space for God through intentional fasting.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-fasting'
  },
  {
    id: 'faith-solitude',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Solitude',
    description: 'Make room for quiet, reflection and listening.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-solitude'
  },
  {
    id: 'faith-generosity',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Generosity',
    description: 'Practice open-handed living with what you have.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-generosity'
  },
  {
    id: 'faith-community',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Community',
    description: 'Share worship, belonging and life with others.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-community'
  },
  {
    id: 'faith-service',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Service',
    description: 'Turn care for others into regular acts of service.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-service'
  },
  {
    id: 'faith-witness',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Witness',
    description: 'Live and share your faith with the people around you.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-witness'
  },
  {
    id: 'faith-scripture',
    category: 'Faith',
    categoryId: 'faith',
    name: 'Scripture',
    description: 'Read and reflect on Scripture regularly.',
    capabilities: ongoingMarriageCapabilities,
    lifecycle: 'active',
    iconId: 'faith-scripture'
  }
];

const populatedMarriageRhythms = ([
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
] satisfies RhythmPreview[]).map<RhythmPreview>(rhythm => ({
  ...rhythm,
  categoryIds: ['marriage']
}));

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

const marriageSuggestionTemplateRows: {
  templateId: string;
  sourceSampleRhythmId?: string;
  title: string;
  description: string;
  cadence: string;
  timeLabel: string;
  marriageGroup: MarriageRhythmGroupId;
  iconId: string;
  primaryFoundationId: string;
  secondaryFoundationIds: string[];
  scheduleHint: string;
  recommendedFrequency: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
}[] = [
  {
    templateId: 'marriage.daily-connection',
    sourceSampleRhythmId: 'sample-marriage-connection',
    title: 'Daily Connection',
    description: 'Make a little room each day to connect in a way that fits your life.',
    cadence: '5 times a week',
    timeLabel: 'Anytime',
    marriageGroup: 'daily',
    iconId: 'daily-connection',
    primaryFoundationId: 'connection',
    secondaryFoundationIds: ['communication', 'intimacy'],
    scheduleHint: '5 times a week · Flexible',
    recommendedFrequency: 'select-days',
    frequencyGuidance: 'Choose the days you want; no weekdays are selected.'
  },
  {
    templateId: 'marriage.pray-together',
    sourceSampleRhythmId: 'sample-marriage-prayer',
    title: 'Pray Together',
    description: 'Bring gratitude and needs before God together.',
    cadence: 'Daily',
    timeLabel: 'Evening',
    marriageGroup: 'daily',
    iconId: 'pray-together',
    primaryFoundationId: 'spiritual-growth',
    secondaryFoundationIds: ['connection'],
    scheduleHint: 'Daily · Evening',
    recommendedFrequency: 'daily'
  },
  {
    templateId: 'marriage.date-night',
    sourceSampleRhythmId: 'sample-marriage-date-night',
    title: 'Date Night',
    description: 'Enjoy intentional time together beyond responsibilities and logistics.',
    cadence: 'Weekly',
    timeLabel: 'Evening',
    marriageGroup: 'weekly',
    iconId: 'date-night',
    primaryFoundationId: 'fun-adventure',
    secondaryFoundationIds: ['connection'],
    scheduleHint: 'Weekly · Evening',
    recommendedFrequency: 'weekly'
  },
  {
    templateId: 'marriage.marriage-check-in',
    title: 'Marriage Check-In',
    description: 'Share appreciation, listen to concerns, and choose one supportive next step.',
    cadence: 'Weekly',
    timeLabel: 'Anytime',
    marriageGroup: 'weekly',
    iconId: 'marriage-check-in',
    primaryFoundationId: 'communication',
    secondaryFoundationIds: ['partnership'],
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly'
  },
  {
    templateId: 'marriage.thoughtful-act-of-love',
    title: 'Thoughtful Act of Love',
    description: 'Choose a thoughtful action that helps your partner feel cared for.',
    cadence: 'Weekly',
    timeLabel: 'Anytime',
    marriageGroup: 'weekly',
    iconId: 'thoughtful-act-of-love',
    primaryFoundationId: 'partnership',
    secondaryFoundationIds: ['connection'],
    scheduleHint: 'Weekly · Flexible',
    recommendedFrequency: 'weekly'
  },
  {
    templateId: 'marriage.dream-together',
    sourceSampleRhythmId: 'sample-marriage-dream',
    title: 'Dream Together',
    description: 'Talk about hopes, plans, and the next season of life.',
    cadence: 'Quarterly',
    timeLabel: 'Anytime',
    marriageGroup: 'seasonal',
    iconId: 'dream-together',
    primaryFoundationId: 'partnership',
    secondaryFoundationIds: ['fun-adventure'],
    scheduleHint: 'Quarterly · Flexible',
    recommendedFrequency: 'quarterly'
  },
  {
    templateId: 'marriage.overnight-away',
    title: 'Overnight Away',
    description: 'Protect time away from the normal routine to reconnect.',
    cadence: 'Quarterly',
    timeLabel: 'Anytime',
    marriageGroup: 'seasonal',
    iconId: 'overnight-away',
    primaryFoundationId: 'fun-adventure',
    secondaryFoundationIds: ['intimacy'],
    scheduleHint: 'Quarterly · Flexible',
    recommendedFrequency: 'quarterly'
  },
  {
    templateId: 'marriage.marriage-enrichment',
    title: 'Marriage Enrichment',
    description: 'Make time to learn, reflect, and grow together.',
    cadence: 'Yearly',
    timeLabel: 'Anytime',
    marriageGroup: 'seasonal',
    iconId: 'marriage-enrichment',
    primaryFoundationId: 'communication',
    secondaryFoundationIds: ['partnership'],
    scheduleHint: 'Yearly · Flexible',
    recommendedFrequency: 'yearly'
  },
  {
    templateId: 'marriage.week-away-together',
    title: 'Week Away Together',
    description: 'Protect extended time together for rest, enjoyment, and connection.',
    cadence: 'Yearly',
    timeLabel: 'Anytime',
    marriageGroup: 'seasonal',
    iconId: 'week-away-together',
    primaryFoundationId: 'fun-adventure',
    secondaryFoundationIds: ['connection'],
    scheduleHint: 'Yearly · Flexible',
    recommendedFrequency: 'yearly'
  }
];

export const marriageRhythmSuggestions: readonly MarriageRhythmSuggestion[] =
  marriageSuggestionTemplateRows.map(template => {
    const source = template.sourceSampleRhythmId
      ? marriageRhythms.find(rhythm => rhythm.id === template.sourceSampleRhythmId)
      : undefined;
    return {
      templateId: template.templateId,
      scheduleHint: template.scheduleHint,
      recommendedFrequency: template.recommendedFrequency,
      ...(template.frequencyGuidance ? { frequencyGuidance: template.frequencyGuidance } : {}),
      ...(template.sourceSampleRhythmId ? { sourceSampleRhythmId: template.sourceSampleRhythmId } : {}),
      rhythm: {
        ...(source ?? {
          id: template.templateId,
          title: template.title,
          cadence: template.cadence,
          timeLabel: template.timeLabel,
          automation: 'manual' as const,
          status: 'Not confirmed' as const,
          description: template.description,
          iconId: template.iconId,
          personIds: ['sample-person-avery', 'sample-person-morgan'] as PersonId[],
          primaryFoundationId: template.primaryFoundationId,
          secondaryFoundationIds: template.secondaryFoundationIds
        }),
        id: template.templateId,
        title: template.title,
        cadence: template.cadence,
        timeLabel: template.timeLabel,
        description: template.description,
        iconId: template.iconId,
        marriageGroup: template.marriageGroup,
        personIds: ['sample-person-avery', 'sample-person-morgan'],
        primaryFoundationId: template.primaryFoundationId,
        secondaryFoundationIds: template.secondaryFoundationIds
      }
    };
  });

export const marriageRhythmGroups: {
  id: MarriageRhythmGroupId;
  title: string;
  subtitle: string;
}[] = [
  { id: 'daily', title: 'Daily Connection', subtitle: 'The little things that matter most.' },
  { id: 'weekly', title: 'Weekly Investment', subtitle: 'Protect time for your relationship.' },
  { id: 'seasonal', title: 'Seasonal & Annual', subtitle: 'Make room for deeper connection.' }
];

export function marriageFoundationCoverage(
  fixture: MarriageFixture,
  foundationId: string,
  rhythms: readonly RhythmPreview[] = fixture.rhythms
) {
  const associated = rhythmsSupportingFoundation(rhythms, foundationId);
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
  rhythm: Pick<RhythmPreview, 'completionHistory' | 'cadence' | 'schedule' | 'scoring' | 'createdLocalDate'>,
  completedToday = false,
  asOfDate?: string
): string {
  if (completedToday) return 'Tended today';
  const latest = orderedCompletions(rhythm.completionHistory?.filter(record =>
    asOfDate === undefined || record.effectiveDate <= asOfDate
  ))[0];
  if (latest) {
    return `Last tended ${new Date(`${latest.effectiveDate}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })}`;
  }
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (!schedule || !asOfDate) return rhythm.scoring ? 'Schedule unavailable' : 'Not yet tended';
  const next = selectNextScheduledOccurrence({
    schedule,
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    ...(rhythm.createdLocalDate ? { trackingStartDate: rhythm.createdLocalDate } : {}),
    asOfDate
  });
  if (next.kind === 'unavailable') return 'Schedule unavailable';
  if (next.kind === 'none') return 'No upcoming date';
  if (next.date === asOfDate) return 'Due today';
  const date = new Date(`${next.date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
  return `Next due ${date}`;
}

export const financeFoundation: FoundationPreview = {
  id: 'finance-example-milestone',
  category: 'Finances',
  categoryId: 'finances',
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

export const foundationCatalogue: readonly FoundationPreview[] = [
  ...marriageFoundations,
  ...parentingFoundations,
  ...faithPractices,
  financeFoundation
];

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

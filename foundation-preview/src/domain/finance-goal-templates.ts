import type { GoalDraft } from './money-goals.ts';

export type FinanceGoalTemplate = {
  id: string;
  title: string;
  description: string;
  draft: Partial<GoalDraft>;
};

export type FinanceGoalTemplateGroup = {
  id: string;
  title: string;
  sourceLabel: string;
  sourceUrl: string;
  templates: readonly FinanceGoalTemplate[];
};

export const financeGoalTemplateGroups: readonly FinanceGoalTemplateGroup[] = [
  {
    id: 'ramsey-baby-steps',
    title: 'Selected optional ideas inspired by Dave Ramsey’s Baby Steps',
    sourceLabel: 'Ramsey Solutions · The 7 Baby Steps',
    sourceUrl: 'https://www.ramseysolutions.com/dave-ramsey-7-baby-steps',
    templates: [
      {
        id: 'starter-emergency-fund',
        title: 'Starter emergency fund',
        description: 'Set a $1,000 target for a starter emergency savings balance.',
        draft: { title: 'Starter emergency fund', currency: 'USD', direction: 'increase', targetBalance: '1000.00' }
      },
      {
        id: 'debt-snowball',
        title: 'Debt snowball',
        description: 'Track reducing non-mortgage debt; enter the balance you are tracking.',
        draft: { title: 'Debt snowball', direction: 'decrease', targetBalance: '0.00' }
      },
      {
        id: 'emergency-reserve',
        title: 'Emergency reserve',
        description: 'Choose a savings target based on 3–6 months of your expenses.',
        draft: { title: 'Emergency reserve', direction: 'increase' }
      },
      {
        id: 'education-savings',
        title: 'Education savings',
        description: 'Choose a personal target for an education savings balance.',
        draft: { title: 'Education savings', direction: 'increase' }
      },
      {
        id: 'pay-off-home',
        title: 'Pay off the home',
        description: 'Track a mortgage balance toward a payoff target.',
        draft: { title: 'Pay off the home', direction: 'decrease', targetBalance: '0.00' }
      },
      {
        id: 'build-wealth',
        title: 'Build wealth',
        description: 'Choose a specific savings balance to track. Giving flows are not recorded here.',
        draft: { title: 'Build wealth', direction: 'increase' }
      }
    ]
  },
  {
    id: 'ramit-rich-life',
    title: 'Optional ideas inspired by Ramit Sethi’s Rich Life approach',
    sourceLabel: 'I Will Teach You To Be Rich · Rich Life',
    sourceUrl: 'https://www.iwillteachyoutoberich.com/rich-life/',
    templates: [
      {
        id: 'rich-life-savings',
        title: 'Save for your Rich Life',
        description: 'Choose a savings balance goal for a personally meaningful priority.',
        draft: { title: 'Save for your Rich Life', direction: 'increase' }
      },
      {
        id: 'savings-cushion',
        title: 'Build a savings cushion',
        description: 'Choose a target for an additional savings balance.',
        draft: { title: 'Build a savings cushion', direction: 'increase' }
      }
    ]
  }
];

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonProfileView } from '../src/components/PersonProfileView.tsx';
import { CategoryAvailabilityProvider } from '../src/components/CategoryAvailabilityContext.tsx';
import { defaultCategoryPreferences, defaultFoundationPreferences } from '../src/domain/category-availability.ts';
import { addOrUpdateConnection, createFriendshipData, setFriendCadence } from '../src/domain/friendships.ts';
import type { FriendshipConnection, FriendshipData } from '../src/domain/friendships.ts';
import {
  createPersonNote,
  deletePersonNote,
  updatePersonNote
} from '../src/domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../src/domain/person-notes.ts';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonSpark, PersonSparkDraft } from '../src/domain/person-sparks.ts';
import type { PersonDetails } from '../src/domain/person-details.ts';
import {
  createPersonPickerGroups,
  foundationCatalogue,
  syntheticPeople,
  setPersonGroupMembership
} from '../src/domain/preview-data.ts';
import type { PersonPreview, RhythmPreview } from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';
import type { RhythmScoreResult } from '../src/domain/rhythm-scoring.ts';
import { localDateString } from '../src/domain/money-goals.ts';

afterEach(cleanup);

const linkedRhythm: RhythmPreview = {
  id: 'user-rhythm-33333333-3333-4333-8333-333333333333',
  title: 'Avery and Morgan walk',
  description: 'Take a walk and talk.',
  automation: 'manual',
  status: 'Not confirmed',
  cadence: 'Weekly',
  timeLabel: 'Afternoon',
  personIds: ['sample-person-avery', 'sample-person-morgan'],
  categoryIds: [],
  primaryFoundationId: null,
  secondaryFoundationIds: []
};

const otherRhythm: RhythmPreview = {
  ...linkedRhythm,
  id: 'user-rhythm-44444444-4444-4444-8444-444444444444',
  title: 'Jordan walk',
  personIds: ['sample-person-jordan']
};

const score: RhythmScoreResult = {
  kind: 'rhythm-score',
  asOfDate: '2026-10-29',
  timeZone: 'UTC',
  trackingStartDate: null,
  consistency: {
    kind: 'unscored',
    reasonCode: 'ready-for-first-tend',
    explanation: 'No eligible occurrences yet.'
  },
  onTrack: {
    kind: 'unscored',
    reasonCode: 'ready-for-first-tend',
    explanation: 'No eligible occurrences yet.'
  },
  healthScore: 0
};

function scoredProfileRhythmScore(consistency: number, onTrack: number): RhythmScoreResult {
  return {
    kind: 'rhythm-score',
    asOfDate: '2026-10-29',
    timeZone: 'UTC',
    trackingStartDate: '2026-10-01',
    consistency: {
      kind: 'scored',
      score: consistency,
      exactPercent: consistency,
      evidence: {
        frequency: 'daily',
        windowStartDate: '2026-10-01',
        windowEndDate: '2026-10-29',
        eligibleDueCount: 1,
        completedCount: 1,
        notCompletedCount: 0,
        limitedHistoryDays: null,
        todayIncluded: true,
        occurrences: []
      }
    },
    onTrack: {
      kind: 'scored',
      score: onTrack,
      evidence: {
        lastQualifyingCompletionDate: '2026-10-29',
        missedOccurrenceCount: 0,
        pointsPerMissedOccurrence: 10,
        deduction: 0,
        occurrences: [],
        repeatedZeroScoreSpans: [],
        scheduleChanges: []
      }
    },
    healthScore: consistency * 0.75 + onTrack * 0.25
  };
}

function ProfileHarness({
  personId = 'sample-person-avery',
  category = 'friends',
  prayerEnabled = true,
  initialDetails = [],
  initialNotes = [],
  failNoteUpdates = false,
  canEditNotes = true,
  people = syntheticPeople,
  rhythms = [linkedRhythm, otherRhythm],
  archivedRhythms = [],
  prayerRequests = [],
  personSparks = [],
  rhythmScores = new Map([[linkedRhythm.id, score]]),
  initialFriendships = createFriendshipData(),
  completed = false,
  onAddRhythm = vi.fn(),
  onEditRhythm = vi.fn(),
  onRhythmHistory = vi.fn(),
  onTend = vi.fn(),
  onUndo = vi.fn(),
  onRestoreRhythm = vi.fn(),
  onClose = vi.fn(),
  onEditPerson = vi.fn(),
  onCreatePersonSpark = vi.fn(),
  onUpdatePersonSpark = vi.fn(),
  onArchivePersonSpark = vi.fn(),
  onUndoPersonSpark = vi.fn(),
  onCompletePersonSpark = vi.fn()
}: {
  personId?: PersonId;
  category?: 'marriage' | 'parenting' | 'friends' | null;
  prayerEnabled?: boolean;
  initialDetails?: readonly PersonDetails[];
  initialNotes?: readonly PersonNote[];
  failNoteUpdates?: boolean;
  canEditNotes?: boolean;
  people?: readonly PersonPreview[];
  rhythms?: readonly RhythmPreview[];
  archivedRhythms?: readonly RhythmPreview[];
  prayerRequests?: readonly PersonPrayerRequest[];
  personSparks?: readonly PersonSpark[];
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
  initialFriendships?: FriendshipData;
  completed?: boolean;
  onAddRhythm?: (event: ReactMouseEvent<HTMLButtonElement>, personId: PersonId) => void;
  onEditRhythm?: (rhythm: RhythmPreview, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onTend?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onUndo?: (id: string) => void;
  onRestoreRhythm?: (id: string) => void;
  onClose?: () => void;
  onEditPerson?: (personId: PersonId, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onCreatePersonSpark?: (ownerId: PersonId, draft: PersonSparkDraft) => string | null;
  onUpdatePersonSpark?: (sparkId: string, draft: PersonSparkDraft) => string | null;
  onArchivePersonSpark?: (sparkId: string, archived: boolean) => string | null;
  onUndoPersonSpark?: (sparkId: string) => string | null;
  onCompletePersonSpark?: (sparkId: string, connection: FriendshipConnection) => string | null;
}) {
  const [friendships, setFriendships] = useState<FriendshipData>(initialFriendships);
  const [personNotes, setPersonNotes] = useState<PersonNote[]>([...initialNotes]);
  const emptyForPerson = createPersonPickerGroups().map(group => ({
    ...group,
    memberIds: group.memberIds.filter(id => id !== personId)
  }));
  const groups = category
    ? setPersonGroupMembership(emptyForPerson, category, personId, true)
    : emptyForPerson;
  return (
    <CategoryAvailabilityProvider
      preferences={defaultCategoryPreferences}
      foundationPreferences={defaultFoundationPreferences}
      prayerEnabled={prayerEnabled}
    >
      <>
      <PersonProfileView
        personId={personId}
        people={people}
        peopleGroups={groups}
        friendships={friendships}
        today="2026-10-29"
        rhythms={rhythms}
        archivedRhythms={archivedRhythms}
        foundations={foundationCatalogue}
        rhythmScores={rhythmScores}
        completedRhythms={completed ? new Set([linkedRhythm.id]) : new Set()}
        undoableRhythms={completed ? new Set([linkedRhythm.id]) : new Set()}
        onEditPerson={onEditPerson}
        personDetails={initialDetails}
        personNotes={personNotes}
        prayerRequests={prayerRequests}
        personSparks={personSparks}
        onCreatePersonSpark={onCreatePersonSpark}
        onUpdatePersonSpark={onUpdatePersonSpark}
        onArchivePersonSpark={onArchivePersonSpark}
        onUndoPersonSparkCompletion={onUndoPersonSpark}
        onCompletePersonSpark={onCompletePersonSpark}
        onCreatePersonNote={(ownerId: PersonId, draft: PersonNoteDraft) => {
          const now = '2026-10-31T12:00:00.000Z';
          const result = createPersonNote(personNotes, {
            id: `test-person-note-${personNotes.length + 1}`,
            personId: ownerId,
            sharedWith: draft.sharedWith,
            content: draft.content,
            createdAt: now,
            updatedAt: now
          });
          if (!result.valid) return result.error;
          setPersonNotes(result.notes);
          return null;
        }}
        {...(canEditNotes
          ? {
              onUpdatePersonNote: (id: string, expectedUpdatedAt: string, actorId: PersonId, draft: PersonNoteDraft) => {
                if (failNoteUpdates) return 'Preview storage changed in another tab. No person note was saved.';
                const result = updatePersonNote(
                  personNotes, id, expectedUpdatedAt, actorId, draft, '2026-10-31T14:00:00.000Z'
                );
                if (!result.valid) return result.error;
                setPersonNotes(result.notes);
                return null;
              }
            }
          : {})}
        onDeletePersonNote={(id, expectedUpdatedAt, actorId) => {
          const result = deletePersonNote(personNotes, id, expectedUpdatedAt, actorId);
          if (!result.valid) return result.error;
          setPersonNotes(result.notes);
          return null;
        }}
        onAddRhythm={onAddRhythm}
        onEditRhythm={onEditRhythm}
        onRhythmHistory={onRhythmHistory}
        onTend={onTend}
        onUndo={onUndo}
        onRestoreRhythm={onRestoreRhythm}
        onOpenFoundation={vi.fn()}
        onOpenCategory={vi.fn()}
        onPersonSelect={vi.fn()}
        onConnectionChange={setFriendships}
        onClose={onClose}
      />
      <output data-testid="saved-connections">
        {JSON.stringify(friendships)}
      </output>
      <output data-testid="saved-person-notes">{JSON.stringify(personNotes)}</output>
      </>
    </CategoryAvailabilityProvider>
  );
}

describe('shared person profile', () => {
  it('keeps the profile content as a page section outside the legacy card selector', () => {
    render(<ProfileHarness rhythms={[]} />);
    const page = screen.getByRole('main', { name: 'Avery Brooks' });
    const content = within(page).getByRole('region', { name: 'Avery Brooks' });

    expect(content.parentElement).toBe(page);
    expect(content.classList.contains('person-profile')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows only Rhythms associated with the stable Person ID and composes the shared card actions', async () => {
    const user = userEvent.setup();
    const addRhythm = vi.fn();
    const editRhythm = vi.fn();
    const rhythmHistory = vi.fn();
    const tend = vi.fn();
    render(
      <ProfileHarness
        onAddRhythm={addRhythm}
        onEditRhythm={editRhythm}
        onRhythmHistory={rhythmHistory}
        onTend={tend}
      />
    );

    expect(screen.getByRole('main', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rhythms' })).toBeTruthy();
    expect(screen.getByText('0 in queue')).toBeTruthy();
    const rhythmHeader = screen.getByRole('heading', { name: 'Rhythms' })
      .closest('.person-profile-tab-header');
    expect(rhythmHeader?.querySelector('p')?.textContent).toBe('0 in queue');
    expect(within(rhythmHeader as HTMLElement).getByRole('button', { name: 'Add rhythm' })).toBeTruthy();
    expect(screen.getByText('Friends')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Avery and Morgan walk' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Jordan walk' })).toBeNull();
    expect(screen.getByText('Take a walk and talk.')).toBeTruthy();

    const addButton = screen.getByRole('button', { name: 'Add rhythm' });
    await user.click(addButton);
    expect(addRhythm).toHaveBeenCalledWith(expect.anything(), 'sample-person-avery');
    const card = screen.getByRole('article', { name: 'Avery and Morgan walk' });
    await user.click(within(card).getByRole('button', { name: 'Tend Avery and Morgan walk' }));
    await user.click(within(card).getByRole('button', { name: /View scores and history for Avery and Morgan walk/ }));
    expect(tend).toHaveBeenCalledOnce();
    expect(within(card).queryByRole('button', { name: 'Edit Avery and Morgan walk' })).toBeNull();
    expect(editRhythm).not.toHaveBeenCalled();
    expect(rhythmHistory).toHaveBeenCalledOnce();
  });

  it('opens Person settings directly without an intermediate menu and preserves profile tabs', async () => {
    const user = userEvent.setup();
    const onEditPerson = vi.fn();
    render(<ProfileHarness onEditPerson={onEditPerson} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const settingsButton = within(profile).getByRole('button', { name: 'Person settings' });
    const identity = profile.querySelector<HTMLElement>('.person-profile__identity')!;
    expect(settingsButton.parentElement).toBe(identity);
    expect(screen.getByText('Friends')).toBeTruthy();
    expect(settingsButton.getAttribute('aria-label')).toBe('Person settings');
    expect(settingsButton.getAttribute('aria-haspopup')).toBe('dialog');
    const settingsIcon = settingsButton.querySelector('svg');
    expect(settingsButton.querySelectorAll('svg')).toHaveLength(1);
    expect(settingsIcon?.getAttribute('aria-hidden')).toBe('true');
    expect(settingsIcon?.getAttribute('focusable')).toBe('false');
    expect(settingsIcon?.querySelectorAll('path')).toHaveLength(1);
    expect(settingsIcon?.querySelectorAll('circle')).toHaveLength(1);
    expect(within(identity).getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    settingsButton.focus();
    expect(document.activeElement).toBe(settingsButton);
    await user.keyboard('{Enter}');
    expect(onEditPerson).toHaveBeenCalledWith('sample-person-avery', expect.anything());
    expect(within(profile).queryByRole('button', { name: 'Edit details' })).toBeNull();
    expect(within(profile).queryByLabelText('More actions for Avery Brooks')).toBeNull();
    expect(within(profile).getByRole('tab', { name: 'Rhythms' })).toBeTruthy();
    expect(within(profile).getByRole('tab', { name: 'Connections' })).toBeTruthy();
    expect(within(profile).getByRole('tab', { name: 'Prayer' })).toBeTruthy();
  });

  it('shows a saved photo in the header without losing the right-aligned settings action', () => {
    render(
      <ProfileHarness
        initialDetails={[{
          personId: 'sample-person-avery',
          relationshipLabel: 'Spouse',
          photoDataUrl: 'data:image/jpeg;base64,SGVsbG8='
        }]}
        category="marriage"
      />
    );
    const identity = screen.getByRole('main', { name: 'Avery Brooks' })
      .querySelector<HTMLElement>('.person-profile__identity')!;
    expect(identity.querySelector('.person-badge-avatar img')?.getAttribute('src'))
      .toBe('data:image/jpeg;base64,SGVsbG8=');
    expect(within(identity).getByText('Spouse')).toBeTruthy();
    expect(within(identity).getByRole('button', { name: 'Person settings' })).toBeTruthy();
    expect(screen.getByLabelText('Avery Brooks personal details').textContent).toContain('Marriage');
  });

  it('shows relationship, category, connection, age, and birthday countdown in the summary', () => {
    const connection = {
      id: 'recent-connection',
      type: 'call' as const,
      date: '2026-10-28',
      participantIds: ['sample-person-avery' as PersonId]
    };
    const friendships = setFriendCadence(
      addOrUpdateConnection(createFriendshipData(), connection),
      'sample-person-avery',
      'weekly',
      '2026-10-21'
    );
    render(
      <ProfileHarness
        category="marriage"
        initialFriendships={friendships}
        initialDetails={[{
          personId: 'sample-person-avery',
          relationshipLabel: 'Spouse',
          connectionStyle: 'qt',
          birthday: { monthDay: '12-02', year: 1990 },
          anniversary: { monthDay: '06-12', year: 2018 }
        }]}
        rhythms={[]}
      />
    );
    expect(screen.getByText('Marriage')).toBeTruthy();
    expect(screen.getByText('Spouse')).toBeTruthy();
    expect(screen.getByLabelText('Age 35')).toBeTruthy();
    expect(screen.getByLabelText('Birthday: Dec 2, in 34d')).toBeTruthy();
    expect(screen.getByLabelText('Last connected: Yesterday')).toBeTruthy();
    expect(screen.queryByLabelText('Love language: Quality Time')).toBeNull();
    expect(screen.queryByLabelText('Anniversary: Jun 12')).toBeNull();
    expect(screen.queryByLabelText('Connection cadence: Weekly')).toBeNull();
    const overallHealth = screen.getByRole('region', { name: 'Overall Health summary' });
    const overallHeader = overallHealth.querySelector('.health-score-breakdown__header');
    expect(Array.from(overallHeader!.children).map(child => child.tagName)).toEqual(['DIV', 'SPAN', 'BUTTON']);
    expect(overallHeader?.querySelector('h3')?.textContent).toBe('Health');
    expect(within(overallHealth).getByRole('meter', { name: 'Overall Health score' })
      .getAttribute('aria-valuetext')).toBe('100 out of 100');
    expect(overallHealth.classList.contains('health-score-breakdown')).toBe(true);
    expect(overallHealth.classList.contains('health-score-summary')).toBe(false);
    expect(screen.getAllByText('—').length).toBeGreaterThan(1);
    expect(screen.getByRole('tab', { name: 'Prayer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notes (0)' })).toBeTruthy();
  });

  it('omits unknown birth-year age and empty summary metadata', () => {
    render(
      <ProfileHarness
        category={null}
        initialDetails={[{
          personId: 'sample-person-avery',
          birthday: { monthDay: '12-02' }
        }]}
        rhythms={[]}
      />
    );

    expect(screen.queryByRole('img', { name: /relationship group/i })).toBeNull();
    expect(screen.queryByLabelText(/Age \d+/)).toBeNull();
    expect(screen.getByLabelText(/Birthday: Dec 2,/)).toBeTruthy();
  });

  it('removes Prayer from the profile and Overall Health while preserving an open request draft', async () => {
    const user = userEvent.setup();
    const view = render(<ProfileHarness />);
    const overall = screen.getByRole('region', { name: 'Overall Health summary' });
    const componentScoresToggle = within(overall).getByRole('button', {
      name: 'Show Overall Health component scores breakdown'
    });
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(componentScoresToggle.getAttribute('aria-controls')!)?.hasAttribute('hidden')).toBe(true);
    await user.click(componentScoresToggle);
    expect(within(overall).getByRole('group', { name: 'Health by area' }).getAttribute('data-count')).toBe('3');

    await user.click(screen.getByRole('tab', { name: 'Prayer' }));
    await user.click(screen.getByRole('button', { name: 'Add request' }));
    const title = screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
    await user.type(title, 'A saved draft');

    view.rerender(<ProfileHarness prayerEnabled={false} />);
    expect(screen.queryByRole('tab', { name: 'Prayer' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Rhythms' }).getAttribute('aria-selected')).toBe('true');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(overall).getByRole('group', { name: 'Health by area' }).getAttribute('data-count')).toBe('2');
    expect(within(overall).queryByText('Prayer')).toBeNull();
    const remainingAreas = within(overall).getByRole('group', { name: 'Health by area' });
    expect(within(remainingAreas).getByRole('img', {
      name: 'Rhythms Health score: unavailable'
    })).toBeTruthy();
    expect(within(remainingAreas).getByRole('img', {
      name: 'Connections Health score: unavailable'
    })).toBeTruthy();
    await user.click(within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    expect(within(screen.getByRole('dialog', { name: 'Avery’s Overall Health details' }))
      .queryByText('Prayer')).toBeNull();

    view.rerender(<ProfileHarness prayerEnabled />);
    await user.click(screen.getByRole('tab', { name: 'Prayer' }));
    expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value)
      .toBe('A saved draft');
  });

  it('keeps area scores static and opens area explanations from Overall Health Info', async () => {
    const user = userEvent.setup();
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [linkedRhythm.id, scoredProfileRhythmScore(80.4, 100)]
    ]);
    render(<ProfileHarness rhythms={[linkedRhythm]} rhythmScores={rhythmScores} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const overall = within(profile).getByRole('region', { name: 'Overall Health summary' });

    expect(within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' })
      .getAttribute('aria-expanded')).toBe('false');
    const componentScoresToggle = within(overall).getByRole('button', {
      name: 'Show Overall Health component scores breakdown'
    });
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(componentScoresToggle.getAttribute('aria-controls')!)?.hasAttribute('hidden')).toBe(true);
    expect(within(overall).queryByRole('group', { name: 'Health by area' })).toBeNull();
    expect(within(overall).queryByRole('group', { name: 'Consistency and On Track' })).toBeNull();
    expect(within(overall).getByRole('meter', { name: 'Overall Health progress score' })).toBeTruthy();

    await user.click(componentScoresToggle);
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('true');
    const areaScores = within(overall).getByRole('group', { name: 'Health by area' });
    expect(areaScores.querySelectorAll('button')).toHaveLength(0);
    for (const element of areaScores.querySelectorAll('.person-health-component-score')) {
      expect(element.tagName).toBe('DIV');
      expect(element.hasAttribute('aria-expanded')).toBe(false);
      expect(element.hasAttribute('aria-controls')).toBe(false);
    }
    const rhythmMeter = within(areaScores).getByRole('meter', { name: 'Rhythms Health score' });
    const connectionsImage = within(areaScores).getByRole('img', { name: 'Connections Health score: unavailable' });
    const prayerImage = within(areaScores).getByRole('img', { name: 'Prayer Health score: unavailable' });
    for (const [item, label] of [
      [rhythmMeter, 'Rhythms'],
      [connectionsImage, 'Connections'],
      [prayerImage, 'Prayer']
    ] as const) {
      expect(item.classList.contains('person-health-component-score')).toBe(true);
      expect(item.querySelector('.person-health-component-score__badge')).toBeTruthy();
      expect(item.querySelector('.person-health-component-score__label')?.textContent).toBe(label);
    }

    const overallInfo = within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' });
    expect(overallInfo.getAttribute('aria-expanded')).toBe('false');
    await user.click(overallInfo);
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('true');
    const overallDialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    const dialogAreaScores = within(overallDialog).getByRole('group', { name: 'Health by area' });
    const rhythmScoreButton = within(dialogAreaScores).getByRole('button', { name: 'Rhythms Health 85' });
    expect(rhythmScoreButton.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(rhythmScoreButton);
    const rhythmDialog = screen.getByRole('dialog', { name: 'Avery’s Rhythm Health details' });
    expect(within(rhythmDialog).getByText('Follow-through over time')).toBeTruthy();
    expect(within(rhythmDialog).getByText('How up to date you are')).toBeTruthy();
    expect(within(rhythmDialog).getByRole('button', { name: 'How Rhythm Health was scored' })).toBeTruthy();
    await user.click(within(rhythmDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(rhythmScoreButton));
    await user.click(within(overallDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(overallInfo));
    await user.click(componentScoresToggle);
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(overall).queryByRole('group', { name: 'Health by area' })).toBeNull();
  });

  it('shows the equal-area overall explanation and shared area details without mixing their scoring levels', async () => {
    const user = userEvent.setup();
    const needsConsistency = {
      ...linkedRhythm,
      id: 'user-rhythm-66666666-6666-4666-8666-666666666666',
      title: 'Pray together'
    };
    const needsBoth = {
      ...linkedRhythm,
      id: 'user-rhythm-77777777-7777-4777-8777-777777777777',
      title: 'Take a walk'
    };
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [linkedRhythm.id, scoredProfileRhythmScore(80.4, 100)],
      [needsConsistency.id, {
        ...scoredProfileRhythmScore(0, 0),
        consistency: { kind: 'unscored', reasonCode: 'ready-for-first-tend', explanation: 'No eligible occurrences yet.' }
      }]
    ]);
    render(<ProfileHarness rhythms={[linkedRhythm, needsConsistency, needsBoth]} rhythmScores={rhythmScores} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const overall = within(profile).getByRole('region', { name: 'Overall Health summary' });
    const overallToggle = within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' });
    expect(overallToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(overallToggle.getAttribute('aria-controls')!)).toBeNull();
    expect(within(overall).getByRole('meter', { name: 'Overall Health score' })
      .getAttribute('aria-valuetext')).toBe('85 out of 100');
    expect(within(overall).queryByRole('meter', { name: 'Consistency score' })).toBeNull();

    await user.click(overallToggle);
    expect(overallToggle.getAttribute('aria-expanded')).toBe('true');
    const overallDialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    const overallDetails = within(overallDialog).getByRole('region', {
      name: 'Avery Brooks’s Overall Health scoring explanation'
    });
    expect(within(overallDialog).getByRole('group', { name: 'Person identity: Avery Brooks' })).toBeTruthy();
    expect(within(overallDialog).getByRole('region', { name: 'Overall Health summary' })).toBeTruthy();
    const areaScores = within(overallDialog).getByRole('group', { name: 'Health by area' });
    const rhythmScoreButton = within(areaScores).getByRole('button', { name: 'Rhythms Health 85' });
    const connectionsScoreButton = within(areaScores).getByRole('button', { name: 'Connections Health unavailable' });
    const prayerScoreButton = within(areaScores).getByRole('button', { name: 'Prayer Health unavailable' });
    expect(rhythmScoreButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(rhythmScoreButton.getAttribute('aria-expanded')).toBe('false');
    expect(rhythmScoreButton.getAttribute('aria-controls')).toBeNull();
    expect(rhythmScoreButton.textContent).toContain('Rhythms');
    expect(rhythmScoreButton.querySelector('.person-health-component-score__label')).toBeTruthy();
    expect(within(areaScores).getAllByRole('button')).toHaveLength(3);
    expect(within(overallDialog).queryByRole('group', { name: 'Consistency and On Track' })).toBeNull();
    expect(within(overallDialog).queryByText('75%')).toBeNull();
    expect(within(overallDialog).queryByText('25%')).toBeNull();
    const overallScoring = within(overallDetails).getByRole('button', { name: 'How Overall Health was scored' });
    expect(overallScoring.getAttribute('aria-expanded')).toBe('false');
    await user.click(overallScoring);
    const areaRows = within(overallDetails).getByRole('list');
    expect(within(areaRows).getAllByRole('listitem').map(row => row.textContent)).toEqual([
      'Rhythms85',
      'Connections—',
      'Prayer—'
    ]);
    expect(within(overallDetails).getByText('Overall Health', {
      selector: '.person-overall-health-formula__result span'
    })).toBeTruthy();
    expect(within(overallDetails).getByText('85', { selector: '.person-overall-health-formula__result strong' }))
      .toBeTruthy();
    expect(within(overallDetails).getByText('Available areas count equally.')).toBeTruthy();
    expect(within(overallDetails).queryByText(/eligible area scores/i)).toBeNull();
    expect(within(overallDetails).queryByText(/→|÷/)).toBeNull();
    expect(within(overallDetails).queryByText('75%')).toBeNull();
    expect(within(overallDetails).queryByText('25%')).toBeNull();
    expect(document.activeElement).toBe(overallScoring);
    await user.click(rhythmScoreButton);
    const rhythmDialog = screen.getByRole('dialog', { name: 'Avery’s Rhythm Health details' });
    expect(within(rhythmDialog).getByRole('group', {
      name: 'Person identity: Avery Brooks, Rhythm Health'
    })).toBeTruthy();
    expect(within(rhythmDialog).getByRole('meter', { name: 'Rhythm Health score' })
      .getAttribute('aria-valuetext')).toBe('85 out of 100');
    const rhythmScoring = within(rhythmDialog).getByRole('button', { name: 'How Rhythm Health was scored' });
    const rhythmContribution = within(rhythmDialog).getByRole('button', { name: 'How Rhythm Health contributes' });
    expect(rhythmScoring.getAttribute('aria-expanded')).toBe('false');
    expect(rhythmContribution.getAttribute('aria-expanded')).toBe('false');
    await user.click(rhythmScoring);
    expect(rhythmScoring.getAttribute('aria-expanded')).toBe('true');
    expect(rhythmContribution.getAttribute('aria-expanded')).toBe('false');
    expect(within(rhythmDialog).getByText('75%')).toBeTruthy();
    expect(within(rhythmDialog).getByText('25%')).toBeTruthy();
    expect(within(rhythmDialog).getByLabelText('75% times 80 approximately equals 60 points')).toBeTruthy();
    expect(rhythmDialog.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toContain('60 + 25 ≈ 85');
    expect(rhythmDialog.textContent).not.toMatch(/\d+\.\d{2,}/);
    const rhythmEvidence = within(rhythmDialog).getByRole('region', { name: 'Scored Rhythms' });
    expect(within(rhythmEvidence).getByText('1 of 3')).toBeTruthy();
    expect(within(rhythmEvidence).queryByText(/active Rhythms linked to this Person/)).toBeNull();
    const eligibilityInfo = within(rhythmEvidence).getByText('i', { selector: 'summary' });
    expect(eligibilityInfo.getAttribute('aria-label')).toBe('Scored Rhythm eligibility information');
    await user.click(eligibilityInfo);
    expect(within(rhythmEvidence).getByText('Active linked Rhythms with both scores available count equally.')).toBeTruthy();
    await user.click(eligibilityInfo);
    const rhythmAverages = rhythmEvidence.querySelector('.health-aggregate-evidence__averages');
    expect(rhythmAverages?.textContent).toContain('Consistency average80');
    expect(rhythmAverages?.textContent).not.toContain('80.4');
    expect(rhythmAverages?.textContent).toContain('On Track average100');
    const rhythmEvidenceRow = within(rhythmEvidence).getByRole('row', { name: /Avery and Morgan walk/ });
    expect(rhythmEvidenceRow.textContent).toContain('80');
    expect(rhythmEvidenceRow.textContent).toContain('100');
    expect(rhythmEvidenceRow.textContent).not.toContain('Weekly');
    expect(rhythmEvidenceRow.textContent).not.toContain('As of');
    const notScored = within(rhythmEvidence).getByText('Not scored (2)');
    expect(notScored.closest('details')?.open).toBe(false);
    await user.click(notScored);
    expect(within(rhythmEvidence).getByText('Pray together')).toBeTruthy();
    expect(within(rhythmEvidence).getByText('Take a walk')).toBeTruthy();
    expect(within(rhythmEvidence).getByText('Needs Consistency score')).toBeTruthy();
    expect(within(rhythmEvidence).getByText('Needs scoring data')).toBeTruthy();
    expect(within(rhythmEvidence).queryByText(/one or both measures/i)).toBeNull();
    expect(within(rhythmEvidence).queryByText(/of 3 active associated Rhythms scored/)).toBeNull();
    const averages = rhythmEvidence.querySelector('.health-aggregate-evidence__averages');
    expect(averages?.textContent).toContain('Consistency average');
    expect(averages?.textContent).toContain('On Track average');
    expect(averages?.textContent).not.toContain('÷');
    expect(averages?.textContent).not.toContain('= 80.4');
    await user.click(rhythmContribution);
    expect(rhythmContribution.getAttribute('aria-expanded')).toBe('true');
    expect(within(rhythmDialog).getByText('Avery’s Overall Health')).toBeTruthy();
    expect(within(rhythmDialog).getAllByText('Rhythm Health').length).toBeGreaterThan(1);
    await user.click(within(rhythmDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(rhythmScoreButton));

    await user.click(connectionsScoreButton);
    const connectionDialog = screen.getByRole('dialog', { name: 'Avery’s Connection Health details' });
    expect(within(connectionDialog).getByText(/Set a connection frequency/)).toBeTruthy();
    expect(within(connectionDialog).getByText(/No connections yet/)).toBeTruthy();
    expect(within(connectionDialog).queryByText('75%')).toBeNull();
    await user.click(within(connectionDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(connectionsScoreButton));

    await user.click(prayerScoreButton);
    const prayerDialog = screen.getByRole('dialog', { name: 'Avery’s Prayer Health details' });
    expect(within(prayerDialog).getByRole('button', { name: 'How Prayer Health was scored' })).toBeTruthy();
    expect(within(prayerDialog).getByRole('button', { name: 'How Prayer Health contributes' })).toBeTruthy();
    expect(within(prayerDialog).queryByRole('group', { name: 'Consistency and On Track' })).toBeNull();
    await user.click(within(prayerDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(prayerScoreButton));
    await user.click(within(overallDialog).getByRole('button', { name: 'Close Health details' }));
    await waitFor(() => expect(document.activeElement).toBe(overallToggle));
  });

  it('scopes disclosure expansion to the current Person', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProfileHarness personId="sample-person-avery" />);
    const firstToggle = screen.getByRole('button', { name: 'Show Overall Health component scores breakdown' });
    await user.click(firstToggle);
    expect(firstToggle.getAttribute('aria-expanded')).toBe('true');

    rerender(<ProfileHarness personId="sample-person-morgan" />);
    expect(screen.getByRole('button', { name: 'Show Overall Health component scores breakdown' })
      .getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps scored zero distinct from unavailable in compact and expanded summaries', async () => {
    const user = userEvent.setup();
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [linkedRhythm.id, scoredProfileRhythmScore(0, 0)]
    ]);
    render(<ProfileHarness rhythms={[linkedRhythm]} rhythmScores={rhythmScores} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const overall = within(profile).getByRole('region', { name: 'Overall Health summary' });
    expect(within(overall).getByRole('meter', { name: 'Overall Health score' })
      .getAttribute('aria-valuenow')).toBe('0');
    expect(within(overall).getByRole('meter', { name: 'Overall Health progress score' })
      .getAttribute('aria-valuenow')).toBe('0');
    await user.click(within(overall).getByRole('button', {
      name: 'Show Overall Health component scores breakdown'
    }));
    expect(within(within(overall).getByRole('group', { name: 'Health by area' }))
      .getByRole('meter', { name: 'Rhythms Health score' }).getAttribute('aria-valuenow')).toBe('0');
    expect(within(overall).queryByRole('meter', { name: 'Consistency score' })).toBeNull();

    await user.click(within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    const dialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    const details = within(dialog).getByRole('region', { name: 'Avery Brooks’s Overall Health scoring explanation' });
    const scoring = within(details).getByRole('button', { name: 'How Overall Health was scored' });
    await user.click(scoring);
    expect(within(details).getByRole('list').textContent).toBe('Rhythms0Connections—Prayer—');
    expect(within(details).getByText('0', { selector: '.person-overall-health-formula__result strong' }))
      .toBeTruthy();
    expect(within(details).queryByText('No scores available yet.')).toBeNull();
    expect(within(dialog).queryByText('75%')).toBeNull();
    expect(within(dialog).queryByText('25%')).toBeNull();
  });

  it('shows neutral unavailable rows and the concise empty state when all areas are unavailable', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness rhythms={[]} rhythmScores={new Map()} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const overall = within(profile).getByRole('region', { name: 'Overall Health summary' });
    expect(within(overall).getByRole('meter', { name: 'Overall Health score' })
      .getAttribute('aria-valuetext')).toBe('Score unavailable');
    await user.click(within(overall).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    const dialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    const details = within(dialog).getByRole('region', { name: 'Avery Brooks’s Overall Health scoring explanation' });
    await user.click(within(details).getByRole('button', { name: 'How Overall Health was scored' }));
    expect(within(details).getByRole('list').textContent).toBe('Rhythms—Connections—Prayer—');
    expect(within(details).getByText('—', { selector: '.person-overall-health-formula__result strong' }))
      .toBeTruthy();
    expect(within(details).getByText('No scores available yet.')).toBeTruthy();
    expect(within(details).getByText('Available areas count equally.')).toBeTruthy();
    expect(within(details).queryByText(/75%|25%|÷|→/)).toBeNull();
  });

  it('uses approximate markers when Person area detail rounding changes the displayed calculation', async () => {
    const user = userEvent.setup();
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [linkedRhythm.id, scoredProfileRhythmScore(14.2857142857, 0)]
    ]);
    render(<ProfileHarness rhythms={[linkedRhythm]} rhythmScores={rhythmScores} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    await user.click(within(profile).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    const overallDialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    await user.click(within(overallDialog).getByRole('button', { name: 'Rhythms Health 11' }));
    const dialog = screen.getByRole('dialog', { name: 'Avery’s Rhythm Health details' });
    await user.click(within(dialog).getByRole('button', { name: 'How Rhythm Health was scored' }));
    expect(within(dialog).getByLabelText('75% times 14 approximately equals 11 points')).toBeTruthy();
    expect(dialog.querySelector('.rhythm-health-scoring-card__formula--total')?.textContent)
      .toContain('11 + 0 ≈ 11');
    expect(dialog.textContent).not.toMatch(/\d+\.\d{2,}/);
    await user.click(within(dialog).getByRole('button', { name: 'Close Health details' }));
    await user.click(within(overallDialog).getByRole('button', { name: 'Close Health details' }));
  });

  it('shows compact scored Rhythm rows, zero scores, and the empty scoring state', async () => {
    const user = userEvent.setup();
    const first = {
      ...linkedRhythm,
      title: 'A very long synthetic Rhythm title that should wrap without hiding either score'
    };
    const second = {
      ...linkedRhythm,
      id: 'user-rhythm-55555555-5555-4555-8555-555555555555',
      title: 'Second scored Rhythm'
    };
    const rhythmScores = new Map<string, RhythmScoreResult>([
      [first.id, scoredProfileRhythmScore(0, 100)],
      [second.id, scoredProfileRhythmScore(50, 0)]
    ]);
    render(<ProfileHarness rhythms={[first, second]} rhythmScores={rhythmScores} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    await user.click(within(profile).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    const overallDialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    await user.click(within(overallDialog).getByRole('button', { name: 'Rhythms Health 31' }));
    const dialog = screen.getByRole('dialog', { name: 'Avery’s Rhythm Health details' });
    await user.click(within(dialog).getByRole('button', { name: 'How Rhythm Health was scored' }));
    const evidence = within(dialog).getByRole('region', { name: 'Scored Rhythms' });
    expect(within(evidence).getByText('2 of 2')).toBeTruthy();
    const table = within(evidence).getByRole('table');
    const longTitle = 'A very long synthetic Rhythm title that should wrap without hiding either score';
    const longTitleRow = within(table).getByText(longTitle).closest('tr');
    expect(longTitleRow).toBeTruthy();
    expect(within(longTitleRow!).getByRole('img', { name: `${longTitle} Consistency: 0` })).toBeTruthy();
    expect(within(longTitleRow!).getByRole('img', { name: `${longTitle} On Track: 100` })).toBeTruthy();
    const secondRow = within(table).getByText('Second scored Rhythm').closest('tr');
    expect(within(secondRow!).getByRole('img', { name: 'Second scored Rhythm Consistency: 50' })).toBeTruthy();
    expect(within(secondRow!).getByRole('img', { name: 'Second scored Rhythm On Track: 0' })).toBeTruthy();
    expect(within(evidence).queryByText('Not scored (0)')).toBeNull();
    expect(evidence.querySelector('.health-aggregate-evidence__averages')?.textContent)
      .toContain('Consistency average25');
    expect(evidence.querySelector('.health-aggregate-evidence__averages')?.textContent)
      .toContain('On Track average50');

    await user.click(within(dialog).getByRole('button', { name: 'Close Health details' }));
    await user.click(within(overallDialog).getByRole('button', { name: 'Close Health details' }));
    cleanup();
    const emptyScores = new Map<string, RhythmScoreResult>([[linkedRhythm.id, score]]);
    render(<ProfileHarness rhythms={[linkedRhythm]} rhythmScores={emptyScores} />);
    const emptyProfile = screen.getByRole('main', { name: 'Avery Brooks' });
    await user.click(within(emptyProfile).getByRole('button', { name: 'Show Overall Health scoring explanation' }));
    const emptyOverallDialog = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    await user.click(within(emptyOverallDialog).getByRole('button', { name: 'Rhythms Health unavailable' }));
    const emptyDialog = screen.getByRole('dialog', { name: 'Avery’s Rhythm Health details' });
    await user.click(within(emptyDialog).getByRole('button', { name: 'How Rhythm Health was scored' }));
    const emptyEvidence = within(emptyDialog).getByRole('region', { name: 'Scored Rhythms' });
    expect(within(emptyEvidence).getByText('0 of 1')).toBeTruthy();
    expect(within(emptyEvidence).getByText('No Rhythms have both scores available.')).toBeTruthy();
    expect(within(emptyEvidence).getByText('Not scored (1)')).toBeTruthy();
    expect(emptyEvidence.querySelector('.health-aggregate-evidence__averages')?.textContent)
      .toContain('Consistency average—');
    expect(emptyEvidence.querySelector('.health-aggregate-evidence__averages')?.textContent)
      .toContain('On Track average—');
  });

  it('omits category and metadata badges when no values are supplied', () => {
    render(<ProfileHarness personId="sample-person-morgan" category={null} rhythms={[]} />);
    const profile = screen.getByRole('main', { name: 'Morgan Reed' });
    expect(screen.queryByText('Marriage')).toBeNull();
    expect(screen.queryByText('Parenting')).toBeNull();
    expect(screen.queryByText('Friend')).toBeNull();
    expect(screen.queryByLabelText(/^Love language:/)).toBeNull();
    expect(screen.queryByLabelText(/^Birthday:/)).toBeNull();
    expect(screen.queryByLabelText(/^Anniversary:/)).toBeNull();
    expect(profile.querySelector('.person-badge-avatar')?.textContent).toBe('MR');
    expect(screen.getByText('0 in queue')).toBeTruthy();
  });

  it('keeps the component-score breakdown collapsed while showing a populated Today queue', () => {
    const dailyRhythm: RhythmPreview = {
      ...linkedRhythm,
      schedule: { frequency: 'daily' }
    };
    render(
      <ProfileHarness
        rhythms={[dailyRhythm]}
        rhythmScores={new Map([[dailyRhythm.id, score]])}
      />
    );
    expect(screen.getByText('1 in queue')).toBeTruthy();
    const queueHeading = screen.getByRole('heading', { name: 'Rhythms' });
    const rhythmCard = screen.getByRole('article', { name: 'Avery and Morgan walk' });
    expect(Boolean(queueHeading.compareDocumentPosition(rhythmCard) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    const componentScoresToggle = screen.getByRole('button', {
      name: 'Show Overall Health component scores breakdown'
    });
    expect(componentScoresToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('group', { name: 'Health by area' })).toBeNull();
  });

  it('keeps connection cadence out of the Connections panel', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness personId="sample-person-morgan" />);
    const profile = screen.getByRole('main', { name: 'Morgan Reed' });
    await user.click(within(profile).getByRole('tab', { name: 'Connections' }));
    const connectionsHeader = within(profile).getByRole('heading', { name: 'Connections' })
      .closest('.person-profile-tab-header');
    expect(connectionsHeader?.querySelector('p')?.textContent).toBe('0 connections');
    expect(within(connectionsHeader as HTMLElement).getByRole('button', {
      name: 'Add connection'
    })).toBeTruthy();
    expect(within(profile).queryByRole('combobox', { name: /Connection cadence/ })).toBeNull();
    expect(within(profile).getByRole('button', { name: 'Person settings' })).toBeTruthy();
  });

  it('uses the shared compact Tend button style for Rhythm, Connection, and Prayer actions', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const expectSharedAction = (label: string) => {
      const action = within(profile).getByRole('button', { name: label });
      expect(action.classList.contains('btn')).toBe(true);
      expect(action.classList.contains('mini')).toBe(true);
      expect(action.classList.contains('person-profile-tab-header__action')).toBe(true);
    };

    expectSharedAction('Add rhythm');
    await user.click(within(profile).getByRole('tab', { name: 'Connections' }));
    expectSharedAction('Add connection');
    await user.click(within(profile).getByRole('tab', { name: 'Prayer' }));
    expectSharedAction('Add request');
  });

  it('uses shared in-place tended rows for Person Rhythms and preserves counts, order, and Undo', async () => {
    const user = userEvent.setup();
    const firstRhythm: RhythmPreview = { ...linkedRhythm, status: 'Due today' };
    const secondRhythm: RhythmPreview = {
      ...firstRhythm,
      id: 'user-rhythm-55555555-5555-4555-8555-555555555555',
      title: 'Plan an afternoon together',
      personIds: ['sample-person-avery']
    };
    const completedRhythm: RhythmPreview = {
      ...firstRhythm,
      completionHistory: [{
        id: 'person-profile-completion',
        effectiveDate: '2026-10-29',
        localTime: '10:15',
        completedAt: '2026-10-29T10:15:00.000Z'
      }]
    };
    const rhythms = [firstRhythm, secondRhythm] as const;
    const onTend = vi.fn();
    const undo = vi.fn();
    const view = render(<ProfileHarness rhythms={rhythms} onTend={onTend} onUndo={undo} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    expect(within(profile).getByText('2 in queue')).toBeTruthy();
    expect(within(profile).queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
    const firstCard = within(profile).getByRole('article', { name: 'Avery and Morgan walk' });
    await user.click(within(firstCard).getByRole('button', { name: 'Tend Avery and Morgan walk' }));
    expect(onTend).toHaveBeenCalledWith(linkedRhythm.id, expect.anything());

    view.rerender(<ProfileHarness rhythms={[completedRhythm, secondRhythm]} completed onTend={onTend} onUndo={undo} />);
    const row = within(profile).getByRole('button', { name: 'Avery and Morgan walk, Tended 10:15 am' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(within(profile).queryByRole('article', { name: 'Avery and Morgan walk' })).toBeNull();
    expect(within(profile).getByRole('article', { name: 'Plan an afternoon together' })).toBeTruthy();
    expect(within(profile).getByText('2 in queue')).toBeTruthy();
    expect(Array.from(profile.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]'))
      .map(item => item.dataset.tendedRhythmItem)).toEqual([linkedRhythm.id, secondRhythm.id]);

    await user.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(within(profile).getByRole('article', { name: 'Avery and Morgan walk' })).toBeTruthy();
    await user.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(within(profile).queryByRole('article', { name: 'Avery and Morgan walk' })).toBeNull();
    await user.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const expandedCard = within(profile).getByRole('article', { name: 'Avery and Morgan walk' });
    await user.click(within(expandedCard).getByRole('button', {
      name: 'Undo completion for Avery and Morgan walk'
    }));
    expect(undo).toHaveBeenCalledWith(linkedRhythm.id);

    view.rerender(<ProfileHarness rhythms={rhythms} onTend={onTend} onUndo={undo} />);
    await waitFor(() => {
      expect(within(profile).getByRole('article', { name: 'Avery and Morgan walk' })).toBeTruthy();
      expect(document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.rhythmTendButton
        : undefined).toBe(linkedRhythm.id);
    });
    expect(within(profile).getByText('2 in queue')).toBeTruthy();
    expect(within(profile).queryByRole('button', { name: /Show tended|Hide tended/ })).toBeNull();
    expect(Array.from(profile.querySelectorAll<HTMLElement>('[data-tended-rhythm-item]'))
      .map(item => item.dataset.tendedRhythmItem)).toEqual([linkedRhythm.id, secondRhythm.id]);
  });

  it('opens the Add Rhythm callback with one Person ID and retains empty Category/Foundation associations', async () => {
    const user = userEvent.setup();
    const addRhythm = vi.fn();
    render(<ProfileHarness rhythms={[]} onAddRhythm={addRhythm} />);
    await user.click(screen.getByRole('button', { name: 'Add rhythm' }));
    expect(addRhythm.mock.calls[0]?.[1]).toBe('sample-person-avery');
    expect(screen.getByText('No Rhythms yet.')).toBeTruthy();
  });

  it('opens a full-screen connection draft from Add and Cancel stores no event', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness rhythms={[]} />);
    await user.click(screen.getByRole('tab', { name: 'Connections' }));

    const addOpener = screen.getByRole('button', { name: 'Add connection' });
    await user.click(addOpener);
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    expect(editor.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(within(editor).getByRole('button', { name: 'Close connection editor' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Connection type: Text' })).toBeTruthy();
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people, Avery Brooks' });
    await user.click(peopleRow);
    const picker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(within(picker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed'))
      .toBe('false');
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(peopleRow);
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(addOpener);
    expect(screen.getAllByText('No connections yet.').length).toBeGreaterThan(0);
    expect(JSON.parse(screen.getByTestId('saved-connections').textContent ?? '{}').connections).toEqual([]);
  });

  it('uses the single Do it action and shared Spark editing with People-picker ownership', async () => {
    const user = userEvent.setup();
    const completeSpark = vi.fn<
      (_sparkId: string, _connection: FriendshipConnection) => string | null
    >(() => null);
    completeSpark.mockReturnValueOnce('Preview storage changed. No Connection was saved.');
    const createSpark = vi.fn(() => null);
    const updateSpark = vi.fn((_sparkId: string, _draft: PersonSparkDraft) => null);
    const archiveSpark = vi.fn((_sparkId: string, _archived: boolean) => null);
    const spark: PersonSpark = {
      id: 'spark-visit-garden',
      ownerId: 'sample-person-avery',
      title: 'Visit the garden',
      description: 'Take an easy walk and enjoy the flowers.',
      sharedWith: ['sample-person-morgan'],
      archived: false,
      completed: false,
      completionHistory: []
    };
    const sparkWithoutDescription: PersonSpark = {
      id: 'spark-share-tea',
      ownerId: 'sample-person-avery',
      title: 'Share tea',
      sharedWith: [],
      archived: false,
      completed: false,
      completionHistory: []
    };
    const completedSpark: PersonSpark = {
      ...sparkWithoutDescription,
      id: 'spark-completed',
      title: 'Watch Backrooms',
      completed: true,
      completionHistory: [{
        id: 'spark-completed-event',
        source: 'legacy',
        date: '2026-10-28',
        completedAt: '2026-10-28T18:30:00.000Z',
        legacyEventId: 'spark-completed-event'
      }]
    };
    const archivedSpark: PersonSpark = {
      ...sparkWithoutDescription,
      id: 'spark-archived',
      title: 'Archived idea',
      archived: true
    };
    const sameTitleConnection: FriendshipConnection = {
      id: 'unlinked-spark-title-match',
      type: 'spark',
      date: '2026-10-28',
      participantIds: ['sample-person-avery'],
      sparkTitleSnapshot: spark.title
    };
    render(
      <ProfileHarness
        rhythms={[]}
        initialFriendships={addOrUpdateConnection(createFriendshipData(), sameTitleConnection)}
        personSparks={[spark, sparkWithoutDescription, completedSpark, archivedSpark]}
        onCreatePersonSpark={createSpark}
        onUpdatePersonSpark={updateSpark}
        onArchivePersonSpark={archiveSpark}
        onCompletePersonSpark={completeSpark}
      />
    );
    await user.click(screen.getByRole('tab', { name: 'Connections' }));

    const section = screen.getByRole('region', { name: 'Sparks' });
    const openSparkList = section.querySelector('.person-spark-list');
    expect(openSparkList?.querySelectorAll('.person-spark-card')).toHaveLength(2);
    expect(openSparkList?.textContent).not.toContain(completedSpark.title);
    expect(openSparkList?.textContent).not.toContain(archivedSpark.title);
    expect(section.querySelector('.person-spark-panel__archived')?.textContent)
      .toContain(archivedSpark.title);
    expect(within(screen.getByRole('main', { name: 'Avery Brooks' })).getByRole('button', {
      name: /Visit the garden, Spark connection/
    })).toBeTruthy();
    const sparkCard = within(section).getByRole('article', { name: 'Visit the garden' });
    const disclosure = within(sparkCard).getByRole('button', { name: 'Expand Spark Visit the garden' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(sparkCard.querySelector('.person-spark-card__description')).toBeNull();
    await user.click(disclosure);
    expect(within(sparkCard).getByRole('button', { name: 'Collapse Spark Visit the garden' })
      .getAttribute('aria-expanded')).toBe('true');
    expect(within(sparkCard).getByText('Take an easy walk and enjoy the flowers.')).toBeTruthy();
    expect(within(sparkCard).getAllByRole('button', { name: /Open synthetic profile for/ })).toHaveLength(2);
    expect(within(sparkCard).getByText('Someday')).toBeTruthy();
    expect(within(section).getByRole('article', { name: 'Share tea' })
      .querySelector('.person-spark-card__description')).toBeNull();
    expect(within(section).queryByRole('button', { name: /Actions for/ })).toBeNull();

    const editButton = within(sparkCard).getByRole('button', { name: 'Edit Spark' });
    await user.click(editButton);
    const sparkEditor = screen.getByRole('dialog', { name: 'Edit Spark' });
    const sparkDescription = within(sparkEditor).getByLabelText('Description (optional)') as HTMLTextAreaElement;
    expect(sparkDescription.value)
      .toBe('Take an easy walk and enjoy the flowers.');
    expect(within(sparkEditor).queryByRole('button', { name: /Notes/ })).toBeNull();
    expect(within(sparkEditor).queryByRole('button', { name: /Archive Spark/ })).toBeNull();
    const editPeopleRow = within(sparkEditor).getByRole('button', {
      name: 'Choose people, Avery Brooks and Morgan Reed'
    });
    await user.click(editPeopleRow);
    const editPicker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(within(editPicker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(within(editPicker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed'))
      .toBe('true');
    await user.click(within(editPicker).getByRole('button', { name: 'Done' }));
    await user.clear(sparkDescription);
    await user.type(sparkDescription, 'Updated description');
    await user.click(within(sparkEditor).getByRole('button', { name: 'Save changes' }));
    expect(updateSpark).toHaveBeenCalledWith(spark.id, {
      title: spark.title,
      description: 'Updated description',
      sharedWith: ['sample-person-morgan']
    });
    expect(archiveSpark).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(editButton);

    await user.click(within(sparkCard).getByRole('button', { name: 'Do it' }));
    const editor = screen.getByRole('dialog', { name: 'Log a connection for this Spark' });
    const dateField = within(editor).getByLabelText('Date') as HTMLInputElement;
    expect(dateField.value).toBe(localDateString(new Date()));
    expect(within(editor).queryByRole('combobox', { name: 'Connection type' })).toBeNull();
    expect(within(editor).getByText('Spark', { selector: 'strong' })).toBeTruthy();
    const now = new Date();
    const hour24 = now.getHours();
    expect(within(editor).getByRole('spinbutton', { name: 'Hour' }).getAttribute('aria-valuenow'))
      .toBe(String(hour24 % 12 || 12));
    expect(within(editor).getByRole('spinbutton', { name: 'Minute' }).getAttribute('aria-valuenow'))
      .toBe(String(now.getMinutes()));
    expect(within(editor).getByRole('spinbutton', { name: 'AM / PM' }).getAttribute('aria-valuetext'))
      .toBe(hour24 < 12 ? 'AM' : 'PM');
    expect(completeSpark).not.toHaveBeenCalled();
    fireEvent.change(dateField, { target: { value: '2026-10-28' } });
    await user.type(within(editor).getByLabelText('Notes (optional)'), 'Plan it for Saturday.');
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));
    expect(within(editor).getByRole('alert').textContent)
      .toBe('Preview storage changed. No Connection was saved.');
    expect(dateField.value).toBe('2026-10-28');
    expect((within(editor).getByLabelText('Notes (optional)') as HTMLTextAreaElement).value)
      .toBe('Plan it for Saturday.');
    expect(completeSpark).toHaveBeenCalledOnce();
    expect(completeSpark.mock.calls[0]?.[0]).toBe(spark.id);
    expect(completeSpark.mock.calls[0]?.[1]).toMatchObject({
      type: 'spark',
      date: '2026-10-28',
      sparkTitleSnapshot: spark.title,
      notes: 'Plan it for Saturday.',
      participantIds: ['sample-person-avery', 'sample-person-morgan']
    });
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));
    expect(completeSpark).toHaveBeenCalledTimes(2);

    await user.click(within(sparkCard).getByRole('button', { name: 'Do it' }));
    const cancelledEditor = screen.getByRole('dialog', { name: 'Log a connection for this Spark' });
    await user.click(within(cancelledEditor).getByRole('button', { name: 'Cancel' }));
    expect(completeSpark).toHaveBeenCalledTimes(2);

    await user.click(within(section).getByRole('button', { name: '+ Add Spark' }));
    const addDialog = screen.getByRole('dialog', { name: 'Add Spark' });
    const addPeopleRow = within(addDialog).getByRole('button', {
      name: 'Choose people, Avery Brooks'
    });
    await user.click(addPeopleRow);
    const addPicker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(within(addPicker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed'))
      .toBe('true');
    await user.click(within(addPicker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(addPicker).getByRole('button', { name: 'Done' }));
    await user.type(within(addDialog).getByLabelText('Title'), 'Go to the market');
    await user.click(within(addDialog).getByRole('button', { name: 'Create Spark' }));
    expect(createSpark).toHaveBeenCalledWith('sample-person-avery', {
      title: 'Go to the market',
      sharedWith: ['sample-person-morgan']
    });
  });

  it('shows saved Spark and Rhythm titles with secondary source labels in history and details', async () => {
    const user = userEvent.setup();
    const sparkConnection: FriendshipConnection = {
      id: 'spark-picnic-connection',
      type: 'spark',
      date: '2026-10-28',
      participantIds: ['sample-person-avery', 'sample-person-morgan'],
      sparkId: 'spark-picnic',
      sparkOwnerId: 'sample-person-avery',
      sparkTitleSnapshot: 'Plan a picnic'
    };
    const rhythmConnection: FriendshipConnection = {
      id: 'rhythm-daily-connection',
      type: 'rhythm',
      date: '2026-10-27',
      participantIds: ['sample-person-avery', 'sample-person-morgan'],
      rhythmId: 'rhythm-daily',
      completionId: 'rhythm-daily-completion',
      rhythmTitleSnapshot: 'Daily connection'
    };
    const olderRhythmConnection: FriendshipConnection = {
      id: 'rhythm-legacy-connection',
      type: 'rhythm',
      date: '2026-10-25',
      participantIds: ['sample-person-avery'],
      rhythmId: 'rhythm-legacy'
    };
    const spark: PersonSpark = {
      id: 'spark-picnic',
      ownerId: 'sample-person-avery',
      title: 'Plan a picnic',
      sharedWith: ['sample-person-morgan'],
      archived: false,
      completed: true,
      completionHistory: [{
        id: sparkConnection.id,
        source: 'connection',
        date: sparkConnection.date,
        connectionId: sparkConnection.id
      }]
    };
    render(
      <ProfileHarness
        rhythms={[]}
        personSparks={[spark]}
        initialFriendships={{
          ...createFriendshipData(),
          connections: [sparkConnection, rhythmConnection, olderRhythmConnection]
        }}
      />
    );
    await user.click(screen.getByRole('tab', { name: 'Connections' }));

    const sparkRow = screen.getByRole('button', { name: /Plan a picnic, Spark connection/ });
    expect(within(sparkRow).getByText('Plan a picnic')).toBeTruthy();
    expect(within(sparkRow).getByText('Spark')).toBeTruthy();
    expect(sparkRow.querySelector('.friendships-connection-row__check--spark')).toBeTruthy();
    expect(sparkRow.querySelectorAll('time')).toHaveLength(1);
    await user.click(sparkRow);
    const sparkDetails = screen.getByRole('dialog', { name: 'Connection details' });
    expect(within(sparkDetails).getByText('Plan a picnic')).toBeTruthy();
    expect(within(sparkDetails).getByRole('combobox', { name: 'Connection type: Spark' })).toBeTruthy();
    await user.click(within(sparkDetails).getByRole('button', { name: 'Cancel' }));

    const rhythmRow = screen.getByRole('button', { name: /Daily connection, Rhythm connection/ });
    expect(within(rhythmRow).getByText('Daily connection')).toBeTruthy();
    expect(within(rhythmRow).getByText('Rhythm')).toBeTruthy();
    expect(rhythmRow.querySelector('.friendships-connection-row__check--rhythm')).toBeTruthy();
    expect(rhythmRow.querySelectorAll('time')).toHaveLength(1);
    await user.click(rhythmRow);
    const rhythmDetails = screen.getByRole('dialog', { name: 'Connection details' });
    expect(within(rhythmDetails).getByText('Daily connection')).toBeTruthy();
    expect(within(rhythmDetails).getByRole('combobox', { name: 'Connection type: Rhythm' })).toBeTruthy();
    await user.click(within(rhythmDetails).getByRole('button', { name: 'Cancel' }));

    const olderRhythmRow = screen.getByRole('button', { name: /^Rhythm connection,/ });
    expect(within(olderRhythmRow).getAllByText('Rhythm')).toHaveLength(2);
    expect(olderRhythmRow.querySelector('.friendships-connection-row__check--rhythm')).toBeTruthy();
    await user.click(olderRhythmRow);
    const olderDetails = screen.getByRole('dialog', { name: 'Connection details' });
    expect(within(olderDetails).getByRole('combobox', { name: 'Connection type: Rhythm' })).toBeTruthy();
    await user.click(within(olderDetails).getByRole('button', { name: 'Cancel' }));
  });

  it('shows all participant-linked source records and explains why Connection Health is unscored', async () => {
    const user = userEvent.setup();
    const averyId = 'sample-person-avery';
    const morganId = 'sample-person-morgan';
    const rhythm = { ...linkedRhythm, title: 'Pray together', personIds: [averyId] };
    const manualConnection: FriendshipConnection = {
      id: 'health-manual-connection',
      type: 'text',
      date: '2026-10-29',
      participantIds: [averyId]
    };
    const sparkConnection: FriendshipConnection = {
      id: 'health-spark-connection',
      type: 'spark',
      date: '2026-10-28',
      participantIds: [averyId, morganId],
      sparkId: 'health-spark',
      sparkOwnerId: averyId,
      sparkTitleSnapshot: 'Watch Backrooms Movie'
    };
    const rhythmConnection: FriendshipConnection = {
      id: 'health-rhythm-connection',
      type: 'rhythm',
      date: '2026-10-27',
      participantIds: [averyId],
      rhythmId: rhythm.id,
      completionId: 'health-rhythm-completion',
      rhythmTitleSnapshot: 'Pray together'
    };
    const otherPersonConnection: FriendshipConnection = {
      id: 'morgan-only-connection',
      type: 'call',
      date: '2026-10-29',
      participantIds: [morganId]
    };
    const spark: PersonSpark = {
      id: 'health-spark',
      ownerId: averyId,
      title: 'Watch Backrooms Movie',
      sharedWith: [morganId],
      archived: false,
      completed: true,
      completionHistory: [{
        id: sparkConnection.id,
        source: 'connection',
        date: sparkConnection.date,
        connectionId: sparkConnection.id
      }]
    };

    render(
      <ProfileHarness
        rhythms={[rhythm]}
        rhythmScores={new Map([[rhythm.id, scoredProfileRhythmScore(50, 50)]])}
        personSparks={[spark]}
        initialFriendships={{
          ...createFriendshipData(),
          connections: [
            manualConnection,
            sparkConnection,
            rhythmConnection,
            otherPersonConnection
          ]
        }}
      />
    );
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    expect(screen.getByRole('button', { name: /Text, Manual connection,/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Watch Backrooms Movie, Spark connection/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pray together, Rhythm connection/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Morgan-only connection/ })).toBeNull();

    const overall = screen.getByRole('region', { name: 'Overall Health summary' });
    expect(within(overall).getByRole('meter', {
      name: 'Overall Health progress score'
    }).getAttribute('aria-valuenow')).toBe('50');
    const componentScoresToggle = within(overall).getByRole('button', {
      name: 'Show Overall Health component scores breakdown'
    });
    await user.click(componentScoresToggle);
    const areas = within(overall).getByRole('group', { name: 'Health by area' });
    expect(within(areas).getByRole('img', {
      name: 'Connections Health score: unavailable'
    })).toBeTruthy();
    expect(within(areas).getByText(
      'Set a connection frequency in Person settings to calculate Connection Health.'
    )).toBeTruthy();

    await user.click(within(overall).getByRole('button', {
      name: 'Show Overall Health scoring explanation'
    }));
    const overallDetails = screen.getByRole('dialog', { name: 'Avery’s Overall Health details' });
    await user.click(within(overallDetails).getByRole('button', {
      name: 'Connections Health unavailable'
    }));
    const connectionDetails = screen.getByRole('dialog', {
      name: 'Avery’s Connection Health details'
    });
    expect(within(connectionDetails).getByText(/Set a connection frequency/)).toBeTruthy();
    expect(within(connectionDetails).getByText('3')).toBeTruthy();
    expect(within(connectionDetails).getByText('No cadence configured')).toBeTruthy();
  });

  it('keeps completed Sparks out of the Person open list', async () => {
    const user = userEvent.setup();
    const undoSpark = vi.fn((_sparkId: string) => null);
    const spark: PersonSpark = {
      id: 'spark-visit-garden-completed',
      ownerId: 'sample-person-avery',
      title: 'Visit the garden',
      sharedWith: [],
      archived: false,
      completed: true,
      completionHistory: [{
        id: 'spark-visit-garden-completion',
        source: 'legacy',
        date: '2026-10-28',
        completedAt: '2026-10-28T15:00:00.000Z',
        legacyEventId: 'spark-visit-garden-completion'
      }]
    };
    render(<ProfileHarness rhythms={[]} personSparks={[spark]} onUndoPersonSpark={undoSpark} />);
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    const section = screen.getByRole('region', { name: 'Sparks' });
    expect(within(section).queryByRole('article', { name: spark.title })).toBeNull();
    expect(within(section).getByText('No open Sparks yet.')).toBeTruthy();
    expect(undoSpark).not.toHaveBeenCalled();
  });

  it('logs one shared event, recalculates the person projection after participant edits, and preserves cadence', async () => {
    const user = userEvent.setup();
    const groups = setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-avery', true);
    const originalCadenceData = createFriendshipData();
    function StatefulProfileHarness() {
      const [friendships, setFriendships] = useState<FriendshipData>(originalCadenceData);
      return (
        <>
          <PersonProfileView
            personId="sample-person-avery"
            peopleGroups={groups}
            friendships={friendships}
            today="2026-10-29"
            rhythms={[]}
            archivedRhythms={[]}
            foundations={foundationCatalogue}
            rhythmScores={new Map()}
            completedRhythms={new Set()}
            undoableRhythms={new Set()}
            onAddRhythm={vi.fn()}
            onEditRhythm={vi.fn()}
            onRhythmHistory={vi.fn()}
            onTend={vi.fn()}
            onUndo={vi.fn()}
            onRestoreRhythm={vi.fn()}
            onOpenFoundation={vi.fn()}
            onOpenCategory={vi.fn()}
            onPersonSelect={vi.fn()}
            onConnectionChange={setFriendships}
            onClose={vi.fn()}
          />
          <output data-testid="connection-state">{JSON.stringify(friendships)}</output>
        </>
      );
    }

    render(<StatefulProfileHarness />);
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    await user.click(screen.getByRole('button', { name: 'Add connection' }));
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    expect(editor.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(within(editor).getByRole('combobox', { name: 'Connection type: Text' })).toBeTruthy();
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people, Avery Brooks' });
    await user.click(peopleRow);
    const peoplePicker = screen.getByRole('dialog', { name: 'Choose people' });
    await user.click(within(peoplePicker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(peoplePicker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));

    const stored = JSON.parse(screen.getByTestId('connection-state').textContent ?? '{}') as FriendshipData;
    expect(stored.connections).toHaveLength(1);
    expect(stored.connections[0]?.participantIds).toEqual(['sample-person-avery', 'sample-person-morgan']);
    expect(screen.getByRole('button', { name: 'Add connection' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Connection cadence/ })).toBeNull();
    const connectionRow = screen.getByRole('button', { name: /^Text, Manual connection,/ });
    await user.click(connectionRow);
    const edit = screen.getByRole('dialog', { name: 'Connection details' });
    const editPeopleRow = within(edit).getByRole('button', {
      name: 'Choose people, Avery Brooks and Morgan Reed'
    });
    await user.click(editPeopleRow);
    const editPeoplePicker = screen.getByRole('dialog', { name: 'Choose people' });
    await user.click(within(editPeoplePicker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(editPeoplePicker).getByRole('button', { name: 'Done' }));
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Connections' }));
    expect(screen.getByText('No connections yet.')).toBeTruthy();
    const edited = JSON.parse(screen.getByTestId('connection-state').textContent ?? '{}') as FriendshipData;
    expect(edited.connections).toHaveLength(1);
    expect(edited.connections[0]?.participantIds).toEqual(['sample-person-morgan']);
    expect(edited.cadenceSettings).toHaveLength(0);
  });

  it('keeps archive and restore in the shared scoped Rhythm manager', async () => {
    const user = userEvent.setup();
    const restoreRhythm = vi.fn();
    const archived = { ...linkedRhythm, id: 'user-rhythm-55555555-5555-4555-8555-555555555555', title: 'Archived walk' };
    render(<ProfileHarness rhythms={[]} archivedRhythms={[archived]} onRestoreRhythm={restoreRhythm} />);
    await user.click(screen.getByRole('button', { name: 'Archived rhythms (1)' }));
    const dialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    await user.click(within(dialog).getByRole('button', { name: 'Restore rhythm Archived walk' }));
    expect(restoreRhythm).toHaveBeenCalledWith(archived.id);
  });

  it('deletes a shared connection once while preserving cadence settings', async () => {
    const user = userEvent.setup();
    const data = addOrUpdateConnection(
      setFriendCadence(createFriendshipData(), 'sample-person-avery', 'monthly', '2026-10-01'),
      {
        id: 'profile-shared-connection',
        type: 'call',
        date: '2026-10-20',
        participantIds: ['sample-person-avery', 'sample-person-morgan']
      }
    );
    render(<ProfileHarness rhythms={[]} initialFriendships={data} />);
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    await user.click(screen.getByRole('button', { name: /^Call, Manual connection,/ }));
    const details = screen.getByRole('dialog', { name: 'Connection details' });
    await user.click(within(details).getByRole('button', { name: 'Delete connection' }));
    const confirmation = screen.getByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Delete connection' }));
    expect(screen.getAllByText('No connections yet.').length).toBeGreaterThan(0);
    const updated = JSON.parse(screen.getByTestId('saved-connections').textContent ?? '{}') as FriendshipData;
    expect(updated.connections).toEqual([]);
    expect(updated.cadenceSettings).toEqual(data.cadenceSettings);
  });

  it('supports keyboard tab movement and returns through the shared back button', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<ProfileHarness rhythms={[]} onClose={close} />);
    const profile = screen.getByRole('main', { name: 'Avery Brooks' });
    const rhythmsTab = screen.getByRole('tab', { name: 'Rhythms' });
    expect(rhythmsTab.getAttribute('aria-controls')).toBe('person-profile-panel-rhythms');
    expect(screen.getByRole('tabpanel', { name: 'Rhythms' })).toBeTruthy();
    rhythmsTab.focus();
    await user.keyboard('{ArrowRight}');
    const connectionsTab = screen.getByRole('tab', { name: 'Connections' });
    expect(document.activeElement).toBe(connectionsTab);
    expect(connectionsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    const prayerTab = screen.getByRole('tab', { name: 'Prayer' });
    expect(document.activeElement).toBe(prayerTab);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(connectionsTab);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(rhythmsTab);
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(prayerTab);
    expect(prayerTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(rhythmsTab);
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(prayerTab);
    await user.click(within(profile).getByRole('button', { name: 'Back to previous page' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('creates, shares, edits and deletes a plain-text note through the shared profile', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness rhythms={[]} />);
    const notesButton = screen.getByRole('button', { name: 'Notes (0)' });
    expect(screen.getAllByRole('button', { name: 'Notes (0)' })).toHaveLength(1);
    for (const tabName of ['Rhythms', 'Connections', 'Prayer'] as const) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      expect(screen.getAllByRole('button', { name: 'Notes (0)' })).toHaveLength(1);
      await user.click(notesButton);
      expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Avery Brooks notes' })).toBeTruthy();
      expect(screen.getByText('No notes yet. Add a note to keep something meaningful in view.')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Close notes' }));
      expect(document.activeElement).toBe(notesButton);
    }
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    await user.click(notesButton);
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByText('No notes yet. Add a note to keep something meaningful in view.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Collapse notes drawer' }));
    expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull();
    expect(document.activeElement).toBe(notesButton);
    await user.click(notesButton);
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
    const drawer = screen.getByRole('dialog', { name: 'Notes' });
    fireEvent(drawer, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull();
    expect(document.activeElement).toBe(notesButton);
    await user.click(notesButton);
    fireEvent.click(screen.getByRole('dialog', { name: 'Notes' }));
    expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull();

    await user.click(notesButton);
    await user.click(screen.getByRole('button', { name: /Add note/ }));
    expect(screen.queryByRole('dialog', { name: 'Notes' })).toBeNull();
    const editor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
    const noteField = within(editor).getByRole('textbox', { name: 'Note' });
    await user.click(within(editor).getByRole('button', { name: 'Save note' }));
    expect(within(editor).getByText('Write something before saving this note.')).toBeTruthy();
    await user.type(noteField, 'First line{Enter}<script>plain text</script>');
    await user.click(within(editor).getByRole('button', { name: 'Choose people, Avery Brooks' }));
    const picker = screen.getByRole('dialog', { name: 'Share note' });
    const ownerOption = within(picker).getByRole('button', { name: 'Avery Brooks' });
    expect(ownerOption.getAttribute('aria-pressed')).toBe('true');
    expect((ownerOption as HTMLButtonElement).disabled).toBe(true);
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save note' }));

    const saved = JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan'],
      content: 'First line\n<script>plain text</script>'
    });
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();

    await user.click(within(screen.getByRole('dialog', { name: 'Notes' }))
      .getByRole('button', { name: 'Close notes' }));
    for (const tabName of ['Rhythms', 'Connections', 'Prayer'] as const) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      expect(screen.getAllByRole('button', { name: 'Notes (1)' })).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
      expect(screen.getByRole('button', { name: /Open note updated/ })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Close notes' }));
    }
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    await user.click(notesButton);
    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    const detail = screen.getByRole('dialog', { name: 'Note' });
    expect(within(detail).getByText((_content, element) =>
      element?.textContent === 'First line\n<script>plain text</script>'
    )).toBeTruthy();
    expect(within(detail).queryByRole('script')).toBeNull();
    expect(within(detail).getByRole('img', { name: 'Morgan Reed' })).toBeTruthy();
    expect(within(detail).queryByText(/Shared with/)).toBeNull();
    await user.click(within(detail).getByRole('button', { name: 'Edit note' }));
    const edit = screen.getByRole('dialog', { name: 'Edit note' });
    await user.clear(within(edit).getByRole('textbox', { name: 'Note' }));
    await user.type(within(edit).getByRole('textbox', { name: 'Note' }), 'Updated safely');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    const updated = JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[];
    expect(updated[0]?.id).toBe(saved[0]?.id);
    expect(updated[0]?.personId).toBe('sample-person-avery');
    expect(updated[0]?.createdAt).toBe(saved[0]?.createdAt);
    expect(updated[0]?.updatedAt).toBe('2026-10-31T14:00:00.000Z');
    expect(within(screen.getByRole('dialog', { name: 'Note' })).getByText('Updated safely')).toBeTruthy();

    await user.click(within(screen.getByRole('dialog', { name: 'Note' })).getByRole('button', { name: 'Delete note' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete this note?' });
    expect(within(confirmation).getByText('This removes the same note from all linked People profiles.')).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]')).toHaveLength(1);
    await user.click(within(screen.getByRole('dialog', { name: 'Note' })).getByRole('button', { name: 'Delete note' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete this note?' })).getByRole('button', { name: 'Delete note' }));
    expect(JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]')).toHaveLength(0);
    expect(screen.getByText('No notes yet. Add a note to keep something meaningful in view.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notes (0)' })).toBeTruthy();
  });

  it('shows a shared note in the linked person profile without changing primary ownership during edits', async () => {
    const user = userEvent.setup();
    const sharedNote: PersonNote = {
      id: 'shared-note',
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan'],
      content: 'One shared record',
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z'
    };
    render(<ProfileHarness personId="sample-person-morgan" initialNotes={[sharedNote]} rhythms={[]} />);
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    expect(screen.getByText(/Primary person: Avery Brooks/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit note' }));
    const editor = screen.getByRole('dialog', { name: 'Edit note' });
    expect(within(editor).getByText('Primary person: Avery Brooks. Ownership stays with them.')).toBeTruthy();
    await user.clear(within(editor).getByRole('textbox', { name: 'Note' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Note' }), 'Updated from Morgan');
    await user.click(within(editor).getByRole('button', { name: 'Choose people, Avery Brooks and Morgan Reed' }));
    const picker = screen.getByRole('dialog', { name: 'Share note' });
    const ownerOption = within(picker).getByRole('button', { name: 'Avery Brooks' });
    const sharedOption = within(picker).getByRole('button', { name: 'Morgan Reed' });
    expect(ownerOption.getAttribute('aria-pressed')).toBe('true');
    expect((ownerOption as HTMLButtonElement).disabled).toBe(true);
    expect(sharedOption.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    const stored = JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[];
    expect(stored).toEqual([{
      ...sharedNote,
      content: 'Updated from Morgan',
      updatedAt: '2026-10-31T14:00:00.000Z'
    }]);
  });

  it('keeps note reading separate from direct pencil editing and returns to the drawer after cancel or save', async () => {
    const user = userEvent.setup();
    const note: PersonNote = {
      id: 'read-edit-note',
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan'],
      content: 'A note with separate read and edit actions',
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z'
    };
    render(<ProfileHarness initialNotes={[note]} rhythms={[]} />);
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    const drawer = screen.getByRole('dialog', { name: 'Notes' });
    const row = drawer.querySelector('.person-notes-row');
    expect(row).toBeTruthy();
    expect(row?.querySelectorAll('button')).toHaveLength(2);
    const readButton = within(row as HTMLElement)
      .getByRole('button', { name: /Open note updated/ });
    await user.click(readButton);
    const detail = screen.getByRole('dialog', { name: 'Note' });
    expect(within(detail).getByText(note.content)).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Edit note' })).toBeNull();
    await user.click(within(detail).getByRole('button', { name: 'Close note' }));

    await user.click(within(screen.getByRole('dialog', { name: 'Notes' }))
      .getByRole('button', { name: /Edit note updated/ }));
    const edit = screen.getByRole('dialog', { name: 'Edit note' });
    const field = within(edit).getByRole('textbox', { name: 'Note' });
    expect((field as HTMLTextAreaElement).value).toBe(note.content);
    await user.clear(field);
    await user.type(field, 'Cancelled draft');
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]'))
      .toEqual([note]);

    await user.click(within(screen.getByRole('dialog', { name: 'Notes' }))
      .getByRole('button', { name: /Edit note updated/ }));
    const saveEdit = screen.getByRole('dialog', { name: 'Edit note' });
    const saveField = within(saveEdit).getByRole('textbox', { name: 'Note' });
    await user.clear(saveField);
    await user.type(saveField, 'Saved from the card pencil');
    await user.click(within(saveEdit).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeTruthy();
    const saved = JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: note.id,
      personId: note.personId,
      sharedWith: note.sharedWith,
      content: 'Saved from the card pencil'
    });
    expect(within(screen.getByRole('dialog', { name: 'Notes' }))
      .getByText('Saved from the card pencil')).toBeTruthy();
  });

  it('filters note badges by stable profile ID while retaining distinct people with duplicate names', async () => {
    const user = userEvent.setup();
    const note: PersonNote = {
      id: 'profile-filter-note',
      personId: 'sample-person-avery',
      sharedWith: ['sample-person-morgan', 'sample-person-morgan', 'sample-person-jordan'],
      content: 'Shared with the other people',
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z'
    };
    const averyProfile = render(
      <ProfileHarness personId="sample-person-avery" initialNotes={[note]} rhythms={[]} />
    );
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    let row = screen.getByRole('button', { name: /Open note updated/ }).closest('.person-notes-row');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Morgan Reed', 'Jordan Bell']);
    expect((JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[])[0]?.sharedWith)
      .toEqual(note.sharedWith);

    averyProfile.unmount();
    render(<ProfileHarness personId="sample-person-morgan" initialNotes={[note]} rhythms={[]} />);
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    row = screen.getByRole('button', { name: /Open note updated/ }).closest('.person-notes-row');
    expect(within(row as HTMLElement).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Avery Brooks', 'Jordan Bell']);

    cleanup();
    const duplicateNamePerson: PersonPreview = {
      id: 'sample-person-morgan-copy',
      displayName: 'Morgan Reed'
    };
    const duplicateNameNote = {
      ...note,
      id: 'duplicate-name-note',
      sharedWith: ['sample-person-morgan', duplicateNamePerson.id]
    };
    render(
      <ProfileHarness
        personId="sample-person-avery"
        people={[...syntheticPeople, duplicateNamePerson]}
        initialNotes={[duplicateNameNote]}
        rhythms={[]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    row = screen.getByRole('button', { name: /Open note updated/ }).closest('.person-notes-row');
    expect(within(row as HTMLElement).getAllByRole('img', { name: 'Morgan Reed' })).toHaveLength(2);

    cleanup();
    const privateNote = { ...note, id: 'no-other-people-note', sharedWith: [] };
    render(
      <ProfileHarness personId="sample-person-avery" initialNotes={[privateNote]} rhythms={[]} />
    );
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    row = screen.getByRole('button', { name: /Open note updated/ }).closest('.person-notes-row');
    expect(row?.querySelector('.person-notes-row__people')).toBeNull();
  });

  it('hides edit pencils and detail edit actions when no update command is available', async () => {
    const user = userEvent.setup();
    const note: PersonNote = {
      id: 'read-only-note',
      personId: 'sample-person-avery',
      content: 'Read only note',
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z'
    };
    render(<ProfileHarness initialNotes={[note]} canEditNotes={false} rhythms={[]} />);
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    const drawer = screen.getByRole('dialog', { name: 'Notes' });
    expect(within(drawer).queryByRole('button', { name: /Edit note updated/ })).toBeNull();
    await user.click(within(drawer).getByRole('button', { name: /Open note updated/ }));
    const detail = screen.getByRole('dialog', { name: 'Note' });
    expect(within(detail).queryByRole('button', { name: 'Edit note' })).toBeNull();
  });

  it('retains failed edit drafts and restores focus after Escape and Cancel', async () => {
    const user = userEvent.setup();
    const sharedNote: PersonNote = {
      id: 'focus-note',
      personId: 'sample-person-avery',
      content: 'Original content',
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-30T12:00:00.000Z'
    };
    render(<ProfileHarness initialNotes={[sharedNote]} rhythms={[]} failNoteUpdates />);
    await user.click(screen.getByRole('button', { name: 'Notes (1)' }));
    const addButton = screen.getByRole('button', { name: /Add note/ });
    await user.click(addButton);
    const addEditor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
    fireEvent(addEditor, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Add note for Avery Brooks' })).toBeNull();
    expect(screen.getByRole('main', { name: 'Avery Brooks' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(addButton));

    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    const detail = screen.getByRole('dialog', { name: 'Note' });
    const editButton = within(detail).getByRole('button', { name: 'Edit note' });
    await user.click(editButton);
    const editor = screen.getByRole('dialog', { name: 'Edit note' });
    const field = within(editor).getByRole('textbox', { name: 'Note' });
    await user.clear(field);
    await user.type(field, 'Unsaved draft remains here');
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    expect(within(editor).getByRole('alert').textContent)
      .toBe('Preview storage changed in another tab. No person note was saved.');
    expect((field as HTMLTextAreaElement).value).toBe('Unsaved draft remains here');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    const returnedEditButton = within(screen.getByRole('dialog', { name: 'Note' }))
      .getByRole('button', { name: 'Edit note' });
    expect(document.activeElement).toBe(returnedEditButton);
    const closeNote = within(screen.getByRole('dialog', { name: 'Note' }))
      .getByRole('button', { name: 'Close note' });
    await user.click(closeNote);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Open note updated/ }));
  });
});

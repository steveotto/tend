import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryAvailabilityProvider } from '../src/components/CategoryAvailabilityContext.tsx';
import { MoneyGoalDialog } from '../src/components/MoneyGoalDialog.tsx';
import { PersonSparkCard } from '../src/components/PersonSparkCard.tsx';
import { TodayView } from '../src/components/TodayView.tsx';
import { TimeBlocksProvider } from '../src/components/TimeBlocksContext.tsx';
import { createFriendshipData } from '../src/domain/friendships.ts';
import type { PersonNote } from '../src/domain/person-notes.ts';
import {
  defaultCategoryPreferences,
  setCategoryPreference
} from '../src/domain/category-availability.ts';
import {
  createPersonSpark,
  deletePersonSpark,
  setPersonSparkArchived,
  updatePersonSpark
} from '../src/domain/person-sparks.ts';
import type { PersonSpark, PersonSparkDraft } from '../src/domain/person-sparks.ts';
import {
  createDefaultTimeBlockSettings
} from '../src/domain/time-blocks.ts';
import {
  createPersonPickerGroups,
  createSamplePeople,
  foundationCatalogue
} from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';
import type { TodayWeatherController } from '../src/components/useTodayWeather.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const today = '2026-11-23';
const people = createSamplePeople();
const peopleGroups = createPersonPickerGroups();
const friendships = createFriendshipData();
const weatherController: TodayWeatherController = {
  city: null,
  weather: { status: 'idle', report: null, fetchedAt: null, message: null },
  search: { status: 'idle', results: [], message: null },
  searchCities: vi.fn(),
  selectCity: vi.fn(),
  clearCity: vi.fn(),
  retry: vi.fn()
};

function makeSpark(id: string, overrides: Partial<PersonSpark> = {}): PersonSpark {
  return {
    id,
    ownerId: people[0]!.id,
    title: `Spark ${id}`,
    sharedWith: [],
    archived: false,
    completed: false,
    completionHistory: [],
    ...overrides
  };
}

function SparksHomeHarness({
  initialSparks,
  createError = '',
  personNotes = [],
  preferences = defaultCategoryPreferences
}: {
  initialSparks: readonly PersonSpark[];
  createError?: string;
  personNotes?: readonly PersonNote[];
  preferences?: typeof defaultCategoryPreferences;
}) {
  const [sparks, setSparks] = useState([...initialSparks]);
  const [connectionDialog, setConnectionDialog] = useState<{ spark: PersonSpark; opener: HTMLButtonElement } | null>(null);
  const sequence = useRef(0);

  function createSpark(ownerId: PersonId, draft: PersonSparkDraft): string | null {
    if (createError) return createError;
    const result = createPersonSpark(sparks, ownerId, draft, `ui-created-${++sequence.current}`);
    if (!result.ok) return result.error;
    setSparks(result.value);
    return null;
  }

  function updateSpark(sparkId: string, draft: PersonSparkDraft): string | null {
    const result = updatePersonSpark(sparks, sparkId, draft, people.map(person => person.id));
    if (!result.ok) return result.error;
    setSparks(result.value);
    return null;
  }

  function deleteSpark(sparkId: string, viewerId: PersonId): string | null {
    const result = deletePersonSpark(sparks, friendships, sparkId, viewerId);
    if (!result.ok) return result.error;
    setSparks(result.value.sparks);
    return null;
  }

  return (
    <CategoryAvailabilityProvider preferences={preferences}>
      <TimeBlocksProvider settings={createDefaultTimeBlockSettings()}>
        <TodayView
          people={people}
          peopleGroups={peopleGroups}
          personSparks={sparks}
          friendships={friendships}
          greeting="Good morning"
          evaluationInstant={new Date(2026, 10, 23, 8, 0)}
          localDate={today}
          view="now"
          onViewChange={vi.fn()}
          weatherController={weatherController}
          completedRhythms={new Set()}
          undoableRhythms={new Set()}
          rhythms={[]}
          rhythmScores={new Map()}
          prayerRequests={[]}
          onPrayForRequest={() => null}
          categoryHealthScores={new Map()}
          onNavigate={vi.fn()}
          onPersonSelect={vi.fn()}
          onCreateSpark={createSpark}
          onUpdateSpark={updateSpark}
          onArchiveSpark={(sparkId, archived) => {
            setSparks(current => setPersonSparkArchived(current, sparkId, archived));
            return null;
          }}
          onDeleteSpark={deleteSpark}
          onUndoSpark={sparkId => {
            setSparks(current => current.map(spark => spark.id === sparkId
              ? {
                  ...spark,
                  completed: false,
                  completionHistory: spark.completionHistory.map(completion => ({
                    ...completion,
                    undone: true
                  }))
                }
              : spark));
            return null;
          }}
          onCompleteSpark={(spark, opener) => setConnectionDialog({ spark, opener })}
          onOpenSparkPerson={vi.fn()}
          foundations={foundationCatalogue}
          onOpenFoundation={vi.fn()}
          onHistory={vi.fn()}
          onTend={vi.fn()}
          onEditRhythm={vi.fn()}
          onUndo={vi.fn()}
        />
        <output data-testid="saved-person-notes">{JSON.stringify(personNotes)}</output>
        {connectionDialog && (
          <MoneyGoalDialog
            title="Log a connection for this Spark"
            titleId="test-spark-connection-title"
            labelledBy="test-spark-connection-title"
            closeLabel="Close Spark connection"
            closeOnEscape
            stopEscapePropagation
            onClose={() => setConnectionDialog(null)}
          >
            <p>{connectionDialog.spark.title}</p>
            <button type="button" onClick={() => setConnectionDialog(null)}>Cancel</button>
          </MoneyGoalDialog>
        )}
      </TimeBlocksProvider>
    </CategoryAvailabilityProvider>
  );
}

describe('shared Spark cards and Home library', () => {
  it('saves Home Add and Edit directly back to Home instead of opening the library', async () => {
    const user = userEvent.setup();
    render(<SparksHomeHarness initialSparks={[]} />);

    const add = screen.getByRole('button', { name: '+ Add Spark' });
    await user.click(add);
    const addDialog = screen.getByRole('dialog', { name: 'Add Spark' });
    await user.type(within(addDialog).getByLabelText('Title'), 'Send a postcard');
    await user.click(within(addDialog).getByRole('button', { name: 'Create Spark' }));
    expect(screen.queryByRole('dialog', { name: 'Add Spark' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Sparks' })).toBeNull();

    const card = screen.getByRole('article', { name: 'Send a postcard' });
    await user.click(within(card).getByRole('button', { name: 'Expand Spark Send a postcard' }));
    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.clear(within(editDialog).getByLabelText('Title'));
    await user.type(within(editDialog).getByLabelText('Title'), 'Send a thank-you postcard');
    await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByRole('dialog', { name: 'Edit Spark' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Sparks' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Send a thank-you postcard' })).toBeTruthy();
  });

  it('retains Add Spark input and people selection after a failed save', async () => {
    const user = userEvent.setup();
    render(<SparksHomeHarness initialSparks={[]} createError="Preview storage changed. No Spark was saved." />);
    await user.click(screen.getByRole('button', { name: '+ Add Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Add Spark' });
    const title = within(editor).getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
    await user.type(title, 'Plan a picnic');
    await user.click(within(editor).getByRole('button', { name: 'Choose people, Avery Brooks' }));
    const picker = screen.getByRole('dialog', { name: 'Choose people' });
    await user.click(within(picker).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Create Spark' }));

    expect(screen.getByRole('dialog', { name: 'Add Spark' })).toBeTruthy();
    expect(title.value).toBe('Plan a picnic');
    expect(within(editor).getByRole('button', {
      name: 'Choose people, Avery Brooks and Morgan Reed'
    })).toBeTruthy();
    expect(within(editor).getByRole('alert').textContent)
      .toBe('Preview storage changed. No Spark was saved.');
    expect(screen.queryByRole('article', { name: 'Plan a picnic' })).toBeNull();
  });

  it('starts compact, expands in place, and keeps Do it outside the disclosure trigger', async () => {
    const user = userEvent.setup();
    const spark = makeSpark('compact', { title: 'A quiet walk' });
    const onComplete = vi.fn();
    const onEdit = vi.fn();
    render(
      <PersonSparkCard
        spark={spark}
        associatedPeople={people.slice(0, 2)}
        today={today}
        onComplete={onComplete}
        onEdit={onEdit}
        onPersonSelect={vi.fn()}
      />
    );

    const disclosure = screen.getByRole('button', { name: 'Expand Spark A quiet walk' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(disclosure.querySelector('button')).toBeNull();
    expect(disclosure.querySelector('.person-spark-card__sparkle')).toBeNull();
    expect(disclosure.querySelector('.person-spark-card__chevron')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Do it' })).toBeNull();
    await user.click(disclosure);

    const card = screen.getByRole('article', { name: 'A quiet walk' });
    expect(within(card).getByRole('button', { name: 'Collapse Spark A quiet walk' })
      .getAttribute('aria-expanded')).toBe('true');
    const titleRow = card.querySelector('.person-spark-card__title-row');
    const associationRow = card.querySelector('.person-spark-card__association-row');
    const actionRow = card.querySelector('.person-spark-card__action-row');
    const peopleRow = card.querySelector('.person-spark-card__people');
    const footer = card.querySelector('.person-spark-card__footer');
    expect(titleRow?.querySelector('.person-spark-card__edit')).toBeNull();
    expect(associationRow?.querySelector('.person-spark-card__edit')).toBeNull();
    expect(within(card).getByText('Someday')).toBeTruthy();
    expect(associationRow?.querySelector('.person-spark-card__do-it')).toBeNull();
    expect(actionRow?.querySelector('.person-spark-card__do-it')).toBeTruthy();
    expect(peopleRow!.compareDocumentPosition(actionRow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).getAllByRole('button', { name: /^Open synthetic profile for/ })).toHaveLength(2);
    expect(Array.from(peopleRow!.querySelectorAll('.person-badge-name')).map(node => node.textContent))
      .toEqual(people.slice(0, 2).map(person => person.displayName.split(' ')[0]));
    expect(footer?.querySelector('.person-spark-card__do-it')).toBeNull();
    expect(footer?.querySelector('.person-spark-card__edit')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /Notes/ })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Do it' }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0]?.[0]).toBe(spark);
    expect(onEdit).not.toHaveBeenCalled();

    await user.click(within(card).getByRole('button', { name: 'Collapse Spark A quiet walk' }));
    expect(within(card).queryByRole('button', { name: 'Do it' })).toBeNull();
  });

  it('keeps the edit control in a compact secondary row when no people are associated', async () => {
    const user = userEvent.setup();
    render(
      <PersonSparkCard
        spark={makeSpark('no-people', { dueDate: '2026-11-30' })}
        associatedPeople={[]}
        today={today}
        onComplete={vi.fn()}
        onEdit={vi.fn()}
        onPersonSelect={vi.fn()}
      />
    );
    const card = screen.getByRole('article', { name: 'Spark no-people' });
    await user.click(within(card).getByRole('button', { name: 'Expand Spark Spark no-people' }));
    const associationRow = card.querySelector('.person-spark-card__association-row');
    expect(associationRow?.classList.contains('person-spark-card__association-row--without-people')).toBe(true);
    expect(associationRow?.querySelector('.person-spark-card__people')).toBeNull();
    expect(within(card).getByRole('button', { name: 'Edit Spark' })).toBeTruthy();
    expect(within(card).getByText('Due Nov 30, 2026')).toBeTruthy();
  });

  it('uses first-name badges and keeps Do it in a separate action row for one or multiple people', async () => {
    const user = userEvent.setup();
    const onPersonSelect = vi.fn();
    const { rerender } = render(
      <PersonSparkCard
        spark={makeSpark('people-layout')}
        associatedPeople={[people[0]!]}
        today={today}
        onComplete={vi.fn()}
        onEdit={vi.fn()}
        onPersonSelect={onPersonSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Expand Spark Spark people-layout' }));
    let card = screen.getByRole('article', { name: 'Spark people-layout' });
    let peopleRow = card.querySelector('.person-spark-card__people');
    let actionRow = card.querySelector('.person-spark-card__action-row');
    expect(peopleRow?.querySelectorAll('.person-badge-name')).toHaveLength(1);
    expect(peopleRow?.querySelector('.person-badge-name')?.textContent)
      .toBe(people[0]!.displayName.split(' ')[0]);
    expect(peopleRow!.compareDocumentPosition(actionRow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(
      <PersonSparkCard
        spark={makeSpark('people-layout')}
        associatedPeople={people.slice(0, 3)}
        today={today}
        onComplete={vi.fn()}
        onEdit={vi.fn()}
        onPersonSelect={onPersonSelect}
      />
    );

    card = screen.getByRole('article', { name: 'Spark people-layout' });
    peopleRow = card.querySelector('.person-spark-card__people');
    actionRow = card.querySelector('.person-spark-card__action-row');
    const badgeNames = Array.from(peopleRow!.querySelectorAll('.person-badge-name'))
      .map(node => node.textContent);
    expect(badgeNames).toEqual(people.slice(0, 3).map(person => person.displayName.split(' ')[0]));
    expect(peopleRow!.compareDocumentPosition(actionRow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows future-only state, opens the full list, creates a due Spark, then clears its date from Edit', async () => {
    const user = userEvent.setup();
    render(<SparksHomeHarness initialSparks={[
      makeSpark('future', { title: 'Plan for next week', dueDate: '2026-11-30' })
    ]} />);

    expect(screen.getByText('Your next Sparks are saved for later.')).toBeTruthy();
    const viewAll = screen.getByRole('button', { name: 'View all' });
    await user.click(viewAll);
    const library = screen.getByRole('dialog', { name: 'Sparks' });
    expect(within(library).getByRole('tab', { name: 'Active (1)' })).toBeTruthy();
    await user.click(within(library).getByRole('button', { name: 'Expand Spark Plan for next week' }));
    expect(within(library).getByText(/Due Nov 30, 2026/)).toBeTruthy();
    await user.click(within(library).getByRole('button', { name: '+ Add Spark' }));

    const addDialog = screen.getByRole('dialog', { name: 'Add Spark' });
    await user.type(within(addDialog).getByLabelText('Title'), 'Meet for lunch');
    fireEvent.change(within(addDialog).getByLabelText('Due date'), { target: { value: today } });
    await user.click(within(addDialog).getByRole('button', { name: 'Create Spark' }));
    expect(within(library).getByRole('tab', { name: 'Active (2)' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Sparks' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(viewAll));
    expect(screen.getByRole('button', { name: 'Expand Spark Meet for lunch' })).toBeTruthy();

    const homeCard = screen.getByRole('article', { name: 'Meet for lunch' });
    await user.click(within(homeCard).getByRole('button', { name: 'Expand Spark Meet for lunch' }));
    await user.click(within(homeCard).getByRole('button', { name: 'Edit Spark' }));
    const editDialog = screen.getByRole('dialog', { name: 'Edit Spark' });
    expect((within(editDialog).getByLabelText('Due date') as HTMLInputElement).value).toBe(today);
    await user.click(within(editDialog).getByRole('button', { name: 'Clear due date' }));
    await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByRole('dialog', { name: 'Edit Spark' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Sparks' })).toBeNull();

    const updatedHomeCard = screen.getByRole('article', { name: 'Meet for lunch' });
    expect(within(updatedHomeCard).getByRole('button', { name: 'Collapse Spark Meet for lunch' }))
      .toBeTruthy();
    expect(within(updatedHomeCard).getByText('Someday')).toBeTruthy();
  });

  it('keeps person notes as independent data and removes Notes from Spark Edit', async () => {
    const user = userEvent.setup();
    const ownerId = people[0]!.id;
    const notes: PersonNote[] = [1, 2].map(index => ({
      id: `spark-owner-note-${index}`,
      personId: ownerId,
      content: `Note ${index}`,
      createdAt: `${today}T12:00:00.000Z`,
      updatedAt: `${today}T12:00:00.000Z`
    }));
    render(<SparksHomeHarness
      initialSparks={[makeSpark('notes-count', { title: 'Write a letter' })]}
      personNotes={notes}
    />);

    const homeCard = screen.getByRole('article', { name: 'Write a letter' });
    await user.click(within(homeCard).getByRole('button', { name: 'Expand Spark Write a letter' }));
    expect(within(homeCard).queryByRole('button', { name: /Notes/ })).toBeNull();
    await user.click(within(homeCard).getByRole('button', { name: 'Edit Spark' }));

    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    expect(within(editor).queryByRole('button', { name: /Notes/ })).toBeNull();
    expect((within(editor).getByLabelText('Description (optional)') as HTMLTextAreaElement).value).toBe('');
    expect(JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]')).toEqual(notes);
  });

  it('uses the shared People chooser and preserves edits until Done and Save', async () => {
    const user = userEvent.setup();
    const firstPerson = people[1]!;
    const secondPerson = people[2]!;
    const spark = makeSpark('shared-people', {
      title: 'Make a shared plan',
      sharedWith: [firstPerson!.id]
    });
    render(<SparksHomeHarness initialSparks={[spark]} />);

    await user.click(screen.getByRole('button', { name: 'View all' }));
    const library = screen.getByRole('dialog', { name: 'Sparks' });
    const card = within(library).getByRole('article', { name: spark.title });
    await user.click(within(card).getByRole('button', { name: `Expand Spark ${spark.title}` }));
    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    expect((within(editor).getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value)
      .toBe(spark.title);
    const peopleRow = within(editor).getByRole('button', { name: /Choose people/ });

    await user.click(peopleRow);
    let picker = screen.getByRole('dialog', { name: 'Choose people' });
    const owner = within(picker).getByRole('button', { name: people[0]!.displayName });
    const selectedFirstPerson = within(picker).getByRole('button', { name: firstPerson!.displayName });
    expect(owner.getAttribute('aria-pressed')).toBe('true');
    expect((owner as HTMLButtonElement).disabled).toBe(true);
    expect(selectedFirstPerson.getAttribute('aria-pressed')).toBe('true');
    await user.click(selectedFirstPerson);
    await user.click(within(picker).getByRole('button', { name: secondPerson!.displayName }));
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(peopleRow.getAttribute('aria-label'))
      .toBe(`Choose people, ${people[0]!.displayName} and ${firstPerson!.displayName}`);

    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit Spark' })).toBeNull();

    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const reopenedEditor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.click(within(reopenedEditor).getByRole('button', { name: /Choose people/ }));
    picker = screen.getByRole('dialog', { name: 'Choose people' });
    expect(within(picker).getByRole('button', { name: people[0]!.displayName }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(within(picker).getByRole('button', { name: firstPerson!.displayName })
      .getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: secondPerson!.displayName }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(reopenedEditor).getByRole('button', { name: 'Save changes' }));
    expect(within(card).getByText(people[0]!.displayName.split(' ')[0]!)).toBeTruthy();
    expect(within(card).getByText(firstPerson!.displayName.split(' ')[0]!)).toBeTruthy();
    expect(within(card).getByText(secondPerson!.displayName.split(' ')[0]!)).toBeTruthy();
  });

  it('keeps Do it, archived restore, and safeguarded deletion behavior without editor management', async () => {
    const user = userEvent.setup();
    const spark = makeSpark('active', { title: 'Call a friend' });
    const archivedSpark = makeSpark('archived', { title: 'An archived idea', archived: true });
    render(<SparksHomeHarness initialSparks={[spark, archivedSpark]} />);
    await user.click(screen.getByRole('button', { name: 'View all' }));
    const library = screen.getByRole('dialog', { name: 'Sparks' });
    const card = within(library).getByRole('article', { name: spark.title });
    await user.click(within(card).getByRole('button', { name: 'Expand Spark Call a friend' }));
    const doIt = within(card).getByRole('button', { name: 'Do it' });
    await user.click(doIt);
    expect(screen.getByRole('dialog', { name: 'Log a connection for this Spark' })).toBeTruthy();
    expect(document.querySelector('.sparks-library-dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'View all' }));
    const activeLibrary = screen.getByRole('dialog', { name: 'Sparks' });
    const activeCard = within(activeLibrary).getByRole('article', { name: spark.title });
    await user.click(within(activeCard).getByRole('button', { name: 'Expand Spark Call a friend' }));
    await user.click(within(activeCard).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    expect(within(editor).queryByText('Manage Spark')).toBeNull();
    expect(within(editor).queryByRole('button', { name: /Archive Spark/ })).toBeNull();
    expect(within(editor).getByRole('button', { name: 'Delete Spark' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    await user.click(within(activeLibrary).getByRole('tab', { name: 'Archived (1)' }));
    const archivedCard = within(activeLibrary).getByRole('article', { name: archivedSpark.title });
    expect(within(archivedCard).getByRole('button', { name: 'Expand Spark An archived idea' })).toBeTruthy();
    await user.click(within(archivedCard).getByRole('button', { name: 'Expand Spark An archived idea' }));
    await user.click(within(archivedCard).getByRole('button', { name: 'Edit Spark' }));
    const archivedEditor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.click(within(archivedEditor).getByRole('button', { name: 'Restore Spark' }));
    expect(within(activeLibrary).getByRole('tab', { name: 'Active (2)' })).toBeTruthy();
    expect(within(activeLibrary).getByRole('tab', { name: 'Archived (0)' })).toBeTruthy();

    const restoredCard = within(activeLibrary).getByRole('article', { name: spark.title });
    await user.click(within(restoredCard).getByRole('button', { name: 'Expand Spark Call a friend' }));
    await user.click(within(restoredCard).getByRole('button', { name: 'Edit Spark' }));
    const restoredEditor = screen.getByRole('dialog', { name: 'Edit Spark' });
    const title = within(restoredEditor).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Unsaved Call a friend');
    await user.click(within(restoredEditor).getByRole('button', { name: 'Delete Spark' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete "Call a friend"?' });
    expect(within(activeLibrary).getByRole('tab', { name: 'Active (2)' })).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(within(restoredEditor).getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Unsaved Call a friend');

    await user.click(within(restoredEditor)
      .getByRole('button', { name: 'Delete Spark' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete "Call a friend"?' }))
      .getByRole('button', { name: 'Delete Spark' }));
    expect(within(activeLibrary).getByRole('tab', { name: 'Active (1)' })).toBeTruthy();
    expect(within(activeLibrary).queryByRole('article', { name: 'Call a friend' })).toBeNull();
  });

  it('hides the Sparks section when every relationship category is unavailable', () => {
    const preferences = setCategoryPreference(defaultCategoryPreferences, 'marriage', false);
    const noCategories = {
      ...preferences,
      parenting: false,
      friendships: false
    };
    render(<SparksHomeHarness initialSparks={[makeSpark('hidden')]} preferences={noCategories} />);
    expect(screen.queryByRole('region', { name: 'Sparks' })).toBeNull();
  });

  it('offers Add Spark when none are active and keeps completion Undo confirmed in the library', async () => {
    const user = userEvent.setup();
    const completed = makeSpark('completed', {
      title: 'Share a memory',
      completed: true,
      completionHistory: [{
        id: 'legacy-completion',
        source: 'legacy',
        date: today,
        completedAt: `${today}T18:00:00.000Z`,
        legacyEventId: 'legacy-completion'
      }]
    });
    render(<SparksHomeHarness initialSparks={[completed]} />);
    const section = screen.getByRole('region', { name: 'Sparks' });
    expect(within(section).getByText('Save an idea for connecting.')).toBeTruthy();
    const addSpark = within(section).getByRole('button', { name: '+ Add Spark' });
    await user.click(addSpark);
    const addDialog = screen.getByRole('dialog', { name: 'Add Spark' });
    await user.click(within(addDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(addSpark));
    expect(screen.queryByRole('dialog', { name: 'Sparks' })).toBeNull();
    await user.click(within(section).getByRole('button', { name: 'View all' }));
    const library = screen.getByRole('dialog', { name: 'Sparks' });
    await user.click(within(library).getByRole('tab', { name: 'Completed (1)' }));
    const card = within(library).getByRole('article', { name: completed.title });
    await user.click(within(card).getByRole('button', { name: `Expand Spark ${completed.title}` }));
    await user.click(within(card).getByRole('button', { name: 'Edit Spark' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Spark' });
    await user.click(within(editor).getByRole('button', { name: 'Undo completion' }));
    const confirmation = screen.getByRole('dialog', { name: 'Undo this Spark completion?' });
    expect(within(confirmation).getByText(/linked connection will be removed/i)).toBeTruthy();
    expect(within(library).getByRole('tab', { name: 'Completed (1)' })).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

    await user.click(within(editor).getByRole('button', { name: 'Undo completion' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Undo this Spark completion?' }))
      .getByRole('button', { name: 'Undo completion' }));
    expect(within(library).getByRole('tab', { name: 'Active (1)' })).toBeTruthy();
    expect(within(library).getByRole('tab', { name: 'Completed (0)' })).toBeTruthy();
    expect(within(library).getByRole('article', { name: completed.title })).toBeTruthy();
  });
});

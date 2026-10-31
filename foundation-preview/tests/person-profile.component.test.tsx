import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonProfileView } from '../src/components/PersonProfileView.tsx';
import { addOrUpdateConnection, createFriendshipData, setFriendCadence } from '../src/domain/friendships.ts';
import type { FriendshipData } from '../src/domain/friendships.ts';
import {
  createPersonNote,
  deletePersonNote,
  updatePersonNote
} from '../src/domain/person-notes.ts';
import type { PersonNote, PersonNoteDraft } from '../src/domain/person-notes.ts';
import {
  createPersonPickerGroups,
  foundationCatalogue,
  setPersonGroupMembership
} from '../src/domain/preview-data.ts';
import type { PersonPickerGroup } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { PersonId } from '../src/domain/preview-data.ts';
import type { RhythmScoreResult } from '../src/domain/rhythm-scoring.ts';

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

function ProfileHarness({
  personId = 'sample-person-avery',
  initialNotes = [],
  failNoteUpdates = false,
  rhythms = [linkedRhythm, otherRhythm],
  archivedRhythms = [],
  initialFriendships = createFriendshipData(),
  completed = false,
  onAddRhythm = vi.fn(),
  onEditRhythm = vi.fn(),
  onRhythmHistory = vi.fn(),
  onTend = vi.fn(),
  onUndo = vi.fn(),
  onRestoreRhythm = vi.fn(),
  onClose = vi.fn(),
  onPeopleGroupsChange = vi.fn()
}: {
  personId?: PersonId;
  initialNotes?: readonly PersonNote[];
  failNoteUpdates?: boolean;
  rhythms?: readonly RhythmPreview[];
  archivedRhythms?: readonly RhythmPreview[];
  initialFriendships?: FriendshipData;
  completed?: boolean;
  onAddRhythm?: (event: ReactMouseEvent<HTMLButtonElement>, personId: PersonId) => void;
  onEditRhythm?: (rhythm: RhythmPreview, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onTend?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onUndo?: (id: string) => void;
  onRestoreRhythm?: (id: string) => void;
  onClose?: () => void;
  onPeopleGroupsChange?: (groups: PersonPickerGroup[]) => void;
}) {
  const [friendships, setFriendships] = useState<FriendshipData>(initialFriendships);
  const [personNotes, setPersonNotes] = useState<PersonNote[]>([...initialNotes]);
  const groups = setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-avery', true);
  return (
    <>
      <PersonProfileView
        personId={personId}
        peopleGroups={groups}
        friendships={friendships}
        today="2026-10-29"
        rhythms={rhythms}
        archivedRhythms={archivedRhythms}
        foundations={foundationCatalogue}
        rhythmScores={new Map([[linkedRhythm.id, score]])}
        completedRhythms={completed ? new Set([linkedRhythm.id]) : new Set()}
        undoableRhythms={completed ? new Set([linkedRhythm.id]) : new Set()}
        onFriendshipsChange={setFriendships}
        onPeopleGroupsChange={onPeopleGroupsChange}
        personNotes={personNotes}
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
        onUpdatePersonNote={(id, expectedUpdatedAt, actorId, draft) => {
          if (failNoteUpdates) return 'Preview storage changed in another tab. No person note was saved.';
          const result = updatePersonNote(
            personNotes, id, expectedUpdatedAt, actorId, draft, '2026-10-31T14:00:00.000Z'
          );
          if (!result.valid) return result.error;
          setPersonNotes(result.notes);
          return null;
        }}
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
  );
}

describe('shared person profile', () => {
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

    expect(screen.getByRole('dialog', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today with Avery Brooks' })).toBeTruthy();
    expect(screen.getByText('Friends')).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Avery and Morgan walk' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Jordan walk' })).toBeNull();
    expect(screen.getByText('Take a walk and talk.')).toBeTruthy();

    const addButton = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(addButton);
    expect(addRhythm).toHaveBeenCalledWith(expect.anything(), 'sample-person-avery');
    const card = screen.getByRole('article', { name: 'Avery and Morgan walk' });
    await user.click(within(card).getByRole('button', { name: 'Tend Avery and Morgan walk' }));
    await user.click(within(card).getByRole('button', { name: 'Edit Avery and Morgan walk' }));
    await user.click(within(card).getByRole('button', { name: /View scores and history for Avery and Morgan walk/ }));
    expect(tend).toHaveBeenCalledOnce();
    expect(editRhythm).toHaveBeenCalledOnce();
    expect(rhythmHistory).toHaveBeenCalledOnce();
  });

  it('uses the profile overflow menu to update the existing People-owned friend classification', async () => {
    const user = userEvent.setup();
    const onPeopleGroupsChange = vi.fn<(groups: PersonPickerGroup[]) => void>();
    render(<ProfileHarness onPeopleGroupsChange={onPeopleGroupsChange} />);
    await user.click(screen.getByLabelText('More actions for Avery Brooks'));
    await user.click(screen.getByRole('button', { name: 'Remove friend' }));
    expect(onPeopleGroupsChange).toHaveBeenCalledOnce();
    expect(onPeopleGroupsChange.mock.calls[0]?.[0].find(group => group.id === 'friends')?.memberIds)
      .not.toContain('sample-person-avery');
  });

  it('retains shared Undo behavior for a completed person-linked Rhythm', async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    render(<ProfileHarness completed onUndo={undo} />);
    const card = screen.getByRole('article', { name: 'Avery and Morgan walk' });
    await user.click(within(card).getByRole('button', { name: 'Undo completion for Avery and Morgan walk' }));
    expect(undo).toHaveBeenCalledWith(linkedRhythm.id);
  });

  it('opens the Add Rhythm callback with one Person ID and retains empty Category/Foundation associations', async () => {
    const user = userEvent.setup();
    const addRhythm = vi.fn();
    render(<ProfileHarness rhythms={[]} onAddRhythm={addRhythm} />);
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    expect(addRhythm.mock.calls[0]?.[1]).toBe('sample-person-avery');
    expect(screen.getByText('No Rhythms yet.')).toBeTruthy();
  });

  it('opens connection drafts with the person and selected type, and Cancel stores no event', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness rhythms={[]} />);
    await user.click(screen.getByRole('tab', { name: 'Connections' }));

    const callOpener = screen.getByRole('button', { name: 'Call Avery Brooks' });
    await user.click(callOpener);
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    expect((within(editor).getByLabelText('Connection type') as HTMLSelectElement).value).toBe('call');
    expect((within(editor).getAllByRole('checkbox') as HTMLInputElement[]).map(input => input.checked))
      .toEqual([true, false, false]);
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(callOpener);
    expect(screen.getByText('No connections yet.')).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('saved-connections').textContent ?? '{}').connections).toEqual([]);
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
            onFriendshipsChange={setFriendships}
            onPeopleGroupsChange={vi.fn()}
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
    await user.click(screen.getByRole('button', { name: 'Text Avery Brooks' }));
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    await user.click(within(editor).getAllByRole('checkbox')[1]!);
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));

    const stored = JSON.parse(screen.getByTestId('connection-state').textContent ?? '{}') as FriendshipData;
    expect(stored.connections).toHaveLength(1);
    expect(stored.connections[0]?.participantIds).toEqual(['sample-person-avery', 'sample-person-morgan']);
    expect(screen.getByRole('button', { name: 'Text Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Change connection cadence for Avery Brooks/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Change connection cadence for Avery Brooks/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Connection cadence · Avery Brooks' }))
      .getByRole('button', { name: 'Weekly' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit connection' });
    await user.click(within(edit).getAllByRole('checkbox')[0]!);
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('No connections yet.')).toBeTruthy();
    const edited = JSON.parse(screen.getByTestId('connection-state').textContent ?? '{}') as FriendshipData;
    expect(edited.connections).toHaveLength(1);
    expect(edited.connections[0]?.participantIds).toEqual(['sample-person-morgan']);
    expect(edited.cadenceSettings).toHaveLength(1);
    expect(edited.cadenceSettings[0]?.cadence).toBe('weekly');
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
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirmation = screen.getByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Delete connection' }));
    expect(screen.getByText('No connections yet.')).toBeTruthy();
    const updated = JSON.parse(screen.getByTestId('saved-connections').textContent ?? '{}') as FriendshipData;
    expect(updated.connections).toEqual([]);
    expect(updated.cadenceSettings).toEqual(data.cadenceSettings);
  });

  it('supports keyboard tab movement and Escape close', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<ProfileHarness rhythms={[]} onClose={close} />);
    const dialog = screen.getByRole('dialog', { name: 'Avery Brooks' });
    const rhythmsTab = screen.getByRole('tab', { name: 'Rhythms' });
    expect(rhythmsTab.getAttribute('aria-controls')).toBe('person-profile-panel-rhythms');
    expect(screen.getByRole('tabpanel', { name: 'Rhythms' })).toBeTruthy();
    rhythmsTab.focus();
    await user.keyboard('{ArrowRight}');
    const connectionsTab = screen.getByRole('tab', { name: 'Connections' });
    expect(document.activeElement).toBe(connectionsTab);
    expect(connectionsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    const notesTab = screen.getByRole('tab', { name: 'Notes' });
    expect(document.activeElement).toBe(notesTab);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(connectionsTab);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(rhythmsTab);
    expect(rhythmsTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(notesTab);
    expect(notesTab.getAttribute('aria-selected')).toBe('true');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('creates, shares, edits and deletes a plain-text note through the shared profile', async () => {
    const user = userEvent.setup();
    render(<ProfileHarness rhythms={[]} />);
    const profileTabs = screen.getByRole('tablist', { name: 'Avery Brooks profile' });
    const notesTab = within(profileTabs).getByRole('tab', { name: 'Notes' });
    await user.click(notesTab);
    expect(notesTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByText('No notes yet. Add a note to keep something meaningful in view.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notes (0)' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add note' }));
    const editor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
    const noteField = within(editor).getByRole('textbox', { name: 'Note' });
    await user.click(within(editor).getByRole('button', { name: 'Save note' }));
    expect(within(editor).getByText('Write something before saving this note.')).toBeTruthy();
    await user.type(noteField, 'First line{Enter}<script>plain text</script>');
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Share note' });
    expect(within(picker).queryByRole('button', { name: 'Avery Brooks' })).toBeNull();
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
    expect(screen.getByRole('heading', { name: 'Notes (1)' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    const detail = screen.getByRole('dialog', { name: 'Note' });
    expect(within(detail).getByText((_content, element) =>
      element?.textContent === 'First line\n<script>plain text</script>'
    )).toBeTruthy();
    expect(within(detail).queryByRole('script')).toBeNull();
    expect(within(detail).getByText('Shared with Morgan Reed')).toBeTruthy();
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
    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByRole('heading', { name: 'Notes (1)' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Open note updated/ }));
    expect(screen.getByText(/Primary person: Avery Brooks/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit note' }));
    const editor = screen.getByRole('dialog', { name: 'Edit note' });
    expect(within(editor).getByText('Primary person: Avery Brooks. Ownership stays with them.')).toBeTruthy();
    await user.clear(within(editor).getByRole('textbox', { name: 'Note' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Note' }), 'Updated from Morgan');
    await user.click(within(editor).getByRole('button', { name: 'Choose people' }));
    const picker = screen.getByRole('dialog', { name: 'Share note' });
    expect(within(picker).queryByRole('button', { name: 'Avery Brooks' })).toBeNull();
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }));
    const stored = JSON.parse(screen.getByTestId('saved-person-notes').textContent ?? '[]') as PersonNote[];
    expect(stored).toEqual([{
      ...sharedNote,
      content: 'Updated from Morgan',
      updatedAt: '2026-10-31T14:00:00.000Z'
    }]);
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
    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    const addButton = screen.getByRole('button', { name: 'Add note' });
    await user.click(addButton);
    const addEditor = screen.getByRole('dialog', { name: 'Add note for Avery Brooks' });
    fireEvent(addEditor, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Add note for Avery Brooks' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Avery Brooks' })).toBeTruthy();
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
    expect(document.activeElement).toBe(editButton);
    const closeNote = within(detail).getByRole('button', { name: 'Close note' });
    await user.click(closeNote);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Open note updated/ }));
  });
});

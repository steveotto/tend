import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FriendshipsView } from '../src/components/FriendshipsView.tsx';
import { addOrUpdateConnection, createFriendshipData, setFriendCadence } from '../src/domain/friendships.ts';
import type { FriendshipData } from '../src/domain/friendships.ts';
import { foundationCatalogue, createPersonPickerGroups, setPersonGroupMembership } from '../src/domain/preview-data.ts';
import type { PersonId, PersonPickerGroup, RhythmPreview } from '../src/domain/preview-data.ts';
import { PeopleView } from '../src/components/PeopleView.tsx';
import type { RhythmScoreResult } from '../src/domain/rhythm-scoring.ts';

afterEach(cleanup);

const zeroHealthScore: RhythmScoreResult = {
  kind: 'rhythm-score',
  asOfDate: '2026-10-21',
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

function FriendshipsHarness({
  initialData = createFriendshipData(),
  initialGroups = setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-morgan', true),
  onPersonSelect = vi.fn(),
  onGoToPeople = vi.fn(),
  rhythms = [],
  onEditRhythm = vi.fn(),
  onRhythmHistory = vi.fn(),
  onTend = vi.fn(),
  rhythmScores = new Map<string, RhythmScoreResult>()
}: {
  initialData?: FriendshipData;
  initialGroups?: PersonPickerGroup[];
  onPersonSelect?: (personId: PersonId) => void;
  onGoToPeople?: () => void;
  rhythms?: readonly RhythmPreview[];
  onEditRhythm?: (rhythm: RhythmPreview, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRhythmHistory?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onTend?: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  rhythmScores?: ReadonlyMap<string, RhythmScoreResult>;
}) {
  const [data, setData] = useState(initialData);
  const [peopleGroups] = useState(initialGroups);
  return (
    <FriendshipsView
      data={data}
      peopleGroups={peopleGroups}
      today="2026-10-21"
      rhythms={rhythms}
      archivedRhythms={[]}
      foundations={foundationCatalogue}
      rhythmScores={rhythmScores}
      completedRhythms={new Set()}
      undoableRhythms={new Set()}
      onChange={setData}
      onAddRhythm={vi.fn()}
      onEditRhythm={onEditRhythm}
      onRhythmHistory={onRhythmHistory}
      onTend={onTend}
      onUndo={vi.fn()}
      onPersonSelect={onPersonSelect}
      onGoToPeople={onGoToPeople}
      onRestoreRhythm={vi.fn()}
      onOpenFoundation={vi.fn()}
      onOpenCategory={vi.fn()}
    />
  );
}

describe('Friendships view', () => {
  it('projects People friend categorization into Friends while preserving cadence and shared history', async () => {
    const user = userEvent.setup();
    const initialData = addOrUpdateConnection(
      setFriendCadence(createFriendshipData(), 'sample-person-morgan', 'weekly', '2026-10-01'),
      {
        id: 'preserved-shared-event',
        type: 'call',
        date: '2026-10-10',
        participantIds: ['sample-person-morgan', 'sample-person-avery']
      }
    );
    function IntegratedHarness() {
      const [peopleGroups, setPeopleGroups] = useState(createPersonPickerGroups());
      const [data, setData] = useState(initialData);
      return (
        <>
          <PeopleView groups={peopleGroups} onChangeGroups={setPeopleGroups} onOpenPerson={vi.fn()} />
          <FriendshipsView
            data={data}
            peopleGroups={peopleGroups}
            today="2026-10-21"
            rhythms={[]}
            archivedRhythms={[]}
            foundations={foundationCatalogue}
            rhythmScores={new Map()}
            completedRhythms={new Set()}
            undoableRhythms={new Set()}
            onChange={setData}
            onAddRhythm={vi.fn()}
            onEditRhythm={vi.fn()}
            onRhythmHistory={vi.fn()}
            onTend={vi.fn()}
            onUndo={vi.fn()}
            onPersonSelect={vi.fn()}
            onGoToPeople={vi.fn()}
            onRestoreRhythm={vi.fn()}
            onOpenFoundation={vi.fn()}
            onOpenCategory={vi.fn()}
          />
        </>
      );
    }

    render(<IntegratedHarness />);
    await user.click(screen.getByRole('button', { name: 'Mark Morgan Reed as a friend' }));
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    expect(screen.getByRole('button', { name: 'View connections (1)' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove Morgan Reed as a friend' }));
    expect(screen.queryByRole('button', { name: 'Text Morgan Reed' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark Morgan Reed as a friend' }));
    expect(screen.getByRole('button', { name: 'View connections (1)' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'View connections (1)' }));
    const history = screen.getByRole('dialog', { name: 'Morgan Reed · connection history' });
    expect(within(history).getByText('Call')).toBeTruthy();
  });

  it('keeps the empty states distinct and implements accessible tab keyboard navigation', async () => {
    const user = userEvent.setup();
    const onPersonSelect = vi.fn();
    const onGoToPeople = vi.fn();
    render(
      <FriendshipsHarness
        initialGroups={createPersonPickerGroups()}
        onPersonSelect={onPersonSelect}
        onGoToPeople={onGoToPeople}
      />
    );
    const todayTab = screen.getByRole('tab', { name: 'Today' });
    const friendsTab = screen.getByRole('tab', { name: 'Friends' });

    expect(todayTab.getAttribute('aria-selected')).toBe('true');
    expect(todayTab.getAttribute('tabindex')).toBe('0');
    expect(within(screen.getByRole('tabpanel', { name: 'Today' })).getByText('No friends yet.')).toBeTruthy();

    await user.click(friendsTab);
    const friendsPanel = screen.getByRole('tabpanel', { name: 'Friends' });
    expect(within(friendsPanel).getByText('Add people and mark them as friends.')).toBeTruthy();
    await user.click(within(friendsPanel).getByRole('button', { name: 'Go to People' }));
    expect(onGoToPeople).toHaveBeenCalledOnce();

    expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true');

    todayTab.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('tab', { name: 'Rhythms' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(todayTab);
    expect(todayTab.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rhythms' }));
  });

  it('sets cadence, logs one shared connection for actual participants, and updates history and due status on edit/delete', async () => {
    const user = userEvent.setup();
    render(<FriendshipsHarness />);

    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    await user.click(screen.getByRole('button', { name: /Change connection cadence for Morgan Reed/ }));
    const cadenceDialog = screen.getByRole('dialog', { name: 'Connection cadence · Morgan Reed' });
    await user.click(within(cadenceDialog).getByRole('button', { name: 'Weekly' }));

    await user.click(screen.getByRole('button', { name: 'Call Morgan Reed' }));
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    expect((within(editor).getByLabelText('Connection type') as HTMLSelectElement).value).toBe('call');
    await user.type(within(editor).getByLabelText('Time (optional)'), '10:15');
    await user.type(within(editor).getByLabelText('Notes (optional)'), 'Talked about the weekend.');
    const participantCheckboxes = within(editor).getAllByRole('checkbox');
    expect(participantCheckboxes).toHaveLength(3);
    expect((participantCheckboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((participantCheckboxes[1] as HTMLInputElement).checked).toBe(true);
    await user.click(participantCheckboxes[0]!);
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));

    await user.click(screen.getByRole('button', { name: 'View connections (1)' }));
    const history = screen.getByRole('dialog', { name: 'Morgan Reed · connection history' });
    expect(within(history).getByText('Call')).toBeTruthy();
    expect(within(history).getByText('Avery')).toBeTruthy();
    expect(within(history).getByText('Morgan')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Details' }));
    expect(within(history).getByText('Talked about the weekend.')).toBeTruthy();

    await user.click(within(history).getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit connection' });
    await user.clear(within(edit).getByLabelText('Date'));
    await user.type(within(edit).getByLabelText('Date'), '2026-10-14');
    await user.clear(within(edit).getByLabelText('Time (optional)'));
    await user.clear(within(edit).getByLabelText('Notes (optional)'));
    await user.click(within(edit).getAllByRole('checkbox')[0]!);
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    expect(document.activeElement).toBe(within(history).getByRole('button', { name: 'Edit' }));
    expect(within(history).queryByText('Avery')).toBeNull();
    expect(within(history).getByText('No notes.')).toBeTruthy();
    expect(within(history).queryByText('10:15 AM')).toBeNull();

    await user.click(within(history).getByRole('button', { name: 'Close connection history' }));
    await user.click(screen.getByRole('tab', { name: 'Today' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Today' })).getByText('Last connected Oct 14')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log connection' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    await user.click(screen.getByRole('button', { name: 'View connections (1)' }));
    const historyAfterEdit = screen.getByRole('dialog', { name: 'Morgan Reed · connection history' });
    await user.click(within(historyAfterEdit).getByRole('button', { name: 'Delete' }));
    const confirmation = within(historyAfterEdit).getByRole('alertdialog');
    await user.click(within(confirmation).getByRole('button', { name: 'Delete connection' }));
    expect(within(historyAfterEdit).queryByText('Call')).toBeNull();
    expect(document.activeElement).toBe(within(historyAfterEdit).getByRole('button', { name: 'Close connection history' }));
    expect(within(historyAfterEdit).getByText('No connections yet.')).toBeTruthy();
    await user.click(within(historyAfterEdit).getByRole('button', { name: 'Close connection history' }));
    await user.click(screen.getByRole('tab', { name: 'Today' }));
    expect(screen.getByText('You’re caught up.')).toBeTruthy();
  });

  it('cancels or escapes the editor without creating a connection and restores opener focus', async () => {
    const user = userEvent.setup();
    render(<FriendshipsHarness />);
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    const opener = screen.getByRole('button', { name: 'Text Morgan Reed' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Log connection' })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(screen.getByRole('button', { name: 'View connections' })).toBeTruthy();

    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log connection' });
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Log connection' })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(screen.getByRole('button', { name: 'View connections' })).toBeTruthy();
  });

  it('opens each quick connection action as an uncommitted draft with only that friend preselected', async () => {
    const user = userEvent.setup();
    render(<FriendshipsHarness />);
    await user.click(screen.getByRole('tab', { name: 'Friends' }));

    for (const [label, type] of [['Text', 'text'], ['Call', 'call'], ['Time Together', 'time-together']] as const) {
      const opener = screen.getByRole('button', { name: `${label} Morgan Reed` });
      await user.click(opener);
      const dialog = screen.getByRole('dialog', { name: 'Log connection' });
      expect((within(dialog).getByLabelText('Connection type') as HTMLSelectElement).value).toBe(type);
      const participants = within(dialog).getAllByRole('checkbox') as HTMLInputElement[];
      expect(participants.map(input => input.checked)).toEqual([false, true, false]);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(document.activeElement).toBe(opener);
      expect(screen.getByRole('button', { name: 'View connections' })).toBeTruthy();
    }
  });

  it('keeps an invalid connection draft open and creates no event until participants are selected', async () => {
    const user = userEvent.setup();
    render(<FriendshipsHarness />);
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    const opener = screen.getByRole('button', { name: 'Text Morgan Reed' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Log connection' });
    await user.click(within(dialog).getAllByRole('checkbox')[1]!);
    await user.click(within(dialog).getByRole('button', { name: 'Save connection' }));
    expect(within(dialog).getByRole('alert').textContent).toContain('Choose at least one participant.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
    expect(screen.getByRole('button', { name: 'View connections' })).toBeTruthy();
  });

  it('offers the full cadence set and clears cadence without removing connection history', async () => {
    const user = userEvent.setup();
    const initialData = addOrUpdateConnection(
      setFriendCadence(createFriendshipData(), 'sample-person-morgan', 'weekly', '2026-10-01'),
      {
        id: 'cadence-preserves-history',
        type: 'text',
        date: '2026-10-10',
        participantIds: ['sample-person-morgan']
      }
    );
    render(<FriendshipsHarness initialData={initialData} />);
    await user.click(screen.getByRole('tab', { name: 'Friends' }));

    const cadenceButton = screen.getByRole('button', { name: /Change connection cadence for Morgan Reed/ });
    await user.click(cadenceButton);
    const dialog = screen.getByRole('dialog', { name: 'Connection cadence · Morgan Reed' });
    for (const label of ['Daily', 'Weekly', 'Every two weeks', 'Monthly', 'No cadence']) {
      expect(within(dialog).getByRole('button', { name: label })).toBeTruthy();
    }
    await user.click(within(dialog).getByRole('button', { name: 'Monthly' }));
    expect(document.activeElement).toBe(cadenceButton);
    await user.click(cadenceButton);
    await user.click(within(screen.getByRole('dialog', { name: 'Connection cadence · Morgan Reed' }))
      .getByRole('button', { name: 'No cadence' }));

    expect(screen.getByRole('button', { name: /Current: No cadence/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'View connections (1)' }));
    const history = screen.getByRole('dialog', { name: 'Morgan Reed · connection history' });
    expect(within(history).getByText('Text')).toBeTruthy();
  });

  it('moves focus to the selected tab when saving removes the due-row opener', async () => {
    const user = userEvent.setup();
    const initialData = setFriendCadence(
      createFriendshipData(),
      'sample-person-morgan',
      'daily',
      '2026-10-19'
    );
    render(<FriendshipsHarness
      initialData={initialData}
      initialGroups={setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-morgan', true)}
    />);
    const opener = screen.getByRole('button', { name: 'Log connection' });
    await user.click(opener);
    const editor = screen.getByRole('dialog', { name: 'Log connection' });
    await user.click(within(editor).getByRole('button', { name: 'Save connection' }));

    expect(screen.getByText('You’re caught up.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Today' }));
  });

  it('keeps active Friendship Rhythms in the shared card flow', async () => {
    const user = userEvent.setup();
    const addRhythm = vi.fn();
    const editRhythm = vi.fn();
    const rhythmHistory = vi.fn();
    const tend = vi.fn();
    const restoreRhythm = vi.fn();
    const groups = setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-morgan', true);
    const rhythm: RhythmPreview = {
      id: 'user-rhythm-77777777-7777-4777-8777-777777777777',
      title: 'Monthly breakfast',
      description: 'Share breakfast and conversation.',
      automation: 'manual',
      status: 'Not confirmed',
      cadence: 'Monthly',
      categoryIds: ['friendships', 'marriage'],
      primaryFoundationId: 'marriage-connection',
      personIds: ['sample-person-morgan']
    };
    const archivedRhythm: RhythmPreview = {
      ...rhythm,
      id: 'user-rhythm-88888888-8888-4888-8888-888888888888',
      title: 'Archived breakfast'
    };
    function RhythmHarness() {
      return (
        <FriendshipsView
          data={createFriendshipData()}
          peopleGroups={groups}
          today="2026-10-21"
          rhythms={[rhythm]}
          archivedRhythms={[archivedRhythm]}
          foundations={foundationCatalogue}
          rhythmScores={new Map([[rhythm.id, zeroHealthScore]])}
          completedRhythms={new Set()}
          undoableRhythms={new Set()}
          onChange={vi.fn()}
          onAddRhythm={addRhythm}
          onEditRhythm={editRhythm}
          onRhythmHistory={rhythmHistory}
          onTend={tend}
          onUndo={vi.fn()}
          onPersonSelect={vi.fn()}
          onGoToPeople={vi.fn()}
          onRestoreRhythm={restoreRhythm}
          onOpenFoundation={vi.fn()}
          onOpenCategory={vi.fn()}
        />
      );
    }

    render(<RhythmHarness />);
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByText('Monthly breakfast')).toBeTruthy();
    expect(screen.getByText('Share breakfast and conversation.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Associations for Monthly breakfast' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open synthetic profile for Morgan Reed' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marriage/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View scores and history for Monthly breakfast, Health 0 out of 100' }).textContent).toContain('0');
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tend Monthly breakfast' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    expect(addRhythm).toHaveBeenCalledOnce();
    expect(screen.queryByText('No active Rhythms yet.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit Monthly breakfast' }));
    expect(editRhythm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Tend Monthly breakfast' }));
    expect(tend).toHaveBeenCalledWith(rhythm.id, expect.anything());
    await user.click(screen.getByRole('button', { name: 'View scores and history for Monthly breakfast, Health 0 out of 100' }));
    expect(rhythmHistory).toHaveBeenCalledWith(rhythm.id, expect.anything());
    await user.click(screen.getByRole('button', { name: 'Archived rhythms (1)' }));
    const archiveDialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    await user.click(within(archiveDialog).getByRole('button', { name: 'Restore rhythm Archived breakfast' }));
    expect(restoreRhythm).toHaveBeenCalledWith(archivedRhythm.id);
  });
});

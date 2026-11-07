import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FriendshipsView } from '../src/components/FriendshipsView.tsx';
import { addOrUpdateConnection, createFriendshipData, setFriendCadence } from '../src/domain/friendships.ts';
import type { FriendshipData } from '../src/domain/friendships.ts';
import type { PersonDetails } from '../src/domain/person-details.ts';
import { foundationCatalogue, createPersonPickerGroups, setPersonGroupMembership } from '../src/domain/preview-data.ts';
import type { PersonId, PersonPickerGroup, RhythmPreview } from '../src/domain/preview-data.ts';
import { PeopleView } from '../src/components/PeopleView.tsx';
import { PeopleCard } from '../src/components/PeopleCard.tsx';
import type { RhythmScoreResult } from '../src/domain/rhythm-scoring.ts';
import { syntheticPeople } from '../src/domain/preview-data.ts';

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
  personDetails = [],
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
  personDetails?: readonly PersonDetails[];
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
      personDetails={personDetails}
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
  it('uses one card-wide keyboard target and keeps quick actions outside profile navigation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PeopleCard
        person={{ ...syntheticPeople[0]!, displayName: 'Alexandria Brooks-Williams' }}
        classifications={[]}
        birthday={{ dateLabel: 'December 2', countdownLabel: 'in 32d', age: 47 }}
        onSelect={onSelect}
      >
        <button type="button" onClick={vi.fn()}>Log a connection</button>
      </PeopleCard>
    );
    const navigation = screen.getByRole('button', { name: 'Open profile for Alexandria Brooks-Williams' });
    expect(navigation.querySelector('.people-card__menu')).toBeNull();
    expect(screen.queryByLabelText('More actions for Alexandria Brooks-Williams')).toBeNull();
    expect(within(navigation).getByText('Age 47').tagName).toBe('STRONG');
    expect(within(navigation).getByText('December 2')).toBeTruthy();
    expect(within(navigation).getByText('in 32d')).toBeTruthy();
    expect(navigation.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    await user.tab();
    expect(document.activeElement).toBe(navigation);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(syntheticPeople[0]!.id);
    await user.click(screen.getByRole('button', { name: 'Log a connection' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('aligns multiple classifications beside recency without squeezing a long person name', () => {
    const person = {
      ...syntheticPeople[0]!,
      displayName: 'Alexandria Brooks-Williams'
    };
    render(
      <PeopleCard
        person={person}
        classifications={[
          { id: 'marriage', label: 'Marriage' },
          { id: 'parenting', label: 'Parenting' },
          { id: 'friends', label: 'Friends' }
        ]}
        connectionRecency="Connected 3 wk ago"
        onSelect={vi.fn()}
      />
    );
    const identity = screen.getByRole('button', { name: 'Open profile for Alexandria Brooks-Williams' });
    const metadataRow = identity.querySelector<HTMLElement>('.people-card__meta-row')!;
    expect(within(metadataRow).getByText('Connected 3 wk ago')).toBeTruthy();
    expect(within(metadataRow).getByRole('group', {
      name: 'Alexandria Brooks-Williams classifications'
    }).textContent).toContain('MarriageParentingFriends');
    expect(within(identity).getByText('Alexandria Brooks-Williams')).toBeTruthy();
  });

  it('renders only supported People details and filters by explicit classifications', async () => {
    const user = userEvent.setup();
    const openPerson = vi.fn();
    render(
      <PeopleView
        groups={createPersonPickerGroups()}
        friendships={createFriendshipData()}
        today="2025-02-28"
        personDetails={[{
          personId: 'sample-person-avery',
          relationshipLabel: 'Sister',
          birthday: { monthDay: '02-29' }
        }]}
        onOpenPerson={openPerson}
      />
    );

    expect(screen.getAllByRole('button', { name: /^Open profile for/ })).toHaveLength(3);
    const avery = screen.getByRole('button', { name: 'Open profile for Avery Brooks' });
    expect(within(avery).getByLabelText('Person score unavailable').textContent).toBe('—');
    expect(within(avery).getByText('Score unavailable')).toBeTruthy();
    expect(within(avery).queryByText('Needs attention')).toBeNull();
    expect(within(avery).getByText('March 1')).toBeTruthy();
    expect(within(avery).queryByText(/^Age/)).toBeNull();
    await user.click(avery);
    expect(openPerson).toHaveBeenCalledWith('sample-person-avery');

    await user.click(screen.getByRole('button', { name: 'Marriage' }));
    expect(screen.getAllByRole('button', { name: /^Open profile for/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Open profile for Jordan Bell' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('button', { name: /^Open profile for/ })).toHaveLength(3);
  });

  it('uses shared Person details on Friendship cards without changing classifications', async () => {
    const user = userEvent.setup();
    const groups = setPersonGroupMembership(
      createPersonPickerGroups(),
      'friends',
      'sample-person-avery',
      true
    );
    render(
      <FriendshipsHarness
        initialGroups={groups}
        personDetails={[{
          personId: 'sample-person-avery',
          relationshipLabel: 'A lifelong friend',
          birthday: { monthDay: '10-22' }
        }]}
      />
    );
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    const row = screen.getByRole('article').closest('.friendships-friend-row');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('A lifelong friend')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('October 22')).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('group', { name: 'Avery Brooks classifications' })).toBeTruthy();
  });

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
      const peopleGroups = setPersonGroupMembership(
        createPersonPickerGroups(),
        'friends',
        'sample-person-morgan',
        true
      );
      const [data, setData] = useState(initialData);
      return (
        <>
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
    await user.click(screen.getByRole('tab', { name: 'Friends' }));
    const morganProfileLink = screen.getByRole('button', { name: 'Open profile for Morgan Reed' });
    const morganCard = morganProfileLink.closest('article');
    expect(morganCard).toBeTruthy();
    expect(morganCard!.querySelector('.people-card__menu')).toBeNull();
    expect(within(morganCard as HTMLElement).getByRole('combobox', { name: 'Connection cadence: Weekly' })).toBeTruthy();
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
    await user.click(screen.getByRole('combobox', { name: 'Connection cadence: No cadence' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Connection cadence' })).getByRole('option', { name: 'Weekly' }));

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

    const cadenceButton = screen.getByRole('combobox', { name: 'Connection cadence: Weekly' });
    await user.click(cadenceButton);
    const listbox = screen.getByRole('listbox', { name: 'Connection cadence' });
    for (const label of ['No cadence', 'Daily', 'Twice weekly', 'Weekly', 'Every 2 weeks', 'Monthly']) {
      expect(within(listbox).getByRole('option', { name: label })).toBeTruthy();
    }
    await user.click(within(listbox).getByRole('option', { name: 'Monthly' }));
    expect(document.activeElement).toBe(cadenceButton);
    await user.click(cadenceButton);
    await user.click(within(screen.getByRole('listbox', { name: 'Connection cadence' })).getByRole('option', { name: 'No cadence' }));

    expect(screen.getByRole('combobox', { name: 'Connection cadence: No cadence' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'View connections (1)' }));
    const history = screen.getByRole('dialog', { name: 'Morgan Reed · connection history' });
    expect(within(history).getByText('Text')).toBeTruthy();
  });

  it('shows unmet Twice weekly progress in the attention list without a due-date claim', () => {
    const data = setFriendCadence(createFriendshipData(), 'sample-person-morgan', 'twice-weekly', '2026-10-19');
    render(<FriendshipsHarness
      initialData={data}
      initialGroups={setPersonGroupMembership(createPersonPickerGroups(), 'friends', 'sample-person-morgan', true)}
    />);
    expect(screen.getByText('0 of 2 days this week')).toBeTruthy();
    expect(screen.queryByText(/overdue|next due/i)).toBeNull();
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
    expect(editRhythm).toHaveBeenCalledWith(rhythm, expect.anything());
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

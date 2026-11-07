import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonDetailsEditor } from '../src/components/PersonDetailsEditor.tsx';
import type { PersonDetailsDraft } from '../src/domain/person-details.ts';
import { compressPersonPhoto } from '../src/components/person-photo.ts';

vi.mock('../src/components/person-photo.ts', () => ({
  compressPersonPhoto: vi.fn()
}));

afterEach(cleanup);

const replacementPhoto = 'data:image/jpeg;base64,/9j/2Q==';
const originalPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function renderEditor(
  onSave = vi.fn<(draft: PersonDetailsDraft) => string | null>(() => null),
  onClose = vi.fn(),
  options: {
    categoryIds?: ('marriage' | 'parenting' | 'friends')[];
    cadence?: 'daily' | 'weekly' | 'two-weeks' | 'monthly';
    details?: React.ComponentProps<typeof PersonDetailsEditor>['details'];
  } = {}
) {
  const result = render(
    <PersonDetailsEditor
      personId="sample-person-avery"
      personName="Avery Brooks"
      details={options.details ?? { personId: 'sample-person-avery', photoDataUrl: originalPhoto }}
      today="2026-10-31"
      cadence={options.cadence ?? 'weekly'}
      categoryIds={options.categoryIds ?? ['friends']}
      onSave={onSave}
      onClose={onClose}
    />
  );
  return { ...result, onSave, onClose };
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  label: string,
  option: string
) {
  const trigger = within(dialog).getByRole('combobox', { name: new RegExp(`^${label}:`) });
  await user.click(trigger);
  await user.click(within(dialog).getByRole('option', { name: option }));
}

describe('shared Person settings editor', () => {
  it('keeps the resolved category and preserves unrelated details', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), {
      categoryIds: ['marriage', 'friends'],
      details: {
        personId: 'sample-person-avery',
        relationshipLabel: 'Spouse',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-02' }
      }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect(dialog.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Close Person settings' })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Category: Marriage' })).toBeTruthy();
    expect((within(dialog).getByLabelText('Birthday') as HTMLInputElement).value).toBe('Feb 29');
    expect((within(dialog).getByLabelText('Anniversary') as HTMLInputElement).value).toBe('Dec 2');
    expect(within(dialog).getAllByText(/Clear the saved partial date/)).toHaveLength(2);
    expect(within(dialog).queryByText('Year unknown')).toBeNull();
    expect(within(dialog).getByRole('combobox', { name: 'Relationship: Spouse' })).toBeTruthy();
    expect(dialog.querySelector('.money-goal-dialog__intro')?.textContent).toBe('Spouse');

    await chooseOption(user, dialog, 'Love language', 'Words of Affirmation');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['marriage', 'friends'],
      categoryChanged: false,
      birthdayDate: '02-29',
      birthdayYearUnknown: true,
      anniversaryDate: '12-02',
      anniversaryYearUnknown: true,
      connectionStyle: 'wa'
    }));
  });

  it('replaces multiple memberships only after an explicit selection and stages Not set', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    renderEditor(onSave, onClose, { categoryIds: ['marriage', 'parenting', 'friends'] });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await chooseOption(user, dialog, 'Category', 'Parenting');
    expect(within(dialog).getByRole('combobox', { name: 'Category: Parenting' })).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await chooseOption(user, dialog, 'Category', 'Not set');
    expect(within(dialog).getByRole('combobox', { name: 'Category: Not set' })).toBeTruthy();
    await chooseOption(user, dialog, 'Category', 'Friend');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['friends'],
      categoryChanged: true
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores Classic relationship groups and saves Relationship independently of Category', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), {
      categoryIds: ['marriage'],
      details: { personId: 'sample-person-avery', relationshipLabel: 'Aunt-by-choice' }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect(within(dialog).getByText('Aunt-by-choice')).toBeTruthy();
    const relationship = within(dialog).getByRole('combobox', { name: 'Relationship: Custom...' });
    await user.click(relationship);
    const listbox = within(dialog).getByRole('listbox', { name: 'Relationship' });
    const family = within(listbox).getByRole('group', { name: 'Family' });
    expect(within(family).getAllByRole('option').map(option => option.textContent?.trim())).toEqual([
      'Spouse', 'Son', 'Daughter', 'Bonus son', 'Bonus daughter', 'Father', 'Mother',
      'Brother', 'Sister', 'Son-in-law', 'Daughter-in-law', 'Grandchild', 'Nephew',
      'Niece', 'In-law'
    ]);
    const friends = within(listbox).getByRole('group', { name: 'Friends & others' });
    expect(within(friends).getAllByRole('option').map(option => option.textContent?.trim())).toEqual([
      'Family', 'Friend', 'Close friend', 'Mentor', 'Mentee', 'Coworker', 'Neighbor',
      'Small group friend', 'Accountability partner', 'Pastor', 'Other'
    ]);
    await user.keyboard('{Escape}');
    await chooseOption(user, dialog, 'Relationship', 'Son');
    expect(dialog.querySelector('.money-goal-dialog__intro')?.textContent).toBe('Son');
    expect(within(dialog).getByRole('combobox', { name: 'Category: Marriage' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['marriage'],
      categoryChanged: false,
      relationshipChoice: 'Son',
      relationshipLabel: 'Son',
      relationshipChanged: true
    }));
  });

  it('supports a staged custom relationship, cancel, and failed-save draft retention', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(draft: PersonDetailsDraft) => string | null>(
      () => 'Preview storage changed in another tab. No person settings were saved.'
    );
    const { onClose } = renderEditor(onSave);
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await chooseOption(user, dialog, 'Relationship', 'Custom...');
    const custom = within(dialog).getByRole('textbox', { name: 'Custom relationship' });
    await user.type(custom, 'Aunt-by-choice');
    expect(within(dialog).getByText('Aunt-by-choice')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent)
      .toBe('Preview storage changed in another tab. No person settings were saved.');
    expect((within(dialog).getByRole('textbox', { name: 'Custom relationship' }) as HTMLInputElement).value)
      .toBe('Aunt-by-choice');
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      relationshipChoice: 'custom',
      relationshipLabel: 'Aunt-by-choice',
      relationshipChanged: true
    }));
  });

  it('saves edits to an imported custom relationship without changing Category', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), {
      categoryIds: ['parenting'],
      details: { personId: 'sample-person-avery', relationshipLabel: 'Aunt-by-choice' }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const custom = within(dialog).getByRole('textbox', { name: 'Custom relationship' });
    await user.clear(custom);
    await user.type(custom, 'Godmother');
    expect(dialog.querySelector('.money-goal-dialog__intro')?.textContent).toBe('Godmother');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['parenting'],
      categoryChanged: false,
      relationshipChoice: 'custom',
      relationshipLabel: 'Godmother',
      relationshipChanged: true
    }));
  });

  it('discards category changes on Cancel and retains them after a failed save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(draft: PersonDetailsDraft) => string | null>(
      () => 'Preview storage changed in another tab. No person settings were saved.'
    );
    const onClose = vi.fn();
    const options = {
      categoryIds: ['marriage', 'friends'] as ('marriage' | 'parenting' | 'friends')[],
      details: {
        personId: 'sample-person-avery' as const,
        relationshipLabel: 'Spouse',
        birthday: { monthDay: '02-29' }
      }
    };
    const { unmount } = renderEditor(onSave, onClose, options);
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await chooseOption(user, dialog, 'Category', 'Parenting');
    await chooseOption(user, dialog, 'Relationship', 'Son');
    await user.click(within(dialog).getByRole('button', { name: 'Clear birthday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    renderEditor(onSave, onClose, options);
    const retryDialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await chooseOption(user, retryDialog, 'Category', 'Parenting');
    await chooseOption(user, retryDialog, 'Relationship', 'Son');
    await user.click(within(retryDialog).getByRole('button', { name: 'Clear birthday' }));
    await user.click(within(retryDialog).getByRole('button', { name: 'Save' }));
    expect(within(retryDialog).getByRole('alert').textContent)
      .toBe('Preview storage changed in another tab. No person settings were saved.');
    expect(within(retryDialog).getByRole('combobox', { name: 'Category: Parenting' })).toBeTruthy();
    expect(within(retryDialog).getByRole('combobox', { name: 'Relationship: Son' })).toBeTruthy();
    expect(within(retryDialog).getByLabelText('Birthday')).toHaveProperty('value', '');
    expect(retryDialog.querySelector('.money-goal-dialog__intro')?.textContent).toBe('Son');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves untouched partial dates, lets keyboard deletion clear them, and accepts a full replacement', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    renderEditor(onSave, onClose, {
      details: {
        personId: 'sample-person-avery',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-02' }
      }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const birthday = within(dialog).getByLabelText('Birthday') as HTMLInputElement;
    await user.click(birthday);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    const anniversary = within(dialog).getByLabelText('Anniversary');
    fireEvent.change(anniversary, { target: { value: '2010-12-02' } });
    expect(within(dialog).queryByRole('button', { name: 'Clear birthday' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Clear anniversary' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      birthdayDate: '',
      anniversaryDate: '2010-12-02',
      anniversaryYearUnknown: false
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves empty optional dates empty on focus and dismissal and clears populated dates accessibly', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), {
      details: { personId: 'sample-person-avery' }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const birthday = within(dialog).getByLabelText('Birthday') as HTMLInputElement;
    const anniversary = within(dialog).getByLabelText('Anniversary') as HTMLInputElement;
    expect(birthday.parentElement?.classList.contains('person-date-field--empty')).toBe(true);
    expect(within(dialog).queryByRole('button', { name: 'Clear birthday' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Clear anniversary' })).toBeNull();
    await user.click(anniversary);
    await user.tab();
    expect(anniversary.value).toBe('');
    expect(birthday.value).toBe('');

    fireEvent.change(birthday, { target: { value: '2000-02-29' } });
    expect(birthday.parentElement?.classList.contains('person-date-field--empty')).toBe(false);
    expect(within(dialog).getByRole('button', { name: 'Clear birthday' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Clear birthday' }));
    expect(birthday.value).toBe('');
    expect(birthday.parentElement?.classList.contains('person-date-field--empty')).toBe(true);
    expect(within(dialog).queryByRole('button', { name: 'Clear birthday' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      birthdayDate: '',
      anniversaryDate: ''
    }));
  });

  it('stages the circular photo row and only saves a prepared replacement', async () => {
    const user = userEvent.setup();
    vi.mocked(compressPersonPhoto).mockResolvedValueOnce(replacementPhoto);
    const { onSave, onClose } = renderEditor();
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect(within(dialog).getByText('Crops to a circle for their card.')).toBeTruthy();
    expect(dialog.querySelector('.person-details-editor__photo')).toBeTruthy();
    const file = new File(['synthetic-image'], 'synthetic.jpg', { type: 'image/jpeg' });
    await user.upload(within(dialog).getByLabelText('Choose photo for Avery Brooks'), file);
    await waitFor(() => expect(
      dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')
    ).toBe(replacementPhoto));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoDataUrl: replacementPhoto }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the previous photo on preparation failure and on Cancel', async () => {
    const user = userEvent.setup();
    vi.mocked(compressPersonPhoto).mockRejectedValueOnce(new Error('Choose a JPEG, PNG, or WebP image.'));
    const { onSave, onClose } = renderEditor();
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await user.upload(
      within(dialog).getByLabelText('Choose photo for Avery Brooks'),
      new File(['synthetic-image'], 'synthetic.jpg', { type: 'image/jpeg' })
    );
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Choose a JPEG, PNG, or WebP image.'
    );
    expect(dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')).toBe(originalPhoto);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps connection cadence available and provides accurate cadence options and help', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), { categoryIds: ['marriage', 'friends'] });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const trigger = within(dialog).getByRole('combobox', { name: 'Connection cadence: Weekly' });
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
    await user.click(trigger);
    const cadenceList = within(dialog).getByRole('listbox', { name: 'Connection cadence' });
    expect(within(cadenceList).getByRole('option', { name: 'Twice weekly' }).getAttribute('aria-disabled')).toBe('false');
    for (const option of ['No cadence', 'Daily', 'Twice weekly', 'Weekly', 'Every 2 weeks', 'Monthly']) {
      expect(within(cadenceList).getByRole('option', { name: option })).toBeTruthy();
    }
    await user.keyboard('{Escape}');

    const helpButton = within(dialog).getByRole('button', { name: 'About connection cadence' });
    await user.click(helpButton);
    expect(within(dialog).getByRole('tooltip').textContent).toBe(
      'Daily, weekly, every two weeks, and monthly use the selected interval from your latest logged connection. Twice weekly means connecting on any two different days from Monday through Sunday; multiple connections on one day count once. Unmet weekly progress is not an overdue date.'
    );
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(helpButton);
    expect(helpButton.getAttribute('aria-expanded')).toBe('false');

    await chooseOption(user, dialog, 'Connection cadence', 'Monthly');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ connectionCadence: 'monthly' }));
  });

  it('uses the established love-language values and keeps cadence available for every category', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    renderEditor(onSave, vi.fn(), { categoryIds: ['marriage'] });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect((within(dialog).getByRole('combobox', { name: 'Connection cadence: Weekly' }) as HTMLButtonElement).disabled)
      .toBe(false);
    for (const option of ['Parenting', 'Friend', 'Not set']) {
      await chooseOption(user, dialog, 'Category', option);
      expect((within(dialog).getByRole('combobox', { name: 'Connection cadence: Weekly' }) as HTMLButtonElement).disabled)
        .toBe(false);
    }
    await user.click(within(dialog).getByRole('combobox', { name: 'Love language: Not set' }));
    const languages = within(dialog).getByRole('listbox', { name: 'Love language' });
    for (const language of [
      'Not set', 'Quality Time', 'Words of Affirmation', 'Acts of Service', 'Gifts', 'Physical Touch'
    ]) {
      expect(within(languages).getByRole('option', { name: language })).toBeTruthy();
    }
    await user.click(within(languages).getByRole('option', { name: 'Physical Touch' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ connectionStyle: 'pt' }));
  });

  it('keeps the cadence control enabled when no category is selected', () => {
    renderEditor(vi.fn(() => null), vi.fn(), { categoryIds: [] });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect((within(dialog).getByRole('combobox', { name: 'Connection cadence: Weekly' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('retains the complete draft after a failed save', async () => {
    const user = userEvent.setup();
    vi.mocked(compressPersonPhoto).mockResolvedValueOnce(replacementPhoto);
    const onSave = vi.fn<(draft: PersonDetailsDraft) => string | null>(
      () => 'Preview storage changed in another tab. No person settings were saved.'
    );
    const { onClose } = renderEditor(onSave, vi.fn(), {
      categoryIds: ['marriage', 'friends'],
      details: {
        personId: 'sample-person-avery',
        relationshipLabel: 'Spouse',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-02' },
        photoDataUrl: originalPhoto
      }
    });
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await chooseOption(user, dialog, 'Category', 'Friend');
    fireEvent.change(within(dialog).getByLabelText('Birthday'), { target: { value: '2000-02-29' } });
    fireEvent.change(within(dialog).getByLabelText('Anniversary'), { target: { value: '2010-12-02' } });
    await user.upload(
      within(dialog).getByLabelText('Choose photo for Avery Brooks'),
      new File(['synthetic-image'], 'synthetic.jpg', { type: 'image/jpeg' })
    );
    await waitFor(() => expect(
      dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')
    ).toBe(replacementPhoto));
    await chooseOption(user, dialog, 'Connection cadence', 'Weekly');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByRole('alert').textContent)
      .toBe('Preview storage changed in another tab. No person settings were saved.');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['friends'],
      categoryChanged: true,
      birthdayDate: '2000-02-29',
      anniversaryDate: '2010-12-02',
      connectionCadence: 'weekly',
      photoDataUrl: replacementPhoto
    }));
    expect((within(dialog).getByLabelText('Birthday') as HTMLInputElement).value).toBe('2000-02-29');
    expect((within(dialog).getByLabelText('Anniversary') as HTMLInputElement).value).toBe('2010-12-02');
    expect(dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')).toBe(replacementPhoto);
    expect(onClose).not.toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonDetailsEditor } from '../src/components/PersonDetailsEditor.tsx';
import { compressPersonPhoto } from '../src/components/person-photo.ts';

vi.mock('../src/components/person-photo.ts', () => ({
  compressPersonPhoto: vi.fn()
}));

afterEach(cleanup);

const replacementPhoto = 'data:image/jpeg;base64,/9j/2Q==';
const originalPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function renderEditor(onSave = vi.fn(() => null), onClose = vi.fn()) {
  const result = render(
    <PersonDetailsEditor
      personId="sample-person-avery"
      personName="Avery Brooks"
      details={{ personId: 'sample-person-avery', photoDataUrl: originalPhoto }}
      today="2026-10-31"
      cadence="weekly"
      categoryIds={['friends']}
      onSave={onSave}
      onClose={onClose}
    />
  );
  return { ...result, onSave, onClose };
}

describe('shared Person settings editor', () => {
  it('preserves partial dates during unrelated edits and requires explicit replacement or clearing', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        details={{
          personId: 'sample-person-avery',
          birthday: { monthDay: '02-29' },
          anniversary: { monthDay: '12-02' }
        }}
        today="2026-10-31"
        categoryIds={[]}
        onSave={onSave}
        onClose={onClose}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const birthday = within(dialog).getByLabelText('Birthday');
    const anniversary = within(dialog).getByLabelText('Anniversary');
    expect((birthday as HTMLInputElement).value).toBe('');
    expect((anniversary as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByText(/Saved date: February 29/)).toBeTruthy();
    expect(within(dialog).getByText(/Saved date: December 2/)).toBeTruthy();
    expect(within(dialog).queryByText('Year unknown')).toBeNull();
    expect(within(dialog).queryByLabelText('Relationship')).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText('Love language'), 'wa');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: [],
      birthdayDate: '',
      birthdayYearUnknown: true,
      anniversaryDate: '',
      anniversaryYearUnknown: true,
      connectionStyle: 'wa'
    }));
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.change(birthday, { target: { value: '1988-02-29' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenNthCalledWith(2, expect.objectContaining({
      birthdayDate: '1988-02-29',
      birthdayYearUnknown: false,
      anniversaryDate: '',
      anniversaryYearUnknown: true
    }));
  });

  it('provides explicit Clear actions for both combined date fields', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        details={{
          personId: 'sample-person-avery',
          birthday: { monthDay: '02-29' },
          anniversary: { monthDay: '12-02' }
        }}
        today="2026-10-31"
        categoryIds={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await user.click(within(dialog).getByRole('button', { name: 'Clear birthday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Clear anniversary' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      birthdayDate: '',
      birthdayYearUnknown: false,
      anniversaryDate: '',
      anniversaryYearUnknown: false
    }));
  });

  it('previews a replacement photo and submits it only on Save', async () => {
    const user = userEvent.setup();
    vi.mocked(compressPersonPhoto).mockResolvedValueOnce(replacementPhoto);
    const { onSave, onClose } = renderEditor();
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const file = new File(['synthetic-image'], 'synthetic.jpg', { type: 'image/jpeg' });
    await user.upload(within(dialog).getByLabelText('Choose photo for Avery Brooks'), file);

    await waitFor(() => expect(
      dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')
    ).toBe(replacementPhoto));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoDataUrl: replacementPhoto }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the existing photo when replacement preparation fails and retains it on Cancel', async () => {
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

  it('stages photo removal until Save and keeps cadence unavailable without Friends classification', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        details={{ personId: 'sample-person-avery', photoDataUrl: originalPhoto }}
        today="2026-10-31"
        cadence="weekly"
        categoryIds={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect(dialog.querySelector<HTMLSelectElement>('#person-details-cadence-sample-person-avery')?.disabled).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Remove photo' }));
    await user.click(within(dialog).getByLabelText('Category: none selected'));
    const friendCheckbox = within(dialog).getByRole('checkbox', { name: 'Friend' });
    await user.click(friendCheckbox);
    expect(dialog.querySelector<HTMLSelectElement>('#person-details-cadence-sample-person-avery')?.disabled).toBe(false);
    await user.selectOptions(within(dialog).getByLabelText('Connection cadence'), 'monthly');
    expect(dialog.querySelector('.person-details-editor__photo-preview img')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['friends'],
      connectionCadence: 'monthly',
      photoDataUrl: ''
    }));
  });

  it('stages multiple categories and retains every field after a failed save', async () => {
    const user = userEvent.setup();
    vi.mocked(compressPersonPhoto).mockResolvedValueOnce(replacementPhoto);
    const onSave = vi.fn(() => 'Preview storage changed in another tab. No person settings were saved.');
    const onClose = vi.fn();
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        details={{
          personId: 'sample-person-avery',
          relationshipLabel: 'Spouse',
          birthday: { monthDay: '02-29' },
          anniversary: { monthDay: '12-02' },
          photoDataUrl: originalPhoto
        }}
        today="2026-10-31"
        categoryIds={['marriage']}
        onSave={onSave}
        onClose={onClose}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await user.click(within(dialog).getByLabelText('Category: Marriage'));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Parenting' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Friend' }));
    fireEvent.change(within(dialog).getByLabelText('Birthday'), { target: { value: '2000-02-29' } });
    fireEvent.change(within(dialog).getByLabelText('Anniversary'), { target: { value: '2010-12-02' } });
    await user.upload(
      within(dialog).getByLabelText('Choose photo for Avery Brooks'),
      new File(['synthetic-image'], 'synthetic.jpg', { type: 'image/jpeg' })
    );
    await waitFor(() => expect(
      dialog.querySelector('.person-details-editor__photo-preview img')?.getAttribute('src')
    ).toBe(replacementPhoto));
    await user.selectOptions(within(dialog).getByLabelText('Connection cadence'), 'weekly');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByRole('alert').textContent)
      .toBe('Preview storage changed in another tab. No person settings were saved.');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      categoryIds: ['marriage', 'parenting', 'friends'],
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

  it('discards unsaved category changes on Escape', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        today="2026-10-31"
        categoryIds={['marriage']}
        onSave={onSave}
        onClose={onClose}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    await user.click(within(dialog).getByLabelText('Category: Marriage'));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Parenting' }));
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

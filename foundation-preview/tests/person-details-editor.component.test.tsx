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
      isFriend
      onSave={onSave}
      onClose={onClose}
    />
  );
  return { ...result, onSave, onClose };
}

describe('shared Person settings editor', () => {
  it('does not invent a year when converting an unknown leap-day birthday to a full date', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    render(
      <PersonDetailsEditor
        personId="sample-person-avery"
        personName="Avery Brooks"
        details={{ personId: 'sample-person-avery', birthday: { monthDay: '02-29' } }}
        today="2026-10-31"
        isFriend={false}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    const birthday = within(dialog).getByLabelText('Birthday');
    const yearUnknown = within(dialog).getAllByLabelText('Year unknown')[0] as HTMLInputElement;

    expect((birthday as HTMLInputElement).value).toBe('2000-02-29');
    expect(yearUnknown.checked).toBe(true);
    await user.click(yearUnknown);
    expect(yearUnknown.checked).toBe(true);
    expect(within(dialog).getByText(/Choose a full date to set its year/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(birthday, { target: { value: '1988-02-29' } });
    await user.click(yearUnknown);
    expect(yearUnknown.checked).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      birthdayDate: '1988-02-29',
      birthdayYearUnknown: false
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
        isFriend={false}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Person settings — Avery Brooks' });
    expect(dialog.querySelector<HTMLSelectElement>('#person-details-cadence-sample-person-avery')?.disabled).toBe(true);
    expect(within(dialog).getByText(/classified as Friends/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Remove photo' }));
    expect(dialog.querySelector('.person-details-editor__photo-preview img')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      connectionCadence: 'weekly',
      photoDataUrl: ''
    }));
  });
});

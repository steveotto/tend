import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchivedRhythmsControl } from '../src/components/ArchivedRhythmsControl.tsx';

afterEach(cleanup);

describe('ArchivedRhythmsControl', () => {
  it('shows a plain count instead of an inactive control at zero', () => {
    const openerRef: { current: HTMLElement | null } = { current: null };
    render(<ArchivedRhythmsControl count={0} openerRef={openerRef} onOpen={vi.fn()} />);

    expect(screen.getByText('Archived rhythms (0)')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(openerRef.current).toBe(screen.getByText('Archived rhythms (0)'));
  });

  it('renders the quiet link only when archived Rhythms are available', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const openerRef: { current: HTMLElement | null } = { current: null };
    render(<ArchivedRhythmsControl count={2} openerRef={openerRef} onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: 'Archived rhythms (2)' });
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(openerRef.current).toBe(button);
  });
});

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPrayerModule, type TodayPrayerModuleProps } from '../src/components/TodayPrayerModule.tsx';
import {
  syntheticPeople,
  syntheticPersonPickerGroups,
  syntheticPrayerRequests
} from '../src/domain/preview-data.ts';

afterEach(cleanup);

const testPrayerRequests = syntheticPrayerRequests.map(request => ({
  ...request,
  updatedAt: '2026-11-11T13:30:00.000Z'
}));

const defaultProps: TodayPrayerModuleProps = {
  people: syntheticPeople,
  peopleGroups: syntheticPersonPickerGroups,
  requests: testPrayerRequests,
  evaluationInstant: new Date('2026-11-11T13:30:00.000Z'),
  timeZone: 'UTC',
  onPray: () => null
};

function renderPrayerModule(props: Partial<TodayPrayerModuleProps> = {}) {
  return render(<TodayPrayerModule {...defaultProps} {...props} />);
}

describe('Today Prayer module', () => {
  it('shows the Pray action and runs an accessible, selectable prayer session', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn((_id: string, _updatedAt: string, _actorId: string) => null);
    const longPrayerDescription = 'A long synthetic prayer request description '.repeat(16);
    renderPrayerModule({
      onPray,
      requests: testPrayerRequests.map(request => request.id === 'sample-prayer-request-family'
          ? { ...request, details: longPrayerDescription }
          : request)
    });

    expect(screen.getByRole('heading', { name: 'Prayer' })).toBeTruthy();
    const module = screen.getByRole('region', { name: 'Pray' });
    expect(within(module).queryByRole('heading', { name: 'Prayer' })).toBeNull();
    expect(module.querySelector('.prayer-entry-summary')?.textContent).not.toContain('requests');
    expect(module.querySelector('.prayer-entry-count')?.textContent).toBe('2');
    expect(screen.getByRole('button', { name: 'Pray for 2 requests' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Customize' }));

    const selection = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(document.body.style.position).toBe('fixed');
    expect(within(selection).getByRole('heading', { name: 'Timeframe' })).toBeTruthy();
    expect(within(selection).getByRole('heading', { name: 'People' })).toBeTruthy();
    expect(within(selection).getByRole('button', { name: /Change timeframe, currently Now/ })).toBeTruthy();
    expect(within(selection).getByText('2 requests selected')).toBeTruthy();

    await user.click(within(selection).getByRole('button', { name: /Change timeframe/ }));
    const timeframePicker = within(selection).getByRole('group', { name: 'Prayer timeframes' });
    await user.click(within(timeframePicker).getByRole('button', { name: /Morning/ }));
    expect(within(selection).getByRole('button', { name: /Change timeframe, currently Morning/ })).toBeTruthy();
    expect(within(selection).getByText('1 request selected')).toBeTruthy();

    const avery = within(selection).getByRole('button', { name: 'Avery Brooks' });
    await user.click(avery);
    expect(avery.getAttribute('aria-pressed')).toBe('false');
    expect(within(selection).queryByRole('button', { name: 'Done' })).toBeNull();
    expect(within(selection).queryByRole('button', { name: 'Start prayer' })).toBeNull();
    const pray = within(selection).getByRole('button', { name: 'Pray' });
    expect(pray.hasAttribute('disabled')).toBe(false);
    await user.click(pray);

    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    expect(session.classList.contains('money-goal-dialog')).toBe(true);
    expect(session.classList.contains('dialog--phone-fullscreen')).toBe(true);
    expect(session.querySelector('.money-goal-dialog__surface')).toBeTruthy();
    expect(within(session).getByText('Request 1 of 1')).toBeTruthy();
    expect(within(session).getByRole('heading', { name: 'Patience during a busy week' })).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();
    expect(session.querySelector('.faith-session-card > p')?.textContent).toBe(longPrayerDescription);
    expect(session.querySelector('.faith-session-person .person-badge-visual')).toBeTruthy();
    expect(within(session).getByRole('progressbar', { name: 'Prayer session progress' })).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Prayed' }));
    expect(onPray).toHaveBeenCalledWith(
      'sample-prayer-request-family',
      '2026-11-11T13:30:00.000Z',
      'sample-person-morgan'
    );
    expect(within(session).getByRole('heading', { name: 'Prayer time complete' })).toBeTruthy();
    expect(within(session).getByText('You marked 1 request prayed.')).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Finish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.position).toBe('');
  });

  it('cancels selection edits from Cancel or close without changing saved preferences', async () => {
    const user = userEvent.setup();
    renderPrayerModule();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    let picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(picker).getByRole('button', { name: /Change timeframe/ }));
    await user.click(within(picker).getByRole('group', { name: 'Prayer timeframes' })
      .querySelector('[data-prayer-time-option="morning"]')!);
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const module = screen.getByRole('region', { name: 'Pray' });
    expect(module.textContent).toContain('3 people selected · Now');

    await user.click(screen.getByRole('button', { name: 'Customize' }));
    picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    await user.click(within(picker).getByRole('button', { name: /Change timeframe/ }));
    const timeframePicker = screen.getByRole('dialog', { name: 'Prayer timeframe' });
    await user.click(within(timeframePicker).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Pray' }).textContent)
      .toContain('3 people selected · Now');

    await user.click(screen.getByRole('button', { name: 'Customize' }));
    picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: /Change timeframe, currently Now/ })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Close prayer selection' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Customize' }));
    picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: /Change timeframe, currently Now/ })).toBeTruthy();
  });

  it('keeps only Cancel and Pray in the timeframe view and starts without recording', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn((_id: string, _updatedAt: string, _actorId: string) => null);
    renderPrayerModule({ onPray });
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: /Change timeframe/ }));

    const timeframePicker = screen.getByRole('dialog', { name: 'Prayer timeframe' });
    expect(within(timeframePicker).getByText('2 requests selected')).toBeTruthy();
    expect(within(timeframePicker).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(timeframePicker).getByRole('button', { name: 'Pray' })).toBeTruthy();
    expect(within(timeframePicker).queryByRole('button', { name: 'Done' })).toBeNull();
    expect(within(timeframePicker).queryByRole('button', { name: 'Start prayer' })).toBeNull();

    await user.click(within(timeframePicker).getByRole('button', { name: 'Pray' }));
    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    expect(within(session).getByText('Request 1 of 2')).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();
    await user.click(within(session).getByRole('button', { name: 'End session' }));
    await user.click(within(session).getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('region', { name: 'Pray' }).textContent)
      .toContain('3 people selected · Now');
  });

  it('disables Pray and explains how to restore an eligible request selection', async () => {
    const user = userEvent.setup();
    renderPrayerModule();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    const picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    await user.click(within(picker).getByRole('button', { name: 'Clear' }));
    const pray = within(picker).getByRole('button', { name: 'Pray' }) as HTMLButtonElement;
    expect(pray.disabled).toBe(true);
    expect(within(picker).getByText('0 requests selected')).toBeTruthy();
    expect(within(picker).getByText(
      'No active requests match this selection. Choose different people or a different timeframe to pray.'
    )).toBeTruthy();
  });

  it('ends or closes without recording prayer for navigation or Escape', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn((_id: string, _updatedAt: string, _actorId: string) => null);
    renderPrayerModule({ onPray });
    const launch = screen.getByRole('button', { name: 'Pray for 2 requests' });
    await user.click(launch);
    let session = screen.getByRole('dialog', { name: 'One request at a time' });
    await user.click(within(session).getByRole('button', { name: 'Skip' }));
    expect(within(session).getByText('Request 2 of 2')).toBeTruthy();
    await user.click(within(session).getByRole('button', { name: 'Back' }));
    expect(within(session).getByText('Request 1 of 2')).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();

    await user.click(within(session).getByRole('button', { name: 'End session' }));
    const endedHeading = within(session).getByRole('heading', { name: 'Prayer session ended' });
    expect(endedHeading).toBeTruthy();
    expect(document.activeElement).toBe(endedHeading);
    expect(session.getAttribute('aria-labelledby')).toBe('today-prayer-session-title');
    expect(within(session).getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();
    await user.click(within(session).getByRole('button', { name: 'Finish' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onPray).not.toHaveBeenCalled();
  });

  it('suspends an open session while Prayer is disabled without losing it or logging activity', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn((_id: string, _updatedAt: string, _actorId: string) => null);
    const props = {
      ...defaultProps,
      onPray
    };
    const view = render(<TodayPrayerModule {...props} />);
    await user.click(screen.getByRole('button', { name: 'Pray for 2 requests' }));
    expect(screen.getByRole('dialog', { name: 'One request at a time' })).toBeTruthy();

    view.rerender(<TodayPrayerModule {...props} enabled={false} />);
    expect(document.querySelector('.today-prayer-section')?.hasAttribute('hidden')).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onPray).not.toHaveBeenCalled();

    view.rerender(<TodayPrayerModule {...props} enabled />);
    const resumedSession = screen.getByRole('dialog', { name: 'One request at a time' });
    expect(within(resumedSession).getByText('Request 1 of 2')).toBeTruthy();
    await user.click(within(resumedSession).getByRole('button', { name: 'Prayed' }));
    expect(onPray).toHaveBeenCalledWith(
      'sample-prayer-request-family',
      '2026-11-11T13:30:00.000Z',
      'sample-person-morgan'
    );
  });

  it('disables Back and Skip at the first and last request without wrapping', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn((_id: string, _updatedAt: string, _actorId: string) => null);
    const firstRequest = testPrayerRequests[0];
    if (!firstRequest) throw new Error('Synthetic prayer fixture is missing its first request.');
    const requests = [
      ...testPrayerRequests,
      { ...firstRequest, id: 'sample-prayer-request-third' }
    ];
    renderPrayerModule({ requests, onPray });

    await user.click(screen.getByRole('button', { name: 'Pray for 3 requests' }));
    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    const back = within(session).getByRole('button', { name: 'Back' });
    const skip = within(session).getByRole('button', { name: 'Skip' });
    expect(within(session).getByText('Request 1 of 3')).toBeTruthy();
    expect((back as HTMLButtonElement).disabled).toBe(true);
    expect((skip as HTMLButtonElement).disabled).toBe(false);

    await user.keyboard('{ArrowLeft}');
    expect(within(session).getByText('Request 1 of 3')).toBeTruthy();
    await user.click(skip);
    expect(within(session).getByText('Request 2 of 3')).toBeTruthy();
    expect((back as HTMLButtonElement).disabled).toBe(false);
    expect((skip as HTMLButtonElement).disabled).toBe(false);

    await user.keyboard('{ArrowRight}');
    expect(within(session).getByText('Request 3 of 3')).toBeTruthy();
    expect((skip as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard('{ArrowRight}');
    expect(within(session).getByText('Request 3 of 3')).toBeTruthy();
    await user.click(skip);
    expect(within(session).getByText('Request 3 of 3')).toBeTruthy();

    await user.click(back);
    expect(within(session).getByText('Request 2 of 3')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(within(session).getByText('Request 1 of 3')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(within(session).getByText('Request 1 of 3')).toBeTruthy();
    expect((back as HTMLButtonElement).disabled).toBe(true);
    expect(onPray).not.toHaveBeenCalled();
  });

  it('disables both navigation actions for a single-request session', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn(() => null);
    renderPrayerModule({ requests: testPrayerRequests.slice(0, 1), onPray });

    await user.click(screen.getByRole('button', { name: 'Pray for 1 request' }));
    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    expect((within(session).getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(session).getByRole('button', { name: 'Skip' }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard('{ArrowLeft}{ArrowRight}');
    expect(within(session).getByText('Request 1 of 1')).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();
  });

  it('uses Escape to end the session without logging a prayer', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn(() => null);
    renderPrayerModule({ onPray });
    await user.click(screen.getByRole('button', { name: 'Pray for 2 requests' }));
    const session = screen.getByRole('dialog', { name: 'One request at a time' });
    await user.keyboard('{Escape}');
    expect(within(session).getByRole('heading', { name: 'Prayer session ended' })).toBeTruthy();
    expect(onPray).not.toHaveBeenCalled();
  });

  it('disables starting a session when no active synthetic requests match', () => {
    renderPrayerModule({ requests: testPrayerRequests.filter(request => request.status !== 'active') });
    expect(screen.getByRole('button', { name: 'Pray for 0 requests' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('No active prayer requests are saved for these people.')).toBeTruthy();
  });

  it('shows only supplied account people and requests, with an explicit empty account state', async () => {
    const user = userEvent.setup();
    const person = { id: 'preview-account-person', displayName: 'Preview Account Person' };
    const request = {
      id: 'preview-account-request',
      personId: person.id,
      title: 'Preview account request',
      status: 'active' as const,
      timeOfDay: 'anytime' as const,
      updatedAt: '2026-11-11T13:30:00.000Z',
      prayedCount: 0
    };
    renderPrayerModule({ people: [person], peopleGroups: [], requests: [request] });

    expect(screen.getByRole('button', { name: 'Pray for 1 request' })).toBeTruthy();
    expect(screen.queryByText('Patience during a busy week')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    const picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(within(picker).getByRole('button', { name: 'Preview Account Person' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).queryByRole('button', { name: /Avery Brooks|Morgan Lane|Jordan Reyes/ })).toBeNull();

    cleanup();
    renderPrayerModule({ people: [], peopleGroups: [], requests: [] });
    expect(screen.getByText('No people or prayer requests are available yet.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Customize' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Pray for 0 requests' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('keeps delayed or failed Prayer data out of the rendered picker and resets selection on scope changes', async () => {
    const user = userEvent.setup();
    const alpha = { id: 'preview-account-alpha', displayName: 'Alpha Person' };
    const alphaRequest = {
      id: 'alpha-request',
      personId: alpha.id,
      title: 'Alpha private request',
      status: 'active' as const,
      timeOfDay: 'anytime' as const,
      updatedAt: '2026-11-11T13:30:00.000Z',
      prayedCount: 0
    };
    const view = renderPrayerModule({
      people: [alpha],
      peopleGroups: [],
      requests: [alphaRequest],
      dataStatus: 'loading'
    });
    expect(screen.getByRole('status').textContent).toBe('Loading saved Prayer data…');
    expect(screen.queryByText('Alpha private request')).toBeNull();
    expect((screen.getByRole('button', { name: 'Pray for 0 requests' }) as HTMLButtonElement).disabled)
      .toBe(true);

    const beta = { id: 'preview-account-beta', displayName: 'Beta Person' };
    const betaRequest = {
      id: 'beta-request',
      personId: beta.id,
      title: 'Beta saved request',
      status: 'active' as const,
      timeOfDay: 'anytime' as const,
      updatedAt: '2026-11-11T13:30:00.000Z',
      prayedCount: 0
    };
    view.rerender(
      <TodayPrayerModule
        {...defaultProps}
        people={[beta]}
        peopleGroups={[]}
        requests={[betaRequest]}
        dataStatus="ready"
      />
    );
    await user.click(await screen.findByRole('button', { name: 'Customize' }));
    const picker = screen.getByRole('dialog', { name: 'Prayer selection' });
    expect(within(picker).getByRole('button', { name: 'Beta Person' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).queryByRole('button', { name: 'Alpha Person' })).toBeNull();
    await user.keyboard('{Escape}');

    cleanup();
    renderPrayerModule({
      people: [alpha],
      peopleGroups: [],
      requests: [alphaRequest],
      dataStatus: 'error',
      dataError: 'The saved Prayer data could not be loaded.'
    });
    expect(screen.getByRole('alert').textContent).toContain('The saved Prayer data could not be loaded.');
    expect(screen.queryByText('Alpha private request')).toBeNull();
    expect((screen.getByRole('button', { name: 'Pray for 0 requests' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('closes the prior account session while loading and uses only the next account requests', async () => {
    const user = userEvent.setup();
    const alpha = { id: 'preview-account-alpha', displayName: 'Alpha Person' };
    const alphaRequest = {
      id: 'alpha-request',
      personId: alpha.id,
      title: 'Alpha private request',
      status: 'active' as const,
      timeOfDay: 'anytime' as const,
      updatedAt: '2026-11-11T13:30:00.000Z',
      prayedCount: 0
    };
    const view = renderPrayerModule({
      people: [alpha],
      peopleGroups: [],
      requests: [alphaRequest]
    });

    await user.click(screen.getByRole('button', { name: 'Pray for 1 request' }));
    expect(screen.getByRole('dialog').textContent).toContain('Alpha private request');

    view.rerender(
      <TodayPrayerModule
        {...defaultProps}
        people={[]}
        peopleGroups={[]}
        requests={[]}
        dataStatus="loading"
      />
    );
    expect(screen.getByRole('status').textContent).toBe('Loading saved Prayer data…');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Alpha private request')).toBeNull();

    const beta = { id: 'preview-account-beta', displayName: 'Beta Person' };
    const betaRequest = {
      id: 'beta-request',
      personId: beta.id,
      title: 'Beta saved request',
      status: 'active' as const,
      timeOfDay: 'anytime' as const,
      updatedAt: '2026-11-11T13:30:00.000Z',
      prayedCount: 0
    };
    view.rerender(
      <TodayPrayerModule
        {...defaultProps}
        people={[beta]}
        peopleGroups={[]}
        requests={[betaRequest]}
        dataStatus="ready"
      />
    );
    await user.click(await screen.findByRole('button', { name: 'Pray for 1 request' }));
    const betaSession = screen.getByRole('dialog');
    expect(betaSession.textContent).toContain('Beta saved request');
    expect(betaSession.textContent).not.toContain('Alpha private request');

    view.rerender(
      <TodayPrayerModule
        {...defaultProps}
        people={[]}
        peopleGroups={[]}
        requests={[]}
        dataStatus="error"
        dataError="The saved Prayer data could not be loaded."
      />
    );
    expect(screen.getByRole('alert').textContent).toContain('The saved Prayer data could not be loaded.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Beta saved request')).toBeNull();
  });
});

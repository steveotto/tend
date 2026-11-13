import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewAppErrorBoundary } from '../src/PreviewAppErrorBoundary.tsx';
import { installMemoryStorage } from './memory-storage.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PreviewAppErrorBoundary', () => {
  it('shows privacy-safe recovery guidance without changing saved browser data', () => {
    const storage = installMemoryStorage();
    storage.setItem('tend2:preview:account:synthetic', '{"synthetic":"preserve-me"}');
    const originalData = storage.getItem('tend2:preview:account:synthetic');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function CrashingPreview(): never {
      throw new Error('private render details');
    }

    render(
      <PreviewAppErrorBoundary>
        <CrashingPreview />
      </PreviewAppErrorBoundary>
    );

    expect(screen.getByRole('alert').textContent).toContain('Preview could not open');
    expect(screen.getByText('PREVIEW-STARTUP-ERROR')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload Preview' })).toBeTruthy();
    expect(screen.queryByText('private render details')).toBeNull();
    expect(storage.getItem('tend2:preview:account:synthetic')).toBe(originalData);
  });
});

import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_1_12, NC_UNISON } from '../../../src/lib/instrument/fixtures';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import TriadsGuidance from '../../../src/lib/tools/triads/TriadsGuidance.svelte';
import TriadsTool from '../../../src/lib/tools/triads/TriadsTool.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

describe('TriadsGuidance (US8)', () => {
  it('renders nothing when a shape is shown', () => {
    const { container } = render(TriadsGuidance, {
      shape: triads.display.shape,
      anotherSet: null,
      onanotherset: vi.fn()
    });
    expect(container.querySelector('.guidance')).toBeNull();
  });

  it('beyond: plain text, no button, no status role, no error styling, not dismissible', () => {
    const { container } = render(TriadsGuidance, {
      shape: { kind: 'beyond', fretCount: 12 },
      anotherSet: 5,
      onanotherset: vi.fn()
    });
    expect(screen.getByText('This shape lies beyond fret 12')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[role="status"],[role="alert"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/error|danger/i);
  });

  it('does-not-close: Another set shown only when a set is offered', async () => {
    const onanotherset = vi.fn();
    const shape = { kind: 'does-not-close' } as const;
    const { unmount } = render(TriadsGuidance, { shape, anotherSet: null, onanotherset });
    expect(screen.getByText(/does not close on this string set/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Another set' })).toBeNull();
    unmount();
    render(TriadsGuidance, { shape, anotherSet: 5, onanotherset });
    await fireEvent.click(screen.getByRole('button', { name: 'Another set' }));
    expect(onanotherset).toHaveBeenCalledTimes(1);
  });

  it('guidance text is at most two lines of copy (one short paragraph)', () => {
    const { container } = render(TriadsGuidance, {
      shape: { kind: 'does-not-close' },
      anotherSet: null,
      onanotherset: vi.fn()
    });
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect((container.querySelector('p')?.textContent ?? '').length).toBeLessThanOrEqual(120);
  });
});

describe('TriadsTool guidance (US8)', () => {
  it('US8-1: beyond fret 12 shows guidance on AF-1-12', () => {
    triads.useInstrument(AF_1_12);
    triads.selectRoot(0);
    triads.setQuality('diminished');
    triads.setStringSet(5);
    render(TriadsTool);
    expect(screen.getByText('This shape lies beyond fret 12')).toBeTruthy();
  });

  it('US8-2/3: does-not-close, Another set leads to a shown shape', async () => {
    triads.useInstrument(NC_UNISON);
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Another set' }));
    expect(triads.state.stringSet).toBe(5);
    expect(screen.queryByRole('button', { name: 'Another set' })).toBeNull();
  });
});

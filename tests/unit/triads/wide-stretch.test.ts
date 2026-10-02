import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { AF_4 } from '../../../src/lib/instrument/fixtures';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import TriadsTool from '../../../src/lib/tools/triads/TriadsTool.svelte';
import WideStretchMark from '../../../src/lib/tools/triads/WideStretchMark.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

describe('WideStretchMark (US5)', () => {
  it('shows text and an icon, not color alone', () => {
    const { container } = render(WideStretchMark);
    expect(screen.getByText('Wide stretch')).toBeTruthy();
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('TriadsTool wide stretch (US5)', () => {
  it('is absent in standard tuning', () => {
    render(TriadsTool);
    expect(screen.queryByText('Wide stretch')).toBeNull();
  });

  it('appears for Drop D C major root on 6-5-4', () => {
    triads.useInstrument(AF_4);
    triads.setStringSet(6);
    render(TriadsTool);
    expect(screen.getByText('Wide stretch')).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SoundControl from '../../src/lib/shell/SoundControl.svelte';
import StopButton from '../../src/lib/shell/StopButton.svelte';
import { playback, resetPlaybackForTests } from '../../src/lib/state/playback.svelte';

beforeEach(() => resetPlaybackForTests());
afterEach(() => vi.restoreAllMocks());

describe('StopButton', () => {
  it('is not rendered when no sequence is playing', () => {
    render(StopButton);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('renders while a sequence plays and stops on activation, moving focus to mute', async () => {
    vi.spyOn(playback, 'sequencePlaying', 'get').mockReturnValue(true);
    const stop = vi.spyOn(playback, 'stop');
    render(SoundControl);
    render(StopButton);
    const button = screen.getByRole('button', { name: 'Stop' });
    button.focus();
    await fireEvent.click(button);
    expect(stop).toHaveBeenCalledWith('stop');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mute sound' }));
  });

  // Enabled in T067, once playback.sequence exists (US6): drives a real sequence through a fake
  // engine and asserts the button appears, ≥ 44×44, then disappears after activation.
  it.todo('appears for a sequence driven through playback.sequence and disappears on Stop');
});

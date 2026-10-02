import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DetectedTriad from '../../../src/lib/tools/notes/DetectedTriad.svelte';
import type { DetectedTriad as Detected } from '../../../src/lib/state/notes-model';

const GSHARP_AUG: Detected = {
  rootPc: 8,
  quality: 'augmented',
  rootSpelling: { letter: 'G', accidental: 1 },
  name: 'G♯ augmented',
  spokenName: 'G sharp augmented'
};

describe('DetectedTriad', () => {
  it('renders nothing at all when nothing is detected', () => {
    const { container } = render(DetectedTriad, { detected: null, onview: () => {} });
    expect(container.innerHTML.replace(/<!--.*?-->/g, '').trim()).toBe('');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the visible name aria-hidden plus the spoken name', () => {
    const { container } = render(DetectedTriad, { detected: GSHARP_AUG, onview: () => {} });
    const p = container.querySelector('#notes-detected-triad');
    expect(p).not.toBeNull();
    const hidden = p?.querySelector('[aria-hidden="true"]');
    expect(hidden?.textContent).toBe('G♯ augmented');
    expect(p?.textContent).toContain('G sharp augmented');
  });

  it('labels the button and describes it by the name', () => {
    render(DetectedTriad, { detected: GSHARP_AUG, onview: () => {} });
    const button = screen.getByRole('button', { name: 'View as triad' });
    expect(button.getAttribute('aria-describedby')).toBe('notes-detected-triad');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('calls onview on click', async () => {
    const onview = vi.fn();
    render(DetectedTriad, { detected: GSHARP_AUG, onview });
    await fireEvent.click(screen.getByRole('button', { name: 'View as triad' }));
    expect(onview).toHaveBeenCalledTimes(1);
  });
});

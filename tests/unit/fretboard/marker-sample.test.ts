// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MarkerSample from '../../../src/lib/fretboard/MarkerSample.svelte';

const svg = (c: HTMLElement) => c.querySelector('svg') as SVGElement;

describe('MarkerSample', () => {
  it('is always aria-hidden', () => {
    const { container } = render(MarkerSample, { fn: 'root' });
    expect(svg(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the root as a square, fifth as a diamond, degree as an outlined circle', () => {
    expect(render(MarkerSample, { fn: 'root' }).container.querySelector('rect')).not.toBeNull();
    expect(render(MarkerSample, { fn: 'fifth' }).container.querySelector('polygon')).not.toBeNull();
    expect(
      render(MarkerSample, { fn: 'degree' }).container.querySelector('circle.outline')
    ).not.toBeNull();
  });

  it('selected note uses the highlighted class', () => {
    const { container } = render(MarkerSample, { fn: 'neutral', emphasis: 'highlighted' });
    expect(svg(container).classList.contains('highlighted')).toBe(true);
  });

  it('octave sample carries the tone class', () => {
    const { container } = render(MarkerSample, {
      fn: 'neutral',
      emphasis: 'highlighted',
      tone: 3
    });
    expect(svg(container).classList.contains('tone-3')).toBe(true);
  });

  it('comparison variant adds the comparison class', () => {
    const { container } = render(MarkerSample, { fn: 'third', variant: 'comparison' });
    expect(svg(container).classList.contains('comparison')).toBe(true);
  });

  it('ring draws a connection ring, absent by default', () => {
    expect(
      render(MarkerSample, { fn: 'root', ring: true }).container.querySelector('.connection-ring')
    ).not.toBeNull();
    expect(
      render(MarkerSample, { fn: 'root' }).container.querySelector('.connection-ring')
    ).toBeNull();
  });
});

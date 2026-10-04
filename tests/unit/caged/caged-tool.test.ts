import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { AF_1_12, AF_8 } from '../../../src/lib/instrument/fixtures';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import CagedTool from '../../../src/lib/tools/caged/CagedTool.svelte';

beforeEach(() => resetCagedForTests());

describe('CagedTool', () => {
  it('shows the key heading and the fretboard with the CAGED model', () => {
    render(CagedTool);
    expect(screen.getByText('C major')).toBeTruthy();
    const board = screen.getByRole('region', { name: 'Fretboard' });
    expect(within(board).getByRole('grid', { name: 'Fretboard' })).toBeTruthy();
    expect(within(board).getAllByText('C shape · roots on strings 5, 2').length).toBeGreaterThan(0);
    expect(within(board).getAllByText('D shape · roots on strings 4, 2').length).toBeGreaterThan(0);
  });

  it('has no layer, label, connection, focus, Listen or link controls', () => {
    render(CagedTool);
    for (const name of [
      /layer/i,
      /label|names|intervals/i,
      /connect/i,
      /focus/i,
      /listen/i,
      /link/i
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByRole('radio', { name })).toBeNull();
      expect(screen.queryByRole('checkbox', { name })).toBeNull();
    }
    // The only button on the board is the description toggle; tags are not buttons.
    const buttons = within(screen.getByRole('region', { name: 'Fretboard' })).queryAllByRole(
      'button'
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Show text description']);
  });

  describe('key selection (US2)', () => {
    const keyGroup = () => screen.getByRole('group', { name: 'Key' });

    it('offers a labelled group of 12 keys in chromatic order from C', () => {
      render(CagedTool);
      const keys = within(keyGroup()).getAllByRole('button');
      expect(keys).toHaveLength(12);
      expect(keys[0].getAttribute('aria-label')).toBe('C');
      expect(keys[7].getAttribute('aria-label')).toBe('G');
      expect(keys.filter((k) => k.getAttribute('aria-pressed') === 'true')).toEqual([keys[0]]);
    });

    it('shows Switch only for altered roots, labelled with noteLabel glyphs', async () => {
      render(CagedTool);
      expect(screen.queryByRole('button', { name: /^Switch to/ })).toBeNull();
      await fireEvent.click(within(keyGroup()).getAllByRole('button')[1]);
      const sw = screen.getByRole('button', { name: 'Switch to C♯' });
      expect(screen.getByText('D♭ major')).toBeTruthy();
      await fireEvent.click(sw);
      expect(screen.getByText('C♯ major')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Switch to D♭' })).toBeTruthy();
    });

    it('selecting a key updates heading and tags', async () => {
      render(CagedTool);
      await fireEvent.click(within(keyGroup()).getAllByRole('button')[7]);
      expect(screen.getByText('G major')).toBeTruthy();
      const board = screen.getByRole('region', { name: 'Fretboard' });
      expect(
        within(board).getAllByText('G shape · roots on strings 6, 3, 1').length
      ).toBeGreaterThan(0);
    });
  });

  describe('quality (US3)', () => {
    const quality = () => screen.getByRole('radiogroup', { name: 'Quality' });

    it('offers Major / Minor, defaults to Major', () => {
      render(CagedTool);
      const radios = within(quality()).getAllByRole('radio');
      expect(radios.map((r) => r.textContent?.trim())).toEqual(['Major', 'Minor']);
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    });

    it('changing it updates tags and heading', async () => {
      render(CagedTool);
      await fireEvent.click(within(quality()).getByRole('radio', { name: 'Minor' }));
      expect(screen.getByText('C minor')).toBeTruthy();
      const board = screen.getByRole('region', { name: 'Fretboard' });
      expect(within(board).getAllByText('Cm shape · roots on strings 5, 2').length).toBeGreaterThan(
        0
      );
      expect(
        within(quality()).getByRole('radio', { name: 'Minor' }).getAttribute('aria-checked')
      ).toBe('true');
    });
  });

  describe('fit note (US4)', () => {
    it('renders a status paragraph only when fewer than five shapes fit', () => {
      caged.useInstrument(AF_1_12);
      render(CagedTool);
      const note = screen.getByRole('status');
      expect(note.tagName).toBe('P');
      expect(note.textContent).toBe('With 12 frets, 4 shapes fit on the fretboard');
    });

    it('is absent at 22 frets', () => {
      render(CagedTool);
      expect(screen.queryByText(/shapes fit on the fretboard/)).toBeNull();
    });
  });

  describe('other tunings (US5)', () => {
    it('shows only the unavailable message in zone C, keeping the controls', () => {
      caged.useInstrument(AF_8);
      render(CagedTool);
      const zone = screen.getByRole('region', { name: 'Fretboard' });
      const note = within(zone).getByRole('status');
      expect(note.tagName).toBe('P');
      expect(note.textContent).toBe(
        "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet."
      );
      expect(within(zone).queryByRole('grid')).toBeNull();
      expect(within(zone).queryAllByRole('button')).toEqual([]);
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(screen.getByText('C major')).toBeTruthy();
      const keys = within(screen.getByRole('group', { name: 'Key' })).getAllByRole('button');
      expect(keys[0].getAttribute('aria-pressed')).toBe('true');
      expect(
        within(screen.getByRole('radiogroup', { name: 'Quality' }))
          .getByRole('radio', { name: 'Major' })
          .getAttribute('aria-checked')
      ).toBe('true');
    });
  });

  describe('Reset tool (US6)', () => {
    it('is a button in zone D that calls caged.reset()', async () => {
      render(CagedTool);
      caged.selectRoot(7);
      const button = screen.getByRole('button', { name: 'Reset tool' });
      await fireEvent.click(button);
      expect(caged.state.rootPc).toBe(0);
      expect(screen.getByText('C major')).toBeTruthy();
    });
  });
});

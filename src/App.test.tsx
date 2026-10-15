import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import { levels } from './engine';

const play = vi.hoisted(() => vi.fn());
vi.mock('./feedback', async original => ({ ...await original<typeof import('./feedback')>(), createSoundPlayer: () => ({ play, close: vi.fn() }) }));
const button = (name: string | RegExp) => screen.getByRole('button', { name, hidden: true });
const click = (name: string | RegExp) => fireEvent.click(button(name));
const node = (id: string) => document.querySelector<HTMLElement>(`[aria-label^="Node ${id}:"]`)!;
const swap = (a: string, b: string) => { fireEvent.click(node(a)); fireEvent.click(node(b)); };
const score = () => document.querySelector('[aria-label^="Your picture,"]')!.getAttribute('aria-label');
const choose = (id: number) => {
  click('The puzzles');
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`Preview: ${levels[id - 1].title}`) }));
};
beforeEach(() => { play.mockClear(); });

describe('campaign interactions', () => {
  test('selects and cancels, previews regions, marks differences, wins, undoes, resets, and saves stars', () => {
    render(<App />);
    expect(score()).toContain('0 percent');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(document.querySelectorAll('.pixel-wrong')).toHaveLength(64);
    fireEvent.click(node('b'));
    expect(node('b')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('.pixel-dim')).toHaveLength(32);
    fireEvent.click(node('b')); expect(node('b')).toHaveAttribute('aria-pressed', 'false');
    swap('b', 'c');
    expect(score()).toContain('100 percent');
    expect(screen.getByText('Everything clicked.')).toBeVisible();
    expect(document.querySelector('.feedback-win')).not.toBeNull();
    expect(play).toHaveBeenCalledWith('win', true);
    expect(JSON.parse(localStorage.getItem('branch-bloom-progress-v1')!)).toEqual({ '1': 1 });
    fireEvent.click(node('b')); expect(score()).toContain('100 percent');
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true }); expect(score()).toContain('0 percent');
    fireEvent.click(node('b')); fireEvent.keyDown(document, { key: 'Escape' });
    expect(node('b')).toHaveAttribute('aria-pressed', 'false');
    swap('b', 'c');
    click('Reset'); expect(score()).toContain('0 percent');
    expect(button('Undo')).toBeDisabled();
    click('Next puzzle'); expect(screen.getByRole('heading', { name: levels[1].title })).toBeVisible();
    click('Previous puzzle'); expect(screen.getByRole('heading', { name: levels[0].title })).toBeVisible();
  });

  test('plays all 12 puzzles with supplied moves and celebrates campaign completion', () => {
    render(<App />);
    for (const level of levels) {
      for (const [a, b] of [...level.scramble].reverse()) swap(a, b);
      expect(score()).toContain('100 percent');
      expect(document.querySelector('.success-card .stars')).toHaveAttribute('aria-label', '3 of 3 stars');
      if (level.id < 12) fireEvent.click(within(document.querySelector('.game-actions') as HTMLElement).getByRole('button', { name: 'Next puzzle', hidden: true }));
    }
    expect(screen.getByText('A beautiful finish.')).toBeVisible();
    click('See your journey');
    expect(screen.getByText(/12 of 12 pictures restored/)).toBeVisible();
  });

  test('hints offer a legal recovery after wrong moves and invalid subtree swaps explain the constraint', () => {
    render(<App />); choose(11);
    swap('a', 'b');
    expect(screen.getByRole('status')).toHaveTextContent('Choose separate branches');
    fireEvent.keyDown(document, { key: 'Escape' });
    click('A little hint'); expect(document.querySelectorAll('.hinted')).toHaveLength(2);
    fireEvent.click(node('a')); click('Reset');
    choose(3); swap('b', 'd');
    expect(document.querySelector('.feedback-swap')).not.toBeNull();
    click('Undo'); expect(button('Undo')).toBeDisabled();
  });

  test('an invalid equal rule is rejected and star ratings reflect extra moves', () => {
    render(<App />); choose(5);
    swap('a', 'c'); expect(screen.getByRole('status')).toHaveTextContent('Choose two different');
    choose(3);
    swap('b', 'd'); swap('d', 'g'); swap('b', 'd');
    click('Reset');
    expect(score()).not.toContain('100 percent');
  });
});

describe('storage and dialogs', () => {
  test.each(['broken json', '[]', 'null', '17', '{"99":2,"1":-2,"2":1.2,"3":3}'])('ignores invalid stored progress: %s', value => {
    localStorage.setItem('branch-bloom-progress-v1', value); render(<App />);
    click('The puzzles');
    expect(screen.getByRole('dialog')).toBeVisible(); click('Close dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test('storage errors do not prevent playing and progress does not regress', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    render(<App />); swap('b', 'c'); expect(score()).toContain('100 percent');
    click('Reset'); swap('b', 'c'); expect(score()).toContain('100 percent');
  });
  test('help and picker support cancel, backdrop, close, and start buttons', () => {
    render(<App />);
    fireEvent.click(document.querySelector('.help-button')!);
    expect(screen.getByText('A picture made of decisions.')).toBeVisible();
    click('Let’s make something click');
    fireEvent.click(document.querySelector('.mobile-help')!);
    fireEvent(screen.getByRole('dialog'), new Event('cancel')); expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
    click('The puzzles'); fireEvent.click(screen.getByRole('dialog'));
    click('The puzzles'); click('Close dialog');
    fireEvent.click(document.querySelector('.level-picker')!); click('Close dialog');
    fireEvent.click(screen.getByRole('link', { name: 'Branch and Bloom home' }));
    expect(score()).toContain('0 percent');
  });
  test('sound toggle persists and mute is honored by feedback', () => {
    render(<App />); click('Mute sound'); expect(localStorage.getItem('branch-bloom-sound')).toBe('off');
    fireEvent.click(node('b')); expect(play).toHaveBeenLastCalledWith('select', false);
    click('Enable sound'); expect(localStorage.getItem('branch-bloom-sound')).toBe('on');
    expect(play).toHaveBeenLastCalledWith('select');
  });
});

describe('creative studio', () => {
  test('builds, paints, edits selected rules, collapses, undoes, exports, and preserves a draft across navigation', () => {
    const fillRect = vi.fn(), toDataURL = vi.fn(() => 'data:image/png;base64,abc');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURL);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />); click(/Creative studio/);
    expect(button('Split region')).toBeDisabled();
    fireEvent.click(node('root')); click('Paint Rose');
    expect(node('root')).toHaveTextContent('Rose');
    fireEvent.change(screen.getByLabelText('Split axis'), { target: { value: 'y' } });
    fireEvent.change(screen.getByLabelText('Split coordinate'), { target: { value: '3' } });
    click('Split region'); expect(document.querySelectorAll('.tree-node')).toHaveLength(3);
    expect(node('root')).toHaveTextContent('y');
    click('Update rule'); // No-op edits must not create an undo step.
    fireEvent.change(screen.getByLabelText('Split coordinate'), { target: { value: '5' } }); click('Update rule');
    expect(node('root')).toHaveTextContent('5');
    click('Save picture'); expect(fillRect).toHaveBeenCalledTimes(64); expect(toDataURL).toHaveBeenCalledOnce();
    click('Collapse branch to selected color'); expect(document.querySelectorAll('.tree-node')).toHaveLength(1);
    click('Undo'); expect(document.querySelectorAll('.tree-node')).toHaveLength(3);
    fireEvent.click(node('root')); expect(screen.getByLabelText('Split axis')).toHaveValue('y'); expect(screen.getByLabelText('Split coordinate')).toHaveValue('5');
    click('The puzzles'); click(/Creative studio/); expect(document.querySelectorAll('.tree-node')).toHaveLength(3);
    click('The puzzles'); choose(3); click(/Creative studio/); expect(document.querySelectorAll('.tree-node')).toHaveLength(3);
    click('Reset'); expect(document.querySelectorAll('.tree-node')).toHaveLength(1);
  });
  test('keyboard undo leaves native input controls alone and works with the Mac shortcut', () => {
    render(<App />); click(/Creative studio/); fireEvent.click(node('root')); click('Split region');
    const select = screen.getByLabelText('Split coordinate');
    fireEvent.keyDown(select, { key: 'z', ctrlKey: true }); expect(document.querySelectorAll('.tree-node')).toHaveLength(3);
    fireEvent.keyDown(document, { key: 'z', metaKey: true }); expect(document.querySelectorAll('.tree-node')).toHaveLength(1);
  });
});

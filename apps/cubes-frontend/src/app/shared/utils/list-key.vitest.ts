import { describe, expect, it } from 'vitest';

import { shouldIgnoreListKey } from './list-key';

/** A keydown whose target is a real element in the document. */
function keyOn(html: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  document.body.innerHTML = html;
  const target = document.body.firstElementChild as HTMLElement;
  const event = new KeyboardEvent('keydown', { key: 'ArrowRight', ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('shouldIgnoreListKey', () => {
  it('lets an arrow through when nothing owns it', () => {
    expect(shouldIgnoreListKey(keyOn('<div>the page</div>'))).toBe(false);
  });

  it.each([
    ['<input type="text">', 'a text field'],
    ['<textarea></textarea>', 'a textarea'],
    ['<select><option>a</option></select>', 'a select, which walks its options with the arrows'],
    ['<summary>more</summary>', 'a summary, which is reached with them'],
    ['<div contenteditable="true">x</div>', 'editable content'],
  ])('ignores it on %s (%s)', (html) => {
    expect(shouldIgnoreListKey(keyOn(html))).toBe(true);
  });

  it('ignores it anywhere inside an open dialog', () => {
    // The listener is on the window, so a dialog's own buttons would otherwise
    // page the list behind it while the reader is using the dialog.
    document.body.innerHTML = '<div class="modal"><button id="b">Connect</button></div>';
    const target = document.getElementById('b')!;
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(event, 'target', { value: target });
    expect(shouldIgnoreListKey(event)).toBe(true);
  });

  it.each([['altKey'], ['ctrlKey'], ['metaKey']])('ignores it with %s held, that is a shortcut', (mod) => {
    expect(shouldIgnoreListKey(keyOn('<div>x</div>', { [mod]: true }))).toBe(true);
  });

  it('does not throw when the target is not an element', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(event, 'target', { value: window });
    expect(shouldIgnoreListKey(event)).toBe(false);
  });
});

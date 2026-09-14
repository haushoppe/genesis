/**
 * Whether an arrow key pressed on the window belongs to something other than
 * the page's own list navigation.
 *
 * Both the minted-cubes list and a cube's page put a `keydown` listener on the
 * WINDOW, so each hears every key in the document, including keys meant for a
 * control that has focus. Excluding text entry is not enough: a `<select>`
 * moves through its options with the arrows, a `<summary>` and the buttons in a
 * dialog are reached with them, and a modifier means a browser or operating
 * system shortcut. Without the rest of these, picking an account type in the
 * connect dialog pages the list behind it.
 */
export function shouldIgnoreListKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  // Both the property and the attribute: `isContentEditable` is the right
  // question in a browser, and jsdom does not implement it, so a unit test
  // could not otherwise cover this branch at all.
  if (target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SUMMARY'].includes(target.tagName)) return true;

  // Anything inside an open dialog: its own controls own the arrows.
  return target.closest('.modal, ngb-modal-window, [role="dialog"]') !== null;
}

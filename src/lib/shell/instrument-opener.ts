/** The element that opened the panel; it regains focus when the panel closes (contract §1). */
let opener: HTMLElement | null = null;

export function rememberOpener(el: HTMLElement | null): void {
  opener = el;
}

export function takeOpener(): HTMLElement | null {
  const el = opener;
  opener = null;
  return el;
}

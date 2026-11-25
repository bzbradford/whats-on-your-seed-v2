// Print helpers (legacy `printCurrentView` / `printMatrix`): open the disclosures
// that should print, print, then restore what the user had open.

export type PrintView = 'products' | 'matrix' | 'resources';

export function printCurrentView(view: PrintView): void {
  const opened = [...document.querySelectorAll('details')].filter((x) => x.open);
  const printable = [
    ...document.querySelectorAll<HTMLDetailsElement>(`#${view} details`),
    document.getElementById('tool-disclaimer') as HTMLDetailsElement | null,
  ].filter((x): x is HTMLDetailsElement => Boolean(x));
  printable.forEach((x) => (x.open = true));
  try {
    window.print();
  } finally {
    printable.forEach((x) => (x.open = opened.includes(x)));
  }
}

/** Print the comparison matrix with every pest list expanded. */
export function printMatrix(): void {
  const lists = [...document.querySelectorAll<HTMLDetailsElement>('#matrix-body details')];
  const opened = lists.map((x) => x.open);
  lists.forEach((x) => (x.open = true));
  try {
    window.print();
  } finally {
    lists.forEach((x, i) => (x.open = opened[i]));
  }
}

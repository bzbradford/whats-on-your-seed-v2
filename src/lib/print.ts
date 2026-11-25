// Print helper (legacy `printMatrix`): open every pest list, print, then restore.

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

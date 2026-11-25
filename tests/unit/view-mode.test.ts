import { expect, it } from 'vitest';
import { getViewMode } from '../../src/lib/view-mode';

it.each([
  ['', 'full'],
  ['?q=corn', 'full'],
  ['?embed', 'embed'],
  ['?embed=1&q=corn', 'embed'],
])('getViewMode(%j) is %s', (search, mode) => {
  expect(getViewMode(search)).toBe(mode);
});

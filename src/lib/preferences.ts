// Per-viewer preferences kept in localStorage. Storage may be blocked in a
// cross-origin iframe, so every access is wrapped and falls back to the default.

export type ProductView = 'cards' | 'list';
export const VIEW_KEY = 'cpn-seed-view';

export function loadView(storage?: Storage | null): ProductView {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    return store?.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export function saveView(view: ProductView, storage?: Storage | null): void {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    store?.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered; the view still switches.
  }
}

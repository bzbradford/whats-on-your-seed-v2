export type ViewMode = 'full' | 'embed';

/** `?embed` (any value) selects the compact layout for iframing; otherwise full page. */
export function getViewMode(search: string): ViewMode {
  return new URLSearchParams(search).has('embed') ? 'embed' : 'full';
}

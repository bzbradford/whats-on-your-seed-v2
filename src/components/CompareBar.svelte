<script lang="ts">
  import { getApp } from '../lib/context';

  const app = getApp();
  const ps = $derived(app.selectedProducts);
  const hidden = $derived(!ps.length || app.view === 'matrix');
  let bar: HTMLDivElement | undefined = $state();

  /** Reserve page space under the fixed tray so it never covers content. */
  function updateClearance() {
    if (!bar) return;
    const height =
      bar.hidden || getComputedStyle(bar).position !== 'fixed'
        ? 0
        : bar.getBoundingClientRect().height + 32;
    document.documentElement.style.setProperty('--comparison-clearance', height + 'px');
  }

  $effect(() => {
    void hidden;
    void ps;
    requestAnimationFrame(updateClearance);
  });

  $effect(() => {
    if (!bar) return;
    const observer = 'ResizeObserver' in window ? new ResizeObserver(updateClearance) : null;
    observer?.observe(bar);
    window.addEventListener('resize', updateClearance);
    // Keep the focused control clear of the fixed tray.
    const onFocusIn = (event: FocusEvent) =>
      requestAnimationFrame(() => {
        const target = event.target as HTMLElement;
        if (
          !bar ||
          bar.hidden ||
          getComputedStyle(bar).position !== 'fixed' ||
          bar.contains(target) ||
          (document.getElementById('dialog') as HTMLDialogElement | null)?.open
        )
          return;
        const rect = target.getBoundingClientRect();
        const top = bar.getBoundingClientRect().top;
        if (rect.bottom > top - 12 && rect.top < window.innerHeight)
          window.scrollBy({ top: rect.bottom - top + 24, behavior: 'instant' });
      });
    document.addEventListener('focusin', onFocusIn);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateClearance);
      document.removeEventListener('focusin', onFocusIn);
    };
  });
</script>

<div
  class="comparebar"
  id="comparebar"
  role="region"
  aria-label="Selected products"
  {hidden}
  bind:this={bar}
>
  <div class="summary">
    <b id="selected-count">{ps.length} of 4 products selected</b><span id="selected-names">
      {ps.map((p) => p.name).join(' · ')}
    </span>
  </div>
  <button
    class="quiet"
    id="clear-selected"
    aria-label="Clear all selected products"
    onclick={() => app.clearComparison()}
  >
    Clear
  </button><button id="compare" disabled={!ps.length} onclick={() => app.compare()}>
    Compare products →
  </button>
</div>

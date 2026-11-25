<script lang="ts">
  import { ToggleGroup } from 'bits-ui';
  import { getApp } from '../lib/context';
  import type { ProductView } from '../lib/preferences';

  // Card / List pill (Bits UI ToggleGroup, single choice: items are radios).
  const app = getApp();
  const VIEWS: { value: ProductView; label: string }[] = [
    { value: 'cards', label: 'Cards' },
    { value: 'list', label: 'List' },
  ];
</script>

<span class="pill">
  <ToggleGroup.Root
    type="single"
    class="view-toggle"
    aria-label="Results view"
    value={app.productView}
    onValueChange={(value) => {
      // Clicking the active item would clear the choice; keep one view selected.
      if (value === 'cards' || value === 'list') app.setProductView(value);
    }}
  >
    {#each VIEWS as v (v.value)}
      <ToggleGroup.Item value={v.value} class="view-toggle-item">{v.label}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</span>

<style>
  /* Segmented pill in the CPN greens. Bits renders the elements; reach them from .pill. */
  .pill :global(.view-toggle) {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    border: 1px solid #87967f;
    border-radius: 999px;
    background: #fff;
  }
  .pill :global(.view-toggle-item) {
    min-height: 36px;
    padding: 4px 16px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--green-dark);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .pill :global(.view-toggle-item:hover:not([data-state='on'])) {
    background: #edf1e8;
  }
  .pill :global(.view-toggle-item[data-state='on']) {
    background: var(--green-dark);
    color: #fff;
  }
</style>

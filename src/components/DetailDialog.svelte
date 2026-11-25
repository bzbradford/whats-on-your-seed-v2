<script lang="ts">
  import { tick } from 'svelte';
  import { getApp } from '../lib/context';
  import { fmt } from '../lib/format';
  import { ref } from '../lib/product-facts';
  import IngredientDetail from './IngredientDetail.svelte';
  import ProductDetail from './ProductDetail.svelte';

  const DEFAULT_NOTE = 'Product facts, not efficacy rankings.';
  const app = getApp();
  let dialog: HTMLDialogElement | undefined = $state();
  let title: HTMLHeadingElement | undefined = $state();

  const product = $derived(
    app.dialog?.kind === 'product'
      ? app.catalog.products.find((p) => p.id === (app.dialog as { id: string }).id)
      : undefined,
  );
  const ingredient = $derived(
    app.dialog?.kind === 'ingredient'
      ? ref(app.catalog.ingredient_reference, { name: app.dialog.name })
      : undefined,
  );

  // Keep the last content while closed, as legacy did (the closed dialog isn't shown).
  let shown = $state<{ title: string; note: string }>({ title: '', note: DEFAULT_NOTE });

  $effect(() => {
    const content = app.dialog;
    if (!dialog) return;
    if (!content) {
      if (dialog.open) dialog.close();
      return;
    }
    if (product)
      shown = {
        title: product.name,
        note:
          'EPA workbook created ' +
          fmt(product.source_snapshot_date) +
          '. Follow the current product label.',
      };
    else if (ingredient) shown = { title: ingredient.name, note: DEFAULT_NOTE };
    else return;
    if (!dialog.open) dialog.showModal();
    void tick().then(() => {
      if (dialog) dialog.scrollTop = 0;
      title?.focus({ preventScroll: true });
    });
  });
</script>

<dialog
  id="dialog"
  aria-labelledby="dialog-title"
  bind:this={dialog}
  oncancel={(event) => {
    event.preventDefault();
    app.closeDialog();
  }}
>
  <div class="dialog-head">
    <h2 id="dialog-title" tabindex="-1" bind:this={title}>{shown.title}</h2>
    <button id="close-dialog" aria-label="Close dialog" onclick={() => app.closeDialog()}>
      Close
    </button>
  </div>
  <div class="dialog-body" id="dialog-body">
    {#if product}
      <ProductDetail p={product} />
    {:else if ingredient}
      <IngredientDetail a={ingredient} />
    {/if}
  </div>
  <div class="dialog-foot">
    <span id="dialog-note">{shown.note}</span><button id="print" onclick={() => window.print()}>
      Print / Save PDF
    </button>
  </div>
</dialog>

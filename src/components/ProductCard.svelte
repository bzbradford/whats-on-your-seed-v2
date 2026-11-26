<script lang="ts">
  import { getApp } from '../lib/context';
  import { fmt, shortSite } from '../lib/format';
  import { labelAccess } from '../lib/labels';
  import {
    ingredientsEyebrow,
    moaGroups,
    quality,
    shownIngredientCount,
  } from '../lib/product-facts';
  import type { Product } from '../lib/types';
  import ExtLink from './ExtLink.svelte';
  import LabelAction from './LabelAction.svelte';
  import PurposeBadge from './PurposeBadge.svelte';
  import RecordFlag from './RecordFlag.svelte';
  import SafetyBadges from './SafetyBadges.svelte';

  let { product: p }: { product: Product } = $props();
  const app = getApp();
  const reference = $derived(app.catalog.ingredient_reference);
  const selected = $derived(app.selected.includes(p.id));
  const shown = $derived(shownIngredientCount(p.ingredients.length));
  /** FRAC / IRAC codes, only when the ingredients have reviewed assignments. */
  const groups = $derived(
    [
      ['FRAC', moaGroups(reference, p, 'frac')],
      ['IRAC', moaGroups(reference, p, 'irac')],
    ]
      .filter(([, codes]) => codes.length)
      .map(([scheme, codes]) => `${scheme} ${(codes as string[]).join(', ')}`)
      .join(' · '),
  );

  function onCompareChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (!app.setComparison(p.id, input.checked)) input.checked = app.selected.includes(p.id);
  }
</script>

<article class="product {selected ? 'selected' : ''}">
  <div class="product-top">
    <div>
      <h3>
        <button
          class="product-name"
          aria-haspopup="dialog"
          data-detail={p.id}
          onclick={() => app.openDialog({ kind: 'product', id: p.id })}
        >
          {p.name}
        </button>
      </h3>
      <div class="product-sub">
        {p.registrant} <span aria-hidden="true">·</span> EPA {p.registration_number}
      </div>
      <RecordFlag product={p} />
    </div>
    <div class="chips">
      {#each p.purposes as purpose, i (i)}{i ? ' ' : ''}<PurposeBadge {purpose} />{/each}
    </div>
  </div>
  <div class="product-main">
    <div>
      <div class="eyebrow">{ingredientsEyebrow(p)}</div>
      <div class="ingredients">
        {#each p.ingredients.slice(0, shown) as a, i (i)}
          <button
            class="ingredient-pill"
            aria-haspopup="dialog"
            data-ingredient={a.name}
            onclick={() => app.openDialog({ kind: 'ingredient', name: a.name })}
          >
            {a.name}{#if a.percent != null}<span class="pct">{a.percent}%</span>{/if}
          </button>
        {:else}
          <span class="small muted">Not available in source entry</span>
        {/each}
        {#if p.ingredients.length > shown}<button
            class="more-ingredients"
            aria-haspopup="dialog"
            data-detail={p.id}
            aria-label="All {p.ingredients.length} ingredients of {p.name}"
            onclick={() => app.openDialog({ kind: 'product', id: p.id })}
          >
            +{p.ingredients.length - shown} more
          </button>{/if}
      </div>
    </div>
    <div>
      <div class="eyebrow">Matching crop sites</div>
      <div class="crop-text">
        {#each p.sites as site (site)}<span class="crop-site">{shortSite(site)}</span>{/each}
      </div>
    </div>
  </div>
  <div class="safety-strip">
    <SafetyBadges product={p} />{#if groups}<span class="groups">{groups}</span>{/if}
  </div>
  <div class="product-labels">
    <LabelAction product={p} />{#each labelAccess(p).supplemental as s (s.url)}<span
        class="label-supplemental"
      >
        <ExtLink url={s.url} text={'Supplemental labeling · ' + fmt(s.date)} />
      </span>{/each}
  </div>
  <div class="product-bottom">
    <span class="muted">{quality(p)} · Status {fmt(p.status_date)}</span><label
      class="comparecheck"
    >
      <input
        type="checkbox"
        data-select={p.id}
        checked={selected}
        aria-label="Compare {p.name}, EPA {p.registration_number}"
        onchange={onCompareChange}
      />Compare
    </label>
  </div>
</article>

<style>
  /*
   * Slimmed card (4a.2): tighter spacing, no repeated label explanation (it is once above
   * the results), FRAC/IRAC only when assigned, coverage detail in the dialog.
   */
  .product {
    margin-bottom: 14px;
  }
  .product .product-top {
    padding: 16px 20px 6px;
  }
  .product :global(h3) {
    font-size: 1.5rem;
  }
  .product .product-main {
    padding: 0 20px 10px;
    gap: 16px;
  }
  .product .product-main :global(.eyebrow) {
    margin: 4px 0;
  }
  .product .safety-strip {
    margin: 0 20px;
    padding: 10px 0;
    gap: 6px 12px;
  }
  .product .product-labels {
    padding: 0 20px 12px;
    gap: 6px 14px;
  }
  .product .product-bottom {
    padding: 6px 20px;
  }
  .groups {
    font-weight: 600;
    color: #354936;
  }
  .label-supplemental {
    font-size: 0.8125rem;
  }
  @media (max-width: 700px) {
    .product .product-top {
      padding: 14px 16px 6px;
    }
    .product .product-main {
      padding: 0 16px 8px;
    }
    .product .safety-strip {
      margin: 0 16px;
    }
    .product .product-labels {
      padding: 0 16px 10px;
    }
    .product .product-bottom {
      padding: 6px 16px;
    }
  }
  .more-ingredients {
    min-height: 32px;
    padding: 2px 0;
    border: 0;
    background: none;
    color: var(--green-dark);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .more-ingredients:hover:not(:disabled) {
    background: none;
  }
</style>

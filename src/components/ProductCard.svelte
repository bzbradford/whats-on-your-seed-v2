<script lang="ts">
  import { getApp } from '../lib/context';
  import { fmt, shortSite } from '../lib/format';
  import { labelAccess } from '../lib/labels';
  import { coverageText, groupText, ingredientsEyebrow, quality } from '../lib/product-facts';
  import type { Product } from '../lib/types';
  import LabelAction from './LabelAction.svelte';
  import PurposeBadge from './PurposeBadge.svelte';
  import SafetyBadges from './SafetyBadges.svelte';

  let { product: p }: { product: Product } = $props();
  const app = getApp();
  const reference = $derived(app.catalog.ingredient_reference);
  const selected = $derived(app.selected.includes(p.id));

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
    </div>
    <div class="chips">
      {#each p.purposes as purpose, i (i)}{i ? ' ' : ''}<PurposeBadge {purpose} />{/each}
    </div>
  </div>
  <div class="product-main">
    <div>
      <div class="eyebrow">{ingredientsEyebrow(p)}</div>
      <div class="ingredients">
        {#each p.ingredients as a, i (i)}
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
    <div class="eyebrow">EPA hazards &amp; resistance groups</div>
    <SafetyBadges product={p} /><span>
      FRAC: {groupText(reference, p, 'frac')} · IRAC: {groupText(reference, p, 'irac')}
    </span><span class="muted coverage">{coverageText(reference, p)}</span>
  </div>
  <div class="product-labels">
    <LabelAction product={p} />
    <p class="label-meta">{labelAccess(p).note}</p>
  </div>
  <div class="product-bottom">
    <span class="muted">{quality(p)} · Status date {fmt(p.status_date)}</span><label
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

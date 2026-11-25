<script lang="ts">
  import { getApp } from '../lib/context';
  import { fmt, s } from '../lib/format';
  import { productsWithIngredient, quality } from '../lib/product-facts';
  import type { IngredientReference } from '../lib/types';
  import ExtLink from './ExtLink.svelte';
  import PurposeBadge from './PurposeBadge.svelte';

  let { a }: { a: IngredientReference } = $props();
  const app = getApp();
  const ps = $derived(productsWithIngredient(app.catalog.products, a.name));
</script>

<div><PurposeBadge purpose={a.purpose} /> <span class="chip">{a.group}</span></div>
<h3>{a.classification}</h3>
<p>{a.explanation}</p>
<p class="small muted">
  Mode-of-action groups are not efficacy ratings. Ingredient lists may be incomplete where flagged.
</p>
<h3>Listed in {ps.length} catalog product{s(ps.length)}</h3>
{#each ps as p (p.id)}
  <p>
    <button
      data-detail={p.id}
      aria-haspopup="dialog"
      onclick={() => app.openDialog({ kind: 'product', id: p.id })}
    >
      {p.name}
    </button>
    <span class="small muted">{quality(p)}</span>
  </p>
{/each}
{#if a.source_version}
  <p class="small muted">{a.source_version} · reviewed {fmt(a.reviewed_on)}</p>
{/if}
{#if a.source_url}<ExtLink url={a.source_url} text="Classification source" />{/if}

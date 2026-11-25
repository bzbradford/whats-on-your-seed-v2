<script lang="ts">
  import { untrack } from 'svelte';
  import { getApp } from '../lib/context';
  import { s } from '../lib/format';
  import { ingredientCountText, ingredientGuide } from '../lib/ingredients';
  import Icon from './Icon.svelte';
  import PrintViewButton from './PrintViewButton.svelte';
  import PurposeBadge from './PurposeBadge.svelte';

  const app = getApp();
  const ready = $derived(app.loadState === 'ready');
  const entries = $derived(ready ? ingredientGuide(app.catalog, app.ingredientQuery) : []);

  // Legacy renderIngredients(): announce the count while this tab is showing.
  $effect(() => {
    const n = entries.length;
    if (!ready || app.view !== 'ingredients') return;
    untrack(() =>
      app.announcer.announce(ingredientCountText(n) + (n ? ' found.' : '. Try a broader search.')),
    );
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="ingredients"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-ingredients"
  hidden={app.view !== 'ingredients'}
>
  <div class="introline">
    <div>
      <h2>Understand each component.</h2>
      <p>Purpose explains what it does. FRAC / IRAC groups describe mode of action.</p>
    </div>
    <div class="search" style="max-width:350px">
      <label for="ingredient-search">Search ingredient guide</label><span aria-hidden="true">
        <Icon name="search" />
      </span><input
        id="ingredient-search"
        type="search"
        placeholder="Find an ingredient or group…"
        bind:value={app.ingredientQuery}
      />
    </div>
    <PrintViewButton class="" />
  </div>
  <p id="ingredient-count" class="small muted">
    {ready ? ingredientCountText(entries.length) : ''}
  </p>
  <div class="ingredient-grid" id="ingredient-grid">
    {#each entries as { key, info: a, count } (key)}
      <article class="ingredient-card">
        <span class="chip">{a.group}</span>
        <h3>{a.name}</h3>
        <PurposeBadge purpose={a.purpose} />
        <p class="classification">{a.classification}</p>
        <p>{a.explanation}</p>
        <footer>
          <span>{count} product{s(count)}</span><button
            class="quiet small"
            data-ingredient={a.name}
            aria-haspopup="dialog"
            aria-label="Explore {a.name}"
            onclick={() => app.openDialog({ kind: 'ingredient', name: a.name })}
          >
            Explore →
          </button>
        </footer>
      </article>
    {:else}
      {#if ready}<div class="empty">No matching ingredients.</div>{/if}
    {/each}
  </div>
</section>

<style>
  @media print {
    .ingredient-grid {
      display: grid !important;
    }
  }
</style>

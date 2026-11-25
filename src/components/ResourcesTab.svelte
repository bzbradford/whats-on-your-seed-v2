<script lang="ts">
  import { getApp } from '../lib/context';
  import { s } from '../lib/format';
  import { ingredientCountText, ingredientGuide } from '../lib/ingredients';
  import { printCurrentView } from '../lib/print';
  import Abbreviations from './Abbreviations.svelte';
  import DataGrid from './DataGrid.svelte';
  import GuideContent from './GuideContent.svelte';

  const app = getApp();
  const ready = $derived(app.loadState === 'ready');
  const entries = $derived(ready ? ingredientGuide(app.catalog, app.ingredientQuery) : []);
  let guideEl: HTMLDetailsElement | undefined = $state();

  function onIngredientInput() {
    if (app.view === 'resources' && guideEl?.open) {
      const n = ingredientGuide(app.catalog, app.ingredientQuery).length;
      app.announcer.announce(ingredientCountText(n) + (n ? ' found.' : '. Try a broader search.'));
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="resources"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-resources"
  hidden={app.view !== 'resources'}
>
  <h2>Guides &amp; sources</h2>
  <Abbreviations />
  <details class="resource-block" id="ingredient-guide" bind:this={guideEl}>
    <summary>Ingredient guide</summary>
    <div class="resource-copy">
      <section id="ingredients">
        <div class="introline">
          <div>
            <h2>Understand each component.</h2>
            <p>Purpose explains what it does. FRAC / IRAC groups describe mode of action.</p>
          </div>
          <div class="search" style="max-width:350px">
            <label for="ingredient-search">Search ingredient guide</label><span aria-hidden="true"
            ></span><input
              id="ingredient-search"
              type="search"
              placeholder="Find an ingredient or group…"
              bind:value={app.ingredientQuery}
              oninput={onIngredientInput}
            />
          </div>
        </div>
        <p id="ingredient-count" class="small muted">
          {ready ? ingredientCountText(entries.length) : ''}
        </p>
        <div class="ingredient-grid" id="ingredient-grid">
          {#each entries as { key, info: a, count } (key)}
            <article class="ingredient-card">
              <span class="chip">{a.group}</span>
              <h3>{a.name}</h3>
              <span class="purpose-badge">{a.purpose}</span>
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
    </div>
  </details>
  <section id="guide">
    <div id="guide-content">
      {#if ready}<GuideContent />{/if}
    </div>
  </section>
  <details class="resource-block" id="source-guide">
    <summary>Sources, coverage &amp; updates</summary>
    <div class="resource-copy">
      <section id="data">
        <div class="introline">
          <div>
            <h2>Information you can trace.</h2>
            <p>
              Every record retains its source. Collection dates and source dates are kept separate.
            </p>
          </div>
        </div>
        <div id="data-grid" class="data-grid">
          {#if app.loadState !== 'loading'}<DataGrid />{/if}
        </div>
      </section>
    </div>
  </details>
  <button
    type="button"
    class="text-action"
    id="print-resources"
    onclick={() => printCurrentView(app.view)}
  >
    Print guides &amp; sources
  </button>
</section>

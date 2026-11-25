<script lang="ts">
  import { untrack } from 'svelte';
  import { focusById } from '../lib/app-state.svelte';
  import { getApp } from '../lib/context';
  import { downloadCsv, exportFileNames, labelLinksCsv, resultsCsv } from '../lib/csv';
  import { DATE_ERROR, appliedFilters, siteSummary } from '../lib/filters';
  import { localDate } from '../lib/format';
  import Icon from './Icon.svelte';
  import ProductCard from './ProductCard.svelte';

  const app = getApp();
  const ready = $derived(app.loadState === 'ready');
  const n = $derived(app.result.products.length);
  const today = localDate();

  let resultsEl: HTMLDivElement | undefined = $state();
  let filtersEl: HTMLElement | undefined = $state();

  // ---- live announcements and focus restore (legacy render()) --------------

  $effect(() => {
    if (!ready) return;
    const { invalidDates } = app.result;
    const message =
      app.count +
      (n ? '. Showing ' + app.pageInfo.label : '. Try a broader search or reset your filters.');
    untrack(() => {
      if (invalidDates) {
        app.announcer.announce(DATE_ERROR, true);
        return;
      }
      app.announcer.clearAlert();
      if (app.view === 'products') app.announcer.announce(message);
    });
  });

  // If the focused result control disappears on re-render, focus the result count.
  let resultsHadFocus = false;
  $effect.pre(() => {
    void app.pageProducts;
    void app.result;
    resultsHadFocus = !!resultsEl?.contains(document.activeElement);
  });
  $effect(() => {
    void app.pageProducts;
    void app.result;
    if (resultsHadFocus && !resultsEl?.contains(document.activeElement))
      focusById('count', { preventScroll: true });
  });

  // ---- handlers --------------------------------------------------------------

  function onSiteChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const current = app.filters.sites;
    app.filters.sites = app.catalog.scope.sites.filter((site) =>
      site === input.value ? input.checked : current.includes(site),
    );
  }

  function setFiltersOpen(open: boolean) {
    app.filtersOpen = open;
    // The class toggles synchronously in legacy; focus after Svelte updates the DOM.
    queueMicrotask(() => focusById(open ? 'filter-title' : 'mobile-filter'));
  }

  function onFiltersKeydown(event: KeyboardEvent) {
    // Oct 19: Escape closes the filter drawer only at mobile widths, where it is a drawer.
    if (event.key === 'Escape' && matchMedia('(max-width:700px)').matches && app.filtersOpen) {
      event.preventDefault();
      setFiltersOpen(false);
    }
  }

  $effect(() => {
    const query = matchMedia('(max-width:700px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches && !app.filtersOpen && filtersEl?.contains(document.activeElement))
        focusById('mobile-filter');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  function exportResults() {
    downloadCsv(resultsCsv(app.catalog, app.result.products), exportFileNames.results());
    app.showToast(n + ' products exported with source and quality fields.');
  }

  function exportLabels() {
    if (!n) return;
    downloadCsv(labelLinksCsv(app.result.products), exportFileNames.labels());
    app.showToast(
      n + ' products exported in the label-link CSV. PDF documents are opened separately.',
    );
  }

  function goToPage(page: number) {
    app.page = page;
    focusById('count');
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="products"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-products"
  hidden={app.view !== 'products'}
>
  <div class="section-intro">
    <h2>Explore seed treatments</h2>
    <p>
      Start with a product name or a crop. Select <strong>Compare</strong> on any card to build your side-by-side
      view.
    </p>
  </div>
  <button
    id="mobile-filter"
    class="mobile-filters"
    aria-expanded={app.filtersOpen}
    aria-controls="filters"
    onclick={() => setFiltersOpen(!app.filtersOpen)}
  >
    {app.filtersOpen ? 'Hide filters' : 'Show filters'}
  </button>
  <div class="workspace">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <aside
      class="filter {app.filtersOpen ? 'open' : ''}"
      id="filters"
      aria-label="Product filters"
      bind:this={filtersEl}
      onkeydown={onFiltersKeydown}
    >
      <div class="filter-title">
        <h2 id="filter-title" tabindex="-1">Refine your search</h2>
        <button
          class="quiet small"
          id="reset"
          aria-label="Reset all product filters and search"
          onclick={() => app.reset()}
        >
          Reset
        </button>
      </div>
      <!-- Deviation (user decision): no state registration filter (legacy details.state-filters). -->
      <fieldset class="filter-group">
        <legend>Crop &amp; location</legend>
        <div class="field">
          <span id="crop-label">Crop / EPA site</span>
          <details class="site-picker">
            <summary id="site-summary" aria-describedby="crop-label">
              {siteSummary(app.filters.sites)}
            </summary>
            <div class="site-options" id="site-options" role="group" aria-labelledby="crop-label">
              {#each app.catalog.scope.sites as site (site)}
                <label class="check">
                  <input
                    type="checkbox"
                    value={site}
                    checked={app.filters.sites.includes(site)}
                    onchange={onSiteChange}
                  /><span>{site}</span>
                </label>
              {/each}
            </div>
          </details>
        </div>
      </fieldset>
      <fieldset class="filter-group">
        <legend>Treatment purpose</legend>
        <label class="field">
          <span>EPA product purpose</span><select id="purpose" bind:value={app.filters.purpose}>
            <option value="">All purposes</option>
            {#if ready}
              {#each app.options.purpose as x (x)}<option>{x}</option>{/each}
            {:else}
              <option>Fungicide</option><option>Insecticide</option><option>
                Nematicide
              </option><option>Biological</option><option>Unclassified</option>
            {/if}
          </select>
        </label><label class="field">
          <span>Technology type</span><select id="technology" bind:value={app.filters.technology}>
            <option value="">All technologies</option>
            {#each app.options.technology as x (x)}<option>{x}</option>{/each}
          </select>
        </label>
      </fieldset>
      <details>
        <summary>Groups &amp; EPA hazards</summary>
        <label class="field">
          <span>FRAC fungicide group</span><select id="frac" bind:value={app.filters.frac}>
            <option value="">All FRAC groups</option>
            {#each app.options.frac as x (x)}<option>{x}</option>{/each}
          </select>
        </label><label class="field">
          <span>IRAC insecticide group</span><select id="irac" bind:value={app.filters.irac}>
            <option value="">All IRAC groups</option>
            {#each app.options.irac as x (x)}<option>{x}</option>{/each}
          </select>
        </label><label class="field">
          <span>EPA signal word</span><select id="signal" bind:value={app.filters.signal}>
            <option value="">All signal words</option><option value="DANGER">DANGER</option><option
              value="WARNING"
            >
              WARNING
            </option><option value="CAUTION">CAUTION</option><option value="NONE">
              None reported by EPA
            </option><option value="NOT_SUPPLIED">Not supplied / needs review</option>
          </select>
        </label><label class="field">
          <span>EPA restricted-use flag</span><select id="rup" bind:value={app.filters.rup}>
            <option value="">All flags</option><option value="yes">Yes</option><option value="no">
              No
            </option><option value="unknown">Not supplied</option>
          </select>
        </label>
      </details>
      <details class="record-filters">
        <summary>Company &amp; ingredient evidence</summary>
        <label class="field">
          <span>Registrant / manufacturer</span><select
            id="manufacturer"
            bind:value={app.filters.manufacturer}
          >
            <option value="">All companies</option>
            {#each app.options.manufacturer as x (x)}<option>{x}</option>{/each}
          </select>
        </label><label class="field">
          <span>Ingredient data</span><select id="quality" bind:value={app.filters.quality}>
            <option value="">All records</option><option value="verified">
              EPA row · complete percentages
            </option><option value="base-linked">Related base formulation</option><option
              value="needs-review"
            >
              Needs review / missing fields
            </option>
          </select>
        </label>
      </details>
      <details>
        <summary>Registration status &amp; dates</summary>
        <label class="field">
          <span>Status group</span><input value="Active Products" disabled />
        </label><label class="field">
          <span>Status date – start</span><input
            type="date"
            id="start"
            max={today}
            aria-describedby="date-help date-error"
            aria-invalid={app.result.invalidDates ? 'true' : undefined}
            bind:value={app.filters.start}
          />
        </label><label class="field">
          <span>Status date – end</span><input
            type="date"
            id="end"
            max={today}
            aria-describedby="date-help date-error"
            aria-invalid={app.result.invalidDates ? 'true' : undefined}
            bind:value={app.filters.end}
          />
        </label>
        <p class="small muted" id="date-help">
          {ready
            ? 'Uses EPA STATUS_DT. Blank start; end is the import cutoff. Changing this filter does not retrieve newer EPA records.'
            : 'Start is blank; end defaults to today. Uses EPA status dates.'}
        </p>
        <p id="date-error" class="field-error" hidden={!app.result.invalidDates}>
          {app.result.invalidDates ? DATE_ERROR : ''}
        </p>
      </details>
      <div class="side-note">
        <strong>Seed treatment only.</strong> Grain-storage-only products and all deltamethrin products
        are excluded. Crop groups are not expanded into unverified uses.
      </div>
      <button
        id="apply-filters"
        class="solid mobile-filters"
        onclick={() => {
          app.filtersOpen = false;
          focusById('count');
        }}
      >
        Show results
      </button>
    </aside>
    <div>
      <div class="toolbar">
        <div class="search">
          <label for="query">Search products and ingredients</label><span aria-hidden="true">
            <Icon name="search" />
          </span><input
            id="query"
            type="search"
            placeholder="Search a product, active ingredient, or EPA number…"
            bind:value={app.filters.query}
          />
        </div>
        <button id="export" class="export" disabled={ready && !n} onclick={exportResults}>
          <Icon name="download" />Export results
        </button><button
          id="export-labels"
          class="export"
          aria-describedby="label-help"
          disabled={ready && !n}
          onclick={exportLabels}
        >
          <Icon name="download" />Export label links
        </button>
      </div>
      <p id="label-help" class="small muted label-help">
        Open a label PDF and use its download / save control. <strong>Export label links</strong> saves
        a CSV for all matching products across every page; reset filters to include the full catalog.
        PDF documents require an internet connection.
      </p>
      <div class="result-heading">
        <h3 id="count" tabindex="-1">
          {app.loadState === 'unavailable' ? 'No live catalog' : ready ? app.count : ''}
        </h3>
        <label class="small muted">
          Sort <select id="sort" aria-label="Sort products" bind:value={app.filters.sort}>
            <option value="name">Product name A–Z</option><option value="updated">
              Status date, newest
            </option>
          </select>
        </label>
      </div>
      <div id="applied" class="applied" role="group" aria-label="Applied product filters">
        {#if ready && !app.result.invalidDates}
          {#each appliedFilters(app.filters) as chip, i (i)}<span class="chip">{chip}</span>{/each}
        {/if}
      </div>
      <div id="results" role="region" aria-labelledby="count" bind:this={resultsEl}>
        {#if app.loadState === 'unavailable'}
          <div class="empty">
            <h3>Source connection required</h3>
            <p class="muted">Connect and validate the EPA source to publish the catalog.</p>
          </div>
        {:else if !ready}
          <!-- loading -->
        {:else if app.result.invalidDates}
          <div class="empty">
            <h3>Start date is after end date.</h3>
            <p>Choose a valid status-date range.</p>
          </div>
        {:else}
          {#each app.pageProducts as p (p.id)}
            <ProductCard product={p} />
          {:else}
            <div class="empty">
              <h3>No matching products.</h3>
              <p class="muted">Try a broader search or reset your filters.</p>
              <button
                data-reset
                onclick={() => {
                  app.reset();
                  focusById('query');
                }}
              >
                Reset filters
              </button>
              <!-- Deviation: Oct 19 also pointed at the state-evidence filter, which isn't ported. -->
              <p class="small muted">
                An empty result does not prove a product is unavailable or unregistered. Check the
                current label and relevant state authority before use.
              </p>
            </div>
          {/each}
        {/if}
      </div>
      <nav
        id="pager"
        class="pager"
        aria-label="Product result pages"
        hidden={ready && (app.result.invalidDates || !n)}
      >
        <button
          id="page-prev"
          disabled={ready && app.pageInfo.page <= 1}
          onclick={() => goToPage(Math.max(1, app.page - 1))}
        >
          ← Previous
        </button><span id="page-label">{ready ? app.pageInfo.label : ''}</span><button
          id="page-next"
          disabled={ready && app.pageInfo.page >= app.pageInfo.pages}
          onclick={() => goToPage(app.page + 1)}
        >
          Next →
        </button>
      </nav>
    </div>
  </div>
</section>
